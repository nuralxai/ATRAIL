"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useAuthStore } from "../lib/auth-store";
import { authedFetch } from "../lib/authed-fetch";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AiAssistant() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (!user) return null;

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const data = await authedFetch<{ ok: boolean; reply?: string; error?: string }>(
        "/ai/chat",
        { method: "POST", body: JSON.stringify({ message: userMessage, history }) }
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.ok && data.reply ? data.reply : `Error: ${data.error ?? "Unknown error"}`,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err?.message ?? "Connection to AI service failed. Check that NVIDIA_API_KEY is set." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* FAB Toggle */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 flex items-center justify-center rounded-2xl transition-all duration-300 hover:-translate-y-1"
        style={{
          width: "52px",
          height: "52px",
          background: isOpen
            ? "rgba(239,68,68,0.15)"
            : "linear-gradient(135deg, #00d4ff, #0284c7)",
          border: isOpen
            ? "1px solid rgba(239,68,68,0.3)"
            : "1px solid rgba(0,212,255,0.3)",
          boxShadow: isOpen
            ? "0 4px 20px rgba(239,68,68,0.2)"
            : "0 4px 24px rgba(0,212,255,0.4)",
          color: isOpen ? "#f87171" : "#020b18",
        }}
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl"
          style={{
            width: "380px",
            height: "500px",
            background: "linear-gradient(135deg, rgba(13,37,64,0.97) 0%, rgba(6,22,40,0.99) 100%)",
            border: "1px solid rgba(0,212,255,0.15)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.06), 0 0 60px rgba(0,212,255,0.04)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            animation: "scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {/* Top accent line */}
          <div
            className="h-px flex-shrink-0"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), rgba(124,58,237,0.4), transparent)",
            }}
          />

          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b"
            style={{ borderColor: "rgba(0,212,255,0.08)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff" }}
              >
                <Sparkles size={13} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#e2e8f0] leading-tight">AI Assistant</div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    style={{ boxShadow: "0 0 6px rgba(52,211,153,0.7)" }}
                  />
                  <span className="text-[10px] text-[#64748b] font-medium">Online · Llama 3.1</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setMessages([])}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-[#94a3b8] hover:bg-white/4 transition-all duration-200"
              title="Clear chat"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 px-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.12)" }}
                >
                  <Sparkles size={24} className="text-primary" />
                </div>
                <p className="text-sm text-[#64748b] font-medium leading-relaxed">
                  Hi! Ask me about tasks, HR, projects,<br />or anything workspace-related.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <div
                  className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed font-medium"
                  style={
                    msg.role === "user"
                      ? {
                          background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                          color: "#020b18",
                          borderRadius: "16px 16px 4px 16px",
                          boxShadow: "0 4px 16px rgba(0,212,255,0.25)",
                        }
                      : {
                          background: "rgba(13,37,64,0.7)",
                          color: "#e2e8f0",
                          border: "1px solid rgba(0,212,255,0.1)",
                          borderRadius: "16px 16px 16px 4px",
                          whiteSpace: "pre-wrap",
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex mr-auto">
                <div
                  className="px-4 py-3 rounded-2xl flex items-center gap-2"
                  style={{
                    background: "rgba(13,37,64,0.7)",
                    border: "1px solid rgba(0,212,255,0.1)",
                    borderRadius: "16px 16px 16px 4px",
                  }}
                >
                  <Loader2 size={14} className="text-primary" style={{ animation: "spin 1s linear infinite" }} />
                  <span className="text-sm text-[#64748b] font-medium">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="px-3 py-3 flex items-center gap-2 flex-shrink-0 border-t"
            style={{ borderColor: "rgba(0,212,255,0.08)", background: "rgba(6,22,40,0.5)" }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={isLoading}
              className="flex-1 text-sm font-medium text-[#e2e8f0] placeholder:text-[#374151] rounded-xl px-4 py-2.5 outline-none transition-all"
              style={{
                background: "rgba(13,37,64,0.6)",
                border: "1px solid rgba(0,212,255,0.12)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(0,212,255,0.4)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(0,212,255,0.12)";
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:transform-none"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                color: "#020b18",
                boxShadow: "0 4px 12px rgba(0,212,255,0.3)",
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
