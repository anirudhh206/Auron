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
  logoUrl?: string;
}

interface DashboardScreenProps {
  address: string | null;
  isConnected: boolean;
  usdcBalance: number;
  fxRate?: number;
  recentTransactions?: Transaction[];
  onScanQR: () => void;
  onTypePayment: () => void;
  onConnect: () => void;
}

// No mock data — show real transactions only (or empty state)

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap');

  .dash-root {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: #08080A;
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }

  .dash-dot-grid {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0);
    background-size: 16px 16px;
  }

  .dash-glow {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: radial-gradient(ellipse 60% 35% at 50% 0%, rgba(39,117,202,0.12) 0%, transparent 80%);
  }

  .dash-noise {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    opacity: 0.03;
    background-image: url("https://www.transparenttextures.com/patterns/stardust.png");
  }

  .dash-content {
    position: relative;
    z-index: 2;
    padding: 0 20px 96px;
    max-width: 390px;
    margin: 0 auto;
  }

  /* ── Balance ── */
  .dash-balance {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 32px 0 28px;
  }

  .dash-balance-number {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .dash-balance-main {
    font-family: 'Instrument Serif', serif;
    font-size: 64px;
    line-height: 1;
    color: #ffffff;
    letter-spacing: -0.02em;
    font-weight: 400;
  }

  .dash-balance-usdc {
    font-family: 'Geist Mono', monospace;
    font-size: 16px;
    font-weight: 600;
    color: #2775CA;
  }

  .dash-balance-inr {
    font-family: 'Geist Mono', monospace;
    font-size: 18px;
    color: #F5A623;
    margin-top: 8px;
  }

  .dash-balance-sol {
    font-family: 'Geist Mono', monospace;
    font-size: 12px;
    color: #606068;
    margin-top: 4px;
  }

  /* ── Action buttons — circular ── */
  .dash-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 32px;
  }

  .dash-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .dash-action-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 1px solid #26262A;
    background: #0F0F12;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background 0.15s;
  }

  .dash-action-btn:hover .dash-action-circle {
    border-color: #C8F135;
    background: rgba(200,241,53,0.05);
  }

  .dash-action-btn:active .dash-action-circle {
    transform: scale(0.95);
  }

  .dash-action-label {
    font-family: 'Geist', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #9A9AA8;
    text-transform: uppercase;
  }

  /* ── Section label ── */
  .dash-section-label {
    font-family: 'Geist', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #9A9AA8;
    opacity: 0.5;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  /* ── Transaction glass cards ── */
  .dash-tx-card {
    background: rgba(18, 20, 9, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(143, 147, 123, 0.2);
    border-radius: 4px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    transition: transform 0.15s;
  }

  .dash-tx-card:active { transform: scale(0.98); }

  .dash-tx-card-completed { border-left: 2px solid #C8F135; }

  .dash-tx-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .dash-tx-avatar {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #1C1C20;
    border: 1px solid #26262A;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: #9A9AA8;
    flex-shrink: 0;
    overflow: hidden;
  }

  .dash-tx-name {
    font-size: 16px;
    font-weight: 500;
    color: #ffffff;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dash-tx-upi {
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: #9A9AA8;
    opacity: 0.6;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dash-tx-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .dash-tx-amount {
    font-family: 'Geist Mono', monospace;
    font-size: 16px;
    font-weight: 500;
    color: #F5A623;
    margin: 0;
  }

  .dash-tx-status-completed {
    font-family: 'Geist', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #C8F135;
  }

  .dash-tx-status-processing {
    font-family: 'Geist', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #9A9AA8;
  }

  /* ── Rate ticker ── */
  .dash-rate {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    padding: 8px 0 4px;
  }

  .dash-rate-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #C8F135;
    animation: ratePulse 2s ease-in-out infinite;
  }

  @keyframes ratePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ── Connect wallet prompt ── */
  .dash-connect {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
    border-radius: 12px;
    background: rgba(39,117,202,0.06);
    border: 1px solid rgba(39,117,202,0.2);
    margin-bottom: 24px;
  }

  .dash-connect-btn {
    padding: 9px 18px;
    border-radius: 8px;
    background: #C8F135;
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #0A0A08;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .dash-connect-btn:hover { background: #A3C42A; }
`;

function QRIcon({ color = "#9A9AA8", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <path d="M14 14h3v3h-3z"/>
      <path d="M17 14h4"/><path d="M14 17v4"/><path d="M17 21h4v-4"/>
    </svg>
  );
}

function ChatIcon({ color = "#9A9AA8", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardScreen({
  address,
  isConnected,
  usdcBalance,
  fxRate = 83.18,
  recentTransactions,
  onScanQR,
  onTypePayment,
  onConnect,
}: DashboardScreenProps) {
  const txs = recentTransactions ?? [];
  const inrEquiv = (usdcBalance * fxRate).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const [rateAge, setRateAge] = useState(12);
  useEffect(() => {
    const t = setInterval(() => setRateAge(a => a + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay },
  });

  return (
    <>
      <style>{STYLES}</style>

      <div className="dash-dot-grid" />
      <div className="dash-glow" />
      <div className="dash-noise" />

      <div className="dash-root">
        <div className="dash-content">

          {/* Rate ticker */}
          <motion.div {...fadeUp(0)} className="dash-rate">
            <span className="dash-rate-dot" />
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: "#9A9AA8" }}>
              1 USDC = ₹{fxRate.toFixed(2)}
            </span>
            <span style={{ color: "#3A3A3F", fontSize: 11 }}>·</span>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: "#606068" }}>
              {rateAge}s ago
            </span>
          </motion.div>

          {/* Balance */}
          <motion.section {...fadeUp(0.05)} className="dash-balance">
            <div className="dash-balance-number">
              <span className="dash-balance-main">
                {isConnected ? usdcBalance.toFixed(2) : "—"}
              </span>
              <span className="dash-balance-usdc">USDC</span>
            </div>
            <div className="dash-balance-inr">
              ≈ ₹{isConnected ? inrEquiv : "—"}
            </div>
            <div className="dash-balance-sol">
              {address ? "0.024 SOL for fees" : "Connect wallet to view balance"}
            </div>
          </motion.section>

          {/* Action buttons */}
          <motion.section {...fadeUp(0.1)} className="dash-actions">
            <button className="dash-action-btn" onClick={onScanQR}>
              <div className="dash-action-circle">
                <QRIcon color="#9A9AA8" size={22} />
              </div>
              <span className="dash-action-label">Scan QR</span>
            </button>

            <button className="dash-action-btn" onClick={onTypePayment}>
              <div className="dash-action-circle">
                <ChatIcon color="#9A9AA8" size={22} />
              </div>
              <span className="dash-action-label">Type</span>
            </button>
          </motion.section>

          {/* Connect wallet prompt */}
          {!isConnected && (
            <motion.div {...fadeUp(0.12)} className="dash-connect">
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F5F0", margin: 0 }}>Connect Phantom Wallet</p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "#606068", margin: "3px 0 0" }}>
                  Required to send payments
                </p>
              </div>
              <button className="dash-connect-btn" onClick={onConnect}>Connect</button>
            </motion.div>
          )}

          {/* Recent transactions */}
          <motion.section {...fadeUp(0.15)}>
            <h3 className="dash-section-label">RECENT PAYMENTS</h3>

            {txs.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "32px 0 16px", gap: 10,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "rgba(200,241,53,0.05)",
                  border: "1px solid rgba(200,241,53,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#606068" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <path d="M2 10h20"/>
                  </svg>
                </div>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: "#606068", letterSpacing: "0.08em", margin: 0 }}>
                  NO PAYMENTS YET
                </p>
                <p style={{ fontSize: 12, color: "#3A3A3F", margin: 0, textAlign: "center" }}>
                  Scan a QR or type a payment to get started
                </p>
              </div>
            ) : (
              txs.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  className={`dash-tx-card${tx.status === "completed" ? " dash-tx-card-completed" : ""}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18 + i * 0.06, duration: 0.4 }}
                >
                  <div className="dash-tx-left">
                    <div className="dash-tx-avatar">
                      {tx.logoUrl ? (
                        <img src={tx.logoUrl} alt={tx.merchant} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        tx.initials
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className="dash-tx-name">{tx.merchant}</p>
                      <p className="dash-tx-upi">{tx.upiId}</p>
                    </div>
                  </div>
                  <div className="dash-tx-right">
                    <p className="dash-tx-amount">₹{tx.inrAmount.toLocaleString("en-IN")}</p>
                    <span className={tx.status === "completed" ? "dash-tx-status-completed" : "dash-tx-status-processing"}>
                      {tx.status.toUpperCase()}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </motion.section>

        </div>
      </div>
    </>
  );
}
