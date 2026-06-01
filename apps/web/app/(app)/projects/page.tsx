"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";

type Project = {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  organization?: { id: string; name: string };
  headId: string | null;
  head: { id: string; fullName: string; role: string } | null;
  updatedAt: string;
  progress?: number;
};

type UserLite = { id: string; fullName: string; email: string; role: string };

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isAdminPlus = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [headId, setHeadId] = useState("");
  const [targetOrgId, setTargetOrgId] = useState("");
  const [elites, setElites] = useState<UserLite[]>([]);
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([]);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const p = await authedFetch<{ ok: true; projects: Project[] }>(
        "/projects"
      );
      setProjects(p.projects ?? []);

      if (isAdminPlus) {
        const u = await authedFetch<{ ok: true; users: UserLite[] }>("/users");
        setElites((u.users ?? []).filter((x) => x.role === "ELITE"));

        if (user?.role === "SUPER_ADMIN") {
          const orgsRes = await authedFetch<{ ok: true; organizations: {id: string, name: string}[] }>("/organizations");
          setOrganizations(orgsRes.organizations ?? []);
        }
      }
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...projects]
      .filter((p) => (!term ? true : p.name.toLowerCase().includes(term)))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [projects, q]);

  const createProject = async () => {
    if (!isAdminPlus) return;
    if (name.trim().length < 2) return setErr("Project name too short");

    setBusy(true);
    setErr(null);
    try {
      await authedFetch("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() ? desc.trim() : undefined,
          headId: headId || undefined,
          ...(user?.role === "SUPER_ADMIN" && targetOrgId ? { organizationId: targetOrgId } : {})
        }),
      });
      setCreateOpen(false);
      setName("");
      setDesc("");
      setHeadId("");
      toast.success("Project created");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Projects"
      subtitle="Create projects, assign heads, manage members and tasks."
      right={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load} disabled={busy || loading}>
            Refresh
          </Button>
          {isAdminPlus && (
            <Button onClick={() => setCreateOpen(true)}>New Project</Button>
          )}
        </div>
      }
    >
      {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

      <Card className="mb-4">
        <CardHeader
          title="Browse"
          subtitle="Search projects quickly"
          right={<Badge tone="neutral">{list.length}</Badge>}
        />
        <CardContent>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-sm text-text-muted">No projects yet.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="rounded-2xl border border-primary/20 glass-panel glass-panel shadow-sm hover:shadow-md transition p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-primary flex gap-2 items-center">
                    {p.name}
                    {user?.role === "SUPER_ADMIN" && p.organization && (
                      <Badge tone="blue">{p.organization.name}</Badge>
                    )}
                  </div>
                  {p.description && (
                    <div className="text-sm text-text-main mt-2 line-clamp-2">
                      {p.description}
                    </div>
                  )}
                  <div className="text-xs text-text-muted mt-3">
                    Head:{" "}
                    {p.head ? (
                      <span className="font-semibold text-text-main">
                        {p.head.fullName}
                      </span>
                    ) : (
                      <span className="text-text-muted">Not assigned</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-text-muted">
                  {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="mt-3">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-text-muted font-medium">Progress</span>
                  <span className="text-text-main font-bold">{p.progress ?? 0}%</span>
                </div>
                <div className="w-full bg-zinc-800/80 rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${p.progress ?? 0}%` }}></div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-text-muted">Open project →</div>
                <Badge tone="neutral">Active</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Create Project"
        subtitle="Projects are the base unit for tasks and group chat."
        onClose={() => (!busy ? setCreateOpen(false) : null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={createProject} disabled={busy}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
          />
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            placeholder="Description (optional)"
          />
          <select
            value={headId}
            onChange={(e) => setHeadId(e.target.value)}
            className="w-full rounded-xl border border-primary/20 glass-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          >
            <option value="">Head (optional) — Elite</option>
            {elites.filter(e => !targetOrgId || (e as any).organizationId === targetOrgId || user?.role !== "SUPER_ADMIN").map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} • {e.email}
              </option>
            ))}
          </select>

          {user?.role === "SUPER_ADMIN" && (
            <select
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.target.value)}
              className="w-full rounded-xl border border-primary/20 glass-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="">Select Tenant (Current Admin's Tenant)</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
