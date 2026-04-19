"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import { fetchDueCards, submitReviewAnswer, startReviewSession, endReviewSession, fetchLessonReviewOptions } from "@/lib/api";
import FlashCard from "@/components/FlashCard";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { isLearnerKey, learnerKeys } from "@/lib/learner-keys";

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
  const { mutate: globalMutate } = useSWRConfig();
  const { token: accessToken, ready } = useAuth();
  const { data: apiLessons } = useSWR(
    ready && accessToken ? learnerKeys.lessonOptions(accessToken) : null,
    (key) => fetchLessonReviewOptions(key[2] as string)
  );

  const lessonOptions = useMemo(() => {
    const base = { value: "all", label: "All Due Cards" };
    const fromApi = (apiLessons ?? []).map((o) => ({
      value: o.tag,
      label: o.title,
    }));
    if (fromApi.length > 0) {
      return [base, ...fromApi];
    }
    return [base, { value: "時代華語-10", label: "時代華語 第10課" }];
  }, [apiLessons]);

  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [lessonTag, setLessonTag] = useState<string>("all");
  const startTime = useRef(Date.now());
  const cardStart = useRef(Date.now());

  const load = async (selectedLessonTag: string) => {
    setLoading(true);
    setLoadError(null);
    setCurrentIndex(0);
    setCorrect(0);
    setDone(false);
    try {
      if (!accessToken) {
        setCards([]);
        return;
      }

      const due = await fetchDueCards(
        accessToken,
        selectedLessonTag === "all" ? undefined : selectedLessonTag
      );
      setCards(due as unknown as ReviewCard[]);

      if (due.length > 0) {
        const sess = await startReviewSession(accessToken);
        setSessionId(sess.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load review cards.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) {
      return;
    }
    void load(lessonTag);
  }, [lessonTag, accessToken, ready]);

  useEffect(() => {
    const allowed = lessonOptions.map((o) => o.value);
    if (!allowed.includes(lessonTag)) {
      setLessonTag("all");
    }
  }, [lessonOptions, lessonTag]);

  const handleRate = async (quality: number) => {
    if (!accessToken || !cards[currentIndex] || submittingRating) return;

    setSubmittingRating(true);
    const responseMs = Date.now() - cardStart.current;
    const card = cards[currentIndex];
    const nextCorrect = correct + (quality >= 3 ? 1 : 0);
    try {
      await submitReviewAnswer(accessToken, card.vocabulary.id, quality, responseMs);

      if (quality >= 3) setCorrect(nextCorrect);

      if (currentIndex + 1 >= cards.length) {
        const durationSeconds = Math.round((Date.now() - startTime.current) / 1000);
        if (sessionId) {
          await endReviewSession(accessToken, sessionId, cards.length, nextCorrect, durationSeconds);
        }
        setDone(true);
        void globalMutate((key) => isLearnerKey(key));
      } else {
        setCurrentIndex((i) => i + 1);
        cardStart.current = Date.now();
      }
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="max-w-2xl mx-auto px-3 sm:px-4 py-16 sm:py-20 pb-mobile-main text-center">
          <div className="text-5xl animate-bounce mb-4">🦉</div>
          <p className="text-[#AFAFAF] font-bold uppercase tracking-wider">Loading...</p>
        </main>
      </>
    );
  }

  if (cards.length === 0) {
    if (loadError) {
      return (
        <>
          <NavBar />
          <main className="max-w-2xl mx-auto px-3 sm:px-4 py-16 sm:py-20 pb-mobile-main text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-black text-[#3C3C3C] mb-2">Loading failed</h2>
            <p className="text-[#AFAFAF] font-medium mb-8">{loadError}</p>
            <button
              type="button"
              onClick={() => void load(lessonTag)}
              className="inline-block bg-[#58CC02] text-white border-b-4 border-[#58A700] rounded-2xl px-8 py-3 font-bold uppercase tracking-wide text-sm transition-all active:border-b-0 active:mt-1 hover:bg-[#4CAF00]"
            >
              RETRY
            </button>
          </main>
        </>
      );
    }

    return (
      <>
        <NavBar />
        <main className="max-w-2xl mx-auto px-3 sm:px-4 py-16 sm:py-20 pb-mobile-main text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-[#3C3C3C] mb-2">All caught up!</h2>
          <p className="text-[#AFAFAF] font-medium mb-8">No cards due right now. Come back tomorrow!</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {lessonOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLessonTag(option.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                    lessonTag === option.value
                      ? "bg-[#58CC02] text-white border-[#58A700]"
                      : "bg-white text-[#AFAFAF] border-[#E5E5E5] hover:border-[#58CC02] hover:text-[#58CC02]"
                  }`}
                >
                  {option.label}
                </button>
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

  if (done) {
    const accuracy = Math.round((correct / cards.length) * 100);
    return (
      <>
        <NavBar />
        <main className="max-w-2xl mx-auto px-3 sm:px-4 py-12 sm:py-16 pb-mobile-main text-center">
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
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-mobile-main">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          {lessonOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLessonTag(option.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                lessonTag === option.value
                  ? "bg-[#58CC02] text-white border-[#58A700]"
                  : "bg-white text-[#AFAFAF] border-[#E5E5E5] hover:border-[#58CC02] hover:text-[#58CC02]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

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
          ratingDisabled={submittingRating}
          onRate={handleRate}
        />
      </main>
    </>
  );
}
