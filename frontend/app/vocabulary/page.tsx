"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchVocabulary, deleteVocab } from "@/lib/api";
import NavBar from "@/components/NavBar";

const TONE_COLORS = ["text-gray-500", "text-red-500", "text-orange-500", "text-green-600", "text-blue-600"];
const MASTERY_LABELS = ["New", "Beginner", "Learning", "Familiar", "Mastered", "Expert"];
const MASTERY_COLORS = [
  "bg-gray-100 text-gray-600",
  "bg-red-100 text-red-600",
  "bg-orange-100 text-orange-600",
  "bg-yellow-100 text-yellow-700",
  "bg-green-100 text-green-700",
  "bg-emerald-100 text-emerald-700",
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
      setVocab(data as VocabEntry[]);
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
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📖 Vocabulary</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search word, pinyin, meaning..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <div className="flex gap-2">
            {(["all", 0, 1, 2, 3, 4, 5] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === level
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {level === "all" ? "All" : MASTERY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">{filtered.length} word{filtered.length !== 1 ? 's' : ''}</p>

        {/* Vocab list */}
        <div className="space-y-3">
          {filtered.map((v) => {
            const mastery = v.user_reviews?.[0]?.mastery_level ?? 0;
            const tones = v.tone_numbers?.split(" ") ?? [];

            return (
              <div key={v.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Word with tone coloring */}
                      <span className="text-2xl font-bold text-gray-800">
                        {v.word.split("").map((char, i) => {
                          const tone = parseInt(tones[i] ?? "0");
                          return (
                            <span key={i} className={TONE_COLORS[tone] ?? "text-gray-800"}>
                              {char}
                            </span>
                          );
                        })}
                      </span>
                      <span className="text-gray-500 text-sm">{v.pinyin}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MASTERY_COLORS[mastery]}`}>
                        {MASTERY_LABELS[mastery]}
                      </span>
                      {v.hsk_level && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          HSK {v.hsk_level}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-gray-700 text-sm">
                      {v.meaning_en}
                      {v.meaning_id && <span className="text-gray-400"> / {v.meaning_id}</span>}
                    </div>
                    {v.part_of_speech && (
                      <span className="text-xs text-gray-400 italic">{v.part_of_speech}</span>
                    )}
                    {v.example_sentence && (
                      <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                        {v.example_sentence}
                      </p>
                    )}
                    {v.memory_tip && (
                      <p className="mt-1 text-xs text-indigo-600">💡 {v.memory_tip}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors ml-4 text-lg"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-400 flex gap-4">
                  <span>Reviewed {v.user_reviews?.[0]?.review_count ?? 0}×</span>
                  <span>Avg score {(v.user_reviews?.[0]?.average_quality ?? 0).toFixed(1)}/5</span>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <div className="text-5xl mb-4">📭</div>
            <p>No words found. Paste Chinese text into Telegram to start learning!</p>
          </div>
        )}
      </main>
    </>
  );
}
