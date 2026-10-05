"""Tiny in-process sliding-window rate limiter (per instance; fine for a free-tier start)."""

from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_seconds: float) -> float:
        """Record a hit. Returns 0 if allowed, else seconds until the next slot."""
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return window_seconds - (now - hits[0])
        hits.append(now)
        if len(self._hits) > 20000:  # bound memory under attack
            for k in [k for k, v in self._hits.items() if not v or now - v[-1] > window_seconds]:
                self._hits.pop(k, None)
        return 0.0
