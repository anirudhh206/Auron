/**
 * Auron — Ledger TypeScript Types
 * Mirror of lib/db/schema.sql — keep in sync.
 */

// ── Transaction ───────────────────────────────────────────────────────────────

export type TransactionStatus =
  | "initiated"
  | "quoted"
  | "signed"
  | "verified"
  | "settling"
  | "completed"
  | "failed";

export interface Transaction {
  id:                 string;        // UUID
  payment_id:         string;
  idempotency_key:    string;

  user_id:            string;
  merchant_upi_id:    string;
  merchant_name:      string;

  inr_amount:         number;
  usdc_amount:        number;
  quote_fx_rate:      number | null;

  tx_signature:       string | null;
  tx_block_time:      string | null; // ISO string

  status:             TransactionStatus;
  error_message:      string | null;
  failure_category:   string | null;
  retry_count:        number;

  risk_score:         number | null;
  risk_flags:         string[] | null;
  provider:           string | null;
  fallback_provider:  string | null;

  created_at:         string;        // ISO string
  updated_at:         string;
}

export interface NewTransaction {
  payment_id:         string;
  idempotency_key:    string;
  user_id:            string;
  merchant_upi_id:    string;
  merchant_name:      string;
  inr_amount:         number;
  usdc_amount:        number;
  quote_fx_rate?:     number;
  tx_signature?:      string;
  status?:            TransactionStatus;
  risk_score?:        number;
  risk_flags?:        string[];
  provider?:          string;
  fallback_provider?: string;
}

// ── Settlement ────────────────────────────────────────────────────────────────

export type SettlementStatus = "pending" | "processing" | "completed" | "failed";

export interface Settlement {
  id:                 string;        // UUID
  transaction_id:     string;        // FK → transactions.id

  provider:           string;
  provider_payout_id: string | null;
  utr:                string | null;

  status:             SettlementStatus;
  retry_count:        number;
  last_checked_at:    string | null; // ISO string
  raw_response:       Record<string, unknown> | null;

  created_at:         string;
  updated_at:         string;
}

export interface NewSettlement {
  transaction_id:     string;
  provider:           string;
  provider_payout_id?: string;
  utr?:               string;
  status?:            SettlementStatus;
  raw_response?:      Record<string, unknown>;
}

// ── Status History ────────────────────────────────────────────────────────────

export interface StatusHistoryRow {
  id:             string;
  transaction_id: string;
  from_status:    TransactionStatus | null;
  to_status:      TransactionStatus;
  reason:         string | null;
  metadata:       Record<string, unknown> | null;
  created_at:     string;
}

// ── Composite views ───────────────────────────────────────────────────────────

export interface TransactionWithSettlement extends Transaction {
  settlement: Settlement | null;
  history:    StatusHistoryRow[];
}
