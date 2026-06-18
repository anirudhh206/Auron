type CalloutType = "info" | "warn" | "tip" | "danger";

const CONFIG: Record<CalloutType, { label: string; border: string; bg: string; color: string }> = {
  info:   { label: "NOTE",    border: "rgba(39,39,42,1)",          bg: "var(--surface)",  color: "var(--text-muted)" },
  warn:   { label: "WARNING", border: "rgba(245,166,35,0.3)",      bg: "rgba(245,166,35,0.05)",  color: "#F5A623" },
  tip:    { label: "TIP",     border: "rgba(200,241,53,0.25)",     bg: "var(--lime-glow)", color: "var(--lime)" },
  danger: { label: "DANGER",  border: "rgba(239,68,68,0.3)",       bg: "rgba(239,68,68,0.05)",   color: "#EF4444" },
};

export default function Callout({ type = "info", children }: { type?: CalloutType; children: React.ReactNode }) {
  const c = CONFIG[type];
  return (
    <div
      className="flex gap-4 px-4 py-4 my-5"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10,
          fontWeight: 600,
          color: c.color,
          letterSpacing: "0.1em",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {c.label}
      </span>
      <div style={{ fontFamily: "'Geist', sans-serif", fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
