import sqlalchemy as sa

from app.db.engine import make_engine
from app.db.init_db import init_db

OLD_DRAFTS = """
CREATE TABLE drafts (
    id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, title TEXT NOT NULL, source_type TEXT NOT NULL,
    source_name TEXT, language TEXT NOT NULL DEFAULT 'en', page_count INTEGER, total_chars INTEGER NOT NULL,
    sections JSON NOT NULL, warnings JSON NOT NULL, created_at DATETIME NOT NULL, expires_at DATETIME NOT NULL
)
"""


async def test_init_db_adds_new_columns_to_an_existing_table_without_losing_rows(tmp_path):
    engine = make_engine(f"sqlite+aiosqlite:///{tmp_path}/old.db")
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text(OLD_DRAFTS))
            await conn.execute(
                sa.text(
                    "INSERT INTO drafts (id, owner_key, title, source_type, total_chars, sections, warnings, created_at, expires_at) "
                    "VALUES ('drf_old', 'anon:x', 'Old draft', 'text', 10, '[]', '[]', '2026-01-01', '2026-01-02')"
                )
            )
        await init_db(engine)
        await init_db(engine)  # running it again changes nothing
        async with engine.connect() as conn:
            row = (await conn.execute(sa.text("SELECT id, status, progress, error FROM drafts"))).one()
        assert row.id == "drf_old" and row.status == "ready" and row.progress is None and row.error is None
    finally:
        await engine.dispose()
