import os

os.environ["ENV_FILE"] = "does-not-exist.env"  # never read real credentials in tests
os.environ.setdefault("APP_SECRET", "test-secret-test-secret-test-secret")
os.environ.setdefault("ENVIRONMENT", "test")

import time  # noqa: E402
from collections.abc import Callable  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services import mp3  # noqa: E402
from app.services.auth import AuthError, ClerkUser  # noqa: E402
from app.services.llm.groq import GroqClient  # noqa: E402
from app.services.tts.voices import get_voice  # noqa: E402

CHARS_PER_SECOND = 15.0


class FakeTTS:
    """Deterministic provider: silent MP3 whose length is proportional to the text."""

    name = "fake"

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def supports(self, voice: str) -> bool:
        return get_voice(voice) is not None

    async def synthesize(self, text: str, voice: str) -> bytes:
        self.calls.append((voice, text))
        return mp3.silence(max(240, int(len(text) / CHARS_PER_SECOND * 1000)))

    async def close(self) -> None:
        return None


class FakeAuth:
    """Tokens look like 'user_alice'; 'user_admin' is the owner."""

    enabled = True

    def __init__(self, settings: Settings):
        self.settings = settings

    async def verify(self, token: str) -> str:
        if not token.startswith("user_"):
            raise AuthError("bad token")
        return token

    async def lookup(self, user_id: str) -> ClerkUser:
        return ClerkUser(user_id, f"{user_id}@test.dev", user_id.removeprefix("user_").title(), user_id == "user_admin")

    async def close(self) -> None:
        return None


class Api:
    """Thin test helper around TestClient with guest/user header handling."""

    def __init__(self, client: TestClient, tts: FakeTTS, app):  # type: ignore[no-untyped-def]
        self.c = client
        self.tts = tts
        self.app = app

    def guest(self) -> dict[str, str]:
        token = self.c.post("/v1/session").json()["token"]
        return {"X-Anon-Token": token}

    @staticmethod
    def user(name: str = "alice") -> dict[str, str]:
        return {"Authorization": f"Bearer user_{name}"}

    def draft(self, headers: dict[str, str], text: str, title: str | None = None) -> dict:
        r = self.c.post("/v1/drafts/text", json={"text": text, "title": title}, headers=headers)
        assert r.status_code == 200, r.text
        return r.json()

    def create(self, headers: dict[str, str], draft_id: str, **kw) -> dict:  # type: ignore[no-untyped-def]
        r = self.c.post("/v1/docs", json={"draft_id": draft_id, **kw}, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    def wait_ready(self, headers: dict[str, str], doc_id: str, timeout: float = 15.0) -> dict:
        end = time.time() + timeout
        while time.time() < end:
            doc = self.c.get(f"/v1/docs/{doc_id}", headers=headers).json()
            if doc["status"] in {"ready", "failed"}:
                return doc
            time.sleep(0.1)
        raise AssertionError("document did not become ready in time")


def long_text(paragraphs: int = 40) -> str:
    para = (
        "The kernel schedules processes fairly across the available processors. "
        "Each process receives a time slice before the scheduler preempts it. "
        "Interrupt handlers run quickly and defer longer work to later. "
        "Virtual memory gives every process its own private address space. "
    )
    return "\n\n".join(para * 2 for _ in range(paragraphs))


@pytest.fixture
def make_api(tmp_path) -> Callable[..., Api]:  # type: ignore[no-untyped-def]
    clients: list[TestClient] = []

    def factory(llm: GroqClient | None = None, **overrides) -> Api:  # type: ignore[no-untyped-def]
        settings = Settings(  # type: ignore[call-arg]
            _env_file=None,
            app_secret="test-secret-test-secret-test-secret",
            environment="test",
            database_url=f"sqlite+aiosqlite:///{tmp_path}/test-{len(clients)}.db",
            storage_backend="local",
            local_audio_dir=str(tmp_path / f"audio-{len(clients)}"),
            internal_api_secret="internal-secret",
            **overrides,
        )
        tts = FakeTTS()
        app = create_app(settings, tts=tts, llm=llm or GroqClient("", "m"), auth=FakeAuth(settings), background=False)
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        return Api(client, tts, app)

    yield factory
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def api(make_api: Callable[..., Api]) -> Api:
    return make_api()
