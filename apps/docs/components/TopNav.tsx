export default function TopNav() {
  return (
    <header
      className="fixed top-0 left-[260px] right-0 h-14 flex items-center justify-between px-8 z-10"
      style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-6 text-sm" style={{ color: "var(--text-muted)" }}>
        {[
          { label: "Docs",     href: "/docs/introduction"  },
          { label: "API",      href: "/docs/api-reference" },
          { label: "Examples", href: "/docs/examples"      },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="transition-colors hover:text-[var(--text)]"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span
          className="text-xs px-2 py-1 rounded font-mono"
          style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          v0.1.0
        </span>
        <a
          href="https://www.npmjs.com/package/@auron-solana/sdk"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium px-3.5 py-1.5 rounded transition-colors"
          style={{ background: "var(--accent)", color: "#fff" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#6a57f0")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
        >
          npm install →
        </a>
      </div>
    </header>
  );
}
