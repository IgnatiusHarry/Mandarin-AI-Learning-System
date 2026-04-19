"use client";

import { Fragment } from "react";

export type VocabEntry = {
  pinyin: string;
  tone_numbers: string | null;
  meaning_en: string | null;
  meaning_id: string | null;
};

/** Format pinyin with tone numbers appended: "jian4 shen1" */
export function formatPinyin(pinyin: string, toneNumbers: string | null): string {
  if (!toneNumbers) return pinyin;
  const syllables = pinyin.split(" ");
  const tones = toneNumbers.split(" ");
  return syllables
    .map((s, i) => {
      const t = tones[i] ?? "5";
      return t === "5" ? s : `${s}${t}`;
    })
    .join(" ");
}

/** Greedy longest-match tokenizer (max 6 chars). Groups non-matched chars into runs. */
function tokenize(text: string, map: Map<string, VocabEntry>): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    let matched = false;
    const maxLen = Math.min(6, text.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const candidate = text.slice(i, i + len);
      if (map.has(candidate)) {
        tokens.push(candidate);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Append to previous non-vocab run, or start new run
      const last = tokens[tokens.length - 1];
      if (last !== undefined && !map.has(last)) {
        tokens[tokens.length - 1] = last + text[i];
      } else {
        tokens.push(text[i]);
      }
      i++;
    }
  }
  return tokens;
}

function hasChinese(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s);
}

export default function ClickableChineseText({
  text,
  vocabMap,
  onWordClick,
}: {
  text: string;
  vocabMap: Map<string, VocabEntry>;
  onWordClick: (word: string, entry: VocabEntry, rect: DOMRect) => void;
}) {
  if (!vocabMap.size) {
    return <>{text}</>;
  }

  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, li) => {
        const tokens = tokenize(line, vocabMap);
        return (
          <Fragment key={li}>
            {li > 0 && <br />}
            {tokens.map((token, ti) => {
              const entry = vocabMap.get(token);
              if (entry && hasChinese(token)) {
                return (
                  <span
                    key={ti}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onWordClick(token, entry, rect);
                    }}
                    className="cursor-pointer underline decoration-dotted decoration-[#58CC02] underline-offset-2 hover:bg-[#EAFFD6] rounded-sm px-0.5 transition-colors"
                  >
                    {token}
                  </span>
                );
              }
              return <span key={ti}>{token}</span>;
            })}
          </Fragment>
        );
      })}
    </>
  );
}
