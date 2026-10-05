"""Daily audio allowance accounting (seconds of newly prepared audio per identity)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.db.repo import Repo
from app.services.identity import Identity
from app.services.plans import IP_DAILY_SECONDS, QUOTA_TZ_OFFSET_MINUTES, UNLIMITED


def quota_day(now: datetime | None = None) -> date:
    now = now or datetime.now(UTC)
    return (now + timedelta(minutes=QUOTA_TZ_OFFSET_MINUTES)).date()


def next_reset(now: datetime | None = None) -> datetime:
    now = now or datetime.now(UTC)
    local = now + timedelta(minutes=QUOTA_TZ_OFFSET_MINUTES)
    tomorrow = datetime.combine(local.date() + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
    return tomorrow - timedelta(minutes=QUOTA_TZ_OFFSET_MINUTES)


@dataclass(frozen=True, slots=True)
class Allowance:
    used_seconds: float
    limit_seconds: int
    ai_used: int
    ai_limit: int
    resets_at: datetime

    @property
    def remaining_seconds(self) -> float:
        return max(0.0, self.limit_seconds - self.used_seconds)

    @property
    def unlimited(self) -> bool:
        return self.limit_seconds >= UNLIMITED

    @property
    def ai_remaining(self) -> int:
        return max(0, self.ai_limit - self.ai_used)

    def as_dict(self) -> dict[str, object]:
        return {
            "used_minutes": round(self.used_seconds / 60, 1),
            "limit_minutes": None if self.unlimited else self.limit_seconds // 60,
            "remaining_minutes": None if self.unlimited else round(self.remaining_seconds / 60, 1),
            "ai_docs_used": self.ai_used,
            "ai_docs_limit": None if self.ai_limit >= UNLIMITED else self.ai_limit,
            "resets_at": self.resets_at.isoformat(),
        }


class Quota:
    def __init__(self, repo: Repo):
        self.repo = repo

    async def allowance(self, identity: Identity) -> Allowance:
        plan = identity.plan
        usage = await self.repo.get_usage(identity.usage_keys, quota_day())
        own = usage.get(identity.usage_keys[0], {})
        used = float(own.get("seconds", 0.0))
        limit = plan.daily_seconds
        # Guests are also bounded by a per-IP ceiling so clearing browser storage is not a loophole.
        if identity.kind == "anon" and len(identity.usage_keys) > 1:
            ip_used = float(usage.get(identity.usage_keys[1], {}).get("seconds", 0.0))
            ip_remaining = max(0.0, IP_DAILY_SECONDS - ip_used)
            if ip_remaining < max(0.0, limit - used):
                used = limit - ip_remaining
        return Allowance(
            used_seconds=used,
            limit_seconds=limit,
            ai_used=int(own.get("ai_docs", 0)),
            ai_limit=plan.ai_docs_per_day,
            resets_at=next_reset(),
        )

    async def charge_seconds(self, identity: Identity, seconds: float) -> None:
        if identity.is_admin or seconds <= 0:
            return
        await self.repo.add_usage(identity.usage_keys, quota_day(), seconds=seconds)

    async def charge_ai_doc(self, identity: Identity) -> None:
        if identity.is_admin:
            return
        await self.repo.add_usage(identity.usage_keys[:1], quota_day(), ai_docs=1)
