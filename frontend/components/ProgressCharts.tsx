"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type HistoryRow = {
  goal_date: string;
  actual_new_words: number;
  actual_reviews: number;
};

type PieRow = { name: string; value: number; color: string };

export default function ProgressCharts({
  history,
  masteryPieData,
}: {
  history: HistoryRow[];
  masteryPieData: PieRow[];
}) {
  return (
    <>
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
            <p className="text-[#AFAFAF] text-xs mt-1">
              Complete your first review session to see progress!
            </p>
          </div>
        )}
      </div>

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
    </>
  );
}
