"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchDueCards, submitReviewAnswer, startReviewSession, endReviewSession } from "@/lib/api";
import FlashCard from "@/components/FlashCard";
import NavBar from "@/components/NavBar";
import Link from "next/link";

interface ReviewCard {
  id: string;
  vocabulary: {
    id: string;
    word: string;
    pinyin: string;
    tone_numbers?: string;
    meaning_en?: string;
    meaning_id?: string;
    example_sentence?: string;
    example_pinyin?: string;
    memory_tip?: string;
  };
}

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const startTime = useRef(Date.now());
  const cardStart = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);

      const due = await fetchDueCards(session.access_token);
      setCards(due as ReviewCard[]);

      if (due.length > 0) {
        const sess = await startReviewSession(session.access_token);
        setSessionId(sess.id);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleRate = async (quality: number) => {
    if (!token || !cards[currentIndex]) return;

    const responseMs = Date.now() - cardStart.current;
    const card = cards[currentIndex];
    await submitReviewAnswer(token, card.vocabulary.id, quality, responseMs);

    if (quality >= 3) setCorrect((c) => c + 1);

    if (currentIndex + 1 >= cards.length) {
      const durationSeconds = Math.round((Date.now() - startTime.current) / 1000);
      if (sessionId) {
        await endReviewSession(token, sessionId, cards.length, correct + (quality >= 3 ? 1 : 0), durationSeconds);
      }
      setDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
      cardStart.current = Date.now();
    }
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-5xl animate-bounce mb-4">🦉</div>
          <p className="text-[#AFAFAF] font-bold uppercase tracking-wider">Loading...</p>
        </main>
      </>
    );
  }

  if (cards.length === 0) {
    return (
      <>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-[#3C3C3C] mb-2">All caught up!</h2>
          <p className="text-[#AFAFAF] font-medium mb-8">No cards due right now. Come back tomorrow!</p>
          <Link
            href="/dashboard"
            className="inline-block bg-[#58CC02] text-white border-b-4 border-[#58A700] rounded-2xl px-8 py-3 font-bold uppercase tracking-wide text-sm transition-all active:border-b-0 active:mt-1 hover:bg-[#4CAF00]"
          >
            BACK TO HOME
          </Link>
        </main>
      </>
    );
  }

  if (done) {
    const accuracy = Math.round((correct / cards.length) * 100);
    return (
      <>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-black text-[#3C3C3C] mb-2">Session Complete!</h2>
          <p className="text-[#AFAFAF] font-medium mb-8">Great work keeping up your streak!</p>

          <div className="grid grid-cols-3 gap-4 mb-10 max-w-sm mx-auto">
            {[
              { value: cards.length, label: "Reviewed", color: "text-[#1CB0F6]" },
              { value: correct, label: "Correct", color: "text-[#58CC02]" },
              { value: `${accuracy}%`, label: "Accuracy", color: "text-[#FF9600]" },
            ].map(({ value, label, color }) => (
              <div key={label} className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-4">
                <div className={`text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wide mt-1">{label}</div>
              </div>
            ))}
          </div>

          <Link
            href="/dashboard"
            className="inline-block bg-[#58CC02] text-white border-b-4 border-[#58A700] rounded-2xl px-8 py-3 font-bold uppercase tracking-wide text-sm transition-all active:border-b-0 active:mt-1 hover:bg-[#4CAF00]"
          >
            BACK TO HOME
          </Link>
        </main>
      </>
    );
  }

  const card = cards[currentIndex];
  const progress = (currentIndex / cards.length) * 100;

  return (
    <>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress bar row */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-[#AFAFAF] hover:text-[#3C3C3C] transition-colors font-bold text-lg">
            ✕
          </Link>
          <div className="flex-1 duo-progress">
            <div
              className="duo-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-bold text-[#AFAFAF] whitespace-nowrap">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>

        <FlashCard
          word={card.vocabulary.word}
          pinyin={card.vocabulary.pinyin}
          toneNumbers={card.vocabulary.tone_numbers}
          meaningEn={card.vocabulary.meaning_en ?? ""}
          meaningId={card.vocabulary.meaning_id}
          exampleSentence={card.vocabulary.example_sentence}
          examplePinyin={card.vocabulary.example_pinyin}
          memoryTip={card.vocabulary.memory_tip}
          onRate={handleRate}
        />
      </main>
    </>
  );
}
