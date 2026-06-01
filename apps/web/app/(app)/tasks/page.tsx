"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { authedFetch } from "@/lib/authed-fetch";
import { API_BASE, API_HOST } from "@/lib/config";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm";
import { List, LayoutDashboard, Flag } from "lucide-react";

type TaskStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "ACCEPTED"
  | "REJECTED";

type TaskPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";

type TaskLite = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  createdAt: string;
  project: { id: string; name: string };
  submissions: Array<{
    id: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    createdAt: string;
  }>;
};

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  project: { id: string; name: string };
  assignedTo: { id: string; fullName: string; role: string };
  assignedBy: { id: string; fullName: string; role: string };
  submissions: Array<{
    id: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    createdAt: string;
    notes: string | null;
    reviewedAt: string | null;
    reviewComment: string | null;
    proofs: Array<{
      id: string;
      fileUrl: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  }>;
};

function statusTone(s: TaskStatus) {
  if (s === "ACCEPTED") return "green";
  if (s === "SUBMITTED") return "blue";
  if (s === "IN_PROGRESS") return "amber";
  if (s === "REJECTED") return "red";
  return "neutral";
}

function priorityColor(p: TaskPriority) {
  if (p === "URGENT") return "text-red-500 bg-red-500/10 border-red-500/20";
  if (p === "HIGH") return "text-orange-500 bg-orange-500/10 border-orange-500/20";
  if (p === "LOW") return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  return "text-text-muted bg-zinc-800 border-primary/20";
}

const COLUMNS: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "ASSIGNED", label: "To Do", tone: "neutral" },
  { id: "REJECTED", label: "Needs Rework", tone: "red" },
  { id: "IN_PROGRESS", label: "In Progress", tone: "amber" },
  { id: "SUBMITTED", label: "In Review", tone: "blue" },
  { id: "ACCEPTED", label: "Done", tone: "green" },
];

export default function TasksPage() {
  const { accessToken } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<TaskStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "ALL">("ALL");
  const [viewMode, setViewMode] = useState<"LIST" | "KANBAN">("LIST");

  const [submitOpen, setSubmitOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await authedFetch<{ ok: true; tasks: TaskLite[] }>(
        "/tasks/my"
      );
      const items = res.tasks ?? [];
      setTasks(items);
      if (!selectedId && items.length) setSelectedId(items[0].id);
    } catch (e: any) {
      setErr(e.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setErr(null);
    setDetail(null);
    try {
      const res = await authedFetch<{ ok: true; task: TaskDetail }>(
        `/tasks/${id}`
      );
      setDetail(res.task);
    } catch (e: any) {
      setErr(e.message || "Failed to load task");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks
      .filter((t) => (filter === "ALL" ? true : t.status === filter))
      .filter((t) => (priorityFilter === "ALL" ? true : t.priority === priorityFilter))
      .filter((t) => {
        if (!term) return true;
        return (
          t.title.toLowerCase().includes(term) ||
          t.project?.name?.toLowerCase().includes(term)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [tasks, q, filter, priorityFilter]);

  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId]
  );

  const startTask = async (taskIdToStart?: string) => {
    const id = taskIdToStart || selected?.id;
    if (!id) return;

    if (!taskIdToStart) { // Only confirm if it's from button click, not drag and drop
      const ok = await confirm({
        title: "Start task?",
        message: "This will mark the task as in progress.",
        confirmText: "Start",
      });
      if (!ok) return;
    }

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/tasks/${id}/my-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      toast.success("Task started");
      await load();
      if (selectedId === id) await loadDetail(id);
    } catch (e: any) {
      toast.error(e.message || "Failed to start");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!selected || !accessToken) return;

    const ok = await confirm({
      title: "Submit proof?",
      message: "Once submitted, it will go for review.",
      confirmText: "Submit",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);

    try {
      const fd = new FormData();
      if (notes.trim()) fd.append("notes", notes.trim());
      if (files) Array.from(files).forEach((f) => fd.append("files", f));

      const resp = await fetch(`${API_BASE}/tasks/${selected.id}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });

      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.message || "Submit failed");

      setSubmitOpen(false);
      setNotes("");
      setFiles(null);

      toast.success("Submitted for review");
      await load();
      await loadDetail(selected.id);
    } catch (e: any) {
      toast.error(e.message || "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("taskId", id);
    setDraggedTaskId(id);
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    e.currentTarget.classList.remove("opacity-50");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, colStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find((t) => t.id === taskId);
    
    if (!task) return;
    if (task.status === colStatus) return; // No change

    // Role constraints: assignees can only change ASSIGNED, IN_PROGRESS, REJECTED 
    // to IN_PROGRESS or SUBMITTED
    
    if (colStatus === "IN_PROGRESS") {
      if (task.status === "ASSIGNED" || task.status === "REJECTED") {
        await startTask(taskId);
      } else {
        toast.error("You can only start tasks that are assigned or rejected.");
      }
    } else if (colStatus === "SUBMITTED") {
      if (task.status === "IN_PROGRESS" || task.status === "REJECTED") {
        setSelectedId(taskId);
        setSubmitOpen(true);
      } else {
        toast.error("You can only submit tasks that are in progress or rejected.");
      }
    } else if (colStatus === "ACCEPTED" || colStatus === "REJECTED") {
      toast.error("Only managers can accept or reject tasks.");
    } else if (colStatus === "ASSIGNED") {
      toast.error("Tasks cannot be moved back to Assign state.");
    }
  };

  const canStart = selected?.status === "ASSIGNED";
  const canSubmit =
    selected?.status === "IN_PROGRESS" || selected?.status === "REJECTED";

  return (
    <AppShell
      title="Tasks"
      subtitle="Start work, submit proof, and track approvals like a real workflow."
      right={
        <div className="flex items-center gap-2">
          <div className="flex items-center glass-panel rounded-lg p-1 border border-primary/20">
            <button
              onClick={() => setViewMode("LIST")}
              className={`p-1.5 rounded-md transition ${viewMode === "LIST" ? "bg-zinc-800 text-primary" : "text-text-muted hover:text-white"}`}
              title="List View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode("KANBAN")}
              className={`p-1.5 rounded-md transition ${viewMode === "KANBAN" ? "bg-zinc-800 text-primary" : "text-text-muted hover:text-white"}`}
              title="Kanban Board"
            >
              <LayoutDashboard size={18} />
            </button>
          </div>
          <Button variant="secondary" onClick={load} disabled={busy || loading}>
            Refresh
          </Button>
        </div>
      }
    >
      {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

      {viewMode === "LIST" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: task list */}
          <Card className="lg:col-span-1">
            <CardHeader
              title="My Tasks"
              subtitle="Filter & search"
              right={<Badge tone="neutral">{filtered.length}</Badge>}
            />
            <CardContent className="space-y-3">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title or project…"
              />

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "ALL",
                      "ASSIGNED",
                      "IN_PROGRESS",
                      "SUBMITTED",
                      "ACCEPTED",
                      "REJECTED",
                    ] as const
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={
                        "rounded-xl px-3 py-2 text-xs font-semibold border transition " +
                        (filter === s
                          ? "glass-panel text-white border-zinc-900"
                          : "glass-panel text-text-main border-primary/20 hover:glass-panel")
                      }
                    >
                      {s === "ALL" ? "All" : s.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs text-text-muted py-2">Priority:</span>
                  {(["ALL", "URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={
                        "rounded-xl px-3 py-1 text-xs font-semibold border transition " +
                        (priorityFilter === p
                          ? "glass-panel text-white border-zinc-900"
                          : "glass-panel text-text-muted border-primary/20 hover:glass-panel")
                      }
                    >
                      {p === "ALL" ? "Any" : p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 space-y-2 max-h-[60vh] overflow-y-auto">
                {loading ? (
                  <>
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </>
                ) : filtered.length === 0 ? (
                  <div className="text-sm text-text-muted">
                    No tasks match your filter.
                  </div>
                ) : (
                  filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedId(t.id);
                        setTimeout(
                          () =>
                            detailRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            }),
                          80
                        );
                      }}
                      className={
                        "w-full text-left rounded-2xl border p-3 transition flex flex-col gap-2 " +
                        (selectedId === t.id
                          ? "border-zinc-900 glass-panel"
                          : "border-primary/20 glass-panel hover:glass-panel")
                      }
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-primary line-clamp-1">
                            {t.title}
                          </div>
                          <div className="text-xs text-text-muted mt-1 line-clamp-1">
                            {t.project?.name}
                          </div>
                        </div>
                        <Badge tone={statusTone(t.status) as any}>
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between w-full mt-1">
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityColor(t.priority)}`}>
                          {t.priority}
                        </div>
                        <div className="text-xs text-text-muted">
                          {t.dueAt
                            ? `Due ${new Date(t.dueAt).toLocaleDateString()}`
                            : "No due date"}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div ref={detailRef as any} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader
                title={
                  detail
                    ? detail.title
                    : selected
                      ? selected.title
                      : "Task Detail"
                }
                subtitle={
                  detail
                    ? detail.project.name
                    : "Select a task to view full details"
                }
                right={
                  detail ? (
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 flex items-center rounded text-[10px] font-bold border ${priorityColor(detail.priority)}`}>
                        <Flag className="w-3 h-3 mr-1" />
                        {detail.priority}
                      </div>
                      <Badge tone={statusTone(detail.status) as any}>
                        {detail.status.replace("_", " ")}
                      </Badge>
                      <Button
                        variant="secondary"
                        disabled={!canStart || busy}
                        onClick={() => startTask()}
                      >
                        Start
                      </Button>
                      <Button
                        disabled={!canSubmit || busy}
                        onClick={() => setSubmitOpen(true)}
                      >
                        Submit Proof
                      </Button>
                    </div>
                  ) : null
                }
              />
              <CardContent>
                {!selected ? (
                  <div className="text-sm text-text-muted">
                    Choose a task from the left panel.
                  </div>
                ) : !detail ? (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-40" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-primary/20 glass-panel p-4">
                        <div className="text-xs text-text-muted">Assigned By</div>
                        <div className="text-sm font-semibold mt-1">
                          {detail.assignedBy.fullName}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-primary/20 glass-panel p-4">
                        <div className="text-xs text-text-muted">Assigned To</div>
                        <div className="text-sm font-semibold mt-1">
                          {detail.assignedTo.fullName}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-primary/20 glass-panel p-4">
                        <div className="text-xs text-text-muted">Due</div>
                        <div className="text-sm font-semibold mt-1">
                          {detail.dueAt
                            ? new Date(detail.dueAt).toLocaleString()
                            : "No due date"}
                        </div>
                      </div>
                    </div>

                    {detail.description && (
                      <div className="mt-4 rounded-2xl border border-primary/20 glass-panel p-4">
                        <div className="text-sm font-semibold">Description</div>
                        <div className="text-sm text-text-main mt-2 whitespace-pre-wrap">
                          {detail.description}
                        </div>
                      </div>
                    )}

                    <div className="mt-5">
                      <div className="text-sm font-semibold">Submissions</div>
                      {detail.submissions.length === 0 ? (
                        <div className="mt-2 text-sm text-text-muted">
                          No submissions yet.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {detail.submissions.map((s) => (
                            <div
                              key={s.id}
                              className="rounded-2xl border border-primary/20 glass-panel p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold">
                                    {new Date(s.createdAt).toLocaleString()}
                                  </div>
                                  {s.notes && (
                                    <div className="text-sm text-text-main mt-2 whitespace-pre-wrap">
                                      {s.notes}
                                    </div>
                                  )}
                                </div>
                                <Badge
                                  tone={
                                    s.status === "ACCEPTED"
                                      ? "green"
                                      : s.status === "REJECTED"
                                        ? "red"
                                        : "blue"
                                  }
                                >
                                  {s.status}
                                </Badge>
                              </div>

                              {s.reviewComment && (
                                <div className="mt-2 text-sm text-text-main">
                                  <span className="font-semibold">Review:</span>{" "}
                                  {s.reviewComment}
                                </div>
                              )}

                              {s.proofs.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-xs text-text-muted mb-2">
                                    Proof files
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {s.proofs.map((p) => (
                                      <a
                                        key={p.id}
                                        href={`${API_HOST}${p.fileUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm underline text-text-main"
                                      >
                                        {p.fileName}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="flex overflow-x-auto pb-4 gap-4 hide-scrollbar snap-x">
          {COLUMNS.map((col) => {
            const colTasks = tasks
              .filter((t) => (priorityFilter === "ALL" ? true : t.priority === priorityFilter))
              .filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="flex-none w-80 snap-center rounded-2xl border border-primary/20 glass-panel flex flex-col h-[75vh]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="p-4 border-b border-primary/20 flex items-center justify-between sticky top-0 glass-panel backdrop-blur-md rounded-t-2xl z-10">
                  <div className="font-bold flex items-center gap-2">
                    <Badge tone={col.tone as any}>{col.label}</Badge>
                  </div>
                  <div className="text-xs font-mono text-text-muted glass-panel px-2 py-0.5 rounded-full">
                    {colTasks.length}
                  </div>
                </div>

                <div className="p-3 flex-1 overflow-y-auto space-y-3 bg-black/20">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        setSelectedId(t.id);
                        setViewMode("LIST"); // Open detail view
                      }}
                      className={`
                        cursor-grab active:cursor-grabbing p-4 rounded-xl border glass-panel shadow-sm transition-all hover:border-primary/40 border-primary/20
                        ${draggedTaskId === t.id ? 'opacity-50 border-primary ring-1 ring-primary' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge tone="neutral" className="!glass-panel border-primary/20 text-[10px] uppercase tracking-wider">
                          {t.project.name.substring(0, 15)}{t.project.name.length > 15 && "..."}
                        </Badge>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityColor(t.priority)}`}>
                          {t.priority}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-white mb-3">
                        {t.title}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-text-muted border-t border-primary/20/50 pt-3 mt-auto">
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          {t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "No deadline"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="h-24 m-2 rounded-xl border border-dashed border-primary/20 flex items-center justify-center text-xs text-text-muted glass-panel/10">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={submitOpen}
        title="Submit Proof"
        subtitle="Upload screenshots/PDF and add notes. This becomes a submission."
        onClose={() => (!busy ? setSubmitOpen(false) : null)}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-text-muted">
              Allowed: images/PDF • Max 6 files
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setSubmitOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy}>
                Submit
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Notes (optional)…"
            disabled={!canSubmit || busy}
          />
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            disabled={!canSubmit || busy}
            className="text-sm"
          />
          {!canSubmit && (
            <div className="text-sm text-text-muted">
              You can submit only when task is <b>IN_PROGRESS</b> or{" "}
              <b>REJECTED</b>.
            </div>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
