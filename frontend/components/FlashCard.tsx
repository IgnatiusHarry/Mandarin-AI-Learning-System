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

// Tone 0=neutral, 1=first, 2=second, 3=third, 4=fourth
const TONE_COLORS = [
  "text-[#AFAFAF]",
  "text-[#FF4B4B]",
  "text-[#FF9600]",
  "text-[#58CC02]",
  "text-[#1CB0F6]",
];

const RATING_BUTTONS = [
  {
    quality: 1,
    label: "Blackout",
    bg: "bg-[#FF4B4B]",
    border: "border-[#EA2B2B]",
    text: "text-white",
  },
  {
    quality: 2,
    label: "Hard",
    bg: "bg-[#FF9600]",
    border: "border-[#CC7A00]",
    text: "text-white",
  },
  {
    quality: 3,
    label: "Struggled",
    bg: "bg-[#FFC800]",
    border: "border-[#CC9F00]",
    text: "text-white",
  },
  {
    quality: 4,
    label: "Good",
    bg: "bg-[#1CB0F6]",
    border: "border-[#0099DB]",
    text: "text-white",
  },
  {
    quality: 5,
    label: "Easy",
    bg: "bg-[#58CC02]",
    border: "border-[#58A700]",
    text: "text-white",
  },
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
    <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-8 max-w-lg mx-auto">
      {/* Character */}
      <div className="text-center mb-8">
        <div className="text-7xl font-black mb-3 tracking-wide">
          {word.split("").map((char, i) => {
            const tone = parseInt(tones[i] ?? "0");
            return (
              <span key={i} className={TONE_COLORS[tone] ?? "text-[#3C3C3C]"}>
                {char}
              </span>
            );
          })}
        </div>
        {revealed && (
          <p className="text-[#AFAFAF] text-xl font-medium tracking-wider">{pinyin}</p>
        )}
      </div>

      {/* Reveal button */}
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#E5E5E5] text-[#3C3C3C] rounded-2xl py-4 font-bold text-base tracking-wide uppercase transition-all active:border-b-2 active:mt-0.5 hover:bg-[#F7F7F7]"
        >
          TAP TO REVEAL 👆
        </button>
      ) : (
        <>
          {/* Meaning */}
          <div className="space-y-3 mb-6">
            <div className="bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-2xl p-4">
              <p className="font-bold text-[#3C3C3C] text-lg">{meaningEn}</p>
              {meaningId && <p className="text-[#AFAFAF] text-sm mt-1">{meaningId}</p>}
            </div>
            {exampleSentence && (
              <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3">
                <p className="text-[#3C3C3C] text-sm font-medium">{exampleSentence}</p>
                {examplePinyin && (
                  <p className="text-[#AFAFAF] text-xs mt-1">{examplePinyin}</p>
                )}
              </div>
            )}
            {memoryTip && (
              <p className="text-[#CE82FF] text-xs font-medium">💡 {memoryTip}</p>
            )}
          </div>

          {/* Rating label */}
          <p className="text-center text-sm font-bold text-[#AFAFAF] uppercase tracking-wider mb-3">
            How well did you remember?
          </p>

          {/* Rating buttons — 3D Duolingo style */}
          <div className="grid grid-cols-5 gap-2">
            {RATING_BUTTONS.map(({ quality, label, bg, border, text }) => (
              <button
                key={quality}
                onClick={() => onRate(quality)}
                className={`${bg} ${border} ${text} border-2 border-b-4 rounded-xl py-3 text-xs font-bold transition-all active:border-b-2 active:mt-0.5 flex flex-col items-center gap-0.5`}
              >
                <span className="text-base font-black">{quality}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
