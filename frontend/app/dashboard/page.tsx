"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchStats,
  fetchGamificationProfile,
  fetchQuests,
  fetchPersonalizedStudyPlan,
  fetchSubscriptionPlans,
  linkTelegram,
} from "@/lib/api";
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

interface GamificationProfile {
  xp: number;
  level: number;
  hearts: number;
  subscription_tier: string;
  streak_days: number;
}

interface Quest {
  id: string;
  title: string;
  target: number;
  progress: number;
  reward_xp: number;
}

interface StudyPlan {
  streak_days: number;
  daily_goal_words: number;
  focus_words: { word: string; pinyin: string; meaning: string; reason: string }[];
  missions: { id: string; title: string; description: string; target: number; metric: string }[];
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price_idr: number;
  interval: string;
  features: string[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<string>("");
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLinking, setTelegramLinking] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSessionToken(session.access_token);
      try {
        const [s, p, q, sp, subs] = await Promise.all([
          fetchStats(session.access_token),
          fetchGamificationProfile(session.access_token),
          fetchQuests(session.access_token),
          fetchPersonalizedStudyPlan(session.access_token),
          fetchSubscriptionPlans(session.access_token),
        ]);
        setStats(s);
        setProfile(p);
        setQuests(q);
        setStudyPlan(sp);
        setSubscriptionPlans(subs);
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

  const handleLinkTelegram = async () => {
    const id = parseInt(telegramId.trim(), 10);
    if (!id || isNaN(id)) {
      setTelegramError("Please enter a valid Telegram numeric ID.");
      return;
    }
    if (!sessionToken) {
      setTelegramError("Session expired. Please refresh.");
      return;
    }
    setTelegramLinking(true);
    setTelegramError(null);
    try {
      await linkTelegram(sessionToken, id);
      setTelegramLinked(true);
      setToast("Telegram linked successfully! 🎉");
      setTimeout(() => setToast(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to link Telegram.";
      setTelegramError(msg);
    } finally {
      setTelegramLinking(false);
    }
  };

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

            {profile && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 duo-card">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#AFAFAF]">Level</div>
                  <div className="text-3xl font-black text-[#1CB0F6] mt-1">Lv {profile.level}</div>
                  <div className="text-sm font-semibold text-[#AFAFAF] mt-1">{profile.xp} XP total</div>
                </div>
                <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 duo-card">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#AFAFAF]">Learning Energy</div>
                  <div className="text-3xl font-black text-[#FF4B4B] mt-1">❤️ {profile.hearts}</div>
                  <div className="text-sm font-semibold text-[#AFAFAF] mt-1">Hearts left today</div>
                </div>
                <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 duo-card">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#AFAFAF]">Subscription</div>
                  <div className="text-3xl font-black text-[#58CC02] mt-1">
                    {profile.subscription_tier === "free" ? "Free" : "Pro"}
                  </div>
                  <div className="text-sm font-semibold text-[#AFAFAF] mt-1">
                    {profile.subscription_tier === "free" ? "Upgrade for unlimited practice" : "Premium learning active"}
                  </div>
                </div>
              </div>
            )}

            {studyPlan && (
              <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#3C3C3C]">Personalized Study Mission</h2>
                  <span className="text-xs font-bold text-[#58CC02]">Goal {studyPlan.daily_goal_words} words/day</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#AFAFAF] mb-2">Focus words</p>
                    <div className="space-y-2">
                      {studyPlan.focus_words.slice(0, 4).map((w) => (
                        <div key={w.word} className="rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5] px-3 py-2">
                          <p className="font-black text-[#3C3C3C]">{w.word} <span className="text-sm font-semibold text-[#AFAFAF]">{w.pinyin}</span></p>
                          <p className="text-xs text-[#AFAFAF]">{w.meaning} · {w.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#AFAFAF] mb-2">Missions</p>
                    <div className="space-y-2">
                      {studyPlan.missions.map((m) => (
                        <div key={m.id} className="rounded-2xl bg-[#F0FFF0] border border-[#B3F0B3] px-3 py-2">
                          <p className="font-black text-[#3C3C3C] text-sm">{m.title}</p>
                          <p className="text-xs text-[#58A700]">{m.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {quests.length > 0 && (
              <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#3C3C3C]">Daily Quests</h2>
                  <Link href="/leaderboard" className="text-xs font-black text-[#1CB0F6] uppercase tracking-wide">View Rank</Link>
                </div>
                <div className="space-y-3">
                  {quests.map((q) => {
                    const pct = Math.min(100, (q.progress / q.target) * 100);
                    return (
                      <div key={q.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-[#3C3C3C]">{q.title}</span>
                          <span className="text-xs font-bold text-[#AFAFAF]">{q.progress}/{q.target} · +{q.reward_xp} XP</span>
                        </div>
                        <div className="duo-progress">
                          <div className="duo-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

            {subscriptionPlans.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs font-black text-[#AFAFAF] uppercase tracking-widest mb-3">Upgrade your learning</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subscriptionPlans.map((plan) => (
                    <div key={plan.id} className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 duo-card">
                      <p className="text-lg font-black text-[#3C3C3C]">{plan.name}</p>
                      <p className="text-sm font-bold text-[#58CC02] mt-1">
                        Rp {plan.price_idr.toLocaleString("id-ID")} / {plan.interval}
                      </p>
                      <ul className="mt-3 space-y-1 text-xs text-[#AFAFAF] font-semibold">
                        {plan.features.slice(0, 3).map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                      <button className="mt-4 w-full bg-[#1CB0F6] text-white rounded-2xl py-2.5 text-xs font-black uppercase tracking-wide border-b-4 border-[#1199DD]">
                        Coming Soon
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connect Telegram */}
            <div className="mt-8 bg-white border-2 border-[#E5E5E5] rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📱</span>
                <h2 className="text-sm font-black uppercase tracking-wider text-[#3C3C3C]">Connect Telegram</h2>
                {telegramLinked && (
                  <span className="ml-auto text-xs font-black text-[#58CC02] uppercase tracking-wide">✓ Linked</span>
                )}
              </div>
              <p className="text-xs text-[#AFAFAF] font-semibold mb-4">
                Link your Telegram account so vocabulary you send to the bot syncs here automatically.
                Find your Telegram numeric ID via <span className="text-[#1CB0F6]">@userinfobot</span>.
              </p>
              {!telegramLinked ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 841875314"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    className="flex-1 border-2 border-[#E5E5E5] rounded-2xl px-4 py-2 text-sm font-semibold focus:outline-none focus:border-[#1CB0F6] text-[#3C3C3C]"
                  />
                  <button
                    onClick={handleLinkTelegram}
                    disabled={telegramLinking}
                    className="bg-[#1CB0F6] text-white rounded-2xl px-5 py-2 text-xs font-black uppercase tracking-wide border-b-4 border-[#1199DD] disabled:opacity-50"
                  >
                    {telegramLinking ? "Linking…" : "Link"}
                  </button>
                </div>
              ) : (
                <div className="bg-[#F0FFF0] border border-[#B3F0B3] rounded-2xl px-4 py-3 text-sm font-bold text-[#58A700]">
                  ✅ Telegram ID {telegramId} linked. Vocab from bot will appear here!
                </div>
              )}
              {telegramError && (
                <p className="mt-2 text-xs font-bold text-[#FF4B4B]">{telegramError}</p>
              )}
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


