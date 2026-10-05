"""Shared types for document extraction."""

from __future__ import annotations

from dataclasses import dataclass, field


class ExtractionError(Exception):
    """Raised when a document cannot be turned into text. `code` is user-facing."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class NeedsOcr(ExtractionError):
    """A PDF whose pages are pictures of text. `pages` are the 0-based indexes that need OCR."""

    def __init__(self, pages: list[int], page_count: int):
        super().__init__(
            "scanned_pdf",
            "This PDF looks like scanned images with no selectable text. "
            "Run it through an OCR tool first, then upload it again.",
        )
        self.pages = pages
        self.page_count = page_count


@dataclass(slots=True)
class Block:
    """A heading ('h') or paragraph ('p'), with the 1-based source page if known."""

    k: str
    t: str
    p: int | None = None
    lv: int = 1  # heading level (1 = chapter); ignored for paragraphs

    def as_dict(self) -> dict[str, object]:
        return {"k": self.k, "t": self.t, "p": self.p, "lv": self.lv}

    @classmethod
    def from_dict(cls, d: dict[str, object]) -> Block:
        page = d.get("p")
        return cls(
            k=str(d["k"]),
            t=str(d["t"]),
            p=int(page) if isinstance(page, int) else None,
            lv=int(d.get("lv", 1) or 1),
        )


@dataclass(slots=True)
class Extracted:
    title: str
    blocks: list[Block]
    source_type: str
    page_count: int | None = None
    warnings: list[str] = field(default_factory=list)
