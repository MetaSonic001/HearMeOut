"""Split a block list into listenable sections (chapters)."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.extract.types import Block


@dataclass(slots=True)
class Section:
    idx: int
    title: str
    start: int  # first block index
    end: int  # one past last block index
    page_start: int | None
    page_end: int | None
    chars: int

    def as_dict(self) -> dict[str, object]:
        return {
            "idx": self.idx,
            "title": self.title,
            "start": self.start,
            "end": self.end,
            "page_start": self.page_start,
            "page_end": self.page_end,
            "chars": self.chars,
        }


def _span(blocks: list[Block], start: int, end: int) -> tuple[int | None, int | None, int]:
    pages = [b.p for b in blocks[start:end] if b.p is not None]
    chars = sum(len(b.t) for b in blocks[start:end])
    return (min(pages) if pages else None, max(pages) if pages else None, chars)


def _boundaries(blocks: list[Block], max_level: int) -> list[int]:
    return [i for i, b in enumerate(blocks) if b.k == "h" and b.lv <= max_level]


def _raw_sections(blocks: list[Block], bounds: list[int], title: str) -> list[tuple[str, int, int]]:
    if not blocks:
        return []
    starts = list(bounds)
    if not starts or starts[0] != 0:
        starts = [0, *starts]
        names = [title] + [blocks[i].t.rstrip(".") for i in starts[1:]]
    else:
        names = [blocks[i].t.rstrip(".") for i in starts]
    ends = [*starts[1:], len(blocks)]
    return list(zip(names, starts, ends, strict=True))


def _chars(blocks: list[Block], start: int, end: int) -> int:
    return sum(len(b.t) for b in blocks[start:end])


def _merge_small(
    raw: list[tuple[str, int, int]], blocks: list[Block], min_chars: int
) -> list[tuple[str, int, int]]:
    merged: list[tuple[str, int, int]] = []
    for name, start, end in raw:
        if merged and _chars(blocks, start, end) < min_chars:
            pname, pstart, _ = merged[-1]
            merged[-1] = (pname, pstart, end)
        else:
            merged.append((name, start, end))
    if len(merged) > 1 and _chars(blocks, merged[0][1], merged[0][2]) < min_chars:
        first, second = merged[0], merged[1]
        merged[1] = (first[0], first[1], second[2])
        merged.pop(0)
    return merged


def _split_large(
    raw: list[tuple[str, int, int]], blocks: list[Block], max_chars: int, part_chars: int
) -> list[tuple[str, int, int]]:
    out: list[tuple[str, int, int]] = []
    for name, start, end in raw:
        if _chars(blocks, start, end) <= max_chars:
            out.append((name, start, end))
            continue
        part = 1
        cur_start = start
        acc = 0
        for i in range(start, end):
            acc += len(blocks[i].t)
            if acc >= part_chars and i + 1 < end:
                out.append((name if part == 1 else f"{name} (part {part})", cur_start, i + 1))
                part += 1
                cur_start = i + 1
                acc = 0
        out.append((name if part == 1 else f"{name} (part {part})", cur_start, end))
    return out


def build_sections(
    blocks: list[Block],
    *,
    title: str = "Document",
    min_chars: int = 1500,
    max_chars: int = 30000,
    part_chars: int = 12000,
) -> list[Section]:
    """Choose the shallowest heading level that yields reasonably sized sections."""
    if not blocks:
        return []
    levels = sorted({b.lv for b in blocks if b.k == "h"})
    chosen = levels[0] if levels else 1
    raw = _raw_sections(blocks, _boundaries(blocks, chosen), title)
    for level in levels:
        raw = _raw_sections(blocks, _boundaries(blocks, level), title)
        if max(_chars(blocks, s, e) for _, s, e in raw) <= max_chars:
            break
    raw = _merge_small(raw, blocks, min_chars)
    raw = _split_large(raw, blocks, max_chars, part_chars)
    sections: list[Section] = []
    for idx, (name, start, end) in enumerate(raw):
        page_start, page_end, chars = _span(blocks, start, end)
        sections.append(
            Section(
                idx=idx,
                title=(name or f"Part {idx + 1}")[:120],
                start=start,
                end=end,
                page_start=page_start,
                page_end=page_end,
                chars=chars,
            )
        )
    return sections
