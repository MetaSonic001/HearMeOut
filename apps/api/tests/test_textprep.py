from app.services.extract.types import Block
from app.services.textprep import clean_text, prepare_blocks


def test_removes_numeric_and_author_citations():
    assert clean_text("Sleep helps memory [12] and mood [3, 4].") == "Sleep helps memory and mood."
    assert clean_text("This was shown (Smith et al., 2020) in trials.") == "This was shown in trials."
    assert clean_text("Range citation [5–7] gone.") == "Range citation gone."


def test_removes_urls_ligatures_invisible_and_superscripts():
    assert clean_text("See https://example.com/a?b=1 now") == "See now"
    assert clean_text("eﬀect oﬃce ﬁle") == "effect office file"
    assert clean_text("soft­hyphen") == "softhyphen"
    assert clean_text("word¹ and² more") == "word and more"


def test_markdown_and_bullets():
    assert clean_text("## Heading") == "Heading"
    assert clean_text("**bold** and `code`") == "bold and code"
    assert clean_text("• first item\n• second item") == "first item. second item."


def test_unspeakable_text_dropped():
    assert clean_text("— — —") == ""
    assert clean_text("  \n ") == ""


def test_indic_text_untouched():
    text = "यह एक परीक्षण वाक्य है।"
    assert clean_text(text) == text


def test_prepare_blocks_drops_references_and_table_noise():
    blocks = [
        Block("h", "Introduction", 1),
        Block("p", "Real content that should stay in the audio narration.", 1),
        Block("p", "1 2 3 4 5 6 7 8", 1),
        Block("h", "References", 9),
        Block("p", "Smith, J. (2020). A paper. Journal.", 9),
        Block("h", "Appendix A", 10),
        Block("p", "Appendix content stays.", 10),
    ]
    out = prepare_blocks(blocks)
    assert [b.t for b in out] == [
        "Introduction",
        "Real content that should stay in the audio narration.",
        "Appendix A",
        "Appendix content stays.",
    ]


def test_include_references_keeps_them():
    blocks = [Block("h", "References", 9), Block("p", "Smith, J. (2020). A paper. Journal.", 9)]
    assert len(prepare_blocks(blocks, include_references=True)) == 2
