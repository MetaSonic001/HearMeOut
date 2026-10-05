"""Clerk session-token verification and user lookup."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

import httpx
import jwt
from jwt import PyJWKClient

from app.config import Settings


class AuthError(Exception):
    pass


@dataclass(slots=True)
class ClerkUser:
    id: str
    email: str | None
    name: str | None
    is_admin: bool


class ClerkAuth:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.enabled = bool(settings.resolved_clerk_jwks_url)
        self._jwks = (
            PyJWKClient(settings.resolved_clerk_jwks_url, cache_keys=True, lifespan=3600)
            if self.enabled
            else None
        )
        self._users: dict[str, tuple[float, ClerkUser]] = {}
        self._http = httpx.AsyncClient(timeout=10.0)

    def _verify_sync(self, token: str) -> dict[str, object]:
        assert self._jwks is not None
        try:
            key = self._jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self.settings.resolved_clerk_issuer,
                leeway=30,
                options={"require": ["exp", "sub", "iss"], "verify_aud": False},
            )
        except jwt.PyJWTError as exc:
            raise AuthError("Invalid session token") from exc
        azp = claims.get("azp")
        allowed = set(self.settings.cors_origin_list) | {self.settings.site_url.rstrip("/")}
        if azp and azp not in allowed:
            raise AuthError("Token was issued for another site")
        return claims

    async def verify(self, token: str) -> str:
        """Return the Clerk user id for a valid session token."""
        if not self.enabled:
            raise AuthError("Authentication is not configured")
        claims = await asyncio.to_thread(self._verify_sync, token)
        return str(claims["sub"])

    async def lookup(self, user_id: str) -> ClerkUser:
        """Fetch email/role via the Clerk Backend API (cached for 5 minutes)."""
        cached = self._users.get(user_id)
        now = time.time()
        if cached and now - cached[0] < 300:
            return cached[1]
        is_admin = user_id in self.settings.admin_ids
        email = name = None
        if self.settings.clerk_secret_key:
            try:
                resp = await self._http.get(
                    f"https://api.clerk.com/v1/users/{user_id}",
                    headers={"Authorization": f"Bearer {self.settings.clerk_secret_key}"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    primary = data.get("primary_email_address_id")
                    for addr in data.get("email_addresses", []):
                        if addr.get("id") == primary:
                            email = addr.get("email_address")
                    first, last = data.get("first_name") or "", data.get("last_name") or ""
                    name = f"{first} {last}".strip() or data.get("username")
                    is_admin = is_admin or (data.get("public_metadata") or {}).get("role") == "admin"
            except httpx.HTTPError:
                if cached:  # serve stale data rather than demoting an admin on a network blip
                    return cached[1]
        user = ClerkUser(id=user_id, email=email, name=name, is_admin=is_admin)
        self._users[user_id] = (now, user)
        return user

    async def close(self) -> None:
        await self._http.aclose()
