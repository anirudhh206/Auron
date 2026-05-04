// Route-level loading skeleton for /app
// Shown by Next.js suspense during initial navigation

export default function AppLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: "#030712" }}
    >
      {/* Pulsing logo */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse"
        style={{
          background: "linear-gradient(135deg, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.1) 100%)",
          border: "1px solid rgba(201,168,76,0.25)",
        }}
      >
        <span style={{ fontSize: 24 }}>⚡</span>
      </div>

      {/* Shimmer lines */}
      <div className="flex flex-col items-center gap-2 w-48">
        <div
          className="h-2.5 w-full rounded-full animate-pulse"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
        <div
          className="h-2 w-3/4 rounded-full animate-pulse"
          style={{ background: "rgba(255,255,255,0.04)", animationDelay: "0.15s" }}
        />
      </div>

      <p
        className="text-xs tracking-widest uppercase animate-pulse"
        style={{ color: "rgba(201,168,76,0.4)", animationDelay: "0.3s" }}
      >
        Loading Auron
      </p>
    </div>
  );
}
