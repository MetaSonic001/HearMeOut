"""FastAPI dependencies: state, identity, rate limits, admin gate."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request

from app.errors import ApiError
from app.services import tokens
from app.services.analytics import track
from app.services.auth import AuthError
from app.services.identity import Identity, effective_plan
from app.state import AppState


def get_state(request: Request) -> AppState:
    return request.app.state.hmo  # type: ignore[no-any-return]


State = Annotated[AppState, Depends(get_state)]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _resolve(request: Request, state: AppState) -> Identity | None:
    ip_hash = tokens.hash_ip(state.settings.app_secret, client_ip(request))
    anon_header = request.headers.get("x-anon-token")
    anon_id: str | None = None
    if anon_header:
        try:
            anon_id = tokens.verify_anon(state.settings.app_secret, anon_header)
        except tokens.TokenError:
            anon_id = None

    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            user_id = await state.auth.verify(auth_header[7:].strip())
        except AuthError as exc:
            raise ApiError(401, "invalid_session", "Your session has expired. Please sign in again.") from exc
        clerk_user = await state.auth.lookup(user_id)
        row, created = await state.repo.upsert_user_seen(user_id, clerk_user.email)
        if created:
            await track(state.repo, "signup", user_id=user_id, anon_id=anon_id or user_id)
        return Identity(
            kind="user",
            owner_key=f"user:{user_id}",
            plan_name=effective_plan(row, clerk_user.is_admin),
            ip_hash=ip_hash,
            user_id=user_id,
            email=clerk_user.email,
            name=clerk_user.name,
            alt_owner_key=f"anon:{anon_id}" if anon_id else None,
        )
    if anon_id:
        return Identity(kind="anon", owner_key=f"anon:{anon_id}", plan_name="anon", ip_hash=ip_hash, anon_id=anon_id)
    return None


async def get_identity_optional(request: Request, state: State) -> Identity | None:
    return await _resolve(request, state)


async def get_identity(request: Request, state: State) -> Identity:
    identity = await _resolve(request, state)
    if identity is None:
        raise ApiError(401, "identity_required", "Start a session first (POST /v1/session).")
    return identity


CurrentIdentity = Annotated[Identity, Depends(get_identity)]
OptionalIdentity = Annotated[Identity | None, Depends(get_identity_optional)]


async def require_admin(identity: CurrentIdentity) -> Identity:
    if not identity.is_admin:
        raise ApiError(403, "forbidden", "This area is for the site owner.")
    return identity


AdminIdentity = Annotated[Identity, Depends(require_admin)]


def rate_limit(name: str, limit: int, window_seconds: float = 60.0) -> Callable[..., None]:
    def dependency(request: Request, state: State) -> None:
        ip = client_ip(request)
        wait = state.limiter.check(f"{name}:{ip}", limit, window_seconds)
        if wait > 0:
            raise ApiError(
                429, "rate_limited", "You are going a little fast. Please wait a moment and try again.", {"retry_after": round(wait)}
            )

    return dependency
