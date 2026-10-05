"""Supabase Storage backend (private bucket, server-side secret key)."""

from __future__ import annotations

import httpx

from app.storage.base import StorageError


class SupabaseStorage:
    def __init__(self, url: str, secret_key: str, bucket: str = "audio"):
        self.bucket = bucket
        self.base = f"{url.rstrip('/')}/storage/v1"
        self.client = httpx.AsyncClient(
            headers={"apikey": secret_key},
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    async def ensure_ready(self) -> None:
        resp = await self.client.get(f"{self.base}/bucket/{self.bucket}")
        if resp.status_code == 200:
            return
        resp = await self.client.post(
            f"{self.base}/bucket",
            json={
                "id": self.bucket,
                "name": self.bucket,
                "public": False,
                "file_size_limit": 50 * 1024 * 1024,
                "allowed_mime_types": ["audio/mpeg"],
            },
        )
        if resp.status_code not in (200, 409):
            raise StorageError(f"Could not create bucket: {resp.status_code} {resp.text[:200]}")

    async def put(self, key: str, data: bytes, content_type: str = "audio/mpeg") -> None:
        resp = await self.client.post(
            f"{self.base}/object/{self.bucket}/{key}",
            content=data,
            headers={"Content-Type": content_type, "x-upsert": "true", "cache-control": "max-age=31536000"},
        )
        if resp.status_code >= 300:
            raise StorageError(f"Upload failed: {resp.status_code} {resp.text[:200]}")

    async def get(self, key: str) -> bytes:
        resp = await self.client.get(f"{self.base}/object/{self.bucket}/{key}")
        if resp.status_code == 404 or resp.status_code == 400:
            raise StorageError(f"Missing object {key}")
        if resp.status_code >= 300:
            raise StorageError(f"Download failed: {resp.status_code} {resp.text[:200]}")
        return resp.content

    async def exists(self, key: str) -> bool:
        resp = await self.client.head(f"{self.base}/object/{self.bucket}/{key}")
        return resp.status_code == 200

    async def delete_many(self, keys: list[str]) -> None:
        for start in range(0, len(keys), 100):
            batch = keys[start : start + 100]
            resp = await self.client.request("DELETE", f"{self.base}/object/{self.bucket}", json={"prefixes": batch})
            if resp.status_code >= 300:
                raise StorageError(f"Delete failed: {resp.status_code} {resp.text[:200]}")

    async def close(self) -> None:
        await self.client.aclose()
