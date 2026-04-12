"use client";

import { useState } from "react";

interface FlashCardProps {
  word: string;
  pinyin: string;
  toneNumbers?: string;
  meaningEn: string;
  meaningId?: string;
  exampleSentence?: string;
  examplePinyin?: string;
  memoryTip?: string;
  onRate: (quality: number) => void;
}

const TONE_COLORS = [
  "text-gray-500",
  "text-red-500",
  "text-orange-500",
  "text-green-600",
  "text-blue-600",
];

const RATING_BUTTONS = [
  { quality: 1, label: "完全不記得", color: "bg-red-100 text-red-700 hover:bg-red-200" },
  { quality: 2, label: "模糊印象", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { quality: 3, label: "費力想起", color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  { quality: 4, label: "稍微猶豫", color: "bg-teal-100 text-teal-700 hover:bg-teal-200" },
  { quality: 5, label: "完全記得", color: "bg-green-100 text-green-700 hover:bg-green-200" },
];

export default function FlashCard({
  word,
  pinyin,
  toneNumbers,
  meaningEn,
  meaningId,
  exampleSentence,
  examplePinyin,
  memoryTip,
  onRate,
}: FlashCardProps) {
  const [revealed, setRevealed] = useState(false);
  const tones = toneNumbers?.split(" ") ?? [];

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-8 shadow-sm max-w-lg mx-auto">
      {/* Front — just the character */}
      <div className="text-center mb-6">
        <div className="text-6xl font-bold mb-2">
          {word.split("").map((char, i) => {
            const tone = parseInt(tones[i] ?? "0");
            return (
              <span key={i} className={TONE_COLORS[tone] ?? "text-gray-800"}>
                {char}
              </span>
            );
          })}
        </div>
        {revealed && (
          <p className="text-gray-500 text-lg mt-1">{pinyin}</p>
        )}
      </div>

      {/* Reveal button */}
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-3 font-medium transition-colors"
        >
          點擊翻牌 👆
        </button>
      ) : (
        <>
          {/* Back — meaning + example */}
          <div className="space-y-3 mb-6">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="font-semibold text-gray-800">{meaningEn}</p>
              {meaningId && <p className="text-gray-500 text-sm">{meaningId}</p>}
            </div>
            {exampleSentence && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-700 text-sm">{exampleSentence}</p>
                {examplePinyin && (
                  <p className="text-gray-400 text-xs mt-1">{examplePinyin}</p>
                )}
              </div>
            )}
            {memoryTip && (
              <p className="text-indigo-600 text-xs">💡 {memoryTip}</p>
            )}
          </div>

          {/* Rating buttons */}
          <p className="text-center text-sm text-gray-500 mb-3">你記得這個字嗎？</p>
          <div className="grid grid-cols-5 gap-2">
            {RATING_BUTTONS.map(({ quality, label, color }) => (
              <button
                key={quality}
                onClick={() => onRate(quality)}
                className={`rounded-xl py-2 text-xs font-medium transition-colors ${color}`}
              >
                <span className="block text-base mb-0.5">{quality}</span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
