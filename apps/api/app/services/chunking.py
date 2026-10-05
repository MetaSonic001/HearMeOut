"""Sentence-aware chunking: text -> ~900-char units that are synthesized independently.

A short first chunk makes playback start quickly; later chunks are larger for
fewer requests and natural prosody.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.extract.types import Block
from app.services.textprep import speakable_heading

FIRST_TARGET = 280
TARGET = 900
MAX_LEN = 1300

_ABBREV = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "fig", "figs", "eq", "eqs",
    "no", "nos", "vol", "pp", "al", "approx", "dept", "inc", "ltd", "st", "cf", "ch", "sec",
    "ca", "viz", "ie", "eg", "e.g", "i.e", "u.s", "u.k", "ph.d", "est", "min", "max", "avg",
}  # fmt: skip
_BOUNDARY_RE = re.compile(r"(?<=[.!?।॥…])[\"')\]”’]*\s+")
_CLAUSE_RE = re.compile(r"(?<=[;:,—–])\s+")


@dataclass(slots=True)
class ChunkSpec:
    text: str
    section_idx: int
    page_start: int | None = None
    page_end: int | None = None
    kind: str = "narration"
    pause_ms: int = 0
    voice: str | None = None


def split_sentences(text: str) -> list[str]:
    """Fast rule-based sentence splitter with abbreviation and initial guards."""
    text = text.strip()
    if not text:
        return []
    sentences: list[str] = []
    start = 0
    for m in _BOUNDARY_RE.finditer(text):
        end = m.start()
        candidate = text[start:end]
        last_word = re.split(r"\s+", candidate)[-1].lower().rstrip(".!?)\"'”’")
        nxt = text[m.end() : m.end() + 1]
        is_abbrev = (
            candidate.endswith(".")
            and (last_word in _ABBREV or (len(last_word) == 1 and last_word.isalpha()))
        )
        looks_decimal = bool(re.search(r"\d\.$", candidate)) and nxt.isdigit()
        lower_continuation = nxt.islower() and candidate.endswith(".")
        if is_abbrev or looks_decimal or lower_continuation:
            continue
        sentences.append(text[start : m.end()].strip())
        start = m.end()
    tail = text[start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


def _split_long(sentence: str, max_len: int) -> list[str]:
    if len(sentence) <= max_len:
        return [sentence]
    parts = _CLAUSE_RE.split(sentence)
    pieces: list[str] = []
    cur = ""
    for part in parts:
        if len(part) > max_len:
            if cur:
                pieces.append(cur)
                cur = ""
            words = part.split(" ")
            buf = ""
            for w in words:
                if len(buf) + len(w) + 1 > max_len and buf:
                    pieces.append(buf)
                    buf = w
                else:
                    buf = f"{buf} {w}".strip()
            if buf:
                pieces.append(buf)
            continue
        if cur and len(cur) + len(part) + 1 > max_len:
            pieces.append(cur)
            cur = part
        else:
            cur = f"{cur} {part}".strip()
    if cur:
        pieces.append(cur)
    return pieces


@dataclass(slots=True)
class _Unit:
    text: str
    page: int | None
    para_end: bool


def _units_from_blocks(blocks: list[Block]) -> list[_Unit]:
    units: list[_Unit] = []
    for block in blocks:
        if block.k == "h":
            units.append(_Unit(speakable_heading(block.t), block.p, True))
            continue
        pieces = [s for sent in split_sentences(block.t) for s in _split_long(sent, MAX_LEN)]
        if pieces and pieces[-1][-1].isalnum():
            pieces[-1] += "."  # a title-like line without punctuation still needs a spoken pause
        for i, piece in enumerate(pieces):
            units.append(_Unit(piece, block.p, i == len(pieces) - 1))
    return units


def _pack(
    units: list[_Unit],
    section_idx: int,
    *,
    first_target: int | None,
    target: int,
    kind: str = "narration",
) -> list[ChunkSpec]:
    chunks: list[ChunkSpec] = []
    buf: list[str] = []
    pages: list[int] = []
    size = 0
    limit = first_target if first_target else target

    def flush() -> None:
        nonlocal buf, pages, size, limit
        if not buf:
            return
        chunks.append(
            ChunkSpec(
                text=" ".join(buf).strip(),
                section_idx=section_idx,
                page_start=min(pages) if pages else None,
                page_end=max(pages) if pages else None,
                kind=kind,
            )
        )
        buf, pages, size = [], [], 0
        limit = target

    for unit in units:
        if buf and size + len(unit.text) + 1 > limit:
            flush()
        buf.append(unit.text)
        size += len(unit.text) + 1
        if unit.page is not None:
            pages.append(unit.page)
        if unit.para_end and size >= limit * 0.85:
            flush()
    flush()
    return chunks


def chunk_blocks(
    blocks: list[Block],
    section_idx: int,
    *,
    first_target: int | None = None,
    target: int = TARGET,
) -> list[ChunkSpec]:
    """Chunk the blocks of one section. `first_target` shrinks the very first chunk."""
    return _pack(_units_from_blocks(blocks), section_idx, first_target=first_target, target=target)


def chunk_script(
    text: str,
    section_idx: int,
    *,
    page_start: int | None,
    page_end: int | None,
    first_target: int | None = None,
    target: int = TARGET,
    kind: str = "narration",
) -> list[ChunkSpec]:
    """Chunk an LLM/extractive script (paragraphs separated by blank lines)."""
    units: list[_Unit] = []
    for para in re.split(r"\n\s*\n", text.strip()):
        para = " ".join(para.split())
        if not para:
            continue
        pieces = [s for sent in split_sentences(para) for s in _split_long(sent, MAX_LEN)]
        for i, piece in enumerate(pieces):
            units.append(_Unit(piece, None, i == len(pieces) - 1))
    chunks = _pack(units, section_idx, first_target=first_target, target=target, kind=kind)
    for c in chunks:
        c.page_start, c.page_end = page_start, page_end
    return chunks
