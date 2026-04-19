"use client";

import dynamic from "next/dynamic";
import useSWR from "swr";
import { fetchReviewHistory, fetchMasteryDistribution, fetchStats } from "@/lib/api";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/lib/auth-context";
import { learnerKeys } from "@/lib/learner-keys";

const MASTERY_LABELS = ["New", "Beginner", "Learning", "Familiar", "Mastered", "Expert"];
const MASTERY_CHART_COLORS = [
  "#AFAFAF",
  "#FF4B4B",
  "#FF9600",
  "#FFC800",
  "#58CC02",
  "#1CB0F6",
];

const HISTORY_DAYS = 30;

const ProgressCharts = dynamic(() => import("@/components/ProgressCharts"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="h-[220px] rounded-3xl bg-[#ECECEC] border-2 border-[#E5E5E5] animate-pulse" />
      <div className="h-[280px] rounded-3xl bg-[#ECECEC] border-2 border-[#E5E5E5] animate-pulse" />
    </div>
  ),
});

export default function ProgressPage() {
  const { token, ready } = useAuth();

  const historySwr = useSWR(
    ready && token ? learnerKeys.reviewHistory(token, HISTORY_DAYS) : null,
    (key) => fetchReviewHistory(key[2] as string, key[3] as number)
  );
  const masterySwr = useSWR(
    ready && token ? learnerKeys.masteryDistribution(token) : null,
    (key) => fetchMasteryDistribution(key[2] as string)
  );
  const statsSwr = useSWR(
    ready && token ? learnerKeys.stats(token) : null,
    (key) => fetchStats(key[2] as string)
  );

  const history = [...(historySwr.data ?? [])].reverse();
  const masteryDist = masterySwr.data ?? {};
  const stats = statsSwr.data ?? null;

  const statsSkeleton =
    ready && Boolean(token) && !stats && (statsSwr.isLoading || statsSwr.isValidating);

  const masteryPieData = Object.entries(masteryDist)
    .map(([level, count]) => ({
      name: MASTERY_LABELS[parseInt(level)] ?? level,
      value: count,
      color: MASTERY_CHART_COLORS[parseInt(level)] ?? "#AFAFAF",
    }))
    .filter((d) => d.value > 0);

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-mobile-main space-y-6">
        <h1 className="text-2xl font-black text-[#3C3C3C]">📈 Progress</h1>

        {statsSkeleton ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-3xl bg-[#ECECEC] border-2 border-[#E5E5E5] animate-pulse"
              />
            ))}
          </div>
        ) : null}

        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                emoji: "🔥",
                value: stats.streak_days,
                label: "Day Streak",
                color: "text-[#FF9600]",
                bg: "bg-[#FFF4E0] border-[#FFD699]",
              },
              {
                emoji: "📚",
                value: stats.total_words,
                label: "Total Words",
                color: "text-[#1CB0F6]",
                bg: "bg-[#EDF9FF] border-[#B3E5FC]",
              },
              {
                emoji: "⭐",
                value: stats.mastered_words,
                label: "Mastered",
                color: "text-[#58CC02]",
                bg: "bg-[#F0FFF0] border-[#B3F0B3]",
              },
            ].map(({ emoji, value, label, color, bg }) => (
              <div key={label} className={`${bg} border-2 rounded-3xl p-4 text-center`}>
                <div className="text-2xl mb-1">{emoji}</div>
                <div className={`text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wide mt-1">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {ready && token ? (
          <ProgressCharts history={history} masteryPieData={masteryPieData} />
        ) : (
          <p className="text-center text-[#AFAFAF] text-sm font-semibold py-8">
            Sign in to see progress.
          </p>
        )}

        {ready && token ? (
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5">
            <h2 className="font-black text-[#3C3C3C] text-sm uppercase tracking-wider mb-4">
              Mastery Levels
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {MASTERY_LABELS.map((label, i) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: MASTERY_CHART_COLORS[i] }}
                  />
                  <span className="text-sm font-bold text-[#3C3C3C]">{label}</span>
                  <span className="text-xs text-[#AFAFAF] font-medium">
                    {masteryDist[i] ?? 0} word{(masteryDist[i] ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
