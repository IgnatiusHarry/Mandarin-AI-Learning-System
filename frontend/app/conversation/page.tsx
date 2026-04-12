"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  startConversation,
  sendConversationMessage,
  fetchConversations,
} from "@/lib/api";
import NavBar from "@/components/NavBar";

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

const TOPICS = [
  { label: "Free Chat", emoji: "💬" },
  { label: "Food / Restaurants", emoji: "🍜" },
  { label: "Travel", emoji: "✈️" },
  { label: "Work / Study", emoji: "📚" },
  { label: "Family", emoji: "👨‍👩‍👧" },
  { label: "Taiwanese Culture", emoji: "🏮" },
  { label: "Movies / Music", emoji: "🎬" },
];

export default function ConversationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0].label);
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);
      const convos = await fetchConversations(session.access_token);
      setConversations(convos as Conversation[]);
    };
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStart = async () => {
    if (!token) return;
    setStarting(true);
    const convo = await startConversation(token, topic);
    setActiveConvoId(convo.id);
    setMessages([{
      role: "assistant",
      content: `你好！我是小明 😊 今天我們來聊聊「${topic}」吧！\n請問你想從哪裡開始？`,
    }]);
    setStarting(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !token || !activeConvoId || loading) return;
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
        { role: "assistant", content: "❌ Sorry, something went wrong. Please try again." },
      ]);
    }
    setLoading(false);
  };

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 flex gap-5 h-[calc(100vh-3.5rem)] pb-20 md:pb-6">
        {/* Sidebar — past conversations */}
        <aside className="w-52 flex-shrink-0 hidden md:flex flex-col gap-3">
          <h2 className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider">Past Conversations</h2>
          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-xs text-[#AFAFAF] mt-2">No conversations yet</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConvoId(c.id)}
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
              onClick={() => { setActiveConvoId(null); setMessages([]); }}
              className="text-xs font-bold text-[#AFAFAF] hover:text-[#FF4B4B] transition-colors uppercase tracking-wide"
            >
              + New conversation
            </button>
          )}
        </aside>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeConvoId ? (
            /* Topic picker card */
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-8 w-full max-w-md">
                <div className="text-center mb-6">
                  <div className="text-4xl mb-2">💬</div>
                  <h2 className="text-xl font-black text-[#3C3C3C]">Start Conversation</h2>
                  <p className="text-[#AFAFAF] text-sm mt-1">Practice Mandarin with 小明 AI tutor</p>
                </div>

                <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-3">Choose a topic</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {TOPICS.map(({ label, emoji }) => (
                    <button
                      key={label}
                      onClick={() => setTopic(label)}
                      className={`px-3 py-2 rounded-2xl text-sm font-bold border-2 transition-all ${
                        topic === label
                          ? "bg-[#58CC02] text-white border-[#58A700]"
                          : "bg-white text-[#3C3C3C] border-[#E5E5E5] hover:border-[#58CC02]"
                      }`}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>

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
              {/* Current topic header */}
              <div className="flex items-center justify-between mb-3 border-b-2 border-[#E5E5E5] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F0FFF0] border-2 border-[#58CC02] flex items-center justify-center text-sm">
                    🦉
                  </div>
                  <div>
                    <div className="font-black text-sm text-[#3C3C3C]">小明</div>
                    <div className="text-xs text-[#58CC02] font-bold">AI Tutor · {topic}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveConvoId(null); setMessages([]); }}
                  className="text-xs font-bold text-[#AFAFAF] hover:text-[#FF4B4B] transition-colors md:hidden"
                >
                  New topic
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
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
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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

                {/* Typing indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl rounded-bl-lg px-4 py-3 text-sm">
                      <span className="text-[#AFAFAF] font-medium">小明 is typing</span>
                      <span className="inline-flex gap-0.5 ml-1">
                        <span className="w-1.5 h-1.5 bg-[#AFAFAF] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#AFAFAF] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#AFAFAF] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input bar */}
              <div className="flex gap-2 pt-3 border-t-2 border-[#E5E5E5]">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type in Chinese... (中文)"
                  className="flex-1 border-2 border-[#E5E5E5] rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#58CC02] transition-colors bg-white"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="bg-[#58CC02] text-white border-b-4 border-[#58A700] rounded-2xl px-5 font-black text-sm uppercase transition-all active:border-b-0 active:mt-1 hover:bg-[#4CAF00] disabled:opacity-40 disabled:border-b-0"
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

export default function ConversationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);
      const convos = await fetchConversations(session.access_token);
      setConversations(convos as Conversation[]);
    };
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStart = async () => {
    if (!token) return;
    setStarting(true);
    const convo = await startConversation(token, topic);
    setActiveConvoId(convo.id);
    setMessages([{
      role: "assistant",
      content: `你好！我是小明 😊 今天我們來聊聊「${topic}」吧！\n請問你想從哪裡開始？`,
    }]);
    setStarting(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !token || !activeConvoId || loading) return;
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
        { role: "assistant", content: "❌ Sorry, something went wrong. Please try again." },
      ]);
    }
    setLoading(false);
  };

  return (
    <>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6 flex gap-6 h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 hidden md:flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700 text-sm">Past Conversations</h2>
          <div className="space-y-2 flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConvoId(c.id)}
                className={`w-full text-left rounded-lg p-2.5 text-sm transition-colors ${
                  activeConvoId === c.id ? "bg-red-50 text-red-700" : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <div className="font-medium truncate">{c.topic}</div>
                <div className="text-xs text-gray-400">{c.message_count} message{c.message_count !== 1 ? 's' : ''}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {!activeConvoId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-white border rounded-2xl p-8 w-full max-w-md shadow-sm">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Start New Conversation</h2>
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-600 block mb-2">Choose a topic</label>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTopic(t)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          topic === t
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="w-full bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {starting ? "Starting..." : "Start Conversation 💬"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-red-600 text-white rounded-br-sm"
                          : "bg-white border text-gray-800 rounded-bl-sm shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.new_vocab && msg.new_vocab.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.new_vocab.map((w) => (
                            <span key={w} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              ✅ {w} added to vocabulary
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border rounded-2xl px-4 py-3 text-gray-400 text-sm shadow-sm">
                      小明 is typing...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 pt-3 border-t">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type in Chinese..."
                  className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  發送
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
