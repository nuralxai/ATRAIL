"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm";

type Notice = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  createdBy: { fullName: string };
  seen: boolean;
};

export default function NoticesPage() {
  const { user } = useAuthStore();
  const canPublish = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await authedFetch<{ ok: true; notices: Notice[] }>(
        "/notices"
      );
      setNotices(res.notices ?? []);
    } catch (e: any) {
      setErr(e.message || "Failed");
      toast.error(e.message || "Failed to load notices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markSeen = async (id: string) => {
    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/notices/${id}/seen`, { method: "POST" });
      toast.success("Marked as seen");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (id: string, to: boolean) => {
    const ok = await confirm({
      title: to ? "Pin notice?" : "Unpin notice?",
      message: "This changes visibility order for everyone.",
      confirmText: to ? "Pin" : "Unpin",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/notices/${id}/pin`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: to }),
      });
      toast.success(to ? "Pinned" : "Unpinned");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!canPublish) return;

    const t = title.trim();
    const c = content.trim();
    if (t.length < 2) return toast.error("Title too short");
    if (c.length < 2) return toast.error("Content too short");

    const ok = await confirm({
      title: "Publish notice?",
      message: "This will be visible to everyone immediately.",
      confirmText: "Publish",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch("/notices", {
        method: "POST",
        body: JSON.stringify({ title: t, content: c, pinned }),
      });
      setTitle("");
      setContent("");
      setPinned(false);
      toast.success("Notice published");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Notices"
      subtitle="Announcements and updates for your workspace."
      right={
        <Button variant="secondary" onClick={load} disabled={busy || loading}>
          Refresh
        </Button>
      }
    >
      {err && <div className="text-sm text-red-600 mb-4">{err}</div>}

      {canPublish && (
        <Card className="mb-4">
          <CardHeader
            title="New Notice"
            subtitle="Write once, visible to everyone."
          />
          <CardContent className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Content"
            />
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <Button onClick={create} disabled={busy}>
              Publish
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title="All Notices" subtitle="Pinned items appear first" />
        <CardContent>
          {loading ? (
            <div className="text-sm text-primary-light opacity-70">Loading…</div>
          ) : notices.length === 0 ? (
            <div className="text-sm text-primary-light opacity-70">No notices.</div>
          ) : (
            <div className="space-y-3">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="rounded-2xl border border-primary/20 glass-panel p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-base font-semibold text-primary">{n.title}</div>
                        {n.pinned && <Badge tone="amber">PINNED</Badge>}
                        {n.seen ? (
                          <Badge tone="green">SEEN</Badge>
                        ) : (
                          <Badge tone="blue">NEW</Badge>
                        )}
                      </div>

                      <div className="text-xs text-text-muted mt-1">
                        {new Date(n.createdAt).toLocaleString()} •{" "}
                        {n.createdBy.fullName}
                      </div>
                    </div>

                    {canPublish && (
                      <Button
                        variant="ghost"
                        onClick={() => togglePin(n.id, !n.pinned)}
                        disabled={busy}
                      >
                        {n.pinned ? "Unpin" : "Pin"}
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 text-sm text-text-main whitespace-pre-wrap">
                    {n.content}
                  </div>

                  {!n.seen && (
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        onClick={() => markSeen(n.id)}
                        disabled={busy}
                      >
                        Mark as seen
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
