from app.services import mp3
from tests.conftest import long_text
from tests.helpers import make_docx, make_epub, make_pdf


def test_health_and_config(api):
    assert api.c.get("/healthz").json() == {"status": "ok"}
    cfg = api.c.get("/v1/config").json()
    assert cfg["llm"] is False and cfg["billing"] is False
    assert [m["id"] for m in cfg["modes"]] == ["read", "translate", "study", "revision", "explain", "quiz"]
    assert {"en", "hi", "hinglish", "mr", "ta"} <= {lang["code"] for lang in cfg["languages"]}
    assert cfg["plans"]["anon"]["daily_minutes"] == 20


def test_identity_is_required(api):
    r = api.c.post("/v1/drafts/text", json={"text": "hello world, this is text"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "identity_required"


def test_read_flow_end_to_end(api):
    h = api.guest()
    draft = api.draft(h, long_text(6), "Operating Systems")
    assert draft["title"] == "Operating Systems"
    assert draft["language"] == "en"
    assert draft["estimates"]["read"] > draft["estimates"]["study"] > draft["estimates"]["revision"]

    doc = api.create(h, draft["id"], mode="read")
    assert doc["status"] == "ready" and doc["total_chunks"] > 1
    chunks = api.c.get(f"/v1/docs/{doc['id']}/chunks", headers=h).json()["chunks"]
    assert len(chunks) == doc["total_chunks"]
    assert len(chunks[0]["text"]) < 420  # short first chunk = fast start

    r = api.c.get(f"/v1/docs/{doc['id']}/chunks/0/audio", headers=h)
    assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"
    assert int(r.headers["x-duration-ms"]) == mp3.inspect(r.content).duration_ms
    again = api.c.get(f"/v1/docs/{doc['id']}/chunks/0/audio", headers=h)
    first_text = chunks[0]["text"]
    assert again.content == r.content
    assert sum(1 for _, text in api.tts.calls if text == first_text) == 1  # second play came from cache

    api.c.post(f"/v1/docs/{doc['id']}/progress", json={"chunk": 1, "offset": 12.5}, headers=h)
    fresh = api.c.get(f"/v1/docs/{doc['id']}", headers=h).json()
    assert fresh["progress"] == {"chunk": 1, "offset": 12.5}
    assert fresh["ready_chunks"] >= 1
    listed = api.c.get("/v1/docs", headers=h).json()["documents"]
    assert [d["id"] for d in listed] == [doc["id"]]


def test_prefetch_warms_next_chunks(api):
    h = api.guest()
    doc = api.create(h, api.draft(h, long_text(8))["id"])
    api.c.get(f"/v1/docs/{doc['id']}/chunks/0/audio", headers=h)
    import time

    time.sleep(0.5)
    ready = api.c.get(f"/v1/docs/{doc['id']}", headers=h).json()["ready_chunks"]
    assert ready >= 2


def test_documents_are_private(api):
    a, b = api.guest(), api.guest()
    doc = api.create(a, api.draft(a, long_text(2))["id"])
    assert api.c.get(f"/v1/docs/{doc['id']}", headers=b).status_code == 404
    assert api.c.get(f"/v1/docs/{doc['id']}/chunks/0/audio", headers=b).status_code == 404
    assert api.c.delete(f"/v1/docs/{doc['id']}", headers=b).status_code == 404
    assert api.c.get("/v1/docs", headers=b).json()["documents"] == []
    # a draft cannot be rendered by someone else either
    draft = api.draft(a, long_text(1))
    r = api.c.post("/v1/docs", json={"draft_id": draft["id"]}, headers=b)
    assert r.status_code == 404


def test_guest_quota_blocks_after_twenty_minutes_but_cached_audio_still_plays(api):
    h = api.guest()
    doc = api.create(h, api.draft(h, long_text(60))["id"])  # ~ 29 minutes of fake audio
    assert doc["est_seconds"] > 1200
    seconds, blocked_at = 0.0, None
    for i in range(doc["total_chunks"]):
        r = api.c.get(f"/v1/docs/{doc['id']}/chunks/{i}/audio", headers=h)
        if r.status_code == 402:
            blocked_at = i
            body = r.json()["error"]
            assert body["code"] == "quota_exceeded"
            assert {"signup", "book", "pro"} <= set(body["details"]["options"])
            assert body["details"]["allowance"]["remaining_minutes"] == 0
            break
        assert r.status_code == 200
        seconds += int(r.headers["x-duration-ms"]) / 1000
    assert blocked_at is not None and 1180 <= seconds <= 1300
    assert api.c.get(f"/v1/docs/{doc['id']}/chunks/0/audio", headers=h).status_code == 200
    me = api.c.get("/v1/me", headers=h).json()
    assert me["plan"] == "anon" and me["allowance"]["remaining_minutes"] == 0


def test_free_account_has_more_time_and_admin_is_unlimited(api):
    alice, admin = api.user("alice"), api.user("admin")
    assert api.c.get("/v1/me", headers=alice).json()["limits"]["daily_minutes"] == 60
    me_admin = api.c.get("/v1/me", headers=admin).json()
    assert me_admin["is_admin"] and me_admin["plan"] == "admin" and me_admin["allowance"]["limit_minutes"] is None
    doc = api.create(admin, api.draft(admin, long_text(70))["id"])
    for i in range(doc["total_chunks"]):
        assert api.c.get(f"/v1/docs/{doc['id']}/chunks/{i}/audio", headers=admin).status_code == 200
    used = api.c.get("/v1/me", headers=admin).json()["allowance"]["used_minutes"]
    assert used == 0  # admin usage is never metered


def test_chunk_not_found_and_bad_index(api):
    h = api.guest()
    doc = api.create(h, api.draft(h, long_text(2))["id"])
    assert api.c.get(f"/v1/docs/{doc['id']}/chunks/9999/audio", headers=h).status_code == 404


def test_section_selection_and_editing(api):
    h = api.guest()
    text = "# Part One\n\n" + long_text(6) + "\n\n# Part Two\n\n" + long_text(6) + "\n\n# Part Three\n\n" + long_text(6)
    draft = api.draft(h, text, "Three Parts")
    assert [s["title"] for s in draft["sections"]] == ["Part One", "Part Two", "Part Three"]

    sec = api.c.get(f"/v1/drafts/{draft['id']}/sections/1", headers=h).json()
    assert "kernel schedules" in sec["text"]
    updated = api.c.put(
        f"/v1/drafts/{draft['id']}/sections/1",
        json={"title": "Part Two (edited)", "text": "Edited paragraph one is here.\n\nEdited paragraph two is here."},
        headers=h,
    ).json()
    assert updated["sections"][1]["title"] == "Part Two (edited)"
    assert updated["sections"][1]["chars"] < 100

    doc = api.create(h, draft["id"], sections=[1, 2])
    assert doc["total_sections"] == 2
    assert [s["title"] for s in doc["sections"]] == ["Part Two (edited)", "Part Three"]
    chunks = api.c.get(f"/v1/docs/{doc['id']}/chunks", headers=h).json()["chunks"]
    assert "Edited paragraph one" in chunks[0]["text"]
    assert api.c.post("/v1/docs", json={"draft_id": draft["id"], "sections": []}, headers=h).status_code == 422


def test_plan_character_limit_enforced(api):
    h = api.guest()
    draft = api.draft(h, long_text(420))  # > 150k chars guest limit
    r = api.c.post("/v1/docs", json={"draft_id": draft["id"]}, headers=h)
    assert r.status_code == 413 and r.json()["error"]["code"] == "too_long"
    alice = api.user("alice")
    draft2 = api.draft(alice, long_text(420))
    assert api.c.post("/v1/docs", json={"draft_id": draft2["id"]}, headers=alice).status_code == 201


def test_uploads_pdf_docx_epub(api):
    h = api.guest()
    for name, data, expected in (
        ("notes.pdf", make_pdf(5), 5),
        ("guide.docx", make_docx(), 2),
        ("novel.epub", make_epub(), 2),
    ):
        r = api.c.post("/v1/drafts/file", files={"file": (name, data)}, headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["sections"]) >= expected - 1, (name, body["sections"])
        assert body["total_chars"] > 500
    pdf = api.c.post("/v1/drafts/file", files={"file": ("notes.pdf", make_pdf(5))}, headers=h).json()
    assert pdf["page_count"] == 5 and pdf["sections"][0]["page_start"] == 1


def test_upload_errors(api):
    h = api.guest()
    r = api.c.post("/v1/drafts/file", files={"file": ("deck.pptx", b"nope")}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "unsupported"
    r = api.c.post("/v1/drafts/file", files={"file": ("big.txt", b"a" * (10 * 1024 * 1024 + 5))}, headers=h)
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"
    r = api.c.post("/v1/drafts/file", files={"file": ("empty.txt", b"")}, headers=h)
    assert r.status_code == 422
    r = api.c.post("/v1/drafts/text", json={"text": "   "}, headers=h)
    assert r.status_code == 422


def test_url_ssrf_is_rejected(api):
    h = api.guest()
    for url in ("http://127.0.0.1:8000/secret", "http://169.254.169.254/latest/meta-data", "http://localhost/"):
        r = api.c.post("/v1/drafts/url", json={"url": url}, headers=h)
        assert r.status_code == 422 and r.json()["error"]["code"] == "bad_url", url


def test_download_flow_requires_account(api):
    guest = api.guest()
    doc = api.create(guest, api.draft(guest, long_text(3))["id"])
    assert api.c.post(f"/v1/docs/{doc['id']}/render", headers=guest).status_code == 402
    assert api.c.get(f"/v1/docs/{doc['id']}/download-link", headers=guest).status_code == 402

    alice = api.user("alice")
    doc = api.create(alice, api.draft(alice, long_text(3))["id"])
    early = api.c.get(f"/v1/docs/{doc['id']}/download-link", headers=alice).json()["url"]
    assert api.c.get(early).status_code == 409  # not rendered yet
    assert api.c.post(f"/v1/docs/{doc['id']}/render", headers=alice).status_code == 202
    import time

    for _ in range(100):
        if api.c.get(f"/v1/docs/{doc['id']}", headers=alice).json()["ready_chunks"] == doc["total_chunks"]:
            break
        time.sleep(0.1)
    url = api.c.get(f"/v1/docs/{doc['id']}/download-link", headers=alice).json()["url"]
    r = api.c.get(url)
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    assert int(r.headers["content-length"]) == len(r.content)
    assert mp3.inspect(r.content).duration_ms > 10_000
    assert api.c.get(f"/v1/docs/{doc['id']}/download?pt=garbage").status_code == 403
    other = api.create(alice, api.draft(alice, long_text(2))["id"])
    assert api.c.get(f"/v1/docs/{other['id']}/download?pt={url.split('pt=')[1]}").status_code == 403


def test_claim_guest_documents_after_signin(api):
    guest = api.guest()
    doc = api.create(guest, api.draft(guest, long_text(2))["id"])
    both = {**guest, **api.user("carol")}
    assert api.c.get(f"/v1/docs/{doc['id']}", headers=both).status_code == 200  # still reachable
    assert api.c.post("/v1/claim", headers=both).json() == {"claimed": 1}
    only_user = api.user("carol")
    assert [d["id"] for d in api.c.get("/v1/docs", headers=only_user).json()["documents"]] == [doc["id"]]
    assert api.c.get(f"/v1/docs/{doc['id']}", headers=guest).status_code == 404


def test_rename_and_delete(api):
    h = api.guest()
    doc = api.create(h, api.draft(h, long_text(2))["id"])
    r = api.c.patch(f"/v1/docs/{doc['id']}", json={"title": "My notes"}, headers=h)
    assert r.json()["title"] == "My notes"
    assert api.c.delete(f"/v1/docs/{doc['id']}", headers=h).status_code == 204
    assert api.c.get(f"/v1/docs/{doc['id']}", headers=h).status_code == 404


def test_voices_and_samples(api):
    r = api.c.get("/v1/voices", params={"language": "hi"}).json()
    assert {v["id"] for v in r["voices"]} == {"hi-IN-SwaraNeural", "hi-IN-MadhurNeural"}
    assert any(v["id"].startswith("en-IN") for v in api.c.get("/v1/voices", params={"language": "hinglish"}).json()["voices"])
    assert api.c.get("/v1/voices", params={"language": "xx"}).status_code == 404
    sample = api.c.get("/v1/voices/hi-IN-SwaraNeural/sample")
    assert sample.status_code == 200 and mp3.inspect(sample.content).duration_ms > 0
    calls = len(api.tts.calls)
    api.c.get("/v1/voices/hi-IN-SwaraNeural/sample")
    assert len(api.tts.calls) == calls
    assert api.c.get("/v1/voices/nope-NOPE-Neural/sample").status_code == 404


def test_unknown_voice_and_language_rejected(api):
    h = api.guest()
    draft = api.draft(h, long_text(2))
    r = api.c.post("/v1/docs", json={"draft_id": draft["id"], "voice": "xx-YY-FakeNeural"}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "unknown_voice"


def test_hindi_text_is_detected_and_gets_hindi_voice(api):
    h = api.guest()
    draft = api.draft(h, "यह एक परीक्षण दस्तावेज़ है जिसे हिंदी में लिखा गया है। " * 30)
    assert draft["language"] == "hi"
    doc = api.create(h, draft["id"])
    assert doc["language"] == "hi" and doc["voice"] == "hi-IN-SwaraNeural"


def test_intake_rate_limit(api):
    h = api.guest()
    codes = [api.c.post("/v1/drafts/text", json={"text": "short but valid text here"}, headers=h).status_code for _ in range(22)]
    assert codes.count(429) >= 1 and codes[0] == 200


def test_sweeper_removes_expired_documents_and_orphaned_audio(api):
    import asyncio
    from datetime import timedelta

    from app.db.schema import utcnow
    from app.services.sweeper import sweep_once

    h = api.guest()
    doc = api.create(h, api.draft(h, long_text(2))["id"])
    api.c.get(f"/v1/docs/{doc['id']}/chunks/0/audio", headers=h)
    state = api.app.state.hmo

    async def run():
        await state.repo.update_document(doc["id"], expires_at=utcnow() - timedelta(minutes=1))
        removed = await sweep_once(state.repo, state.storage)
        assert removed["documents"] == 1
        # audio is kept for a grace period, then collected
        import sqlalchemy as sa

        from app.db import schema as t

        async with state.engine.begin() as conn:
            await conn.execute(sa.update(t.audio_objects).values(last_used_at=utcnow() - timedelta(hours=5)))
        removed = await sweep_once(state.repo, state.storage)
        assert removed["audio_objects"] >= 1

    asyncio.run(run())
    assert api.c.get(f"/v1/docs/{doc['id']}", headers=h).status_code == 404
