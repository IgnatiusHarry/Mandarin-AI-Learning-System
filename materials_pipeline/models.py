from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


SourceKind = Literal["pleco", "textbook", "merged"]


@dataclass
class VocabEntry:
    word: str
    pinyin: str = ""
    meaning: str = ""
    meaning_en: str | None = None
    meaning_id: str | None = None
    example_sentence: str | None = None
    source: SourceKind = "pleco"
    meta: dict[str, Any] = field(default_factory=dict)

    def to_json_dict(self) -> dict[str, Any]:
        return {
            "word": self.word,
            "pinyin": self.pinyin,
            "meaning": self.meaning or (self.meaning_en or ""),
            "meaning_en": self.meaning_en,
            "meaning_id": self.meaning_id,
            "example_sentence": self.example_sentence,
            "source": self.source,
            "meta": self.meta,
        }


@dataclass
class GrammarExample:
    sentence: str
    translation: str = ""


@dataclass
class GrammarPoint:
    title: str
    structure: str = ""
    explanation: str = ""
    examples: list[GrammarExample] = field(default_factory=list)

    def to_json_dict(self) -> dict[str, Any]:
        return {
            "grammar_title": self.title,
            "structure": self.structure,
            "explanation": self.explanation,
            "examples": [{"sentence": e.sentence, "translation": e.translation} for e in self.examples],
        }


@dataclass
class ChapterDraft:
    chapter_number: int
    title: str
    summary: str = ""
    vocabulary: list[VocabEntry] = field(default_factory=list)
    grammar: list[GrammarPoint] = field(default_factory=list)
    raw_text_excerpt: str = ""

    def to_json_dict(self) -> dict[str, Any]:
        return {
            "chapter_number": self.chapter_number,
            "title": self.title,
            "summary": self.summary,
            "vocabulary": [v.to_json_dict() for v in self.vocabulary],
            "grammar": [g.to_json_dict() for g in self.grammar],
            "raw_text_excerpt": self.raw_text_excerpt[:4000],
        }


@dataclass
class BookDraft:
    name: str
    slug: str
    kind: Literal["ntnu", "shidai", "other"] = "other"
    chapters: list[ChapterDraft] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_json_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "slug": self.slug,
            "kind": self.kind,
            "meta": self.meta,
            "chapters": [c.to_json_dict() for c in self.chapters],
        }
