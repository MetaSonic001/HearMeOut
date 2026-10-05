"""PDF extraction with pypdfium2 (Apache-2.0/BSD): text, reflow, headers/footers, outline."""

from __future__ import annotations

import re
from collections import Counter

import pypdfium2 as pdfium
from pypdfium2 import PdfiumError

from app.services.extract.headings import heading_level
from app.services.extract.types import Block, Extracted, ExtractionError, NeedsOcr

MAX_PAGES = 3000
MIN_PAGE_CHARS = 25  # a page with less selectable text than this is treated as a picture
_PAGE_NUMBER_RE = re.compile(
    r"^\s*[-–—\[(]*\s*(?:page\s+)?(?:\d{1,4}|[ivxlcdm]{1,7})"
    r"(?:\s*(?:of|/)\s*\d{1,4})?\s*[-–—\])]*\s*$",
    re.IGNORECASE,
)
_TERMINAL_RE = re.compile(r"[.!?।॥…:\"'”’)\]]$")
_BULLET_START_RE = re.compile(r"^\s*(?:[•●▪*\-–]|\d{1,3}[.)])\s+\S")
_JUNK_TITLE_RE = re.compile(r"^(microsoft word|untitled|document\d*|slide \d+|\w+\.(docx?|pdf|tex))", re.I)


_LEADING_NUMBER_RE = re.compile(r"^(?:\d+(?:\.\d+)*|[ivxlc]+)[.)]?\s+", re.IGNORECASE)


def _key(text: str) -> str:
    """Normalized heading key: lowercase words, without a leading section number."""
    key = re.sub(r"\W+", " ", text.lower()).strip()
    return _LEADING_NUMBER_RE.sub("", key) or key


def _norm_line(line: str) -> str:
    return re.sub(r"\d+", "#", line.strip().lower())


def _strip_repeating_margins(pages: list[list[str]]) -> list[list[str]]:
    """Remove running headers/footers: short lines at page edges repeated on many pages."""
    n = len(pages)
    if n < 4:
        return [[ln for ln in p if not _PAGE_NUMBER_RE.match(ln)] for p in pages]
    counts: Counter[str] = Counter()
    for lines in pages:
        content = [ln for ln in lines if ln.strip()]
        edge = content[:2] + content[-2:]
        for key in {_norm_line(ln) for ln in edge if len(ln.strip()) < 100}:
            counts[key] += 1
    threshold = max(3, int(n * 0.3))
    repeated = {k for k, c in counts.items() if c >= threshold and k not in ("", "#")}
    cleaned: list[list[str]] = []
    for lines in pages:
        content_idx = [i for i, ln in enumerate(lines) if ln.strip()]
        edge_idx = set(content_idx[:2] + content_idx[-2:])
        kept = []
        for i, ln in enumerate(lines):
            if _PAGE_NUMBER_RE.match(ln):
                continue
            if i in edge_idx and _norm_line(ln) in repeated:
                continue
            kept.append(ln)
        cleaned.append(kept)
    return cleaned


def _join(prev: str, nxt: str) -> str:
    if prev.endswith("￾"):  # pdfium marks generated hyphenation with U+FFFE
        return prev[:-1] + nxt
    if prev.endswith("-") and len(prev) > 1 and prev[-2].isalpha() and nxt[:1].islower():
        return prev[:-1] + nxt
    return f"{prev} {nxt}"


def _page_blocks(
    lines: list[str],
    page: int,
    toc_titles: dict[str, int] | None,
    carry: list[str] | None,
    carry_page: int | None,
) -> tuple[list[Block], list[str] | None, int | None]:
    """Turn the lines of one page into blocks. Returns (blocks, open paragraph, its page)."""
    blocks: list[Block] = []
    content = [ln.strip() for ln in lines]
    lengths = sorted(len(ln) for ln in content if ln)
    full = lengths[int(len(lengths) * 0.9)] if lengths else 0
    short_limit = full * 0.6

    para: list[str] | None = carry
    para_page = carry_page
    first_content = True

    def flush() -> None:
        nonlocal para, para_page
        if para:
            text = para[0]
            for part in para[1:]:
                text = _join(text, part)
            blocks.append(Block("p", text, para_page))
        para, para_page = None, None

    prev_line = ""
    for line in content:
        if not line:
            flush()
            prev_line = ""
            continue
        # a paragraph carried over from the previous page continues only on a lowercase start
        if first_content and para and not (line[:1].islower() and not _BULLET_START_RE.match(line)):
            flush()
        first_content = False

        level: int | None = None
        if toc_titles is not None:
            level = toc_titles.get(_key(line))
        elif len(line) <= 90 and not para:
            level = heading_level(line)
        elif len(line) <= 90 and para is not None and prev_line and (
            len(prev_line) < short_limit or _TERMINAL_RE.search(prev_line)
        ):
            level = heading_level(line)
        if level:
            flush()
            blocks.append(Block("h", line, page, level))
            prev_line = ""
            continue

        starts_new = (
            para is None
            or bool(_BULLET_START_RE.match(line))
            or (bool(prev_line) and _TERMINAL_RE.search(prev_line) is not None
                and len(prev_line) < short_limit)
        )
        if starts_new:
            flush()
            para, para_page = [line], page
        else:
            assert para is not None
            para.append(line)
        prev_line = line
    return blocks, para, para_page


def _title_from(pdf: pdfium.PdfDocument, blocks: list[Block], filename: str | None) -> str:
    try:
        meta = (pdf.get_metadata_value("Title") or "").strip()
    except PdfiumError:
        meta = ""
    if meta and len(meta) > 3 and not _JUNK_TITLE_RE.match(meta):
        return meta[:140]
    if filename:
        stem = re.sub(r"\.pdf$", "", filename, flags=re.I)
        stem = re.sub(r"[_\-]+", " ", stem).strip()
        if stem:
            return stem[:140]
    heading = next((b.t for b in blocks if b.k == "h"), None)
    return (heading or "PDF document")[:140]


def extract_pdf(data: bytes, filename: str | None = None, *, ocr_texts: dict[int, list[str]] | None = None) -> Extracted:
    """Extract a PDF. `ocr_texts` maps 0-based page index -> recognised lines for scanned pages."""
    try:
        pdf = pdfium.PdfDocument(data)
    except PdfiumError as exc:
        msg = str(exc).lower()
        if "password" in msg:
            raise ExtractionError(
                "password_protected", "This PDF is password protected. Remove the password and try again."
            ) from exc
        raise ExtractionError("invalid_pdf", "We could not open this PDF. The file may be damaged.") from exc

    try:
        page_count = len(pdf)
        if page_count == 0:
            raise ExtractionError("empty", "This PDF has no pages.")
        if page_count > MAX_PAGES:
            raise ExtractionError("too_many_pages", f"This PDF has {page_count} pages; the limit is {MAX_PAGES}.")

        pages: list[list[str]] = []
        total_chars = 0
        for i in range(page_count):
            page = pdf[i]
            try:
                textpage = page.get_textpage()
                text = textpage.get_text_range()
                textpage.close()
            finally:
                page.close()
            text = text.replace("\r\n", "\n").replace("\r", "\n")
            total_chars += len(text.strip())
            pages.append(text.split("\n"))

        if ocr_texts:
            for index, lines in ocr_texts.items():
                if 0 <= index < page_count:
                    pages[index] = lines
                    total_chars += sum(len(ln.strip()) for ln in lines)
        else:
            picture_pages = [i for i, lines in enumerate(pages) if len("".join(lines).strip()) < MIN_PAGE_CHARS]
            mostly_scans = len(picture_pages) >= max(1, page_count * 0.5)
            if mostly_scans or (total_chars < 40 * max(page_count, 1) and total_chars < 800):
                raise NeedsOcr(picture_pages or list(range(page_count)), page_count)

        toc_titles: dict[str, int] | None = None
        toc_entries: list[tuple[str, str, int, int]] = []  # key, title, level, 1-based page
        try:
            toc = list(pdf.get_toc())
        except PdfiumError:
            toc = []
        if len(toc) >= 2:
            toc_titles = {}
            for item in toc:
                title = (item.get_title() or "").strip()
                key = _key(title)
                dest = item.get_dest()
                page_index = dest.get_index() if dest is not None else None
                if key and page_index is not None and 0 <= page_index < page_count:
                    level = min(item.level + 1, 3)
                    toc_titles.setdefault(key, level)
                    toc_entries.append((key, title, level, page_index + 1))

        pages = _strip_repeating_margins(pages)
        blocks: list[Block] = []
        carry: list[str] | None = None
        carry_page: int | None = None
        for i, lines in enumerate(pages):
            page_blocks, carry, carry_page = _page_blocks(lines, i + 1, toc_titles, carry, carry_page)
            blocks.extend(page_blocks)
        if carry:
            text = carry[0]
            for part in carry[1:]:
                text = _join(text, part)
            blocks.append(Block("p", text, carry_page))

        if toc_entries:
            matched = {_key(b.t) for b in blocks if b.k == "h"}
            for key, title, level, page_no in reversed(toc_entries):
                if key in matched:
                    continue
                at = next((i for i, b in enumerate(blocks) if b.p is not None and b.p >= page_no), len(blocks))
                blocks.insert(at, Block("h", title, page_no, level))

        warnings: list[str] = []
        blank_pages = sum(1 for p in pages if not any(ln.strip() for ln in p))
        if blank_pages > page_count * 0.25:
            warnings.append("Some pages have no selectable text (images or scans) and were skipped.")
        if ocr_texts:
            warnings.append("Scanned pages were read with OCR, so a few words may be wrong. You can fix them with Edit.")
        title = _title_from(pdf, blocks, filename)
        return Extracted(title=title, blocks=blocks, source_type="pdf", page_count=page_count, warnings=warnings)
    finally:
        pdf.close()
