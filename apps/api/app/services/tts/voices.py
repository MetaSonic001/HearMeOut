"""Voice catalog loaded from a snapshot of the Edge neural voice list."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.services.languages import LANGUAGES, Language, get_language

_SNAPSHOT = Path(__file__).resolve().parents[2] / "data" / "voices.json"

# Voices that are reliably pleasant for long-form listening; shown first in the picker.
FEATURED = {
    "en-US-AvaNeural", "en-US-AndrewNeural", "en-US-EmmaNeural", "en-US-BrianNeural",
    "en-US-AriaNeural", "en-US-GuyNeural", "en-US-JennyNeural", "en-GB-SoniaNeural",
    "en-GB-RyanNeural", "en-GB-LibbyNeural", "en-IN-NeerjaNeural", "en-IN-PrabhatNeural",
    "en-AU-NatashaNeural", "es-ES-ElviraNeural", "es-MX-DaliaNeural", "fr-FR-DeniseNeural",
    "de-DE-KatjaNeural", "zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural",
}  # fmt: skip


# English had 29 voices, many of them duplicates (the "Multilingual" twins of Emma, Brian and Neerja are identical audio)
# or near-identical accents, which only made the picker hard to choose from. These stay resolvable by id, so existing
# documents keep playing and API calls that name them still work, but they are no longer offered in the picker.
RETIRED = frozenset({
    "en-US-EmmaMultilingualNeural", "en-US-BrianMultilingualNeural", "en-US-AndrewMultilingualNeural",
    "en-IN-NeerjaExpressiveNeural", "en-US-AvaNeural", "en-US-BrianNeural", "en-US-JennyNeural",
    "en-US-AnaNeural",  # child voice
    "en-GB-MaisieNeural",  # child voice
    "en-GB-ThomasNeural", "en-CA-ClaraNeural", "en-US-EricNeural", "en-US-ChristopherNeural",
    "en-US-MichelleNeural", "en-US-SteffanNeural",
})  # fmt: skip

EXPRESSIVE_HIGH = 4.3
EXPRESSIVE_MEDIUM = 3.3


@dataclass(frozen=True, slots=True)
class Voice:
    id: str
    locale: str
    gender: str
    name: str
    language: str  # our language code
    featured: bool
    # Pitch movement (semitone standard deviation) measured on a fixed emotive passage; None where not measured.
    expr: float | None = None

    @property
    def expressive(self) -> str | None:
        """high | medium | calm: how much the voice's pitch moves. A flat voice sounds robotic over a long listen."""
        if self.expr is None:
            return None
        return "high" if self.expr >= EXPRESSIVE_HIGH else "medium" if self.expr >= EXPRESSIVE_MEDIUM else "calm"

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "locale": self.locale,
            "gender": self.gender,
            "language": self.language,
            "featured": self.featured,
            "expressive": self.expressive,
        }


def _pretty_name(voice_id: str) -> str:
    raw = voice_id.split("-", 2)[2].removesuffix("Neural")
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", raw)
    return spaced.replace("Multilingual", "(Multilingual)").replace("Expressive", "(Expressive)")


@lru_cache
def _load() -> dict[str, Voice]:
    data = json.loads(_SNAPSHOT.read_text(encoding="utf-8"))
    locale_to_lang: dict[str, str] = {}
    for lang in LANGUAGES:
        for loc in lang.locales:
            locale_to_lang.setdefault(loc, lang.code)
    voices: dict[str, Voice] = {}
    for item in data:
        lang = locale_to_lang.get(item["locale"])
        if not lang:
            continue
        voices[item["id"]] = Voice(
            id=item["id"],
            locale=item["locale"],
            gender=item["gender"],
            name=_pretty_name(item["id"]),
            language=lang,
            featured=item["id"] in FEATURED
            or lang not in {"en", "es", "zh", "de", "fr"}
            or (item.get("expr") or 0) >= EXPRESSIVE_HIGH,
            expr=item.get("expr"),
        )
    return voices


def get_voice(voice_id: str) -> Voice | None:
    return _load().get(voice_id)


def voices_for_language(code: str) -> list[Voice]:
    items = [v for v in _load().values() if v.language == code and v.id not in RETIRED]
    if code == "hinglish":  # Hinglish is read by Indian-English voices
        items = [v for v in _load().values() if v.locale == "en-IN" and v.id not in RETIRED]
    return sorted(items, key=lambda v: (not v.featured, -(v.expr or 0), v.locale, v.gender != "Female", v.name))


def all_voices() -> list[Voice]:
    return list(_load().values())


def default_voices(lang: Language | str) -> tuple[str, str]:
    language = lang if isinstance(lang, Language) else get_language(lang)
    if language is None:
        language = LANGUAGES[0]
    voice, voice2 = language.voice, language.voice2
    catalog = _load()
    if voice not in catalog:
        fallback = next(iter(voices_for_language(language.code)), None)
        voice = fallback.id if fallback else "en-US-EmmaNeural"
    if voice2 not in catalog:
        voice2 = voice
    return voice, voice2
