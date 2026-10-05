"""Plans and limits: the single source of truth for what each tier may do."""

from __future__ import annotations

from dataclasses import dataclass

ALL_MODES = frozenset({"read", "translate", "study", "revision", "explain", "quiz"})
AI_MODES = frozenset({"translate", "study", "revision", "explain", "quiz"})
UNLIMITED = 10**9


@dataclass(frozen=True, slots=True)
class Plan:
    name: str
    label: str
    daily_seconds: int  # newly-prepared audio per day
    max_chars: int  # per document
    max_file_mb: int
    ai_docs_per_day: int
    ttl_days: float  # how long documents are kept
    can_download: bool
    has_feed: bool
    max_ocr_pages: int = 0  # scanned pages we will read with OCR per document

    def as_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "label": self.label,
            "daily_minutes": None if self.daily_seconds >= UNLIMITED else self.daily_seconds // 60,
            "max_chars": self.max_chars,
            "max_file_mb": self.max_file_mb,
            "ai_docs_per_day": None if self.ai_docs_per_day >= UNLIMITED else self.ai_docs_per_day,
            "ttl_days": self.ttl_days,
            "can_download": self.can_download,
            "has_feed": self.has_feed,
            "max_ocr_pages": self.max_ocr_pages,
        }


PLANS: dict[str, Plan] = {
    "anon": Plan("anon", "Guest", 20 * 60, 150_000, 10, 1, 1, False, False, 15),
    "free": Plan("free", "Free", 60 * 60, 600_000, 25, 3, 7, True, False, 60),
    "pro": Plan("pro", "Pro", 20 * 3600, 3_000_000, 50, 60, 90, True, True, 500),
    "admin": Plan("admin", "Owner", UNLIMITED, 6_000_000, 100, UNLIMITED, 365, True, True, 3000),
}

# A per-book unlock lifts the daily cap for that one document and keeps it for 90 days.
BOOK_TTL_DAYS = 90
# Secondary abuse guard for guests: total guest audio per client IP per day (shared Wi-Fi friendly).
IP_DAILY_SECONDS = 3 * 3600
# Quota days roll over at midnight India time, where most users are.
QUOTA_TZ_OFFSET_MINUTES = 330


def get_plan(name: str) -> Plan:
    return PLANS.get(name, PLANS["free"])
