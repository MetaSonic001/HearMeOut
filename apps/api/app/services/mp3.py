"""Minimal MP3 utilities (no GPL dependencies): duration, silence, concatenation.

Edge TTS returns 24 kHz / 48 kbps mono MPEG-2 Layer III with no ID3 tags, and MP3
frames are self-contained, so independent chunks can be joined by simple byte
concatenation. These helpers keep that safe and measurable.
"""

from __future__ import annotations

from dataclasses import dataclass

_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
_SAMPLERATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}

# Silent frame matching Edge TTS output: MPEG-2 L3, 24 kHz, 48 kbps, mono, 144 bytes, 24 ms.
_SILENT_FRAME = bytes([0xFF, 0xF3, 0x64, 0xC4]) + bytes(140)
_SILENT_FRAME_MS = 24


@dataclass(frozen=True, slots=True)
class Mp3Info:
    frames: int
    duration_ms: int
    sample_rate: int


class Mp3Error(ValueError):
    pass


def _skip_id3(data: bytes) -> int:
    if data[:3] == b"ID3" and len(data) >= 10:
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        return 10 + size
    return 0


def _parse_header(data: bytes, pos: int) -> tuple[int, int, int] | None:
    """Return (frame_length, samples_per_frame, sample_rate) or None if not a valid header."""
    if pos + 4 > len(data):
        return None
    b1, b2, b3 = data[pos + 1], data[pos + 2], data[pos]
    if b3 != 0xFF or (b1 & 0xE0) != 0xE0:
        return None
    version = (b1 >> 3) & 0x03  # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    layer = (b1 >> 1) & 0x03  # 1 = Layer III
    if version == 1 or layer != 1:
        return None
    bitrate_idx = (b2 >> 4) & 0x0F
    sr_idx = (b2 >> 2) & 0x03
    if bitrate_idx in (0, 15) or sr_idx == 3:
        return None
    padding = (b2 >> 1) & 0x01
    if version == 3:
        bitrate = _BITRATES_V1_L3[bitrate_idx] * 1000
        samples = 1152
        sample_rate = _SAMPLERATES[3][sr_idx]
        length = 144 * bitrate // sample_rate + padding
    else:
        bitrate = _BITRATES_V2_L3[bitrate_idx] * 1000
        samples = 576
        sample_rate = _SAMPLERATES[version][sr_idx]
        length = 72 * bitrate // sample_rate + padding
    return length, samples, sample_rate


def inspect(data: bytes) -> Mp3Info:
    """Walk the frames and return exact duration. Raises Mp3Error for non-MP3 data."""
    pos = _skip_id3(data)
    frames = 0
    total_samples = 0
    rate = 0
    while pos < len(data):
        header = _parse_header(data, pos)
        if header is None:
            nxt = data.find(b"\xff", pos + 1)
            if nxt == -1:
                break
            pos = nxt
            continue
        length, samples, sample_rate = header
        if pos + length > len(data) + 1:
            break
        frames += 1
        total_samples += samples
        rate = rate or sample_rate
        pos += length
    if frames == 0:
        raise Mp3Error("No MP3 frames found")
    return Mp3Info(frames=frames, duration_ms=round(total_samples * 1000 / rate), sample_rate=rate)


def strip_id3(data: bytes) -> bytes:
    """Remove a leading ID3v2 tag so segments concatenate cleanly."""
    return data[_skip_id3(data) :]


def silence(ms: int) -> bytes:
    """Silent MP3 audio of roughly `ms` milliseconds, compatible with Edge TTS segments."""
    frames = max(1, round(ms / _SILENT_FRAME_MS))
    return _SILENT_FRAME * frames


def concat(parts: list[bytes]) -> bytes:
    return b"".join(strip_id3(p) for p in parts)
