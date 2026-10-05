"""Public/config endpoints: health, config, voices, session, me, claim."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text

from app.deps import CurrentIdentity, State, rate_limit
from app.errors import ApiError
from app.services import tokens
from app.services.estimate import MODE_RATIO
from app.services.languages import LANGUAGES, get_language, language_for_voice
from app.services.plans import PLANS
from app.services.tts.base import TTSError
from app.services.tts.voices import get_voice, voices_for_language

router = APIRouter()

MODES = [
    {"id": "read", "label": "Read it to me", "description": "Every word, cleaned up for listening.", "ai": False},
    {"id": "translate", "label": "Translate and listen", "description": "Your document, translated word for word into another language, then read aloud.", "ai": True},
    {"id": "study", "label": "Study version", "description": "About a third of the length, all the key ideas.", "ai": True},
    {"id": "revision", "label": "Quick revision", "description": "The must-remember points, fast.", "ai": True},
    {"id": "explain", "label": "Explain it simply", "description": "A friendly teacher explains it, in your language.", "ai": True},
    {"id": "quiz", "label": "Quiz me", "description": "Questions with a pause to think, then the answer.", "ai": True},
]


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(state: State, response: Response) -> dict[str, object]:
    """Deep check for startup logs: can we reach the database, and which optional services are configured?"""
    response.headers["Cache-Control"] = "no-store"
    try:
        async with state.engine.connect() as conn:
            await conn.execute(text("select 1"))
        database = "ok"
    except Exception as exc:  # noqa: BLE001 - report, never crash a probe
        database = f"error: {type(exc).__name__}"
    settings = state.settings
    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "storage": settings.storage_backend,
        "auth": bool(settings.resolved_clerk_jwks_url),
        "llm": state.docs.llm_enabled,
        "ocr": state.ocr.available,
        "billing": settings.billing_enabled,
        "tts": settings.tts_provider,
    }


@router.get("/v1/config")
async def config(state: State, response: Response) -> dict[str, object]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return {
        "llm": state.docs.llm_enabled,
        "billing": state.settings.billing_enabled,
        "ocr": state.ocr.available,
        "modes": [{**m, "ratio": MODE_RATIO[str(m["id"])]} for m in MODES],
        "languages": [
            {
                "code": lang.code,
                "label": lang.label,
                "native": lang.native,
                "indian": lang.indian,
                "voice": lang.voice,
                "voice2": lang.voice2,
            }
            for lang in LANGUAGES
        ],
        "plans": {name: plan.as_dict() for name, plan in PLANS.items() if name != "admin"},
    }


@router.get("/v1/voices")
async def voices(language: str, response: Response) -> dict[str, object]:
    if get_language(language) is None:
        raise ApiError(404, "unknown_language", "That language is not supported.")
    response.headers["Cache-Control"] = "public, max-age=3600"
    return {"language": language, "voices": [v.as_dict() for v in voices_for_language(language)]}


@router.get("/v1/voices/{voice_id}/sample", dependencies=[Depends(rate_limit("sample", 40, 60))])
async def voice_sample(voice_id: str, state: State, language: str | None = None) -> Response:
    voice = get_voice(voice_id)
    if voice is None:
        raise ApiError(404, "unknown_voice", "That voice is not available.")
    lang = get_language(language or "") if language else language_for_voice(voice_id)
    if lang is None:
        raise ApiError(404, "unknown_language", "That language is not supported.")
    key = f"samples/{lang.code}/{voice_id}.mp3"
    try:
        if await state.storage.exists(key):
            data = await state.storage.get(key)
        else:
            data = await state.tts.synthesize(lang.sample, voice_id)
            await state.storage.put(key, data)
    except TTSError as exc:
        raise ApiError(503, "tts_unavailable", "Voices are busy right now. Try again in a moment.") from exc
    return Response(data, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})


@router.post("/v1/session", dependencies=[Depends(rate_limit("session", 30, 60))])
async def create_session(state: State) -> dict[str, str]:
    token, anon_id = tokens.issue_anon(state.settings.app_secret)
    return {"token": token, "anon_id": anon_id}


@router.get("/v1/me")
async def me(identity: CurrentIdentity, state: State) -> dict[str, object]:
    allowance = await state.quota.allowance(identity)
    user = await state.repo.get_user(identity.user_id) if identity.user_id else None
    feed_url = None
    if identity.user_id and identity.plan.has_feed:
        token = await state.repo.ensure_feed_token(identity.user_id)
        feed_url = f"{state.settings.api_public_url.rstrip('/')}/v1/feed/{token}.xml"
    return {
        "kind": identity.kind,
        "plan": identity.plan_name,
        "plan_label": identity.plan.label,
        "is_admin": identity.is_admin,
        "email": identity.email,
        "name": identity.name,
        "limits": identity.plan.as_dict(),
        "allowance": allowance.as_dict(),
        "plan_ends_at": user["plan_ends_at"].isoformat() if user and user.get("plan_ends_at") else None,
        "feed_url": feed_url,
        "billing": state.settings.billing_enabled,
    }


@router.post("/v1/claim")
async def claim(identity: CurrentIdentity, state: State) -> dict[str, int]:
    """After signing in, move this browser's guest documents into the account."""
    if identity.kind != "user" or not identity.alt_owner_key:
        return {"claimed": 0}
    count = await state.repo.claim_owner(identity.alt_owner_key, identity.owner_key)
    return {"claimed": count}

