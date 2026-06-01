"use client";

export default function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "blue" | "amber" | "red" | "purple" | "cyan";
  className?: string;
}) {
  const tones: Record<string, { bg: string; color: string; border: string }> = {
    neutral: { bg: "rgba(100,116,139,0.1)", color: "#94a3b8", border: "rgba(100,116,139,0.2)" },
    cyan:    { bg: "rgba(0,212,255,0.1)",   color: "#00d4ff", border: "rgba(0,212,255,0.25)" },
    blue:    { bg: "rgba(2,132,199,0.1)",   color: "#38bdf8", border: "rgba(2,132,199,0.25)" },
    green:   { bg: "rgba(16,185,129,0.1)",  color: "#34d399", border: "rgba(16,185,129,0.25)" },
    amber:   { bg: "rgba(245,158,11,0.1)",  color: "#fbbf24", border: "rgba(245,158,11,0.25)" },
    red:     { bg: "rgba(239,68,68,0.1)",   color: "#f87171", border: "rgba(239,68,68,0.25)" },
    purple:  { bg: "rgba(124,58,237,0.1)",  color: "#a78bfa", border: "rgba(124,58,237,0.25)" },
  };

  const t = tones[tone] ?? tones.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${className}`}
      style={{
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {children}
    </span>
  );
}
