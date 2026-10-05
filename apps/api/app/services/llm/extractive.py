"""Non-LLM condensation: frequency-based extractive summaries and cloze quiz questions.

Used when no LLM key is configured or when the LLM fails for a section, so every
mode always works. It keeps the source language (no translation).
"""

from __future__ import annotations

import re
from collections import Counter

from app.services.chunking import split_sentences

_WORD_RE = re.compile(r"[^\W\d_]{4,}", re.UNICODE)
_STOP = {
    "that", "this", "with", "from", "have", "were", "which", "their", "there", "would", "about",
    "into", "than", "then", "them", "these", "those", "rather", "also", "been", "being", "other",
    "such", "some", "when", "what", "will", "your", "more", "most", "very", "much", "just",
}  # fmt: skip


def _freq(sentences: list[str]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for s in sentences:
        for w in _WORD_RE.findall(s.lower()):
            if w not in _STOP:
                counts[w] += 1
    return counts


def _score(sentence: str, counts: Counter[str], position: int) -> float:
    words = [w for w in _WORD_RE.findall(sentence.lower()) if w not in _STOP]
    if len(words) < 3:
        return 0.0
    base = sum(counts[w] for w in words) / (len(words) ** 0.8)
    bonus = 1.25 if position == 0 else 1.0
    return base * bonus


def condense(text: str, ratio: float) -> str:
    """Keep the highest-scoring sentences (original order) up to `ratio` of the characters."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    sentences: list[tuple[str, int, int]] = []  # sentence, paragraph index, position in paragraph
    for pi, para in enumerate(paragraphs):
        for si, sent in enumerate(split_sentences(para)):
            sentences.append((sent, pi, si))
    if not sentences:
        return text.strip()
    counts = _freq([s for s, _, _ in sentences])
    budget = max(240, int(sum(len(s) for s, _, _ in sentences) * ratio))
    ranked = sorted(range(len(sentences)), key=lambda i: _score(sentences[i][0], counts, sentences[i][2]), reverse=True)
    chosen: set[int] = set()
    used = 0
    for i in ranked:
        if used >= budget:
            break
        chosen.add(i)
        used += len(sentences[i][0])
    out: list[str] = []
    current_para = -1
    for i in sorted(chosen):
        sent, pi, _ = sentences[i]
        if pi != current_para:
            out.append(sent)
            current_para = pi
        else:
            out[-1] += " " + sent
    return "\n\n".join(out)


def cloze_questions(text: str, count: int = 3) -> list[tuple[str, str]]:
    """Fill-in-the-blank questions built from the most informative sentences."""
    sentences = [s for s in split_sentences(" ".join(text.split())) if 40 <= len(s) <= 260]
    if not sentences:
        return []
    counts = _freq(sentences)
    ranked = sorted(range(len(sentences)), key=lambda i: _score(sentences[i], counts, 1), reverse=True)
    questions: list[tuple[str, str]] = []
    used_words: set[str] = set()
    for i in ranked:
        sentence = sentences[i]
        candidates = [w for w in _WORD_RE.findall(sentence) if w.lower() not in _STOP and len(w) >= 5]
        candidates.sort(key=lambda w: (counts[w.lower()], len(w)), reverse=True)
        pick = next((w for w in candidates if w.lower() not in used_words), None)
        if not pick:
            continue
        used_words.add(pick.lower())
        blanked = re.sub(rf"\b{re.escape(pick)}\b", "blank", sentence, count=1)
        questions.append((f"Fill in the blank. {blanked}", f"The missing word is {pick}. {sentence}"))
        if len(questions) >= count:
            break
    return questions
