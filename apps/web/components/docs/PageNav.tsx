"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAGE_ORDER } from "@/lib/docs-nav";

export default function PageNav() {
  const pathname = usePathname();
  const base     = pathname.split("#")[0];
  const idx      = PAGE_ORDER.findIndex(p => p.href === base);
  const prev     = idx > 0                    ? PAGE_ORDER[idx - 1] : null;
  const next     = idx < PAGE_ORDER.length - 1 ? PAGE_ORDER[idx + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-16 pt-8 grid grid-cols-2 gap-4" style={{ borderTop: "1px solid var(--border)" }}>
      <div>
        {prev && (
          <Link
            href={prev.href}
            className="group flex flex-col gap-2 p-5 transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-bright)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              ← Previous
            </span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
              {prev.title}
            </span>
          </Link>
        )}
      </div>

      <div className="flex justify-end">
        {next && (
          <Link
            href={next.href}
            className="group flex flex-col items-end gap-2 p-5 transition-colors w-full"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--lime-border)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Next →
            </span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--lime)" }}>
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
