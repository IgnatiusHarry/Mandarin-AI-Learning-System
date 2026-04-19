from __future__ import annotations

import re
from pathlib import Path

import fitz  # PyMuPDF

from materials_pipeline.models import BookDraft, ChapterDraft, GrammarExample, GrammarPoint, VocabEntry
from materials_pipeline.normalize import nfc, normalize_pinyin_display, strip_noise

HAN = re.compile(r"[\u4e00-\u9fff]+")
LESSON_TC = re.compile(r"(第\s*[一二三四五六七八九十百零〇两兩0-9]+\s*課)")
LESSON_EN = re.compile(r"Lesson\s*\n?\s*(\d+)", re.IGNORECASE)


def _slugify(name: str) -> str:
    """URL-safe ASCII slug; keeps digits."""
    base = name.strip()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", base.lower())
    s = re.sub(r"-+", "-", s).strip("-")
    if s:
        return s[:96]
    # Fallback from CJK title
    return "book-" + str(abs(hash(base)) % 10_000_000)


def extract_pdf_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path.expanduser().resolve())
    parts: list[str] = []
    for i in range(doc.page_count):
        parts.append(doc.load_page(i).get_text("text") or "")
    doc.close()
    return "\n".join(parts)


def split_by_traditional_lessons(text: str) -> list[tuple[str, str]]:
    """Return list of (header, body) using 第X課 as anchors."""
    t = text
    matches = list(LESSON_TC.finditer(t))
    if len(matches) < 2:
        return []
    segments: list[tuple[str, str]] = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(t)
        header = strip_noise(m.group(1))
        body = t[m.end() : end]
        segments.append((header, body))
    return segments


def split_by_english_lessons(text: str) -> list[tuple[str, str]]:
    """
    Fallback when 第…課 is missing in extracted text (common in volumes 5–6).
    PDFs often repeat the same 'Lesson N' in headers/footers; keep only runs where N changes.
    """
    pat = re.compile(r"(?m)^\s*Lesson\s*(\d+)\b", re.IGNORECASE)
    raw = list(pat.finditer(text))
    if not raw:
        return []
    filtered: list[re.Match[str]] = []
    last_n: int | None = None
    for m in raw:
        n = int(m.group(1))
        if last_n is None or n != last_n:
            filtered.append(m)
            last_n = n
    if len(filtered) < 2:
        return []
    segments: list[tuple[str, str]] = []
    for i, m in enumerate(filtered):
        end = filtered[i + 1].start() if i + 1 < len(filtered) else len(text)
        n = int(m.group(1))
        header = f"Lesson {n}"
        body = text[m.end() : end]
        segments.append((header, body))
    return segments


def _lesson_num_from_header(header: str) -> int:
    m_en = re.search(r"Lesson\s*(\d+)", header, re.IGNORECASE)
    if m_en:
        return int(m_en.group(1))
    cn = "零一二三四五六七八九十"
    m = re.search(r"第\s*([一二三四五六七八九十百0-9]+)\s*課", header)
    if not m:
        return 0
    s = m.group(1)
    if s.isdigit():
        return int(s)
    if len(s) == 1 and s in cn:
        return cn.index(s)
    if s == "十":
        return 10
    if s.startswith("十") and len(s) == 2:
        return 10 + cn.index(s[1]) if s[1] in cn else 10
    if s.endswith("十") and len(s) == 2:
        return cn.index(s[0]) * 10 if s[0] in cn else 0
    return 0


def _title_from_body_start(body: str, max_len: int = 80) -> str:
    lines = [strip_noise(x) for x in body.splitlines() if strip_noise(x)]
    for line in lines[:20]:
        if HAN.search(line) and 2 <= len(line) <= max_len and "課" not in line:
            if re.match(r"^[\u4e00-\u9fff\s·「」『』]+$", line):
                return line
    return ""


PINYIN_LIKE = re.compile(r"^[a-züv]{1,12}[1-5]?\s*$", re.IGNORECASE)


def _guess_vocab_lines(body: str) -> list[VocabEntry]:
    """
    Heuristic: lines with Hanzi cluster + whitespace + Latin letters (pinyin/meaning).
    Many NTNU PDFs garble text extraction — results are often noisy; prefer curated JSON.
    """
    entries: list[VocabEntry] = []
    for line in body.splitlines():
        line_s = strip_noise(line)
        if len(line_s) < 2 or len(line_s) > 100:
            continue
        if not HAN.search(line_s):
            continue
        if not re.search(r"[A-Za-z]", line_s):
            continue
        parts = re.split(r"\s{2,}|\t", line_s)
        word = ""
        rest = line_s
        if len(parts) >= 2 and HAN.search(parts[0]):
            w0 = strip_noise(parts[0])
            if 1 <= len(w0) <= 8 and re.match(r"^[\u4e00-\u9fff]+$", w0):
                word = w0
                rest = " ".join(parts[1:])
        if not word:
            hm = HAN.search(line_s)
            if hm:
                span = hm.group(0)
                if 1 <= len(span) <= 8 and re.match(r"^[\u4e00-\u9fff]+$", span):
                    word = span
                    rest = line_s[hm.end() :].strip()
        if not word:
            continue
        py = ""
        meaning = rest
        if rest:
            tokens = rest.split()
            if tokens:
                tok0 = tokens[0].lower().replace("v", "ü")
                if PINYIN_LIKE.match(re.sub(r"[^a-zü1-5]", "", tok0)) or (
                    len(re.sub(r"[^a-zA-ZüÜ]", "", tokens[0])) >= 2
                    and re.match(r"^[a-zA-ZüÜ.,\s1-5]+$", tokens[0])
                ):
                    py = normalize_pinyin_display(tokens[0])
                    meaning = " ".join(tokens[1:])
        if len(meaning) > 80 or re.search(r"[\u3040-\u30ff]", meaning):
            continue
        if not py:
            continue
        entries.append(
            VocabEntry(
                word=word,
                pinyin=py,
                meaning=strip_noise(meaning),
                source="textbook",
                meta={"parser": "pdf_heuristic"},
            )
        )
    seen: set[str] = set()
    uniq: list[VocabEntry] = []
    for e in entries:
        k = nfc(e.word)
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)
    return uniq[:120]


def _guess_grammar_blocks(body: str) -> list[GrammarPoint]:
    points: list[GrammarPoint] = []
    # English textbook grammar sections often use roman numerals + title
    for m in re.finditer(
        r"(I{1,3}V?X?)\.\s*([^\n]+)\n+Function:\s*([^\n]+)",
        body,
        flags=re.MULTILINE,
    ):
        title = strip_noise(m.group(2))[:120]
        expl = strip_noise(m.group(3))[:2000]
        gp = GrammarPoint(title=title, structure="", explanation=expl, examples=[])
        # Pull example lines starting with O or bullet + Han
        tail = body[m.end() : m.end() + 2500]
        for line in tail.splitlines():
            ls = strip_noise(line)
            if len(ls) > 80:
                continue
            if HAN.search(ls) and re.search(r"[A-Za-z]", ls):
                if ls.lower().startswith("structure") or ls.lower().startswith("negation"):
                    break
                if ls.startswith("O ") or ls.startswith("○"):
                    gp.examples.append(GrammarExample(sentence=ls.lstrip("O ○").strip(), translation=""))
        if gp.title:
            points.append(gp)
    return points[:30]


def parse_ntnu_textbook_pdf(
    pdf_path: Path,
    book_display_name: str | None = None,
    include_heuristic_vocab: bool = False,
    slug: str | None = None,
) -> BookDraft:
    path = pdf_path.expanduser().resolve()
    name = book_display_name or path.stem.replace("–", "-").strip()
    book_slug = strip_noise(slug) if slug else _slugify(name)
    text = extract_pdf_text(path)
    segs = split_by_traditional_lessons(text)
    if len(segs) < 2:
        segs = split_by_english_lessons(text)
    chapters: list[ChapterDraft] = []
    if not segs:
        chapters.append(
            ChapterDraft(
                chapter_number=0,
                title="Full text (no 第X課 anchors found)",
                summary="",
                vocabulary=[],
                grammar=[],
                raw_text_excerpt=text[:8000],
            )
        )
        return BookDraft(name=name, slug=book_slug, kind="ntnu", chapters=chapters, meta={"pdf": str(path)})

    for idx, (header, body) in enumerate(segs, start=1):
        num = _lesson_num_from_header(header) or idx
        title = _title_from_body_start(body) or header
        summary = (
            "Lesson boundaries detected from PDF (第…課). "
            + (
                "Heuristic vocabulary/grammar extraction enabled — verify before publishing."
                if include_heuristic_vocab
                else "Vocabulary and grammar are omitted by default (PDF text is often noisy); "
                "attach curated lists via JSON or enable --heuristic-vocab."
            )
        )
        voc = _guess_vocab_lines(body) if include_heuristic_vocab else []
        gram = _guess_grammar_blocks(body) if include_heuristic_vocab else []
        chapters.append(
            ChapterDraft(
                chapter_number=num,
                title=title,
                summary=summary,
                vocabulary=voc,
                grammar=gram,
                raw_text_excerpt=body[:4000],
            )
        )
    chapters.sort(key=lambda c: c.chapter_number)
    return BookDraft(name=name, slug=book_slug, kind="ntnu", chapters=chapters, meta={"pdf": str(path)})
