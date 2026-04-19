"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import NavBar from "@/components/NavBar";
import { fetchCurriculumBook } from "@/lib/api";

export default function BookChaptersPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { data, error, isLoading } = useSWR(slug ? ["curriculum", "book", slug] : null, () =>
    fetchCurriculumBook(slug)
  );

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-mobile-main">
        <div className="mb-4">
          <Link href="/books" className="text-sm font-bold text-[#1CB0F6] hover:underline">
            ← All books
          </Link>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 text-[#AFAFAF] text-sm">Loading…</div>
        )}
        {error && (
          <div className="rounded-2xl border border-[#FFCCCC] bg-[#FFF5F5] p-4 text-sm text-[#C00]">
            {String((error as Error).message || error)}
          </div>
        )}
        {data && (
          <>
            <h1 className="text-2xl font-black text-[#3C3C3C] tracking-tight">{data.book.name}</h1>
            <p className="text-xs text-[#AFAFAF] font-mono mt-1 mb-6">{data.book.slug}</p>
            <h2 className="text-sm font-black uppercase tracking-wide text-[#AFAFAF] mb-3">Chapters</h2>
            <ul className="space-y-2">
              {data.chapters.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/books/${encodeURIComponent(slug)}/${c.chapter_number}`}
                    className="block rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 active:bg-[#FAFAFA] hover:border-[#58CC02]/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[#3C3C3C]">
                          {c.chapter_number}. {c.title}
                        </div>
                        {c.summary ? (
                          <p className="text-xs text-[#777] mt-1.5 line-clamp-3 whitespace-pre-wrap leading-snug">
                            {c.summary}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[#58CC02] text-lg shrink-0 pt-0.5">→</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
