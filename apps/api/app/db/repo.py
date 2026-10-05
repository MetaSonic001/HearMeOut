"""Repository: every SQL statement in the app lives here (SQLAlchemy Core, async)."""

from __future__ import annotations

import secrets
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.db import schema as t
from app.db.schema import utcnow

Row = dict[str, Any]


def _insert(engine: AsyncEngine, table: sa.Table):  # type: ignore[no-untyped-def]
    return (postgresql if engine.dialect.name == "postgresql" else sqlite).insert(table)


def _row(result: sa.engine.Result[Any]) -> Row | None:
    r = result.first()
    return dict(r._mapping) if r is not None else None


def _rows(result: sa.engine.Result[Any]) -> list[Row]:
    return [dict(r._mapping) for r in result]


class Repo:
    def __init__(self, engine: AsyncEngine):
        self.engine = engine

    # ------------------------------------------------------------------ users
    async def upsert_user(self, user_id: str, email: str | None = None) -> Row:
        async with self.engine.begin() as conn:
            stmt = _insert(self.engine, t.users).values(
                id=user_id, email=email, plan="free", created_at=utcnow(), last_seen_at=utcnow()
            )
            update = {"last_seen_at": utcnow()}
            if email:
                update["email"] = email
            stmt = stmt.on_conflict_do_update(index_elements=[t.users.c.id], set_=update)
            await conn.execute(stmt)
            row = _row(await conn.execute(sa.select(t.users).where(t.users.c.id == user_id)))
        assert row is not None
        return row

    async def upsert_user_seen(self, user_id: str, email: str | None = None) -> tuple[Row, bool]:
        """Return (user row, created). Creates on first sight; touches last_seen at most every 10 minutes."""
        row = await self.get_user(user_id)
        if row is None:
            return await self.upsert_user(user_id, email), True
        stale = (utcnow() - row["last_seen_at"]).total_seconds() > 600
        if stale or (email and row.get("email") != email):
            return await self.upsert_user(user_id, email), False
        return row, False

    async def get_user(self, user_id: str) -> Row | None:
        async with self.engine.connect() as conn:
            return _row(await conn.execute(sa.select(t.users).where(t.users.c.id == user_id)))

    async def update_user(self, user_id: str, **fields: Any) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.update(t.users).where(t.users.c.id == user_id).values(**fields))

    async def ensure_feed_token(self, user_id: str) -> str:
        user = await self.get_user(user_id)
        if user and user.get("feed_token"):
            return str(user["feed_token"])
        token = secrets.token_urlsafe(24)
        await self.update_user(user_id, feed_token=token)
        return token

    async def user_by_feed_token(self, token: str) -> Row | None:
        async with self.engine.connect() as conn:
            return _row(await conn.execute(sa.select(t.users).where(t.users.c.feed_token == token)))

    async def user_by_subscription(self, subscription_id: str) -> Row | None:
        async with self.engine.connect() as conn:
            return _row(
                await conn.execute(
                    sa.select(t.users).where(t.users.c.dodo_subscription_id == subscription_id)
                )
            )

    # ----------------------------------------------------------------- drafts
    async def create_draft(self, values: Row) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.insert(t.drafts).values(**values))

    async def get_draft(self, draft_id: str) -> Row | None:
        async with self.engine.connect() as conn:
            return _row(await conn.execute(sa.select(t.drafts).where(t.drafts.c.id == draft_id)))

    async def update_draft(self, draft_id: str, **fields: Any) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.update(t.drafts).where(t.drafts.c.id == draft_id).values(**fields))

    async def delete_draft(self, draft_id: str) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.delete(t.drafts).where(t.drafts.c.id == draft_id))

    # -------------------------------------------------------------- documents
    async def create_document(
        self, doc: Row, sources: Sequence[Row] = (), chunks: Sequence[Row] = ()
    ) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.insert(t.documents).values(**doc))
            if sources:
                await conn.execute(sa.insert(t.doc_sources), [dict(s, doc_id=doc["id"]) for s in sources])
            await self._insert_chunks(conn, doc["id"], chunks)

    async def _insert_chunks(self, conn: AsyncConnection, doc_id: str, chunks: Sequence[Row]) -> None:
        for start in range(0, len(chunks), 500):
            batch = chunks[start : start + 500]
            await conn.execute(sa.insert(t.chunks), [dict(c, doc_id=doc_id) for c in batch])

    async def add_chunks(self, doc_id: str, chunks: Sequence[Row], **doc_fields: Any) -> None:
        """Append chunks (AI scripting) and optionally update document fields atomically."""
        async with self.engine.begin() as conn:
            if chunks:
                await self._insert_chunks(conn, doc_id, chunks)
            if doc_fields:
                await conn.execute(
                    sa.update(t.documents).where(t.documents.c.id == doc_id).values(**doc_fields)
                )

    async def get_document(self, doc_id: str) -> Row | None:
        async with self.engine.connect() as conn:
            return _row(await conn.execute(sa.select(t.documents).where(t.documents.c.id == doc_id)))

    async def list_documents(self, owner_key: str, limit: int = 100) -> list[Row]:
        async with self.engine.connect() as conn:
            q = (
                sa.select(t.documents)
                .where(t.documents.c.owner_key == owner_key, t.documents.c.expires_at > utcnow())
                .order_by(t.documents.c.created_at.desc())
                .limit(limit)
            )
            return _rows(await conn.execute(q))

    async def update_document(self, doc_id: str, **fields: Any) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.update(t.documents).where(t.documents.c.id == doc_id).values(**fields))

    async def delete_document(self, doc_id: str) -> None:
        async with self.engine.begin() as conn:
            for table in (t.chunks, t.doc_sources):
                await conn.execute(sa.delete(table).where(table.c.doc_id == doc_id))
            await conn.execute(sa.delete(t.documents).where(t.documents.c.id == doc_id))

    async def get_sources(self, doc_id: str, start: int = 0) -> list[Row]:
        async with self.engine.connect() as conn:
            q = (
                sa.select(t.doc_sources)
                .where(t.doc_sources.c.doc_id == doc_id, t.doc_sources.c.idx >= start)
                .order_by(t.doc_sources.c.idx)
            )
            return _rows(await conn.execute(q))

    async def claim_owner(self, from_key: str, to_key: str) -> int:
        async with self.engine.begin() as conn:
            res = await conn.execute(
                sa.update(t.documents).where(t.documents.c.owner_key == from_key).values(owner_key=to_key)
            )
            return res.rowcount or 0

    async def unfinished_documents(self) -> list[Row]:
        async with self.engine.connect() as conn:
            q = sa.select(t.documents).where(
                t.documents.c.status == "processing", t.documents.c.expires_at > utcnow()
            )
            return _rows(await conn.execute(q))

    # ----------------------------------------------------------------- chunks
    async def get_chunks(self, doc_id: str, start: int = 0, end: int | None = None) -> list[Row]:
        async with self.engine.connect() as conn:
            q = sa.select(t.chunks).where(t.chunks.c.doc_id == doc_id, t.chunks.c.idx >= start)
            if end is not None:
                q = q.where(t.chunks.c.idx < end)
            return _rows(await conn.execute(q.order_by(t.chunks.c.idx)))

    async def get_chunk(self, doc_id: str, idx: int) -> Row | None:
        async with self.engine.connect() as conn:
            q = sa.select(t.chunks).where(t.chunks.c.doc_id == doc_id, t.chunks.c.idx == idx)
            return _row(await conn.execute(q))

    async def count_chunks(self, doc_id: str) -> int:
        async with self.engine.connect() as conn:
            q = sa.select(sa.func.count()).select_from(t.chunks).where(t.chunks.c.doc_id == doc_id)
            return int((await conn.execute(q)).scalar_one())

    async def mark_chunk_ready(
        self, doc_id: str, idx: int, audio_key: str, duration_ms: int, size: int
    ) -> bool:
        """Mark ready. True only for the call that flipped pending -> ready (charge once)."""
        async with self.engine.begin() as conn:
            res = await conn.execute(
                sa.update(t.chunks)
                .where(t.chunks.c.doc_id == doc_id, t.chunks.c.idx == idx, t.chunks.c.status == "pending")
                .values(status="ready", audio_key=audio_key, duration_ms=duration_ms, bytes=size, ready_at=utcnow())
            )
            return bool(res.rowcount)

    async def update_chunk_audio(self, doc_id: str, idx: int, audio_key: str, duration_ms: int, size: int) -> None:
        """Repoint an already-ready chunk at regenerated audio (its object had gone missing)."""
        async with self.engine.begin() as conn:
            await conn.execute(
                sa.update(t.chunks)
                .where(t.chunks.c.doc_id == doc_id, t.chunks.c.idx == idx)
                .values(audio_key=audio_key, duration_ms=duration_ms, bytes=size)
            )

    async def ready_chunk_count(self, doc_id: str) -> int:
        async with self.engine.connect() as conn:
            q = (
                sa.select(sa.func.count())
                .select_from(t.chunks)
                .where(t.chunks.c.doc_id == doc_id, t.chunks.c.status == "ready")
            )
            return int((await conn.execute(q)).scalar_one())

    # ---------------------------------------------------------- audio objects
    async def get_audio_object(self, key: str) -> Row | None:
        async with self.engine.connect() as conn:
            return _row(await conn.execute(sa.select(t.audio_objects).where(t.audio_objects.c.key == key)))

    async def put_audio_object(self, key: str, size: int, duration_ms: int) -> None:
        async with self.engine.begin() as conn:
            stmt = _insert(self.engine, t.audio_objects).values(
                key=key, bytes=size, duration_ms=duration_ms, created_at=utcnow(), last_used_at=utcnow()
            )
            await conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=[t.audio_objects.c.key], set_={"last_used_at": utcnow()}
                )
            )

    async def orphan_audio_keys(self, older_than: datetime, limit: int = 500) -> list[str]:
        """Audio objects not referenced by any chunk and not touched recently."""
        async with self.engine.connect() as conn:
            referenced = sa.select(t.chunks.c.audio_key).where(t.chunks.c.audio_key.is_not(None))
            q = (
                sa.select(t.audio_objects.c.key)
                .where(t.audio_objects.c.last_used_at < older_than, t.audio_objects.c.key.not_in(referenced))
                .limit(limit)
            )
            return [r[0] for r in await conn.execute(q)]

    async def delete_audio_objects(self, keys: Sequence[str]) -> None:
        if not keys:
            return
        async with self.engine.begin() as conn:
            await conn.execute(sa.delete(t.audio_objects).where(t.audio_objects.c.key.in_(list(keys))))

    # ------------------------------------------------------------------ usage
    async def get_usage(self, keys: Sequence[str], day: date) -> dict[str, Row]:
        async with self.engine.connect() as conn:
            q = sa.select(t.usage_daily).where(t.usage_daily.c.key.in_(list(keys)), t.usage_daily.c.day == day)
            return {r["key"]: r for r in _rows(await conn.execute(q))}

    async def add_usage(self, keys: Sequence[str], day: date, *, seconds: float = 0, ai_docs: int = 0) -> None:
        async with self.engine.begin() as conn:
            for key in keys:
                stmt = _insert(self.engine, t.usage_daily).values(
                    key=key, day=day, seconds=seconds, ai_docs=ai_docs
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=[t.usage_daily.c.key, t.usage_daily.c.day],
                    set_={
                        "seconds": t.usage_daily.c.seconds + seconds,
                        "ai_docs": t.usage_daily.c.ai_docs + ai_docs,
                    },
                )
                await conn.execute(stmt)

    # -------------------------------------------------------------- purchases
    async def record_purchase(self, values: Row) -> bool:
        """Insert a purchase; False if it already exists (webhook retry)."""
        async with self.engine.begin() as conn:
            stmt = _insert(self.engine, t.purchases).values(**values).on_conflict_do_nothing(
                index_elements=[t.purchases.c.id]
            )
            res = await conn.execute(stmt)
            return bool(res.rowcount)

    async def mark_webhook_seen(self, event_id: str, event_type: str) -> bool:
        """True the first time an event id is seen."""
        async with self.engine.begin() as conn:
            stmt = _insert(self.engine, t.webhook_events).values(
                id=event_id, type=event_type, received_at=utcnow()
            ).on_conflict_do_nothing(index_elements=[t.webhook_events.c.id])
            res = await conn.execute(stmt)
            return bool(res.rowcount)

    async def unlock_document(self, doc_id: str, owner_key: str) -> bool:
        async with self.engine.begin() as conn:
            res = await conn.execute(
                sa.update(t.documents)
                .where(t.documents.c.id == doc_id, t.documents.c.owner_key == owner_key)
                .values(unlocked=True, expires_at=utcnow() + timedelta(days=90))
            )
            return bool(res.rowcount)

    # ----------------------------------------------------------------- events
    async def insert_event(self, values: Row) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.insert(t.events).values(**values))

    # ---------------------------------------------------------------- sweeper
    async def expired_documents(self, limit: int = 200) -> list[str]:
        async with self.engine.connect() as conn:
            q = sa.select(t.documents.c.id).where(t.documents.c.expires_at < utcnow()).limit(limit)
            return [r[0] for r in await conn.execute(q)]

    async def delete_expired_drafts(self) -> int:
        async with self.engine.begin() as conn:
            res = await conn.execute(sa.delete(t.drafts).where(t.drafts.c.expires_at < utcnow()))
            return res.rowcount or 0

    async def prune_usage(self, before: date) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.delete(t.usage_daily).where(t.usage_daily.c.day < before))

    async def prune_events(self, before: datetime) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(sa.delete(t.events).where(t.events.c.ts < before))
