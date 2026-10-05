import json

import httpx
import respx

from app.services.llm.groq import GROQ_URL, GroqClient
from tests.test_ai_modes import SOURCE, _completion

HINDI = (
    "यह शेड्यूलर ऑपरेटिंग सिस्टम का वह हिस्सा है जो तय करता है कि अगला प्रोसेस कौन सा चलेगा। "
    "राउंड रॉबिन में हर प्रोसेस को एक निश्चित समय मिलता है, जिसे क्वांटम कहते हैं।"
)
BODY = "\n\n".join([SOURCE] * 6)


@respx.mock
def test_translate_mode_translates_faithfully_and_speaks_in_the_target_language(make_api):
    route = respx.post(GROQ_URL).mock(return_value=_completion(HINDI))
    api = make_api(llm=GroqClient("k", "m"))
    alice = api.user("alice")
    draft = api.draft(alice, "# Scheduling\n\n" + BODY)
    doc = api.wait_ready(alice, api.create(alice, draft["id"], mode="translate", language="hi")["id"])
    assert doc["status"] == "ready" and doc["mode"] == "translate" and doc["language"] == "hi"
    assert doc["voice"].startswith("hi-IN")
    prompt = json.loads(route.calls[0].request.content)["messages"][1]["content"]
    assert "Translate the source completely" in prompt and "Hindi" in prompt and "Round robin" in prompt
    chunks = api.c.get(f"/v1/docs/{doc['id']}/chunks", headers=alice).json()["chunks"]
    assert chunks[0]["text"].startswith("यह शेड्यूलर")


@respx.mock
def test_translate_lets_the_listener_pick_any_voice_of_the_target_language(make_api):
    respx.post(GROQ_URL).mock(return_value=_completion(HINDI))
    api = make_api(llm=GroqClient("k", "m"))
    alice = api.user("alice")
    draft = api.draft(alice, BODY)
    doc = api.wait_ready(
        alice, api.create(alice, draft["id"], mode="translate", language="hi", voice="hi-IN-MadhurNeural")["id"]
    )
    assert doc["voice"] == "hi-IN-MadhurNeural"
    wrong = api.c.post(
        "/v1/docs",
        json={"draft_id": draft["id"], "mode": "translate", "language": "hi", "voice": "en-US-AvaNeural"},
        headers=alice,
    )
    assert wrong.status_code == 422 and wrong.json()["error"]["code"] == "voice_language_mismatch"


def test_translate_is_refused_without_the_ai_service_instead_of_pretending(api):
    alice = api.user("alice")
    draft = api.draft(alice, BODY)
    r = api.c.post("/v1/docs", json={"draft_id": draft["id"], "mode": "translate", "language": "hi"}, headers=alice)
    assert r.status_code == 503 and r.json()["error"]["code"] == "translation_unavailable"


def test_translating_into_the_same_language_is_refused(make_api):
    api = make_api(llm=GroqClient("k", "m"))
    alice = api.user("alice")
    draft = api.draft(alice, BODY)
    r = api.c.post("/v1/docs", json={"draft_id": draft["id"], "mode": "translate", "language": "en"}, headers=alice)
    assert r.status_code == 422 and r.json()["error"]["code"] == "same_language"


@respx.mock
def test_translation_outage_fails_clearly_and_never_reads_untranslated_text(make_api):
    respx.post(GROQ_URL).mock(return_value=httpx.Response(500))
    api = make_api(llm=GroqClient("k", "m", max_retries=1))
    alice = api.user("alice")
    draft = api.draft(alice, BODY)
    doc = api.wait_ready(alice, api.create(alice, draft["id"], mode="translate", language="hi")["id"])
    assert doc["status"] == "failed" and "AI service" in doc["error"]
    chunks = api.c.get(f"/v1/docs/{doc['id']}/chunks", headers=alice).json()["chunks"]
    assert chunks == []
