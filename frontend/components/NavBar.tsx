"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  fetchStats,
  fetchVocabulary,
  fetchReviewHistory,
  fetchMasteryDistribution,
  fetchLeaderboard,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { learnerKeys } from "@/lib/learner-keys";

const navItems = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/review", label: "Review", icon: "📚" },
  { href: "/vocabulary", label: "Words", icon: "📖" },
  { href: "/books", label: "Books", icon: "📗" },
  { href: "/conversation", label: "Chat", icon: "💬" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/leaderboard", label: "Rank", icon: "🏆" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = useAuth();

  const prefetchForHref = (href: string) => {
    if (!token) {
      return;
    }
    if (href === "/dashboard" || href === "/review" || href === "/progress") {
      void mutate(learnerKeys.stats(token), () => fetchStats(token));
    }
    if (href === "/vocabulary") {
      void mutate(learnerKeys.vocabulary(token), () => fetchVocabulary(token));
    }
    if (href === "/progress") {
      void mutate(learnerKeys.reviewHistory(token, 30), () =>
        fetchReviewHistory(token, 30)
      );
      void mutate(learnerKeys.masteryDistribution(token), () =>
        fetchMasteryDistribution(token)
      );
    }
    if (href === "/leaderboard") {
      void mutate(learnerKeys.leaderboard(token), () => fetchLeaderboard(token));
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Top bar */}
      <nav className="bg-white border-b-2 border-[#E5E5E5] sticky top-0 z-40 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 flex items-center justify-between min-h-14 h-14">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 min-h-11 min-w-11 shrink-0 -ml-1 pl-1 pr-2 rounded-xl active:bg-[#F7F7F7]"
          >
            <span className="text-2xl">🦉</span>
            <span className="text-lg sm:text-xl font-black text-[#58CC02] tracking-tight">
              明老師
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => prefetchForHref(item.href)}
                  onFocus={() => prefetchForHref(item.href)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold transition-all border-b-2 ${
                    active
                      ? "text-[#58CC02] border-[#58CC02] bg-[#58CC02]/10"
                      : "text-[#AFAFAF] border-transparent hover:text-[#58CC02] hover:bg-[#58CC02]/5"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="uppercase tracking-wide text-xs">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="text-[#AFAFAF] hover:text-[#FF4B4B] text-[10px] sm:text-sm font-bold uppercase tracking-wide transition-colors min-h-11 min-w-[2.75rem] sm:min-w-11 px-2 sm:px-3 rounded-xl active:bg-[#FFF5F5]"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-[#E5E5E5] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onMouseEnter={() => prefetchForHref(item.href)}
                onFocus={() => prefetchForHref(item.href)}
                className={`flex-1 flex flex-col items-center justify-center min-h-[52px] py-1.5 gap-0.5 transition-colors active:opacity-80 ${
                  active ? "text-[#58CC02]" : "text-[#AFAFAF]"
                }`}
              >
                <span className="text-[1.35rem] leading-none">{item.icon}</span>
                <span
                  className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-tight leading-tight text-center px-0.5 ${
                    active ? "text-[#58CC02]" : "text-[#AFAFAF]"
                  }`}
                >
                  {item.label}
                </span>
                {active ? (
                  <div className="w-6 h-0.5 rounded-full bg-[#58CC02] shrink-0" />
                ) : (
                  <div className="h-0.5 shrink-0" aria-hidden />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

