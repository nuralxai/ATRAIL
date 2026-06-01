"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Protected from "./Protected";
import { listConversations, type ConversationItem } from "../lib/chat";
import { MessageSquare, User, Briefcase, Search } from "lucide-react";
import Skeleton from "./ui/Skeleton";

export default function ChatShell({
  selectedId,
  children,
}: {
  selectedId?: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const res = await listConversations();
        setItems(res.conversations);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = items.filter((c) => {
    const title =
      c.type === "DIRECT"
        ? c.otherUser?.fullName ?? "Direct Chat"
        : c.project?.name ?? "Project";
    return title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Protected>
      <div
        className="h-screen grid"
        style={{ gridTemplateColumns: "300px 1fr" }}
      >
        {/* Sidebar */}
        <aside
          className="flex flex-col border-r overflow-hidden"
          style={{
            background: "rgba(6,22,40,0.95)",
            borderColor: "rgba(0,212,255,0.08)",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-4 border-b flex-shrink-0"
            style={{ borderColor: "rgba(0,212,255,0.08)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={18} className="text-primary flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-[#e2e8f0]">Chat</div>
                <div className="text-[10px] text-[#64748b] font-medium tracking-wider uppercase">
                  Hierarchy Enforced
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs text-[#e2e8f0] placeholder:text-[#374151] font-medium outline-none transition-all"
                style={{
                  background: "rgba(13,37,64,0.5)",
                  border: "1px solid rgba(0,212,255,0.1)",
                }}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                <MessageSquare size={20} className="text-[#374151] mb-2" />
                <p className="text-xs text-[#374151] font-medium">
                  {search ? "No matches found" : "No conversations yet"}
                </p>
              </div>
            ) : (
              filtered.map((c) => {
                const isProject = c.type !== "DIRECT";
                const title = isProject
                  ? (c.project?.name ?? "Project")
                  : (c.otherUser?.fullName ?? "Direct Chat");
                const sub = isProject
                  ? "Project Channel"
                  : (c.otherUser?.role ?? "");
                const active = c.id === selectedId;

                return (
                  <Link
                    key={c.id}
                    href={`/chat/${c.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
                    style={{
                      background: active ? "rgba(0,212,255,0.1)" : "transparent",
                      border: active
                        ? "1px solid rgba(0,212,255,0.2)"
                        : "1px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(0,212,255,0.04)";
                        e.currentTarget.style.borderColor = "rgba(0,212,255,0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                      }
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isProject
                          ? "rgba(124,58,237,0.15)"
                          : "rgba(0,212,255,0.12)",
                        color: isProject ? "#a78bfa" : "#00d4ff",
                      }}
                    >
                      {isProject ? <Briefcase size={13} /> : <User size={13} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className="text-xs font-semibold truncate"
                        style={{ color: active ? "#00d4ff" : "#e2e8f0" }}
                      >
                        {title}
                      </div>
                      <div className="text-[10px] truncate font-medium mt-0.5" style={{ color: "#64748b" }}>
                        {c.lastMessage ? c.lastMessage.body : sub}
                      </div>
                    </div>

                    {active && (
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "#00d4ff", boxShadow: "0 0 8px rgba(0,212,255,0.7)" }}
                      />
                    )}
                    {(c.unreadCount ?? 0) > 0 && !active && (
                      <div
                        className="flex items-center justify-center text-[10px] font-bold rounded-full px-1.5 min-w-[1.25rem] h-5 flex-shrink-0"
                        style={{ background: "#ef4444", color: "#ffffff" }}
                      >
                        {c.unreadCount! > 99 ? '99+' : c.unreadCount}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        {/* Main chat area */}
        <main
          className="overflow-hidden"
          style={{
            background: "rgba(2,11,24,0.85)",
          }}
        >
          {children}
        </main>
      </div>
    </Protected>
  );
}
