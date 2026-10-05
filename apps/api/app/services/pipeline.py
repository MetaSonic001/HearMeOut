"""Chunk audio production and AI scripting.

* `ensure_audio` returns the MP3 for one chunk, synthesizing it on first request.
  Audio is content-addressed so identical text+voice is synthesized once for everyone.
* Quota is charged exactly once per chunk per document, when it first becomes ready.
* `start_scripting` runs the AI modes in the background, section by section, persisting
  progress so it can resume after a restart.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from app.config import Settings
from app.db.repo import Repo, Row
from app.services import mp3
from app.services.chunking import FIRST_TARGET, ChunkSpec, chunk_script
from app.services.estimate import chars_per_second
from app.services.identity import Identity
from app.services.languages import get_language, resolve_language
from app.services.llm.groq import GroqClient, LLMError
from app.services.llm.scripts import QA, QUIZ_PAUSE_MS, ScriptResult, make_script
from app.services.quota import Quota
from app.services.tts.base import TTSError, TTSProvider
from app.storage.base import AudioStorage, StorageError

log = logging.getLogger(__name__)
PREFETCH_AHEAD = 3


class QuotaExceeded(Exception):
    pass


class ChunkNotReady(Exception):
    """The chunk has not been scripted yet (AI mode still preparing)."""


@dataclass(slots=True)
class ChunkAudio:
    data: bytes
    duration_ms: int
    key: str


def audio_key(provider: str, voice: str, text: str, pause_ms: int) -> str:
    digest = hashlib.sha256(f"{provider}|{voice}|{pause_ms}|{text}".encode()).hexdigest()
    return f"tts/{digest[:2]}/{digest}.mp3"


def specs_to_rows(specs: list[ChunkSpec], start_idx: int) -> list[Row]:
    return [
        {
            "idx": start_idx + i,
            "text": s.text,
            "kind": s.kind,
            "section_idx": s.section_idx,
            "page_start": s.page_start,
            "page_end": s.page_end,
            "pause_ms": s.pause_ms,
            "voice": s.voice,
            "status": "pending",
        }
        for i, s in enumerate(specs)
    ]


def quiz_specs(qa: list[QA], title: str, section_idx: int, pages: tuple[int | None, int | None], voice2: str) -> list[ChunkSpec]:
    specs: list[ChunkSpec] = []
    for item in qa:
        specs.append(ChunkSpec(item.question, section_idx, pages[0], pages[1], "question", QUIZ_PAUSE_MS))
        specs.append(ChunkSpec(item.answer, section_idx, pages[0], pages[1], "answer", 900, voice2))
    return specs


class Pipeline:
    def __init__(
        self,
        repo: Repo,
        storage: AudioStorage,
        tts: TTSProvider,
        llm: GroqClient | None,
        quota: Quota,
        settings: Settings,
    ):
        self.repo, self.storage, self.tts, self.llm, self.quota, self.settings = repo, storage, tts, llm, quota, settings
        self._locks: dict[tuple[str, int], asyncio.Lock] = {}
        self._lock_users: defaultdict[tuple[str, int], int] = defaultdict(int)
        self._script_tasks: dict[str, asyncio.Task[None]] = {}
        self._render_tasks: dict[str, asyncio.Task[None]] = {}
        self._bg: set[asyncio.Task[None]] = set()
        self._script_sem = asyncio.Semaphore(2)

    # ------------------------------------------------------------------ audio
    async def _acquire(self, key: tuple[str, int]) -> asyncio.Lock:
        lock = self._locks.setdefault(key, asyncio.Lock())
        self._lock_users[key] += 1
        await lock.acquire()
        return lock

    def _release(self, key: tuple[str, int], lock: asyncio.Lock) -> None:
        lock.release()
        self._lock_users[key] -= 1
        if self._lock_users[key] <= 0:
            self._lock_users.pop(key, None)
            self._locks.pop(key, None)

    async def ensure_audio(self, doc: Row, idx: int, identity: Identity) -> ChunkAudio:
        doc_id = doc["id"]
        chunk = await self.repo.get_chunk(doc_id, idx)
        if chunk is None:
            raise ChunkNotReady() if doc["status"] == "processing" else LookupError(f"chunk {idx} not found")

        if chunk["status"] == "ready" and chunk["audio_key"]:
            try:
                data = await self.storage.get(chunk["audio_key"])
                return ChunkAudio(data, int(chunk["duration_ms"] or 0), chunk["audio_key"])
            except StorageError:
                log.warning("Audio object %s missing; regenerating", chunk["audio_key"])

        lock_key = (doc_id, idx)
        lock = await self._acquire(lock_key)
        try:
            chunk = await self.repo.get_chunk(doc_id, idx)
            assert chunk is not None
            was_ready = chunk["status"] == "ready"
            needs_charge = not was_ready and not doc["unlocked"] and not identity.is_admin
            voice = chunk["voice"] or doc["voice"]
            pause_ms = int(chunk["pause_ms"] or 0)
            key = audio_key(self.tts.name, voice, chunk["text"], pause_ms)

            async def check_quota() -> None:
                if needs_charge and (await self.quota.allowance(identity)).remaining_seconds <= 0:
                    raise QuotaExceeded()

            _, obj = await asyncio.gather(check_quota(), self.repo.get_audio_object(key))
            data: bytes | None = None
            duration_ms = 0
            if obj:
                try:
                    data = await self.storage.get(key)
                    duration_ms = int(obj["duration_ms"])
                except StorageError:
                    data = None
            if data is None:
                started = time.monotonic()
                audio = await self.tts.synthesize(chunk["text"], voice)
                if pause_ms:
                    audio += mp3.silence(pause_ms)
                info = mp3.inspect(audio)
                data, duration_ms = audio, info.duration_ms
                log.info(
                    "Audio made: doc=%s chunk=%d voice=%s %d chars -> %.1fs of audio in %.1fs",
                    doc_id, idx, voice, len(chunk["text"]), duration_ms / 1000, time.monotonic() - started,
                )
                # independent writes run together to keep time-to-first-audio low
                _, _, flipped = await asyncio.gather(
                    self.storage.put(key, audio),
                    self.repo.put_audio_object(key, len(audio), duration_ms),
                    self.repo.mark_chunk_ready(doc_id, idx, key, duration_ms, len(audio)),
                )
            else:
                flipped = await self.repo.mark_chunk_ready(doc_id, idx, key, duration_ms, len(data))
            if flipped and needs_charge:
                await self.quota.charge_seconds(identity, duration_ms / 1000)
            elif was_ready:
                await self.repo.update_chunk_audio(doc_id, idx, key, duration_ms, len(data))
            return ChunkAudio(data, duration_ms, key)
        finally:
            self._release(lock_key, lock)

    def prefetch(self, doc: Row, start: int, identity: Identity, count: int = PREFETCH_AHEAD) -> None:
        """Warm the next chunks in the background so playback never waits."""

        async def run() -> None:
            for idx in range(start, start + count):
                try:
                    await self.ensure_audio(doc, idx, identity)
                except (QuotaExceeded, ChunkNotReady, LookupError):
                    return
                except (TTSError, StorageError, OSError) as exc:
                    log.warning("Prefetch of %s/%s failed: %r", doc["id"], idx, exc)
                    return

        self._spawn(run())

    def render_all(self, doc: Row, identity: Identity) -> None:
        """Prepare every chunk of a document (for download / podcast feed). Idempotent per document."""
        existing = self._render_tasks.get(doc["id"])
        if existing and not existing.done():
            return

        async def run() -> None:
            idx = 0
            while True:
                fresh = await self.repo.get_document(doc["id"])
                if fresh is None:
                    return
                total = fresh["total_chunks"]
                if total is not None and idx >= total:
                    return
                try:
                    await self.ensure_audio(fresh, idx, identity)
                except ChunkNotReady:
                    if fresh["status"] != "processing":
                        return
                    await asyncio.sleep(2)
                    continue
                except (QuotaExceeded, LookupError):
                    return
                except (TTSError, StorageError, OSError) as exc:
                    log.warning("Render of %s/%s failed: %r", doc["id"], idx, exc)
                    return
                idx += 1

        task = asyncio.create_task(run())
        self._render_tasks[doc["id"]] = task
        task.add_done_callback(lambda _t, d=doc["id"]: self._render_tasks.pop(d, None))

    def _spawn(self, coro: Any) -> None:
        task = asyncio.create_task(coro)
        self._bg.add(task)
        task.add_done_callback(self._bg.discard)

    # -------------------------------------------------------------- scripting
    def start_scripting(self, doc_id: str) -> None:
        existing = self._script_tasks.get(doc_id)
        if existing and not existing.done():
            return
        task = asyncio.create_task(self._script_doc(doc_id))
        self._script_tasks[doc_id] = task
        task.add_done_callback(lambda _t, d=doc_id: self._script_tasks.pop(d, None))

    async def resume_unfinished(self) -> None:
        for doc in await self.repo.unfinished_documents():
            self.start_scripting(doc["id"])

    async def _script_doc(self, doc_id: str) -> None:
        async with self._script_sem:
            try:
                await self._script_doc_inner(doc_id)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.exception("Scripting failed for %s", doc_id)
                if isinstance(exc, LLMError):
                    message = "The AI service is busy or unavailable right now. Please try again in a minute."
                else:
                    message = f"Could not prepare this document: {exc}"
                await self.repo.update_document(doc_id, status="failed", error=message[:300])

    async def _script_doc_inner(self, doc_id: str) -> None:
        doc = await self.repo.get_document(doc_id)
        if not doc or doc["status"] != "processing":
            return
        language = get_language(doc["language"]) or resolve_language("en")
        sources = await self.repo.get_sources(doc_id, start=int(doc["scripted_sections"]))
        sections: list[dict[str, Any]] = list(doc["sections"])
        next_idx = await self.repo.count_chunks(doc_id)
        total_sections = int(doc["total_sections"])
        voice2 = doc["voice2"] or doc["voice"]
        total_chars = sum(len(c["text"]) for c in await self.repo.get_chunks(doc_id)) if next_idx else 0

        for src in sources:
            result: ScriptResult = await make_script(
                self.llm,
                doc["mode"],
                language,
                src["title"],
                src["text"],
                position=int(src["idx"]),
                total=total_sections,
                source_is_target_language=bool(doc["options"].get("same_language", True)),
            )
            log.info(
                "Script ready: doc=%s section=%d/%d mode=%s written_by=%s",
                doc_id, int(src["idx"]) + 1, total_sections, doc["mode"], "AI" if result.used_llm else "built-in summariser",
            )
            pages = (src["page_start"], src["page_end"])
            first_target = FIRST_TARGET if next_idx == 0 else None
            if doc["mode"] == "quiz":
                specs = quiz_specs(result.qa, src["title"], int(src["idx"]), pages, voice2)
                if specs:
                    specs.insert(0, ChunkSpec(src["title"].rstrip(".") + ".", int(src["idx"]), pages[0], pages[1], "narration", 600))
            else:
                specs = chunk_script(result.text, int(src["idx"]), page_start=pages[0], page_end=pages[1], first_target=first_target)
            rows = specs_to_rows(specs, next_idx)
            if src["idx"] < len(sections):
                sections[src["idx"]] = {**sections[src["idx"]], "first_chunk": next_idx if rows else None, "chunk_count": len(rows)}
            total_chars += sum(len(r["text"]) for r in rows)
            next_idx += len(rows)
            done = int(src["idx"]) + 1
            fields: dict[str, Any] = {"scripted_sections": done, "sections": sections}
            if done >= total_sections:
                fields.update(status="ready", total_chunks=next_idx, est_seconds=round(total_chars / chars_per_second(doc["language"])))
            await self.repo.add_chunks(doc_id, rows, **fields)

        if not sources:
            await self.repo.update_document(doc_id, status="ready", total_chunks=next_idx)

    async def shutdown(self) -> None:
        """Stop background work without ever hanging: let tasks finish briefly, then cancel."""
        tasks = [*self._script_tasks.values(), *self._render_tasks.values(), *self._bg]
        if not tasks:
            return
        _, pending = await asyncio.wait(tasks, timeout=2)
        for task in pending:
            task.cancel()
        if pending:
            _, stuck = await asyncio.wait(pending, timeout=3)
            for task in stuck:
                log.warning("Background task did not stop on shutdown: %r stack=%s", task, task.get_stack())
