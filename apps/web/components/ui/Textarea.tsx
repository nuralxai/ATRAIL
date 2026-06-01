"use client";

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export default function Textarea({ className = "", label, ...props }: TextareaProps) {
  const textarea = (
    <textarea
      className={`w-full rounded-xl border border-primary/20 glass-panel text-white placeholder:text-text-muted px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors ${className}`}
      {...props}
    />
  );

  if (label) {
    return (
      <div className="w-full">
        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">
          {label}
        </label>
        {textarea}
      </div>
    );
  }

  return textarea;
}
