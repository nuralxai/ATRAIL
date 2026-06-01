"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { getSocket } from "@/lib/socket-client";
import { toast } from "@/components/ui/toast";
import { Check, CheckCheck } from "lucide-react";
import Link from "next/link";

type Conv = {
  id: string;
  type: "DIRECT" | "PROJECT";
  project: { id: string; name: string } | null;
  otherUser: { id: string; fullName: string; role: string } | null;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  canSend: boolean;
};

type ChatPermission = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";
  elite: { id: string; fullName: string; email: string };
  admin: { id: string; fullName: string; email: string };
  createdAt: string;
};

type Msg = { id: string; body: string; senderId: string; createdAt: string };

type UserLite = { id: string; fullName: string; email: string; role: string };



function initials(name?: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "");
}

export default function ChatPage() {
  const { user, accessToken } = useAuthStore();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [convs, setConvs] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // delivery statuses
  const [receiptMap, setReceiptMap] = useState<Record<string, { read: string | null, delivered: string | null }>>({});

  const [text, setText] = useState("");

  // new chat modal
  const [newOpen, setNewOpen] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [userQ, setUserQ] = useState("");
  const [toUserId, setToUserId] = useState("");

  // chat permission state
  const [permissionStatus, setPermissionStatus] = useState<
    "NONE" | "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED"
  >("NONE");
  const [requesting, setRequesting] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConvs = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await authedFetch<{ ok: true; conversations: Conv[] }>(
        "/chat/conversations"
      );
      const items = res.conversations ?? [];
      setConvs(items);

      // Check if there's a selected conversation from URL params
      const urlSelected = searchParams.get("selected");
      if (urlSelected && items.some((c) => c.id === urlSelected)) {
        setSelectedId(urlSelected);
      } else if (!selectedId && items.length) {
        setSelectedId(items[0].id);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await authedFetch<{ ok: true; users: UserLite[] }>("/users");
      setUsers(res.users ?? []);
    } catch {
      // ignore
    }
  };

  const loadMessages = async (conversationId: string, reset: boolean) => {
    setErr(null);
    if (reset) {
      setMsgs([]);
      setCursor(null);
    }
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "30");
      if (!reset && cursor) qs.set("cursor", cursor);

      const res = await authedFetch<{
        ok: true;
        messages: Msg[];
        nextCursor: string | null;
        receiptMembers?: { userId: string, lastReadMessageId: string | null, lastDeliveredMessageId: string | null }[];
      }>(`/chat/conversations/${conversationId}/messages?${qs.toString()}`);

      if (reset) {
        setMsgs(res.messages ?? []);
      } else {
        // prepend older messages
        setMsgs((prev) => [...(res.messages ?? []), ...prev]);
      }
      setCursor(res.nextCursor ?? null);
      
      // Load receipt map
      if (res.receiptMembers) {
        const newMap = reset ? {} : { ...receiptMap };
        res.receiptMembers.forEach(m => {
          if (m.userId !== user?.id) {
            newMap[m.userId] = { read: m.lastReadMessageId, delivered: m.lastDeliveredMessageId };
          }
        });
        setReceiptMap(newMap);
      }

      if (reset) {
        setTimeout(
          () =>
            bottomRef.current?.scrollIntoView({ behavior: "instant" as any }),
          50
        );
        // Mark as read immediately
        if (res.messages && res.messages.length > 0) {
          const s = getSocket(useAuthStore.getState().accessToken!);
          s.emit("message:read", { conversationId, messageId: res.messages[res.messages.length - 1].id });
        }
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load messages");
    }
  };

  useEffect(() => {
    loadConvs();
  }, [searchParams]); // Re-load when URL params change

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return convs
      .filter((c) => {
        const title =
          c.type === "PROJECT" ? c.project?.name : c.otherUser?.fullName;
        return !term ? true : (title ?? "").toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const ta = a.lastMessage?.createdAt ?? "1970-01-01";
        const tb = b.lastMessage?.createdAt ?? "1970-01-01";
        return new Date(tb).getTime() - new Date(ta).getTime();
      });
  }, [convs, q]);

  const selected = useMemo(
    () => convs.find((c) => c.id === selectedId) ?? null,
    [convs, selectedId]
  );

  const getMessageStatus = (msgId: string) => {
    let isRead = false;
    let isDelivered = false;

    const msgIdx = msgs.findIndex((m) => m.id === msgId);
    if (msgIdx === -1) return "SENT";

    Object.values(receiptMap).forEach((status) => {
      if (status.read) {
        const idx = msgs.findIndex((m) => m.id === status.read);
        if (idx !== -1 && msgIdx <= idx) isRead = true;
        if (idx === -1) isRead = true; // newer message outside loaded window
      }
      if (status.delivered) {
        const idx = msgs.findIndex((m) => m.id === status.delivered);
        if (idx !== -1 && msgIdx <= idx) isDelivered = true;
        if (idx === -1) isDelivered = true;
      }
    });

    if (isRead) return "READ";
    if (isDelivered) return "DELIVERED";
    return "SENT";
  };

  // Socket: join room + listen new messages + new conversations
  useEffect(() => {
    if (!accessToken) return;

    const s = getSocket(accessToken);

    if (selectedId) {
      s.emit("conversation:join", selectedId);
      // mark read for the last message if any
      if (msgs.length > 0) {
        s.emit("message:read", { conversationId: selectedId, messageId: msgs[msgs.length - 1].id });
      }
    }

    const onNewMessage = (payload: {
      conversationId: string;
      message: Msg;
    }) => {
      const convId = payload.conversationId;
      const msg = payload.message;

      // Automatically send delivery receipt if we received it
      if (msg.senderId !== user?.id) {
        s.emit("message:delivered", { conversationId: convId, messageId: msg.id });
      }

      if (convId !== selectedId) {
        // update lastMessage ordering
        setConvs((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, lastMessage: msg as any } : c
          )
        );
        return;
      }

      // If we are looking at this conversation, auto-read
      if (msg.senderId !== user?.id) {
        s.emit("message:read", { conversationId: convId, messageId: msg.id });
      }

      setMsgs((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      setConvs((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, lastMessage: msg as any } : c
        )
      );

      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    };

    const onReceiptDelivered = (payload: { conversationId: string, messageId: string, userId: string }) => {
      if (payload.userId === user?.id) return;
      setReceiptMap(prev => ({
        ...prev,
        [payload.userId]: { ...(prev[payload.userId] || { read: null }), delivered: payload.messageId }
      }));
    };

    const onReceiptRead = (payload: { conversationId: string, messageId: string, userId: string }) => {
      if (payload.userId === user?.id) return;
      setReceiptMap(prev => ({
        ...prev,
        [payload.userId]: { read: payload.messageId, delivered: payload.messageId }
      }));
    };

    const onNewConversation = async (payload: { conversation: any }) => {
      // Refresh conversation list when a new conversation is created
      await loadConvs();

      // If this is a conversation we're part of, auto-select it if none selected
      const conv = payload.conversation;
      if (conv) {
        // Conversation format matches listConversations: has otherUser or project
        // If it has otherUser, we're a member (it's a direct chat with us)
        // If it has project, we're a member (it's a project chat)
        const isMember = conv.otherUser || conv.project;

        if (isMember && !selectedId) {
          setSelectedId(conv.id);
        }
      }
    };

    s.on("message:new", onNewMessage);
    s.on("receipt:delivered", onReceiptDelivered);
    s.on("receipt:read", onReceiptRead);
    s.on("conversation:new", onNewConversation);

    return () => {
      s.off("message:new", onNewMessage);
      s.off("receipt:delivered", onReceiptDelivered);
      s.off("receipt:read", onReceiptRead);
      s.off("conversation:new", onNewConversation);
    };
  }, [accessToken, selectedId, user?.id, msgs.length, msgs]);

  // When selecting a conversation -> load messages and check permission
  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId, true);
    checkPermissionStatus();
  }, [selectedId, selected]);

  const checkPermissionStatus = async () => {
    if (!selected || !user || selected.type !== "DIRECT") {
      setPermissionStatus("NONE");
      return;
    }

    const otherUser = selected.otherUser;
    if (!otherUser) {
      setPermissionStatus("NONE");
      return;
    }

    // Only check if ELITE trying to message ADMIN
    if (user.role === "ELITE" && otherUser.role === "ADMIN") {
      try {
        const res = await authedFetch<{ ok: true; status: string }>(
          `/chat/requests/status?adminId=${otherUser.id}`
        );
        setPermissionStatus(
          (res.status === "NONE" ? "NONE" : res.status) as any
        );
      } catch {
        setPermissionStatus("NONE");
      }
    } else {
      setPermissionStatus("NONE");
    }
  };

  const createRequest = async () => {
    if (!selected || !selected.otherUser) return;
    setRequesting(true);
    try {
      await authedFetch("/chat/requests", {
        method: "POST",
        body: JSON.stringify({ adminId: selected.otherUser.id }),
      });
      toast.success("Request sent");
      await checkPermissionStatus();
      await loadConvs();
    } catch (e: any) {
      toast.error(e.message || "Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  const send = async () => {
    if (!selected || !text.trim()) return;
    if (!selected.canSend) {
      toast.error("Not permitted.");
      return;
    }

    setBusy(true);
    setErr(null);

    const body = text.trim();
    setText("");

    try {
      const res = await authedFetch<{ ok: true; message: Msg }>(
        `/chat/conversations/${selected.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        }
      );

      const msg = res.message;
      setMsgs((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      setConvs((prev) =>
        prev.map((c) =>
          c.id === selected.id ? { ...c, lastMessage: msg as any } : c
        )
      );
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    } catch (e: any) {
      const errorMsg = e.message || "Send failed";
      setErr(errorMsg);
      toast.error(errorMsg);
      // Restore text if send failed
      setText(body);
    } finally {
      setBusy(false);
    }
  };

  const openNewChat = async () => {
    setNewOpen(true);
    setUserQ("");
    setToUserId("");
    await loadUsers();
  };

  const createDirect = async () => {
    if (!toUserId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch<{ ok: true; conversation: any }>(
        "/chat/direct",
        {
          method: "POST",
          body: JSON.stringify({ toUserId }),
        }
      );

      await loadConvs();

      const id = res.conversation?.id;
      if (id) setSelectedId(id);

      setNewOpen(false);
      toast.success("Chat started");
    } catch (e: any) {
      toast.error(
        e.message ||
          "Cannot start chat with this user. They must initiate the conversation first."
      );
    } finally {
      setBusy(false);
    }
  };

  const userList = useMemo(() => {
    const term = userQ.trim().toLowerCase();
    const filtered = users.filter((u) => {
      // Don't show self
      if (u.id === user?.id) return false;

      // Filter based on initiation rules
      const myRole = user?.role;
      const theirRole = u.role;

      // SUPER_ADMIN can initiate with everyone
      if (myRole === "SUPER_ADMIN") return true;

      // ADMIN can initiate with everyone
      if (myRole === "ADMIN") return true;

      // ELITE can initiate with USER, ELITE, and ADMIN
      if (myRole === "ELITE")
        return (
          theirRole === "USER" || theirRole === "ELITE" || theirRole === "ADMIN"
        );

      // USER can only initiate with ELITE
      if (myRole === "USER") return theirRole === "ELITE";

      return false;
    });

    return filtered.filter((u) =>
      !term
        ? true
        : u.fullName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)
    );
  }, [users, userQ, user?.id, user?.role]);

  return (
    <AppShell
      title="Chat"
      subtitle="Hierarchy-safe messaging + realtime delivery."
      right={
        <div className="flex items-center gap-2">
          {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
            <Link href="/chat/inbox">
              <Button variant="ghost">Requests</Button>
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={loadConvs}
            disabled={busy || loading}
          >
            Refresh
          </Button>
          <Button onClick={openNewChat}>New Chat</Button>
        </div>
      }
    >
      {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inbox */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Inbox"
            subtitle="Direct & project conversations"
            right={<Badge tone="neutral">{filtered.length}</Badge>}
          />
          <CardContent className="space-y-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search conversations…"
            />

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-text-muted">No conversations.</div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => {
                  const title =
                    c.type === "PROJECT"
                      ? (c.project?.name ?? "Project")
                      : (c.otherUser?.fullName ?? "Direct");
                  const subtitle =
                    c.type === "PROJECT"
                      ? "Project chat"
                      : c.otherUser?.role
                        ? `${c.otherUser.role}`
                        : "Direct chat";
                  const active = selectedId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={
                        "w-full text-left rounded-2xl border p-3 transition " +
                        (active
                          ? "border-zinc-900 glass-panel"
                          : "border-primary/20 glass-panel hover:glass-panel")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-primary truncate">
                            {title ?? "Conversation"}
                          </div>
                          <div className="text-xs text-text-muted mt-1">
                            {subtitle ?? ""}
                          </div>
                          {c.lastMessage && (
                            <div className="text-xs text-text-muted mt-2 truncate">
                              {c.lastMessage.body}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation */}
        <Card className="lg:col-span-2 min-h-[520px] flex flex-col">
          <CardHeader
            title={
              selected
                ? selected.type === "PROJECT"
                  ? (selected.project?.name ?? "Project")
                  : (selected.otherUser?.fullName ?? "Direct")
                : "Conversation"
            }
            subtitle={
              selected
                ? selected.type === "PROJECT"
                  ? "Project channel"
                  : "Direct chat"
                : "Select a conversation"
            }
            right={
              selected?.type === "DIRECT" && selected.otherUser ? (
                <div className="h-9 w-9 rounded-2xl glass-panel text-white flex items-center justify-center text-xs font-bold">
                  {initials(selected.otherUser.fullName)}
                </div>
              ) : null
            }
          />
          <CardContent className="flex-1 flex flex-col min-h-0">
            {!selected ? (
              <div className="text-sm text-text-muted">
                Pick a conversation from the inbox.
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-auto rounded-2xl border border-primary/20 glass-panel glass-panel p-4">
                  <div className="flex justify-center mb-3">
                    <Button
                      variant="secondary"
                      disabled={loadingMore || !cursor}
                      onClick={async () => {
                        if (!cursor) return;
                        setLoadingMore(true);
                        await loadMessages(selected.id, false);
                        setLoadingMore(false);
                      }}
                    >
                      {cursor ? "Load older messages" : "No more"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {msgs.map((m) => {
                      const mine = m.senderId === user?.id;
                      const status = getMessageStatus(m.id);
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={
                              "max-w-[75%] rounded-2xl px-4 py-2 text-sm " +
                              (mine
                                ? "glass-panel text-white"
                                : "bg-[#222] text-primary")
                            }
                          >
                            <div className="whitespace-pre-wrap">{m.body}</div>
                            <div
                              className={`mt-1 text-[10px] flex items-center justify-end gap-1 ${mine ? "text-white/70" : "text-text-muted"}`}
                            >
                              {new Date(m.createdAt).toLocaleString()}
                              {mine && (
                                <span className="ml-1">
                                  {status === "SENT" && <Check className="w-3 h-3 text-text-muted" />}
                                  {status === "DELIVERED" && <CheckCheck className="w-3 h-3 text-text-muted" />}
                                  {status === "READ" && <CheckCheck className="w-3 h-3 text-primary" />}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                </div>

                {/* Permission request UI for ELITE -> ADMIN */}
                {selected.type === "DIRECT" &&
                  selected.otherUser &&
                  user?.role === "ELITE" &&
                  selected.otherUser.role === "ADMIN" &&
                  permissionStatus !== "ACCEPTED" &&
                  !selected.canSend && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      {permissionStatus === "PENDING" ? (
                        <div className="text-sm text-amber-900">
                          <div className="font-semibold">Request pending</div>
                          <div className="text-xs text-amber-700 mt-1">
                            Waiting for admin approval to send messages.
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm text-amber-900">
                            <div className="font-semibold">
                              Permission required
                            </div>
                            <div className="text-xs text-amber-700 mt-1">
                              You need approval from this admin to send
                              messages.
                            </div>
                          </div>
                          <Button
                            onClick={createRequest}
                            disabled={requesting}
                            variant="secondary"
                          >
                            {requesting
                              ? "Sending..."
                              : "Request to message Admin"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                {/* Composer */}
                {selected.canSend && (
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Type a message…"
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />
                    <Button onClick={send} disabled={busy || !text.trim()}>
                      Send
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={newOpen}
        title="New Direct Chat"
        subtitle="Pick a user to start a conversation."
        onClose={() => (!busy ? setNewOpen(false) : null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setNewOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={createDirect} disabled={busy || !toUserId}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
            placeholder="Search users…"
          />
          <div className="max-h-[360px] overflow-auto rounded-2xl border border-primary/20 glass-panel">
            {userList.map((u) => (
              <button
                key={u.id}
                onClick={() => setToUserId(u.id)}
                className={
                  "w-full text-left px-4 py-3 border-b border-zinc-100 hover:glass-panel " +
                  (toUserId === u.id ? "glass-panel" : "")
                }
              >
                <div>
                  <div className="text-sm font-semibold">{u.fullName}</div>
                  <div className="text-xs text-text-muted mt-1">{u.email}</div>
                </div>
              </button>
            ))}
            {userList.length === 0 && (
              <div className="px-4 py-6 text-sm text-text-muted">
                No users found.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
