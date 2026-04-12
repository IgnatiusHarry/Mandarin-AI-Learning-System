"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchReviewHistory, fetchMasteryDistribution, fetchStats } from "@/lib/api";
import NavBar from "@/components/NavBar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";

const MASTERY_LABELS = ["New", "Beginner", "Learning", "Familiar", "Mastered", "Expert"];
const MASTERY_CHART_COLORS = ["#94a3b8", "#f87171", "#fb923c", "#facc15", "#4ade80", "#34d399"];

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
      setHistory([...h].reverse()); // oldest first for charts
      setMasteryDist(m);
      setStats(s);
      setLoading(false);
    };
    load();
  }, []);

  const masteryPieData = Object.entries(masteryDist).map(([level, count]) => ({
    name: MASTERY_LABELS[parseInt(level)] ?? level,
    value: count,
    color: MASTERY_CHART_COLORS[parseInt(level)] ?? "#94a3b8",
  })).filter((d) => d.value > 0);

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 py-20 text-center text-gray-400">Loading...</main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-800">📈 Learning Progress</h1>

        {/* Summary row */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">🔥 {stats.streak_days}</div>
              <div className="text-sm text-orange-500 mt-1">Day Streak</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total_words}</div>
              <div className="text-sm text-blue-500 mt-1">Total Words</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.mastered_words}</div>
              <div className="text-sm text-green-500 mt-1">Mastered</div>
            </div>
          </div>
        )}

        {/* Daily reviews bar chart */}
        <div className="bg-white border rounded-2xl p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Daily Reviews (last 30 days)</h2>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="goal_date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)} // MM-DD
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={(v) => `Date: ${v}`}
                  formatter={(value, name) => [value, name === "actual_reviews" ? "Reviews" : "New Words"]}
                />
                <Bar dataKey="actual_reviews" fill="#ef4444" radius={[4, 4, 0, 0]} name="Reviews" />
                <Bar dataKey="actual_new_words" fill="#3b82f6" radius={[4, 4, 0, 0]} name="New Words" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">No review history yet</p>
          )}
        </div>

        {/* Mastery distribution donut */}
        <div className="bg-white border rounded-2xl p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Mastery Distribution</h2>
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
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {masteryPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">No vocabulary data yet</p>
          )}
        </div>
      </main>
    </>
  );
}
