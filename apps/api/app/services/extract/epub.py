"""EPUB extraction using only the standard library zip + BeautifulSoup (no AGPL EbookLib)."""

from __future__ import annotations

import io
import posixpath
import re
import zipfile
from xml.etree import ElementTree

from bs4 import BeautifulSoup

from app.services.extract.types import Block, Extracted, ExtractionError

_NS = {
    "c": "urn:oasis:names:tc:opendocument:xmlns:container",
    "opf": "http://www.idpf.org/2007/opf",
    "dc": "http://purl.org/dc/elements/1.1/",
}
_XHTML_TYPES = {"application/xhtml+xml", "text/html"}
_MAX_UNCOMPRESSED = 200 * 1024 * 1024


def _read(zf: zipfile.ZipFile, name: str) -> bytes:
    info = zf.getinfo(name)
    if info.file_size > _MAX_UNCOMPRESSED:
        raise ExtractionError("too_large", "This EPUB is too large to process.")
    return zf.read(name)


def _html_blocks(markup: bytes) -> list[Block]:
    soup = BeautifulSoup(markup, "lxml")
    for tag in soup(["script", "style", "nav", "svg", "figure", "table"]):
        tag.decompose()
    blocks: list[Block] = []
    for el in soup.find_all(["h1", "h2", "h3", "h4", "p", "li", "blockquote"]):
        if el.name == "blockquote" and el.find("p"):
            continue
        if el.name == "li" and el.find("p"):
            continue
        text = " ".join(el.get_text(" ", strip=True).split())
        if not text:
            continue
        if el.name in {"h1", "h2", "h3", "h4"}:
            blocks.append(Block("h", text, None, min(int(el.name[1]), 3)))
        else:
            if el.name == "li" and not re.search(r"[.!?:;]$", text):
                text += "."
            blocks.append(Block("p", text, None))
    return blocks


def extract_epub(data: bytes, filename: str | None = None) -> Extracted:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ExtractionError("invalid_epub", "We could not open this EPUB. It may be damaged.") from exc
    with zf:
        try:
            container = ElementTree.fromstring(_read(zf, "META-INF/container.xml"))
            rootfile = container.find(".//c:rootfile", _NS)
            if rootfile is None:
                raise KeyError("rootfile")
            opf_path = rootfile.attrib["full-path"]
            opf = ElementTree.fromstring(_read(zf, opf_path))
        except (KeyError, ElementTree.ParseError) as exc:
            raise ExtractionError("invalid_epub", "This EPUB is missing its table of contents.") from exc

        base = posixpath.dirname(opf_path)
        manifest = {
            item.attrib["id"]: (item.attrib.get("href", ""), item.attrib.get("media-type", ""))
            for item in opf.findall(".//opf:manifest/opf:item", _NS)
        }
        title_el = opf.find(".//dc:title", _NS)
        title = (title_el.text or "").strip() if title_el is not None and title_el.text else ""

        blocks: list[Block] = []
        for ref in opf.findall(".//opf:spine/opf:itemref", _NS):
            if ref.attrib.get("linear") == "no":
                continue
            href, media = manifest.get(ref.attrib.get("idref", ""), ("", ""))
            if media not in _XHTML_TYPES or not href:
                continue
            path = posixpath.normpath(posixpath.join(base, href.split("#")[0]))
            try:
                chapter = _html_blocks(_read(zf, path))
            except KeyError:
                continue
            blocks.extend(chapter)

    if not blocks:
        raise ExtractionError("empty", "We could not find any readable text in this EPUB.")
    if not title and filename:
        title = re.sub(r"[_\-]+", " ", re.sub(r"\.epub$", "", filename, flags=re.I)).strip()
    return Extracted(title=(title or blocks[0].t)[:140], blocks=blocks, source_type="epub")
