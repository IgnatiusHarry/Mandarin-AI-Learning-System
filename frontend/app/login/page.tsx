"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isPlaceholder =
  !SUPABASE_URL || SUPABASE_URL.includes("placeholder") || SUPABASE_URL === "https://placeholder.supabase.co";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "auth_failed") {
      setError("Login link is invalid or expired. Please try again.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlaceholder) {
      setError("Supabase is not configured yet. Fill in .env.local with real keys first.");
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
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="min-h-screen bg-white flex">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-center items-center flex-1 bg-[#58CC02] px-12">
        <div className="text-center text-white">
          <div className="text-8xl mb-6">🦉</div>
          <h1 className="text-5xl font-black tracking-tight mb-3">明老師</h1>
          <p className="text-xl font-semibold opacity-90">The fun way to learn Mandarin.</p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { n: "HSK 3–4", label: "Level" },
              { n: "SRS", label: "Spaced Repetition" },
              { n: "AI", label: "Conversation" },
            ].map((s) => (
              <div key={s.label} className="bg-white/20 rounded-2xl p-4">
                <div className="text-2xl font-black">{s.n}</div>
                <div className="text-xs font-semibold opacity-80 mt-1 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 py-12 max-w-lg mx-auto w-full">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-10">
          <div className="text-6xl mb-3">🦉</div>
          <h1 className="text-3xl font-black text-[#58CC02]">明老師</h1>
          <p className="text-[#AFAFAF] text-sm mt-1">The fun way to learn Mandarin</p>
        </div>

        {isPlaceholder && (
          <div className="w-full mb-6 bg-[#FFF3CD] border-2 border-[#FFC800] rounded-2xl p-4 text-sm">
            <p className="font-bold text-[#9C7700] mb-2">⚙️ Setup required</p>
            <p className="text-[#9C7700] mb-2">Fill <code className="bg-[#FFE88A] px-1 rounded">frontend/.env.local</code> with your Supabase keys.</p>
            <ol className="text-[#9C7700] space-y-1 list-decimal list-inside text-xs">
              <li>Go to <a href="https://supabase.com" target="_blank" className="underline font-semibold">supabase.com</a> → Settings → API</li>
              <li>Copy <strong>Project URL</strong> & <strong>anon key</strong></li>
              <li>Restart: <code className="bg-[#FFE88A] px-1 rounded">npm run dev</code></li>
            </ol>
          </div>
        )}

        {sent ? (
          <div className="w-full text-center">
            <div className="text-7xl mb-6">📬</div>
            <h2 className="text-2xl font-black text-[#3C3C3C] mb-2">Check your email!</h2>
            <p className="text-[#AFAFAF]">We sent a magic link to <strong className="text-[#3C3C3C]">{email}</strong></p>
            <p className="text-[#AFAFAF] text-sm mt-1">Click the link to sign in.</p>
            <button
              onClick={() => setSent(false)}
              className="mt-8 text-[#1CB0F6] font-bold text-sm hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="w-full">
            <h2 className="text-3xl font-black text-[#3C3C3C] mb-2">Get started</h2>
            <p className="text-[#AFAFAF] mb-8">Enter your email to receive a magic sign-in link.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border-2 border-[#E5E5E5] rounded-2xl px-5 py-4 text-[#3C3C3C] font-medium text-base focus:outline-none focus:border-[#58CC02] transition-colors placeholder:text-[#AFAFAF]"
              />
              {error && (
                <div className="bg-[#FF4B4B]/10 border-2 border-[#FF4B4B]/30 rounded-2xl px-4 py-3">
                  <p className="text-[#FF4B4B] text-sm font-semibold">{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#58CC02] text-white rounded-2xl py-4 font-black text-base uppercase tracking-wide border-b-4 border-[#58A700] hover:bg-[#62D900] active:border-b-0 active:mt-1 disabled:opacity-50 transition-all"
              >
                {loading ? "Sending..." : "GET STARTED"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-[#AFAFAF] text-sm">No password needed — just your email.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isPlaceholder =
  !SUPABASE_URL || SUPABASE_URL.includes("placeholder") || SUPABASE_URL === "https://placeholder.supabase.co";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "auth_failed") {
      setError("Login link is invalid or expired. Please try again.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlaceholder) {
      setError("Supabase is not configured yet. Fill in .env.local with real keys first.");
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
            <p className="font-semibold text-amber-700 mb-2">⚙️ Setup required</p>
            <p className="text-amber-600 mb-3">Fill in <code className="bg-amber-100 px-1 rounded">frontend/.env.local</code> with your Supabase keys:</p>
            <ol className="text-amber-700 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://supabase.com" target="_blank" className="underline">supabase.com</a> → your project</li>
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
