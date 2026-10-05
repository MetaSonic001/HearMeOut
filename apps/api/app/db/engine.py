"""Async SQLAlchemy engine factory for Postgres (Supabase pooler) and SQLite."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool


def make_engine(url: str) -> AsyncEngine:
    if url.startswith("sqlite"):
        return create_async_engine(url, poolclass=NullPool)
    if url.startswith("postgresql"):
        # Supabase's transaction pooler (pgbouncer) does not support prepared statements.
        return create_async_engine(
            url,
            pool_size=5,
            max_overflow=5,
            pool_pre_ping=True,
            pool_recycle=240,
            connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
        )
    raise ValueError(f"Unsupported DATABASE_URL scheme: {url.split(':', 1)[0]}")
