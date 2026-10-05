"""Web page / HTML extraction using trafilatura (Apache-2.0) with a BeautifulSoup fallback."""

from __future__ import annotations

import re

import trafilatura
from bs4 import BeautifulSoup

from app.services.extract.text import parse_text
from app.services.extract.types import Block, Extracted, ExtractionError


def _fallback_blocks(html: str) -> list[Block]:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "svg", "noscript"]):
        tag.decompose()
    root = soup.find("article") or soup.find("main") or soup.body or soup
    blocks: list[Block] = []
    for el in root.find_all(["h1", "h2", "h3", "p", "li"]):
        text = " ".join(el.get_text(" ", strip=True).split())
        if len(text) < 2:
            continue
        if el.name in {"h1", "h2", "h3"}:
            blocks.append(Block("h", text, None, int(el.name[1])))
        elif len(text) > 40:
            blocks.append(Block("p", text, None))
    return blocks


def extract_html(html: str, *, url: str | None = None, filename: str | None = None) -> Extracted:
    meta_title = None
    try:
        meta = trafilatura.extract_metadata(html)
        meta_title = (meta.title or "").strip() if meta else None
    except Exception:  # metadata is best effort
        meta_title = None

    markdown = trafilatura.extract(
        html,
        url=url,
        output_format="markdown",
        include_comments=False,
        include_tables=False,
        include_links=False,
        favor_precision=True,
    )
    source_type = "url" if url else "html"
    if markdown and len(markdown.strip()) > 200:
        extracted = parse_text(markdown, title=meta_title or None, source_type=source_type)
    else:
        blocks = _fallback_blocks(html)
        if not blocks:
            raise ExtractionError(
                "empty", "We could not find readable article text on this page."
            )
        title = meta_title or next((b.t for b in blocks if b.k == "h"), None)
        if not title and filename:
            title = re.sub(r"\.html?$", "", filename, flags=re.I)
        extracted = Extracted(title=(title or blocks[0].t[:70])[:140], blocks=blocks, source_type=source_type)
    if not extracted.title and url:
        extracted.title = url[:140]
    return extracted
