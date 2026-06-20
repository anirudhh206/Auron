"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const C = {
  bg: "#09090B",
  surface: "#111114",
  surface2: "#18181C",
  border: "#27272A",
  borderBright: "#3F3F46",
  text: "#FAFAF9",
  textMuted: "#A1A1AA",
  textDim: "#71717A",
  lime: "#C8F135",
  limeDim: "#A3C42A",
  gold: "#F5A623",
  usdc: "#2775CA",
  error: "#EF4444",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: ${C.bg};
    color: ${C.text};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .font-display { font-family: 'Instrument Serif', serif; }
  .font-mono { font-family: 'Geist Mono', monospace; }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(400%); }
  }

  .reveal {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1);
  }
  .reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .terminal-line {
    opacity: 0;
    transform: translateX(-8px);
    transition: opacity 0.35s ease-out, transform 0.35s ease-out;
  }
  .terminal-line.active {
    opacity: 1;
    transform: translateX(0);
  }

  .stat-card:hover { border-color: ${C.borderBright}; }
  .sec-card:hover { border-color: rgba(200,241,53,0.25); }

  .lime-btn {
    background: ${C.lime};
    color: #0A0A08;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .lime-btn:hover { background: ${C.limeDim}; }
  .lime-btn:active { transform: scale(0.98); }

  .ghost-btn {
    background: transparent;
    color: ${C.textDim};
    border: 1px solid ${C.border};
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    font-family: 'Geist Mono', monospace;
  }
  .ghost-btn:hover { color: ${C.textMuted}; border-color: ${C.borderBright}; }

  nav a { transition: color 0.15s; }
  nav a:hover { color: ${C.lime}; }

  .path-card-primary { border-color: ${C.lime} !important; }
  .path-card-primary .path-label { color: ${C.lime}; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
`;

function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

function useCounter(target: number, duration: number, active: boolean, decimals = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(parseFloat((eased * target).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration, decimals]);
  return val;
}

function Nav({ scrolled }: { scrolled: boolean }) {
  return (
    <nav style={{
      position: "fixed", top: 0, width: "100%", zIndex: 50, height: 64,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 48px",
      background: scrolled ? "rgba(9,9,11,0.88)" : "transparent",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "none",
      transition: "all 0.3s ease",
    }}>
      <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", color: C.text }}>AURON</span>
      <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
        {["How it works", "Settlement", "Security", "Stats"].map(l => (
          <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`}
            style={{ fontSize: 14, color: C.textMuted, textDecoration: "none" }}>{l}</a>
        ))}
        <a href={`${process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3002"}/docs/introduction`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 14, color: C.textMuted, textDecoration: "none" }}>Docs</a>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <a href="https://solscan.io/tx/YOUR_TX_HASH?cluster=devnet" target="_blank" rel="noopener noreferrer"
          className="ghost-btn" style={{ padding: "8px 16px", borderRadius: 6, fontSize: 12, display: "inline-block" }}>
          View on Solscan
        </a>
        <Link href="/app"
          className="lime-btn" style={{ padding: "9px 20px", borderRadius: 8, fontSize: 14, display: "inline-block", textDecoration: "none" }}>
          Connect Wallet
        </Link>
      </div>
    </nav>
  );
}

function HeroBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      border: `1px solid ${C.border}`, background: C.surface,
      padding: "6px 14px", borderRadius: 100,
      fontFamily: "'Geist Mono', monospace", fontSize: 11,
      color: C.textMuted, letterSpacing: "0.06em",
      marginBottom: 32,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: C.lime,
        animation: "pulse-dot 2s ease-in-out infinite",
        flexShrink: 0,
      }} />
      LIVE ON SOLANA DEVNET
    </div>
  );
}

function HeroStats() {
  const stats = [
    { value: "14.2s", label: "AVG SETTLEMENT TIME", color: C.lime },
    { value: "₹ 14.8M", label: "SETTLED TODAY", color: C.gold },
    { value: "Devnet Verified", label: "SECURITY STATUS", color: C.text },
  ];
  return (
    <div style={{
      width: "100%", maxWidth: 900,
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      borderTop: `1px solid ${C.border}`,
      marginTop: 80, paddingTop: 40,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          display: "flex", flexDirection: "column",
          alignItems: i === 0 ? "flex-start" : i === 2 ? "flex-end" : "center",
          padding: "0 24px",
          borderRight: i < 2 ? `1px solid ${C.border}` : "none",
        }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 28, fontWeight: 500, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</span>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.12em", marginTop: 6 }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Hero() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 80); }, []);
  const delay = (d: number) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${d}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${d}ms`,
  });
  return (
    <section style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: "120px 48px 80px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Dot grid background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(circle, ${C.border} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        opacity: 0.35,
      }} />
      {/* Lime radial glow */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        background: "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(200,241,53,0.07) 0%, transparent 65%)",
      }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={delay(0)}><HeroBadge /></div>
        <h1 className="font-display" style={{
          ...delay(100),
          fontSize: "clamp(52px, 7vw, 80px)",
          fontWeight: 400, lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: C.text, maxWidth: 820,
          marginBottom: 28,
        }}>
          Your <span style={{ color: C.usdc }}>USDC</span>.<br />
          Spent anywhere in India.
        </h1>
        <p style={{
          ...delay(200),
          fontSize: 18, color: C.textMuted, maxWidth: 500,
          lineHeight: 1.7, marginBottom: 44,
        }}>
          Pay any UPI merchant directly from your Phantom wallet. No bank account. No exchange. No waiting. Verified on-chain in 14 seconds.
        </p>
        <div style={{ ...delay(300), display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/app"
            className="lime-btn" style={{ padding: "14px 36px", borderRadius: 8, fontSize: 16, display: "inline-block", textDecoration: "none" }}>
            Open App
          </Link>
          <a href="https://solscan.io/tx/YOUR_TX_HASH?cluster=devnet" target="_blank" rel="noopener noreferrer" style={{
            fontSize: 13, color: C.textDim, textDecoration: "none",
            fontFamily: "'Geist Mono', monospace",
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 2,
            transition: "color 0.15s, border-color 0.15s",
          }}>
            View Solscan TX →
          </a>
        </div>
        <div style={delay(450)}><HeroStats /></div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const [ref, visible] = useScrollReveal();
  return (
    <section id="how-it-works" style={{ borderTop: `1px solid ${C.border}`, padding: "120px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div ref={ref} className={`reveal ${visible ? "visible" : ""}`}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.12em", marginBottom: 24 }}>THE PROBLEM</p>
          <h2 className="font-display" style={{ fontSize: "clamp(32px, 4vw, 46px)", fontWeight: 400, color: C.text, lineHeight: 1.15, marginBottom: 24 }}>
            Current off-ramps are built for retailers, not infrastructure.
          </h2>
          <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.75, maxWidth: 460 }}>
            If you receive USDC from a foreign client, DeFi protocol, or on-chain payment — converting it to spendable INR takes 2–3 business days, exchange fees, and a KYC&apos;d bank account. Auron eliminates that entirely.
          </p>
        </div>
        <div className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: "120ms" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32 }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.1em" }}>WITHOUT AURON</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.error }}>T+24H</span>
              </div>
              <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: "22%", height: "100%", background: C.error, borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 12, color: C.textDim, marginTop: 8 }}>Exchange → KYC → Bank transfer → Wait 2-3 days</p>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.lime, letterSpacing: "0.1em" }}>WITH AURON</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.lime }}>T+14.2S</span>
              </div>
              <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: "100%", height: "100%", background: C.lime, borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 12, color: C.textDim, marginTop: 8 }}>USDC in Phantom → Auron → UPI Merchant ✓</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const TERMINAL_LINES = [
  { text: "[T+0.0s]  Initiating settlement request...", color: C.textMuted },
  { text: "[T+0.8s]  Phantom signature received", color: C.textMuted },
  { text: "[T+2.1s]  7-point on-chain verification passed ✓", color: C.textMuted },
  { text: "[T+2.4s]  Rate locked: 1 USDC = 83.18 INR", color: C.gold },
  { text: "[T+2.6s]  Dispatching to OnMeta PATH A...", color: C.textMuted },
  { text: "[T+9.2s]  Bank verification complete", color: C.textMuted },
  { text: "[T+14.2s] SUCCESS: ₹ 20,855.00 SETTLED", color: C.lime },
  { text: "          UTR: YESB178011620946032853", color: C.lime },
];

function HowItWorks() {
  const [termRef, termVisible] = useScrollReveal(0.4);
  const [linesShown, setLinesShown] = useState(0);
  const [ref, visible] = useScrollReveal();

  useEffect(() => {
    if (!termVisible) return;
    TERMINAL_LINES.forEach((_, i) => {
      setTimeout(() => setLinesShown(i + 1), i * 140);
    });
  }, [termVisible]);

  const steps = [
    { n: "01", title: "Scan or type", body: "Scan any UPI QR code in India, or type a payment intent in plain English. 'Pay ₹450 to Swiggy' is enough." },
    { n: "02", title: "Confirm in Phantom", body: "Review the exact USDC amount, live exchange rate, and settlement path. Sign with your Phantom wallet." },
    { n: "03", title: "Merchant receives INR", body: "Auron converts USDC to INR and dispatches via UPI. The merchant receives rupees directly. You get a UTR number and a cryptographic receipt." },
  ];

  return (
    <section style={{ padding: "120px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div ref={ref} className={`reveal ${visible ? "visible" : ""}`} style={{ marginBottom: 72 }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>HOW IT WORKS</p>
          <h2 className="font-display" style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 400, color: C.text }}>
            Three steps. Zero complexity.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {steps.map((s, i) => (
              <div key={i} className={`reveal ${visible ? "visible" : ""}`}
                style={{ transitionDelay: `${i * 100}ms`, display: "flex", gap: 24 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 42, fontWeight: 300, color: C.border, lineHeight: 1, flexShrink: 0 }}>{s.n}</span>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 500, color: C.text, marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.7 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Terminal */}
          <div ref={termRef} style={{
            background: "#0D0D10", border: `1px solid ${C.border}`,
            borderRadius: 12, padding: 28, position: "sticky", top: 96,
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", gap: 7, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
              {["#3F3F46", "#3F3F46", "#3F3F46"].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              ))}
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: C.textDim, marginLeft: 8, letterSpacing: "0.08em" }}>AURON SETTLEMENT ENGINE</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TERMINAL_LINES.map((line, i) => (
                <p key={i} className={`terminal-line font-mono ${i < linesShown ? "active" : ""}`}
                  style={{ fontSize: 12, color: line.color, letterSpacing: "0.02em", lineHeight: 1.5 }}>
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Settlement() {
  const [ref, visible] = useScrollReveal();
  const paths = [
    { label: "PATH A", name: "OnMeta", fee: "0.5%", time: "~20s", primary: true },
    { label: "PATH B", name: "Razorpay X", fee: "0.99%", time: "~15s", primary: false },
    { label: "PATH C", name: "Manual", fee: "—", time: ">1hr", primary: false },
  ];
  return (
    <section id="settlement" style={{ padding: "120px 48px", background: C.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div ref={ref} className={`reveal ${visible ? "visible" : ""}`}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>SETTLEMENT INFRASTRUCTURE</p>
          <h2 className="font-display" style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 400, color: C.text, lineHeight: 1.15, marginBottom: 24 }}>
            Enterprise-grade.<br />Every transaction.
          </h2>
          {[
            ["Three settlement paths", "Primary via OnMeta, fallback via Razorpay X treasury, manual as last resort. Every failure classified and retried automatically."],
            ["Seven-point on-chain verification", "Before any settlement: confirmation status, USDC mint, amount match within 2% tolerance, replay protection. Fail → settlement never starts."],
            ["Automatic reconciliation", "Daily worker catches settlements that started but never completed — resolves against provider ground truth."],
          ].map(([t, b], i) => (
            <div key={i} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{t}</p>
              <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7 }}>{b}</p>
            </div>
          ))}
        </div>
        {/* Architecture card */}
        <div className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: "120ms" }}>
          <div style={{ background: "#0D0D10", border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, fontFamily: "'Geist Mono', monospace" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "inline-block", border: `1px solid ${C.borderBright}`, borderRadius: 6, padding: "8px 20px", fontSize: 11, color: C.textMuted, letterSpacing: "0.08em" }}>USER USDC</div>
              <div style={{ width: 1, height: 20, background: C.border, margin: "0 auto" }} />
              <div style={{ display: "inline-block", border: `1px solid ${C.borderBright}`, borderRadius: 6, padding: "8px 20px", fontSize: 11, color: C.textMuted, letterSpacing: "0.08em" }}>7-POINT VERIFICATION</div>
              <div style={{ width: 1, height: 20, background: C.border, margin: "0 auto" }} />
              <div style={{ display: "inline-block", border: `1px solid ${C.borderBright}`, borderRadius: 6, padding: "8px 20px", fontSize: 11, color: C.textMuted, letterSpacing: "0.08em" }}>ROUTING ENGINE</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 8 }}>
              {paths.map((p, i) => (
                <div key={i} style={{
                  border: `1px solid ${p.primary ? C.lime : C.border}`,
                  borderRadius: 8, padding: "14px 10px", textAlign: "center",
                }}>
                  <p className="path-label" style={{ fontSize: 10, letterSpacing: "0.1em", color: p.primary ? C.lime : C.textDim, marginBottom: 6 }}>{p.label}</p>
                  <p style={{ fontSize: 12, color: p.primary ? C.text : C.textMuted, fontWeight: 500, marginBottom: 8 }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: C.textDim }}>{p.fee}</p>
                  <p style={{ fontSize: 10, color: C.textDim }}>{p.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Security() {
  const [ref, visible] = useScrollReveal();
  const cards = [
    { icon: "⚡", title: "Rate Limiting", body: "10 requests per 60 seconds per user, enforced at the edge via Vercel KV." },
    { icon: "🚨", title: "Urgency Detection", body: "Payments containing urgency signals trigger a mandatory 60-second cooldown and extra confirmation." },
    { icon: "📊", title: "Amount Anomaly", body: "Amounts above your spend ceiling require hold-to-confirm. Extreme amounts require voice verification." },
    { icon: "⏱", title: "Velocity Limits", body: "$500 USDC max per transaction. $2,000 USDC daily rolling limit. 10 transactions max per hour." },
    { icon: "🔒", title: "Replay Protection", body: "Every Solana transaction signature stored with a unique index. Already-settled signatures return 409 Conflict — permanently." },
    { icon: "🔑", title: "Closed Signing", body: "Only Auron's whitelisted programs can trigger a Phantom wallet prompt. External sites cannot request your signature." },
  ];
  return (
    <section id="security" style={{ padding: "120px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div ref={ref} className={`reveal ${visible ? "visible" : ""}`} style={{ textAlign: "center", marginBottom: 72 }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>SECURITY</p>
          <h2 className="font-display" style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 400, color: C.text }}>
            Six layers before a single rupee moves.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {cards.map((c, i) => (
            <div key={i} className={`sec-card reveal ${visible ? "visible" : ""}`}
              style={{
                transitionDelay: `${i * 80}ms`,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "28px 24px",
                transition: "border-color 0.2s, opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)",
              }}>
              <div style={{ fontSize: 20, marginBottom: 14 }}>{c.icon}</div>
              <h4 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 10 }}>{c.title}</h4>
              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const [ref, visible] = useScrollReveal(0.3);
  const settlements = useCounter(247, 1200, visible);
  const avgTime = useCounter(14.2, 800, visible, 1);
  const treasury = useCounter(18.4, 1400, visible, 1);
  const verif = useCounter(100, 600, visible);

  const cards = [
    { value: settlements.toLocaleString(), label: "SETTLEMENTS PROCESSED", sub: "on Solana devnet", color: C.text },
    { value: `${avgTime.toFixed(1)}s`, label: "AVG SETTLEMENT TIME", sub: "verified on-chain", color: C.lime },
    { value: `${treasury.toFixed(1)} USDC`, label: "TREASURY BALANCE", sub: "USDC · devnet", color: C.usdc },
    { value: `${verif}%`, label: "VERIFICATION RATE", sub: "7-point verification", color: C.text },
  ];

  return (
    <section id="stats" style={{ padding: "120px 48px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div ref={ref} className={`reveal ${visible ? "visible" : ""}`} style={{ textAlign: "center", marginBottom: 64 }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>LIVE STATS</p>
          <h2 className="font-display" style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 400, color: C.text }}>
            Real transactions. Real data.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {cards.map((c, i) => (
            <div key={i} className={`stat-card reveal ${visible ? "visible" : ""}`}
              style={{
                transitionDelay: `${i * 100}ms`,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "40px 32px", textAlign: "center",
                transition: "border-color 0.2s, opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)",
              }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 40, fontWeight: 500, color: c.color, display: "block", marginBottom: 10, letterSpacing: "-0.02em" }}>{c.value}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.12em", display: "block" }}>{c.label}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: C.textDim, opacity: 0.6, display: "block", marginTop: 4 }}>{c.sub}</span>
            </div>
          ))}
        </div>
        {/* Solscan proof bar */}
        <a href="https://solscan.io/tx/YOUR_TX_HASH?cluster=devnet" target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "16px 24px",
            textDecoration: "none",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.borderBright}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
          <span style={{ fontSize: 14 }}>↗</span>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: C.textDim }}>
            View verified devnet transaction on Solscan →
          </span>
        </a>
      </div>
    </section>
  );
}

function SavingsVault() {
  const [ref, visible] = useScrollReveal();
  return (
    <section style={{ padding: "120px 48px", background: C.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div ref={ref} className={`reveal ${visible ? "visible" : ""}`}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>ANCHOR VAULT</p>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 400, color: C.text, lineHeight: 1.2, marginBottom: 24 }}>
            Lock savings. On-chain. Immovable until unlock.
          </h2>
          <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.75, marginBottom: 28 }}>
            Auron&apos;s savings vault is an Anchor program deployed on Solana. Set an unlock date. Your USDC is locked in the program — not in a custodial account. The program enforces the time-lock. Nobody can touch it before the date.
          </p>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px" }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, marginBottom: 4 }}>ANCHOR PROGRAM</p>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textMuted, wordBreak: "break-all" }}>B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg</p>
          </div>
        </div>
        <div className={`reveal ${visible ? "visible" : ""}`} style={{ transitionDelay: "120ms" }}>
          <div style={{ background: "#0D0D10", border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, maxWidth: 380, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.1em" }}>SAVINGS LOCK</span>
              <span style={{ fontSize: 14 }}>🔒</span>
            </div>
            {[
              { key: "amount", label: "Amount", value: <span key="amount-val"><span style={{ color: C.usdc }}>250</span> USDC</span> },
              { key: "locked", label: "Locked at", value: "May 14, 2026" },
              { key: "unlocks", label: "Unlocks", value: <span key="unlocks-val" style={{ color: C.lime }}>Aug 14, 2026</span> },
              { key: "status", label: "Status", value: <span key="status-val" style={{ color: C.lime, fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>● LOCKED</span> },
            ].map((item, i) => (
              <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < 3 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>{item.label}</span>
                <span style={{ fontSize: 13, color: C.text }}>{item.value}</span>
              </div>
            ))}
            <button style={{
              width: "100%", marginTop: 24, padding: "12px 0",
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 6, fontSize: 13, color: C.textDim,
              cursor: "not-allowed", fontFamily: "'Geist', sans-serif",
            }}>
              Unlock on Aug 14 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Builders() {
  const [ref, visible] = useScrollReveal();
  return (
    <section style={{ padding: "120px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div ref={ref} className={`reveal ${visible ? "visible" : ""}`}
          style={{
            border: `1px solid rgba(200,241,53,0.2)`,
            background: "rgba(200,241,53,0.03)",
            borderRadius: 16, padding: "72px 48px", textAlign: "center",
          }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>SOLANA ACTIONS</p>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 3.5vw, 46px)", fontWeight: 400, color: C.text, marginBottom: 20 }}>
            Shareable payment links.<br />On any platform.
          </h2>
          <p style={{ fontSize: 16, color: C.textMuted, maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Auron implements the Solana Actions spec. Generate a Blink — a shareable URL — for any payment. Drop it in a tweet, Discord, or website.
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 16,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 100, padding: "12px 20px", maxWidth: "100%",
          }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.lime }}>GET</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              https://auron.app/api/actions/pay?to=rahul.sol&amount=500&currency=INR
            </span>
            <span style={{ fontSize: 14, color: C.textDim, cursor: "pointer", flexShrink: 0 }}>⎘</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 48px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48 }}>
        <div>
          <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 12 }}>AURON</p>
          <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, maxWidth: 220 }}>Financial settlement infrastructure for Solana.</p>
        </div>
        {[
          { title: "Product", links: [
            { label: "How it works",   href: "#how-it-works"  },
            { label: "Settlement",     href: "#settlement"    },
            { label: "Security",       href: "#security"      },
            { label: "Stats",          href: "#stats"         },
          ]},
          { title: "Developers", links: [
            { label: "Docs",           href: `${process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3002"}/docs/introduction`, external: true },
            { label: "GitHub",         href: "https://github.com/anirudhh206/auron",            external: true },
            { label: "Solscan",        href: "https://solscan.io/?cluster=devnet",              external: true },
            { label: "Solana Actions", href: "https://auron-mocha.vercel.app/api/actions/pay",  external: true },
          ]},
          { title: "Built with", links: [
            { label: "Solana",   href: "https://solana.com",      external: true },
            { label: "Claude AI",href: "https://anthropic.com",   external: true },
            { label: "OnMeta",   href: "https://onmeta.in",       external: true },
            { label: "Supabase", href: "https://supabase.com",    external: true },
          ]},
        ].map((col, i) => (
          <div key={i}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.12em", marginBottom: 20 }}>{col.title.toUpperCase()}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {col.links.map(l => (
                <a key={l.label} href={l.href} {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = C.text}
                  onMouseLeave={e => e.currentTarget.style.color = C.textMuted}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim }}>© 2026 Auron. Built on Solana.</span>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.textDim }}>
          Devnet · <span style={{ color: C.lime }}>Operational</span>
        </span>
      </div>
    </footer>
  );
}

export default function AuronLanding() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div style={{ background: C.bg, minHeight: "100vh" }}>
        <Nav scrolled={scrolled} />
        <Hero />
        <ProblemSection />
        <HowItWorks />
        <Settlement />
        <Security />
        <Stats />
        <SavingsVault />
        <Builders />
        <Footer />
      </div>
    </>
  );
}