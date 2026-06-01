"use client";

import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { Activity, Users, CheckCircle, AlertTriangle, Briefcase } from "lucide-react";

interface Notice {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
}

type OverviewStats = {
  totalProjects: number;
  totalTasks: number;
  totalUsers: number;
  activeEmergencies: number;
  pendingLeaves: number;
  tasksByStatus: { status: string; _count: { id: number } }[];
};

export default function AdminDashboard() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [noticesRes, statsRes] = await Promise.all([
          authedFetch<{ ok: true; notices: Notice[] }>("/notices"),
          authedFetch<{ ok: true; overview: OverviewStats }>("/analytics/overview")
        ]);
        setNotices((noticesRes.notices ?? []).slice(0, 3));
        setStats(statsRes.overview);
      } catch (e) {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const completedTasks = stats?.tasksByStatus.find(s => s.status === 'COMPLETED' || s.status === 'APPROVED')?._count.id || 0;
  const inProgressTasks = stats?.tasksByStatus.find(s => s.status === 'IN_PROGRESS')?._count.id || 0;

  return (
    <AppShell
      title="Admin Dashboard"
      subtitle="Manage projects, tasks, notices and emergencies."
    >
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Briefcase size={20} />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium tracking-wide">TOTAL PROJECTS</p>
              {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-2xl font-bold text-white">{stats?.totalProjects ?? 0}</p>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium tracking-wide">ACTIVE TASKS</p>
              {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-2xl font-bold text-white">{inProgressTasks}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium tracking-wide">TOTAL WORKFORCE</p>
              {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-2xl font-bold text-white">{stats?.totalUsers ?? 0}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className={stats?.activeEmergencies ? "border-red-500/50 bg-red-500/5" : ""}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`h-10 w-10 flex items-center justify-center rounded-lg ${stats?.activeEmergencies ? "bg-red-500/20 text-red-500" : "bg-zinc-800 text-text-muted"}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium tracking-wide">EMERGENCIES</p>
              {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className={`text-2xl font-bold ${stats?.activeEmergencies ? "text-red-500" : "text-white"}`}>{stats?.activeEmergencies ?? 0}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-primary/20 bg-primary/5 flex flex-col justify-between">
          <CardHeader title="Pending Action Items" subtitle="Requires your input" />
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/projects"
                className="p-4 rounded-xl border border-primary/20 glass-panel hover:bg-zinc-800 transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-bold uppercase tracking-wider text-primary group-hover:text-primary-light">Projects</span>
                  <p className="text-xs text-text-muted mt-1">Manage Workstreams</p>
                </div>
              </Link>
              
              <Link
                href="/hr/leave"
                className="p-4 rounded-xl border border-primary/20 glass-panel hover:bg-zinc-800 transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-bold uppercase tracking-wider text-primary group-hover:text-primary-light">Leave Requests</span>
                  <p className="text-xs text-text-muted mt-1">Awaiting Review</p>
                </div>
                {stats?.pendingLeaves ? (
                  <span className="h-8 w-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">{stats.pendingLeaves}</span>
                ) : (
                  <span className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-text-muted">0</span>
                )}
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Notices" subtitle="Broadcast updates" />
          {loading ? (
            <CardContent className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </CardContent>
          ) : notices.length === 0 ? (
            <CardContent className="text-sm text-text-muted text-center py-6">
              No recent announcements.
            </CardContent>
          ) : (
            <CardContent className="space-y-2">
              {notices.map((n) => (
                <Link
                  key={n.id}
                  href="/notices"
                  className="block p-3 rounded-xl border border-primary/20 hover:bg-zinc-800/50 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-primary group-hover:text-primary-light truncate flex items-center gap-2">
                        {n.title}
                        {n.pinned && <Badge tone="blue">Pinned</Badge>}
                      </div>
                      <div className="text-xs text-text-muted truncate mt-1">
                        {n.content}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              <Link
                href="/notices"
                className="block text-xs font-medium text-primary hover:text-primary-light transition mt-2 pt-2 border-t border-primary/20 text-center"
              >
                View all communications →
              </Link>
            </CardContent>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
