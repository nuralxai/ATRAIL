"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/authed-fetch";
import { Search, CheckSquare, Briefcase, Users, Bell, ArrowRight, Loader2, X } from "lucide-react";

type ResultItem = {
  type: "task" | "project" | "user" | "notice";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  meta: string;
};

type SearchResults = {
  tasks: ResultItem[];
  projects: ResultItem[];
  users: ResultItem[];
  notices: ResultItem[];
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  task:    <CheckSquare size={14} className="text-yellow-400" />,
  project: <Briefcase  size={14} className="text-blue-400"   />,
  user:    <Users       size={14} className="text-purple-400" />,
  notice:  <Bell        size={14} className="text-green-400"  />,
};

const TYPE_LABEL: Record<string, string> = {
  task: "Tasks", project: "Projects", user: "People", notice: "Notices",
};

const QUICK_LINKS = [
  { label: "Kanban Board",    href: "/kanban",          icon: <CheckSquare size={14} /> },
  { label: "My Tasks",        href: "/tasks",            icon: <CheckSquare size={14} /> },
  { label: "Projects",        href: "/projects",         icon: <Briefcase  size={14} /> },
  { label: "Calendar",        href: "/calendar",         icon: <Bell       size={14} /> },
  { label: "HR & Leaves",     href: "/hr",               icon: <Users      size={14} /> },
  { label: "Analytics",       href: "/analytics",        icon: <Bell       size={14} /> },
  { label: "Roadmap",         href: "/roadmap",          icon: <ArrowRight size={14} /> },
  { label: "Invoice Manager", href: "/finance",          icon: <ArrowRight size={14} /> },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResults | null>(null);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(null);
      setSelected(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await authedFetch<{ ok: boolean; results: SearchResults }>(`/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(res.results);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
  }, [query, search]);

  // All navigable items in order for keyboard nav
  const allItems: ResultItem[] = results
    ? [...results.tasks, ...results.projects, ...results.users, ...results.notices]
    : [];

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }

    const items = results ? allItems : QUICK_LINKS;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selected];
      if (item) navigate((item as any).href);
    }
  }

  if (!open) return null;

  const grouped = results
    ? (["tasks", "projects", "users", "notices"] as const)
        .filter(k => results[k].length > 0)
        .map(k => ({ key: k, items: results[k] }))
    : [];

  const hasResults = results && allItems.length > 0;
  const noResults  = results && allItems.length === 0 && query.trim().length >= 2;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(2,11,24,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "rgba(6,18,36,0.98)",
          border: "1px solid rgba(0,212,255,0.2)",
          boxShadow: "0 0 80px rgba(0,212,255,0.08), 0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "rgba(0,212,255,0.1)" }}>
          {loading ? <Loader2 size={18} className="text-primary animate-spin flex-shrink-0" /> : <Search size={18} className="text-primary flex-shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKey}
            placeholder="Search tasks, projects, people, notices..."
            className="flex-1 bg-transparent text-white text-sm placeholder-text-muted outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults(null); }} className="text-text-muted hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
          <kbd className="text-[10px] text-text-muted px-1.5 py-0.5 rounded border border-[rgba(0,212,255,0.15)] font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {!query && (
            <div className="p-3">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-2 mb-2">Quick Navigation</div>
              <div className="grid grid-cols-2 gap-1">
                {QUICK_LINKS.map((link, i) => (
                  <button
                    key={link.href}
                    onClick={() => navigate(link.href)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                    style={{
                      background: selected === i ? "rgba(0,212,255,0.08)" : "transparent",
                      color: selected === i ? "#00d4ff" : "#94a3b8",
                    }}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <span className="text-primary/60">{link.icon}</span>
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {noResults && (
            <div className="py-12 text-center text-text-muted text-sm">
              No results for <span className="text-white">"{query}"</span>
            </div>
          )}

          {hasResults && grouped.map(({ key, items }) => {
            return (
              <div key={key} className="px-3 py-2">
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-2 mb-1.5">
                  {TYPE_LABEL[key]}
                </div>
                {items.map(item => {
                  const globalIdx = allItems.indexOf(item);
                  const isSelected = selected === globalIdx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelected(globalIdx)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-0.5"
                      style={{
                        background: isSelected ? "rgba(0,212,255,0.08)" : "transparent",
                        border: `1px solid ${isSelected ? "rgba(0,212,255,0.15)" : "transparent"}`,
                      }}
                    >
                      <span className="flex-shrink-0">{TYPE_ICON[item.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">{item.title}</div>
                        <div className="text-xs text-text-muted truncate">{item.subtitle}</div>
                      </div>
                      {item.meta && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(0,212,255,0.06)", color: "#64748b" }}>
                          {item.meta}
                        </span>
                      )}
                      {isSelected && <ArrowRight size={12} className="text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t text-[10px] text-text-muted" style={{ borderColor: "rgba(0,212,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
          </div>
          <span>Powered by Atrail Search</span>
        </div>
      </div>
    </div>
  );
}
