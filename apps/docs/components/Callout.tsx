type CalloutType = "info" | "warn" | "tip" | "danger";

const CONFIG: Record<CalloutType, { icon: string; bg: string; border: string; text: string }> = {
  info:   { icon: "ℹ", bg: "rgba(96,165,250,0.06)",  border: "rgba(96,165,250,0.3)",  text: "#60a5fa" },
  warn:   { icon: "⚠", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.3)",  text: "#fbbf24" },
  tip:    { icon: "✦", bg: "rgba(74,222,128,0.06)",   border: "rgba(74,222,128,0.3)",  text: "#4ade80" },
  danger: { icon: "✕", bg: "rgba(248,113,113,0.06)",  border: "rgba(248,113,113,0.3)", text: "#f87171" },
};

export default function Callout({ type = "info", children }: { type?: CalloutType; children: React.ReactNode }) {
  const c = CONFIG[type];
  return (
    <div
      className="flex gap-3.5 px-4 py-3.5 rounded my-5 text-sm leading-relaxed"
      style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }}
    >
      <span className="flex-shrink-0 mt-0.5 text-xs font-bold" style={{ color: c.text }}>{c.icon}</span>
      <div style={{ color: "var(--text-muted)" }}>{children}</div>
    </div>
  );
}
