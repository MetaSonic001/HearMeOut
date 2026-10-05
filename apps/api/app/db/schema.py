"""Database schema (single source of truth for Postgres and SQLite).

Every table has Row Level Security enabled on Postgres with no policies, so the
public Supabase API keys cannot read or write anything; only the server
connection used by this API can.
"""

from __future__ import annotations

from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

metadata = sa.MetaData()


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetimes on both Postgres and SQLite."""

    impl = sa.DateTime(timezone=True)
    cache_ok = True

    def process_bind_value(self, value: datetime | None, dialect):  # type: ignore[no-untyped-def]
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect):  # type: ignore[no-untyped-def]
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


JSONType = sa.JSON().with_variant(JSONB(), "postgresql")
BigIntPK = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def utcnow() -> datetime:
    return datetime.now(UTC)


users = sa.Table(
    "users",
    metadata,
    sa.Column("id", sa.Text, primary_key=True),  # Clerk user id
    sa.Column("email", sa.Text),
    sa.Column("plan", sa.Text, nullable=False, server_default="free"),  # free | pro
    sa.Column("plan_ends_at", UTCDateTime),
    sa.Column("dodo_customer_id", sa.Text),
    sa.Column("dodo_subscription_id", sa.Text),
    sa.Column("feed_token", sa.Text, unique=True),
    sa.Column("created_at", UTCDateTime, nullable=False, default=utcnow),
    sa.Column("last_seen_at", UTCDateTime, nullable=False, default=utcnow),
)

drafts = sa.Table(
    "drafts",
    metadata,
    sa.Column("id", sa.Text, primary_key=True),
    sa.Column("owner_key", sa.Text, nullable=False, index=True),
    sa.Column("title", sa.Text, nullable=False),
    sa.Column("source_type", sa.Text, nullable=False),
    sa.Column("source_name", sa.Text),
    sa.Column("language", sa.Text, nullable=False, server_default="en"),
    sa.Column("page_count", sa.Integer),
    sa.Column("total_chars", sa.Integer, nullable=False),
    # [{idx, title, page_start, page_end, chars, blocks: [{k, t, p, lv}]}]
    sa.Column("sections", JSONType, nullable=False),
    sa.Column("warnings", JSONType, nullable=False, default=list),
    # ready | ocr (scanned pages are being read) | failed
    sa.Column("status", sa.Text, nullable=False, server_default="ready"),
    sa.Column("progress", JSONType),  # OCR progress: {done, total, stage, script, queued}
    sa.Column("error", sa.Text),
    sa.Column("created_at", UTCDateTime, nullable=False, default=utcnow),
    sa.Column("expires_at", UTCDateTime, nullable=False, index=True),
)

documents = sa.Table(
    "documents",
    metadata,
    sa.Column("id", sa.Text, primary_key=True),
    sa.Column("owner_key", sa.Text, nullable=False),
    sa.Column("title", sa.Text, nullable=False),
    sa.Column("source_type", sa.Text, nullable=False),
    sa.Column("mode", sa.Text, nullable=False),  # read|study|revision|explain|quiz
    sa.Column("language", sa.Text, nullable=False),  # narration language code, e.g. hi-IN
    sa.Column("voice", sa.Text, nullable=False),
    sa.Column("voice2", sa.Text),
    sa.Column("status", sa.Text, nullable=False),  # processing|ready|failed
    sa.Column("error", sa.Text),
    sa.Column("source_chars", sa.Integer, nullable=False),
    sa.Column("est_seconds", sa.Integer, nullable=False),
    sa.Column("total_chunks", sa.Integer),  # null until scripting finished
    sa.Column("total_sections", sa.Integer, nullable=False, server_default="0"),
    sa.Column("scripted_sections", sa.Integer, nullable=False, server_default="0"),
    sa.Column("page_count", sa.Integer),
    sa.Column("sections", JSONType, nullable=False, default=list),  # chapter list
    sa.Column("options", JSONType, nullable=False, default=dict),
    sa.Column("ai", sa.Boolean, nullable=False, server_default=sa.false()),
    sa.Column("unlocked", sa.Boolean, nullable=False, server_default=sa.false()),
    sa.Column("progress_chunk", sa.Integer, nullable=False, server_default="0"),
    sa.Column("progress_offset", sa.Float, nullable=False, server_default="0"),
    sa.Column("created_at", UTCDateTime, nullable=False, default=utcnow),
    sa.Column("last_played_at", UTCDateTime),
    sa.Column("expires_at", UTCDateTime, nullable=False, index=True),
    sa.Index("ix_documents_owner_created", "owner_key", "created_at"),
)

doc_sources = sa.Table(
    "doc_sources",
    metadata,
    sa.Column("doc_id", sa.Text, primary_key=True),
    sa.Column("idx", sa.Integer, primary_key=True),
    sa.Column("title", sa.Text, nullable=False),
    sa.Column("page_start", sa.Integer),
    sa.Column("page_end", sa.Integer),
    sa.Column("text", sa.Text, nullable=False),
)

chunks = sa.Table(
    "chunks",
    metadata,
    sa.Column("doc_id", sa.Text, primary_key=True),
    sa.Column("idx", sa.Integer, primary_key=True),
    sa.Column("text", sa.Text, nullable=False),
    sa.Column("kind", sa.Text, nullable=False, server_default="narration"),
    sa.Column("section_idx", sa.Integer, nullable=False, server_default="0"),
    sa.Column("page_start", sa.Integer),
    sa.Column("page_end", sa.Integer),
    sa.Column("pause_ms", sa.Integer, nullable=False, server_default="0"),
    sa.Column("voice", sa.Text),  # per-chunk override (e.g. quiz answers)
    sa.Column("status", sa.Text, nullable=False, server_default="pending"),  # pending|ready
    sa.Column("audio_key", sa.Text),
    sa.Column("duration_ms", sa.Integer),
    sa.Column("bytes", sa.Integer),
    sa.Column("ready_at", UTCDateTime),
)

audio_objects = sa.Table(
    "audio_objects",
    metadata,
    sa.Column("key", sa.Text, primary_key=True),
    sa.Column("bytes", sa.Integer, nullable=False),
    sa.Column("duration_ms", sa.Integer, nullable=False),
    sa.Column("created_at", UTCDateTime, nullable=False, default=utcnow),
    sa.Column("last_used_at", UTCDateTime, nullable=False, default=utcnow),
)

usage_daily = sa.Table(
    "usage_daily",
    metadata,
    sa.Column("key", sa.Text, primary_key=True),  # user:<id> | anon:<id> | ip:<hash>
    sa.Column("day", sa.Date, primary_key=True),
    sa.Column("seconds", sa.Float, nullable=False, server_default="0"),
    sa.Column("ai_docs", sa.Integer, nullable=False, server_default="0"),
)

purchases = sa.Table(
    "purchases",
    metadata,
    sa.Column("id", sa.Text, primary_key=True),  # Dodo payment id (idempotency)
    sa.Column("user_id", sa.Text, index=True),
    sa.Column("doc_id", sa.Text),
    sa.Column("kind", sa.Text, nullable=False),  # book | pro_monthly | pro_yearly
    sa.Column("amount", sa.Integer),
    sa.Column("currency", sa.Text),
    sa.Column("status", sa.Text, nullable=False),
    sa.Column("created_at", UTCDateTime, nullable=False, default=utcnow),
)

webhook_events = sa.Table(
    "webhook_events",
    metadata,
    sa.Column("id", sa.Text, primary_key=True),
    sa.Column("type", sa.Text, nullable=False),
    sa.Column("received_at", UTCDateTime, nullable=False, default=utcnow),
)

events = sa.Table(
    "events",
    metadata,
    sa.Column("id", BigIntPK, primary_key=True, autoincrement=True),
    sa.Column("ts", UTCDateTime, nullable=False, default=utcnow, index=True),
    sa.Column("name", sa.Text, nullable=False),
    sa.Column("anon_id", sa.Text),
    sa.Column("user_id", sa.Text),
    sa.Column("path", sa.Text),
    sa.Column("referrer", sa.Text),
    sa.Column("country", sa.Text),
    sa.Column("device", sa.Text),
    sa.Column("meta", JSONType, nullable=False, default=dict),
    sa.Index("ix_events_name_ts", "name", "ts"),
)

ALL_TABLES = [t.name for t in metadata.sorted_tables]
