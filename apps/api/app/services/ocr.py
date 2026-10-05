"""OCR for scanned PDFs.

Engine: RapidOCR (Apache-2.0) running PaddleOCR models through ONNX Runtime: pure pip, no system packages.
A bundled multilingual model reads English and other Latin-script text; Devanagari (Hindi, Marathi),
Tamil, Telugu and Kannada use dedicated recognition models that are downloaded on first use.

A scan can take minutes, so reading runs as a background job per draft. The upload returns at once with
`status = "ocr"`, the web app polls progress, and the draft becomes `ready` when the text is built.
"""

from __future__ import annotations

import asyncio
import gc
import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

import pypdfium2 as pdfium

from app.db.repo import Repo
from app.db.schema import utcnow
from app.services.extract.pdf import extract_pdf
from app.services.extract.types import ExtractionError

log = logging.getLogger(__name__)

SCRIPTS = ("latin", "devanagari", "ta", "te", "kn")
# document language -> OCR script (what the person picks on upload)
LANGUAGE_TO_SCRIPT = {
    "en": "latin", "hinglish": "latin", "latin": "latin",
    "hi": "devanagari", "mr": "devanagari", "ne": "devanagari", "devanagari": "devanagari",
    "ta": "ta", "te": "te", "kn": "kn",
}  # fmt: skip
ACCEPT_SCORE = 0.85  # a script whose probe score reaches this is used without trying the others
MIN_PROBE_CHARS = 20
JUNK_SCORE = 0.7
JUNK_MAX_CHARS = 40
RENDER_WIDTH_PX = 1500  # about 150 dpi on A4: where we start
# The models read text best when a line is about this many pixels tall; pages are rescaled to land near it.
TARGET_LINE_PX = 25.0
LINE_PX_BAND = (20.0, 30.0)  # no rescaling needed inside this band
DRAFT_TTL = timedelta(hours=6)

_availability: bool | None = None


def ocr_available() -> bool:
    """True when the optional OCR dependencies are installed."""
    global _availability
    if _availability is None:
        try:
            import onnxruntime  # noqa: F401
            import rapidocr  # noqa: F401

            _availability = True
        except Exception:  # noqa: BLE001 - any import problem means "not available"
            _availability = False
    return _availability


@dataclass(slots=True)
class Line:
    text: str
    score: float
    x0: float
    y0: float
    x1: float
    y1: float


@dataclass(slots=True)
class JobState:
    total: int
    done: int = 0
    stage: str = "queued"  # queued | detecting | reading | building
    script: str | None = None
    cancel: bool = False
    started: float = field(default_factory=time.monotonic)

    def as_dict(self) -> dict[str, Any]:
        return {
            "stage": self.stage,
            "done": self.done,
            "total": self.total,
            "script": self.script,
            "seconds": round(time.monotonic() - self.started),
        }


@dataclass(slots=True)
class OcrOutcome:
    texts: dict[int, list[str]]
    script: str
    mean_score: float


# ----------------------------------------------------------------------------- page layout


def order_lines(lines: list[Line], page_width: float) -> list[Line]:
    """Reading order: top to bottom, or column by column when the page has two columns."""
    if len(lines) < 8:
        return sorted(lines, key=lambda ln: (ln.y0, ln.x0))
    mid = page_width / 2
    spanning = [ln for ln in lines if ln.x0 < mid * 0.92 and ln.x1 > mid * 1.08]
    left = [ln for ln in lines if (ln.x0 + ln.x1) / 2 < mid]
    right = [ln for ln in lines if (ln.x0 + ln.x1) / 2 >= mid]
    two_columns = len(spanning) <= len(lines) * 0.1 and min(len(left), len(right)) >= len(lines) * 0.3
    if not two_columns:
        return sorted(lines, key=lambda ln: (ln.y0, ln.x0))
    return sorted(left, key=lambda ln: ln.y0) + sorted(right, key=lambda ln: ln.y0)


def lines_to_text(lines: list[Line], page_width: float) -> list[str]:
    """Text lines for one page, with a blank line wherever the vertical gap says a paragraph ended."""
    kept = [ln for ln in lines if ln.text.strip() and not (ln.score < 0.35 and len(ln.text.strip()) <= 3)]
    if not kept:
        return []
    # On a page that is otherwise read confidently, a short low-confidence line is almost always junk (a stylised
    # heading, a stamp, a smudge). Reading junk aloud is worse than skipping it.
    scores = sorted(ln.score for ln in kept)
    if len(kept) >= 3 and scores[len(scores) // 2] >= 0.85:
        kept = [ln for ln in kept if not (ln.score < JUNK_SCORE and len(ln.text.strip()) < JUNK_MAX_CHARS)]
        if not kept:
            return []
    ordered = order_lines(kept, page_width)
    heights = sorted(max(ln.y1 - ln.y0, 1.0) for ln in ordered)
    typical = heights[len(heights) // 2]
    out: list[str] = []
    prev: Line | None = None
    for ln in ordered:
        if prev is not None and ln.y0 >= prev.y0:  # within a column; a column switch goes back up the page
            if ln.y0 - prev.y1 > typical * 1.1:
                out.append("")
        elif prev is not None:
            out.append("")
        out.append(ln.text.strip())
        prev = ln
    return out


def _lines_from_result(result: Any) -> list[Line]:
    boxes = getattr(result, "boxes", None)
    texts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)
    if boxes is None or texts is None or len(texts) == 0:
        return []
    lines: list[Line] = []
    for box, text, score in zip(boxes, texts, scores or [1.0] * len(texts), strict=False):
        xs = [float(p[0]) for p in box]
        ys = [float(p[1]) for p in box]
        lines.append(Line(str(text), float(score), min(xs), min(ys), max(xs), max(ys)))
    return lines


def mean_score(lines: list[Line]) -> float:
    """Confidence weighted by how much text each line holds; 0 when there is too little text to judge."""
    chars = sum(len(ln.text) for ln in lines)
    if chars < MIN_PROBE_CHARS:
        return 0.0
    return sum(ln.score * len(ln.text) for ln in lines) / chars


# ----------------------------------------------------------------------------- engines


class _Engines:
    """RapidOCR engines per script, built on demand. At most two stay loaded to bound memory."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._engines: dict[str, Any] = {}

    def get(self, script: str) -> Any:
        with self._lock:
            if script in self._engines:
                self._engines[script] = self._engines.pop(script)  # most recently used goes last
                return self._engines[script]
            engine = self._build(script)
            self._engines[script] = engine
            while len(self._engines) > 2:
                self._engines.pop(next(iter(self._engines)))
            return engine

    def trim(self) -> None:
        with self._lock:
            while len(self._engines) > 1:
                self._engines.pop(next(iter(self._engines)))
        gc.collect()

    @staticmethod
    def _build(script: str) -> Any:
        from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR

        started = time.monotonic()
        if script == "latin":
            engine = RapidOCR()  # bundled multilingual model: nothing to download
        else:
            lang, version = {
                "devanagari": (LangRec.DEVANAGARI, OCRVersion.PPOCRV5),
                "ta": (LangRec.TA, OCRVersion.PPOCRV5),
                "te": (LangRec.TE, OCRVersion.PPOCRV5),
                "kn": (LangRec.KA, OCRVersion.PPOCRV4),
            }[script]
            engine = RapidOCR(params={"Rec.lang_type": lang, "Rec.ocr_version": version, "Rec.model_type": ModelType.MOBILE})
        log.info("OCR engine ready: script=%s (%.1fs)", script, time.monotonic() - started)
        return engine


_engines = _Engines()


def _render(pdf: pdfium.PdfDocument, index: int) -> Any:
    """Render one page to a BGR numpy array at a size the models read well."""
    import numpy as np

    page = pdf[index]
    try:
        width_pt, _ = page.get_size()
        scale = max(1.4, min(3.0, RENDER_WIDTH_PX / max(width_pt, 1.0)))
        image = page.render(scale=scale).to_pil().convert("RGB")
    finally:
        page.close()
    return np.asarray(image)[:, :, ::-1].copy()


def line_height(engine: Any, image: Any) -> float | None:
    """Median text-line height in pixels, from a detection-only pass (a copy: the engine may modify its input)."""
    result = engine(image.copy(), use_det=True, use_cls=False, use_rec=False)
    boxes = getattr(result, "boxes", None)
    if boxes is None or len(boxes) == 0:
        return None
    heights = sorted(float(max(p[1] for p in box) - min(p[1] for p in box)) for box in boxes)
    return heights[len(heights) // 2]


def scale_for(engine: Any, image: Any) -> float:
    """How much to resize a page so its text lands near the size the models read best (1.0 = leave it)."""
    height = line_height(engine, image)
    if height is None or LINE_PX_BAND[0] <= height <= LINE_PX_BAND[1]:
        return 1.0
    return max(0.35, min(2.0, TARGET_LINE_PX / height))


def _recognise(engine: Any, image: Any, factor: float = 1.0) -> list[Line]:
    """Read a page at the given scale; returned coordinates are in the original image's pixels."""
    if abs(factor - 1.0) > 0.02:
        import cv2

        image = cv2.resize(image, None, fx=factor, fy=factor, interpolation=cv2.INTER_AREA if factor < 1 else cv2.INTER_CUBIC)
    # always spell out the steps: a detection-only call earlier leaves those switches off on the engine
    result = engine(image.copy(), use_det=True, use_cls=True, use_rec=True)
    lines = _lines_from_result(result)
    if abs(factor - 1.0) > 0.02:
        for ln in lines:
            ln.x0, ln.y0, ln.x1, ln.y1 = ln.x0 / factor, ln.y0 / factor, ln.x1 / factor, ln.y1 / factor
    return lines


def _probe_pages(pages: list[int]) -> list[int]:
    if len(pages) <= 2:
        return pages[:]
    return [pages[1], pages[len(pages) // 2]]


def choose_script(pdf: pdfium.PdfDocument, pages: list[int], state: JobState) -> tuple[str, float]:
    """Pick the script whose model reads a couple of sample pages with the highest confidence."""
    sample = _probe_pages(pages)
    images: dict[int, Any] = {}  # rendered sample pages and their rescale factors, shared by every script tried
    factors: dict[int, float] = {}
    best, best_score = "latin", -1.0
    for script in SCRIPTS:
        if script in {"ta", "te", "kn"} and best_score >= 0.8:
            break
        engine = _engines.get(script)
        scores = []
        for index in sample:
            image = images.setdefault(index, _render(pdf, index))
            factors.setdefault(index, scale_for(engine, image))
            scores.append(mean_score(_recognise(engine, image, factors[index])))
        score = sum(scores) / len(scores)
        log.info("OCR probe: script=%s score=%.2f", script, score)
        if score > best_score:
            best, best_score = script, score
        if script == "latin" and score >= ACCEPT_SCORE:
            break
        if script == "devanagari" and score >= ACCEPT_SCORE:
            break
    return best, max(best_score, 0.0)


def ocr_pages(data: bytes, pages: list[int], script: str | None, state: JobState) -> OcrOutcome:
    """Blocking: read the given 0-based pages. Runs in a worker thread."""
    pdf = pdfium.PdfDocument(data)
    try:
        state.stage = "detecting"
        if script is None:
            script, probe_score = choose_script(pdf, pages, state)
        else:
            probe_score = 0.0
        state.script = script
        state.stage = "reading"
        engine = _engines.get(script)
        texts: dict[int, list[str]] = {}
        scores: list[float] = []
        for n, index in enumerate(pages):
            if state.cancel:
                raise RuntimeError("OCR cancelled")
            image = _render(pdf, index)
            lines = _recognise(engine, image, scale_for(engine, image))
            texts[index] = lines_to_text(lines, float(image.shape[1]))
            if lines:
                scores.append(mean_score(lines) or probe_score)
            state.done = n + 1
        average = sum(scores) / len(scores) if scores else 0.0
        return OcrOutcome(texts, script, average)
    finally:
        pdf.close()
        _engines.trim()


def prefetch_models() -> None:
    """Download the recognition models now (used at build time so the first scan is not slow)."""
    for script in SCRIPTS:
        try:
            _engines.get(script)
        except Exception as exc:  # noqa: BLE001
            log.warning("Could not prepare OCR model %s: %s", script, exc)
    _engines.trim()


# ----------------------------------------------------------------------------- background jobs


class OcrService:
    def __init__(self, repo: Repo, *, enabled: bool = True):
        self.repo = repo
        self.enabled = enabled
        self._slot = asyncio.Semaphore(1)  # one scan at a time: OCR is CPU- and memory-hungry
        self._jobs: dict[str, JobState] = {}
        self._tasks: set[asyncio.Task[None]] = set()

    @property
    def available(self) -> bool:
        return self.enabled and ocr_available()

    def progress(self, draft_id: str) -> dict[str, Any] | None:
        job = self._jobs.get(draft_id)
        if job is None:
            return None
        data = job.as_dict()
        data["queued"] = job.stage == "queued"
        return data

    def start(
        self,
        draft_id: str,
        owner_key: str,
        data: bytes,
        filename: str,
        pages: list[int],
        language_hint: str | None,
        title: str | None,
    ) -> None:
        script = LANGUAGE_TO_SCRIPT.get((language_hint or "").lower())
        self._jobs[draft_id] = JobState(total=len(pages))
        task = asyncio.create_task(self._run(draft_id, owner_key, data, filename, pages, script, title))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        log.info("OCR queued: draft=%s pages=%d script=%s", draft_id, len(pages), script or "auto")

    async def _fail(self, draft_id: str, message: str) -> None:
        await self.repo.update_draft(draft_id, status="failed", error=message[:300], progress=None)

    async def _run(
        self, draft_id: str, owner_key: str, data: bytes, filename: str, pages: list[int], script: str | None, title: str | None
    ) -> None:
        from app.services.documents import (
            build_draft_row,  # local import: documents imports the extractors
        )

        state = self._jobs[draft_id]
        try:
            async with self._slot:
                started = time.monotonic()
                state.stage = "detecting"
                outcome = await asyncio.to_thread(ocr_pages, data, pages, script, state)
                state.stage = "building"
                extracted = await asyncio.to_thread(extract_pdf, data, filename, ocr_texts=outcome.texts)
                if title:
                    extracted.title = title.strip()[:140]
                if outcome.mean_score and outcome.mean_score < 0.6:
                    extracted.warnings.append(
                        "The scan is hard to read (blurry, skewed or low resolution), so expect more mistakes. "
                        "A sharper scan gives better audio."
                    )
                row = build_draft_row(extracted, owner_key)
                await self.repo.update_draft(
                    draft_id,
                    title=row["title"],
                    language=row["language"],
                    page_count=row["page_count"],
                    total_chars=row["total_chars"],
                    sections=row["sections"],
                    warnings=row["warnings"],
                    status="ready",
                    progress=None,
                    error=None,
                    expires_at=utcnow() + DRAFT_TTL,
                )
                log.info(
                    "OCR done: draft=%s pages=%d script=%s confidence=%.2f in %.1fs",
                    draft_id, len(pages), outcome.script, outcome.mean_score, time.monotonic() - started,
                )
        except ExtractionError as exc:
            log.warning("OCR draft %s could not be built: %s", draft_id, exc.message)
            await self._fail(draft_id, exc.message if exc.code != "empty" else "We could not read any text on these pages. Try a sharper scan.")
        except Exception:  # noqa: BLE001
            log.exception("OCR failed for draft %s", draft_id)
            await self._fail(draft_id, "We could not read this scan. Try a sharper copy, or paste the text instead.")
        finally:
            self._jobs.pop(draft_id, None)

    async def shutdown(self) -> None:
        for job in self._jobs.values():
            job.cancel = True
        for task in list(self._tasks):
            task.cancel()
        if self._tasks:
            await asyncio.wait(self._tasks, timeout=3)


if __name__ == "__main__":  # python -m app.services.ocr  (used by the build to download the models once)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    prefetch_models()
