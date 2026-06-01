"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";

type ConfirmPayload = {
  title: string;
  message?: string;
  details?: React.ReactNode;

  confirmText?: string;
  cancelText?: string;

  danger?: boolean;

  /**
   * If true, user must hold confirm button for holdMs.
   * Great for irreversible/destructive actions.
   */
  holdToConfirm?: boolean;
  holdMs?: number;
};

type PayloadWithResolve = ConfirmPayload & { resolve: (v: boolean) => void };

type Listener = (p: PayloadWithResolve) => void;
const listeners = new Set<Listener>();

export function confirm(p: ConfirmPayload) {
  return new Promise<boolean>((resolve) => {
    listeners.forEach((l) => l({ ...p, resolve }));
  });
}

export function ConfirmHost() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<PayloadWithResolve | null>(null);

  // Queue so multiple confirm() calls don't overwrite each other
  const queueRef = useRef<PayloadWithResolve[]>([]);

  // Resolve guard
  const resolvedRef = useRef(false);

  // Focus confirm button
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Hold-to-confirm state
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  const holdEnabled = !!payload?.holdToConfirm;
  const holdMs = payload?.holdMs ?? 1100;

  const showNext = () => {
    const next = queueRef.current.shift() ?? null;
    resolvedRef.current = false;
    setHolding(false);
    setProgress(0);

    if (next) {
      setPayload(next);
      setOpen(true);
    } else {
      setPayload(null);
      setOpen(false);
    }
  };

  useEffect(() => {
    const onConfirm: Listener = (p) => {
      queueRef.current.push(p);
      if (!open && !payload) showNext();
    };

    listeners.add(onConfirm);
    return () => void listeners.delete(onConfirm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payload]);

  // Focus confirm after modal opens
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => confirmBtnRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const stopHold = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setHolding(false);
    setProgress(0);
  };

  const close = (value: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    stopHold();

    const r = payload?.resolve;
    setOpen(false);

    // resolve current
    r?.(value);

    // show next (if any)
    setTimeout(() => showNext(), 0);
  };

  const startHold = () => {
    if (!holdEnabled) return;

    stopHold();
    setHolding(true);
    holdStartRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const p = Math.max(0, Math.min(1, elapsed / holdMs));
      setProgress(p);

      if (p >= 1) {
        close(true);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  // Enter = confirm only when NOT hold-to-confirm
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;

      // Don't hijack Enter inside form fields
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;

      if (holdEnabled) return; // hold-required: don't allow Enter-to-confirm

      e.preventDefault();
      close(true);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, holdEnabled]);

  // If modal closes, stop hold animation
  useEffect(() => {
    if (!open) stopHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const confirmLabel = useMemo(() => {
    if (!payload) return "Confirm";
    if (payload.confirmText) return payload.confirmText;
    if (holdEnabled)
      return payload.danger ? "Hold to confirm" : "Hold to continue";
    return "Confirm";
  }, [payload, holdEnabled]);

  // Esc key handling (Modal handles it, but ensure it cancels)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Modal
      open={open}
      title={payload?.title ?? "Confirm"}
      subtitle={
        payload?.danger ? "Please review before continuing." : undefined
      }
      onClose={() => close(false)}
      widthClass="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          {holdEnabled ? (
            <div className="flex-1 pr-3">
              <div className="h-2 w-full rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className="h-full glass-panel"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                Hold to confirm • {Math.round(progress * 100)}%
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => close(false)}>
              {payload?.cancelText ?? "Cancel"}
            </Button>

            <Button
              ref={confirmBtnRef}
              variant={payload?.danger ? "danger" : "primary"}
              onClick={() => {
                if (holdEnabled) return; // click does nothing when hold required
                close(true);
              }}
              // Pointer (mouse/touch) hold support
              onPointerDown={() => startHold()}
              onPointerUp={() => stopHold()}
              onPointerCancel={() => stopHold()}
              onPointerLeave={() => stopHold()}
              // Keyboard hold support: hold Space/Enter on the button
              onKeyDown={(e) => {
                if (!holdEnabled) return;
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  startHold();
                }
              }}
              onKeyUp={(e) => {
                if (!holdEnabled) return;
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  stopHold();
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-text-main whitespace-pre-wrap">
          {payload?.message ?? "Are you sure?"}
        </div>

        {payload?.details ? (
          <div className="rounded-2xl border border-primary/20 glass-panel p-4 text-sm text-text-main">
            {payload.details}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
