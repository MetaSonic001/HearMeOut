"""Application state container created once in the lifespan and shared via `request.app.state`."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.db.repo import Repo
from app.services.auth import ClerkAuth
from app.services.billing import Billing
from app.services.documents import DocumentService
from app.services.llm.groq import GroqClient
from app.services.ocr import OcrService
from app.services.pipeline import Pipeline
from app.services.quota import Quota
from app.services.ratelimit import RateLimiter
from app.services.tts.base import TTSProvider
from app.storage.base import AudioStorage


@dataclass
class AppState:
    settings: Settings
    engine: AsyncEngine
    repo: Repo
    storage: AudioStorage
    tts: TTSProvider
    llm: GroqClient
    auth: ClerkAuth
    quota: Quota
    pipeline: Pipeline
    docs: DocumentService
    billing: Billing
    limiter: RateLimiter
    ocr: OcrService
