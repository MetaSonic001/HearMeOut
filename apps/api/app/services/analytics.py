"""First-party, cookieless product analytics (anonymous ids only, no IPs stored)."""

from __future__ import annotations

import logging
import re
from typing import Any

from app.db.repo import Repo
from app.db.schema import utcnow
from app.services.identity import Identity

log = logging.getLogger(__name__)
_MOBILE_RE = re.compile(r"Mobi|Android|iPhone|iPad|iPod", re.IGNORECASE)
_BOT_RE = re.compile(r"bot|crawler|spider|crawling|headless|lighthouse|preview", re.IGNORECASE)


def device_from_ua(user_agent: str | None) -> str:
    if not user_agent:
        return "unknown"
    if _BOT_RE.search(user_agent):
        return "bot"
    return "mobile" if _MOBILE_RE.search(user_agent) else "desktop"


async def track(
    repo: Repo,
    name: str,
    identity: Identity | None = None,
    *,
    path: str | None = None,
    referrer: str | None = None,
    country: str | None = None,
    device: str | None = None,
    anon_id: str | None = None,
    user_id: str | None = None,
    **meta: Any,
) -> None:
    """Record an event; analytics must never break a request."""
    try:
        await repo.insert_event(
            {
                "ts": utcnow(),
                "name": name,
                "anon_id": anon_id or (identity.anon_id if identity else None) or (identity.user_id if identity else None),
                "user_id": user_id or (identity.user_id if identity else None),
                "path": path,
                "referrer": referrer,
                "country": country,
                "device": device,
                "meta": {k: v for k, v in meta.items() if v is not None},
            }
        )
    except Exception:
        log.exception("Could not record event %s", name)
