import { NextResponse } from "next/server";
import {
  bookDetailFromCatalog,
  curriculumSupabase,
  readBundledCatalog,
} from "@/lib/curriculum/load";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { slug } = await context.params;
  const sb = curriculumSupabase();

  if (sb) {
    const book = await sb
      .from("curriculum_books")
      .select("id, slug, name, series, volume, meta")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (!book.error && book.data) {
      const b = book.data;
      const ch = await sb
        .from("curriculum_chapters")
        .select("id, chapter_number, title, summary")
        .eq("book_id", b.id)
        .order("chapter_number", { ascending: true });
      if (!ch.error && ch.data) {
        return NextResponse.json({ book: b, chapters: ch.data });
      }
    }
  }

  const file = await readBundledCatalog();
  const local = file ? bookDetailFromCatalog(slug, file) : null;
  if (local) {
    return NextResponse.json(local);
  }

  return NextResponse.json({ detail: "Book not found" }, { status: 404 });
}
