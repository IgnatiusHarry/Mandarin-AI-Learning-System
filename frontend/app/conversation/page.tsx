"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  fetchConversationHistory,
  fetchConversations,
  fetchCurrentProfile,
  fetchVocabWordsForScope,
  fetchWeakWords,
  sendConversationMessage,
  startConversation,
} from "@/lib/api";
import NavBar from "@/components/NavBar";
import ClickableChineseText, {
  formatPinyin,
  VocabEntry,
} from "@/components/ClickableChineseText";
import { useAuth } from "@/lib/auth-context";
import { learnerKeys } from "@/lib/learner-keys";

interface Message {
  role: "user" | "assistant";
  content: string;
  corrections?: Record<string, unknown>[];
  new_vocab?: string[];
}

interface Conversation {
  id: string;
  topic: string;
  started_at: string;
  message_count: number;
}

type LessonMode = "mixed" | "vocabulary" | "grammar" | "quiz";

interface TopicOption {
  label: string;
  emoji: string;
  subtitle?: string | null;
  lessonTag?: string;
}

interface WordTooltip {
  word: string;
  entry: VocabEntry;
  x: number;
  y: number;
}

const FULL_VOCAB_CACHE_KEY = "mls-chat-vocab-all";
const LESSON10_VOCAB_CACHE_KEY = "mls-chat-vocab-lesson-10";

const TOPICS: TopicOption[] = [
  { label: "Free Chat", emoji: "💬" },
  {
    label: "時代華語 第10課",
    emoji: "🏋️",
    subtitle: "下課後一起去健身吧！",
    lessonTag: "時代華語-10",
  },
  { label: "Food / Restaurants", emoji: "🍜" },
  { label: "Travel", emoji: "✈️" },
  { label: "Work / Study", emoji: "📚" },
  { label: "Family", emoji: "👨‍👩‍👧" },
  { label: "Taiwanese Culture", emoji: "🏮" },
  { label: "Movies / Music", emoji: "🎬" },
];

const LESSON_MODE_OPTIONS: Array<{
  value: LessonMode;
  label: string;
  topicSuffix: string;
  helper: string;
}> = [
  {
    value: "mixed",
    label: "Mixed Practice",
    topicSuffix: "Mixed Practice",
    helper: "Campur ngobrol + koreksi + mini quiz.",
  },
  {
    value: "vocabulary",
    label: "Vocabulary Drill",
    topicSuffix: "Vocabulary Drill",
    helper: "Fokus pemakaian kosakata Bab 10.",
  },
  {
    value: "grammar",
    label: "Grammar Drill",
    topicSuffix: "Grammar Drill",
    helper: "Fokus pola: 一起...吧 / 因為...所以 / 覺得 / 習慣.",
  },
  {
    value: "quiz",
    label: "Quiz Mode",
    topicSuffix: "Quiz Drill",
    helper: "Tiap giliran ada soal singkat dari materi Bab 10.",
  },
];

export default function ConversationPage() {
  const { token, ready } = useAuth();
  const profileSwr = useSWR(
    ready && token ? learnerKeys.profile(token) : null,
    (key) => fetchCurrentProfile(key[2] as string)
  );
  const convosSwr = useSWR(
    ready && token ? learnerKeys.conversations(token) : null,
    (key) => fetchConversations(key[2] as string)
  );

  const profile = profileSwr.data ?? null;
  const conversations = (convosSwr.data as unknown as Conversation[]) ?? [];
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0].label);
  const [lessonMode, setLessonMode] = useState<LessonMode>("mixed");
  const [vocabMap, setVocabMap] = useState<Map<string, VocabEntry>>(new Map());
  const [wordTooltip, setWordTooltip] = useState<WordTooltip | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedTopicMeta = useMemo(
    () => TOPICS.find((t) => t.label === topic),
    [topic]
  );
  const isLessonTopic = Boolean(selectedTopicMeta?.lessonTag);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvoId) ?? null,
    [conversations, activeConvoId]
  );

  const activeTopicDisplay = activeConversation?.topic ?? topic;
  const isLessonActive =
    activeTopicDisplay.includes("第10課") ||
    activeTopicDisplay.includes("時代華語-10");

  const weakLessonTag =
    (isLessonTopic && selectedTopicMeta?.lessonTag) ||
    (isLessonActive ? "時代華語-10" : undefined);

  const weakSwr = useSWR(
    ready && token
      ? (["learner", "weakWords", token, weakLessonTag ?? "all"] as const)
      : null,
    (key) =>
      fetchWeakWords(key[2] as string, key[3] === "all" ? undefined : key[3])
  );

  const getCachedMap = (cacheKey: string): Map<string, VocabEntry> | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    try {
      const entries = JSON.parse(raw) as Array<[string, VocabEntry]>;
      return new Map(entries);
    } catch {
      return null;
    }
  };

  const cacheMap = (cacheKey: string, map: Map<string, VocabEntry>) => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(cacheKey, JSON.stringify(Array.from(map.entries())));
  };

  useEffect(() => {
    const cachedLessonMap = getCachedMap(LESSON10_VOCAB_CACHE_KEY);
    if (cachedLessonMap) {
      setVocabMap(cachedLessonMap);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const cacheKey = isLessonTopic || isLessonActive
      ? LESSON10_VOCAB_CACHE_KEY
      : FULL_VOCAB_CACHE_KEY;
    const lessonTag = isLessonTopic || isLessonActive ? "時代華語-10" : undefined;

    const cached = getCachedMap(cacheKey);
    if (cached && cached.size > 0) {
      setVocabMap((prev) => (prev.size >= cached.size ? prev : cached));
      return;
    }

    let cancelled = false;
    const loadScopedVocab = async () => {
      try {
        const words = await fetchVocabWordsForScope(token, lessonTag);
        if (cancelled) {
          return;
        }
        const next = new Map<string, VocabEntry>();
        for (const v of words) {
          if (v.word && v.pinyin) {
            next.set(v.word, {
              pinyin: v.pinyin,
              tone_numbers: v.tone_numbers,
              meaning_en: v.meaning_en,
              meaning_id: v.meaning_id,
            });
          }
        }
        setVocabMap(next);
        cacheMap(cacheKey, next);
      } catch {
        if (!cancelled) {
          setVocabMap((prev) => prev);
        }
      }
    };

    void loadScopedVocab();
    return () => {
      cancelled = true;
    };
  }, [token, isLessonTopic, isLessonActive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const dismiss = () => setWordTooltip(null);
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, []);

  const handleWordClick = useCallback(
    (word: string, entry: VocabEntry, rect: DOMRect) => {
      setWordTooltip((prev) =>
        prev?.word === word
          ? null
          : { word, entry, x: rect.left + rect.width / 2, y: rect.top }
      );
    },
    []
  );

  const buildConversationTopic = (): string => {
    if (!isLessonTopic) {
      return topic;
    }
    const mode =
      LESSON_MODE_OPTIONS.find((option) => option.value === lessonMode) ??
      LESSON_MODE_OPTIONS[0];
    return `${topic} · ${mode.topicSuffix}`;
  };

  const buildLessonWelcome = (): string => {
    const rows = (weakSwr.data as Array<{ vocabulary?: { word?: string } }>) ?? [];
    const weakPick = rows
      .map((r) => r.vocabulary?.word)
      .filter((w): w is string => Boolean(w))
      .slice(0, 8);
    const deckKeys = Array.from(vocabMap.keys());
    const merged = [...new Set([...weakPick, ...deckKeys])].slice(0, 12);
    const focusLine =
      merged.join("、") || "健身、運動、跑步、游泳、覺得、習慣、有空";

    const mode = lessonMode;
    if (mode === "vocabulary") {
      return [
        "你好！我是小明 😊",
        `今天我們做第10課詞彙練習，程度會配合你的 HSK ${profile?.hsk_level ?? 3}。`,
        `我會重點練這些詞（依你的生詞本 + 弱項）：${focusLine}。`,
        "先暖身：你最近最常做什麼運動？",
      ].join("\n");
    }

    if (mode === "grammar") {
      return [
        "你好！我是小明 😊",
        `今天我們做第10課文法練習，難度會配合你的 HSK ${profile?.hsk_level ?? 3}。`,
        "重點句型：一起...吧 / 因為...所以 / 覺得 / 習慣。",
        weakPick.length > 0
          ? `我會把你的弱項詞「${weakPick.slice(0, 5).join("、")}」放進例句裡練。`
          : "我們用課文裡的運動話題來練習這些句型。",
        "先試一題：用「因為...所以...」說你今天想不想運動。",
      ].join("\n");
    }

    if (mode === "quiz") {
      return [
        "你好！我是小明 😊",
        `今天是第10課小測驗模式，題目會配合你的 HSK ${profile?.hsk_level ?? 3}。`,
        "我每回合會給你一題（填空、改錯或情境問答），你回答後我會批改。",
        "第一題：請完成句子「我們下課後一起___吧！」",
      ].join("\n");
    }

    return [
      "你好！我是小明 😊",
      `今天我們練習第10課，內容會配合你的 HSK ${profile?.hsk_level ?? 3}。`,
      `今天的詞彙焦點：${focusLine}。`,
      "重點：一起...吧 / 因為...所以 / 覺得 / 習慣。",
      "我們先聊天暖身：你平常有在做運動嗎？",
    ].join("\n");
  };

  const handleStart = async () => {
    if (!token || starting) {
      return;
    }

    setStarting(true);
    try {
      const convoTopic = buildConversationTopic();
      const convo = await startConversation(token, convoTopic);
      setActiveConvoId(convo.id);

      const welcome = isLessonTopic
        ? buildLessonWelcome()
        : `你好！我是小明 😊${
            profile?.display_name ? ` ${profile.display_name}，` : " "
          }今天我們來聊聊「${topic}」吧！\n請問你想從哪裡開始？`;

      setMessages([{ role: "assistant", content: welcome }]);

      await convosSwr.mutate();
    } finally {
      setStarting(false);
    }
  };

  const handleSelectConversation = async (convo: Conversation) => {
    if (!token) {
      return;
    }

    setActiveConvoId(convo.id);
    setTopic(convo.topic);
    setLoading(true);

    try {
      const history = await fetchConversationHistory(token, convo.id);
      setMessages(history as unknown as Message[]);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !token || !activeConvoId || loading) {
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await sendConversationMessage(token, activeConvoId, userMessage);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          corrections: res.corrections,
          new_vocab: res.new_vocab,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NavBar />

      {wordTooltip && (
        <div
          style={{
            position: "fixed",
            left: wordTooltip.x,
            top: Math.max(8, wordTooltip.y - 90),
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
          className="bg-white border-2 border-[#58CC02] rounded-2xl px-4 py-2.5 shadow-xl text-center min-w-[6rem] pointer-events-none"
        >
          <div className="font-black text-[#3C3C3C] text-xl leading-tight">
            {wordTooltip.word}
          </div>
          <div className="text-[#58CC02] font-bold text-sm tracking-wide">
            {formatPinyin(wordTooltip.entry.pinyin, wordTooltip.entry.tone_numbers)}
          </div>
          {(wordTooltip.entry.meaning_id || wordTooltip.entry.meaning_en) && (
            <div className="text-[#AFAFAF] text-xs mt-0.5 max-w-[12rem]">
              {wordTooltip.entry.meaning_id || wordTooltip.entry.meaning_en}
            </div>
          )}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex gap-5 min-h-0 h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] md:h-[calc(100vh-3.5rem)] md:max-h-[calc(100vh-3.5rem)] pb-mobile-main">
        <aside className="w-52 flex-shrink-0 hidden md:flex flex-col gap-3">
          <h2 className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider">
            Past Conversations
          </h2>

          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-xs text-[#AFAFAF] mt-2">No conversations yet</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => void handleSelectConversation(c)}
                className={`w-full text-left rounded-2xl px-3 py-2.5 text-sm font-medium transition-all border-2 ${
                  activeConvoId === c.id
                    ? "bg-[#F0FFF0] border-[#58CC02] text-[#3C3C3C]"
                    : "bg-white border-[#E5E5E5] text-[#3C3C3C] hover:border-[#58CC02]"
                }`}
              >
                <div className="truncate">{c.topic}</div>
                <div className="text-xs text-[#AFAFAF] mt-0.5">
                  {c.message_count} message{c.message_count !== 1 ? "s" : ""}
                </div>
              </button>
            ))}
          </div>

          {activeConvoId && (
            <button
              onClick={() => {
                setActiveConvoId(null);
                setMessages([]);
              }}
              className="text-xs font-bold text-[#AFAFAF] hover:text-[#FF4B4B] transition-colors uppercase tracking-wide"
            >
              + New conversation
            </button>
          )}

          {vocabMap.size > 0 && (
            <div className="text-xs text-[#AFAFAF] font-medium border-t border-[#E5E5E5] pt-2">
              💡 Click any Chinese word to see pinyin & meaning
            </div>
          )}
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {!activeConvoId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-8 w-full max-w-lg">
                <div className="text-center mb-6">
                  <div className="text-4xl mb-2">💬</div>
                  <h2 className="text-xl font-black text-[#3C3C3C]">Start Conversation</h2>
                  <p className="text-[#AFAFAF] text-sm mt-1">
                    Practice Mandarin with 小明 AI tutor
                  </p>
                </div>

                <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-3">
                  Choose a topic
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {TOPICS.map(({ label, emoji, subtitle }) => (
                    <button
                      key={label}
                      onClick={() => setTopic(label)}
                      className={`px-3 py-2 rounded-2xl text-sm font-bold border-2 transition-all text-left ${
                        topic === label
                          ? "bg-[#58CC02] text-white border-[#58A700]"
                          : "bg-white text-[#3C3C3C] border-[#E5E5E5] hover:border-[#58CC02]"
                      }`}
                    >
                      <span>
                        {emoji} {label}
                      </span>
                      {subtitle && (
                        <span
                          className={`block text-xs mt-0.5 ${
                            topic === label ? "text-white/80" : "text-[#AFAFAF]"
                          }`}
                        >
                          {subtitle}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {isLessonTopic && (
                  <div className="mb-5 bg-[#F0FFF0] border border-[#B3F0B3] rounded-2xl px-4 py-3 text-xs text-[#3C3C3C]">
                    <div className="font-black text-[#58A700] mb-2">🎯 第10課 Study Focus</div>
                    <div className="grid grid-cols-2 gap-2">
                      {LESSON_MODE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLessonMode(option.value)}
                          className={`rounded-xl border px-2.5 py-2 text-left transition-colors ${
                            lessonMode === option.value
                              ? "bg-[#58CC02] text-white border-[#58A700]"
                              : "bg-white text-[#3C3C3C] border-[#D8EFCB] hover:border-[#58CC02]"
                          }`}
                        >
                          <div className="font-bold">{option.label}</div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              lessonMode === option.value
                                ? "text-white/90"
                                : "text-[#7BAA63]"
                            }`}
                          >
                            {option.helper}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="text-[#AFAFAF] mt-2">
                      Materi bab diambil dari deck vocabulary kamu di Supabase.
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="w-full bg-[#58CC02] text-white border-b-4 border-[#58A700] rounded-2xl py-3.5 font-black uppercase tracking-wide text-sm transition-all active:border-b-0 active:mt-1 hover:bg-[#4CAF00] disabled:opacity-50"
                >
                  {starting ? "Starting..." : "START CONVERSATION 💬"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 border-b-2 border-[#E5E5E5] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F0FFF0] border-2 border-[#58CC02] flex items-center justify-center text-sm">
                    {isLessonActive ? "🏋️" : "🦉"}
                  </div>
                  <div>
                    <div className="font-black text-sm text-[#3C3C3C]">小明</div>
                    <div className="text-xs text-[#58CC02] font-bold">
                      AI Tutor · {activeTopicDisplay}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {vocabMap.size > 0 && (
                    <span className="hidden md:block text-xs text-[#AFAFAF]">
                      👆 Click Chinese to see pinyin
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setActiveConvoId(null);
                      setMessages([]);
                    }}
                    className="text-xs font-bold text-[#AFAFAF] hover:text-[#FF4B4B] transition-colors md:hidden"
                  >
                    New topic
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {messages.length === 0 && !loading && (
                  <div className="text-center py-12 text-sm text-[#AFAFAF] font-medium">
                    No messages yet. Start the conversation below.
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm font-medium ${
                        msg.role === "user"
                          ? "bg-[#58CC02] text-white rounded-br-lg"
                          : "bg-white border-2 border-[#E5E5E5] text-[#3C3C3C] rounded-bl-lg"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <p className="leading-relaxed whitespace-pre-wrap">
                          <ClickableChineseText
                            text={msg.content}
                            vocabMap={vocabMap}
                            onWordClick={handleWordClick}
                          />
                        </p>
                      ) : (
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {msg.new_vocab && msg.new_vocab.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.new_vocab.map((w) => (
                            <span
                              key={w}
                              className="text-xs bg-[#F0FFF0] text-[#58A700] border border-[#B3F0B3] px-2 py-0.5 rounded-full font-bold"
                            >
                              ✅ {w} saved
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl rounded-bl-lg px-4 py-3 text-sm">
                      <span className="text-[#AFAFAF] font-medium">小明 is typing</span>
                      <span className="inline-flex gap-0.5 ml-1">
                        <span
                          className="w-1.5 h-1.5 bg-[#AFAFAF] rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-1.5 h-1.5 bg-[#AFAFAF] rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-1.5 h-1.5 bg-[#AFAFAF] rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="flex gap-2 pt-3 border-t-2 border-[#E5E5E5]">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Type in Chinese... (中文)"
                  className="flex-1 min-h-[48px] border-2 border-[#E5E5E5] rounded-2xl px-3 sm:px-4 py-3 text-base sm:text-sm font-medium focus:outline-none focus:border-[#58CC02] transition-colors bg-white touch-manipulation"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={loading || !input.trim()}
                  className="shrink-0 min-h-[48px] min-w-[4.5rem] touch-manipulation bg-[#58CC02] text-white border-b-4 border-[#58A700] rounded-2xl px-4 sm:px-5 font-black text-sm uppercase transition-all active:border-b-0 active:mt-1 hover:bg-[#4CAF00] disabled:opacity-40 disabled:border-b-0"
                >
                  送出
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
