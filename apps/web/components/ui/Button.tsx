"use client";

import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "gold";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  glow?: boolean;
};

const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { children, className = "", variant = "primary", size = "md", glow = false, ...props },
  ref
) {
  const base =
    "relative inline-flex items-center justify-center gap-2 font-semibold tracking-wide " +
    "rounded-xl cursor-pointer overflow-hidden transition-all duration-300 " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
    "active:scale-[0.98] select-none";

  const sizes: Record<Size, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  const styles: Record<Variant, string> = {
    primary:
      "bg-gradient-to-r from-primary to-cyan-400 text-bg font-bold " +
      "shadow-[0_4px_20px_rgba(0,212,255,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] " +
      "hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,212,255,0.5)]",
    secondary:
      "bg-gradient-to-r from-secondary to-violet-500 text-white font-bold " +
      "shadow-[0_4px_20px_rgba(124,58,237,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] " +
      "hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(124,58,237,0.5)]",
    gold:
      "bg-gradient-to-r from-accent to-yellow-400 text-bg font-bold " +
      "shadow-[0_4px_20px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] " +
      "hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(245,158,11,0.5)]",
    outline:
      "bg-transparent border border-primary/30 text-primary font-semibold " +
      "hover:bg-primary/10 hover:border-primary/60 hover:-translate-y-0.5",
    ghost:
      "bg-transparent text-text-hi font-medium " +
      "hover:bg-white/5 hover:text-white",
    danger:
      "bg-gradient-to-r from-red-600 to-rose-500 text-white font-bold " +
      "shadow-[0_4px_20px_rgba(239,68,68,0.3)] " +
      "hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(239,68,68,0.45)]",
  };

  const glowMap: Partial<Record<Variant, string>> = {
    primary:   "shadow-[0_0_30px_rgba(0,212,255,0.4)]",
    secondary: "shadow-[0_0_30px_rgba(124,58,237,0.4)]",
    danger:    "shadow-[0_0_30px_rgba(239,68,68,0.4)]",
  };

  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${styles[variant]} ${glow && glowMap[variant] ? glowMap[variant] : ""} ${className}`}
      {...props}
    >
      {/* Shimmer sweep on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -skew-x-12 translate-x-[-150%]
          bg-gradient-to-r from-transparent via-white/15 to-transparent
          group-hover:translate-x-[150%] transition-transform duration-700"
      />
      {children}
    </button>
  );
});

export default Button;
