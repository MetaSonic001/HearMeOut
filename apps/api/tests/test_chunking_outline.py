from app.services.chunking import MAX_LEN, chunk_blocks, chunk_script, split_sentences
from app.services.estimate import estimate_seconds
from app.services.extract.types import Block
from app.services.outline import build_sections


def test_split_sentences_respects_abbreviations_and_decimals():
    text = "Dr. Smith paid 3.5 dollars e.g. for tea. Mr. Rao agreed! Is it true? Yes."
    assert split_sentences(text) == [
        "Dr. Smith paid 3.5 dollars e.g. for tea.",
        "Mr. Rao agreed!",
        "Is it true?",
        "Yes.",
    ]


def test_split_sentences_hindi_danda():
    sentences = split_sentences("यह पहला वाक्य है। यह दूसरा वाक्य है। तीसरा?")
    assert len(sentences) == 3


def test_first_chunk_is_short_and_chunks_are_bounded():
    para = " ".join(f"Sentence number {i} talks about operating systems in detail." for i in range(80))
    blocks = [Block("p", para, 1)]
    chunks = chunk_blocks(blocks, 0, first_target=280)
    assert len(chunks[0].text) <= 340
    assert all(len(c.text) <= MAX_LEN for c in chunks)
    joined = " ".join(c.text for c in chunks)
    assert joined.replace(" ", "") == para.replace(" ", "")


def test_chunk_pages_tracked():
    blocks = [Block("p", "Alpha one. " * 40, 3), Block("p", "Beta two. " * 120, 4)]
    chunks = chunk_blocks(blocks, 0, first_target=None)
    assert chunks[0].page_start == 3
    assert chunks[-1].page_end == 4


def test_very_long_sentence_is_split():
    sentence = ("word, " * 600).strip(", ") + "."
    chunks = chunk_blocks([Block("p", sentence, 1)], 0)
    assert len(chunks) >= 2
    assert all(len(c.text) <= MAX_LEN for c in chunks)


def test_headings_become_spoken_sentences():
    chunks = chunk_blocks([Block("h", "Processes", 1), Block("p", "A process is a program.", 1)], 2)
    assert chunks[0].text.startswith("Processes. A process")
    assert chunks[0].section_idx == 2


def test_chunk_script_paragraphs():
    chunks = chunk_script("First para. More here.\n\nSecond para.", 1, page_start=5, page_end=7)
    assert chunks[0].page_start == 5 and chunks[0].page_end == 7
    assert "Second para." in " ".join(c.text for c in chunks)


def _doc(headings: int, per: int = 3000) -> list[Block]:
    blocks = []
    for i in range(headings):
        blocks.append(Block("h", f"Chapter {i + 1}", i * 2 + 1, 1))
        blocks.append(Block("p", "x" * per, i * 2 + 1))
    return blocks


def test_sections_follow_headings():
    sections = build_sections(_doc(4), title="Book")
    assert [s.title for s in sections] == ["Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4"]
    assert sections[0].page_start == 1


def test_leading_text_gets_document_title():
    blocks = [Block("p", "y" * 2000, 1)] + _doc(2)
    sections = build_sections(blocks, title="My Doc")
    assert sections[0].title == "My Doc"


def test_tiny_sections_are_merged():
    blocks = [Block("h", "A", 1), Block("p", "z" * 3000, 1), Block("h", "B", 2), Block("p", "short", 2)]
    sections = build_sections(blocks, title="T")
    assert len(sections) == 1


def test_no_headings_creates_parts_for_large_docs():
    blocks = [Block("p", "w" * 2000, i) for i in range(1, 40)]
    sections = build_sections(blocks, title="Flat")
    assert len(sections) >= 2
    assert sections[0].title == "Flat"
    assert "part 2" in sections[1].title
    assert sum(s.end - s.start for s in sections) == len(blocks)


def test_estimate_seconds_by_language():
    assert estimate_seconds(15500, "en") == 1000
    assert estimate_seconds(15500, "en", "revision") == 120
    assert estimate_seconds(1000, "xx") > 0


def test_unpunctuated_title_lines_get_a_pause():
    chunks = chunk_blocks([Block("p", "How memory works", 1), Block("p", "Memory is the brain's ability to store information.", 1)], 0)
    assert chunks[0].text.startswith("How memory works. Memory is")
