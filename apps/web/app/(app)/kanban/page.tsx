"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2, GripVertical, Calendar, Flag } from "lucide-react";

type TaskStatus = "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
type TaskPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";

type KanbanTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  project: { id: string; name: string };
  assignedTo: { id: string; fullName: string };
};

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string }[] = [
  { status: "ASSIGNED",    label: "To Do",       color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  { status: "IN_PROGRESS", label: "In Progress",  color: "#F59E0B", bg: "rgba(245,158,11,0.08)"  },
  { status: "SUBMITTED",   label: "In Review",    color: "#3B82F6", bg: "rgba(59,130,246,0.08)"  },
  { status: "ACCEPTED",    label: "Done",         color: "#22C55E", bg: "rgba(34,197,94,0.08)"   },
  { status: "REJECTED",    label: "Rejected",     color: "#EF4444", bg: "rgba(239,68,68,0.08)"   },
];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  URGENT: "#EF4444",
  HIGH:   "#F59E0B",
  NORMAL: "#64748b",
  LOW:    "#22C55E",
};

function priorityLabel(p: TaskPriority) {
  return { URGENT: "🔴 Urgent", HIGH: "🟠 High", NORMAL: "⚪ Normal", LOW: "🟢 Low" }[p];
}

export default function KanbanPage() {
  const user = useAuthStore(s => s.user);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver]       = useState<TaskStatus | null>(null);

  useEffect(() => {
    authedFetch<{ tasks: KanbanTask[] }>("/tasks/my").then(res => {
      if (res.tasks) setTasks(res.tasks);
      setLoading(false);
    });
  }, []);

  const tasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);

  async function moveTask(taskId: string, newStatus: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await authedFetch(`/tasks/${taskId}/my-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // revert on failure
      authedFetch<{ tasks: KanbanTask[] }>("/tasks/my").then(res => { if (res.tasks) setTasks(res.tasks); });
    }
  }

  function onDragStart(e: React.DragEvent, taskId: string) {
    setDragging(taskId);
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(status);
  }

  function onDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) moveTask(taskId, status);
    setDragging(null);
    setOver(null);
  }

  function onDragEnd() {
    setDragging(null);
    setOver(null);
  }

  function isOverdue(task: KanbanTask) {
    return task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "ACCEPTED";
  }

  return (
    <AppShell title="Kanban Board" subtitle="Drag tasks between columns to update status">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 mt-6 min-h-[70vh]" style={{ scrollbarWidth: "thin" }}>
          {COLUMNS.map(col => {
            const colTasks = tasksByStatus(col.status);
            const isDropTarget = over === col.status;

            return (
              <div
                key={col.status}
                className="flex-shrink-0 w-72 flex flex-col rounded-2xl transition-all duration-200"
                style={{
                  background: isDropTarget ? col.bg : "rgba(6,22,40,0.5)",
                  border: `1px solid ${isDropTarget ? col.color + "55" : "rgba(0,212,255,0.06)"}`,
                  boxShadow: isDropTarget ? `0 0 24px ${col.color}22` : "none",
                }}
                onDragOver={e => onDragOver(e, col.status)}
                onDrop={e => onDrop(e, col.status)}
                onDragLeave={() => setOver(null)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(0,212,255,0.06)" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color, boxShadow: `0 0 8px ${col.color}` }} />
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: col.color + "22", color: col.color }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3 p-3 flex-1 min-h-[120px]">
                  {colTasks.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-xs text-text-muted border border-dashed rounded-xl" style={{ borderColor: col.color + "33", minHeight: 80 }}>
                      Drop here
                    </div>
                  )}
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => onDragStart(e, task.id)}
                      onDragEnd={onDragEnd}
                      className="rounded-xl p-3 cursor-grab active:cursor-grabbing select-none group transition-all duration-150"
                      style={{
                        background: dragging === task.id ? "rgba(0,212,255,0.05)" : "rgba(10,25,47,0.8)",
                        border: "1px solid rgba(0,212,255,0.08)",
                        opacity: dragging === task.id ? 0.4 : 1,
                        boxShadow: dragging === task.id ? "none" : "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      {/* Overdue badge */}
                      {isOverdue(task) && (
                        <div className="text-[10px] font-bold text-red-400 mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          OVERDUE
                        </div>
                      )}

                      {/* Title */}
                      <div className="flex items-start gap-2">
                        <GripVertical size={14} className="text-[#334155] flex-shrink-0 mt-0.5 group-hover:text-[#64748b] transition-colors" />
                        <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
                      </div>

                      {/* Project */}
                      <div className="mt-2 text-[11px] text-text-muted truncate pl-5">
                        📁 {task.project.name}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pl-5">
                        <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: PRIORITY_COLOR[task.priority] }}>
                          <Flag size={10} />
                          {priorityLabel(task.priority)}
                        </div>
                        {task.dueAt && (
                          <div className="flex items-center gap-1 text-[10px] text-text-muted">
                            <Calendar size={10} />
                            {new Date(task.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </div>

                      {/* Assignee */}
                      <div className="mt-2 pl-5">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)" }}>
                          <div className="w-3.5 h-3.5 rounded-full bg-primary/30 flex items-center justify-center text-[8px] text-primary font-bold">
                            {task.assignedTo.fullName.charAt(0)}
                          </div>
                          <span className="text-text-muted">{task.assignedTo.fullName.split(" ")[0]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
