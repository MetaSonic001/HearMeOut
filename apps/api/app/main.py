"""FastAPI application factory."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.ext.asyncio import AsyncEngine
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import Settings, get_settings
from app.db.engine import make_engine
from app.db.init_db import init_db
from app.db.repo import Repo
from app.errors import install_error_handlers
from app.routers import admin, billing, docs, drafts, feed, public
from app.services.auth import ClerkAuth
from app.services.billing import Billing
from app.services.documents import DocumentService
from app.services.llm import build_llm
from app.services.llm.groq import GroqClient
from app.services.ocr import OcrService
from app.services.pipeline import Pipeline
from app.services.quota import Quota
from app.services.ratelimit import RateLimiter
from app.services.sweeper import sweep_forever
from app.services.tts import build_tts
from app.services.tts.base import TTSProvider
from app.state import AppState
from app.storage import build_storage
from app.storage.base import AudioStorage

log = logging.getLogger("hearmeout")


def configure_logging(level: str) -> None:
    """Make our own INFO logs visible next to uvicorn's access log (uvicorn only configures its own loggers)."""
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s: %(message)s"))
    for name in ("hearmeout", "app"):
        logger = logging.getLogger(name)
        logger.handlers = [handler]
        logger.setLevel(level.upper())
        logger.propagate = False
    logging.getLogger("RapidOCR").setLevel(logging.WARNING)


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response


def create_app(
    settings: Settings | None = None,
    *,
    engine: AsyncEngine | None = None,
    storage: AudioStorage | None = None,
    tts: TTSProvider | None = None,
    llm: GroqClient | None = None,
    auth: ClerkAuth | None = None,
    background: bool = True,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        for problem in settings.production_problems():
            log.warning("CONFIG: %s", problem)
        eng = engine or make_engine(settings.database_url)
        repo = Repo(eng)
        await init_db(eng)
        store = storage or build_storage(settings)
        await store.ensure_ready()
        provider = tts or build_tts(settings)
        model = llm or build_llm(settings)
        quota = Quota(repo)
        pipeline = Pipeline(repo, store, provider, model, quota, settings)
        app.state.hmo = AppState(
            settings=settings,
            engine=eng,
            repo=repo,
            storage=store,
            tts=provider,
            llm=model,
            auth=auth or ClerkAuth(settings),
            quota=quota,
            pipeline=pipeline,
            docs=DocumentService(repo, quota, pipeline, settings),
            billing=Billing(settings, repo),
            limiter=RateLimiter(),
            ocr=OcrService(repo, enabled=settings.ocr_enabled),
        )
        log.info(
            "Services: database=%s storage=%s tts=%s llm=%s ocr=%s billing=%s",
            eng.dialect.name, settings.storage_backend, provider.name, "groq" if model.enabled else "off",
            "on" if app.state.hmo.ocr.available else "off", "on" if settings.billing_enabled else "off",
        )
        sweeper: asyncio.Task[None] | None = None
        if background:
            await pipeline.resume_unfinished()
            sweeper = asyncio.create_task(sweep_forever(repo, store))
        try:
            yield
        finally:
            if sweeper:
                sweeper.cancel()
            await app.state.hmo.ocr.shutdown()
            await pipeline.shutdown()
            await app.state.hmo.auth.close()
            await app.state.hmo.billing.close()
            await model.close()
            await provider.close()
            await store.close()
            if engine is None:
                await eng.dispose()

    app = FastAPI(
        title="HearMeOut API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(SecurityHeaders)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Anon-Token"],
        expose_headers=["X-Duration-Ms", "Retry-After"],
        max_age=600,
    )
    install_error_handlers(app)
    app.include_router(public.router)
    app.include_router(drafts.router)
    app.include_router(docs.router)
    app.include_router(billing.router)
    app.include_router(admin.router)
    app.include_router(feed.router)
    return app
