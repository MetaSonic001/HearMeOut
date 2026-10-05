"""Edge TTS provider (free neural voices via the edge-tts open-source client)."""

from __future__ import annotations

import asyncio
import logging
import re

import edge_tts

from app.services import mp3
from app.services.tts.base import TTSError
from app.services.tts.voices import get_voice

log = logging.getLogger(__name__)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


class EdgeProvider:
    name = "edge"

    def __init__(self, concurrency: int = 4, timeout: float = 30.0, retries: int = 3):
        self._sem = asyncio.Semaphore(concurrency)
        self._timeout = timeout
        self._retries = retries

    def supports(self, voice: str) -> bool:
        return get_voice(voice) is not None

    async def _once(self, text: str, voice: str) -> bytes:
        audio = bytearray()
        async for part in edge_tts.Communicate(text, voice).stream():
            if part["type"] == "audio":
                audio.extend(part["data"])
        if not audio:
            raise TTSError("No audio received")
        return bytes(audio)

    async def synthesize(self, text: str, voice: str) -> bytes:
        text = _CONTROL_RE.sub(" ", text).strip()
        if not text:
            raise TTSError("Nothing to synthesize")
        last: Exception | None = None
        async with self._sem:
            for attempt in range(self._retries):
                try:
                    data = await asyncio.wait_for(self._once(text, voice), self._timeout)
                    data = mp3.strip_id3(data)
                    mp3.inspect(data)  # raises if the provider returned garbage
                    return data
                except Exception as exc:  # network, protocol and decoding failures all retry
                    last = exc
                    log.warning("Edge TTS attempt %d failed for %s: %r", attempt + 1, voice, exc)
                    await asyncio.sleep(0.6 * (2**attempt))
        raise TTSError(f"Edge TTS failed after {self._retries} attempts: {last!r}")

    async def close(self) -> None:
        return None
