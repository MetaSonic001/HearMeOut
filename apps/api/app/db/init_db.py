"""Create tables (idempotent) and lock them down with RLS on Postgres.

Usage:  python -m app.db.init_db
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import get_settings
from app.db.engine import make_engine
from app.db.schema import ALL_TABLES, metadata

log = logging.getLogger(__name__)


def _add_missing_columns(sync_conn: Connection) -> list[str]:
    """Add columns introduced after a table was first created (a tiny, safe migration)."""
    added: list[str] = []
    inspector = inspect(sync_conn)
    for table in metadata.sorted_tables:
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column.type.compile(dialect=sync_conn.dialect)}'
            default = column.server_default
            if default is not None:
                raw = getattr(default.arg, "text", default.arg)
                ddl += f" DEFAULT '{raw}'" if isinstance(raw, str) else f" DEFAULT {raw}"
            if not column.nullable and default is not None:
                ddl += " NOT NULL"
            sync_conn.execute(text(ddl))
            added.append(f"{table.name}.{column.name}")
    return added


async def init_db(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)
        added = await conn.run_sync(_add_missing_columns)
        if added:
            log.info("Database upgraded: added %s", ", ".join(added))
        if engine.dialect.name == "postgresql":
            for table in ALL_TABLES:
                await conn.execute(text(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY'))


async def main() -> None:
    settings = get_settings()
    engine = make_engine(settings.database_url)
    try:
        await init_db(engine)
        print(f"Database ready ({engine.dialect.name}): {', '.join(ALL_TABLES)}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
