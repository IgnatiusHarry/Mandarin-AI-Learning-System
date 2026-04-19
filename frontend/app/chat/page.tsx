'use client';

import { useState, useRef, useEffect } from 'react';
import NavBar from '@/components/NavBar';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ming/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, conversationId }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '❌ Sorry, connection to Ming Laoshi failed. Please check if you are logged in.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-3.5rem)]">
        
        <div className="flex items-center gap-3 mb-4 p-4 bg-white rounded-2xl border-2 border-[#E5E5E5]">
          <div className="w-12 h-12 bg-[#F0FFF0] border-2 border-[#58CC02] rounded-full flex items-center justify-center text-xl">
            🦉
          </div>
          <div>
            <h1 className="font-black text-[#3C3C3C] text-lg">Ming Laoshi</h1>
            <p className="text-sm text-[#AFAFAF] font-bold">Mandarin AI Tutor</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
             <div className="text-center py-20 text-[#AFAFAF]">
               <div className="text-5xl mb-4">💬</div>
               <h2 className="font-black text-xl mb-2 text-[#3C3C3C]">Start Chatting</h2>
               <p className="max-w-sm mx-auto">
                 Practice your Mandarin with Ming Laoshi! Your progress and memory are shared with your Telegram bot.
               </p>
             </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-[15px] font-medium leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-[#58CC02] text-white rounded-br-sm' 
                    : 'bg-white border-2 border-[#E5E5E5] text-[#3C3C3C] rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
             <div className="flex justify-start">
               <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl rounded-bl-sm px-5 py-3.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-[#AFAFAF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[#AFAFAF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[#AFAFAF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
               </div>
             </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="pt-4 flex gap-2 border-t-2 border-[#E5E5E5] bg-[#F7F7F7] -mx-4 px-4 pb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type in Chinese... (中文)"
            className="flex-1 h-12 border-2 border-[#E5E5E5] rounded-xl px-4 text-sm font-medium focus:outline-none focus:border-[#58CC02] transition-colors bg-white shadow-sm"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="h-12 bg-[#58CC02] text-white border-b-4 border-[#58A700] rounded-xl px-6 font-black uppercase text-sm active:border-b-0 active:translate-y-1 hover:bg-[#4CAF00] transition-all disabled:opacity-50 disabled:border-b-0 disabled:translate-y-1"
          >
            Send
          </button>
        </div>
      </main>
    </>
  );
}
