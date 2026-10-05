from app.config import Settings
from app.services.tts.base import TTSError, TTSProvider
from app.services.tts.edge import EdgeProvider

__all__ = ["TTSError", "TTSProvider", "EdgeProvider", "build_tts"]


def build_tts(settings: Settings) -> TTSProvider:
    return EdgeProvider(concurrency=settings.tts_concurrency)
