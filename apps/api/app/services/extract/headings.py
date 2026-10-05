"""Conservative heading detection for text without markup (plain text, PDF lines)."""

from __future__ import annotations

import re

_NUMBERED_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){0,3})[.)]?\s+[A-Zऀ-෿][^\n]{1,80}$")
_KEYWORD_RE = re.compile(
    r"^(chapter|part|section|unit|lesson|module|appendix|prologue|epilogue|preface|"
    r"introduction|conclusion|abstract|summary)\b(?:\s+[\dIVXLCivxlc]+)?[\s:.\-–—]*.{0,70}$",
    re.IGNORECASE,
)
_TERMINAL_RE = re.compile(r"[.!?,;।]$")


def heading_level(line: str) -> int | None:
    """Return a heading level (1..3) if `line` looks like a heading, else None."""
    text = line.strip()
    if not text or len(text) > 90 or _TERMINAL_RE.search(text):
        return None
    words = text.split()
    if len(words) > 12:
        return None
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return None
    keyword = _KEYWORD_RE.match(text)
    if keyword and keyword.group(1).lower() in {"chapter", "part", "unit", "lesson", "module"}:
        return 1
    if keyword and len(words) <= 6:
        return 1
    numbered = _NUMBERED_RE.match(text)
    if numbered:
        return min(numbered.group(1).count(".") + 1, 3)
    if len(letters) >= 4 and text.isupper() and len(text) <= 70:
        return 1
    return None
