from app.config import Settings


def make(**kw) -> Settings:
    return Settings(_env_file=None, app_secret="x" * 40, **kw)  # type: ignore[call-arg]


def test_no_warnings_outside_production() -> None:
    assert make(environment="development").production_problems() == []


def test_production_flags_localhost_and_dev_keys() -> None:
    problems = " | ".join(make(environment="production", clerk_publishable_key="pk_test_abc").production_problems())
    assert "SITE_URL" in problems and "CORS_ORIGINS" in problems and "SQLite" in problems
    assert "development keys" in problems


def test_production_clean_config_has_no_warnings() -> None:
    s = make(
        environment="production",
        site_url="https://hearmeout.app",
        api_public_url="https://api.hearmeout.app",
        cors_origins="https://hearmeout.app",
        internal_api_secret="s" * 20,
        database_url="postgresql+asyncpg://u:p@host:6543/db",
        storage_backend="supabase",
        supabase_secret_key="k",
        clerk_publishable_key="pk_live_abc",
        clerk_secret_key="sk_live_abc",
    )
    assert s.production_problems() == []


def test_payments_without_webhook_secret_is_flagged() -> None:
    s = make(environment="production", dodo_payments_api_key="k", dodo_environment="live_mode")
    assert any("DODO_WEBHOOK_SECRET" in p for p in s.production_problems())
