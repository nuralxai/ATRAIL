"use client";

import React from "react";

type CardVariant = "default" | "elevated" | "aurora" | "flat";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
}

export function Card({
  className = "",
  variant = "default",
  hover = true,
  ...props
}: CardProps) {
  const base =
    "rounded-2xl overflow-hidden transition-all duration-300";

  const variants: Record<CardVariant, string> = {
    default:
      "bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] " +
      "shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(0,212,255,0.06)]",
    elevated:
      "bg-gradient-to-br from-[rgba(13,37,64,0.85)] to-[rgba(6,22,40,0.95)] " +
      "backdrop-blur-xl border border-[rgba(0,212,255,0.12)] " +
      "shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,212,255,0.04),inset_0_1px_0_rgba(255,255,255,0.06)]",
    aurora:
      "relative bg-[rgba(6,22,40,0.8)] backdrop-blur-xl " +
      "before:absolute before:inset-[-1px] before:rounded-2xl before:p-px " +
      "before:bg-gradient-to-br before:from-[rgba(0,212,255,0.5)] before:via-[rgba(124,58,237,0.3)] before:to-[rgba(0,212,255,0.2)] " +
      "shadow-[0_8px_40px_rgba(0,0,0,0.5)]",
    flat:
      "bg-[rgba(10,31,53,0.6)] border border-[rgba(0,212,255,0.08)]",
  };

  const hoverClass = hover
    ? "hover:-translate-y-1 hover:border-[rgba(0,212,255,0.2)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,212,255,0.12),0_0_60px_rgba(0,212,255,0.05)]"
    : "";

  return (
    <div
      className={`${base} ${variants[variant]} ${hoverClass} ${className}`}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  accent,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  accent?: "cyan" | "purple" | "gold";
}) {
  const accentColors = {
    cyan:   "from-primary/60 via-cyan-400/20 to-transparent",
    purple: "from-secondary/60 via-violet-500/20 to-transparent",
    gold:   "from-accent/60 via-yellow-400/20 to-transparent",
  };

  return (
    <div className="relative px-5 py-4 border-b border-[rgba(0,212,255,0.08)] flex items-start justify-between gap-4">
      {accent && (
        <div
          className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentColors[accent]} opacity-60`}
        />
      )}
      <div>
        <div className="text-sm font-semibold text-[#e2e8f0]">{title}</div>
        {subtitle && (
          <div className="text-xs text-[#64748b] mt-0.5 font-medium">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}

export function CardContent({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 ${className}`} {...props} />;
}
