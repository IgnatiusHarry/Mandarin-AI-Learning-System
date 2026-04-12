"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchVocabulary, deleteVocab } from "@/lib/api";
import NavBar from "@/components/NavBar";

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
  user_reviews?: { mastery_level: number; review_count: number; average_quality: number }[];
}

export default function VocabularyPage() {
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<number | "all">("all");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);
      const data = await fetchVocabulary(session.access_token);
      setVocab(data as unknown as VocabEntry[]);
    };
    load();
  }, []);

  const filtered = vocab.filter((v) => {
    const matchSearch =
      !search ||
      v.word.includes(search) ||
      v.pinyin.toLowerCase().includes(search.toLowerCase()) ||
      (v.meaning_en ?? "").toLowerCase().includes(search.toLowerCase());
    const mastery = v.user_reviews?.[0]?.mastery_level ?? 0;
    const matchFilter = filter === "all" || mastery === filter;
    return matchSearch && matchFilter;
  });

  const handleDelete = async (id: string) => {
    if (!token || !confirm("Delete this word?")) return;
    await deleteVocab(token, id);
    setVocab((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <h1 className="text-2xl font-black text-[#3C3C3C] mb-6">📖 Vocabulary</h1>

        {/* Search + filter */}
        <div className="flex flex-col gap-3 mb-6">
          <input
            type="text"
            placeholder="Search word, pinyin, meaning..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-2 border-[#E5E5E5] rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#58CC02] transition-colors bg-white"
          />
          <div className="flex flex-wrap gap-2">
            {(["all", 0, 1, 2, 3, 4, 5] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border-2 ${
                  filter === level
                    ? "bg-[#58CC02] text-white border-[#58A700]"
                    : "bg-white text-[#AFAFAF] border-[#E5E5E5] hover:border-[#58CC02] hover:text-[#58CC02]"
                }`}
              >
                {level === "all" ? "All" : MASTERY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider mb-4">
          {filtered.length} word{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Vocab list */}
        <div className="space-y-3">
          {filtered.map((v) => {
            const mastery = v.user_reviews?.[0]?.mastery_level ?? 0;
            const tones = v.tone_numbers?.split(" ") ?? [];

            return (
              <div
                key={v.id}
                className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 duo-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Word header row */}
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
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${MASTERY_COLORS[mastery]}`}>
                        {MASTERY_LABELS[mastery]}
                      </span>
                      {v.hsk_level && (
                        <span className="text-xs bg-[#EDF9FF] text-[#1CB0F6] border border-[#B3E5FC] px-2.5 py-0.5 rounded-full font-bold">
                          HSK {v.hsk_level}
                        </span>
                      )}
                    </div>

                    {/* Meaning */}
                    <div className="text-[#3C3C3C] text-sm font-medium">
                      {v.meaning_en}
                      {v.meaning_id && (
                        <span className="text-[#AFAFAF]"> / {v.meaning_id}</span>
                      )}
                    </div>
                    {v.part_of_speech && (
                      <span className="text-xs text-[#AFAFAF] italic">{v.part_of_speech}</span>
                    )}

                    {/* Example sentence */}
                    {v.example_sentence && (
                      <p className="mt-2 text-sm text-[#3C3C3C] bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl px-3 py-2">
                        {v.example_sentence}
                      </p>
                    )}
                    {v.memory_tip && (
                      <p className="mt-1.5 text-xs text-[#CE82FF] font-medium">💡 {v.memory_tip}</p>
                    )}

                    {/* Stats */}
                    <div className="mt-2 text-xs text-[#AFAFAF] flex gap-4 font-medium">
                      <span>Reviewed {v.user_reviews?.[0]?.review_count ?? 0}×</span>
                      <span>Avg {(v.user_reviews?.[0]?.average_quality ?? 0).toFixed(1)}/5</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(v.id)}
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
              No words found.
            </p>
            <p className="text-[#AFAFAF] text-sm mt-2">
              Send Chinese text to your Telegram bot to start building your vocabulary!
            </p>
          </div>
        )}
      </main>
    </>
  );
}

