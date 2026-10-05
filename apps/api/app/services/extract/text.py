"""Plain text / Markdown extraction."""

from __future__ import annotations

import re

from app.services.extract.headings import heading_level
from app.services.extract.types import Block, Extracted, ExtractionError

_MD_HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$")
_BULLET_LINE_RE = re.compile(r"^\s*(?:[•●*\-–]|\d{1,3}[.)])\s+\S")


def decode_bytes(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _paragraph_groups(lines: list[str]) -> list[str]:
    """Group the lines of one paragraph: bullets stay separate, wrapped lines are joined."""
    groups: list[list[str]] = []
    for line in lines:
        if _BULLET_LINE_RE.match(line) or not groups:
            groups.append([line.strip()])
        else:
            groups[-1].append(line.strip())
    return [" ".join(g) for g in groups]


def parse_text(raw: str, *, title: str | None = None, source_type: str = "text") -> Extracted:
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    if not raw.strip():
        raise ExtractionError("empty", "There is no text to read. Paste or upload something first.")
    blocks: list[Block] = []
    for para in re.split(r"\n\s*\n", raw):
        lines = [ln for ln in para.split("\n") if ln.strip()]
        if not lines:
            continue
        first = lines[0]
        md = _MD_HEADING_RE.match(first)
        if md and len(lines) == 1:
            blocks.append(Block("h", md.group(2).strip(), None, min(len(md.group(1)), 3)))
            continue
        if len(lines) == 1:
            level = heading_level(first)
            if level:
                blocks.append(Block("h", first.strip(), None, level))
                continue
        for group in _paragraph_groups(lines):
            blocks.append(Block("p", group))
    if not blocks:
        raise ExtractionError("empty", "There is no readable text in this content.")
    if title is None:
        first_heading = next((b.t for b in blocks if b.k == "h"), None)
        title = first_heading or blocks[0].t[:70].rstrip(" .,;:") or "Pasted text"
    return Extracted(title=title[:140], blocks=blocks, source_type=source_type)
