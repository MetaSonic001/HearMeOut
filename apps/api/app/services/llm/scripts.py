"""Turn a document section into a listening script for Study / Revision / Explain / Quiz modes."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

from app.services.estimate import MODE_RATIO
from app.services.languages import Language
from app.services.llm import extractive
from app.services.llm.groq import GroqClient, LLMError

log = logging.getLogger(__name__)

BLOCK_CHARS = 6000
QUIZ_PAUSE_MS = 4500

SYSTEM = (
    "You are the narrator of an audio learning product. Everything you write will be read aloud by a "
    "text-to-speech voice. Output plain spoken prose only: no markdown, no bullet points, no numbered "
    "lists, no headings, no emojis, no URLs, no citation markers, no stage directions. Write complete "
    "sentences that sound natural aloud and spell out symbols or formulas in words. Stay faithful to the "
    "source: never invent facts, names, numbers or examples that contradict it."
)

# Added for the modes that write new spoken text. Edge's neural voices react to how the text is written:
# varied sentence length, contractions, questions and dashes all change the delivery. Translation stays faithful.
SPOKEN_STYLE = (
    " Write the way a gifted storyteller and teacher actually talks, not the way a textbook reads: mix short, "
    "punchy sentences with longer ones, use contractions, speak to the listener as 'you' where it is natural, and "
    "ask the occasional rhetorical question. Shape the rhythm with commas, dashes and the odd ellipsis, and use an "
    "exclamation mark only where an idea truly deserves excitement."
)

TRANSLATE_BLOCK_CHARS = 3500

MODE_BRIEF = {
    "translate": (
        "Translate the source completely and faithfully. Keep every sentence, name, number and the original "
        "order; do not summarise, explain, shorten or add anything. Proper names, product names and code may "
        "stay as they are. Make it read naturally when spoken aloud. The source has about {words} words."
    ),
    "study": (
        "Rewrite the source as a clear audio study version. Keep every key concept, definition, formula "
        "(explained in words), example and the original logical order, but remove repetition, filler and "
        "navigation text. Target about {words} words."
    ),
    "revision": (
        "Write a tight spoken revision recap of the source: the essential points, definitions and "
        "must-remember facts in short paragraphs, most important first within each idea. "
        "Target about {words} words."
    ),
    "explain": (
        "Explain the source like a warm, patient teacher speaking to a first-time learner. Use simple "
        "words, define jargon the first time it appears, and add one short everyday analogy or example "
        "where it genuinely helps. Stay faithful to the source. Target about {words} words."
    ),
}


@dataclass(slots=True)
class QA:
    question: str
    answer: str


@dataclass(slots=True)
class ScriptResult:
    text: str = ""  # narration paragraphs (blank-line separated)
    qa: list[QA] = field(default_factory=list)  # quiz mode
    used_llm: bool = False


def split_for_llm(text: str, max_chars: int = BLOCK_CHARS) -> list[str]:
    blocks: list[str] = []
    cur: list[str] = []
    size = 0
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if not para:
            continue
        if cur and size + len(para) > max_chars:
            blocks.append("\n\n".join(cur))
            cur, size = [], 0
        cur.append(para)
        size += len(para)
    if cur:
        blocks.append("\n\n".join(cur))
    return blocks


def _language_rule(language: Language) -> str:
    rule = f"Write in {language.llm_name}."
    if language.code == "hinglish":
        rule += " Use only Roman letters (no Devanagari), the way Indian friends talk, keeping technical terms in English."
    elif language.indian or language.code != "en":
        rule += " Common technical terms may stay in English when that is natural for speakers."
    return rule


def _position_rule(position: int, total: int, title: str, is_first_doc_section: bool) -> str:
    parts = [f'This is section {position + 1} of {total}, titled "{title}".']
    if is_first_doc_section:
        parts.append("Start directly with the content; do not greet the listener.")
    else:
        parts.append("Continue naturally; do not greet or recap the whole document.")
    parts.append("Do not say goodbye or conclude the whole document.")
    return " ".join(parts)


def _max_tokens(language: Language, words: int) -> int:
    factor = 7 if language.indian or language.code in {"ar", "ru", "ja", "zh", "tr"} else 2.2
    return int(min(8000, max(400, words * factor + 200)))


def _clean_llm_text(text: str) -> str:
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"\*\*|__", "", text)
    text = re.sub(r"^\s*(?:[-*•]|\d{1,2}[.)])\s+", "", text, flags=re.M)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _parse_quiz_json(raw: str) -> list[QA]:
    try:
        data = json.loads(raw)
    except ValueError:
        match = re.search(r"\{.*\}", raw, flags=re.S)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except ValueError:
            return []
    items = data.get("questions") if isinstance(data, dict) else data
    out: list[QA] = []
    for item in items or []:
        if isinstance(item, dict):
            q, a = str(item.get("q") or item.get("question") or "").strip(), str(item.get("a") or item.get("answer") or "").strip()
            if q and a:
                out.append(QA(q, a))
    return out[:6]


async def _llm_block(
    llm: GroqClient, mode: str, language: Language, title: str, block: str, words: int, position_rule: str
) -> str:
    brief = MODE_BRIEF[mode].format(words=words)
    user = f"{brief}\n{_language_rule(language)}\n{position_rule}\n\nSOURCE:\n{block}"
    system = SYSTEM if mode == "translate" else SYSTEM + SPOKEN_STYLE
    out = await llm.complete(system, user, max_tokens=_max_tokens(language, words), temperature=0.3)
    cleaned = _clean_llm_text(out)
    if len(cleaned) < 40:
        raise LLMError("LLM returned almost nothing")
    return cleaned


async def _llm_quiz(llm: GroqClient, language: Language, title: str, text: str, count: int) -> list[QA]:
    user = (
        f"Write {count} spoken quiz questions that test understanding of the source, each with a short "
        f"answer (one or two sentences) that is clearly supported by the source. {_language_rule(language)} "
        f'Return JSON only, shaped like {{"questions":[{{"q":"...","a":"..."}}]}}.\n'
        f'Section title: "{title}"\n\nSOURCE:\n{text[:BLOCK_CHARS * 2]}'
    )
    raw = await llm.complete(SYSTEM, user, max_tokens=_max_tokens(language, 60 * count), temperature=0.4, json_mode=True)
    qa = _parse_quiz_json(raw)
    if not qa:
        raise LLMError("LLM returned no quiz questions")
    return qa


async def make_script(
    llm: GroqClient | None,
    mode: str,
    language: Language,
    title: str,
    text: str,
    *,
    position: int,
    total: int,
    source_is_target_language: bool,
) -> ScriptResult:
    """Build the script for one section. Falls back to extractive output on any LLM problem."""
    use_llm = bool(llm and llm.enabled)
    if mode == "quiz":
        count = 3 if len(text) < 4000 else 4 if len(text) < 9000 else 5
        if use_llm:
            try:
                assert llm is not None
                return ScriptResult(qa=await _llm_quiz(llm, language, title, text, count), used_llm=True)
            except LLMError as exc:
                log.warning("LLM quiz failed for %r: %s", title, exc)
        pairs = extractive.cloze_questions(text, count)
        return ScriptResult(qa=[QA(q, a) for q, a in pairs])

    ratio = MODE_RATIO[mode]
    if mode == "translate":
        # No fallback: reading the untranslated text in another language's voice would be wrong.
        if not use_llm:
            raise LLMError("Translation needs the AI service, which is not available")
        assert llm is not None
        translated: list[str] = []
        position_rule = _position_rule(position, total, title, position == 0)
        for block in split_for_llm(text, TRANSLATE_BLOCK_CHARS):
            words = max(10, int(len(block.split()) * ratio))
            translated.append(await _llm_block(llm, mode, language, title, block, words, position_rule))
        return ScriptResult(text="\n\n".join(translated), used_llm=True)
    if use_llm:
        assert llm is not None
        try:
            parts: list[str] = []
            blocks = split_for_llm(text)
            position_rule = _position_rule(position, total, title, position == 0)
            for block in blocks:
                words = max(60, int(len(block.split()) * ratio))
                parts.append(await _llm_block(llm, mode, language, title, block, words, position_rule))
            return ScriptResult(text="\n\n".join(parts), used_llm=True)
        except LLMError as exc:
            log.warning("LLM %s failed for %r, using extractive fallback: %s", mode, title, exc)
    body = extractive.condense(text, ratio)
    if mode == "explain":
        body = f"Let's go through {title}.\n\n{body}"
    return ScriptResult(text=body)
