"use client";

/**
 * AuronLogo — reusable brand mark component.
 *
 * Usage:
 *   <AuronLogo size={32} />                  → just the A mark
 *   <AuronLogo size={32} showText />          → A mark + "AURON" wordmark
 *   <AuronLogo size={24} showText textSize={13} />  → custom text size
 */

interface AuronLogoProps {
  size?:     number;   // height of the mark in px (default 32)
  showText?: boolean;  // show "AURON" wordmark beside the mark
  textSize?: number;   // override wordmark font size
  className?: string;
}

export default function AuronLogo({
  size     = 32,
  showText = false,
  textSize,
  className,
}: AuronLogoProps) {
  const computedTextSize = textSize ?? Math.round(size * 0.44);

  return (
    <div
      className={className}
      style={{
        display:    "inline-flex",
        alignItems: "center",
        gap:        showText ? Math.round(size * 0.3) : 0,
        lineHeight: 1,
      }}
    >
      {/* ── A mark ─────────────────────────────────────────────────────── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Unique IDs per instance to avoid collisions when multiple logos exist on page */}
          <linearGradient id="auron-a-grad" x1="40%" y1="0%" x2="60%" y2="100%">
            <stop offset="0%"   stopColor="#a8c8ff"/>
            <stop offset="45%"  stopColor="#7b72f5"/>
            <stop offset="100%" stopColor="#4c3fd4"/>
          </linearGradient>
        </defs>

        {/* Left stroke of A */}
        <path
          d="M258,72 L88,448 L192,448 L268,258 Z"
          fill="url(#auron-a-grad)"
        />

        {/* Right diagonal slash — right leg + crossbar */}
        <path
          d="M385,188 L300,448 L384,448 L424,188 Z"
          fill="url(#auron-a-grad)"
        />
      </svg>

      {/* ── Wordmark ───────────────────────────────────────────────────── */}
      {showText && (
        <span
          style={{
            fontSize:      computedTextSize,
            fontWeight:    700,
            letterSpacing: "0.15em",
            color:         "#F0EEE8",
            fontFamily:    "var(--font-dm-sans, system-ui, sans-serif)",
            userSelect:    "none",
          }}
        >
          AURON
        </span>
      )}
    </div>
  );
}
