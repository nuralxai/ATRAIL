"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { Plus, CheckCircle2, Circle, Calendar, Briefcase, Trash2, Target } from "lucide-react";

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  project: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string };
};

type Project = { id: string; name: string };

export default function RoadmapPage() {
  const user = useAuthStore(s => s.user);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", projectId: "" });

  const load = async () => {
    const [msRes, pjRes] = await Promise.all([
      authedFetch<{ ok: boolean; milestones: Milestone[] }>("/milestones"),
      authedFetch<{ ok: boolean; projects: Project[] }>("/projects"),
    ]);
    if (msRes.ok) setMilestones(msRes.milestones);
    if (pjRes.ok) setProjects(pjRes.projects ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title.trim() || !form.dueDate) { toast.error("Title and due date are required"); return; }
    await authedFetch("/milestones", {
      method: "POST",
      body: JSON.stringify({ ...form, projectId: form.projectId || undefined }),
    });
    setForm({ title: "", description: "", dueDate: "", projectId: "" });
    setShowForm(false);
    load();
    toast.success("Milestone added");
  }

  async function toggle(m: Milestone) {
    await authedFetch(`/milestones/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: !m.completed }),
    });
    setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, completed: !x.completed, completedAt: !x.completed ? new Date().toISOString() : null } : x));
  }

  async function remove(id: string) {
    await authedFetch(`/milestones/${id}`, { method: "DELETE" });
    setMilestones(prev => prev.filter(m => m.id !== id));
    toast.success("Milestone removed");
  }

  const now = new Date();
  const upcoming  = milestones.filter(m => !m.completed && new Date(m.dueDate) >= now).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const overdue   = milestones.filter(m => !m.completed && new Date(m.dueDate) <  now).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const completed = milestones.filter(m => m.completed).sort((a,b) => new Date(b.completedAt ?? b.dueDate).getTime() - new Date(a.completedAt ?? a.dueDate).getTime());

  function daysUntil(date: string) {
    const d = Math.ceil((new Date(date).getTime() - now.getTime()) / 86400000);
    if (d < 0) return `${Math.abs(d)}d overdue`;
    if (d === 0) return "Today";
    return `${d}d left`;
  }

  function MilestoneCard({ m }: { m: Milestone }) {
    const isOverdue = !m.completed && new Date(m.dueDate) < now;
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl transition-all group"
        style={{ background: "rgba(6,22,40,0.6)", border: `1px solid ${isOverdue ? "rgba(239,68,68,0.2)" : "rgba(0,212,255,0.08)"}` }}>
        <button onClick={() => toggle(m)} className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110">
          {m.completed
            ? <CheckCircle2 size={20} className="text-green-400" />
            : <Circle       size={20} className={isOverdue ? "text-red-400" : "text-text-muted hover:text-primary"} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${m.completed ? "line-through text-text-muted" : "text-white"}`}>{m.title}</div>
          {m.description && <div className="text-xs text-text-muted mt-0.5">{m.description}</div>}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-[11px]" style={{ color: isOverdue ? "#EF4444" : m.completed ? "#22C55E" : "#64748b" }}>
              <Calendar size={11} />
              {new Date(m.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {!m.completed && ` · ${daysUntil(m.dueDate)}`}
            </div>
            {m.project && (
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                <Briefcase size={11} />
                {m.project.name}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <AppShell
      title="Roadmap & Milestones"
      subtitle="Track key deliverables and project milestones"
      right={
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-[#020b18] hover:bg-yellow-400 transition-all">
          <Plus size={15} /> Add Milestone
        </button>
      }
    >
      {/* Create form */}
      {showForm && (
        <div className="mt-4 mb-6 p-5 rounded-2xl space-y-3" style={{ background: "rgba(6,22,40,0.7)", border: "1px solid rgba(0,212,255,0.15)" }}>
          <h3 className="text-sm font-bold text-white">New Milestone</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Milestone title *" className="bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white placeholder-text-muted outline-none focus:border-primary/50 col-span-2" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)" className="bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white placeholder-text-muted outline-none focus:border-primary/50 col-span-2" />
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50" />
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
              className="bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50">
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-[#020b18] hover:bg-yellow-400 transition-all">Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm text-text-muted hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-text-muted text-sm text-center">Loading milestones...</div>
      ) : milestones.length === 0 ? (
        <div className="mt-16 text-center">
          <Target size={40} className="text-text-muted mx-auto mb-3" />
          <div className="text-text-muted">No milestones yet. Add your first one to start tracking progress.</div>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Timeline bar */}
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-text-muted">{overdue.length} Overdue</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-primary" /><span className="text-text-muted">{upcoming.length} Upcoming</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-400" /><span className="text-text-muted">{completed.length} Completed</span></div>
          </div>

          {overdue.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Overdue
              </h3>
              <div className="space-y-2">{overdue.map(m => <MilestoneCard key={m.id} m={m} />)}</div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Upcoming
              </h3>
              <div className="space-y-2">{upcoming.map(m => <MilestoneCard key={m.id} m={m} />)}</div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3 flex items-center gap-2">
                <CheckCircle2 size={12} /> Completed
              </h3>
              <div className="space-y-2">{completed.map(m => <MilestoneCard key={m.id} m={m} />)}</div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
