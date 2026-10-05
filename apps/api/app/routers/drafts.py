"""Drafts: bring content in (upload / paste / link), inspect the outline, edit sections."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.db.repo import Row
from app.db.schema import utcnow
from app.deps import CurrentIdentity, State, rate_limit
from app.errors import ApiError
from app.schemas import DraftFromText, DraftFromUrl, SectionUpdate
from app.services.analytics import track
from app.services.documents import DRAFT_TTL, build_draft_row, draft_summary, new_id, text_to_blocks
from app.services.extract import (
    SUPPORTED_EXTENSIONS,
    Extracted,
    ExtractionError,
    NeedsOcr,
    extract_bytes,
    extract_link,
    extract_pasted,
)
from app.services.identity import Identity
from app.services.textprep import prepare_blocks

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/drafts", tags=["drafts"])
limit_intake = Depends(rate_limit("intake", 20, 60))
HARD_MAX_CHARS = 8_000_000


async def _store(state: State, identity: Identity, extracted: Extracted, source_name: str | None = None) -> dict[str, object]:
    try:
        row = build_draft_row(extracted, identity.owner_key)
    except ExtractionError as exc:
        raise ApiError(422, exc.code, exc.message) from exc
    if source_name:
        row["source_name"] = source_name[:200]
    if row["total_chars"] > HARD_MAX_CHARS:
        raise ApiError(413, "too_long", "This document is too large to process in one go.")
    await state.repo.create_draft(row)
    await track(state.repo, "draft_created", identity, source_type=row["source_type"], chars=row["total_chars"])
    log.info("Draft created: id=%s type=%s chars=%d language=%s", row["id"], row["source_type"], row["total_chars"], row["language"])
    return draft_summary(row, identity)


def _wrap(exc: ExtractionError) -> ApiError:
    status = 413 if exc.code in {"too_large", "too_many_pages"} else 422
    return ApiError(status, exc.code, exc.message)


async def _owned_draft(state: State, identity: Identity, draft_id: str) -> Row:
    draft = await state.repo.get_draft(draft_id)
    if draft is None or not identity.owns(draft["owner_key"]):
        raise ApiError(404, "draft_not_found", "This upload has expired. Please add your content again.")
    return draft


@router.post("/text", dependencies=[limit_intake])
async def draft_from_text(body: DraftFromText, identity: CurrentIdentity, state: State) -> dict[str, object]:
    try:
        extracted = await extract_pasted(body.text, body.title)
    except ExtractionError as exc:
        raise _wrap(exc) from exc
    return await _store(state, identity, extracted)


@router.post("/url", dependencies=[limit_intake])
async def draft_from_url(body: DraftFromUrl, identity: CurrentIdentity, state: State) -> dict[str, object]:
    try:
        extracted = await extract_link(str(body.url))
    except ExtractionError as exc:
        raise _wrap(exc) from exc
    return await _store(state, identity, extracted, str(body.url))


@router.post("/file", dependencies=[limit_intake])
async def draft_from_file(
    identity: CurrentIdentity,
    state: State,
    file: Annotated[UploadFile, File()],
    title: Annotated[str | None, Form()] = None,
    ocr_language: Annotated[str | None, Form()] = None,
) -> dict[str, object]:
    name = file.filename or "document"
    ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext and ext not in SUPPORTED_EXTENSIONS and ext not in {".doc", ".rtf", ".odt", ".ppt", ".pptx", ".xls", ".xlsx"}:
        raise ApiError(422, "unsupported", "This file type is not supported. Use PDF, DOCX, EPUB, TXT or HTML.")
    limit = identity.plan.max_file_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise ApiError(
            413,
            "file_too_large",
            f"This file is larger than {identity.plan.max_file_mb} MB. Sign in or upgrade for bigger files, or split it.",
            {"max_mb": identity.plan.max_file_mb},
        )
    if not data:
        raise ApiError(422, "empty", "That file is empty.")
    try:
        extracted = await extract_bytes(name, data)
    except NeedsOcr as scan:
        return await _start_ocr(state, identity, name, data, scan, title, ocr_language)
    except ExtractionError as exc:
        raise _wrap(exc) from exc
    if title:
        extracted.title = title.strip()[:140]
    return await _store(state, identity, extracted, name)


async def _start_ocr(
    state: State, identity: Identity, name: str, data: bytes, scan: NeedsOcr, title: str | None, language: str | None
) -> dict[str, object]:
    """A scanned PDF: create a placeholder draft and read the pages in the background."""
    if not state.ocr.available:
        raise ApiError(422, "scanned_pdf", scan.message)
    limit = identity.plan.max_ocr_pages
    if len(scan.pages) > limit:
        hint = " Sign up free to read more pages." if identity.kind == "anon" else " Split the file, or upgrade for a higher limit."
        raise ApiError(
            413,
            "ocr_too_long",
            f"This scan has {len(scan.pages)} pages without text. Your plan can read up to {limit} scanned pages per file.{hint}",
            {"pages": len(scan.pages), "max_pages": limit},
        )
    stem = name.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip() or "Scanned document"
    now = utcnow()
    row: Row = {
        "id": new_id("drf"),
        "owner_key": identity.owner_key,
        "title": (title or stem).strip()[:140],
        "source_type": "pdf",
        "source_name": name[:200],
        "language": "en",
        "page_count": scan.page_count,
        "total_chars": 0,
        "sections": [],
        "warnings": [],
        "status": "ocr",
        "progress": {"stage": "queued", "done": 0, "total": len(scan.pages), "script": None, "queued": True, "seconds": 0},
        "error": None,
        "created_at": now,
        "expires_at": now + DRAFT_TTL,
    }
    await state.repo.create_draft(row)
    await track(state.repo, "ocr_started", identity, pages=len(scan.pages))
    state.ocr.start(row["id"], identity.owner_key, data, name, scan.pages, language, title)
    return draft_summary(row, identity)


@router.get("/{draft_id}")
async def get_draft(draft_id: str, identity: CurrentIdentity, state: State) -> dict[str, object]:
    draft = await _owned_draft(state, identity, draft_id)
    if draft["status"] == "ocr":
        live = state.ocr.progress(draft_id)
        if live is None:  # the server restarted while this scan was being read
            await state.repo.update_draft(
                draft_id, status="failed", error="Reading this scan was interrupted. Please upload it again.", progress=None
            )
            draft = {**draft, "status": "failed", "error": "Reading this scan was interrupted. Please upload it again.", "progress": None}
        else:
            draft = {**draft, "progress": live}
    return draft_summary(draft, identity)


@router.get("/{draft_id}/sections/{index}")
async def get_section(draft_id: str, index: int, identity: CurrentIdentity, state: State) -> dict[str, object]:
    draft = await _owned_draft(state, identity, draft_id)
    section = next((s for s in draft["sections"] if s["idx"] == index), None)
    if section is None:
        raise ApiError(404, "section_not_found", "That section does not exist.")
    text = "\n\n".join(b["t"] for b in section["blocks"])
    return {"idx": index, "title": section["title"], "text": text, "chars": len(text)}


@router.put("/{draft_id}/sections/{index}")
async def update_section(
    draft_id: str, index: int, body: SectionUpdate, identity: CurrentIdentity, state: State
) -> dict[str, object]:
    draft = await _owned_draft(state, identity, draft_id)
    sections = list(draft["sections"])
    pos = next((i for i, s in enumerate(sections) if s["idx"] == index), None)
    if pos is None:
        raise ApiError(404, "section_not_found", "That section does not exist.")
    section = dict(sections[pos])
    if body.title is not None and body.title.strip():
        section["title"] = body.title.strip()
    if body.text is not None:
        page = section.get("page_start")
        cleaned = prepare_blocks(text_to_blocks(body.text, page))
        if not cleaned:
            raise ApiError(422, "empty", "A section needs some text. Untick it instead to leave it out.")
        section["blocks"] = [b.as_dict() for b in cleaned]
        section["chars"] = sum(len(b.t) for b in cleaned)
    sections[pos] = section
    total = sum(s["chars"] for s in sections)
    await state.repo.update_draft(draft_id, sections=sections, total_chars=total)
    updated = {**draft, "sections": sections, "total_chars": total}
    return draft_summary(updated, identity)


@router.delete("/{draft_id}", status_code=204)
async def delete_draft(draft_id: str, identity: CurrentIdentity, state: State) -> None:
    await _owned_draft(state, identity, draft_id)
    await state.repo.delete_draft(draft_id)
