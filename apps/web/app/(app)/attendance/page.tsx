"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm";

type Today = {
  status: "OUT" | "IN";
  punchedInAt: string | null;
  punchedOutAt: string | null;
  totalMinutes: number;
};

type HistoryRow = {
  id: string;
  punchedInAt: string;
  punchedOutAt: string | null;
  minutes: number;
};

type DashboardRecord = {
  id: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  date: string;
  punchInAt: string | null;
  punchOutAt: string | null;
  minutes: number;
};

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const { user } = useAuthStore();
  const role = user?.role;

  const canPunch = role === "ELITE" || role === "USER";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [today, setToday] = useState<Today | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  // Admin dashboard state
  const [dashboardRecords, setDashboardRecords] = useState<DashboardRecord[]>([]);
  const [dashboardFilters, setDashboardFilters] = useState({
    userId: "",
    role: "",
    from: "",
    to: "",
  });

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      if (canPunch) {
        // ELITE/USER: load their own data
        const t = await authedFetch<{ ok: true; today: Today }>(
          "/attendance/me/today"
        );
        const h = await authedFetch<{ ok: true; history: HistoryRow[] }>(
          "/attendance/me/history?days=7"
        );
        setToday(t.today);
        setHistory(h.history ?? []);
      } else {
        // ADMIN/SUPER_ADMIN: load dashboard
        await loadDashboard();
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const params = new URLSearchParams();
      if (dashboardFilters.userId) params.set("userId", dashboardFilters.userId);
      if (dashboardFilters.role) params.set("role", dashboardFilters.role);
      if (dashboardFilters.from) params.set("from", dashboardFilters.from);
      if (dashboardFilters.to) params.set("to", dashboardFilters.to);

      const res = await authedFetch<{ ok: true; records: DashboardRecord[] }>(
        `/attendance/dashboard?${params.toString()}`
      );
      setDashboardRecords(res.records ?? []);
    } catch (e: any) {
      setErr(e.message || "Failed to load dashboard");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const punchIn = async () => {
    setBusy(true);
    setErr(null);
    try {
      await authedFetch("/attendance/punch-in", { method: "POST" });
      toast.success("Punched in");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Punch in failed");
    } finally {
      setBusy(false);
    }
  };

  const punchOut = async () => {
    const ok = await confirm({
      title: "Punch out?",
      message: "Make sure you're done for now.",
      confirmText: "Punch out",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch("/attendance/punch-out", { method: "POST" });
      toast.success("Punched out");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Punch out failed");
    } finally {
      setBusy(false);
    }
  };

  const tone = useMemo(() => {
    if (!today) return "neutral";
    return today.status === "IN" ? "green" : "neutral";
  }, [today]);

  // Admin dashboard view
  if (!canPunch) {
    return (
      <AppShell
        title="Attendance Dashboard"
        subtitle="View all ELITE and USER attendance records"
        right={
          <Button variant="secondary" onClick={loadDashboard} disabled={loading}>
            Refresh
          </Button>
        }
      >
        {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

        <Card className="mb-4">
          <CardHeader title="Filters" subtitle="Search and filter attendance records" />
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Role</label>
                <select
                  value={dashboardFilters.role}
                  onChange={(e) =>
                    setDashboardFilters({ ...dashboardFilters, role: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-primary/20 rounded-lg"
                >
                  <option value="">All Roles</option>
                  <option value="ELITE">ELITE</option>
                  <option value="USER">USER</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">From Date</label>
                <input
                  type="date"
                  value={dashboardFilters.from}
                  onChange={(e) =>
                    setDashboardFilters({ ...dashboardFilters, from: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-primary/20 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">To Date</label>
                <input
                  type="date"
                  value={dashboardFilters.to}
                  onChange={(e) =>
                    setDashboardFilters({ ...dashboardFilters, to: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-primary/20 rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={loadDashboard} disabled={loading} className="w-full">
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Attendance Records"
            subtitle={`${dashboardRecords.length} records found`}
          />
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : dashboardRecords.length === 0 ? (
              <div className="text-sm text-text-muted py-8 text-center">
                No attendance records found.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-text-muted">
                    <tr className="border-b border-primary/20 glass-panel">
                      <th className="text-left py-2 pr-3">User</th>
                      <th className="text-left py-2 pr-3">Role</th>
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Punch In</th>
                      <th className="text-left py-2 pr-3">Punch Out</th>
                      <th className="text-left py-2 pr-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardRecords.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100">
                        <td className="py-3 pr-3">
                          <div className="font-medium">{r.user.fullName}</div>
                          <div className="text-xs text-text-muted">{r.user.email}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge tone="neutral">{r.user.role}</Badge>
                        </td>
                        <td className="py-3 pr-3">
                          {new Date(r.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-3">
                          {r.punchInAt
                            ? new Date(r.punchInAt).toLocaleTimeString()
                            : "—"}
                        </td>
                        <td className="py-3 pr-3">
                          {r.punchOutAt
                            ? new Date(r.punchOutAt).toLocaleTimeString()
                            : "—"}
                        </td>
                        <td className="py-3 pr-3 font-semibold">
                          {fmtMinutes(r.minutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  // ELITE/USER punch view
  return (
    <AppShell
      title="Attendance"
      subtitle="Punch in/out with a clean, reliable attendance log."
      right={
        <Button variant="secondary" onClick={load} disabled={busy || loading}>
          Refresh
        </Button>
      }
    >
      {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Today" subtitle="Live status and total time" />
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-16" />
              </div>
            ) : !today ? (
              <div className="text-sm text-text-muted">No data.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-text-muted">Status</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={tone as any}>
                        {today.status === "IN" ? "PUNCHED IN" : "PUNCHED OUT"}
                      </Badge>
                      <span className="text-sm text-text-muted">
                        Total:{" "}
                        <b className="text-primary">
                          {fmtMinutes(today.totalMinutes)}
                        </b>
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={punchIn}
                      disabled={busy || today.status === "IN"}
                    >
                      Punch In
                    </Button>
                    <Button
                      onClick={punchOut}
                      disabled={busy || today.status === "OUT"}
                    >
                      Punch Out
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-primary/20 glass-panel p-4">
                    <div className="text-xs text-text-muted">Punched In At</div>
                    <div className="text-sm font-semibold mt-1">
                      {today.punchedInAt
                        ? new Date(today.punchedInAt).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/20 glass-panel p-4">
                    <div className="text-xs text-text-muted">Punched Out At</div>
                    <div className="text-sm font-semibold mt-1">
                      {today.punchedOutAt
                        ? new Date(today.punchedOutAt).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/20 glass-panel p-4">
                    <div className="text-xs text-text-muted">Guideline</div>
                    <div className="text-sm text-text-main mt-1">
                      Punch in at start, punch out after work.
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" subtitle="Common tasks" />
          <CardContent className="space-y-2">
            <Link
              href="/tasks"
              className="block text-sm text-text-main hover:text-primary hover:underline transition-colors"
            >
              My Tasks
            </Link>
            <Link
              href="/projects"
              className="block text-sm text-text-main hover:text-primary hover:underline transition-colors"
            >
              My Projects
            </Link>
            <Link
              href="/chat"
              className="block text-sm text-text-main hover:text-primary hover:underline transition-colors"
            >
              Chat
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Last 7 days"
          subtitle="Audit-friendly history table"
        />
        <CardContent>
          {loading ? (
            <Skeleton className="h-28" />
          ) : history.length === 0 ? (
            <div className="text-sm text-text-muted">No history.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-text-muted">
                  <tr className="border-b border-primary/20 glass-panel">
                    <th className="text-left py-2 pr-3">In</th>
                    <th className="text-left py-2 pr-3">Out</th>
                    <th className="text-left py-2 pr-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100">
                      <td className="py-3 pr-3">
                        {new Date(r.punchedInAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-3">
                        {r.punchedOutAt
                          ? new Date(r.punchedOutAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-3 pr-3 font-semibold">
                        {fmtMinutes(r.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
