"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[260px] flex flex-col overflow-y-auto z-20"
      style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 py-4 sticky top-0"
        style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #7c6af7 0%, #4f46e5 100%)",
            color: "#fff",
            borderRadius: "6px",
          }}
        >
          A
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: "var(--text)", letterSpacing: "0.05em" }}>
            Auron
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", letterSpacing: "0.04em" }}
          >
            Docs
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-5">
        {NAV.map((section) => (
          <div key={section.section}>
            <p
              className="text-[10px] uppercase font-semibold mb-1.5 px-2"
              style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}
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
                      className="flex items-center px-2 py-1.5 text-sm rounded transition-colors"
                      style={{
                        color:      active ? "var(--accent)"    : "var(--text-muted)",
                        background: active ? "var(--accent-muted)" : "transparent",
                        fontWeight: active ? 500 : 400,
                        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
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
      <div className="px-5 py-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        <a
          href="https://www.npmjs.com/package/@auron-solana/sdk"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs flex items-center gap-1.5 transition-colors"
          style={{ color: "var(--text-subtle)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-muted)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-subtle)")}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
            <rect width="11" height="11" rx="2"/>
            <rect x="2.5" y="2.5" width="2" height="6" fill="var(--bg-sidebar)"/>
            <rect x="6.5" y="2.5" width="2" height="4" fill="var(--bg-sidebar)"/>
          </svg>
          @auron-solana/sdk
        </a>
        <a
          href="https://github.com/anirudhh206/auron"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs flex items-center gap-1.5 transition-colors"
          style={{ color: "var(--text-subtle)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-muted)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-subtle)")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          GitHub
        </a>
      </div>
    </aside>
  );
}
