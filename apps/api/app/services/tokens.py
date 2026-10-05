"""Signed tokens: anonymous identity and short-lived audio playback tokens (HS256)."""

from __future__ import annotations

import hashlib
import secrets
import time

import jwt


class TokenError(Exception):
    pass


def _encode(secret: str, claims: dict[str, object]) -> str:
    return jwt.encode(claims, secret, algorithm="HS256")


def _decode(secret: str, token: str, typ: str) -> dict[str, object]:
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "typ"]})
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if claims.get("typ") != typ:
        raise TokenError("wrong token type")
    return claims


def new_anon_id() -> str:
    return secrets.token_urlsafe(12)


def issue_anon(secret: str, anon_id: str | None = None, days: int = 400) -> tuple[str, str]:
    anon_id = anon_id or new_anon_id()
    now = int(time.time())
    token = _encode(secret, {"typ": "anon", "sub": anon_id, "iat": now, "exp": now + days * 86400})
    return token, anon_id


def verify_anon(secret: str, token: str) -> str:
    claims = _decode(secret, token, "anon")
    return str(claims["sub"])


def owner_fingerprint(owner_key: str) -> str:
    return hashlib.sha256(owner_key.encode()).hexdigest()[:16]


def issue_playback(secret: str, doc_id: str, owner_key: str, minutes: int = 720) -> str:
    now = int(time.time())
    return _encode(
        secret,
        {"typ": "pb", "doc": doc_id, "own": owner_fingerprint(owner_key), "iat": now, "exp": now + minutes * 60},
    )


def verify_playback(secret: str, token: str, doc_id: str) -> str:
    """Return the owner fingerprint if the token is valid for this document."""
    claims = _decode(secret, token, "pb")
    if claims.get("doc") != doc_id:
        raise TokenError("token is for another document")
    return str(claims["own"])


def hash_ip(secret: str, ip: str) -> str:
    return hashlib.sha256(f"{secret}|{ip}".encode()).hexdigest()[:20]
