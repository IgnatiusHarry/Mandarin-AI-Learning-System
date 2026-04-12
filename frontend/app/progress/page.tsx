"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchReviewHistory, fetchMasteryDistribution, fetchStats } from "@/lib/api";
import NavBar from "@/components/NavBar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const MASTERY_LABELS = ["New", "Beginner", "Learning", "Familiar", "Mastered", "Expert"];
const MASTERY_CHART_COLORS = [
  "#AFAFAF",
  "#FF4B4B",
  "#FF9600",
  "#FFC800",
  "#58CC02",
  "#1CB0F6",
];

export default function ProgressPage() {
  const [history, setHistory] = useState<{ goal_date: string; actual_new_words: number; actual_reviews: number }[]>([]);
  const [masteryDist, setMasteryDist] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<{ streak_days: number; total_words: number; mastered_words: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const tok = session.access_token;
      const [h, m, s] = await Promise.all([
        fetchReviewHistory(tok, 30),
        fetchMasteryDistribution(tok),
        fetchStats(tok),
      ]);
      setHistory([...h].reverse());
      setMasteryDist(m);
      setStats(s);
      setLoading(false);
    };
    load();
  }, []);

  const masteryPieData = Object.entries(masteryDist)
    .map(([level, count]) => ({
      name: MASTERY_LABELS[parseInt(level)] ?? level,
      value: count,
      color: MASTERY_CHART_COLORS[parseInt(level)] ?? "#AFAFAF",
    }))
    .filter((d) => d.value > 0);

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="max-w-3xl mx-auto px-4 py-20 text-center">
          <div className="text-5xl animate-bounce mb-4">🦉</div>
          <p className="text-[#AFAFAF] font-bold uppercase tracking-wider">Loading...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8 space-y-6">
        <h1 className="text-2xl font-black text-[#3C3C3C]">📈 Progress</h1>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { emoji: "🔥", value: stats.streak_days, label: "Day Streak", color: "text-[#FF9600]", bg: "bg-[#FFF4E0] border-[#FFD699]" },
              { emoji: "📚", value: stats.total_words, label: "Total Words", color: "text-[#1CB0F6]", bg: "bg-[#EDF9FF] border-[#B3E5FC]" },
              { emoji: "⭐", value: stats.mastered_words, label: "Mastered", color: "text-[#58CC02]", bg: "bg-[#F0FFF0] border-[#B3F0B3]" },
            ].map(({ emoji, value, label, color, bg }) => (
              <div key={label} className={`${bg} border-2 rounded-3xl p-4 text-center`}>
                <div className="text-2xl mb-1">{emoji}</div>
                <div className={`text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wide mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Daily reviews bar chart */}
        <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-6">
          <h2 className="font-black text-[#3C3C3C] text-sm uppercase tracking-wider mb-5">
            Daily Reviews — Last 30 Days
          </h2>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={history} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                <XAxis
                  dataKey="goal_date"
                  tick={{ fontSize: 10, fill: "#AFAFAF", fontWeight: 700 }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#AFAFAF", fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    border: "2px solid #E5E5E5",
                    borderRadius: "12px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                  labelFormatter={(v) => `Date: ${v}`}
                  formatter={(value, name) => [
                    value,
                    name === "actual_reviews" ? "Reviews" : "New Words",
                  ]}
                />
                <Bar dataKey="actual_reviews" fill="#58CC02" radius={[6, 6, 0, 0]} name="Reviews" />
                <Bar dataKey="actual_new_words" fill="#1CB0F6" radius={[6, 6, 0, 0]} name="New Words" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">📊</div>
              <p className="text-[#AFAFAF] font-bold text-sm">No review history yet</p>
              <p className="text-[#AFAFAF] text-xs mt-1">Complete your first review session to see progress!</p>
            </div>
          )}
        </div>

        {/* Mastery distribution donut */}
        <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-6">
          <h2 className="font-black text-[#3C3C3C] text-sm uppercase tracking-wider mb-5">
            Mastery Distribution
          </h2>
          {masteryPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={masteryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {masteryPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => (
                    <span style={{ color: "#3C3C3C", fontWeight: 700, fontSize: 12 }}>{value}</span>
                  )}
                />
                <Tooltip
                  contentStyle={{
                    border: "2px solid #E5E5E5",
                    borderRadius: "12px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">🥧</div>
              <p className="text-[#AFAFAF] font-bold text-sm">No vocabulary data yet</p>
              <p className="text-[#AFAFAF] text-xs mt-1">Start adding words to see mastery breakdown!</p>
            </div>
          )}
        </div>

        {/* Mastery legend */}
        <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5">
          <h2 className="font-black text-[#3C3C3C] text-sm uppercase tracking-wider mb-4">Mastery Levels</h2>
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
      </main>
    </>
  );
}

