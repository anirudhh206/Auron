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
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚡</div>
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
