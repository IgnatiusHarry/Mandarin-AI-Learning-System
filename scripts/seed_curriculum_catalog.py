from __future__ import annotations

"""
Load curriculum JSON into Supabase (service role).
Requires SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).

Idempotent per book slug: replaces chapters and dependent rows for that book.

Uses batched inserts for large catalogs (Pleco verbs merged per chapter).
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "curriculum" / "catalog_seed.json"

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / "backend" / ".env")
    load_dotenv(ROOT / "frontend" / ".env.local")
except ImportError:
    pass


def _chunked(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def compose_chapter_summary(summary: str | None, excerpt: str | None, max_excerpt: int = 14_000) -> str:
    s = (summary or "").strip()
    e = (excerpt or "").strip()
    if not e:
        return s
    body = e if len(e) <= max_excerpt else e[:max_excerpt] + "…"
    marker = "── 課本摘錄（PDF 擷取）──"
    if not s:
        return f"{marker}\n\n{body}"
    if len(e) > 40 and e[: min(80, len(e))] in s:
        return s
    return f"{s}\n\n{marker}\n\n{body}"


def merge_chapters_by_number(chapters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    One row per (chapter_number) for UNIQUE(book_id, chapter_number).
    Merges duplicate lesson numbers from PDF + English split, etc.
    """
    by_num: dict[int, dict[str, Any]] = {}
    order: list[int] = []
    for ch in chapters:
        num = int(ch["chapter_number"])
        if num not in by_num:
            by_num[num] = {
                "chapter_number": num,
                "title": ch.get("title") or "",
                "summary": ch.get("summary") or "",
                "raw_text_excerpt": (ch.get("raw_text_excerpt") or "").strip(),
                "vocabulary": list(ch.get("vocabulary") or []),
                "grammar": list(ch.get("grammar") or []),
            }
            order.append(num)
            continue
        cur = by_num[num]
        ot, nt = (cur.get("title") or "").strip(), (ch.get("title") or "").strip()
        if nt and (not ot or len(nt) > len(ot)):
            cur["title"] = nt
        s_add = (ch.get("summary") or "").strip()
        if s_add and s_add not in (cur.get("summary") or ""):
            cur["summary"] = (cur.get("summary") or "").rstrip() + ("\n\n" if cur.get("summary") else "") + s_add
        seen = {str(x.get("word", "")).strip() for x in cur["vocabulary"]}
        for v in ch.get("vocabulary") or []:
            w = str(v.get("word", "")).strip()
            if w and w not in seen:
                seen.add(w)
                cur["vocabulary"].append(v)
        cur["grammar"].extend(ch.get("grammar") or [])
        ex_add = (ch.get("raw_text_excerpt") or "").strip()
        if ex_add:
            prev = (cur.get("raw_text_excerpt") or "").strip()
            if not prev:
                cur["raw_text_excerpt"] = ex_add
            elif ex_add not in prev and prev not in ex_add:
                cur["raw_text_excerpt"] = prev + "\n\n" + ex_add
    return [by_num[n] for n in sorted(order)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--file",
        type=Path,
        default=DATA,
        help="JSON file with top-level { books: [...] }",
    )
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env", file=sys.stderr)
        raise SystemExit(1)

    sb = create_client(url, key)
    payload = json.loads(args.file.expanduser().resolve().read_text(encoding="utf-8"))
    books: list[dict[str, Any]] = payload.get("books") or []
    if not books:
        raise SystemExit("No books in JSON")

    def _dashboard_sql_url() -> str:
        host = (urlparse(url).hostname or "").replace(".supabase.co", "")
        if not host:
            return ""
        return f"https://supabase.com/dashboard/project/{host}/sql/new"

    for book in books:
        slug = book["slug"]
        try:
            existing = sb.table("curriculum_books").select("id").eq("slug", slug).limit(1).execute()
        except Exception as e:  # noqa: BLE001
            err = str(e)
            if "PGRST205" in err or "curriculum_books" in err or "schema cache" in err:
                dash = _dashboard_sql_url()
                print(
                    "Supabase tables missing. Run SQL once in the dashboard, then re-run this script.\n"
                    f"  SQL file: {ROOT / 'sql' / 'migrations' / '20260416_curriculum_catalog.sql'}\n"
                    + (f"  SQL editor: {dash}\n" if dash else ""),
                    file=sys.stderr,
                )
                raise SystemExit(2) from e
            raise
        meta = {k: book[k] for k in ("kind", "series", "volume") if k in book and book[k] is not None}
        row = {
            "slug": slug,
            "name": book["name"],
            "series": book.get("series"),
            "volume": book.get("volume"),
            "meta": meta,
        }
        if existing.data:
            book_id = existing.data[0]["id"]
            sb.table("curriculum_books").update(row).eq("id", book_id).execute()
            chs = sb.table("curriculum_chapters").select("id").eq("book_id", book_id).execute()
            chapter_ids = [c["id"] for c in (chs.data or [])]
            vocab_ids: set[str] = set()
            for cid in chapter_ids:
                links = (
                    sb.table("curriculum_chapter_vocab")
                    .select("vocabulary_id")
                    .eq("chapter_id", cid)
                    .execute()
                )
                for link in links.data or []:
                    vocab_ids.add(link["vocabulary_id"])
                sb.table("curriculum_chapter_vocab").delete().eq("chapter_id", cid).execute()
                gpts = sb.table("curriculum_grammar_points").select("id").eq("chapter_id", cid).execute()
                for g in gpts.data or []:
                    sb.table("curriculum_grammar_examples").delete().eq("grammar_id", g["id"]).execute()
                sb.table("curriculum_grammar_points").delete().eq("chapter_id", cid).execute()
            sb.table("curriculum_chapters").delete().eq("book_id", book_id).execute()
            for vid in vocab_ids:
                sb.table("curriculum_vocabulary").delete().eq("id", vid).execute()
        else:
            ins = sb.table("curriculum_books").insert(row).execute()
            book_id = ins.data[0]["id"]

        merged_chapters = merge_chapters_by_number(list(book.get("chapters") or []))
        for ch in merged_chapters:
            summary_out = compose_chapter_summary(ch.get("summary"), ch.get("raw_text_excerpt"))
            ch_row = {
                "book_id": book_id,
                "chapter_number": int(ch["chapter_number"]),
                "title": ch.get("title") or "",
                "summary": summary_out,
            }
            ch_ins = sb.table("curriculum_chapters").insert(ch_row).execute()
            chapter_id = ch_ins.data[0]["id"]

            vocabs = ch.get("vocabulary") or []
            vrows = [
                {
                    "word": v["word"],
                    "pinyin": v.get("pinyin") or "",
                    "meaning": v.get("meaning") or v.get("meaning_en") or "",
                    "meaning_en": v.get("meaning_en"),
                    "meaning_id": v.get("meaning_id"),
                    "example_sentence": v.get("example_sentence"),
                    "source": v.get("source") or "textbook",
                }
                for v in vocabs
            ]
            all_vids: list[str] = []
            for chunk in _chunked(vrows, 200):
                v_ins = sb.table("curriculum_vocabulary").insert(chunk).execute()
                for row in v_ins.data or []:
                    all_vids.append(row["id"])

            if len(all_vids) != len(vocabs):
                raise SystemExit(
                    f"Vocabulary insert count mismatch chapter {ch.get('chapter_number')}: "
                    f"{len(all_vids)} vs {len(vocabs)}"
                )
            link_rows = [
                {
                    "chapter_id": chapter_id,
                    "vocabulary_id": vid,
                    "sort_order": i,
                    "example_usage": vocabs[i].get("example_usage") or vocabs[i].get("example_sentence"),
                }
                for i, vid in enumerate(all_vids)
            ]
            for chunk in _chunked(link_rows, 200):
                sb.table("curriculum_chapter_vocab").insert(chunk).execute()

            for gi, g in enumerate(ch.get("grammar") or []):
                grow = {
                    "chapter_id": chapter_id,
                    "title": g.get("grammar_title") or g.get("title") or "",
                    "structure": g.get("structure") or "",
                    "explanation": g.get("explanation") or "",
                    "sort_order": gi,
                }
                g_ins = sb.table("curriculum_grammar_points").insert(grow).execute()
                gid = g_ins.data[0]["id"]
                ex_rows = [
                    {
                        "grammar_id": gid,
                        "sentence": ex.get("sentence") or "",
                        "translation": ex.get("translation") or "",
                        "sort_order": ei,
                    }
                    for ei, ex in enumerate(g.get("examples") or [])
                ]
                for chunk in _chunked(ex_rows, 200):
                    if chunk:
                        sb.table("curriculum_grammar_examples").insert(chunk).execute()

        print(f"Seeded book {slug} ({book['name']})")


if __name__ == "__main__":
    main()
