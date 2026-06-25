"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/docs-nav";

export default function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[260px] flex flex-col overflow-y-auto z-20"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 py-4 sticky top-0"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div
            className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "var(--lime)", color: "#0A0A08", borderRadius: "4px", fontFamily: "'Geist', sans-serif" }}
          >
            A
          </div>
          <div className="flex items-center gap-2.5">
            <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>
              AURON
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: "var(--lime-glow)",
                color: "var(--lime)",
                border: "1px solid var(--lime-border)",
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "0.06em",
              }}
            >
              DOCS
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-5">
        {NAV.map((section) => (
          <div key={section.section}>
            <p
              className="mb-1.5 px-2"
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {section.section}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const base   = item.href.split("#")[0];
                const active = pathname === base || pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center px-2 py-1.5 text-sm transition-colors"
                      style={{
                        fontFamily: "'Geist', sans-serif",
                        color:      active ? "var(--lime)"      : "var(--text-dim)",
                        background: active ? "var(--lime-glow)" : "transparent",
                        fontWeight: active ? 500 : 400,
                        borderLeft: active ? "2px solid var(--lime)" : "2px solid transparent",
                        borderRadius: "0 4px 4px 0",
                        textDecoration: "none",
                      }}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 space-y-2.5" style={{ borderTop: "1px solid var(--border)" }}>
        <a
          href="https://www.npmjs.com/package/@auron-solana/sdk"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "'Geist Mono', monospace", color: "var(--text-dim)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-muted)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
        >
          ↗ npm · @auron-solana/sdk
        </a>
        <a
          href="https://github.com/anirudhh206/auron"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "'Geist Mono', monospace", color: "var(--text-dim)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-muted)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
        >
          ↗ github · anirudhh206/auron
        </a>
      </div>
    </aside>
  );
}
