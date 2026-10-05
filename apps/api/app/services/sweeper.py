"""Periodic cleanup: expired documents/drafts, orphaned audio, stale counters and events."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from app.db.repo import Repo
from app.db.schema import utcnow
from app.services.quota import quota_day
from app.storage.base import AudioStorage

log = logging.getLogger(__name__)


async def sweep_once(repo: Repo, storage: AudioStorage) -> dict[str, int]:
    deleted_docs = 0
    for doc_id in await repo.expired_documents():
        await repo.delete_document(doc_id)
        deleted_docs += 1
    drafts = await repo.delete_expired_drafts()
    orphans = await repo.orphan_audio_keys(older_than=utcnow() - timedelta(hours=2))
    if orphans:
        await storage.delete_many(orphans)
        await repo.delete_audio_objects(orphans)
    await repo.prune_usage(quota_day() - timedelta(days=400))
    await repo.prune_events(utcnow() - timedelta(days=400))
    return {"documents": deleted_docs, "drafts": drafts, "audio_objects": len(orphans)}


async def sweep_forever(repo: Repo, storage: AudioStorage, interval_seconds: float = 1800) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            result = await sweep_once(repo, storage)
            if any(result.values()):
                log.info("Sweep removed %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Sweep failed")
