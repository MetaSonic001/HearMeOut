import time

import pytest

from app.services.ocr import Line, lines_to_text, mean_score, ocr_available, order_lines
from tests.helpers import make_blank_pdf, make_scanned_pdf


def L(text: str, x0: float, y0: float, x1: float, y1: float, score: float = 0.95) -> Line:
    return Line(text, score, x0, y0, x1, y1)


# ----------------------------------------------------------------- layout logic (no OCR engine needed)
def test_single_column_reads_top_to_bottom_with_paragraph_gaps():
    lines = [L("second paragraph", 100, 300, 900, 330), L("first line", 100, 100, 900, 130), L("second line", 100, 140, 900, 170)]
    assert lines_to_text(lines, 1000) == ["first line", "second line", "", "second paragraph"]


def test_two_columns_are_read_one_after_the_other():
    left = [L(f"left {i}", 80, 100 + i * 40, 460, 130 + i * 40) for i in range(5)]
    right = [L(f"right {i}", 540, 100 + i * 40, 920, 130 + i * 40) for i in range(5)]
    interleaved = [x for pair in zip(left, right, strict=True) for x in pair]
    ordered = [ln.text for ln in order_lines(interleaved, 1000)]
    assert ordered == [f"left {i}" for i in range(5)] + [f"right {i}" for i in range(5)]


def test_junk_fragments_are_dropped_and_scores_are_weighted_by_length():
    lines = [L("ok", 0, 0, 10, 10, 0.2), L("a long confident sentence here", 0, 20, 300, 40, 0.9)]
    assert lines_to_text(lines, 500) == ["a long confident sentence here"]
    assert mean_score([L("x", 0, 0, 1, 1, 0.1)]) == 0.0  # too little text to judge
    assert mean_score(lines) > 0.8


# ----------------------------------------------------------------- API behaviour
def test_scanned_pdf_over_the_plan_page_limit_is_refused_before_any_work(api):
    # a guest may have 15 scanned pages read, a signed-in free user 60
    guest = api.c.post("/v1/session").json()["token"]
    r = api.c.post("/v1/drafts/file", files={"file": ("big.pdf", make_blank_pdf(16), "application/pdf")}, headers={"X-Anon-Token": guest})
    assert r.status_code == 413
    body = r.json()["error"]
    assert body["code"] == "ocr_too_long" and body["details"]["max_pages"] == 15


def test_scanned_pdf_when_ocr_is_switched_off_explains_what_to_do(make_api):
    api = make_api(ocr_enabled=False)
    r = api.c.post("/v1/drafts/file", files={"file": ("scan.pdf", make_blank_pdf(3), "application/pdf")}, headers=api.user("alice"))
    assert r.status_code == 422 and r.json()["error"]["code"] == "scanned_pdf"
    assert api.c.get("/v1/config").json()["ocr"] is False


@pytest.mark.skipif(not ocr_available(), reason="OCR extra is not installed")
def test_scanned_pdf_is_read_in_the_background_then_becomes_a_normal_draft(api):
    alice = api.user("alice")
    r = api.c.post("/v1/drafts/file", files={"file": ("lecture notes.pdf", make_scanned_pdf(2), "application/pdf")}, headers=alice)
    assert r.status_code == 200, r.text
    started = r.json()
    assert started["status"] == "ocr" and started["ocr"]["total"] == 2 and started["sections"] == []

    # a draft that is still being read cannot be turned into audio yet
    early = api.c.post("/v1/docs", json={"draft_id": started["id"], "mode": "read"}, headers=alice)
    assert early.status_code in (409, 201)  # 201 only if OCR already finished on a fast machine

    deadline = time.time() + 120
    draft = started
    while time.time() < deadline and draft["status"] == "ocr":
        time.sleep(0.5)
        draft = api.c.get(f"/v1/drafts/{started['id']}", headers=alice).json()
    assert draft["status"] == "ready", draft
    assert draft["language"] == "en" and draft["page_count"] == 2 and draft["total_chars"] > 100
    assert any("OCR" in w for w in draft["warnings"])

    section = api.c.get(f"/v1/drafts/{draft['id']}/sections/0", headers=alice).json()
    assert "scheduler" in section["text"].lower() and "quantum" in section["text"].lower()

    doc = api.create(alice, draft["id"], mode="read")
    assert doc["status"] == "ready" and doc["total_chunks"] >= 1


@pytest.mark.skipif(not ocr_available(), reason="OCR extra is not installed")
def test_a_draft_still_being_read_blocks_audio_creation_and_other_users_cannot_see_it(api):
    alice = api.user("alice")
    r = api.c.post("/v1/drafts/file", files={"file": ("a.pdf", make_scanned_pdf(1), "application/pdf")}, headers=alice)
    draft_id = r.json()["id"]
    assert api.c.get(f"/v1/drafts/{draft_id}", headers=api.user("mallory")).status_code == 404


def test_short_low_confidence_lines_are_dropped_on_an_otherwise_clean_page():
    lines = [
        L("Ij3-hhh lhcjk", 100, 100, 500, 140, 0.67),
        L("a clean line of body text that was read with high confidence", 100, 200, 900, 230, 0.97),
        L("another clean line of body text, also read confidently here", 100, 240, 900, 270, 0.96),
        L("and a third clean line so the page is clearly well read", 100, 280, 900, 310, 0.95),
    ]
    text = lines_to_text(lines, 1000)
    assert "Ij3-hhh lhcjk" not in text and len(text) == 3
    # but on a poor scan nothing is thrown away: every word helps
    poor = [ln for ln in lines]
    for ln in poor:
        ln.score = 0.55
    assert len([t for t in lines_to_text(poor, 1000) if t]) == 4


@pytest.mark.skipif(not ocr_available(), reason="OCR extra is not installed")
def test_hindi_scan_is_detected_as_devanagari_and_read(tmp_path):
    import io
    from pathlib import Path

    from PIL import Image
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    from app.services.ocr import JobState, ocr_pages

    text_image = Image.open(Path(__file__).parent / "fixtures" / "hindi_scan_text.png").convert("RGB")
    page = Image.new("RGB", (1240, 1754), "white")
    page.paste(text_image, (60, 160))
    buf = io.BytesIO()
    pdf = canvas.Canvas(buf, pagesize=A4)
    for _ in range(2):
        pdf.drawImage(ImageReader(page), 0, 0, width=A4[0], height=A4[1])
        pdf.showPage()
    pdf.save()
    try:
        outcome = ocr_pages(buf.getvalue(), [0, 1], None, JobState(total=2))
    except Exception as exc:  # noqa: BLE001 - the Indian-script models download on first use
        pytest.skip(f"OCR model could not be prepared (offline?): {exc}")
    assert outcome.script == "devanagari"
    joined = " ".join(" ".join(lines) for lines in outcome.texts.values())
    assert "प्रतिक्रिया समय" in joined and "अगला" in joined
    assert "hhh" not in joined  # the garbled heading was dropped
