"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMessages, sendMessage } from "../lib/chat";
import { getSocket } from "../lib/socket";
import { authedFetch } from "../lib/authed-fetch";
import { useAuthStore } from "../lib/auth-store";
import { toast } from "./ui/toast";
import { confirm } from "./ui/confirm";
import { AlertTriangle } from "lucide-react";

type EmergencyEvent = {
  id: string;
  status: "ACTIVE" | "RESOLVED" | "CANCELLED";
  reason: string | null;
  triggeredAt: string;
  triggeredBy: { id: string; fullName: string; role: string };
};

export default function EmergencyChatView({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [emergency, setEmergency] = useState<EmergencyEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadEmergency = async () => {
    try {
      const res = await authedFetch<{ ok: true; event: EmergencyEvent | null }>(
        `/emergency/conversation/${conversationId}`
      );
      setEmergency(res.event);
    } catch (e) {
      console.error("Failed to load emergency:", e);
    }
  };

  const loadMessages = async () => {
    try {
      const msgRes = await getMessages(conversationId);
      setMessages(msgRes.messages);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  };

  const load = async () => {
    setLoading(true);
    await Promise.all([loadEmergency(), loadMessages()]);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await load();
      const s = getSocket();
      if (!s) return;

      s.emit("conversation:join", conversationId);

      const onNew = (payload: any) => {
        if (!mounted) return;
        const msg = payload.message || payload;
        if (msg.conversationId !== conversationId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          30
        );
      };

      const onEmergencyStatus = (event: EmergencyEvent) => {
        if (!mounted) return;
        if (event.id === emergency?.id) {
          setEmergency(event);
          // If resolved, show message and allow exit
          if (event.status === "RESOLVED") {
            toast.success("Emergency has been resolved");
          }
        }
      };

      s.on("message:new", onNew);
      s.on("emergency:status", onEmergencyStatus);

      return () => {
        s.off("message:new", onNew);
        s.off("emergency:status", onEmergencyStatus);
        s.emit("conversation:leave", conversationId);
      };
    };

    let cleanup: any;
    run().then((c) => (cleanup = c));

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [conversationId]);

  const onSend = async () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    try {
      await sendMessage(conversationId, body);
      await loadMessages();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send message");
      setText(body); // Restore text on error
    }
  };

  const handleResolve = async () => {
    if (!emergency || !isSuperAdmin) return;

    const ok = await confirm({
      title: "Resolve Emergency?",
      message: "This will mark the emergency as resolved and close the alert.",
      confirmText: "Resolve",
      danger: true,
    });
    if (!ok) return;

    setResolving(true);
    try {
      await authedFetch(`/emergency/${emergency.id}/resolve`, {
        method: "POST",
      });
      toast.success("Emergency resolved");
      
      // Navigate to role-specific dashboard after resolving
      if (!user) {
        router.push("/dashboard");
        return;
      }
      
      let dashboardPath = "/dashboard";
      if (user.role === "SUPER_ADMIN") {
        dashboardPath = "/dashboard/super";
      } else if (user.role === "ADMIN") {
        dashboardPath = "/dashboard/admin";
      } else if (user.role === "ELITE") {
        dashboardPath = "/dashboard/elite";
      } else {
        dashboardPath = "/dashboard/user";
      }
      
      router.push(dashboardPath);
    } catch (e: any) {
      toast.error(e?.message || "Failed to resolve emergency");
    } finally {
      setResolving(false);
    }
  };

  const handleExit = () => {
    // Navigate to role-specific dashboard
    if (!user) {
      router.push("/dashboard");
      return;
    }
    
    let dashboardPath = "/dashboard";
    if (user.role === "SUPER_ADMIN") {
      dashboardPath = "/dashboard/super";
    } else if (user.role === "ADMIN") {
      dashboardPath = "/dashboard/admin";
    } else if (user.role === "ELITE") {
      dashboardPath = "/dashboard/elite";
    } else {
      dashboardPath = "/dashboard/user";
    }
    
    router.push(dashboardPath);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading emergency chat...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="border-b border-red-900 bg-red-950 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-red-500 animate-pulse">
                <AlertTriangle size={24} />
              </span>
              EMERGENCY CHAT
            </div>
            {emergency && (
              <div className="text-sm text-red-200 mt-2">
                Triggered by {emergency.triggeredBy.fullName} •{" "}
                {new Date(emergency.triggeredAt).toLocaleString()}
                {emergency.reason && ` • ${emergency.reason}`}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && emergency?.status === "ACTIVE" && (
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {resolving ? "Resolving..." : "Resolve Emergency"}
              </button>
            )}
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-colors"
            >
              Exit Emergency Chat
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className="rounded-xl bg-red-950 border border-red-900 p-4"
            >
              <div className="text-white text-sm whitespace-pre-wrap">{m.body}</div>
              <div className="text-xs text-red-300 mt-2">
                {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-red-900 bg-red-950 p-6">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            className="flex-1 rounded-lg border border-red-800 bg-black text-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-600 placeholder:text-red-400"
            placeholder="Type a message..."
          />
          <button
            onClick={onSend}
            disabled={!text.trim()}
            className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
