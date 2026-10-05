"""Application settings, loaded from environment variables / `.env`."""

from __future__ import annotations

import base64
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# One env file for the whole monorepo, at the repo root (apps/api/app/config.py -> parents[3]).
ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.environ.get("ENV_FILE", str(ROOT_ENV)), extra="ignore", case_sensitive=False
    )

    # runtime
    environment: Literal["development", "production", "test"] = "development"
    app_secret: str = Field(min_length=16)
    internal_api_secret: str = ""
    site_url: str = "http://localhost:3000"
    api_public_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    # database
    database_url: str = "sqlite+aiosqlite:///./.local.sqlite"

    # storage
    storage_backend: Literal["supabase", "local"] = "local"
    local_audio_dir: str = ".local-audio"
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_bucket: str = "audio"

    # auth (Clerk)
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    admin_user_ids: str = ""

    # LLM
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_fallback_model: str = "openai/gpt-oss-20b"

    # OCR for scanned PDFs (needs the optional `ocr` extra; switch off to save memory on small hosts)
    ocr_enabled: bool = True
    log_level: str = "INFO"

    # TTS
    tts_provider: Literal["edge"] = "edge"
    tts_concurrency: int = 4

    # payments
    dodo_payments_api_key: str = ""
    dodo_webhook_secret: str = ""
    dodo_environment: Literal["test_mode", "live_mode"] = "test_mode"
    dodo_product_pro_monthly: str = ""
    dodo_product_pro_yearly: str = ""
    dodo_product_book: str = ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def clerk_domain(self) -> str:
        """Frontend API domain encoded inside the Clerk publishable key."""
        key = self.clerk_publishable_key
        if not key:
            return ""
        try:
            encoded = key.split("_", 2)[2]
            encoded += "=" * (-len(encoded) % 4)
            return base64.b64decode(encoded).decode().rstrip("$")
        except (IndexError, ValueError):
            return ""

    @property
    def resolved_clerk_issuer(self) -> str:
        if self.clerk_issuer:
            return self.clerk_issuer.rstrip("/")
        return f"https://{self.clerk_domain}" if self.clerk_domain else ""

    @property
    def resolved_clerk_jwks_url(self) -> str:
        if self.clerk_jwks_url:
            return self.clerk_jwks_url
        issuer = self.resolved_clerk_issuer
        return f"{issuer}/.well-known/jwks.json" if issuer else ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_ids(self) -> set[str]:
        return {i.strip() for i in self.admin_user_ids.split(",") if i.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def production_problems(self) -> list[str]:
        """Misconfigurations that are fine on a laptop but wrong on a live site (logged at startup)."""
        if not self.is_production:
            return []
        problems: list[str] = []
        local = ("localhost", "127.0.0.1")
        if any(h in self.site_url for h in local):
            problems.append("SITE_URL still points at localhost")
        if any(h in self.api_public_url for h in local):
            problems.append("API_PUBLIC_URL still points at localhost (podcast feed links will break)")
        if not self.cors_origin_list or all(any(h in o for h in local) for o in self.cors_origin_list):
            problems.append("CORS_ORIGINS has no public origin: the website will be blocked from calling this API")
        if len(self.app_secret) < 32:
            problems.append("APP_SECRET is shorter than 32 characters")
        if not self.internal_api_secret:
            problems.append("INTERNAL_API_SECRET is empty: first-party analytics events will be rejected")
        if self.storage_backend != "supabase" or not self.supabase_secret_key:
            problems.append("audio storage is not Supabase: files vanish on every restart on free hosting")
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL is SQLite: data vanishes on every restart on free hosting")
        if not self.clerk_publishable_key or not self.clerk_secret_key:
            problems.append("Clerk keys missing: nobody can sign in")
        if self.clerk_publishable_key.startswith("pk_test_"):
            problems.append("Clerk is using development keys (pk_test_); switch to a production instance before launch")
        if self.billing_enabled and not self.dodo_webhook_secret:
            problems.append("DODO_PAYMENTS_API_KEY is set but DODO_WEBHOOK_SECRET is empty: payments cannot be confirmed")
        if self.billing_enabled and self.dodo_environment == "test_mode":
            problems.append("Dodo is in test_mode: no real money will be charged")
        return problems

    @property
    def llm_enabled(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def billing_enabled(self) -> bool:
        return bool(self.dodo_payments_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
