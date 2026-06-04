"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  merchant: string;
  upiId: string;
  inrAmount: number;
  usdcAmount: number;
  status: "completed" | "processing" | "failed";
  timestamp: string;
  initials: string;
}

interface DashboardScreenProps {
  user: SupabaseUser | null;
  address: string | null;
  isConnected: boolean;
  usdcBalance: number;
  fxRate: number;
  recentTransactions?: Transaction[];
  onScanQR: () => void;
  onTypePayment: () => void;
  onConnect: () => void;
  onQuickAction: (text: string) => void;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      "#08080A",
  s1:      "#0F0F12",
  s2:      "#161619",
  s3:      "#1C1C20",
  border:  "#26262A",
  borderB: "#3A3A3F",
  text:    "#F5F5F0",
  muted:   "#9A9AA8",
  dim:     "#606068",
  lime:    "#C8F135",
  gold:    "#F5A623",
  usdc:    "#2775CA",
  error:   "#EF4444",
};

const MOCK_TXS: Transaction[] = [
  { id:"1", merchant:"Blue Tokai Coffee",  upiId:"bluetokai@icici",  inrAmount:450,  usdcAmount:5.23,  status:"completed",  timestamp:"2:15 PM",    initials:"BT" },
  { id:"2", merchant:"Amazon India",       upiId:"amazon@axis",      inrAmount:1250, usdcAmount:14.44, status:"completed",  timestamp:"Yesterday",  initials:"AI" },
  { id:"3", merchant:"Swiggy",             upiId:"swiggy@hdfcbank",  inrAmount:342,  usdcAmount:3.98,  status:"processing", timestamp:"2d ago",     initials:"SW" },
];

const QUICK_ACTIONS = [
  { label: "Send",    emoji: "↑", text: "Send ₹500 to someone",           accent: C.usdc },
  { label: "Request", emoji: "↓", text: "Request ₹500 from someone",      accent: "#7C3AED" },
  { label: "Repeat",  emoji: "↻", text: "Repeat my last payment",         accent: "#0EA5E9" },
  { label: "Split",   emoji: "÷", text: "Split ₹1200 with 3 people",      accent: "#22C55E" },
];

const STATUS_COLOR: Record<string, string> = {
  completed:  C.lime,
  processing: C.gold,
  failed:     C.error,
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .auron-dash {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: ${C.bg};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }

  /* Dot grid bg */
  .auron-dash::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(circle, ${C.border} 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.25;
    pointer-events: none;
    z-index: 0;
  }

  /* USDC blue top glow */
  .auron-dash::after {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 280px;
    background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(39,117,202,0.09) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .dash-content {
    position: relative;
    z-index: 1;
    padding: 24px 20px 40px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    max-width: 390px;
    margin: 0 auto;
  }

  /* Rate ticker */
  .rate-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }
  .rate-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${C.lime};
    animation: pulseDot 2s ease-in-out infinite;
  }
  @keyframes pulseDot {
    0%,100% { opacity:1; }
    50% { opacity:0.3; }
  }

  /* Balance block */
  .balance-block {
    text-align: center;
    padding: 32px 20px 28px;
    position: relative;
  }
  .balance-usdc {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(52px, 14vw, 68px);
    font-weight: 400;
    color: ${C.text};
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .balance-usdc-label {
    font-family: 'Geist Mono', monospace;
    font-size: 15px;
    font-weight: 500;
    color: ${C.usdc};
    margin-left: 6px;
    vertical-align: middle;
  }
  .balance-inr {
    font-family: 'Geist Mono', monospace;
    font-size: 18px;
    color: ${C.gold};
    margin-top: 8px;
  }
  .balance-sol {
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.dim};
    margin-top: 6px;
  }

  /* Action buttons */
  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .action-btn {
    border: none;
    cursor: pointer;
    border-radius: 14px;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    transition: transform 0.15s, opacity 0.15s;
  }
  .action-btn:active { transform: scale(0.97); }
  .action-btn-primary {
    background: ${C.usdc};
    box-shadow: 0 8px 28px rgba(39,117,202,0.35);
  }
  .action-btn-secondary {
    background: ${C.s1};
    border: 1px solid ${C.border};
  }
  .action-icon {
    width: 44px; height: 44px;
    border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
  }

  /* Quick actions */
  .quick-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 8px;
  }
  .quick-btn {
    display: flex; flex-direction: column;
    align-items: center; gap: 8px;
    padding: 12px 4px;
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .quick-btn:hover { border-color: ${C.borderB}; }
  .quick-btn:active { transform: scale(0.96); }
  .quick-emoji {
    width: 40px; height: 40px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  }

  /* Section header */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .section-title {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .section-link {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.muted};
    background: none;
    border: none;
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: color 0.15s;
  }
  .section-link:hover { color: ${C.text}; }

  /* Transaction rows */
  .tx-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 0.5px solid ${C.border};
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .tx-row:last-child { border-bottom: none; }
  .tx-row:active { opacity: 0.7; }
  .tx-avatar {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    font-family: 'Geist', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: ${C.muted};
    flex-shrink: 0;
  }
  .tx-completed { border-left: 2px solid ${C.lime}; }

  /* Connect wallet prompt */
  .connect-prompt {
    padding: 18px;
    border-radius: 12px;
    background: rgba(39,117,202,0.06);
    border: 1px solid rgba(39,117,202,0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .connect-btn {
    padding: 9px 18px;
    border-radius: 8px;
    background: ${C.usdc};
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s;
    box-shadow: 0 4px 12px rgba(39,117,202,0.35);
  }
  .connect-btn:hover { opacity: 0.9; }
`;

// ─── Component ─────────────────────────────────────────────────────────────────
export default function DashboardScreen({
  user,
  address,
  isConnected,
  usdcBalance,
  fxRate = 83.18,
  recentTransactions,
  onScanQR,
  onTypePayment,
  onConnect,
  onQuickAction,
}: DashboardScreenProps) {
  const txs = recentTransactions ?? MOCK_TXS;
  const inrEquiv = (usdcBalance * fxRate).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const displayName =
    user?.user_metadata?.full_name?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "there";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [rateAge, setRateAge] = useState(12);
  useEffect(() => {
    const t = setInterval(() => setRateAge(a => a + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay },
  });

  return (
    <>
      <style>{STYLES}</style>
      <div className="auron-dash">
        <div className="dash-content">

          <motion.div {...fadeUp(0)} className="rate-bar">
            <span className="rate-dot" />
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim }}>
              1 USDC = ₹{fxRate.toFixed(2)}
            </span>
            <span style={{ color: C.borderB, fontSize: 11 }}>·</span>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim }}>
              {rateAge}s ago
            </span>
          </motion.div>

          <motion.div {...fadeUp(0.04)}>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, letterSpacing: "0.08em", marginBottom: 6 }}>
              {greeting.toUpperCase()}, {displayName.toUpperCase()}
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.08)} className="balance-block">
            <div>
              <span className="balance-usdc">
                {isConnected ? usdcBalance.toFixed(2) : "—"}
              </span>
              <span className="balance-usdc-label">USDC</span>
            </div>
            <div className="balance-inr">
              ≈ ₹{isConnected ? inrEquiv : "—"}
            </div>
            <div className="balance-sol">
              {address ? `0.024 SOL for fees` : "Connect wallet to view balance"}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.12)} className="action-grid">
            <button className="action-btn action-btn-primary" onClick={onScanQR}>
              <div className="action-icon" style={{ background: "rgba(255,255,255,0.15)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/>
                  <path d="M17 14h4"/><path d="M14 17v4"/><path d="M17 21h4v-4"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Scan QR</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "2px 0 0" }}>Pay any UPI merchant</p>
              </div>
            </button>

            <button className="action-btn action-btn-secondary" onClick={onTypePayment}>
              <div className="action-icon" style={{ background: C.s2, border: `1px solid ${C.border}` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Type</p>
                <p style={{ fontSize: 11, color: C.dim, margin: "2px 0 0" }}>Natural language</p>
              </div>
            </button>
          </motion.div>

          <motion.div {...fadeUp(0.16)}>
            <div className="section-header">
              <span className="section-title">Quick Actions</span>
              <button className="section-link">See all →</button>
            </div>
            <div className="quick-grid">
              {QUICK_ACTIONS.map(({ label, emoji, text, accent }, i) => (
                <motion.button
                  key={label}
                  className="quick-btn"
                  onClick={() => onQuickAction(text)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + i * 0.04, duration: 0.4 }}
                >
                  <div className="quick-emoji" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
                    <span style={{ fontSize: 16, color: accent }}>{emoji}</span>
                  </div>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.muted, letterSpacing: "0.06em" }}>
                    {label.toUpperCase()}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.22)}>
            <div className="section-header">
              <span className="section-title">Recent</span>
              <button className="section-link">See all →</button>
            </div>
            <div>
              {txs.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  className={`tx-row${tx.status === "completed" ? " tx-completed" : ""}`}
                  style={{ paddingLeft: tx.status === "completed" ? 10 : 0 }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.24 + i * 0.06, duration: 0.4 }}
                >
                  <div className="tx-avatar">{tx.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.merchant}
                    </p>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "2px 0 0" }}>
                      {tx.upiId}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, fontWeight: 500, color: C.gold, margin: 0 }}>
                      ₹{tx.inrAmount.toLocaleString("en-IN")}
                    </p>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: STATUS_COLOR[tx.status] ?? C.dim, margin: "3px 0 0", letterSpacing: "0.06em" }}>
                      {tx.status.toUpperCase()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {!isConnected && (
            <motion.div {...fadeUp(0.28)} className="connect-prompt">
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>Connect Phantom Wallet</p>
                <p style={{ fontSize: 11, color: C.dim, margin: "3px 0 0" }}>Required to send payments</p>
              </div>
              <button className="connect-btn" onClick={onConnect}>Connect</button>
            </motion.div>
          )}

        </div>
      </div>
    </>
  );
}
