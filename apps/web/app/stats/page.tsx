"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, CheckCircle, Clock, Wallet, ArrowUpRight, RefreshCw, Shield, Landmark, Activity, RotateCcw } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Summary {
  total_transactions:     number;
  completed:              number;
  failed:                 number;
  success_rate:           string;   // API returns "99.98" (string, 2dp)
  total_usdc:             number;
  total_inr:              number;
  verified_usdc:          number;   // USDC from non-demo TXs only
  verified_inr:           number;
  unique_wallets:         number;
  avg_settlement_seconds: number;
  ledger_entries:         number;   // total status_history rows (all state transitions)
  recovered_settlements:  number;   // settlements that needed retry but succeeded
}

interface RecentRow {
  payment_id:       string;
  merchant_name:    string;
  merchant_upi_id:  string;
  inr_amount:       number;
  usdc_amount:      number;
  tx_signature:     string | null;
  created_at:       string;
  duration_seconds: number | null;
  utr:              string | null;
  provider:         string | null;
  is_demo:          boolean;
  recovered:        boolean;        // true = needed retry before completing
}

interface Treasury {
  protocol_revenue_usdc: number;
  spread_percent:        number;
  wallet:                string;
  description:           string;
}

interface StatsData {
  summary:    Summary;
  treasury:   Treasury;
  recent:     RecentRow[];
  network:    string;
  updated_at: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function solscanTxUrl(sig: string, network: string): string {
  return `https://solscan.io/tx/${sig}${network !== "mainnet-beta" ? `?cluster=${network}` : ""}`;
}

function solscanAccountUrl(address: string, network: string): string {
  return `https://solscan.io/account/${address}${network !== "mainnet-beta" ? `?cluster=${network}` : ""}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .stats-root {
    min-height: 100dvh;
    background: ${C.bg};
    color: ${C.text};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow-x: hidden;
  }

  /* Dot grid */
  .stats-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(circle, ${C.border} 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.2;
    pointer-events: none;
    z-index: 0;
  }

  /* USDC blue top glow */
  .stats-root::after {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 320px;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(39,117,202,0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .stats-content {
    position: relative;
    z-index: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }

  /* Header */
  .stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 40px 0 36px;
    border-bottom: 0.5px solid ${C.border};
    margin-bottom: 40px;
    gap: 16px;
    flex-wrap: wrap;
  }

  /* Live badge */
  .stats-live-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 100px;
    background: rgba(200,241,53,0.06);
    border: 1px solid rgba(200,241,53,0.2);
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    color: ${C.lime};
    letter-spacing: 0.1em;
  }

  .stats-live-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${C.lime};
    animation: livePulse 2s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Network badge */
  .stats-network-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 100px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* Refresh button */
  .stats-refresh-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    background: ${C.s1};
    border: 1px solid ${C.border};
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.dim};
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .stats-refresh-btn:hover { border-color: ${C.borderB}; color: ${C.muted}; }
  .stats-refresh-btn:disabled { opacity: 0.5; cursor: default; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Stat cards grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  /* Secondary stats row */
  .stats-grid-secondary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 28px;
  }

  .stat-card {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 12px;
    padding: 20px 18px;
    transition: border-color 0.15s;
  }
  .stat-card:hover { border-color: ${C.borderB}; }

  .stat-card-label {
    font-family: 'Geist Mono', monospace;
    font-size: 9px;
    color: ${C.dim};
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-card-value {
    font-family: 'Geist Mono', monospace;
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1;
    margin-bottom: 6px;
  }

  .stat-card-sub {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    line-height: 1.4;
  }

  /* Treasury card */
  .treasury-card {
    background: rgba(200,241,53,0.03);
    border: 1px solid rgba(200,241,53,0.12);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }

  .treasury-icon {
    width: 40px; height: 40px;
    border-radius: 10px;
    background: rgba(200,241,53,0.08);
    border: 1px solid rgba(200,241,53,0.15);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .treasury-wallet-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.dim};
    text-decoration: none;
    padding: 6px 12px;
    border-radius: 8px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    transition: border-color 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .treasury-wallet-link:hover { border-color: rgba(200,241,53,0.2); color: ${C.lime}; }

  /* Section label */
  .section-label {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  /* Recent settlements */
  .tx-row {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    transition: border-color 0.15s;
    margin-bottom: 8px;
  }
  .tx-row:hover { border-color: ${C.borderB}; }
  .tx-row:last-child { margin-bottom: 0; }

  /* Real UTR badge */
  .utr-real {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.lime};
    background: rgba(200,241,53,0.06);
    border: 1px solid rgba(200,241,53,0.15);
    border-radius: 4px;
    padding: 2px 7px;
  }

  /* Demo UTR badge */
  .utr-demo {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 4px;
    padding: 2px 7px;
  }

  /* Recovered badge */
  .utr-recovered {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.gold};
    background: rgba(245,166,35,0.06);
    border: 1px solid rgba(245,166,35,0.2);
    border-radius: 4px;
    padding: 2px 7px;
  }

  /* Solscan link */
  .solscan-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    text-decoration: none;
    padding: 3px 8px;
    border-radius: 6px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .solscan-link:hover { color: ${C.usdc}; border-color: rgba(39,117,202,0.3); }

  /* Solscan proof bar */
  .proof-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 10px;
    margin-top: 24px;
    flex-wrap: wrap;
    gap: 12px;
  }

  /* Footer */
  .stats-footer {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 0.5px solid ${C.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  /* Loading shimmer */
  .shimmer {
    background: linear-gradient(90deg, ${C.s1} 25%, ${C.s2} 50%, ${C.s1} 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }

  /* Error */
  .stats-error {
    background: rgba(239,68,68,0.06);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 10px;
    padding: 16px 20px;
    font-family: 'Geist Mono', monospace;
    font-size: 12px;
    color: ${C.error};
  }
`;

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, valueColor, delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay }}
    >
      <div className="stat-card-label">
        <Icon size={11} />
        {label}
      </div>
      <div className="stat-card-value" style={{ color: valueColor ?? C.text }}>
        {value}
      </div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </motion.div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 96 }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 80 }} />
        ))}
      </div>
      <div className="shimmer" style={{ height: 80 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 72 }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [data,        setData]        = useState<StatsData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  // null initial value avoids the SSR/client new Date() mismatch that causes
  // React hydration errors (server renders one timestamp, client another).
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  // mounted flag gates any time-dependent renders to client-only
  const [mounted,     setMounted]     = useState(false);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json() as StatsData;
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchStats();
    const iv = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  const s       = data?.summary;
  const network = data?.network ?? "devnet";

  // Pick the most recent real (non-demo) TX signature for the proof bar
  const latestRealTx = data?.recent.find(r => r.tx_signature && !r.is_demo)?.tx_signature ?? null;
  // Fallback: any TX signature at all
  const latestAnyTx  = data?.recent.find(r => r.tx_signature)?.tx_signature ?? null;
  const proofTxSig   = latestRealTx ?? latestAnyTx;

  return (
    <>
      <style>{STYLES}</style>
      <div className="stats-root">
        <div className="stats-content">

          {/* ── Header ── */}
          <div className="stats-header">
            <div>
              {/* Logo + badges */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <AuronLogo size={22} showText textSize={13} />
                <span className="stats-live-badge">
                  <span className="stats-live-dot" />
                  LIVE
                </span>
                <span className="stats-network-badge">{network}</span>
              </div>

              {/* Title */}
              <h1 style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: "clamp(22px, 4vw, 32px)",
                fontWeight: 400,
                color: C.text,
                margin: "0 0 6px",
                letterSpacing: "-0.01em",
              }}>
                Settlement Infrastructure
              </h1>
              <p style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: C.dim,
                letterSpacing: "0.04em",
              }}>
                Programmable stablecoin rails on Solana · Powered by Auron
              </p>
            </div>

            {/* Refresh */}
            <button
              className="stats-refresh-btn"
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              title="Refresh stats"
            >
              <RefreshCw
                size={11}
                style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}
              />
              {/* Timestamp is client-only — server renders "--:--:--" to prevent
                  hydration mismatch from new Date() diverging between SSR and CSR */}
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                {mounted && lastRefresh
                  ? lastRefresh.toLocaleTimeString("en-IN", {
                      hour:   "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "--:--:--"}
              </span>
            </button>
          </div>

          {/* ── Loading ── */}
          {loading && <LoadingSkeleton />}

          {/* ── Error ── */}
          {error && !loading && (
            <div className="stats-error">Failed to load stats: {error}</div>
          )}

          {/* ── Stats ── */}
          {s && (
            <AnimatePresence>

              {/* Primary stat cards */}
              <div key="stats-primary" className="stats-grid">
                <StatCard
                  icon={TrendingUp}
                  label="Total USDC Settled"
                  value={`${fmt(s.total_usdc, 4)}`}
                  sub={`₹${fmt(s.total_inr, 0)} INR equivalent`}
                  valueColor={C.usdc}
                  delay={0}
                />
                <StatCard
                  icon={CheckCircle}
                  label="Settlements"
                  value={String(s.completed)}
                  sub={`${s.total_transactions} total initiated`}
                  valueColor={C.text}
                  delay={0.05}
                />
                <StatCard
                  icon={Shield}
                  label="Success Rate"
                  value={`${s.success_rate}%`}
                  sub={s.failed > 0 ? `${s.failed} failed · incl. deliberate failure-path tests, all auto-refunded` : "No failures"}
                  valueColor={C.lime}
                  delay={0.1}
                />
                <StatCard
                  icon={Clock}
                  label="Avg Settlement"
                  value={s.avg_settlement_seconds > 0 ? `${s.avg_settlement_seconds}s` : "—"}
                  sub="initiated → completed"
                  valueColor={C.lime}
                  delay={0.15}
                />
                <StatCard
                  icon={Wallet}
                  label="Unique Wallets"
                  value={String(s.unique_wallets)}
                  sub="distinct senders"
                  valueColor={C.text}
                  delay={0.2}
                />
              </div>

              {/* Secondary stat cards — infrastructure health */}
              <div key="stats-secondary" className="stats-grid-secondary">
                <StatCard
                  icon={Activity}
                  label="Ledger Events"
                  value={s.ledger_entries > 999 ? `${(s.ledger_entries / 1000).toFixed(1)}k` : String(s.ledger_entries)}
                  sub="total state transitions"
                  valueColor={C.muted}
                  delay={0.22}
                />
                <StatCard
                  icon={RotateCcw}
                  label="Auto-recovered"
                  value={String(s.recovered_settlements)}
                  sub={s.recovered_settlements > 0 ? "retried → succeeded" : "no retries needed"}
                  valueColor={s.recovered_settlements > 0 ? C.gold : C.dim}
                  delay={0.25}
                />
                {s.verified_usdc > 0 && (
                  <StatCard
                    icon={CheckCircle}
                    label="On-chain Verified"
                    value={`${fmt(s.verified_usdc, 4)}`}
                    sub={`₹${fmt(s.verified_inr, 0)} with real TX`}
                    valueColor={C.usdc}
                    delay={0.28}
                  />
                )}
              </div>

              {/* Treasury card */}
              {data?.treasury && (
                <motion.div
                  key="treasury-card"
                  className="treasury-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div className="treasury-icon">
                      <Landmark size={16} color={C.lime} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: `rgba(200,241,53,0.5)`, letterSpacing: "0.14em", marginBottom: 6 }}>
                        PROTOCOL TREASURY
                      </p>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 26, fontWeight: 500, color: C.lime, letterSpacing: "-0.02em", lineHeight: 1, margin: "0 0 4px" }}>
                        {fmt(data.treasury.protocol_revenue_usdc, 4)} USDC
                      </p>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                        {data.treasury.spread_percent}% spread · self-filling by design
                      </p>
                    </div>
                  </div>

                  {data.treasury.wallet && (
                    <a
                      className="treasury-wallet-link"
                      href={solscanAccountUrl(data.treasury.wallet, network)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {data.treasury.wallet.slice(0, 6)}…{data.treasury.wallet.slice(-4)}
                      <ArrowUpRight size={9} />
                    </a>
                  )}
                </motion.div>
              )}

              {/* Recent settlements */}
              {data && data.recent.length > 0 && (
                <motion.div
                  key="recent-settlements"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.32 }}
                >
                  <p className="section-label">Recent Settlements</p>

                  <div>
                    {data.recent.map((row, i) => (
                      <motion.div
                        key={row.payment_id}
                        className="tx-row"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: 0.35 + i * 0.05 }}
                      >
                        {/* Left */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Amount + merchant */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 16, fontWeight: 500, color: C.gold }}>
                              ₹{fmt(row.inr_amount, 0)}
                            </span>
                            <span style={{ fontSize: 12, color: C.border }}>→</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.merchant_name}
                            </span>
                          </div>

                          {/* Meta row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                              {row.merchant_upi_id}
                            </span>
                            <span style={{ color: C.border, fontSize: 10 }}>·</span>
                            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.usdc }}>
                              {fmt(row.usdc_amount, 6)} USDC
                            </span>
                            {row.duration_seconds !== null && (
                              <>
                                <span style={{ color: C.border, fontSize: 10 }}>·</span>
                                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.lime }}>
                                  ⚡ {row.duration_seconds}s
                                </span>
                              </>
                            )}
                            {row.provider && (
                              <>
                                <span style={{ color: C.border, fontSize: 10 }}>·</span>
                                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, textTransform: "uppercase" }}>
                                  {row.provider}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Badges row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            {row.utr && (
                              !row.is_demo ? (
                                <span className="utr-real">UTR {row.utr}</span>
                              ) : (
                                <span className="utr-demo" title="On-chain leg is real; INR payout is simulated until offramp KYB clears">
                                  simulated payout · KYB pending
                                </span>
                              )
                            )}
                            {row.recovered && (
                              <span className="utr-recovered">⟳ auto-recovered</span>
                            )}
                          </div>
                        </div>

                        {/* Right */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                            {timeAgo(row.created_at)}
                          </span>
                          {row.tx_signature && (
                            <a
                              className="solscan-link"
                              href={solscanTxUrl(row.tx_signature, network)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Solscan <ArrowUpRight size={9} />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Proof bar — shows latest real TX or treasury wallet */}
                  <div className="proof-bar">
                    <div>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.08em", marginBottom: 4 }}>
                        VERIFIED ON-CHAIN
                      </p>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.muted }}>
                        Every transaction verified via 7-point Solana RPC check · SHA-256 receipt hash on every payment
                      </p>
                    </div>
                    {proofTxSig ? (
                      <a
                        className="solscan-link"
                        href={solscanTxUrl(proofTxSig, network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: "8px 14px", fontSize: 11 }}
                      >
                        Latest TX on Solscan <ArrowUpRight size={11} />
                      </a>
                    ) : data?.treasury.wallet ? (
                      <a
                        className="solscan-link"
                        href={solscanAccountUrl(data.treasury.wallet, network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: "8px 14px", fontSize: 11 }}
                      >
                        Treasury on Solscan <ArrowUpRight size={11} />
                      </a>
                    ) : null}
                  </div>
                </motion.div>
              )}

              {/* Empty state */}
              {data && data.recent.length === 0 && !loading && (
                <div key="empty-state" style={{ textAlign: "center", padding: "60px 0", fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.dim }}>
                  No completed settlements yet.
                </div>
              )}

            </AnimatePresence>
          )}

          {/* ── Footer ── */}
          <div className="stats-footer">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AuronLogo size={14} />
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                Powered by Auron · Solana · OnMeta
              </span>
            </div>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
              Supabase ledger · refreshes every 30s
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
