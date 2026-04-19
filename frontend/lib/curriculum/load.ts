import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "path";

import { composeChapterSummary } from "@/lib/curriculum/summary";

export type CatalogJson = {
  books?: CatalogBookJson[];
};

export type CatalogBookJson = {
  slug: string;
  name: string;
  kind?: string;
  series?: string;
  volume?: number;
  meta?: Record<string, unknown>;
  chapters?: {
    chapter_number: number;
    title: string;
    summary: string;
    raw_text_excerpt?: string;
    vocabulary?: {
      word: string;
      pinyin?: string;
      meaning?: string;
      meaning_en?: string | null;
      meaning_id?: string | null;
      example_sentence?: string | null;
      source?: string;
      example_usage?: string | null;
    }[];
    grammar?: {
      grammar_title?: string;
      title?: string;
      structure?: string;
      explanation?: string;
      examples?: { sentence: string; translation?: string }[];
    }[];
  }[];
};

export function curriculumSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function readBundledCatalog(): Promise<CatalogJson | null> {
  try {
    const fp = path.join(process.cwd(), "public", "curriculum", "catalog.json");
    const raw = await readFile(fp, "utf-8");
    return JSON.parse(raw) as CatalogJson;
  } catch {
    return null;
  }
}

export async function listBooksDb(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("curriculum_books")
    .select("id, slug, name, series, volume, meta")
    .order("slug", { ascending: true });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

export function booksFromCatalogJson(c: CatalogJson) {
  return (c.books ?? []).map((b) => ({
    id: `local-${b.slug}`,
    slug: b.slug,
    name: b.name,
    series: b.series ?? null,
    volume: b.volume ?? null,
    meta: { ...(b.meta ?? {}), kind: b.kind, source: "bundled_catalog" },
  }));
}

export function bookDetailFromCatalog(slug: string, c: CatalogJson) {
  const b = (c.books ?? []).find((x) => x.slug === slug);
  if (!b) return null;
  const chapters = (b.chapters ?? []).map((ch) => ({
    id: `local-${b.slug}-${ch.chapter_number}`,
    chapter_number: ch.chapter_number,
    title: ch.title,
    summary: composeChapterSummary(ch.summary, ch.raw_text_excerpt),
  }));
  return {
    book: {
      id: `local-${b.slug}`,
      slug: b.slug,
      name: b.name,
      series: b.series ?? null,
      volume: b.volume ?? null,
      meta: b.meta ?? {},
    },
    chapters,
  };
}

export function chapterDetailFromCatalog(slug: string, chapterNumber: number, c: CatalogJson) {
  const b = (c.books ?? []).find((x) => x.slug === slug);
  if (!b) return null;
  const ch = (b.chapters ?? []).find((x) => x.chapter_number === chapterNumber);
  if (!ch) return null;

  const vocabulary = (ch.vocabulary ?? []).map((v, i) => ({
    id: `local-${slug}-${chapterNumber}-v-${i}`,
    word: v.word,
    pinyin: v.pinyin ?? "",
    meaning: v.meaning ?? v.meaning_en ?? "",
    meaning_en: v.meaning_en ?? null,
    meaning_id: v.meaning_id ?? null,
    example_sentence: v.example_sentence ?? null,
    source: v.source ?? "textbook",
    chapter_example_usage: v.example_usage ?? v.example_sentence ?? null,
    sort_order: i,
  }));

  const grammar = (ch.grammar ?? []).map((g, gi) => ({
    id: `local-${slug}-${chapterNumber}-g-${gi}`,
    grammar_title: g.grammar_title ?? g.title ?? "",
    structure: g.structure ?? "",
    explanation: g.explanation ?? "",
    examples: (g.examples ?? []).map((ex, ei) => ({
      sentence: ex.sentence,
      translation: ex.translation ?? "",
      sort_order: ei,
    })),
  }));

  return {
    book: { slug: b.slug, name: b.name },
    chapter: {
      id: `local-${slug}-${chapterNumber}`,
      chapter_number: ch.chapter_number,
      title: ch.title,
      summary: composeChapterSummary(ch.summary, ch.raw_text_excerpt),
    },
    vocabulary,
    grammar,
  };
}
