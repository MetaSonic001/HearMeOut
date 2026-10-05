"""Language detection (py3langid, BSD) restricted to the languages we can speak."""

from __future__ import annotations

from functools import lru_cache

import py3langid.langid as _langid

from app.services.languages import LANGUAGES

_SUPPORTED = [lang.code for lang in LANGUAGES if lang.code != "hinglish"]


@lru_cache
def _identifier() -> _langid.LanguageIdentifier:
    ident = _langid.LanguageIdentifier.from_modelpath(_langid.MODEL_DIR / _langid.MODEL_FILE, norm_probs=True)
    ident.set_languages(_SUPPORTED)
    return ident


def detect_language(text: str, default: str = "en") -> str:
    sample = " ".join(text.split())[:4000]
    if len(sample) < 20:
        return default
    lang, prob = _identifier().classify(sample)
    return lang if prob >= 0.55 else default
