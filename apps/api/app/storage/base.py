"""Audio object storage interface (swap Supabase for R2/S3 without touching callers)."""

from __future__ import annotations

from typing import Protocol


class StorageError(RuntimeError):
    pass


class AudioStorage(Protocol):
    async def ensure_ready(self) -> None: ...

    async def put(self, key: str, data: bytes, content_type: str = "audio/mpeg") -> None: ...

    async def get(self, key: str) -> bytes: ...

    async def exists(self, key: str) -> bool: ...

    async def delete_many(self, keys: list[str]) -> None: ...

    async def close(self) -> None: ...
