"""Private podcast feed (Pro): one RSS item per chapter, streamed with HTTP Range support."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from datetime import timedelta
from email.utils import format_datetime
from xml.sax.saxutils import escape

from fastapi import APIRouter, Header, Request, Response
from fastapi.responses import StreamingResponse

from app.db.repo import Row
from app.deps import State
from app.errors import ApiError
from app.services.identity import effective_plan
from app.storage.base import AudioStorage, StorageError

router = APIRouter(tags=["feed"])
_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


async def _feed_user(state: State, token: str) -> Row:
    user = await state.repo.user_by_feed_token(token)
    if user is None:
        raise ApiError(404, "not_found", "This feed link is not valid.")
    clerk = await state.auth.lookup(user["id"])
    if effective_plan(user, clerk.is_admin) not in {"pro", "admin"}:
        raise ApiError(402, "pro_required", "Podcast feeds are part of HearMeOut Pro.")
    return user


def _section_chunks(chunks: list[Row], section: int) -> list[Row]:
    return [c for c in chunks if c["section_idx"] == section]


async def _episodes(state: State, user: Row) -> list[dict[str, object]]:
    episodes: list[dict[str, object]] = []
    for doc in await state.repo.list_documents(f"user:{user['id']}", limit=60):
        if doc["status"] == "failed":
            continue
        chunks = await state.repo.get_chunks(doc["id"])
        for sec in doc["sections"]:
            part = _section_chunks(chunks, sec["idx"])
            if not part or any(c["status"] != "ready" for c in part):
                continue
            episodes.append(
                {
                    "guid": f"{doc['id']}:{sec['idx']}",
                    "doc_id": doc["id"],
                    "section": sec["idx"],
                    "title": f"{doc['title']} - {sec['title']}" if len(doc["sections"]) > 1 else doc["title"],
                    "description": f"{doc['title']} ({doc['mode']} mode), chapter {sec['idx'] + 1}: {sec['title']}",
                    "bytes": sum(int(c["bytes"] or 0) for c in part),
                    "seconds": round(sum(int(c["duration_ms"] or 0) for c in part) / 1000),
                    "date": doc["created_at"] + timedelta(seconds=int(sec["idx"])),
                }
            )
    return episodes


def _hhmmss(seconds: int) -> str:
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


@router.get("/v1/feed/{token}.xml")
async def feed(token: str, state: State) -> Response:
    user = await _feed_user(state, token)
    base = state.settings.api_public_url.rstrip("/")
    site = state.settings.site_url.rstrip("/")
    items = []
    for ep in await _episodes(state, user):
        url = f"{base}/v1/feed/{token}/{ep['doc_id']}/{ep['section']}.mp3"
        items.append(
            f"<item><title>{escape(str(ep['title']))}</title>"
            f"<description>{escape(str(ep['description']))}</description>"
            f"<guid isPermaLink=\"false\">{escape(str(ep['guid']))}</guid>"
            f"<pubDate>{format_datetime(ep['date'])}</pubDate>"  # type: ignore[arg-type]
            f'<enclosure url="{escape(url)}" length="{ep["bytes"]}" type="audio/mpeg"/>'
            f"<itunes:duration>{_hhmmss(int(ep['seconds']))}</itunes:duration>"  # type: ignore[call-overload]
            "<itunes:explicit>false</itunes:explicit></item>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">'
        "<channel><title>My HearMeOut Library</title>"
        f"<link>{escape(site)}</link><language>en</language>"
        "<description>Your documents, narrated. Private feed - do not share this link.</description>"
        "<itunes:author>HearMeOut</itunes:author><itunes:explicit>false</itunes:explicit>"
        "<itunes:block>Yes</itunes:block>"
        f"{''.join(items)}</channel></rss>"
    )
    return Response(xml, media_type="application/rss+xml; charset=utf-8", headers={"Cache-Control": "private, max-age=300"})


async def _stream_parts(storage: AudioStorage, parts: list[tuple[str, int]], start: int, end: int) -> AsyncIterator[bytes]:
    offset = 0
    for key, size in parts:
        seg_start, seg_end = offset, offset + size - 1
        offset += size
        if seg_end < start:
            continue
        if seg_start > end:
            break
        try:
            data = await storage.get(key)
        except StorageError:
            return
        yield data[max(start - seg_start, 0) : min(end, seg_end) - seg_start + 1]


@router.get("/v1/feed/{token}/{doc_id}/{section}.mp3")
async def episode(
    token: str, doc_id: str, section: int, state: State, request: Request, range_header: str | None = Header(default=None, alias="range")
) -> Response:
    user = await _feed_user(state, token)
    doc = await state.repo.get_document(doc_id)
    if doc is None or doc["owner_key"] != f"user:{user['id']}":
        raise ApiError(404, "not_found", "That episode does not exist.")
    part = _section_chunks(await state.repo.get_chunks(doc_id), section)
    if not part or any(c["status"] != "ready" for c in part):
        raise ApiError(409, "not_ready", "This episode is still being prepared.")
    parts = [(c["audio_key"], int(c["bytes"] or 0)) for c in part]
    total = sum(size for _, size in parts)
    start, end, status = 0, total - 1, 200
    if range_header:
        m = _RANGE_RE.fullmatch(range_header.strip())
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else total - 1
            else:
                start = max(total - int(m.group(2)), 0)
            end = min(end, total - 1)
            if start > end:
                return Response(status_code=416, headers={"Content-Range": f"bytes */{total}"})
            status = 206
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
        "Cache-Control": "private, max-age=3600",
    }
    if status == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{total}"
    return StreamingResponse(
        _stream_parts(state.storage, parts, start, end), status_code=status, media_type="audio/mpeg", headers=headers
    )
