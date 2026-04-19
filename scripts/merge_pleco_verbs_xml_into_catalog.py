"""
Merge Pleco flashcard XML (verb cards tagged 當代中文/Book V/LN-… or 時代華語/Book V/LN-…)
into data/curriculum/catalog_from_pdfs.json chapter vocabulary.

Filters: part_of_speech == 'verb' OR definition line starts with 'verb ' (case-insensitive).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from import_pleco_xml import parse_pleco_xml  # noqa: E402

DANGDAI = re.compile(r"當代中文/Book\s*(\d+)/L(\d+)", re.I)
SHIDAI = re.compile(r"時代華語/Book\s*(\d+)/L(\d+)", re.I)

CATALOG = ROOT / "data" / "curriculum" / "catalog_from_pdfs.json"


def _is_verb_card(card: dict[str, Any]) -> bool:
    pos = (card.get("part_of_speech") or "").lower()
    if pos == "verb":
        return True
    raw = (card.get("definition_raw") or "").strip().lower()
    return raw.startswith("verb ") or raw.startswith("verb\t")


def _placements(categories: list[str]) -> set[tuple[str, int]]:
    keys: set[tuple[str, int]] = set()
    for cat in categories:
        m = DANGDAI.search(cat)
        if m:
            keys.add((f"dangdai-course-{int(m.group(1))}", int(m.group(2))))
        m = SHIDAI.search(cat)
        if m:
            keys.add((f"shidai-course-{int(m.group(1))}", int(m.group(2))))
    return keys


def _card_to_vocab(card: dict[str, Any]) -> dict[str, Any]:
    w = (card.get("word") or "").strip()
    py = (card.get("pinyin") or "").strip()
    meaning = (card.get("meaning_en") or "").strip()
    return {
        "word": w,
        "pinyin": py,
        "meaning": meaning,
        "meaning_en": meaning or None,
        "meaning_id": None,
        "example_sentence": None,
        "source": "pleco",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "xml_path",
        type=Path,
        nargs="?",
        default=ROOT / "data" / "curriculum" / "pleco_verbs_ai.xml",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=CATALOG,
        help="catalog_from_pdfs.json to update",
    )
    args = parser.parse_args()

    xml_path = args.xml_path.expanduser().resolve()
    if not xml_path.is_file():
        raise SystemExit(f"XML not found: {xml_path}")

    print("Parsing Pleco XML (may take a minute)…")
    cards = parse_pleco_xml(xml_path)
    print(f"Total cards: {len(cards)}")

    # (slug, lesson) -> list of vocab dicts
    bucket: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    verb_count = 0
    placed = 0
    for card in cards:
        if not _is_verb_card(card):
            continue
        verb_count += 1
        keys = _placements(card.get("categories") or [])
        if not keys:
            continue
        v = _card_to_vocab(card)
        if not v["word"]:
            continue
        for key in keys:
            bucket[key].append(v)
            placed += 1

    print(f"Verb cards: {verb_count}, placement rows: {placed}, unique (book,lesson) keys: {len(bucket)}")

    cat_path = args.catalog.expanduser().resolve()
    doc = json.loads(cat_path.read_text(encoding="utf-8"))
    books = doc.get("books") or []
    by_slug = {b["slug"]: b for b in books if b.get("slug")}

    merged_chapters = 0
    for (slug, lesson), items in bucket.items():
        book = by_slug.get(slug)
        if not book:
            print(f"  skip unknown book slug: {slug}")
            continue
        ch = next((c for c in book.get("chapters", []) if c.get("chapter_number") == lesson), None)
        if not ch:
            print(f"  skip missing chapter {slug} lesson {lesson}")
            continue
        existing = ch.get("vocabulary") or []
        seen = {str(x.get("word", "")).strip() for x in existing}
        for v in items:
            w = v["word"]
            if w in seen:
                continue
            seen.add(w)
            existing.append(v)
        ch["vocabulary"] = existing
        merged_chapters += 1

    cat_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {cat_path} (merged into {merged_chapters} chapter buckets)")


if __name__ == "__main__":
    main()
