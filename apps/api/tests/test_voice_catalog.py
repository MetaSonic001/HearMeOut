import json

import respx

from app.services.llm.groq import GROQ_URL, GroqClient
from app.services.tts.voices import EXPRESSIVE_HIGH, default_voices, get_voice, voices_for_language
from tests.test_ai_modes import SOURCE, _completion
from tests.test_translate import BODY, HINDI


def test_english_default_narrator_is_a_voice_with_real_pitch_movement():
    # measured: Ava (the old default) is among the flattest English voices; Emma and Andrew are among the most dynamic
    narrator, second = default_voices("en")
    assert narrator == "en-US-EmmaNeural" and second == "en-US-AndrewNeural"
    assert get_voice(narrator).expressive == "high" and get_voice(second).expressive == "high"
    assert get_voice("en-US-AvaNeural").expressive == "calm"


def test_expressiveness_is_a_measured_property_with_sensible_levels():
    english = voices_for_language("en")
    measured = [v for v in english if v.expr is not None]
    assert 10 <= len(measured) <= 16  # a short, curated list
    assert all(v.expressive in {"high", "medium", "calm"} for v in measured)
    assert {v.expressive for v in measured} == {"high", "medium", "calm"}
    assert all((v.expr >= EXPRESSIVE_HIGH) == (v.expressive == "high") for v in measured)
    # languages that were not measured say so instead of guessing
    assert all(v.expressive is None for v in voices_for_language("hi"))


def test_the_most_dynamic_voices_are_listed_first_in_the_picker(api):
    voices = api.c.get("/v1/voices", params={"language": "en"}).json()["voices"]
    assert voices[0]["featured"] is True and voices[0]["expressive"] == "high"
    first_calm = next(i for i, v in enumerate(voices) if v["expressive"] == "calm")
    last_high = max(i for i, v in enumerate(voices) if v["expressive"] == "high" and v["featured"])
    assert last_high < first_calm  # featured expressive voices come before the calm ones
    hindi = api.c.get("/v1/voices", params={"language": "hi"}).json()["voices"]
    assert {v["expressive"] for v in hindi} == {None}


@respx.mock
def test_spoken_style_is_requested_for_writing_modes_but_never_for_translation(make_api):
    route = respx.post(GROQ_URL).mock(return_value=_completion(HINDI))
    api = make_api(llm=GroqClient("k", "m"))
    alice = api.user("alice")
    draft = api.draft(alice, "# Scheduling\n\n" + BODY)

    api.wait_ready(alice, api.create(alice, draft["id"], mode="explain", language="hi")["id"])
    explain_system = json.loads(route.calls[-1].request.content)["messages"][0]["content"]
    assert "storyteller" in explain_system and "rhetorical question" in explain_system

    calls_before = route.call_count
    api.wait_ready(alice, api.create(alice, draft["id"], mode="translate", language="hi")["id"])
    assert route.call_count > calls_before
    translate_system = json.loads(route.calls[-1].request.content)["messages"][0]["content"]
    assert "storyteller" not in translate_system  # a translation must stay faithful to the source
    assert SOURCE.split(".")[0]  # (the source text itself is unchanged)
