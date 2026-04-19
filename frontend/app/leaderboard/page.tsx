"use client";

import useSWR from "swr";
import { fetchLeaderboard } from "@/lib/api";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/lib/auth-context";
import { learnerKeys } from "@/lib/learner-keys";

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  streak_days: number;
  mastered_words: number;
  reviews_30d: number;
  score: number;
}

export default function LeaderboardPage() {
  const { token, ready } = useAuth();
  const { data, isLoading } = useSWR(
    ready && token ? learnerKeys.leaderboard(token) : null,
    (key) => fetchLeaderboard(key[2] as string)
  );
  const rows = data ?? [];
  const loading = ready && Boolean(token) && isLoading && !data;

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-mobile-main">
        <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🏆</div>
            <h1 className="text-2xl font-black text-[#3C3C3C]">Community Leaderboard</h1>
            <p className="text-[#AFAFAF] text-sm mt-1">Compete with consistency, not speed.</p>
          </div>

          {loading ? (
            <p className="text-center text-[#AFAFAF] font-semibold py-10">Loading leaderboard...</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-[#AFAFAF] font-semibold py-10">No ranking data yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div
                  key={r.user_id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-[#E5E5E5] px-4 py-3"
                >
                  <div className="w-8 text-center font-black text-[#58CC02]">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#3C3C3C] truncate">{r.display_name}</p>
                    <p className="text-xs text-[#AFAFAF]">
                      🔥 {r.streak_days} streak • ✅ {r.reviews_30d} reviews/30d • 📚 {r.mastered_words} mastered
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[#1CB0F6] font-black text-lg">{r.score}</div>
                    <div className="text-[10px] text-[#AFAFAF] uppercase tracking-wide font-bold">Score</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
