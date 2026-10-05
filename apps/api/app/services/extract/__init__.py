"""Extraction entry points: turn an upload, pasted text or URL into cleaned blocks."""

from __future__ import annotations

import asyncio
import io
import zipfile

from app.services.extract.docx import extract_docx
from app.services.extract.epub import extract_epub
from app.services.extract.fetch import fetch_url
from app.services.extract.html import extract_html
from app.services.extract.pdf import extract_pdf
from app.services.extract.text import decode_bytes, parse_text
from app.services.extract.types import Block, Extracted, ExtractionError, NeedsOcr

__all__ = [
    "Block",
    "ExtractionError",
    "NeedsOcr",
    "Extracted",
    "extract_bytes",
    "extract_pasted",
    "extract_link",
    "SUPPORTED_EXTENSIONS",
]

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".epub", ".txt", ".md", ".markdown", ".html", ".htm"}


def _sniff(filename: str, data: bytes) -> str:
    name = filename.lower()
    if data[:5] == b"%PDF-" or name.endswith(".pdf"):
        return "pdf"
    if data[:2] == b"PK":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = set(zf.namelist())
        except zipfile.BadZipFile:
            names = set()
        if "META-INF/container.xml" in names or name.endswith(".epub"):
            return "epub"
        if "word/document.xml" in names or name.endswith(".docx"):
            return "docx"
        raise ExtractionError("unsupported", "This file type is not supported. Use PDF, DOCX, EPUB, TXT or HTML.")
    if name.endswith((".html", ".htm")) or data[:200].lstrip().lower().startswith((b"<!doctype html", b"<html")):
        return "html"
    if name.endswith((".doc", ".ppt", ".pptx", ".xls", ".xlsx", ".rtf", ".odt")):
        raise ExtractionError(
            "unsupported",
            "This file type is not supported yet. Save it as PDF or DOCX and upload that.",
        )
    return "text"


def _extract_bytes_sync(filename: str, data: bytes) -> Extracted:
    kind = _sniff(filename, data)
    if kind == "pdf":
        return extract_pdf(data, filename)
    if kind == "docx":
        return extract_docx(data, filename)
    if kind == "epub":
        return extract_epub(data, filename)
    if kind == "html":
        return extract_html(decode_bytes(data), filename=filename)
    return parse_text(decode_bytes(data), source_type="text")


async def extract_bytes(filename: str, data: bytes) -> Extracted:
    return await asyncio.to_thread(_extract_bytes_sync, filename, data)


async def extract_pasted(text: str, title: str | None = None) -> Extracted:
    return await asyncio.to_thread(parse_text, text, title=title, source_type="paste")


async def extract_link(url: str) -> Extracted:
    body, ctype, final_url = await fetch_url(url)
    if ctype == "application/pdf" or body[:5] == b"%PDF-":
        extracted = await asyncio.to_thread(extract_pdf, body, final_url.rsplit("/", 1)[-1])
        extracted.source_type = "url"
        return extracted
    if ctype == "text/plain":
        extracted = await asyncio.to_thread(parse_text, decode_bytes(body), title=None, source_type="url")
        return extracted
    return await asyncio.to_thread(extract_html, decode_bytes(body), url=final_url)
