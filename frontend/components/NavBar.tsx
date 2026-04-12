"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/review", label: "Review", icon: "📚" },
  { href: "/vocabulary", label: "Words", icon: "📖" },
  { href: "/conversation", label: "Chat", icon: "💬" },
  { href: "/progress", label: "Progress", icon: "📈" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Top bar */}
      <nav className="bg-white border-b-2 border-[#E5E5E5] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🦉</span>
            <span className="text-xl font-black text-[#58CC02] tracking-tight">明老師</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
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
            onClick={handleLogout}
            className="text-[#AFAFAF] hover:text-[#FF4B4B] text-sm font-bold uppercase tracking-wide transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-[#E5E5E5]">
        <div className="flex">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
                  active ? "text-[#58CC02]" : "text-[#AFAFAF]"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${active ? "text-[#58CC02]" : "text-[#AFAFAF]"}`}>
                  {item.label}
                </span>
                {active && <div className="w-5 h-0.5 rounded-full bg-[#58CC02]" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

