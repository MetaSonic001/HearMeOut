"""DOCX extraction with python-docx (MIT)."""

from __future__ import annotations

import io
import re

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.services.extract.types import Block, Extracted, ExtractionError

_HEADING_RE = re.compile(r"^heading\s*(\d)$", re.IGNORECASE)


def extract_docx(data: bytes, filename: str | None = None) -> Extracted:
    try:
        doc = Document(io.BytesIO(data))
    except Exception as exc:  # python-docx raises several unrelated types on bad files
        raise ExtractionError("invalid_docx", "We could not open this Word file. It may be damaged.") from exc

    blocks: list[Block] = []
    title: str | None = None
    skipped_tables = 0
    for item in doc.iter_inner_content():
        if isinstance(item, Table):
            skipped_tables += 1
            continue
        if not isinstance(item, Paragraph):
            continue
        text = item.text.strip()
        if not text:
            continue
        style = (item.style.name if item.style is not None else "") or ""
        match = _HEADING_RE.match(style)
        if style.lower() == "title":
            title = title or text
            blocks.append(Block("h", text, None, 1))
        elif match:
            blocks.append(Block("h", text, None, min(int(match.group(1)), 3)))
        elif style.lower().startswith("list"):
            blocks.append(Block("p", text if re.search(r"[.!?:;]$", text) else text + ".", None))
        else:
            blocks.append(Block("p", text, None))

    if not blocks:
        raise ExtractionError("empty", "This Word file has no readable text.")
    if not title:
        title = (doc.core_properties.title or "").strip() or None
    if not title and filename:
        title = re.sub(r"[_\-]+", " ", re.sub(r"\.docx?$", "", filename, flags=re.I)).strip() or None
    if not title:
        title = next((b.t for b in blocks if b.k == "h"), blocks[0].t[:70])
    warnings = []
    if skipped_tables:
        warnings.append(f"{skipped_tables} table(s) were skipped because tables do not read well aloud.")
    return Extracted(title=title[:140], blocks=blocks, source_type="docx", warnings=warnings)
