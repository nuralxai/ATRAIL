"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  timeoutMs: number;
  action?: ToastAction;
  createdAt: number;
};

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();

function emit(toast: ToastItem) {
  listeners.forEach((l) => l(toast));
}

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export const toast = {
  success(message: string, title?: string, action?: ToastAction) {
    emit({
      id: makeId(),
      type: "success",
      title,
      message,
      timeoutMs: 2600,
      action,
      createdAt: Date.now(),
    });
  },
  error(message: string, title?: string, action?: ToastAction) {
    emit({
      id: makeId(),
      type: "error",
      title,
      message,
      timeoutMs: 3800,
      action,
      createdAt: Date.now(),
    });
  },
  info(message: string, title?: string, action?: ToastAction) {
    emit({
      id: makeId(),
      type: "info",
      title,
      message,
      timeoutMs: 3000,
      action,
      createdAt: Date.now(),
    });
  },
};

function tone(type: ToastType): React.CSSProperties {
  if (type === "success") return {
    background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,22,40,0.95))",
    border: "1px solid rgba(16,185,129,0.25)",
    color: "#e2e8f0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(16,185,129,0.1)",
  };
  if (type === "error") return {
    background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(6,22,40,0.95))",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#e2e8f0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(239,68,68,0.1)",
  };
  return {
    background: "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(6,22,40,0.95))",
    border: "1px solid rgba(0,212,255,0.2)",
    color: "#e2e8f0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,255,0.08)",
  };
}

function iconStyle(type: ToastType): React.CSSProperties {
  if (type === "success") return { background: "rgba(16,185,129,0.15)", color: "#34d399" };
  if (type === "error")   return { background: "rgba(239,68,68,0.15)",  color: "#f87171" };
  return { background: "rgba(0,212,255,0.12)", color: "#00d4ff" };
}

function icon(type: ToastType) {
  if (type === "success") return <CheckCircle size={16} />;
  if (type === "error") return <AlertCircle size={16} />;
  return <Info size={16} />;
}

function roleFor(type: ToastType) {
  // errors should be assertive, others polite
  return type === "error" ? "alert" : "status";
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());
  const paused = useRef(new Set<string>());

  const remove = (id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    paused.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const scheduleRemove = (t: ToastItem) => {
    const existing = timers.current.get(t.id);
    if (existing) window.clearTimeout(existing);

    const timeout = window.setTimeout(() => {
      // if hovered/paused, do nothing
      if (paused.current.has(t.id)) return;
      remove(t.id);
    }, t.timeoutMs);

    timers.current.set(t.id, timeout);
  };

  useEffect(() => {
    const onToast: Listener = (t) => {
      setItems((prev) => {
        const next = [t, ...prev]; // newest on top
        return next.slice(0, 5); // hard cap: prevent spam flood
      });
      scheduleRemove(t);
    };

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      // cleanup
      timers.current.forEach((v) => window.clearTimeout(v));
      timers.current.clear();
      paused.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed top-4 right-4 z-[200] w-[380px] max-w-[92vw] space-y-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={roleFor(t.type) as any}
          className="rounded-2xl p-4 transition-all duration-200 ease-out animate-[toastIn_180ms_ease-out]"
          style={{
            ...tone(t.type),
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
          onMouseEnter={() => { paused.current.add(t.id); }}
          onMouseLeave={() => { paused.current.delete(t.id); scheduleRemove(t); }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={iconStyle(t.type)}
              >
                {icon(t.type)}
              </div>

              <div className="min-w-0">
                {t.title && (
                  <div className="text-sm font-semibold truncate">
                    {t.title}
                  </div>
                )}
                <div className="text-sm leading-5">{t.message}</div>

                {t.action && (
                  <button
                    className="mt-2 text-xs font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
                    onClick={() => {
                      try {
                        t.action?.onClick();
                      } finally {
                        remove(t.id);
                      }
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
            </div>

            <button
              className="text-xs font-semibold opacity-70 hover:opacity-100 p-1"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}

      {/* keyframes */}
      <style jsx global>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
