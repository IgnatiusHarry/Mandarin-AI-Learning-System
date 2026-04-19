"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import NavBar from "@/components/NavBar";
import { fetchCurriculumChapter } from "@/lib/api";

export default function ChapterDetailPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const chRaw = params.chapter;
  const chapterNum = typeof chRaw === "string" ? parseInt(chRaw, 10) : NaN;
  const valid = slug && Number.isFinite(chapterNum);

  const { data, error, isLoading } = useSWR(
    valid ? ["curriculum", "chapter", slug, chapterNum] : null,
    () => fetchCurriculumChapter(slug, chapterNum)
  );

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-mobile-main space-y-8">
        <div className="flex flex-col gap-2">
          <Link href="/books" className="text-xs font-bold text-[#1CB0F6] hover:underline w-fit">
            All books
          </Link>
          {slug && (
            <Link href={`/books/${encodeURIComponent(slug)}`} className="text-xs font-bold text-[#1CB0F6] hover:underline w-fit">
              ← {slug}
            </Link>
            )}
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
            <header>
              <p className="text-xs text-[#AFAFAF] font-mono">{data.book.name}</p>
              <h1 className="text-2xl font-black text-[#3C3C3C] mt-1">
                第 {data.chapter.chapter_number} 課 · {data.chapter.title}
              </h1>
            </header>

            <section className="rounded-2xl border-2 border-[#E5E5E5] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-[#58CC02] mb-2">摘要</h2>
              {(() => {
                const full = (data.chapter.summary || "").trim();
                if (!full) {
                  return (
                    <p className="text-sm text-[#AFAFAF]">此課尚無摘要內容。</p>
                  );
                }
                const sep = "── 課本摘錄（PDF 擷取）──";
                const idx = full.indexOf(sep);
                if (idx === -1) {
                  return (
                    <div className="max-h-[70vh] overflow-y-auto text-[#3C3C3C] leading-relaxed text-sm whitespace-pre-wrap border border-[#F0F0F0] rounded-xl p-3 bg-[#FAFAFA]/40">
                      {full}
                    </div>
                  );
                }
                const head = full.slice(0, idx).trim();
                const tail = full.slice(idx + sep.length).trim();
                return (
                  <div className="space-y-4">
                    {head ? (
                      <p className="text-[#3C3C3C] leading-relaxed text-sm whitespace-pre-wrap">{head}</p>
                    ) : null}
                    <div>
                      <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wide mb-2">課本摘錄</p>
                      <div className="max-h-[65vh] overflow-y-auto text-[#3C3C3C] leading-relaxed text-sm whitespace-pre-wrap border border-[#F0F0F0] rounded-xl p-3 bg-[#FAFAFA]/40">
                        {tail}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>

            <section className="rounded-2xl border-2 border-[#E5E5E5] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-[#58CC02] mb-4">Vocabulary</h2>
              <ul className="divide-y divide-[#EFEFEF]">
                {data.vocabulary.map((v) => (
                  <li key={v.id} className="py-4 first:pt-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-xl font-bold text-[#111]">{v.word}</span>
                      {v.pinyin && <span className="text-[#1CB0F6] font-medium">{v.pinyin}</span>}
                      <span className="text-[#777] text-sm">{v.meaning}</span>
                    </div>
                    {(v.chapter_example_usage || v.example_sentence) && (
                      <p className="text-sm text-[#555] mt-2 pl-1 border-l-2 border-[#58CC02]/40">
                        {v.chapter_example_usage || v.example_sentence}
                      </p>
                    )}
                    <p className="text-[10px] text-[#CCC] mt-1 uppercase tracking-wide">{v.source}</p>
                  </li>
                ))}
              </ul>
              {data.vocabulary.length === 0 && (
                <p className="text-sm text-[#AFAFAF]">No vocabulary rows for this chapter.</p>
              )}
            </section>

            <section className="rounded-2xl border-2 border-[#E5E5E5] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-[#58CC02] mb-4">Grammar</h2>
              {data.grammar.length === 0 ? (
                <p className="text-sm text-[#AFAFAF]">No grammar points for this chapter.</p>
              ) : (
                <ul className="space-y-6">
                  {data.grammar.map((g) => (
                    <li key={g.id} className="border border-[#F0F0F0] rounded-xl p-4 bg-[#FAFAFA]/50">
                      <h3 className="font-bold text-[#3C3C3C]">{g.grammar_title}</h3>
                      {g.structure && (
                        <p className="text-sm font-mono text-[#1CB0F6] mt-2 bg-white rounded-lg px-2 py-1 inline-block">
                          {g.structure}
                        </p>
                      )}
                      <p className="text-sm text-[#555] mt-3 leading-relaxed whitespace-pre-wrap">{g.explanation}</p>
                      {g.examples.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {g.examples.map((ex, i) => (
                            <li key={i} className="text-sm border-l-2 border-[#E5E5E5] pl-3">
                              <span className="text-[#111] font-medium">{ex.sentence}</span>
                              {ex.translation && (
                                <span className="text-[#777] block text-xs mt-0.5">{ex.translation}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
