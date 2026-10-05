import json

import httpx
import respx

from app.services.llm.extractive import cloze_questions, condense
from app.services.llm.groq import GROQ_URL, GroqClient, LLMError
from app.services.llm.scripts import _parse_quiz_json, split_for_llm
from tests.conftest import long_text

SOURCE = (
    "The scheduler is the part of the operating system that decides which process runs next. "
    "A good scheduler keeps the processor busy while keeping response times short. "
    "Round robin scheduling gives every process a fixed time slice, called a quantum. "
    "If the quantum is too small the system wastes time on context switches. "
    "If the quantum is too large the system feels unresponsive to interactive users. "
    "Priority scheduling runs the most important process first but can starve low priority work. "
    "Aging gradually raises the priority of waiting processes to prevent starvation. "
)


def _completion(text: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})


# ------------------------------------------------------------- extractive engine
def test_condense_respects_ratio_and_keeps_order():
    text = "\n\n".join([SOURCE] * 3)
    short = condense(text, 0.3)
    assert 0 < len(short) < len(text) * 0.5
    assert condense(text, 0.8).count("quantum") >= short.count("quantum")


def test_cloze_questions_have_blanks_and_answers():
    pairs = cloze_questions(SOURCE, 3)
    assert 1 <= len(pairs) <= 3
    for question, answer in pairs:
        assert "blank" in question and answer.startswith("The missing word is")


def test_split_for_llm_keeps_paragraphs_whole():
    text = "\n\n".join(["para " * 400] * 5)
    blocks = split_for_llm(text, max_chars=4500)
    assert len(blocks) >= 2 and all(len(b) <= 5000 for b in blocks)


def test_parse_quiz_json_variants():
    assert _parse_quiz_json('{"questions":[{"q":"A?","a":"B."}]}')[0].answer == "B."
    assert _parse_quiz_json('noise {"questions":[{"question":"A?","answer":"B."}]} noise')[0].question == "A?"
    assert _parse_quiz_json("not json") == []


# ----------------------------------------------------------- API without an LLM key
def test_ai_modes_work_without_llm_via_extractive_fallback(api):
    alice = api.user("alice")
    draft = api.draft(alice, "# Scheduling\n\n" + "\n\n".join([SOURCE] * 12) + "\n\n# Memory\n\n" + "\n\n".join([SOURCE] * 12))
    read = api.create(alice, draft["id"], mode="read")
    study = api.wait_ready(alice, api.create(alice, draft["id"], mode="study")["id"])
    revision = api.wait_ready(alice, api.create(alice, draft["id"], mode="revision")["id"])
    assert study["status"] == "ready" and revision["status"] == "ready"
    assert read["est_seconds"] > study["est_seconds"] > revision["est_seconds"]
    assert study["total_chunks"] >= 1 and [s["title"] for s in study["sections"]] == ["Scheduling", "Memory"]
    assert all(s["first_chunk"] is not None for s in study["sections"])
    first = api.c.get(f"/v1/docs/{study['id']}/chunks/0/audio", headers=alice)
    assert first.status_code == 200


def test_quiz_mode_has_questions_answers_and_think_time(api):
    alice = api.user("alice")
    draft = api.draft(alice, "# Scheduling\n\n" + "\n\n".join([SOURCE] * 10))
    quiz = api.wait_ready(alice, api.create(alice, draft["id"], mode="quiz")["id"])
    chunks = api.c.get(f"/v1/docs/{quiz['id']}/chunks", headers=alice).json()["chunks"]
    kinds = [c["kind"] for c in chunks]
    assert kinds[0] == "narration" and "question" in kinds and "answer" in kinds
    questions = [c for c in chunks if c["kind"] == "question"]
    assert all(c["pause_ms"] >= 3000 for c in questions)
    # question audio includes the baked-in silence for thinking time
    r = api.c.get(f"/v1/docs/{quiz['id']}/chunks/{questions[0]['idx']}/audio", headers=alice)
    assert int(r.headers["x-duration-ms"]) >= 3000
    # the answer is spoken by the second voice
    answer = next(c for c in chunks if c["kind"] == "answer")
    api.c.get(f"/v1/docs/{quiz['id']}/chunks/{answer['idx']}/audio", headers=alice)
    voice_for = {text: voice for voice, text in api.tts.calls}
    assert voice_for[answer["text"]] != voice_for[questions[0]["text"]]


def test_guest_gets_one_ai_document_then_a_clear_prompt(api):
    h = api.guest()
    draft = api.draft(h, "\n\n".join([SOURCE] * 10))
    api.create(h, draft["id"], mode="study")
    r = api.c.post("/v1/docs", json={"draft_id": draft["id"], "mode": "revision"}, headers=h)
    assert r.status_code == 402 and r.json()["error"]["code"] == "ai_limit"
    assert r.json()["error"]["details"]["upgrade"] == "signup"
    # reading is never blocked by the AI cap
    assert api.c.post("/v1/docs", json={"draft_id": draft["id"], "mode": "read"}, headers=h).status_code == 201


def test_free_account_gets_three_ai_documents(api):
    alice = api.user("alice")
    draft = api.draft(alice, "\n\n".join([SOURCE] * 10))
    for _ in range(3):
        api.create(alice, draft["id"], mode="study")
    assert api.c.post("/v1/docs", json={"draft_id": draft["id"], "mode": "study"}, headers=alice).status_code == 402


def test_translation_needs_llm_so_language_falls_back_to_source(api):
    alice = api.user("alice")
    draft = api.draft(alice, "\n\n".join([SOURCE] * 10))
    doc = api.create(alice, draft["id"], mode="explain", language="hi")
    assert doc["language"] == "en" and doc["voice"].startswith("en-")


# ----------------------------------------------------------------- Groq client
@respx.mock
async def test_groq_client_sends_expected_request_and_parses_reply():
    route = respx.post(GROQ_URL).mock(return_value=_completion("Hello there."))
    client = GroqClient("key-123", "model-a", "model-b")
    out = await client.complete("sys", "usr", max_tokens=50, json_mode=True)
    assert out == "Hello there."
    sent = json.loads(route.calls[0].request.content)
    assert sent["model"] == "model-a" and sent["response_format"] == {"type": "json_object"}
    assert sent["messages"][0] == {"role": "system", "content": "sys"}
    assert route.calls[0].request.headers["authorization"] == "Bearer key-123"
    await client.close()


@respx.mock
async def test_groq_retries_rate_limits_then_succeeds():
    route = respx.post(GROQ_URL).mock(
        side_effect=[httpx.Response(429, headers={"retry-after": "0"}), _completion("ok after retry")]
    )
    client = GroqClient("k", "m")
    assert await client.complete("s", "u") == "ok after retry"
    assert route.call_count == 2
    await client.close()


@respx.mock
async def test_groq_falls_back_to_second_model_on_failure():
    def handler(request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content)["model"]
        return httpx.Response(404, json={"error": "gone"}) if model == "dead" else _completion("from fallback")

    respx.post(GROQ_URL).mock(side_effect=handler)
    client = GroqClient("k", "dead", "alive")
    assert await client.complete("s", "u") == "from fallback"
    await client.close()


@respx.mock
async def test_groq_raises_llm_error_when_everything_fails():
    respx.post(GROQ_URL).mock(return_value=httpx.Response(500))
    client = GroqClient("k", "m", max_retries=2)
    try:
        await client.complete("s", "u")
        raise AssertionError("expected LLMError")
    except LLMError:
        pass
    await client.close()


# ----------------------------------------------- API with a (mocked) Groq key
@respx.mock
def test_study_mode_uses_groq_and_translates(make_api):
    route = respx.post(GROQ_URL).mock(
        return_value=_completion(
            "Yeh scheduler ka kaam hai ki kaunsa process pehle chalega. Round robin mein har process ko barabar time milta hai. "
            "Agar quantum bahut chhota ho to context switch mein time waste hota hai."
        )
    )
    api = make_api(llm=GroqClient("test-key", "m"))
    assert api.c.get("/v1/config").json()["llm"] is True
    alice = api.user("alice")
    draft = api.draft(alice, "# Scheduling\n\n" + "\n\n".join([SOURCE] * 4))
    doc = api.wait_ready(alice, api.create(alice, draft["id"], mode="study", language="hinglish")["id"])
    assert doc["status"] == "ready" and doc["language"] == "hinglish" and doc["voice"] == "en-IN-NeerjaNeural"
    prompt = json.loads(route.calls[0].request.content)["messages"]
    assert "Hinglish" in prompt[1]["content"] and "Roman letters" in prompt[1]["content"]
    assert "SOURCE:" in prompt[1]["content"] and "Round robin" in prompt[1]["content"]
    chunks = api.c.get(f"/v1/docs/{doc['id']}/chunks", headers=alice).json()["chunks"]
    assert "Yeh scheduler ka kaam" in chunks[0]["text"]


@respx.mock
def test_quiz_mode_with_groq_json(make_api):
    payload = {"questions": [{"q": "What does round robin give each process?", "a": "A fixed time slice called a quantum."}]}
    respx.post(GROQ_URL).mock(return_value=_completion(json.dumps(payload)))
    api = make_api(llm=GroqClient("k", "m"))
    alice = api.user("alice")
    draft = api.draft(alice, "# Scheduling\n\n" + "\n\n".join([SOURCE] * 4))
    quiz = api.wait_ready(alice, api.create(alice, draft["id"], mode="quiz")["id"])
    chunks = api.c.get(f"/v1/docs/{quiz['id']}/chunks", headers=alice).json()["chunks"]
    assert [c["kind"] for c in chunks] == ["narration", "question", "answer"]
    assert chunks[1]["text"].startswith("What does round robin")


@respx.mock
def test_groq_outage_degrades_to_extractive_instead_of_failing(make_api):
    respx.post(GROQ_URL).mock(return_value=httpx.Response(500))
    api = make_api(llm=GroqClient("k", "m", max_retries=1))
    alice = api.user("alice")
    draft = api.draft(alice, "# Scheduling\n\n" + "\n\n".join([SOURCE] * 6))
    doc = api.wait_ready(alice, api.create(alice, draft["id"], mode="revision")["id"])
    assert doc["status"] == "ready" and doc["total_chunks"] >= 1


def test_long_documents_script_every_section(api):
    alice = api.user("alice")
    text = "\n\n".join(f"# Chapter {i}\n\n" + long_text(5) for i in range(1, 6))
    draft = api.draft(alice, text)
    doc = api.wait_ready(alice, api.create(alice, draft["id"], mode="study")["id"])
    assert doc["scripted_sections"] == doc["total_sections"] == 5
    assert doc["total_chunks"] == sum(s["chunk_count"] for s in doc["sections"])
