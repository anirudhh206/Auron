"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, CheckCircle2, Clock, AlertCircle, Inbox, RefreshCcw } from "lucide-react";
import { usePaymentStore } from "@/store/usePaymentStore";
import { PaymentRecord } from "@/lib/payment-state";
import { getTxExplorerUrl } from "@/lib/solana";

// ─── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:      "#08080A",
  s1:      "#0F0F12",
  s2:      "#161619",
  border:  "#26262A",
  borderB: "#3A3A3F",
  text:    "#F5F5F0",
  muted:   "#9A9AA8",
  dim:     "#606068",
  lime:    "#C8F135",
  gold:    "#F5A623",
  usdc:    "#2775CA",
  red:     "#EF4444",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .th-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    cursor: default;
    border: none;
    padding: 0;
  }

  .th-drawer {
    position: fixed;
    right: 0;
    top: 0;
    height: 100%;
    z-index: 50;
    width: 100%;
    max-width: 380px;
    background: ${C.s1};
    border-left: 1px solid ${C.border};
    display: flex;
    flex-direction: column;
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .th-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 0.5px solid ${C.border};
    flex-shrink: 0;
  }

  .th-close-btn {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    color: ${C.dim};
    transition: border-color 0.15s, color 0.15s;
  }
  .th-close-btn:hover { border-color: ${C.borderB}; color: ${C.muted}; }

  .th-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .th-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 12px;
    transition: border-color 0.15s;
    position: relative;
    overflow: hidden;
  }
  .th-row:hover { border-color: ${C.borderB}; }
  .th-row-completed { border-left: 2px solid ${C.lime}; }
  .th-row-failed    { border-left: 2px solid ${C.red}; }
  .th-row-pending   { border-left: 2px solid ${C.gold}; }

  .th-avatar {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: ${C.bg};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 600; color: ${C.muted};
    flex-shrink: 0;
  }

  .th-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    text-align: center;
  }
`;

// ─── Status helpers ────────────────────────────────────────────────────────────
function statusLabel(status: PaymentRecord["status"]): string {
  const map: Partial<Record<PaymentRecord["status"], string>> = {
    completed:           "Completed",
    failed:              "Failed",
    refunded:            "Refunded",
    tx_pending:          "Confirming",
    tx_confirmed:        "On-chain ✓",
    offramp_initiated:   "Sending",
    offramp_processing:  "Processing",
    awaiting_signature:  "Signing",
    routing:             "Routing",
    risk_check:          "Checking",
    building_tx:         "Building",
    refund_pending:      "Refunding",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function statusColor(status: PaymentRecord["status"]): string {
  if (status === "completed") return C.lime;
  if (status === "failed" || status === "refund_pending") return C.red;
  if (status === "refunded") return C.muted;
  return C.gold;
}

function rowClass(status: PaymentRecord["status"]): string {
  if (status === "completed" || status === "refunded") return "th-row th-row-completed";
  if (status === "failed") return "th-row th-row-failed";
  return "th-row th-row-pending";
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { readonly onClose: () => void; }

export default function TransactionHistory({ onClose }: Props) {
  // Payments from usePaymentStore — persisted in localStorage
  // Already sorted newest-first (addPayment pushes to front of array)
  const payments = usePaymentStore(s => s.payments);

  return (
    <>
      <style>{STYLES}</style>

      {/* Backdrop */}
      <motion.button
        type="button"
        aria-label="Close history"
        className="th-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        className="th-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Header */}
        <div className="th-header">
          <div>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.12em", marginBottom: 4 }}>
              TRANSACTION HISTORY
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
              {payments.length} payment{payments.length === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" className="th-close-btn" aria-label="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* List */}
        <div className="th-list">
          {payments.length === 0 ? (
            <Empty />
          ) : (
            // newest first — addPayment already prepends, but sort by initiatedAt to be safe
            [...payments]
              .sort((a, b) => b.initiatedAt - a.initiatedAt)
              .map((payment, i) => (
                <motion.div
                  key={payment.paymentId}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <PaymentRow payment={payment} />
                </motion.div>
              ))
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Payment Row ──────────────────────────────────────────────────────────────
function PaymentRow({ payment: p }: { payment: PaymentRecord }) {
  const initials = (p.merchantName ?? "?").slice(0, 2).toUpperCase();
  const color    = statusColor(p.status);

  // Status icon
  const StatusIcon =
    p.status === "completed"  ? CheckCircle2 :
    p.status === "failed"     ? AlertCircle  :
    p.status === "refunded"   ? RefreshCcw   :
    Clock;

  return (
    <div className={rowClass(p.status)}>
      {/* Avatar */}
      <div className="th-avatar">{initials}</div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: merchant + amount */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.merchantName}
            </p>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.merchantUpiId}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 15, fontWeight: 500, color: C.gold, margin: 0 }}>
              ₹{p.inrAmount.toLocaleString("en-IN")}
            </p>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.usdc, margin: "2px 0 0" }}>
              {p.usdcAmount.toFixed(2)} USDC
            </p>
          </div>
        </div>

        {/* Bottom row: status + time + UTR */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <StatusIcon size={11} style={{ color, flexShrink: 0 }} />
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 600, color, letterSpacing: "0.06em" }}>
              {statusLabel(p.status).toUpperCase()}
            </span>
          </div>
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim }}>
            {relativeTime(p.initiatedAt)}
          </span>
        </div>

        {/* UTR if available */}
        {p.utrNumber && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim, letterSpacing: "0.06em" }}>UTR</span>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.muted }}>{p.utrNumber}</span>
          </div>
        )}

        {/* Solana link if available */}
        {p.solanaSignature && (
          <a
            href={getTxExplorerUrl(p.solanaSignature)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: "'Geist Mono',monospace", fontSize: 9,
              color: C.dim, marginTop: 5, textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.lime)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
            onClick={e => e.stopPropagation()}
          >
            {p.solanaSignature.slice(0, 6)}…{p.solanaSignature.slice(-4)} on Solscan
            <ExternalLink size={9} />
          </a>
        )}

        {/* Failure reason */}
        {p.status === "failed" && p.failureReason && (
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.red, margin: "5px 0 0", lineHeight: 1.5 }}>
            {p.failureReason}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function Empty() {
  return (
    <div className="th-empty">
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: C.s2, border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Inbox size={22} style={{ color: C.dim }} />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, margin: 0 }}>No payments yet</p>
        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "6px 0 0", lineHeight: 1.6 }}>
          Your completed UPI payments<br />will appear here
        </p>
      </div>
    </div>
  );
}
