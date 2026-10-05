"""Who is calling: a signed-in user, an anonymous guest, or the owner (admin)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from app.services.plans import PLANS, Plan


@dataclass(frozen=True, slots=True)
class Identity:
    kind: Literal["anon", "user"]
    owner_key: str  # user:<clerk id> | anon:<id>
    plan_name: str  # anon | free | pro | admin
    ip_hash: str = ""
    user_id: str | None = None
    anon_id: str | None = None
    email: str | None = None
    name: str | None = None
    alt_owner_key: str | None = None  # a signed-in user's earlier guest identity (until claimed)

    def owns(self, owner_key: str) -> bool:
        return owner_key == self.owner_key or (self.alt_owner_key is not None and owner_key == self.alt_owner_key)

    @property
    def plan(self) -> Plan:
        return PLANS[self.plan_name]

    @property
    def is_admin(self) -> bool:
        return self.plan_name == "admin"

    @property
    def is_pro(self) -> bool:
        return self.plan_name in {"pro", "admin"}

    @property
    def usage_keys(self) -> list[str]:
        """First key is the identity's own counter; guests add a per-IP counter."""
        if self.kind == "user":
            return [f"user:{self.user_id}"]
        keys = [f"anon:{self.anon_id}"]
        if self.ip_hash:
            keys.append(f"ip:{self.ip_hash}")
        return keys


def effective_plan(user_row: dict[str, object] | None, is_admin: bool) -> str:
    if is_admin:
        return "admin"
    if user_row and user_row.get("plan") == "pro":
        ends = user_row.get("plan_ends_at")
        if ends is None or (isinstance(ends, datetime) and ends > datetime.now(UTC)):
            return "pro"
    return "free"
