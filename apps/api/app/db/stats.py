"""Aggregate queries for the admin dashboard (portable across Postgres and SQLite)."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, date, datetime, timedelta
from typing import Any
from urllib.parse import urlparse

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db import schema as t
from app.services.quota import quota_day


def _day(value: Any) -> str:
    return value.isoformat() if isinstance(value, date) else str(value)[:10]


def _top(counter: Counter[str], limit: int = 8) -> list[dict[str, Any]]:
    return [{"label": k, "count": v} for k, v in counter.most_common(limit)]


def referrer_host(value: str | None, own_host: str | None = None) -> str:
    if not value:
        return "Direct"
    host = (urlparse(value).hostname or value).removeprefix("www.")
    if own_host and host == own_host.removeprefix("www."):
        return "Direct"
    return host or "Direct"


async def compute_stats(engine: AsyncEngine, days: int = 30, own_host: str | None = None) -> dict[str, Any]:
    days = max(1, min(days, 365))
    now = datetime.now(UTC)
    # Usage is booked on the IST day, which runs ahead of UTC for 5.5 hours a day: end the window on whichever is later.
    end_day = max(now.date(), quota_day(now))
    since = datetime.combine(end_day - timedelta(days=days - 1), datetime.min.time(), tzinfo=UTC)
    ev = t.events
    day_expr = sa.func.date(ev.c.ts)

    async with engine.connect() as conn:
        daily: dict[str, dict[str, Any]] = {}
        for i in range(days):
            d = (since + timedelta(days=i)).date().isoformat()
            daily[d] = {"date": d, "visitors": 0, "pageviews": 0, "docs": 0, "signups": 0, "minutes": 0.0, "revenue": 0}

        q = (
            sa.select(day_expr.label("d"), sa.func.count(sa.distinct(ev.c.anon_id)), sa.func.count())
            .where(ev.c.name == "page_view", ev.c.ts >= since)
            .group_by(day_expr)
        )
        for d, visitors, views in await conn.execute(q):
            if _day(d) in daily:
                daily[_day(d)].update(visitors=visitors, pageviews=views)

        for name, key in (("doc_created", "docs"), ("signup", "signups")):
            q = sa.select(day_expr.label("d"), sa.func.count()).where(ev.c.name == name, ev.c.ts >= since).group_by(day_expr)
            for d, count in await conn.execute(q):
                if _day(d) in daily:
                    daily[_day(d)][key] = count

        u = t.usage_daily
        q = (
            sa.select(u.c.day, sa.func.sum(u.c.seconds))
            .where(u.c.day >= since.date(), u.c.key.like("user:%") | u.c.key.like("anon:%"))
            .group_by(u.c.day)
        )
        for d, secs in await conn.execute(q):
            if _day(d) in daily:
                daily[_day(d)]["minutes"] = round(float(secs or 0) / 60, 1)

        p = t.purchases
        revenue: Counter[str] = Counter()
        q = sa.select(sa.func.date(p.c.created_at), p.c.currency, sa.func.sum(p.c.amount)).where(
            p.c.created_at >= since, p.c.status == "succeeded"
        ).group_by(sa.func.date(p.c.created_at), p.c.currency)
        for d, currency, amount in await conn.execute(q):
            revenue[currency or "?"] += int(amount or 0)
            if _day(d) in daily and (currency or "INR") in {"INR", "USD"}:
                daily[_day(d)]["revenue"] += int(amount or 0)

        def distinct_visitors() -> sa.Select[Any]:
            return sa.select(sa.func.count(sa.distinct(ev.c.anon_id))).where(ev.c.name == "page_view", ev.c.ts >= since)

        visitors = int((await conn.execute(distinct_visitors())).scalar_one())
        pageviews = int(
            (await conn.execute(sa.select(sa.func.count()).where(ev.c.name == "page_view", ev.c.ts >= since))).scalar_one()
        )

        async def count_event(name: str, distinct_col: Any = None) -> int:
            col = sa.func.count(sa.distinct(distinct_col)) if distinct_col is not None else sa.func.count()
            return int((await conn.execute(sa.select(col).where(ev.c.name == name, ev.c.ts >= since))).scalar_one())

        funnel = {
            "visitors": visitors,
            "drafts": await count_event("draft_created"),
            "docs": await count_event("doc_created"),
            "plays": await count_event("play_started", ev.c.anon_id),
            "signups": await count_event("signup"),
            "purchases": int(
                (await conn.execute(sa.select(sa.func.count()).where(p.c.created_at >= since, p.c.status == "succeeded"))).scalar_one()
            ),
        }

        async def top_column(col: Any, name: str = "page_view") -> list[tuple[Any, int]]:
            q = (
                sa.select(col, sa.func.count().label("c"))
                .where(ev.c.name == name, ev.c.ts >= since)
                .group_by(col)
                .order_by(sa.desc("c"))
                .limit(40)
            )
            return [(r[0], int(r[1])) for r in await conn.execute(q)]

        referrers: Counter[str] = Counter()
        for value, count in await top_column(ev.c.referrer):
            referrers[referrer_host(value, own_host)] += count
        pages = Counter({(path or "/"): count for path, count in await top_column(ev.c.path)})
        countries = Counter({(c or "Unknown"): n for c, n in await top_column(ev.c.country)})
        devices = Counter({(d or "Unknown"): n for d, n in await top_column(ev.c.device)})

        modes: Counter[str] = Counter()
        languages: Counter[str] = Counter()
        sources: Counter[str] = Counter()
        q = sa.select(ev.c.meta).where(ev.c.name == "doc_created", ev.c.ts >= since)
        for (meta,) in await conn.execute(q):
            meta = meta or {}
            modes[str(meta.get("mode", "?"))] += 1
            languages[str(meta.get("language", "?"))] += 1
            sources[str(meta.get("source_type", "?"))] += 1

        users_total = int((await conn.execute(sa.select(sa.func.count()).select_from(t.users))).scalar_one())
        pro_users = int(
            (await conn.execute(sa.select(sa.func.count()).select_from(t.users).where(t.users.c.plan == "pro", t.users.c.plan_ends_at > now))).scalar_one()
        )
        live_docs = int(
            (await conn.execute(sa.select(sa.func.count()).select_from(t.documents).where(t.documents.c.expires_at > now))).scalar_one()
        )

    series = list(daily.values())
    return {
        "range_days": days,
        "totals": {
            "visitors": visitors,
            "pageviews": pageviews,
            "docs_created": sum(d["docs"] for d in series),
            "signups": sum(d["signups"] for d in series),
            "minutes_listened": round(sum(d["minutes"] for d in series), 1),
            "revenue": dict(revenue),
            "users": users_total,
            "pro_users": pro_users,
            "live_documents": live_docs,
        },
        "daily": series,
        "funnel": funnel,
        "top": {
            "pages": _top(pages),
            "referrers": _top(referrers),
            "countries": _top(countries),
            "devices": _top(devices),
            "modes": _top(modes),
            "languages": _top(languages),
            "sources": _top(sources),
        },
        "generated_at": now.isoformat(),
    }
