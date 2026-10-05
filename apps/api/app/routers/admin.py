"""Owner-only analytics + internal event ingestion."""

from __future__ import annotations

import hmac
from typing import Annotated, Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header

from app.db.stats import compute_stats
from app.deps import AdminIdentity, State, rate_limit
from app.errors import ApiError
from app.schemas import EventIn
from app.services.analytics import track

router = APIRouter(tags=["admin"])

ALLOWED_EVENTS = {"page_view", "play_started", "play_finished", "limit_hit", "cta_click", "share", "upload_started"}


@router.get("/v1/admin/stats")
async def stats(_: AdminIdentity, state: State, days: int = 30) -> dict[str, Any]:
    host = urlparse(state.settings.site_url).hostname
    return await compute_stats(state.engine, days, own_host=host)


@router.post("/v1/events", status_code=202, dependencies=[Depends(rate_limit("events", 600, 60))])
async def ingest_event(
    body: EventIn,
    state: State,
    x_internal_secret: Annotated[str, Header()] = "",
    x_country: Annotated[str | None, Header()] = None,
    x_device: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header()] = None,
) -> dict[str, bool]:
    expected = state.settings.internal_api_secret
    if not expected or not hmac.compare_digest(x_internal_secret.encode(), expected.encode()):
        raise ApiError(403, "forbidden", "Not allowed.")
    if body.name not in ALLOWED_EVENTS:
        raise ApiError(422, "unknown_event", "Unknown event name.")
    if x_device == "bot":
        return {"recorded": False}
    await track(
        state.repo,
        body.name,
        path=body.path,
        referrer=body.referrer,
        country=(x_country or "")[:2].upper() or None,
        device=x_device,
        anon_id=body.anon_id,
        user_id=x_user_id,
        **body.meta,
    )
    return {"recorded": True}
