"""Documents: create, list, inspect, play (chunk audio), progress, download."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse

from app.db.repo import Row
from app.db.schema import utcnow
from app.deps import CurrentIdentity, State, rate_limit
from app.errors import ApiError
from app.schemas import CreateDocument, Progress, RenameDocument
from app.services import tokens
from app.services.analytics import track
from app.services.documents import doc_public
from app.services.identity import Identity
from app.services.pipeline import ChunkNotReady, QuotaExceeded
from app.services.tts.base import TTSError
from app.storage.base import StorageError

router = APIRouter(prefix="/v1/docs", tags=["documents"])


async def _owned(state: State, identity: Identity, doc_id: str) -> Row:
    doc = await state.repo.get_document(doc_id)
    if doc is None or not identity.owns(doc["owner_key"]):
        raise ApiError(404, "doc_not_found", "We could not find that audio. It may have expired.")
    return doc


def _upgrade_hint(identity: Identity, doc: Row) -> dict[str, Any]:
    options = []
    if identity.kind == "anon":
        options.append("signup")
    if not doc["unlocked"]:
        options.append("book")
    if identity.plan_name != "pro":
        options.append("pro")
    return {"options": options}


@router.post("", dependencies=[Depends(rate_limit("create_doc", 30, 60))], status_code=201)
async def create_doc(body: CreateDocument, identity: CurrentIdentity, state: State) -> dict[str, Any]:
    draft = await state.repo.get_draft(body.draft_id)
    if draft is None or not identity.owns(draft["owner_key"]):
        raise ApiError(404, "draft_not_found", "This upload has expired. Please add your content again.")
    doc = await state.docs.create(identity, draft, body)
    await track(state.repo, "doc_created", identity, mode=doc["mode"], language=doc["language"], source_type=doc["source_type"], est_seconds=doc["est_seconds"])
    if identity.plan.has_feed:
        state.pipeline.render_all(doc, identity)
    elif doc["status"] == "ready":
        state.pipeline.prefetch(doc, 0, identity, count=2)  # first audio is usually ready before the player opens
    return doc_public(doc)


@router.get("")
async def list_docs(identity: CurrentIdentity, state: State) -> dict[str, Any]:
    keys = [identity.owner_key] + ([identity.alt_owner_key] if identity.alt_owner_key else [])
    docs: list[Row] = []
    for key in keys:
        docs.extend(await state.repo.list_documents(key))
    docs.sort(key=lambda d: d["created_at"], reverse=True)
    return {"documents": [doc_public(d, include_sections=False) for d in docs]}


@router.get("/{doc_id}")
async def get_doc(doc_id: str, identity: CurrentIdentity, state: State) -> dict[str, Any]:
    doc = await _owned(state, identity, doc_id)
    out = doc_public(doc)
    out["ready_chunks"] = await state.repo.ready_chunk_count(doc_id)
    allowance = await state.quota.allowance(identity)
    out["allowance"] = allowance.as_dict()
    out["can_download"] = identity.plan.can_download or bool(doc["unlocked"])
    return out


@router.patch("/{doc_id}")
async def rename_doc(doc_id: str, body: RenameDocument, identity: CurrentIdentity, state: State) -> dict[str, Any]:
    await _owned(state, identity, doc_id)
    await state.repo.update_document(doc_id, title=body.title.strip())
    return doc_public(await _owned(state, identity, doc_id))


@router.delete("/{doc_id}", status_code=204)
async def delete_doc(doc_id: str, identity: CurrentIdentity, state: State) -> None:
    await _owned(state, identity, doc_id)
    await state.repo.delete_document(doc_id)


@router.get("/{doc_id}/chunks")
async def list_chunks(
    doc_id: str, identity: CurrentIdentity, state: State, start: int = 0, limit: int = 300
) -> dict[str, Any]:
    await _owned(state, identity, doc_id)
    limit = max(1, min(limit, 500))
    rows = await state.repo.get_chunks(doc_id, start, start + limit)
    return {
        "start": start,
        "chunks": [
            {
                "idx": r["idx"],
                "text": r["text"],
                "kind": r["kind"],
                "section": r["section_idx"],
                "page_start": r["page_start"],
                "page_end": r["page_end"],
                "pause_ms": r["pause_ms"],
                "ready": r["status"] == "ready",
                "duration_ms": r["duration_ms"],
            }
            for r in rows
        ],
    }


@router.get("/{doc_id}/chunks/{index}/audio")
async def chunk_audio(doc_id: str, index: int, identity: CurrentIdentity, state: State) -> Response:
    doc = await _owned(state, identity, doc_id)
    try:
        audio = await state.pipeline.ensure_audio(doc, index, identity)
    except QuotaExceeded as exc:
        allowance = await state.quota.allowance(identity)
        await track(state.repo, "limit_hit", identity, plan=identity.plan_name)
        raise ApiError(
            402,
            "quota_exceeded",
            "You have reached today's free listening time.",
            {"allowance": allowance.as_dict(), **_upgrade_hint(identity, doc)},
        ) from exc
    except ChunkNotReady as exc:
        raise ApiError(409, "not_ready", "This part is still being prepared.", {"retry_after": 2}) from exc
    except LookupError as exc:
        raise ApiError(404, "chunk_not_found", "That part does not exist.") from exc
    except (TTSError, StorageError) as exc:
        raise ApiError(503, "tts_unavailable", "The voice is busy right now. Please try again in a moment.") from exc
    state.pipeline.prefetch(doc, index + 1, identity)
    return Response(
        audio.data,
        media_type="audio/mpeg",
        headers={"Cache-Control": "private, max-age=3600", "X-Duration-Ms": str(audio.duration_ms)},
    )


@router.post("/{doc_id}/progress", status_code=204)
async def save_progress(doc_id: str, body: Progress, identity: CurrentIdentity, state: State) -> None:
    await _owned(state, identity, doc_id)
    await state.repo.update_document(doc_id, progress_chunk=body.chunk, progress_offset=body.offset, last_played_at=utcnow())


# ------------------------------------------------------------------- download
def _safe_filename(title: str) -> tuple[str, str]:
    ascii_name = re.sub(r"[^A-Za-z0-9._ -]+", "", title).strip().replace(" ", "_")[:80] or "hearmeout"
    from urllib.parse import quote

    return ascii_name + ".mp3", quote(title[:80] + ".mp3")


@router.post("/{doc_id}/render", status_code=202)
async def render_all(doc_id: str, identity: CurrentIdentity, state: State) -> dict[str, Any]:
    """Prepare every chunk in the background so the whole document can be downloaded."""
    doc = await _owned(state, identity, doc_id)
    if not (identity.plan.can_download or doc["unlocked"]):
        raise ApiError(402, "download_locked", "Sign in to download audio.", {"options": ["signup"] if identity.kind == "anon" else ["pro"]})
    if doc["status"] == "failed":
        raise ApiError(409, "failed", "This document could not be prepared.")
    state.pipeline.render_all(doc, identity)
    return {"started": True}


@router.get("/{doc_id}/download-link")
async def download_link(doc_id: str, identity: CurrentIdentity, state: State) -> dict[str, str]:
    doc = await _owned(state, identity, doc_id)
    if not (identity.plan.can_download or doc["unlocked"]):
        raise ApiError(402, "download_locked", "Sign in to download audio.")
    token = tokens.issue_playback(state.settings.app_secret, doc_id, doc["owner_key"], minutes=30)
    return {"url": f"/v1/docs/{doc_id}/download?pt={token}"}


@router.get("/{doc_id}/download")
async def download(doc_id: str, pt: str, state: State, request: Request) -> StreamingResponse:
    doc = await state.repo.get_document(doc_id)
    if doc is None:
        raise ApiError(404, "doc_not_found", "We could not find that audio. It may have expired.")
    try:
        fingerprint = tokens.verify_playback(state.settings.app_secret, pt, doc_id)
    except tokens.TokenError as exc:
        raise ApiError(403, "bad_token", "This download link has expired. Open the page and try again.") from exc
    if fingerprint != tokens.owner_fingerprint(doc["owner_key"]):
        raise ApiError(403, "bad_token", "This download link is not valid.")
    chunks = await state.repo.get_chunks(doc_id)
    if doc["status"] != "ready" or not chunks or any(c["status"] != "ready" for c in chunks):
        ready = sum(1 for c in chunks if c["status"] == "ready")
        raise ApiError(409, "not_ready", "The full audio is still being prepared.", {"ready": ready, "total": len(chunks)})
    total = sum(int(c["bytes"] or 0) for c in chunks)

    async def stream() -> AsyncIterator[bytes]:
        for c in chunks:
            try:
                yield await state.storage.get(c["audio_key"])
            except StorageError:
                return

    ascii_name, utf8_name = _safe_filename(doc["title"])
    return StreamingResponse(
        stream(),
        media_type="audio/mpeg",
        headers={
            "Content-Length": str(total),
            "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}",
            "Cache-Control": "private, no-store",
        },
    )

