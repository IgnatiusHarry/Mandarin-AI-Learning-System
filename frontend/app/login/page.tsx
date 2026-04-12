"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isPlaceholder =
  !SUPABASE_URL || SUPABASE_URL.includes("placeholder") || SUPABASE_URL === "https://placeholder.supabase.co";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlaceholder) {
      setError("Supabase belum dikonfigurasi. Isi .env.local dengan keys asli dulu.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-600 mb-1">明老師</h1>
          <p className="text-gray-500 text-sm">Mandarin AI Learning System</p>
        </div>

        {/* Setup guide — shown when Supabase not configured */}
        {isPlaceholder && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-amber-700 mb-2">⚙️ Setup diperlukan</p>
            <p className="text-amber-600 mb-3">Isi file <code className="bg-amber-100 px-1 rounded">frontend/.env.local</code> dengan keys dari Supabase:</p>
            <ol className="text-amber-700 space-y-1 list-decimal list-inside">
              <li>Buka <a href="https://supabase.com" target="_blank" className="underline">supabase.com</a> → project kamu</li>
              <li>Settings → API → copy <strong>Project URL</strong> & <strong>anon key</strong></li>
              <li>Edit <code className="bg-amber-100 px-1 rounded">frontend/.env.local</code></li>
              <li>Restart: <code className="bg-amber-100 px-1 rounded">npm run dev</code></li>
            </ol>
            <div className="mt-3 bg-amber-100 rounded p-2 font-mono text-xs text-amber-800 break-all">
              NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co<br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
            </div>
          </div>
        )}

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📧</div>
            <p className="text-gray-700 font-medium">Magic link sent!</p>
            <p className="text-gray-500 text-sm mt-1">Check your email to log in.</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white rounded-lg py-2.5 font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
