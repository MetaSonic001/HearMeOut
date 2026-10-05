"""Listening-time estimates (characters -> seconds) before audio exists.

Calibrated against Edge TTS neural voices at normal speed; exact durations are
recorded from the real MP3 once a chunk is synthesized.
"""

from __future__ import annotations

# characters per second of speech at 1.0x, by language family
_CPS_BY_LANG = {
    "en": 15.5,
    "hi": 14.5,
    "mr": 13.0,
    "bn": 13.0,
    "ta": 12.0,
    "te": 12.5,
    "gu": 13.5,
    "kn": 12.5,
    "ml": 11.5,
    "pa": 14.0,
}
DEFAULT_CPS = 14.5

# fraction of source length kept by each AI mode (words-in -> words-out)
MODE_RATIO = {"read": 1.0, "translate": 1.0, "study": 0.35, "revision": 0.12, "explain": 0.55, "quiz": 0.22}


def chars_per_second(language: str) -> float:
    return _CPS_BY_LANG.get(language.split("-")[0].lower(), DEFAULT_CPS)


def estimate_seconds(chars: int, language: str = "en", mode: str = "read") -> int:
    return round(chars * MODE_RATIO.get(mode, 1.0) / chars_per_second(language))
