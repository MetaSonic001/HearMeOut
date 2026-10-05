"""Drafts (extracted + outlined content) and documents (a draft rendered in a mode/voice)."""

from __future__ import annotations

import logging
import secrets
from datetime import timedelta
from typing import Any

from app.config import Settings
from app.db.repo import Repo, Row
from app.db.schema import utcnow
from app.errors import ApiError
from app.schemas import CreateDocument
from app.services.chunking import FIRST_TARGET, chunk_blocks
from app.services.estimate import MODE_RATIO, estimate_seconds
from app.services.extract import Block, Extracted, ExtractionError
from app.services.identity import Identity
from app.services.langdetect import detect_language
from app.services.languages import LANGUAGES, get_language
from app.services.outline import build_sections
from app.services.pipeline import Pipeline, specs_to_rows
from app.services.plans import AI_MODES
from app.services.quota import Quota
from app.services.textprep import count_speech_chars, prepare_blocks
from app.services.tts.voices import default_voices, get_voice, voices_for_language

DRAFT_TTL = timedelta(hours=6)
log = logging.getLogger(__name__)


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(9)}"


def text_to_blocks(text: str, page: int | None = None) -> list[Block]:
    """Turn edited plain text back into paragraph blocks."""
    import re

    out = []
    for para in re.split(r"\n\s*\n", text.replace("\r\n", "\n")):
        para = " ".join(para.split())
        if para:
            out.append(Block("p", para, page))
    return out


def build_draft_row(extracted: Extracted, owner_key: str) -> Row:
    blocks = prepare_blocks(extracted.blocks)
    if not blocks:
        raise ExtractionError("empty", "We could not find any readable text. If this is a scanned document, run OCR first.")
    sections = build_sections(blocks, title=extracted.title)
    nested: list[dict[str, Any]] = []
    for sec in sections:
        part = blocks[sec.start : sec.end]
        nested.append(
            {
                "idx": sec.idx,
                "title": sec.title,
                "page_start": sec.page_start,
                "page_end": sec.page_end,
                "chars": sum(len(b.t) for b in part),
                "blocks": [b.as_dict() for b in part],
            }
        )
    sample = " ".join(b.t for b in blocks[:40])
    language = detect_language(sample)
    warnings = list(extracted.warnings)
    dropped = len(extracted.blocks) - len(blocks)
    if dropped > 0 and extracted.source_type == "pdf":
        warnings.append("Page numbers, headers, footers, citations and the reference list were removed for smoother listening.")
    return {
        "id": new_id("drf"),
        "owner_key": owner_key,
        "title": extracted.title,
        "source_type": extracted.source_type,
        "source_name": None,
        "language": language,
        "page_count": extracted.page_count,
        "total_chars": count_speech_chars(blocks),
        "sections": nested,
        "warnings": warnings,
        "created_at": utcnow(),
        "expires_at": utcnow() + DRAFT_TTL,
    }


def draft_summary(draft: Row, identity: Identity) -> dict[str, Any]:
    language = draft["language"]
    estimates = {mode: estimate_seconds(draft["total_chars"], language, mode) for mode in MODE_RATIO}
    first = ""
    for sec in draft["sections"]:
        for block in sec["blocks"]:
            if block["k"] == "p":
                first = block["t"]
                break
        if first:
            break
    return {
        "id": draft["id"],
        "status": draft.get("status") or "ready",
        "error": draft.get("error"),
        "ocr": draft.get("progress"),
        "title": draft["title"],
        "source_type": draft["source_type"],
        "language": language,
        "page_count": draft["page_count"],
        "total_chars": draft["total_chars"],
        "estimates": estimates,
        "warnings": draft["warnings"],
        "preview": first[:420],
        "sections": [
            {k: sec[k] for k in ("idx", "title", "page_start", "page_end", "chars")} for sec in draft["sections"]
        ],
        "limits": {"max_chars": identity.plan.max_chars},
        "expires_at": draft["expires_at"].isoformat(),
    }


def doc_public(doc: Row, *, include_sections: bool = True) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": doc["id"],
        "title": doc["title"],
        "source_type": doc["source_type"],
        "mode": doc["mode"],
        "language": doc["language"],
        "voice": doc["voice"],
        "voice2": doc["voice2"],
        "status": doc["status"],
        "error": doc["error"],
        "est_seconds": doc["est_seconds"],
        "total_chunks": doc["total_chunks"],
        "total_sections": doc["total_sections"],
        "scripted_sections": doc["scripted_sections"],
        "page_count": doc["page_count"],
        "unlocked": doc["unlocked"],
        "ai": doc["ai"],
        "progress": {"chunk": doc["progress_chunk"], "offset": doc["progress_offset"]},
        "created_at": doc["created_at"].isoformat(),
        "expires_at": doc["expires_at"].isoformat(),
    }
    if include_sections:
        out["sections"] = doc["sections"]
    return out


class DocumentService:
    def __init__(self, repo: Repo, quota: Quota, pipeline: Pipeline, settings: Settings):
        self.repo, self.quota, self.pipeline, self.settings = repo, quota, pipeline, settings

    @property
    def llm_enabled(self) -> bool:
        return bool(self.pipeline.llm and self.pipeline.llm.enabled)

    def _resolve_voices(self, req: CreateDocument, source_language: str) -> tuple[str, str, str, bool]:
        """Return (language code, voice, voice2, same_language) after validating the choice."""
        if req.mode == "read":
            language = source_language
            if req.voice:
                voice_obj = get_voice(req.voice)
                if voice_obj is None:
                    raise ApiError(422, "unknown_voice", "That voice is not available. Pick another one.")
                language = "hinglish" if voice_obj.locale == "en-IN" and req.language == "hinglish" else voice_obj.language
        else:
            language = req.language or source_language
            if get_language(language) is None:
                raise ApiError(422, "unknown_language", "That language is not supported.")
            if req.mode == "translate":
                if not self.llm_enabled:
                    raise ApiError(503, "translation_unavailable", "Translation is not switched on for this site yet.")
                if language == source_language:
                    raise ApiError(422, "same_language", "Pick a different language to translate into, or use Read it to me.")
            elif not self.llm_enabled:
                language = source_language  # no translation without the LLM
        lang = get_language(language) or LANGUAGES[0]
        voice, voice2 = default_voices(lang)
        if req.voice:
            voice_obj = get_voice(req.voice)
            if voice_obj is None:
                raise ApiError(422, "unknown_voice", "That voice is not available. Pick another one.")
            allowed = {v.id for v in voices_for_language(language)}
            if req.mode != "read" and voice_obj.id not in allowed:
                raise ApiError(422, "voice_language_mismatch", f"Pick a {lang.label} voice for {lang.label} audio.")
            voice = voice_obj.id
            if voice2 == voice:
                voice2 = next((v.id for v in voices_for_language(language) if v.id != voice and v.gender != voice_obj.gender), voice2)
        if req.voice2:
            voice2_obj = get_voice(req.voice2)
            if voice2_obj is None:
                raise ApiError(422, "unknown_voice", "That second voice is not available.")
            voice2 = voice2_obj.id
        return language, voice, voice2, language == source_language

    async def create(self, identity: Identity, draft: Row, req: CreateDocument) -> Row:
        plan = identity.plan
        if (draft.get("status") or "ready") != "ready":
            raise ApiError(409, "draft_not_ready", "This scan is still being read. Wait for it to finish, then create the audio.")
        if req.mode in AI_MODES:
            allowance = await self.quota.allowance(identity)
            if allowance.ai_remaining <= 0:
                raise ApiError(
                    402,
                    "ai_limit",
                    "You have used today's smart-listening documents. Sign in for more, or come back tomorrow.",
                    {"upgrade": identity.kind == "anon" and "signup" or "pro", "resets_at": allowance.resets_at.isoformat()},
                )

        wanted = set(req.sections) if req.sections is not None else {s["idx"] for s in draft["sections"]}
        chosen = [s for s in draft["sections"] if s["idx"] in wanted]
        if not chosen:
            raise ApiError(422, "no_sections", "Select at least one section to listen to.")
        source_chars = sum(s["chars"] for s in chosen)
        if source_chars > plan.max_chars:
            raise ApiError(
                413,
                "too_long",
                f"This selection has {source_chars:,} characters; your plan allows {plan.max_chars:,} per document. "
                "Select fewer sections or upgrade.",
                {"max_chars": plan.max_chars, "chars": source_chars},
            )

        language, voice, voice2, same = self._resolve_voices(req, draft["language"])
        doc_id = new_id("doc")
        now = utcnow()
        ai = req.mode in AI_MODES
        sections_meta: list[dict[str, Any]] = []
        chunk_rows: list[Row] = []
        source_rows: list[Row] = []
        next_idx = 0

        for new_idx, sec in enumerate(chosen):
            blocks = [Block.from_dict(b) for b in sec["blocks"]]
            meta = {
                "idx": new_idx,
                "title": sec["title"],
                "page_start": sec["page_start"],
                "page_end": sec["page_end"],
                "first_chunk": None,
                "chunk_count": 0,
            }
            if ai:
                source_rows.append(
                    {
                        "idx": new_idx,
                        "title": sec["title"],
                        "page_start": sec["page_start"],
                        "page_end": sec["page_end"],
                        "text": "\n\n".join(b.t for b in blocks),
                    }
                )
            else:
                specs = chunk_blocks(blocks, new_idx, first_target=FIRST_TARGET if next_idx == 0 else None)
                rows = specs_to_rows(specs, next_idx)
                meta["first_chunk"] = next_idx if rows else None
                meta["chunk_count"] = len(rows)
                chunk_rows.extend(rows)
                next_idx += len(rows)
            sections_meta.append(meta)

        est = estimate_seconds(source_chars, language, req.mode)
        ttl_days = plan.ttl_days
        row: Row = {
            "id": doc_id,
            "owner_key": identity.owner_key,
            "title": (req.title or draft["title"]).strip()[:140],
            "source_type": draft["source_type"],
            "mode": req.mode,
            "language": language,
            "voice": voice,
            "voice2": voice2 if req.mode == "quiz" else None,
            "status": "processing" if ai else "ready",
            "error": None,
            "source_chars": source_chars,
            "est_seconds": est,
            "total_chunks": None if ai else next_idx,
            "total_sections": len(chosen),
            "scripted_sections": 0,
            "page_count": draft["page_count"],
            "sections": sections_meta,
            "options": {"same_language": same, "draft_language": draft["language"]},
            "ai": ai,
            "unlocked": False,
            "progress_chunk": 0,
            "progress_offset": 0.0,
            "created_at": now,
            "expires_at": now + timedelta(days=ttl_days),
        }
        await self.repo.create_document(row, source_rows, chunk_rows)
        if ai:
            await self.quota.charge_ai_doc(identity)
            self.pipeline.start_scripting(doc_id)
        log.info(
            "Document created: id=%s mode=%s language=%s voice=%s sections=%d chars=%d plan=%s",
            doc_id, req.mode, language, voice, len(chosen), source_chars, identity.plan_name,
        )
        created = await self.repo.get_document(doc_id)
        assert created is not None
        return created
