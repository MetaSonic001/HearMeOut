from app.config import Settings
from app.services.llm.groq import GroqClient, LLMError

__all__ = ["GroqClient", "LLMError", "build_llm"]


def build_llm(settings: Settings) -> GroqClient:
    return GroqClient(settings.groq_api_key, settings.groq_model, settings.groq_fallback_model)
