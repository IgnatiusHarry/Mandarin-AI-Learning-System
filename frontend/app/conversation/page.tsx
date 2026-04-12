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

const TOPICS = ["Free Chat", "Food / Restaurants", "Travel", "Work / Study", "Family", "Taiwanese Culture", "Movies / Music"];

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
