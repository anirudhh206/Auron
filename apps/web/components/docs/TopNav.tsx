"use client";

export default function DocsTopNav() {
  return (
    <header
      className="fixed top-0 left-[260px] right-0 h-14 flex items-center justify-between px-8 z-10"
      style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-6">
        {[
          { label: "Docs",     href: "/docs/introduction"  },
          { label: "API",      href: "/docs/api-reference" },
          { label: "Examples", href: "/docs/examples"      },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-dim)", textDecoration: "none", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-muted)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            {label}
          </a>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            color: "var(--text-dim)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "4px 10px",
            borderRadius: 4,
          }}
        >
          v0.1.0
        </span>
        <a
          href="https://www.npmjs.com/package/@auron-solana/sdk"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: "#0A0A08",
            background: "var(--lime)",
            padding: "7px 16px",
            borderRadius: 6,
            textDecoration: "none",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--lime-dim)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--lime)")}
        >
          npm install →
        </a>
      </div>
    </header>
  );
}
