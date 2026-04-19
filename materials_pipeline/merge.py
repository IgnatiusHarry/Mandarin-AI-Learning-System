from __future__ import annotations

from materials_pipeline.models import BookDraft, ChapterDraft, VocabEntry
from materials_pipeline.normalize import merge_meaning_en_id, nfc, strip_noise


def merge_vocab_lists(textbook: list[VocabEntry], supplemental: list[VocabEntry]) -> list[VocabEntry]:
    """
    Textbook rows win on conflicts (same traditional word).
    Supplemental (typically Pleco) fills empty pinyin/meaning/example only.
    """
    primary: dict[str, VocabEntry] = {}
    order: list[str] = []

    def add_primary(e: VocabEntry) -> None:
        k = nfc(e.word)
        if k not in primary:
            order.append(k)
            primary[k] = VocabEntry(
                word=k,
                pinyin=strip_noise(e.pinyin),
                meaning=strip_noise(e.meaning),
                meaning_en=e.meaning_en,
                meaning_id=e.meaning_id,
                example_sentence=e.example_sentence,
                source="textbook" if e.source == "textbook" else "merged",
                meta=dict(e.meta),
            )
        else:
            cur = primary[k]
            if e.source == "textbook":
                if strip_noise(e.pinyin):
                    cur.pinyin = strip_noise(e.pinyin)
                if strip_noise(e.meaning):
                    cur.meaning = merge_meaning_en_id(e.meaning, e.meaning_en, e.meaning_id)
                cur.source = "merged"
            cur.example_sentence = cur.example_sentence or e.example_sentence

    for e in textbook:
        add_primary(e)

    for e in supplemental:
        k = nfc(e.word)
        if k not in primary:
            order.append(k)
            primary[k] = VocabEntry(
                word=k,
                pinyin=strip_noise(e.pinyin),
                meaning=merge_meaning_en_id(e.meaning, e.meaning_en, e.meaning_id),
                meaning_en=e.meaning_en,
                meaning_id=e.meaning_id,
                example_sentence=e.example_sentence,
                source="pleco",
                meta=dict(e.meta),
            )
            continue
        cur = primary[k]
        if not strip_noise(cur.pinyin) and strip_noise(e.pinyin):
            cur.pinyin = strip_noise(e.pinyin)
        if not strip_noise(cur.meaning) and strip_noise(e.meaning):
            cur.meaning = merge_meaning_en_id(e.meaning, e.meaning_en, e.meaning_id)
        cur.example_sentence = cur.example_sentence or e.example_sentence
        if cur.source != "textbook":
            cur.source = "merged"
        else:
            cur.source = "merged"

    return [primary[k] for k in order]


def merge_book_with_pleco(book: BookDraft, pleco_entries: list[VocabEntry]) -> BookDraft:
    new_chapters: list[ChapterDraft] = []
    for ch in book.chapters:
        excerpt = ch.raw_text_excerpt + "\n" + ch.title + "\n" + ch.summary
        relevant = [p for p in pleco_entries if p.word and nfc(p.word) in nfc(excerpt)]
        merged = merge_vocab_lists(ch.vocabulary, relevant)
        new_chapters.append(
            ChapterDraft(
                chapter_number=ch.chapter_number,
                title=ch.title,
                summary=ch.summary,
                vocabulary=merged,
                grammar=ch.grammar,
                raw_text_excerpt=ch.raw_text_excerpt,
            )
        )
    return BookDraft(name=book.name, slug=book.slug, kind=book.kind, chapters=new_chapters, meta=book.meta)
