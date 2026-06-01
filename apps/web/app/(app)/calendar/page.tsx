"use client";

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import AppShell from "@/components/AppShell";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday,
  isBefore, startOfDay, parseISO,
} from "date-fns";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import {
  ChevronLeft, ChevronRight, Plus, X, Save, RefreshCw,
  CheckSquare, Bell, Flag, Briefcase, StickyNote,
  AlertTriangle, CalendarDays, Clock, Circle,
  CalendarCheck, Pen,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────── */
type EventType = "task" | "calendar" | "notice" | "google" | "microsoft";

type DayEvent = {
  id:    string;
  title: string;
  date:  Date;
  allDay?: boolean;
  type:  EventType;
  priority?: string;
  status?:   string;
  projectName?: string;
  projectId?:   string;
  taskId?:      string;
  description?: string;
  color?: string;
};

type DayNote = {
  id:      string;
  content: string;
  savedAt: Date;
};

/* ─── Palette ───────────────────────────────────────────────── */
const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#ef4444",
  HIGH:   "#f97316",
  NORMAL: "#00d4ff",
  LOW:    "#64748b",
};

const TYPE_COLOR: Record<EventType, { dot: string; bg: string; text: string }> = {
  task:      { dot: "#00d4ff", bg: "rgba(0,212,255,0.12)",   text: "#00d4ff" },
  calendar:  { dot: "#a78bfa", bg: "rgba(124,58,237,0.14)",  text: "#a78bfa" },
  notice:    { dot: "#fbbf24", bg: "rgba(245,158,11,0.14)",  text: "#fbbf24" },
  google:    { dot: "#f87171", bg: "rgba(234,67,53,0.14)",   text: "#f87171" },
  microsoft: { dot: "#38bdf8", bg: "rgba(0,164,239,0.14)",   text: "#38bdf8" },
};

const TYPE_LABEL: Record<EventType, string> = {
  task:      "Task Deadline",
  calendar:  "Event",
  notice:    "Notice",
  google:    "Google",
  microsoft: "Microsoft",
};

/* ─── Day note storage (localStorage, per org-day) ─────────── */
function noteKey(date: Date) {
  return `cal-note-${format(date, "yyyy-MM-dd")}`;
}
function loadNote(date: Date): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(noteKey(date)) ?? "";
}
function saveNote(date: Date, text: string) {
  if (typeof window === "undefined") return;
  if (text.trim()) localStorage.setItem(noteKey(date), text);
  else localStorage.removeItem(noteKey(date));
}
function hasNote(date: Date): boolean {
  return !!loadNote(date);
}

/* ─── Helpers ───────────────────────────────────────────────── */
function urgencyTag(d: Date) {
  if (isBefore(d, startOfDay(new Date()))) return { label: "Overdue", color: "#ef4444" };
  if (isToday(d))      return { label: "Today",    color: "#f97316" };
  return null;
}

function typeIcon(type: EventType) {
  if (type === "task")      return <CheckSquare size={12} />;
  if (type === "calendar")  return <CalendarDays size={12} />;
  if (type === "notice")    return <Bell size={12} />;
  if (type === "google")    return <Circle size={12} />;
  if (type === "microsoft") return <Circle size={12} />;
  return <Circle size={12} />;
}

/* ─── Week day grid builder ─────────────────────────────────── */
function buildGrid(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 0 });
  const weeks: Date[][] = [];
  let cur = start;
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(cur); cur = addDays(cur, 1); }
    weeks.push(week);
  }
  return weeks;
}

/* ─── Event dot cluster ─────────────────────────────────────── */
function EventDots({ events }: { events: DayEvent[] }) {
  const MAX = 3;
  const shown = events.slice(0, MAX);
  const extra = events.length - MAX;
  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5 px-1">
      {shown.map((ev) => {
        const color = ev.type === "task"
          ? (PRIORITY_COLOR[ev.priority ?? "NORMAL"] ?? "#00d4ff")
          : TYPE_COLOR[ev.type].dot;
        return (
          <div
            key={ev.id}
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: color, boxShadow: `0 0 4px ${color}80` }}
            title={ev.title}
          />
        );
      })}
      {extra > 0 && (
        <span className="text-[9px] font-bold leading-none" style={{ color: "#374151" }}>+{extra}</span>
      )}
    </div>
  );
}

/* ─── Day Note Badge ────────────────────────────────────────── */
function NoteBadge() {
  return (
    <div
      className="absolute top-1 left-1 w-3.5 h-3.5 rounded-md flex items-center justify-center"
      style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24" }}
      title="Has note"
    >
      <StickyNote size={8} />
    </div>
  );
}

/* ─── Day Panel (right side) ─────────────────────────────────── */
type DayPanelProps = {
  day: Date;
  events: DayEvent[];
  onClose: () => void;
  onEventCreated: () => void;
  token: string | null;
};

function DayPanel({ day, events, onClose, onEventCreated, token }: DayPanelProps) {
  const [noteText, setNoteText]     = useState(() => loadNote(day));
  const [noteSaved, setNoteSaved]   = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [newTitle, setNewTitle]     = useState("");
  const [newType, setNewType]       = useState<"REMINDER" | "MEETING" | "DEADLINE">("REMINDER");
  const [newTime, setNewTime]       = useState("09:00");
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSaveNote = () => {
    saveNote(day, noteText);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1800);
  };

  const handleCreateEvent = async () => {
    if (!newTitle.trim() || !token) return;
    setSaving(true); setErr(null);
    try {
      const [h, m] = newTime.split(":").map(Number);
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      const res = await authedFetch<{ ok: boolean; message?: string }>("/calendar/events", {
        method: "POST",
        body: JSON.stringify({
          title:   newTitle.trim(),
          type:    newType,
          startAt: d.toISOString(),
          allDay:  false,
        }),
      });
      if ((res as any).ok) {
        setNewTitle(""); setAddingEvent(false);
        onEventCreated();
      } else {
        setErr((res as any).message ?? "Failed to create event");
      }
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const overdue = events.filter(
    (e) => e.type === "task" && isBefore(e.date, startOfDay(new Date()))
  );

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        width: 320,
        minWidth: 280,
        background: "rgba(6,22,40,0.85)",
        border: "1px solid rgba(0,212,255,0.12)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.04)",
        backdropFilter: "blur(32px)",
        animation: "slide-up 0.25s cubic-bezier(0.34,1.56,0.64,1) both",
        maxHeight: "calc(100vh - 180px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
        style={{ borderColor: "rgba(0,212,255,0.08)", background: "rgba(6,22,40,0.7)" }}
      >
        <div>
          <div className="text-sm font-bold text-[#e2e8f0]">
            {format(day, "EEEE")}
            {isToday(day) && (
              <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={{ background: "rgba(0,212,255,0.15)", color: "#00d4ff" }}>Today</span>
            )}
          </div>
          <div className="text-xs text-[#64748b] font-medium mt-0.5">{format(day, "MMMM d, yyyy")}</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748b] hover:text-[#94a3b8] hover:bg-white/5 transition-all"
        >
          <X size={13} />
        </button>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ background: "rgba(239,68,68,0.07)", borderBottom: "1px solid rgba(239,68,68,0.15)" }}>
          <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
          <span className="text-[11px] font-bold text-red-400">{overdue.length} overdue task{overdue.length > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* Events for this day */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">
              Events & Deadlines ({events.length})
            </span>
            <button
              onClick={() => setAddingEvent((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{
                background: addingEvent ? "rgba(0,212,255,0.15)" : "rgba(13,37,64,0.6)",
                border: "1px solid rgba(0,212,255,0.15)",
                color: addingEvent ? "#00d4ff" : "#64748b",
              }}
            >
              <Plus size={10} /> Add
            </button>
          </div>

          {/* Add event form */}
          {addingEvent && (
            <div
              className="mb-3 p-3 rounded-xl space-y-2.5"
              style={{
                background: "rgba(13,37,64,0.5)",
                border: "1px solid rgba(0,212,255,0.12)",
                animation: "slide-down 0.2s ease both",
              }}
            >
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Event title…"
                className="w-full rounded-lg px-3 py-2 text-xs font-medium text-[#e2e8f0] outline-none transition-all"
                style={{
                  background: "rgba(6,22,40,0.8)",
                  border: "1px solid rgba(0,212,255,0.15)",
                }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(0,212,255,0.4)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(0,212,255,0.15)"; }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateEvent()}
              />
              <div className="flex gap-2">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="flex-1 rounded-lg px-2 py-2 text-xs font-medium outline-none"
                  style={{
                    background: "rgba(6,22,40,0.8)",
                    border: "1px solid rgba(0,212,255,0.12)",
                    color: "#94a3b8",
                  }}
                >
                  <option value="REMINDER">Reminder</option>
                  <option value="MEETING">Meeting</option>
                  <option value="DEADLINE">Deadline</option>
                </select>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-24 rounded-lg px-2 py-2 text-xs font-medium outline-none"
                  style={{
                    background: "rgba(6,22,40,0.8)",
                    border: "1px solid rgba(0,212,255,0.12)",
                    color: "#94a3b8",
                    colorScheme: "dark",
                  }}
                />
              </div>
              {err && <div className="text-[11px] text-red-400 font-medium">{err}</div>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateEvent}
                  disabled={saving || !newTitle.trim()}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                    color: "#020b18",
                  }}
                >
                  {saving ? "Saving…" : "Save Event"}
                </button>
                <button
                  onClick={() => { setAddingEvent(false); setErr(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:text-[#94a3b8] transition-all"
                  style={{ border: "1px solid rgba(0,212,255,0.08)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Event list */}
          {events.length === 0 && !addingEvent ? (
            <div className="flex flex-col items-center py-5 text-center">
              <CalendarCheck size={22} className="text-[#374151] mb-2" />
              <p className="text-xs text-[#374151] font-medium">Nothing scheduled</p>
              <p className="text-[10px] text-[#1e293b] mt-0.5">Click Add to create an event</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {events.map((ev) => {
                const tc = TYPE_COLOR[ev.type];
                const dotColor = ev.type === "task"
                  ? (PRIORITY_COLOR[ev.priority ?? "NORMAL"] ?? tc.dot)
                  : tc.dot;
                const u = urgencyTag(ev.date);
                return (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{
                      background: tc.bg,
                      border: `1px solid ${dotColor}25`,
                    }}
                  >
                    {/* Dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                      style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="text-xs font-semibold text-[#e2e8f0] leading-tight truncate">
                          {ev.title.replace(/^[📌📢]\s?/, "")}
                        </div>
                        {u && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: `${u.color}18`, color: u.color }}
                          >
                            {u.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] font-medium"
                          style={{ color: tc.text }}>
                          {typeIcon(ev.type)} {TYPE_LABEL[ev.type]}
                        </span>
                        {ev.projectName && (
                          <span className="flex items-center gap-1 text-[10px] text-[#64748b] font-medium">
                            <Briefcase size={9} /> {ev.projectName}
                          </span>
                        )}
                        {ev.priority && ev.type === "task" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: PRIORITY_COLOR[ev.priority] ?? "#64748b" }}>
                            <Flag size={9} /> {ev.priority}
                          </span>
                        )}
                      </div>
                      {!ev.allDay && (
                        <div className="flex items-center gap-1 text-[10px] text-[#374151] font-medium mt-0.5">
                          <Clock size={9} /> {format(ev.date, "h:mm a")}
                        </div>
                      )}
                      {ev.description && (
                        <div className="text-[10px] text-[#374151] mt-1 leading-relaxed line-clamp-2">
                          {ev.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Day Note */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <Pen size={10} className="text-[#fbbf24]" />
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Day Note</span>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(245,158,11,0.18)" }}
          >
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => { setNoteText(e.target.value); setNoteSaved(false); }}
              placeholder={`Write a note for ${format(day, "MMM d")}…\n\nUse this to jot down reminders, decisions, or anything the team needs to know about this day.`}
              rows={5}
              className="w-full resize-none outline-none text-xs font-medium leading-relaxed text-[#94a3b8] placeholder-[#374151]"
              style={{
                background: "rgba(13,37,64,0.5)",
                padding: "12px",
                caretColor: "#00d4ff",
              }}
            />
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ background: "rgba(6,22,40,0.6)", borderTop: "1px solid rgba(245,158,11,0.1)" }}
            >
              <span className="text-[10px] text-[#374151] font-medium">
                {noteText.length > 0 ? `${noteText.length} chars` : "No note yet"}
              </span>
              <button
                onClick={handleSaveNote}
                disabled={!noteText.trim()}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-30"
                style={{
                  background: noteSaved ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.15)",
                  border: `1px solid ${noteSaved ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.25)"}`,
                  color: noteSaved ? "#34d399" : "#fbbf24",
                }}
              >
                {noteSaved ? <><CalendarCheck size={10} /> Saved!</> : <><Save size={10} /> Save Note</>}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[#1e293b] mt-1.5 leading-relaxed px-1">
            Notes are private and stored locally on your device.
          </p>
        </section>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function CalendarPage() {
  const [month, setMonth]           = useState(new Date());
  const [allEvents, setAllEvents]   = useState<DayEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  // Track notes map for dot indicators — re-read when day panel closes
  const [noteDays, setNoteDays]     = useState<Set<string>>(new Set());
  const token = useAuthStore((s) => s.accessToken);

  /* scan localStorage for note keys in current month */
  const refreshNoteDays = useCallback(() => {
    if (typeof window === "undefined") return;
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("cal-note-"));
    setNoteDays(new Set(keys.map((k) => k.replace("cal-note-", ""))));
  }, []);

  useEffect(() => { refreshNoteDays(); }, [refreshNoteDays]);

  /* Load events */
  const loadEvents = useCallback(async (isRefresh = false) => {
    if (!token) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    const collected: DayEvent[] = [];

    try {
      /* 1. Native calendar + task deadlines */
      const calRes = await authedFetch<{ ok: boolean; events: any[]; tasksAsEvents: any[] }>(
        "/calendar/events"
      ).catch(() => null);

      if (calRes?.ok) {
        (calRes.events ?? []).forEach((ev: any) => {
          collected.push({
            id:          `cal-${ev.id}`,
            title:       ev.title,
            date:        new Date(ev.startAt),
            allDay:      ev.allDay ?? false,
            type:        "calendar",
            description: ev.description,
            color:       ev.color,
          });
        });

        (calRes.tasksAsEvents ?? []).forEach((t: any) => {
          if (!t.dueAt) return;
          collected.push({
            id:          `task-${t.id}`,
            title:       t.title,
            date:        new Date(t.dueAt),
            allDay:      true,
            type:        "task",
            priority:    t.priority,
            status:      t.status,
            projectName: t.project?.name,
            projectId:   t.project?.id ?? t.projectId,
            taskId:      t.id,
          });
        });
      }

      /* 2. External calendars */
      const extRes = await authedFetch<{ ok: boolean; events: any[] }>(
        "/integrations/sync/calendar"
      ).catch(() => null);

      if (extRes?.ok) {
        (extRes.events ?? []).forEach((ev: any) => {
          const type: EventType = ev.provider === "GOOGLE" ? "google" : "microsoft";
          collected.push({
            id:    `ext-${ev.id ?? Math.random()}`,
            title: ev.subject || ev.summary || "Event",
            date:  new Date(ev.start?.dateTime || ev.start?.date || ev.start),
            allDay: !ev.start?.dateTime,
            type,
          });
        });
      }

      /* 3. Notices */
      const noticeRes = await authedFetch<{ ok: boolean; notices: any[] }>(
        "/notices"
      ).catch(() => null);

      if (noticeRes?.ok) {
        (noticeRes.notices ?? []).forEach((n: any) => {
          collected.push({
            id:          `notice-${n.id}`,
            title:       n.title,
            date:        new Date(n.createdAt),
            allDay:      true,
            type:        "notice",
            description: n.content,
          });
        });
      }

      setAllEvents(collected);
    } catch (e) {
      console.error("Calendar load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  /* group events by date string */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    allEvents.forEach((ev) => {
      const key = format(ev.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [allEvents]);

  const grid = useMemo(() => buildGrid(month), [month]);

  const overdueTasks = allEvents.filter(
    (e) => e.type === "task" && isBefore(e.date, startOfDay(new Date()))
  );

  const handleDayClick = (day: Date) => {
    if (selectedDay && isSameDay(day, selectedDay)) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  };

  const handlePanelClose = () => {
    refreshNoteDays();
    setSelectedDay(null);
  };

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <AppShell
      title="Calendar"
      subtitle="Click any day to view events, add entries, or write a note"
      right={
        <button
          onClick={() => loadEvents(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
          style={{
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.2)",
            color: "#00d4ff",
          }}
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Sync
        </button>
      }
    >
      {/* Overdue bar */}
      {overdueTasks.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4 border"
          style={{
            background: "rgba(239,68,68,0.07)",
            borderColor: "rgba(239,68,68,0.2)",
            animation: "slide-down 0.3s ease both",
          }}
        >
          <div className="relative flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 opacity-50"
              style={{ animation: "ping-slow 1.5s ease-in-out infinite" }} />
          </div>
          <span className="text-xs font-bold text-red-400">
            {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""} —{" "}
            <span className="font-normal text-red-400/70">
              {overdueTasks.slice(0, 3).map((e) => e.title.replace(/^[📌📢]\s?/, "")).join(", ")}
              {overdueTasks.length > 3 && ` +${overdueTasks.length - 3} more`}
            </span>
          </span>
        </div>
      )}

      {/* Layout: calendar + day panel */}
      <div className="flex gap-4 items-start">
        {/* ── Calendar Card ── */}
        <div
          className="flex-1 min-w-0 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(6,22,40,0.7)",
            border: "1px solid rgba(0,212,255,0.1)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,255,0.04)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Month nav */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "rgba(0,212,255,0.08)", background: "rgba(6,22,40,0.6)" }}
          >
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5 transition-all"
              style={{ border: "1px solid rgba(0,212,255,0.08)" }}
            >
              <ChevronLeft size={15} />
            </button>

            <div className="text-center">
              <div className="text-base font-bold text-[#e2e8f0] tracking-tight">
                {format(month, "MMMM yyyy")}
              </div>
              <div className="text-[10px] text-[#374151] font-medium mt-0.5">
                {allEvents.length} total events
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setMonth(new Date()); setSelectedDay(new Date()); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", color: "#00d4ff" }}
              >
                Today
              </button>
              <button
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5 transition-all"
                style={{ border: "1px solid rgba(0,212,255,0.08)" }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}>
                <CalendarDays size={22} className="text-primary" />
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#64748b] font-medium">
                <div className="w-4 h-4 border-2 border-transparent border-t-[#00d4ff] rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }} />
                Loading your schedule…
              </div>
            </div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b" style={{ borderColor: "rgba(0,212,255,0.06)" }}>
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "#374151" }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div>
                {grid.map((week, wi) => (
                  <div
                    key={wi}
                    className="grid grid-cols-7"
                    style={{ borderTop: wi === 0 ? "none" : "1px solid rgba(0,212,255,0.05)" }}
                  >
                    {week.map((day) => {
                      const key       = format(day, "yyyy-MM-dd");
                      const dayEvents = eventsByDay.get(key) ?? [];
                      const inMonth   = isSameMonth(day, month);
                      const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                      const isTodayDay = isToday(day);
                      const hasNoteFlag = noteDays.has(key);

                      return (
                        <div
                          key={key}
                          onClick={() => handleDayClick(day)}
                          className="relative cursor-pointer transition-all duration-150 select-none"
                          style={{
                            minHeight: 90,
                            background: isSelected
                              ? "rgba(0,212,255,0.09)"
                              : isTodayDay
                              ? "rgba(0,212,255,0.04)"
                              : "transparent",
                            borderLeft: "1px solid rgba(0,212,255,0.05)",
                            outline: isSelected ? "inset 0 0 0 1px rgba(0,212,255,0.35)" : "none",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "rgba(0,212,255,0.03)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = isTodayDay
                                ? "rgba(0,212,255,0.04)"
                                : "transparent";
                            }
                          }}
                        >
                          {/* Note badge */}
                          {hasNoteFlag && <NoteBadge />}

                          {/* Selection ring */}
                          {isSelected && (
                            <div
                              className="absolute inset-0 rounded-none pointer-events-none"
                              style={{ boxShadow: "inset 0 0 0 1.5px rgba(0,212,255,0.35)" }}
                            />
                          )}

                          {/* Date number */}
                          <div className="flex justify-end pt-2 pr-2 pb-1">
                            <span
                              className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold transition-all"
                              style={
                                isTodayDay
                                  ? { background: "#00d4ff", color: "#020b18", boxShadow: "0 0 12px rgba(0,212,255,0.5)" }
                                  : isSelected
                                  ? { background: "rgba(0,212,255,0.2)", color: "#00d4ff" }
                                  : { color: inMonth ? "#94a3b8" : "#1e293b" }
                              }
                            >
                              {format(day, "d")}
                            </span>
                          </div>

                          {/* Event previews */}
                          <div className="px-1 pb-1 space-y-0.5">
                            {dayEvents.slice(0, 3).map((ev) => {
                              const dotColor = ev.type === "task"
                                ? (PRIORITY_COLOR[ev.priority ?? "NORMAL"] ?? "#00d4ff")
                                : TYPE_COLOR[ev.type].dot;
                              return (
                                <div
                                  key={ev.id}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate"
                                  style={{
                                    background: `${dotColor}14`,
                                    color: dotColor,
                                    border: `1px solid ${dotColor}20`,
                                  }}
                                >
                                  <div
                                    className="w-1 h-1 rounded-full flex-shrink-0"
                                    style={{ background: dotColor }}
                                  />
                                  <span className="truncate">
                                    {ev.title.replace(/^[📌📢]\s?/, "")}
                                  </span>
                                </div>
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <div className="px-1.5 text-[9px] font-bold" style={{ color: "#374151" }}>
                                +{dayEvents.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t"
                style={{ borderColor: "rgba(0,212,255,0.06)", background: "rgba(2,11,24,0.35)" }}
              >
                {([
                  { color: "#ef4444", label: "Urgent" },
                  { color: "#f97316", label: "High" },
                  { color: "#00d4ff", label: "Task" },
                  { color: "#a78bfa", label: "Event" },
                  { color: "#fbbf24", label: "Notice / Note" },
                  { color: "#f87171", label: "Google" },
                  { color: "#38bdf8", label: "Microsoft" },
                ] as { color: string; label: string }[]).map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ background: color, boxShadow: `0 0 4px ${color}60` }} />
                    <span className="text-[10px] text-[#374151] font-medium">{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <StickyNote size={9} style={{ color: "#fbbf24" }} />
                  <span className="text-[10px] text-[#374151] font-medium">= has note</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Day Panel ── */}
        {selectedDay && (
          <DayPanel
            day={selectedDay}
            events={(eventsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []).sort(
              (a, b) => a.date.getTime() - b.date.getTime()
            )}
            onClose={handlePanelClose}
            onEventCreated={() => { loadEvents(true); }}
            token={token}
          />
        )}
      </div>
    </AppShell>
  );
}
