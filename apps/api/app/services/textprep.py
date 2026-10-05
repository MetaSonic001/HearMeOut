"""Make extracted text pleasant to listen to.

Raw PDF/HTML text is full of things that sound terrible aloud: citation markers,
URLs, footnote numbers, markdown, ligatures, soft hyphens. This module removes or
rewrites them. It is deterministic and language-agnostic.
"""

from __future__ import annotations

import re
import unicodedata

from app.services.extract.types import Block

LIGATURES = {
    "ﬀ": "ff",
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "ﬅ": "st",
    "ﬆ": "st",
}
_LIG_RE = re.compile("|".join(LIGATURES))
_INVISIBLE_RE = re.compile(r"[\u00ad\u200b\u200c\u200d\u2060\ufeff\u202a-\u202e\ufffe\uffff\ufffd]")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_CITATION_NUM_RE = re.compile(r"\s?\[\s*\d+(?:\s*[,–—-]\s*\d+)*\s*\]")
_CITATION_AUTHOR_RE = re.compile(
    r"\s?\((?:[A-Z][A-Za-zÀ-ſ'\-]+(?: et al\.?)?(?:,? (?:and|&) [A-Z][A-Za-zÀ-ſ'\-]+)?"
    r",? (?:19|20)\d{2}[a-z]?(?:[;,] ?)?)+\)"
)
_SUPERSCRIPT_RE = re.compile("[¹²³⁰-⁹]+")
_URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>()\[\]]+", re.IGNORECASE)
_MD_EMPH_RE = re.compile(r"(\*\*|__|`+)")
_MD_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+")
_MD_QUOTE_RE = re.compile(r"^\s{0,3}>\s?")
_BULLET_RE = re.compile(r"^\s*(?:[•●▪◦‣⁃*\-–—]|\(?\d{1,3}[.)])\s+")
_MULTISPACE_RE = re.compile(r"[ \t   ]+")
_REFERENCE_HEADING_RE = re.compile(
    r"^\s*(?:\d+[.)]?\s*)?(references?|bibliography|works cited|further reading|"
    r"acknowledg(?:e)?ments?|index)\s*$",
    re.IGNORECASE,
)
_SENTENCE_END_RE = re.compile(r"[.!?।॥…:;\"'”’)\]]$")


def clean_text(text: str) -> str:
    """Clean one block of text for speech. Returns '' if nothing speakable remains."""
    text = unicodedata.normalize("NFC", text)
    text = _LIG_RE.sub(lambda m: LIGATURES[m.group(0)], text)
    text = _INVISIBLE_RE.sub("", text)
    text = _CITATION_NUM_RE.sub("", text)
    text = _CITATION_AUTHOR_RE.sub("", text)
    text = _SUPERSCRIPT_RE.sub("", text)
    text = _URL_RE.sub("", text)
    text = _EMAIL_RE.sub("", text)
    lines = []
    for line in text.splitlines():
        line = _MD_HEADING_RE.sub("", line)
        line = _MD_QUOTE_RE.sub("", line)
        bullet = _BULLET_RE.match(line)
        if bullet:
            line = line[bullet.end() :]
            line = line.rstrip()
            if line and not _SENTENCE_END_RE.search(line):
                line += "."
        lines.append(line)
    text = " ".join(lines)
    text = _MD_EMPH_RE.sub("", text)
    text = text.replace("|", " ")
    text = _MULTISPACE_RE.sub(" ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"\(\s*\)", "", text)
    text = text.strip()
    if sum(ch.isalnum() for ch in text) < 2:
        return ""
    return text


def _looks_like_table_noise(text: str) -> bool:
    """Short blocks that are mostly digits/symbols (table cells, equation residue)."""
    if len(text) > 160:
        return False
    letters = sum(ch.isalpha() for ch in text)
    return letters < 0.4 * max(len(text.replace(" ", "")), 1)


def _heading_text(text: str) -> str:
    text = text.strip()
    if text and not _SENTENCE_END_RE.search(text):
        text += "."
    return text


def prepare_blocks(blocks: list[Block], *, include_references: bool = False) -> list[Block]:
    """Clean every block, drop noise and (optionally) the references section."""
    out: list[Block] = []
    skipping = False
    for block in blocks:
        raw = block.t
        if block.k == "h":
            if not include_references and _REFERENCE_HEADING_RE.match(raw):
                skipping = True
                continue
            skipping = False
        if skipping:
            continue
        text = clean_text(raw)
        if not text:
            continue
        if block.k == "p" and _looks_like_table_noise(text):
            continue
        out.append(Block(k=block.k, t=text, p=block.p, lv=block.lv))
    return out


def speakable_heading(text: str) -> str:
    """A heading as a spoken sentence ('Processes.')."""
    return _heading_text(text)


def count_speech_chars(blocks: list[Block]) -> int:
    return sum(len(b.t) + 1 for b in blocks)
