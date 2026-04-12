"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchStats } from "@/lib/api";
import { subscribeToVocabChanges } from "@/lib/supabase/realtime";
import NavBar from "@/components/NavBar";
import Link from "next/link";

interface Stats {
  total_words: number;
  mastered_words: number;
  weak_words: number;
  due_today: number;
  streak_days: number;
  words_reviewed_today: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const s = await fetchStats(session.access_token);
        setStats(s);
      } catch {}
    };
    load();

    const unsubscribe = subscribeToVocabChanges((word) => {
      const w = word as { word?: string };
      setToast(`"${w.word ?? "新詞"}" added from Telegram!`);
      setTimeout(() => setToast(null), 4000);
      load();
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <NavBar />

      {toast && (
        <div className="fixed top-4 right-4 bg-[#58CC02] text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-bold z-50 flex items-center gap-2 border-b-2 border-[#58A700]">
          ✅ {toast}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">

        {stats ? (
          <>
            {/* Streak banner */}
            {stats.streak_days > 0 && (
              <div className="bg-[#FFF3CD] border-2 border-[#FFC800] rounded-3xl p-5 mb-6 flex items-center gap-4">
                <div className="text-5xl">🔥</div>
                <div>
                  <p className="font-black text-[#9C7700] text-lg">{stats.streak_days} day streak!</p>
                  <p className="text-[#9C7700] text-sm font-medium">Keep it up — don't break the chain!</p>
                </div>
              </div>
            )}

            {/* Daily progress */}
            <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-[#AFAFAF] uppercase tracking-wide">Daily Goal</span>
                <span className="text-sm font-bold text-[#3C3C3C]">{stats.words_reviewed_today} / 10 reviews</span>
              </div>
              <div className="duo-progress">
                <div
                  className="duo-progress-fill"
                  style={{ width: `${Math.min(100, (stats.words_reviewed_today / 10) * 100)}%` }}
                />
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              <StatCard icon="🔥" label="Streak" value={stats.streak_days} suffix="days" accent="#FF9600" />
              <StatCard icon="📚" label="Total Words" value={stats.total_words} accent="#1CB0F6" />
              <StatCard icon="🏆" label="Mastered" value={stats.mastered_words} accent="#58CC02" />
              <StatCard icon="📋" label="Due Today" value={stats.due_today} accent="#FF4B4B" />
              <StatCard icon="✅" label="Reviewed" value={stats.words_reviewed_today} accent="#58CC02" />
              <StatCard icon="⚠️" label="Need Work" value={stats.weak_words} accent="#FFC800" />
            </div>

            {/* Action cards */}
            <h2 className="text-xs font-black text-[#AFAFAF] uppercase tracking-widest mb-3">What to do next</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionCard
                href="/review"
                emoji="📚"
                title="Start Review"
                desc={stats.due_today > 0 ? `${stats.due_today} card${stats.due_today !== 1 ? "s" : ""} waiting` : "All caught up!"}
                color="#58CC02"
                disabled={stats.due_today === 0}
              />
              <ActionCard
                href="/conversation"
                emoji="💬"
                title="Chat with 小明"
                desc="Practice real conversation"
                color="#1CB0F6"
              />
              <ActionCard
                href="/vocabulary"
                emoji="📖"
                title="My Words"
                desc={`${stats.total_words} word${stats.total_words !== 1 ? "s" : ""} collected`}
                color="#CE82FF"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="text-5xl animate-bounce">🦉</div>
            <p className="text-[#AFAFAF] font-semibold">Loading your progress...</p>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, accent, suffix }: {
  icon: string; label: string; value: number; accent: string; suffix?: string;
}) {
  return (
    <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 duo-card">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-black text-[#3C3C3C] leading-none">
        {value}
        {suffix && <span className="text-base font-bold text-[#AFAFAF] ml-1">{suffix}</span>}
      </div>
      <div className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function ActionCard({ href, emoji, title, desc, color, disabled }: {
  href: string; emoji: string; title: string; desc: string; color: string; disabled?: boolean;
}) {
  return (
    <Link
      href={disabled ? "#" : href}
      className={`group block bg-white border-2 border-[#E5E5E5] rounded-3xl p-6 transition-all duo-card ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:border-[#E5E5E5]"
      }`}
      style={disabled ? {} : { borderColor: "#E5E5E5" }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4"
        style={{ backgroundColor: `${color}18` }}
      >
        {emoji}
      </div>
      <div className="font-black text-[#3C3C3C] text-base">{title}</div>
      <div className="text-sm text-[#AFAFAF] font-medium mt-0.5">{desc}</div>
      {!disabled && (
        <div
          className="mt-4 text-xs font-black uppercase tracking-wide"
          style={{ color }}
        >
          Start →
        </div>
      )}
    </Link>
  );
}


