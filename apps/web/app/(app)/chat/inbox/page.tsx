"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm";
import Link from "next/link";

type ChatPermission = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";
  elite: { id: string; fullName: string; email: string };
  createdAt: string;
};

export default function ChatInboxPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<ChatPermission[]>([]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await authedFetch<{ ok: true; requests: ChatPermission[] }>(
        "/chat/requests/inbox"
      );
      setRequests(res.requests ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  const handleAction = async (id: string, action: "accept" | "reject" | "block") => {
    const actionText = action === "accept" ? "accept" : action === "reject" ? "reject" : "block";
    const ok = await confirm({
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} request?`,
      message:
        action === "accept"
          ? "This will allow the elite user to message you."
          : action === "reject"
            ? "This will reject the request."
            : "This will block the user from messaging you.",
      confirmText: actionText.charAt(0).toUpperCase() + actionText.slice(1),
      danger: action === "block",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await authedFetch(`/chat/requests/${id}/${action}`, {
        method: "POST",
      });
      toast.success(`Request ${actionText}ed`);
      await load();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${actionText}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppShell title="Chat Requests" subtitle="Admin only">
        <Card>
          <CardContent>
            <div className="text-sm text-text-muted">
              Only admins can view chat requests.
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Chat Requests"
      subtitle="Manage requests from elite users"
      right={
        <div className="flex items-center gap-2">
          <Link href="/chat">
            <Button variant="secondary">Back to Chat</Button>
          </Link>
          <Button variant="secondary" onClick={load} disabled={busy || loading}>
            Refresh
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader
          title="Pending Requests"
          subtitle="Elite users requesting permission to message you"
          right={<Badge tone="neutral">{requests.length}</Badge>}
        />
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-text-muted">No pending requests.</div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-primary/20 glass-panel p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">
                        {r.elite.fullName}
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        {r.elite.email}
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        Requested {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => handleAction(r.id, "reject")}
                        disabled={busy}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleAction(r.id, "block")}
                        disabled={busy}
                      >
                        Block
                      </Button>
                      <Button
                        onClick={() => handleAction(r.id, "accept")}
                        disabled={busy}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
