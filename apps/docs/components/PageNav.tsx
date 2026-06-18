"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAGE_ORDER } from "@/lib/nav";

export default function PageNav() {
  const pathname = usePathname();
  const base     = pathname.split("#")[0];
  const idx      = PAGE_ORDER.findIndex(p => p.href === base);

  const prev = idx > 0               ? PAGE_ORDER[idx - 1] : null;
  const next = idx < PAGE_ORDER.length - 1 ? PAGE_ORDER[idx + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-16 pt-8 grid grid-cols-2 gap-4" style={{ borderTop: "1px solid var(--border)" }}>
      {/* Prev */}
      <div>
        {prev && (
          <Link
            href={prev.href}
            className="group flex flex-col gap-1.5 p-4 transition-colors rounded"
            style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
          >
            <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Previous
            </span>
            <span className="text-sm font-medium transition-colors" style={{ color: "var(--text)" }}>
              {prev.title}
            </span>
          </Link>
        )}
      </div>

      {/* Next */}
      <div className="flex justify-end">
        {next && (
          <Link
            href={next.href}
            className="group flex flex-col items-end gap-1.5 p-4 transition-colors rounded w-full"
            style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
          >
            <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              Next
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="text-sm font-medium transition-colors" style={{ color: "var(--text)" }}>
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
