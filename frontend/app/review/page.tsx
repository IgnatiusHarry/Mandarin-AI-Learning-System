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
      // Session done
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
        <main className="max-w-5xl mx-auto px-4 py-20 text-center text-gray-400">載入中...</main>
      </>
    );
  }

  if (cards.length === 0) {
    return (
      <>
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 py-20 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">今天的複習完成了！</h2>
          <p className="text-gray-500 mb-6">沒有待複習的單字，明天再來！</p>
          <Link href="/dashboard" className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-red-700">
            回到首頁
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
        <main className="max-w-5xl mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">複習完成！</h2>
          <div className="flex justify-center gap-8 my-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{cards.length}</div>
              <div className="text-sm text-gray-500">複習了</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{correct}</div>
              <div className="text-sm text-gray-500">答對</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{accuracy}%</div>
              <div className="text-sm text-gray-500">正確率</div>
            </div>
          </div>
          <Link href="/dashboard" className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-red-700">
            回到首頁
          </Link>
        </main>
      </>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className="bg-red-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm text-gray-500 whitespace-nowrap">
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
