"""Merge hand-curated data/curriculum/catalog_seed.json into catalog_from_pdfs.json (by book slug + chapter_number)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / "data" / "curriculum" / "catalog_from_pdfs.json"
SEED = ROOT / "data" / "curriculum" / "catalog_seed.json"


def main() -> None:
    if not BATCH.is_file():
        raise SystemExit(f"Missing {BATCH}")
    if not SEED.is_file():
        raise SystemExit(f"Missing {SEED}")
    main_doc = json.loads(BATCH.read_text(encoding="utf-8"))
    seed_doc = json.loads(SEED.read_text(encoding="utf-8"))
    seed_books = {b["slug"]: b for b in seed_doc.get("books", [])}

    for book in main_doc.get("books", []):
        slug = book.get("slug")
        if not slug or slug not in seed_books:
            continue
        seed_book = seed_books[slug]
        seed_ch = {(c["chapter_number"]): c for c in seed_book.get("chapters", [])}
        for ch in book.get("chapters", []):
            num = ch.get("chapter_number")
            if num not in seed_ch:
                continue
            s = seed_ch[num]
            if s.get("summary"):
                ch["summary"] = s["summary"]
            if s.get("title"):
                ch["title"] = s["title"]
            if s.get("vocabulary"):
                seed_v = s["vocabulary"]
                seed_words = {str(x.get("word", "")).strip() for x in seed_v}
                rest = [x for x in (ch.get("vocabulary") or []) if str(x.get("word", "")).strip() not in seed_words]
                ch["vocabulary"] = list(seed_v) + rest
            if s.get("grammar") is not None:
                ch["grammar"] = s["grammar"]

    BATCH.write_text(json.dumps(main_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {BATCH}")


if __name__ == "__main__":
    main()
