"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetchVocabulary, fetchWeakWords, deleteVocab } from "@/lib/api";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/lib/auth-context";
import { learnerKeys } from "@/lib/learner-keys";
import {
  cleanMeaningField,
  formatBookPlacement,
  mergePlacements,
} from "@/lib/vocabDisplay";

const TONE_COLORS = [
  "text-[#AFAFAF]",
  "text-[#FF4B4B]",
  "text-[#FF9600]",
  "text-[#58CC02]",
  "text-[#1CB0F6]",
];

const MASTERY_LABELS = ["New", "Beginner", "Learning", "Familiar", "Mastered", "Expert"];
const MASTERY_COLORS = [
  "bg-[#F7F7F7] text-[#AFAFAF] border border-[#E5E5E5]",
  "bg-[#FFF0F0] text-[#FF4B4B] border border-[#FFCCCC]",
  "bg-[#FFF4E0] text-[#FF9600] border border-[#FFD699]",
  "bg-[#FFFBE0] text-[#CC9F00] border border-[#FFE680]",
  "bg-[#F0FFF0] text-[#58A700] border border-[#B3F0B3]",
  "bg-[#EDF9FF] text-[#0099DB] border border-[#B3E5FC]",
];

interface VocabEntry {
  id: string;
  word: string;
  pinyin: string;
  tone_numbers?: string;
  meaning_en?: string;
  meaning_id?: string;
  part_of_speech?: string;
  hsk_level?: number;
  example_sentence?: string;
  memory_tip?: string;
  user_reviews?: {
    mastery_level: number;
    review_count: number;
    average_quality: number;
    next_review_at?: string;
  }[];
}

interface WeakRow {
  average_quality: number;
  review_count: number;
  next_review_at?: string;
  vocabulary?: {
    id?: string;
    word?: string;
    pinyin?: string;
    meaning_en?: string;
  };
}

function formatNextReview(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VocabularyPage() {
  const { token, ready } = useAuth();
  const vocabSwr = useSWR(
    ready && token ? learnerKeys.vocabulary(token) : null,
    (key) => fetchVocabulary(key[2] as string)
  );
  const weakSwr = useSWR(
    ready && token ? learnerKeys.weakWords(token) : null,
    (key) => fetchWeakWords(key[2] as string)
  );

  const vocab = (vocabSwr.data as unknown as VocabEntry[] | undefined) ?? [];
  const weakRows = (weakSwr.data as unknown as WeakRow[] | undefined) ?? [];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<number | "all">("all");

  const masteryCounts = useMemo(() => {
    const c: number[] = [0, 0, 0, 0, 0, 0];
    for (const v of vocab) {
      const m = v.user_reviews?.[0]?.mastery_level ?? 0;
      if (m >= 0 && m <= 5) {
        c[m] += 1;
      }
    }
    return c;
  }, [vocab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vocab.filter((v) => {
      const en = cleanMeaningField(v.meaning_en).text.toLowerCase();
      const id = cleanMeaningField(v.meaning_id).text.toLowerCase();
      const matchSearch =
        !q ||
        v.word.includes(search.trim()) ||
        v.pinyin.toLowerCase().includes(q) ||
        en.includes(q) ||
        id.includes(q);
      const mastery = v.user_reviews?.[0]?.mastery_level ?? 0;
      const matchFilter = filter === "all" || mastery === filter;
      return matchSearch && matchFilter;
    });
  }, [vocab, search, filter]);

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Delete this word?")) {
      return;
    }
    await deleteVocab(token, id);
    await Promise.all([vocabSwr.mutate(), weakSwr.mutate()]);
  };

  const filterEmptyButHasWords = vocab.length > 0 && filtered.length === 0;

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-mobile-main" lang="zh-Hant">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-black text-[#3C3C3C]">📖 Vocabulary</h1>
          {vocabSwr.isValidating && vocab.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wide text-[#58CC02]">
              Syncing…
            </span>
          )}
        </div>

        {/* SRS / forgetting radar */}
        <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 mb-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#3C3C3C]">
                Retention (SRS)
              </h2>
              <p className="text-xs text-[#AFAFAF] font-semibold mt-1 max-w-xl">
                Kata di bawah punya rata-rata jawaban self-rating &lt; 3 setelah ≥3 review — sistem
                menjadwalkan ulang lewat <strong>next review</strong> (algoritma spaced repetition,
                lihat <code className="text-[#58CC02]">PLAN.md</code> bagian SM-2). Lanjutkan di
                Review supaya jadwal ingat otomatis terisi.
              </p>
            </div>
            <Link
              href="/review"
              className="shrink-0 bg-[#58CC02] text-white text-xs font-black uppercase tracking-wide rounded-2xl px-4 py-2.5 border-b-4 border-[#58A700]"
            >
              Open review →
            </Link>
          </div>
          {weakRows.length === 0 ? (
            <p className="text-sm font-medium text-[#AFAFAF]">
              Belum ada kata &quot;rawan lupa&quot; menurut SRS — bagus! Tetap review kartu jatuh
              tempo supaya tetap ingat.
            </p>
          ) : (
            <ul className="space-y-2">
              {weakRows.slice(0, 8).map((row, idx) => {
                const w = row.vocabulary;
                if (!w?.word) {
                  return null;
                }
                return (
                  <li
                    key={`${w.id ?? w.word}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FFF8F0] border border-[#FFD699] px-3 py-2 text-sm"
                  >
                    <span className="font-black text-[#3C3C3C]">
                      {w.word}{" "}
                      <span className="text-[#AFAFAF] font-semibold text-xs">{w.pinyin}</span>
                    </span>
                    <span className="text-xs font-bold text-[#CC7A00]">
                      Avg {row.average_quality?.toFixed(1) ?? "?"}/5 · {row.review_count}×
                      {formatNextReview(row.next_review_at)
                        ? ` · next ${formatNextReview(row.next_review_at)}`
                        : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Search + filter */}
        <p className="text-xs text-[#AFAFAF] font-medium leading-relaxed mb-2">
          <strong className="text-[#3C3C3C]">Tingkat di sini = hasil SRS</strong> (jarak review berikutnya), bukan
          tingkat buku/HSK. <strong>New</strong> = belum pernah sukses review atau baru gagal. Setelah beberapa review
          lulus, kata pindah ke <strong>Beginner</strong> dst. Kalau semua masih di New, lanjutkan sesi{" "}
          <Link href="/review" className="text-[#58CC02] font-bold underline">
            Review
          </Link>
          .
        </p>

        <div className="flex flex-col gap-3 mb-6">
          <input
            type="text"
            placeholder="Search word, pinyin, English / Indonesian meaning..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-2 border-[#E5E5E5] rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#58CC02] transition-colors bg-white"
          />
          <div className="flex flex-wrap gap-2">
            {(["all", 0, 1, 2, 3, 4, 5] as const).map((level) => {
              const count =
                level === "all" ? vocab.length : masteryCounts[level] ?? 0;
              const label =
                level === "all" ? "All" : `${MASTERY_LABELS[level]} (${count})`;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFilter(level)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border-2 ${
                    filter === level
                      ? "bg-[#58CC02] text-white border-[#58A700]"
                      : "bg-white text-[#AFAFAF] border-[#E5E5E5] hover:border-[#58CC02] hover:text-[#58CC02]"
                  }`}
                >
                  {level === "all" ? `All (${count})` : label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider mb-4">
          {filtered.length} word{filtered.length !== 1 ? "s" : ""} shown
        </p>

        {/* Vocab list */}
        <div className="space-y-3">
          {filtered.map((v) => {
            const mastery = v.user_reviews?.[0]?.mastery_level ?? 0;
            const tones = v.tone_numbers?.split(" ") ?? [];
            const enField = cleanMeaningField(v.meaning_en);
            const idField = cleanMeaningField(v.meaning_id);
            const placement = mergePlacements(enField.placement, idField.placement);
            const cleanEn = enField.text;
            const cleanId = idField.text;
            const cleanPos = cleanMeaningField(v.part_of_speech).text;
            const cleanExample = cleanMeaningField(v.example_sentence).text;
            const cleanTip = cleanMeaningField(v.memory_tip).text;
            const nextAt = formatNextReview(v.user_reviews?.[0]?.next_review_at);

            return (
              <div
                key={v.id}
                className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 duo-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-2xl font-black">
                        {v.word.split("").map((char, i) => {
                          const tone = parseInt(tones[i] ?? "0");
                          return (
                            <span key={i} className={TONE_COLORS[tone] ?? "text-[#3C3C3C]"}>
                              {char}
                            </span>
                          );
                        })}
                      </span>
                      <span className="text-[#AFAFAF] text-sm font-medium">{v.pinyin}</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${MASTERY_COLORS[mastery]}`}
                      >
                        {MASTERY_LABELS[mastery]}
                      </span>
                      {placement && (
                        <span className="text-xs bg-[#F3E8FF] text-[#7B2CBF] border border-[#D8B4FE] px-2.5 py-0.5 rounded-full font-bold">
                          📘 {formatBookPlacement(placement)}
                        </span>
                      )}
                      {v.hsk_level ? (
                        <span className="text-xs bg-[#EDF9FF] text-[#1CB0F6] border border-[#B3E5FC] px-2.5 py-0.5 rounded-full font-bold">
                          HSK {v.hsk_level}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-[#3C3C3C] text-sm font-medium">
                      {cleanEn || "—"}
                      {cleanId ? (
                        <span className="text-[#AFAFAF]"> / {cleanId}</span>
                      ) : null}
                    </div>
                    {cleanPos ? (
                      <span className="text-xs text-[#AFAFAF] italic">{cleanPos}</span>
                    ) : null}

                    {cleanExample ? (
                      <p className="mt-2 text-sm text-[#3C3C3C] bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl px-3 py-2">
                        {cleanExample}
                      </p>
                    ) : null}
                    {cleanTip ? (
                      <p className="mt-1.5 text-xs text-[#CE82FF] font-medium">💡 {cleanTip}</p>
                    ) : null}

                    <div className="mt-2 text-xs text-[#AFAFAF] flex flex-wrap gap-x-4 gap-y-1 font-medium">
                      <span>Reviewed {v.user_reviews?.[0]?.review_count ?? 0}×</span>
                      <span>
                        Avg {(v.user_reviews?.[0]?.average_quality ?? 0).toFixed(1)}/5
                      </span>
                      {nextAt ? <span>Next review · {nextAt}</span> : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDelete(v.id)}
                    className="text-[#E5E5E5] hover:text-[#FF4B4B] transition-colors text-2xl leading-none flex-shrink-0 mt-1"
                    title="Delete word"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-[#AFAFAF] font-bold text-sm uppercase tracking-wide">
              {vocab.length === 0 ? "No words yet." : "No words in this filter."}
            </p>
            <p className="text-[#AFAFAF] text-sm mt-2 max-w-md mx-auto">
              {vocab.length === 0
                ? "Send Chinese text to your Telegram bot (or add words in the app) to build your deck."
                : filterEmptyButHasWords
                  ? "Coba tab “All” atau level lain — banyak kosakata baru masuk di “New”."
                  : "Try a different search."}
            </p>
            {filterEmptyButHasWords ? (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-6 inline-block bg-[#58CC02] text-white text-xs font-black uppercase tracking-wide rounded-2xl px-6 py-2.5 border-b-4 border-[#58A700]"
              >
                Show all ({vocab.length})
              </button>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}
