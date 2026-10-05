"""GroqCloud client (OpenAI-compatible chat completions over httpx)."""

from __future__ import annotations

import asyncio
import logging

import httpx

log = logging.getLogger(__name__)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(RuntimeError):
    pass


class GroqClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        fallback_model: str = "",
        *,
        client: httpx.AsyncClient | None = None,
        concurrency: int = 2,
        max_retries: int = 4,
    ):
        self.api_key = api_key
        self.model = model
        self.fallback_model = fallback_model
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0))
        self._owns_client = client is None
        self._sem = asyncio.Semaphore(concurrency)
        self._max_retries = max_retries

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def complete(
        self,
        system: str,
        user: str,
        *,
        max_tokens: int = 2048,
        temperature: float = 0.3,
        json_mode: bool = False,
    ) -> str:
        if not self.enabled:
            raise LLMError("Groq is not configured")
        models = [self.model] + ([self.fallback_model] if self.fallback_model and self.fallback_model != self.model else [])
        last: Exception | None = None
        for model in models:
            try:
                return await self._complete_with(model, system, user, max_tokens, temperature, json_mode)
            except LLMError as exc:
                last = exc
                log.warning("Groq model %s failed: %s", model, exc)
        raise LLMError(str(last))

    async def _complete_with(
        self, model: str, system: str, user: str, max_tokens: int, temperature: float, json_mode: bool
    ) -> str:
        body: dict[str, object] = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        if model.startswith(("openai/gpt-oss", "qwen/")):
            # reasoning models: keep thinking short and leave room in the budget for the visible answer
            body["reasoning_effort"] = "low" if model.startswith("openai/") else "none"
            body["max_tokens"] = max_tokens + 800
            if model.startswith("openai/"):
                body["include_reasoning"] = False
        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with self._sem:
            for attempt in range(self._max_retries):
                try:
                    resp = await self._client.post(GROQ_URL, json=body, headers=headers)
                except httpx.HTTPError as exc:
                    if attempt == self._max_retries - 1:
                        raise LLMError(f"Groq request failed: {exc!r}") from exc
                    await asyncio.sleep(1.0 * 2**attempt)
                    continue
                if resp.status_code == 429 or resp.status_code >= 500:
                    if attempt == self._max_retries - 1:
                        raise LLMError(f"Groq busy ({resp.status_code})")
                    retry_after = resp.headers.get("retry-after")
                    delay = float(retry_after) if retry_after and retry_after.replace(".", "").isdigit() else 1.5 * 2**attempt
                    await asyncio.sleep(min(delay, 20.0))
                    continue
                if resp.status_code >= 400:
                    raise LLMError(f"Groq error {resp.status_code}: {resp.text[:200]}")
                try:
                    return str(resp.json()["choices"][0]["message"]["content"]).strip()
                except (KeyError, IndexError, ValueError) as exc:
                    raise LLMError("Groq returned an unexpected response") from exc
        raise LLMError("Groq request failed")

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()
