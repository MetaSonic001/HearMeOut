import pytest

from app.services.extract import ExtractionError, extract_bytes, extract_pasted
from app.services.extract.fetch import assert_public_url
from app.services.extract.html import extract_html
from app.services.extract.pdf import extract_pdf
from app.services.extract.text import parse_text
from app.services.outline import build_sections
from app.services.textprep import prepare_blocks
from tests.helpers import ARTICLE_HTML, make_docx, make_epub, make_pdf


def test_parse_text_headings_and_paragraphs():
    raw = "# Photosynthesis\n\nPlants make food from light.\nThey use chlorophyll.\n\n- Light\n- Water\n"
    out = parse_text(raw)
    kinds = [(b.k, b.t) for b in out.blocks]
    assert kinds[0] == ("h", "Photosynthesis")
    assert ("p", "Plants make food from light. They use chlorophyll.") in kinds
    assert ("p", "- Light") in kinds
    assert out.title == "Photosynthesis"


def test_parse_text_chapter_lines_are_headings():
    out = parse_text("CHAPTER 1\n\nIt begins here.\n\nChapter 2: Next\n\nIt continues.")
    assert [b.k for b in out.blocks] == ["h", "p", "h", "p"]


def test_empty_text_raises():
    with pytest.raises(ExtractionError) as err:
        parse_text("   \n\n  ")
    assert err.value.code == "empty"


def test_pdf_extraction_removes_headers_footers_and_uses_bookmarks():
    out = extract_pdf(make_pdf(pages=6), "os-notes.pdf")
    assert out.page_count == 6
    all_text = " ".join(b.t for b in out.blocks)
    assert "Operating Systems Notes" not in all_text  # running header removed
    headings = [b for b in out.blocks if b.k == "h"]
    assert [h.t for h in headings][:2] == ["Chapter 1: Topic number 1", "Chapter 2: Topic number 2"]
    assert headings[0].p == 1 and headings[1].p == 2
    paragraphs = [b for b in out.blocks if b.k == "p"]
    assert paragraphs and "scheduler decides" in paragraphs[0].t
    assert out.title == "os notes"
    # page numbers (bare digits) were stripped
    assert not any(b.t.strip().isdigit() for b in out.blocks)


def test_pdf_sections_and_cleaning_end_to_end():
    out = extract_pdf(make_pdf(pages=5))
    blocks = prepare_blocks(out.blocks)
    sections = build_sections(blocks, title=out.title, min_chars=500)
    assert len(sections) == 5
    assert sections[2].page_start == 3


def test_pdf_without_bookmarks_detects_chapter_headings():
    out = extract_pdf(make_pdf(pages=4, bookmarks=False))
    assert sum(1 for b in out.blocks if b.k == "h") >= 4


def test_garbage_pdf_is_a_friendly_error():
    with pytest.raises(ExtractionError) as err:
        extract_pdf(b"%PDF-1.4 this is not really a pdf")
    assert err.value.code == "invalid_pdf"


def test_blank_pdf_is_reported_as_scanned():
    import io

    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.showPage()
    c.showPage()
    c.save()
    with pytest.raises(ExtractionError) as err:
        extract_pdf(buf.getvalue())
    assert err.value.code == "scanned_pdf"


async def test_docx_extraction():
    out = await extract_bytes("guide.docx", make_docx())
    assert out.source_type == "docx"
    assert out.title == "Biology Revision Guide"
    assert [b.t for b in out.blocks if b.k == "h"][:3] == ["Biology Revision Guide", "Cells", "Genetics"]
    assert any("Mitochondria produce energy." == b.t for b in out.blocks)
    assert out.warnings and "table" in out.warnings[0]


async def test_epub_extraction():
    out = await extract_bytes("novel.epub", make_epub())
    assert out.title == "The Test Novel"
    assert [b.t for b in out.blocks if b.k == "h"] == ["Chapter 1", "Chapter 2"]


async def test_dispatch_text_and_html():
    out = await extract_bytes("notes.txt", b"Hello world. This is a note.")
    assert out.blocks[0].t.startswith("Hello world")
    out = await extract_bytes("page.html", ARTICLE_HTML.encode())
    assert "Why Sleep Matters" in out.title


async def test_unsupported_office_file():
    with pytest.raises(ExtractionError) as err:
        await extract_bytes("deck.pptx", b"not zip")
    assert err.value.code == "unsupported"


def test_html_article_extraction_drops_navigation():
    out = extract_html(ARTICLE_HTML, url="https://blog.example.com/sleep")
    text = " ".join(b.t for b in out.blocks)
    assert "Sleep is essential" in text
    assert "Copyright 2026" not in text
    assert out.source_type == "url"


async def test_pasted_text_title_override():
    out = await extract_pasted("Some pasted content here.", title="My note")
    assert out.title == "My note" and out.source_type == "paste"


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/admin",
        "http://127.0.0.1:8000/x",
        "http://169.254.169.254/latest/meta-data",
        "http://10.0.0.5/",
        "ftp://example.com/file",
        "file:///etc/passwd",
        "http://example.com:22/",
    ],
)
async def test_ssrf_guard_blocks_private_and_odd_urls(url):
    with pytest.raises(ExtractionError):
        await assert_public_url(url)
