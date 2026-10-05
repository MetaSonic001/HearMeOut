"""TTS provider interface. Nothing outside services/tts imports a TTS library."""

from __future__ import annotations

from typing import Protocol


class TTSError(RuntimeError):
    """Synthesis failed after retries."""


class TTSProvider(Protocol):
    name: str

    async def synthesize(self, text: str, voice: str) -> bytes:
        """Return MP3 bytes (24 kHz mono, no ID3 tag) for `text` spoken by `voice`."""
        ...

    def supports(self, voice: str) -> bool: ...

    async def close(self) -> None: ...
