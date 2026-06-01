"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Textarea from "@/components/ui/Textarea";
import Skeleton from "@/components/ui/Skeleton";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm";

type EmergencyEvent = {
  id: string;
  status: "ACTIVE" | "CANCELLED" | "RESOLVED";
  reason: string | null;
  triggeredAt: string;
  cancelledAt: string | null;
  resolvedAt: string | null;
  triggeredBy: { id: string; fullName: string; role: string };
};

export default function EmergencyPage() {
  const { user } = useAuthStore();
  const isSuper = user?.role === "SUPER_ADMIN";

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  const [myEvent, setMyEvent] = useState<EmergencyEvent | null>(null);
  const [cancelLeft, setCancelLeft] = useState<number | null>(null);

  const [active, setActive] = useState<EmergencyEvent[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);

  const loadActive = async () => {
    if (!isSuper) return;
    setLoadingActive(true);
    try {
      const res = await authedFetch<{ ok: true; events: EmergencyEvent[] }>(
        "/emergency/active"
      );
      setActive(res.events ?? []);
    } finally {
      setLoadingActive(false);
    }
  };

  useEffect(() => {
    loadActive();
  }, [isSuper]);

  const beginTrigger = () => {
    if (busy) return;
    setErr(null);
    if (countdown !== null) return;

    let t = 5;
    setCountdown(t);

    timerRef.current = setInterval(() => {
      t -= 1;
      if (t <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(null);
        fireTrigger();
      } else setCountdown(t);
    }, 1000);
  };

  const cancelCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(null);
  };

  const fireTrigger = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch<{ ok: true; event: EmergencyEvent }>(
        "/emergency/trigger",
        {
          method: "POST",
          body: JSON.stringify({
            reason: reason.trim() ? reason.trim() : undefined,
          }),
        }
      );
      setMyEvent(res.event);
      setReason("");
      toast.success("Emergency triggered");
      await loadActive();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const cancelEvent = async () => {
    if (!myEvent) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await authedFetch<{ ok: true; event: EmergencyEvent }>(
        `/emergency/${myEvent.id}/cancel`,
        {
          method: "POST",
        }
      );
      setMyEvent(res.event);
      await loadActive();
    } catch (e: any) {
      setErr(e.message || "Cancel failed (window expired)");
    } finally {
      setBusy(false);
    }
  };

  const resolveEvent = async (id: string) => {
    const ok = await confirm({
      title: "Resolve emergency?",
      message: "This will close the active emergency.",
      confirmText: "Resolve",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/emergency/${id}/resolve`, { method: "POST" });
      toast.success("Emergency resolved");
      await loadActive();
    } catch (e: any) {
      toast.error(e.message || "Resolve failed");
    } finally {
      setBusy(false);
    }
  };

  // cancel window: backend ~10 seconds
  useEffect(() => {
    if (!myEvent || myEvent.status !== "ACTIVE") {
      setCancelLeft(null);
      return;
    }
    const tick = () => {
      const triggered = new Date(myEvent.triggeredAt).getTime();
      const left = 10_000 - (Date.now() - triggered);
      setCancelLeft(left > 0 ? Math.ceil(left / 1000) : 0);
    };
    tick();
    const it = setInterval(tick, 250);
    return () => clearInterval(it);
  }, [myEvent?.id, myEvent?.status, myEvent?.triggeredAt]);

  const canCancelNow = useMemo(
    () => !!myEvent && myEvent.status === "ACTIVE" && (cancelLeft ?? 0) > 0,
    [myEvent, cancelLeft]
  );

  return (
    <AppShell
      title="Emergency"
      subtitle="Trigger emergency alert with confirmation."
      right={
        isSuper ? (
          <Button
            variant="secondary"
            onClick={loadActive}
            disabled={busy || loadingActive}
          >
            Refresh
          </Button>
        ) : null
      }
    >
      {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Trigger Emergency"
            subtitle="5-second confirmation + short cancel window."
          />
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-semibold text-red-700">
                Use only for real issues
              </div>
              <div className="text-sm text-red-700/80 mt-1">
                This action alerts leadership. You’ll get a confirmation
                countdown before it triggers.
              </div>
            </div>

            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Reason (optional)…"
              disabled={busy || countdown !== null}
            />

            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={beginTrigger}
                disabled={busy || countdown !== null}
              >
                Trigger
              </Button>
              {countdown !== null && (
                <Button
                  variant="secondary"
                  onClick={cancelCountdown}
                  disabled={busy}
                >
                  Cancel ({countdown})
                </Button>
              )}
            </div>

            {myEvent && (
              <div className="rounded-2xl border border-primary/20 glass-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Latest Event</div>
                    <div className="text-xs text-text-muted mt-1">
                      ID: {myEvent.id}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      Triggered at{" "}
                      {new Date(myEvent.triggeredAt).toLocaleString()}
                    </div>
                    {myEvent.reason && (
                      <div className="text-sm text-text-main mt-2 whitespace-pre-wrap">
                        {myEvent.reason}
                      </div>
                    )}
                  </div>
                  <Badge
                    tone={
                      myEvent.status === "ACTIVE"
                        ? "red"
                        : myEvent.status === "RESOLVED"
                          ? "green"
                          : "neutral"
                    }
                  >
                    {myEvent.status}
                  </Badge>
                </div>

                <div className="mt-3">
                  <Button
                    variant="secondary"
                    onClick={cancelEvent}
                    disabled={!canCancelNow || busy}
                  >
                    Cancel event{" "}
                    {canCancelNow
                      ? `(left ${cancelLeft}s)`
                      : "(window expired)"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {isSuper && (
        <Card className="mt-4">
          <CardHeader
            title="Active Emergencies"
            subtitle="Resolve from here"
          />
          <CardContent>
            {loadingActive ? (
              <div className="space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : active.length === 0 ? (
              <div className="text-sm text-text-muted">
                No active emergencies.
              </div>
            ) : (
              <div className="space-y-3">
                {active.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-2xl border border-primary/20 glass-panel p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">
                          {e.triggeredBy.fullName}
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          {new Date(e.triggeredAt).toLocaleString()} • ID:{" "}
                          {e.id}
                        </div>
                        {e.reason && (
                          <div className="text-sm text-text-main mt-2">
                            {e.reason}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => resolveEvent(e.id)}
                        disabled={busy}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
