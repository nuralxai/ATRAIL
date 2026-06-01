"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMessages, sendMessage, markConversationRead, deleteMessage, type ConversationItem } from "../lib/chat";
import { listConversations } from "../lib/chat";
import { getSocket } from "../lib/socket";
import { Send, User, Briefcase, Info, Trash2, Paperclip } from "lucide-react";
import { useAuthStore } from "../lib/auth-store";

export default function ChatView({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<ConversationItem | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const currentUser = useAuthStore((s) => s.user);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      markConversationRead(conversationId).catch(() => {});
    }
  }, [messages.length, conversationId]);

  const title = useMemo(() => {
    if (!meta) return "Conversation";
    return meta.type === "DIRECT"
      ? `${meta.otherUser?.fullName ?? "Direct"} (${meta.otherUser?.role ?? ""})`
      : (meta.project?.name ?? "Project");
  }, [meta]);

  const canSend = meta?.type === "DIRECT" ? !!meta.canSend : true;

  const load = async () => {
    const [convRes, msgRes] = await Promise.all([
      listConversations(),
      getMessages(conversationId),
    ]);
    setMeta(convRes.conversations.find((c) => c.id === conversationId) ?? null);
    setMessages(msgRes.messages);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      await load();
      const s = getSocket();
      if (!s) return;
      s.emit("conversation:join", conversationId);
      const onNew = (msg: any) => {
        if (!mounted) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      };
      s.on("message:new", onNew);
      s.on("typing:start", (data: any) => {
        if (data.conversationId !== conversationId || data.userId === currentUser?.id) return;
        setTypingUsers(prev => { const n = new Set(prev); n.add(data.userId); return n; });
      });
      s.on("typing:stop", (data: any) => {
        if (data.conversationId !== conversationId) return;
        setTypingUsers(prev => { const n = new Set(prev); n.delete(data.userId); return n; });
      });
      return () => { 
        s.off("message:new", onNew); 
        s.off("typing:start");
        s.off("typing:stop");
        s.emit("conversation:leave", conversationId); 
      };
    };
    let cleanup: any;
    run().then((c) => (cleanup = c));
    return () => { mounted = false; if (cleanup) cleanup(); };
  }, [conversationId]);

  const onSend = async () => {
    if ((!text.trim() && !selectedFile) || sending) return;
    const body = text.trim();
    setText("");
    setSending(true);
    const s = getSocket();
    if (s) s.emit("typing:stop", conversationId);
    
    try {
      let filePayload;
      if (selectedFile) {
        // Mock file upload for demo using ObjectURL
        filePayload = {
          url: URL.createObjectURL(selectedFile),
          name: selectedFile.name,
          type: selectedFile.type
        };
        setSelectedFile(null);
      }
      await sendMessage(conversationId, body, filePayload);
      await load();
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    const s = getSocket();
    if (s) {
      s.emit("typing:start", conversationId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        s.emit("typing:stop", conversationId);
      }, 2000);
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm("Delete message?")) return;
    try {
      await deleteMessage(msgId);
      await load();
    } catch (e) {
      alert("Failed to delete message");
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const isProject = meta?.type !== "DIRECT";
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="px-5 py-3.5 flex items-center gap-3 flex-shrink-0 border-b"
        style={{
          background: "rgba(6,22,40,0.9)",
          borderColor: "rgba(0,212,255,0.08)",
          backdropFilter: "blur(24px)",
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isProject ? "rgba(124,58,237,0.15)" : "rgba(0,212,255,0.12)",
            color: isProject ? "#a78bfa" : "#00d4ff",
          }}
        >
          {isProject ? <Briefcase size={15} /> : <User size={15} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#e2e8f0] truncate">{title}</div>
          <div className="text-[10px] text-[#64748b] font-medium mt-px">
            {isProject ? "Project Channel" : "Direct Message"}
          </div>
        </div>
        {!canSend && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}
          >
            <Info size={12} />
            Read-only
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-3"
        style={{ background: "rgba(2,11,24,0.6)" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.1)" }}
            >
              <Send size={18} className="text-[#374151]" />
            </div>
            <p className="text-xs text-[#374151] font-medium">No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isOwn = m.sender?.id === currentUser?.id || m.senderId === currentUser?.id;
          const senderName = m.sender?.fullName ?? "Unknown";
          const showSender = !isOwn && (i === 0 || messages[i - 1]?.sender?.id !== m.sender?.id);

          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
              style={{ animation: `slide-up 0.2s ease ${i < 20 ? 0 : 0}s both` }}
            >
              {/* Avatar */}
              {!isOwn && (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold self-end mb-1"
                  style={{
                    background: "rgba(0,212,255,0.12)",
                    color: "#00d4ff",
                    minWidth: "2rem",
                  }}
                >
                  {senderName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                {showSender && (
                  <span className="text-[10px] text-[#64748b] font-semibold mb-1 px-1">
                    {senderName}
                  </span>
                )}
                <div
                  className="px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed"
                  style={isOwn && !m.deletedAt ? {
                    background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                    color: "#020b18",
                    borderRadius: "18px 18px 4px 18px",
                    boxShadow: "0 4px 20px rgba(0,212,255,0.25)",
                  } : {
                    background: "rgba(13,37,64,0.8)",
                    color: m.deletedAt ? "#64748b" : "#e2e8f0",
                    border: "1px solid rgba(0,212,255,0.1)",
                    borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    fontStyle: m.deletedAt ? "italic" : "normal"
                  }}
                >
                  {m.fileUrl && !m.deletedAt && (
                    <div className="mb-2">
                      {m.fileType?.startsWith('image/') ? (
                        <img src={m.fileUrl} alt={m.fileName} className="max-w-xs rounded-lg mb-1" />
                      ) : (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" className="underline hover:text-[#00d4ff] flex items-center gap-1"><Paperclip size={12}/> {m.fileName}</a>
                      )}
                    </div>
                  )}
                  {m.body}
                </div>
                <div className="flex gap-2 items-center mt-1 px-1">
                  <span className="text-[10px] text-[#374151] font-medium">
                    {formatTime(m.createdAt)}
                  </span>
                  {isOwn && !m.deletedAt && (
                    <button onClick={() => handleDelete(m.id)} className="text-[#374151] hover:text-red-400 transition-colors">
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.size > 0 && (
        <div className="px-5 py-1 text-xs text-[#64748b] italic" style={{ background: "rgba(2,11,24,0.6)" }}>
          {typingUsers.size === 1 ? "Someone is typing..." : "Multiple people are typing..."}
        </div>
      )}

      {/* Input */}
      <div
        className="px-4 py-3.5 flex items-center gap-3 flex-shrink-0 border-t flex-wrap"
        style={{
          background: "rgba(6,22,40,0.92)",
          borderColor: "rgba(0,212,255,0.08)",
          backdropFilter: "blur(24px)",
        }}
      >
        {selectedFile && (
          <div className="w-full text-xs text-[#00d4ff] px-2 flex justify-between">
            <span>Attached: {selectedFile.name}</span>
            <button onClick={() => setSelectedFile(null)} className="hover:text-white">x</button>
          </div>
        )}
        <label className={`cursor-pointer w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors ${canSend ? "hover:bg-[#1e293b]" : "opacity-40"}`} style={{ color: "#64748b" }}>
          <Paperclip size={18} />
          <input type="file" className="hidden" disabled={!canSend} onChange={e => e.target.files && setSelectedFile(e.target.files[0])} />
        </label>
        <input
          ref={inputRef}
          disabled={!canSend}
          value={text}
          onChange={handleTextChange}
          onKeyDown={onKey}
          className="flex-1 rounded-xl text-sm font-medium text-[#e2e8f0] placeholder:text-[#374151] px-4 py-3 outline-none transition-all duration-300 disabled:opacity-40"
          style={{
            background: "rgba(13,37,64,0.6)",
            border: "1px solid rgba(0,212,255,0.12)",
          }}
          placeholder={canSend ? "Type a message… (Enter to send)" : "Reply disabled by hierarchy"}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(0,212,255,0.4)";
            e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.06)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(0,212,255,0.12)";
            e.target.style.boxShadow = "none";
          }}
        />
        <button
          disabled={!canSend || (!text.trim() && !selectedFile) || sending}
          onClick={onSend}
          className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:transform-none"
          style={{
            background: "linear-gradient(135deg, #00d4ff, #0284c7)",
            boxShadow: "0 4px 16px rgba(0,212,255,0.3)",
            color: "#020b18",
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
