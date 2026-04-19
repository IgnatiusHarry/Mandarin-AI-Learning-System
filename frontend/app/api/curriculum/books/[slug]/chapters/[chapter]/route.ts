import { NextResponse } from "next/server";
import {
  chapterDetailFromCatalog,
  curriculumSupabase,
  readBundledCatalog,
} from "@/lib/curriculum/load";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; chapter: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { slug, chapter: chapterRaw } = await context.params;
  const chapterNumber = parseInt(chapterRaw, 10);
  if (!Number.isFinite(chapterNumber)) {
    return NextResponse.json({ detail: "Invalid chapter" }, { status: 400 });
  }

  const sb = curriculumSupabase();

  if (sb) {
    const bookQ = await sb.from("curriculum_books").select("id, slug, name").eq("slug", slug).limit(1).maybeSingle();
    if (!bookQ.error && bookQ.data) {
      const bid = bookQ.data.id;
      const chQ = await sb
        .from("curriculum_chapters")
        .select("id, chapter_number, title, summary, book_id")
        .eq("book_id", bid)
        .eq("chapter_number", chapterNumber)
        .limit(1)
        .maybeSingle();

      if (!chQ.error && chQ.data) {
        const chapter = chQ.data;
        const cid = chapter.id as string;

        const links = await sb
          .from("curriculum_chapter_vocab")
          .select("sort_order, example_usage, vocabulary_id")
          .eq("chapter_id", cid)
          .order("sort_order", { ascending: true });

        const vocab_rows: Record<string, unknown>[] = [];
        if (!links.error && links.data?.length) {
          const vids = links.data.map((row) => row.vocabulary_id as string);
          const vres = await sb.from("curriculum_vocabulary").select("*").in("id", vids as string[]);
          const by_id = Object.fromEntries((vres.data ?? []).map((row) => [row.id as string, row]));
          for (const link of links.data) {
            const base = by_id[link.vocabulary_id as string];
            if (!base) continue;
            vocab_rows.push({
              ...base,
              chapter_example_usage: link.example_usage,
              sort_order: link.sort_order,
            });
          }
        }

        const gpoints = await sb
          .from("curriculum_grammar_points")
          .select("id, title, structure, explanation, sort_order")
          .eq("chapter_id", cid)
          .order("sort_order", { ascending: true });

        const grammar_out: Record<string, unknown>[] = [];
        if (!gpoints.error && gpoints.data?.length) {
          const gids = gpoints.data.map((g) => g.id as string);
          const ex =
            gids.length > 0
              ? await sb
                  .from("curriculum_grammar_examples")
                  .select("grammar_id, sentence, translation, sort_order")
                  .in("grammar_id", gids)
                  .order("sort_order", { ascending: true })
              : { data: [] as Record<string, unknown>[] };
          const byG: Record<string, { sentence: string; translation: string; sort_order: number | null }[]> = {};
          for (const row of ex.data ?? []) {
            const gid = row.grammar_id as string;
            if (!byG[gid]) byG[gid] = [];
            byG[gid].push({
              sentence: row.sentence as string,
              translation: (row.translation as string) ?? "",
              sort_order: (row.sort_order as number | null) ?? null,
            });
          }
          for (const g of gpoints.data) {
            grammar_out.push({
              id: g.id,
              grammar_title: g.title,
              structure: g.structure,
              explanation: g.explanation,
              examples: byG[g.id as string] ?? [],
            });
          }
        }

        return NextResponse.json({
          book: { slug: bookQ.data.slug, name: bookQ.data.name },
          chapter: {
            id: chapter.id,
            chapter_number: chapter.chapter_number,
            title: chapter.title,
            summary: chapter.summary,
          },
          vocabulary: vocab_rows,
          grammar: grammar_out,
        });
      }
    }
  }

  const file = await readBundledCatalog();
  const local = file ? chapterDetailFromCatalog(slug, chapterNumber, file) : null;
  if (local) {
    return NextResponse.json(local);
  }

  return NextResponse.json({ detail: "Chapter not found" }, { status: 404 });
}
