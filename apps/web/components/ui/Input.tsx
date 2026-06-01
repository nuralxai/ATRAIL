"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
}

export default function Input({
  className = "",
  label,
  icon,
  error,
  hint,
  ...props
}: InputProps) {
  const input = (
    <div className="relative w-full">
      {icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none">
          {icon}
        </div>
      )}
      <input
        className={[
          "w-full rounded-xl text-[#e2e8f0] placeholder:text-[#64748b] font-medium",
          "bg-[rgba(6,22,40,0.6)] backdrop-blur-sm",
          "border transition-all duration-300 outline-none text-sm",
          error
            ? "border-red-500/50 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.08)] focus:bg-red-500/[0.03]"
            : "border-[rgba(0,212,255,0.12)] focus:border-[rgba(0,212,255,0.5)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.08),0_0_20px_rgba(0,212,255,0.06)] focus:bg-[rgba(0,212,255,0.03)]",
          icon ? "pl-10 pr-4 py-3" : "px-4 py-3",
          className,
        ].join(" ")}
        {...props}
      />
    </div>
  );

  if (label || error || hint) {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.12em] pl-1">
            {label}
          </label>
        )}
        {input}
        {error && (
          <p className="text-xs text-red-400 pl-1 flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-[#64748b] pl-1">{hint}</p>
        )}
      </div>
    );
  }

  return input;
}
