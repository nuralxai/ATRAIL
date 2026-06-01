"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = "max-w-xl",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]" style={{ animation: "fade-in 0.2s ease both" }}>
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(2,11,24,0.8)] backdrop-blur-sm cursor-default"
      />

      {/* Modal Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`pointer-events-auto w-full ${widthClass} rounded-2xl overflow-hidden`}
          style={{
            background: "linear-gradient(135deg, rgba(13,37,64,0.95) 0%, rgba(6,22,40,0.98) 100%)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(0,212,255,0.15)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.06), 0 0 100px rgba(0,212,255,0.04)",
            animation: "scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {/* Top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.5)] to-transparent" />

          {/* Header */}
          <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-[rgba(0,212,255,0.08)]">
            <div>
              <div className="text-base font-semibold text-[#e2e8f0] tracking-tight">{title}</div>
              {subtitle && (
                <div className="text-xs text-[#64748b] mt-0.5 font-medium">{subtitle}</div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b]
                hover:text-[#e2e8f0] hover:bg-white/5 transition-all duration-200 -mr-1 -mt-0.5"
            >
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-[rgba(0,212,255,0.08)] bg-[rgba(6,22,40,0.5)]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
