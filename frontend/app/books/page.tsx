"use client";

import Link from "next/link";
import useSWR from "swr";
import NavBar from "@/components/NavBar";
import { fetchCurriculumBooks } from "@/lib/api";

const curriculumBooksKey = ["curriculum", "books"] as const;

export default function BooksPage() {
  const { data, error, isLoading } = useSWR(curriculumBooksKey, () => fetchCurriculumBooks());

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-mobile-main">
        <h1 className="text-2xl font-black text-[#3C3C3C] tracking-tight mb-1">課本</h1>
        <p className="text-sm text-[#777] mb-6 leading-relaxed">
          當代中文與時代華語：依課次瀏覽摘要、生詞與語法（資料來自內建課程檔或 Supabase）。
        </p>

        {isLoading && !error && (
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 text-[#AFAFAF] text-sm">
            載入中…
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-[#FFCCCC] bg-[#FFF5F5] p-4 text-sm text-[#C00] whitespace-pre-wrap">
            {(error as Error).message || String(error)}
          </div>
        )}
        {data && data.length === 0 && !isLoading && (
          <p className="text-sm text-[#777]">
            尚無課本資料。請在專案根目錄執行 batch 產生{" "}
            <code className="text-xs bg-[#F0F0F0] px-1 rounded">data/curriculum/catalog_from_pdfs.json</code>
            後重新建置；或在 Supabase 執行 migrasi 並 seed。
          </p>
        )}
        <ul className="space-y-3">
          {(data || []).map((b) => (
            <li key={b.id}>
              <Link
                href={`/books/${encodeURIComponent(b.slug)}`}
                className="block rounded-2xl border-2 border-[#E5E5E5] bg-white p-4 active:bg-[#FAFAFA] hover:border-[#58CC02]/40 transition-colors"
              >
                <div className="font-bold text-lg text-[#3C3C3C]">{b.name}</div>
                <div className="text-xs text-[#AFAFAF] mt-1 font-mono">{b.slug}</div>
                {(b.series || b.volume != null) && (
                  <div className="text-sm text-[#777] mt-2">
                    {b.series}
                    {b.volume != null ? ` · Vol. ${b.volume}` : ""}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
