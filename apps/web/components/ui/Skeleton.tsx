"use client";

export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{ background: "rgba(13,37,64,0.6)" }}
    >
      <div
        className="absolute inset-0 -skew-x-12"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.05), transparent)",
          animation: "shimmer 2s ease-in-out infinite",
        }}
      />
    </div>
  );
}
