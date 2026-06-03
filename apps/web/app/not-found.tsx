import Link from "next/link";

// Custom 404 — statically rendered, no Solana imports, no client hooks

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#030712",
        color: "white",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "1rem",
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
          <svg width="72" height="72" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="nf-grad" x1="40%" y1="0%" x2="60%" y2="100%">
                <stop offset="0%"   stopColor="#a8c8ff"/>
                <stop offset="45%"  stopColor="#7b72f5"/>
                <stop offset="100%" stopColor="#4c3fd4"/>
              </linearGradient>
            </defs>
            <path d="M258,72 L88,448 L192,448 L268,258 Z" fill="url(#nf-grad)"/>
            <path d="M385,188 L300,448 L384,448 L424,188 Z" fill="url(#nf-grad)"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Page not found
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          The page you&apos;re looking for doesn&apos;t exist. Head back to Auron.
        </p>
        <Link
          href="/app"
          style={{
            display: "inline-block",
            background: "#7c3aed",
            color: "white",
            borderRadius: 12,
            padding: "12px 28px",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Go to Auron
        </Link>
      </div>
    </div>
  );
}
