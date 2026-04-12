"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "儀表板", icon: "📊" },
  { href: "/review", label: "複習", icon: "📚" },
  { href: "/vocabulary", label: "單字庫", icon: "📖" },
  { href: "/conversation", label: "對話", icon: "💬" },
  { href: "/progress", label: "進度", icon: "📈" },
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
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="text-xl font-bold text-red-600">明老師</span>
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-red-50 text-red-600"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="ml-2 text-gray-400 hover:text-gray-600 text-sm"
          >
            登出
          </button>
        </div>
      </div>
    </nav>
  );
}
