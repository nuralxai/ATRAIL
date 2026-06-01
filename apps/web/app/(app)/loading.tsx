export default function Loading() {
  return (
    <div className="flex flex-col gap-5 w-full animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-2">
          <div className="h-5 w-48 rounded-lg" style={{ background: "rgba(0,212,255,0.06)" }} />
          <div className="h-3 w-72 rounded-md" style={{ background: "rgba(0,212,255,0.04)" }} />
        </div>
        <div className="h-8 w-20 rounded-xl" style={{ background: "rgba(0,212,255,0.06)" }} />
      </div>
      {/* Content skeleton cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-36 rounded-2xl"
            style={{
              background: "rgba(6,22,40,0.5)",
              border: "1px solid rgba(0,212,255,0.06)",
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>
      <div className="h-64 rounded-2xl" style={{ background: "rgba(6,22,40,0.4)", border: "1px solid rgba(0,212,255,0.06)" }} />
    </div>
  );
}
