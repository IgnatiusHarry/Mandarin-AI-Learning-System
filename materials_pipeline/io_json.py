from __future__ import annotations

from typing import Any

from materials_pipeline.models import BookDraft, ChapterDraft, GrammarExample, GrammarPoint, VocabEntry


def vocab_from_dict(d: dict[str, Any]) -> VocabEntry:
    return VocabEntry(
        word=str(d.get("word", "")),
        pinyin=str(d.get("pinyin", "")),
        meaning=str(d.get("meaning", "")),
        meaning_en=d.get("meaning_en"),
        meaning_id=d.get("meaning_id"),
        example_sentence=d.get("example_sentence"),
        source=d.get("source", "pleco"),  # type: ignore[arg-type]
        meta=dict(d.get("meta") or {}),
    )


def grammar_from_dict(d: dict[str, Any]) -> GrammarPoint:
    ex: list[GrammarExample] = []
    for e in d.get("examples") or []:
        if isinstance(e, dict):
            ex.append(GrammarExample(sentence=str(e.get("sentence", "")), translation=str(e.get("translation", ""))))
    return GrammarPoint(
        title=str(d.get("grammar_title") or d.get("title", "")),
        structure=str(d.get("structure", "")),
        explanation=str(d.get("explanation", "")),
        examples=ex,
    )


def chapter_from_dict(d: dict[str, Any]) -> ChapterDraft:
    voc = [vocab_from_dict(x) for x in d.get("vocabulary") or [] if isinstance(x, dict)]
    gram = [grammar_from_dict(x) for x in d.get("grammar") or [] if isinstance(x, dict)]
    return ChapterDraft(
        chapter_number=int(d.get("chapter_number", 0)),
        title=str(d.get("title", "")),
        summary=str(d.get("summary", "")),
        vocabulary=voc,
        grammar=gram,
        raw_text_excerpt=str(d.get("raw_text_excerpt", "")),
    )


def book_from_dict(d: dict[str, Any]) -> BookDraft:
    chs = [chapter_from_dict(x) for x in d.get("chapters") or [] if isinstance(x, dict)]
    return BookDraft(
        name=str(d.get("name", "")),
        slug=str(d.get("slug", "")),
        kind=d.get("kind", "other"),  # type: ignore[arg-type]
        chapters=chs,
        meta=dict(d.get("meta") or {}),
    )
