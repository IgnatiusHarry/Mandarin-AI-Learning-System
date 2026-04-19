"""Public read-only catalog: textbooks / chapters / vocabulary / grammar (Supabase)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from db.supabase_client import get_supabase

router = APIRouter()


@router.get("/books")
async def list_books():
    sb = get_supabase()
    res = sb.table("curriculum_books").select("id, slug, name, series, volume, meta").order("slug").execute()
    return res.data or []


@router.get("/books/{slug}")
async def get_book(slug: str):
    sb = get_supabase()
    book = sb.table("curriculum_books").select("id, slug, name, series, volume, meta").eq("slug", slug).limit(1).execute()
    if not book.data:
        raise HTTPException(status_code=404, detail="Book not found")
    b = book.data[0]
    ch = (
        sb.table("curriculum_chapters")
        .select("id, chapter_number, title, summary")
        .eq("book_id", b["id"])
        .order("chapter_number")
        .execute()
    )
    return {"book": b, "chapters": ch.data or []}


@router.get("/books/{slug}/chapters/{chapter_number}")
async def get_chapter(slug: str, chapter_number: int):
    sb = get_supabase()
    book_q = sb.table("curriculum_books").select("id, slug, name, series, volume").eq("slug", slug).limit(1).execute()
    if not book_q.data:
        raise HTTPException(status_code=404, detail="Book not found")
    book_row = book_q.data[0]
    bid = book_row["id"]
    ch = (
        sb.table("curriculum_chapters")
        .select("id, chapter_number, title, summary, book_id")
        .eq("book_id", bid)
        .eq("chapter_number", chapter_number)
        .limit(1)
        .execute()
    )
    if not ch.data:
        raise HTTPException(status_code=404, detail="Chapter not found")
    chapter = ch.data[0]
    cid = chapter["id"]

    links = (
        sb.table("curriculum_chapter_vocab")
        .select("sort_order, example_usage, vocabulary_id")
        .eq("chapter_id", cid)
        .order("sort_order")
        .execute()
    )
    vocab_rows: list[dict] = []
    if links.data:
        vids = [row["vocabulary_id"] for row in links.data]
        vres = sb.table("curriculum_vocabulary").select("*").in_("id", vids).execute()
        by_id = {row["id"]: row for row in (vres.data or [])}
        for link in links.data:
            base = by_id.get(link["vocabulary_id"])
            if not base:
                continue
            vocab_rows.append(
                {
                    **base,
                    "chapter_example_usage": link.get("example_usage"),
                    "sort_order": link.get("sort_order"),
                }
            )

    gpoints = (
        sb.table("curriculum_grammar_points")
        .select("id, title, structure, explanation, sort_order")
        .eq("chapter_id", cid)
        .order("sort_order")
        .execute()
    )
    grammar_out: list[dict] = []
    if gpoints.data:
        gids = [g["id"] for g in gpoints.data]
        ex = (
            sb.table("curriculum_grammar_examples")
            .select("grammar_id, sentence, translation, sort_order")
            .in_("grammar_id", gids)
            .order("sort_order")
            .execute()
        )
        by_g: dict[str, list[dict]] = {}
        for row in ex.data or []:
            gid = row["grammar_id"]
            by_g.setdefault(gid, []).append(
                {"sentence": row["sentence"], "translation": row["translation"], "sort_order": row["sort_order"]}
            )
        for g in gpoints.data:
            grammar_out.append(
                {
                    "id": g["id"],
                    "grammar_title": g["title"],
                    "structure": g["structure"],
                    "explanation": g["explanation"],
                    "examples": by_g.get(g["id"], []),
                }
            )

    return {
        "book": {"slug": book_row["slug"], "name": book_row["name"]},
        "chapter": {
            "id": chapter["id"],
            "chapter_number": chapter["chapter_number"],
            "title": chapter["title"],
            "summary": chapter["summary"],
        },
        "vocabulary": vocab_rows,
        "grammar": grammar_out,
    }
