"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function ClaudeChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const canSee = role === "admin" || role === "secretaria";

  if (!canSee) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      if (data.content) {
        setMessages([...updated, { role: "assistant", content: data.content }]);
      } else {
        setMessages([...updated, { role: "assistant", content: `Error: ${data.error || "Respuesta vacía"}` }]);
      }
    } catch (err) {
      setMessages([...updated, { role: "assistant", content: `Error de conexión: ${err instanceof Error ? err.message : String(err)}` }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 left-6 w-12 h-12 bg-brandit-black text-white rounded-full shadow-lg hover:bg-brandit-black/90 active:scale-95 transition-all flex items-center justify-center z-40"
        aria-label="Chat"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Chat Panel */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed bottom-6 left-6 z-50 w-80 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-brandit-black text-white flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-sm font-semibold">Asistente Brand It</p>
                <p className="text-[10px] text-gray-400">Powered by Claude</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg">&times;</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.length === 0 && !loading && (
                <p className="text-center text-gray-400 text-xs mt-8">Pregunta lo que necesites sobre leads, CxC, guías o caja.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-brandit-orange text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl rounded-bl-sm text-sm">
                    Escribiendo...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brandit-orange/20"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="bg-brandit-orange text-white rounded-xl px-3 py-2 text-sm font-medium hover:bg-brandit-orange/90 disabled:opacity-50 transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
