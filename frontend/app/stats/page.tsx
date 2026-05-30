"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence }           from "framer-motion";
import {
  Zap, TrendingUp, CheckCircle, Clock,
  Wallet, ArrowUpRight, RefreshCw, Shield,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Summary {
  total_transactions:     number;
  completed:              number;
  failed:                 number;
  success_rate:           number;
  total_usdc:             number;
  total_inr:              number;
  unique_wallets:         number;
  avg_settlement_seconds: number;
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
}

interface StatsData {
  summary:    Summary;
  recent:     RecentRow[];
  network:    string;
  updated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function solscanUrl(sig: string, network: string): string {
  return `https://solscan.io/tx/${sig}${network !== "mainnet-beta" ? `?cluster=${network}` : ""}`;
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent = false, delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{
        background:   "rgba(255,255,255,0.03)",
        border:       `1px solid ${accent ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16,
        padding:      "24px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon
          size={14}
          style={{ color: accent ? "#C9A84C" : "rgba(255,255,255,0.4)" }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ? "#C9A84C" : "#F0EEE8", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [data,        setData]        = useState<StatsData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing,  setRefreshing]  = useState(false);

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

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    fetchStats();
    const iv = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  const s = data?.summary;
  const network = data?.network ?? "devnet";

  return (
    <div
      style={{
        minHeight:   "100vh",
        background:  "#030712",
        color:       "#F0EEE8",
        fontFamily:  "var(--font-dm-sans, system-ui, sans-serif)",
        padding:     "0 16px 64px",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "32px 0 40px",
            borderBottom:   "1px solid rgba(255,255,255,0.06)",
            marginBottom:   40,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Zap size={18} style={{ color: "#C9A84C" }} />
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "#C9A84C", textTransform: "uppercase" }}>
                Auron
              </span>
              {/* LIVE badge */}
              <span
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          5,
                  background:   "rgba(16,185,129,0.1)",
                  border:       "1px solid rgba(16,185,129,0.25)",
                  borderRadius: 20,
                  padding:      "2px 8px",
                  fontSize:     10,
                  fontWeight:   700,
                  color:        "#10b981",
                  letterSpacing: "0.08em",
                }}
              >
                <span
                  style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "#10b981",
                    animation: "pulse 2s infinite",
                  }}
                />
                LIVE
              </span>
              {/* Network badge */}
              <span
                style={{
                  background:   "rgba(255,255,255,0.06)",
                  border:       "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  padding:      "2px 8px",
                  fontSize:     10,
                  fontWeight:   600,
                  color:        "rgba(255,255,255,0.4)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                }}
              >
                {network}
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F0EEE8", margin: 0, letterSpacing: "-0.02em" }}>
              Settlement Infrastructure
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "4px 0 0", letterSpacing: "0.01em" }}>
              Programmable stablecoin rails on Solana · Powered by Auron
            </p>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            6,
              background:     "rgba(255,255,255,0.04)",
              border:         "1px solid rgba(255,255,255,0.08)",
              borderRadius:   10,
              padding:        "8px 14px",
              color:          "rgba(255,255,255,0.4)",
              fontSize:       12,
              cursor:         "pointer",
              transition:     "all 0.2s",
            }}
          >
            <RefreshCw
              size={12}
              style={{
                animation: refreshing ? "spin 1s linear infinite" : "none",
              }}
            />
            {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </button>
        </div>

        {/* ── Loading state ───────────────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.3)" }}>
            Loading settlement data…
          </div>
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {error && !loading && (
          <div
            style={{
              background:   "rgba(239,68,68,0.08)",
              border:       "1px solid rgba(239,68,68,0.2)",
              borderRadius: 12,
              padding:      "16px 20px",
              color:        "#ef4444",
              fontSize:     13,
            }}
          >
            Failed to load stats: {error}
          </div>
        )}

        {/* ── Stats grid ──────────────────────────────────────────────────── */}
        {s && (
          <AnimatePresence>
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap:                 12,
                marginBottom:        32,
              }}
            >
              <StatCard
                icon={TrendingUp}
                label="Total USDC Settled"
                value={`$${fmt(s.total_usdc, 4)}`}
                sub={`₹${fmt(s.total_inr, 0)} equivalent`}
                accent
                delay={0}
              />
              <StatCard
                icon={CheckCircle}
                label="Settlements"
                value={String(s.completed)}
                sub={`${s.total_transactions} total initiated`}
                delay={0.05}
              />
              <StatCard
                icon={Shield}
                label="Success Rate"
                value={`${s.success_rate}%`}
                sub={s.failed > 0 ? `${s.failed} failed` : "No failures"}
                delay={0.1}
              />
              <StatCard
                icon={Clock}
                label="Avg Settlement"
                value={s.avg_settlement_seconds > 0 ? `${s.avg_settlement_seconds}s` : "—"}
                sub="initiated → completed"
                delay={0.15}
              />
              <StatCard
                icon={Wallet}
                label="Unique Wallets"
                value={String(s.unique_wallets)}
                sub="distinct senders"
                delay={0.2}
              />
            </div>
          </AnimatePresence>
        )}

        {/* ── Recent settlements ──────────────────────────────────────────── */}
        {data && data.recent.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <div
              style={{
                fontSize:     11,
                fontWeight:   700,
                letterSpacing: "0.1em",
                color:        "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Recent Settlements
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.recent.map((row, i) => (
                <motion.div
                  key={row.payment_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + i * 0.04 }}
                  style={{
                    background:   "rgba(255,255,255,0.025)",
                    border:       "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    padding:      "14px 16px",
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent: "space-between",
                    gap:          12,
                  }}
                >
                  {/* Left */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#F0EEE8" }}>
                        ₹{fmt(row.inr_amount, 0)}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                        →
                      </span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                        {row.merchant_name}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                        {row.merchant_upi_id}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>·</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                        {fmt(row.usdc_amount, 6)} USDC
                      </span>
                      {row.duration_seconds !== null && (
                        <>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>·</span>
                          <span style={{ fontSize: 11, color: "rgba(16,185,129,0.7)" }}>
                            ⚡ {row.duration_seconds}s
                          </span>
                        </>
                      )}
                    </div>
                    {row.utr && (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        {/* Real bank UTR — doesn't start with DEMO_ */}
                        {!row.utr.startsWith("DEMO_") ? (
                          <span
                            style={{
                              fontSize:     10,
                              fontFamily:   "monospace",
                              color:        "#C9A84C",
                              background:   "rgba(201,168,76,0.08)",
                              border:       "1px solid rgba(201,168,76,0.25)",
                              borderRadius: 4,
                              padding:      "1px 6px",
                            }}
                          >
                            UTR {row.utr}
                          </span>
                        ) : (
                          /* Demo / simulated UTR */
                          <span
                            style={{
                              fontSize:     10,
                              fontFamily:   "monospace",
                              color:        "rgba(255,255,255,0.25)",
                              background:   "rgba(255,255,255,0.04)",
                              border:       "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 4,
                              padding:      "1px 6px",
                            }}
                          >
                            DEMO settlement
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right */}
                  <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                      {timeAgo(row.created_at)}
                    </span>
                    {row.tx_signature && (
                      <a
                        href={solscanUrl(row.tx_signature, network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display:      "flex",
                          alignItems:   "center",
                          gap:          3,
                          fontSize:     10,
                          color:        "rgba(255,255,255,0.3)",
                          textDecoration: "none",
                          background:   "rgba(255,255,255,0.04)",
                          border:       "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 6,
                          padding:      "2px 7px",
                          transition:   "color 0.2s",
                        }}
                      >
                        Solscan <ArrowUpRight size={9} />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {data && data.recent.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
            No completed settlements yet.
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop:    48,
            paddingTop:   24,
            borderTop:    "1px solid rgba(255,255,255,0.05)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
            fontSize:     11,
            color:        "rgba(255,255,255,0.2)",
          }}
        >
          <span>Powered by <strong style={{ color: "rgba(255,255,255,0.35)" }}>Auron</strong> · Solana · OnMeta</span>
          <span>Data from Supabase ledger · refreshes every 30s</span>
        </div>
      </div>

      {/* ── CSS animations ──────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
