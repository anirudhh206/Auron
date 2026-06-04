-- ═══════════════════════════════════════════════════════════════════════════
-- Auron — Migration 001: Receipt Hash + Refund + Failure Stage
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── transactions: add receipt_hash + refund_tx_signature ──────────────────────

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receipt_hash        TEXT,          -- SHA-256 of canonical receipt
  ADD COLUMN IF NOT EXISTS refund_tx_signature TEXT,          -- Solana sig of the refund tx
  ADD COLUMN IF NOT EXISTS quote_expires_at    TIMESTAMPTZ,   -- FX quote expiry (for server-side guard)
  ADD COLUMN IF NOT EXISTS refund_reason       TEXT;          -- why the refund was triggered

-- ── transactions: extend status check to include refund states ────────────────
-- Drop the old constraint and recreate with refund states included.

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check CHECK (
    status IN (
      'initiated', 'quoted', 'signed', 'verified',
      'settling',  'completed', 'failed',
      'refund_pending', 'refunded'           -- new
    )
  );

-- ── settlements: add failure_stage + slippage_bps ────────────────────────────

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS failure_stage  TEXT,              -- where it failed: 'provider_call' | 'webhook' | 'reconcile'
  ADD COLUMN IF NOT EXISTS slippage_bps   INT,               -- FX movement in basis points at settlement time
  ADD COLUMN IF NOT EXISTS fallback_used  BOOLEAN NOT NULL DEFAULT FALSE; -- was this a fallback attempt?

-- ── receipts view — queryable canonical receipt for any completed payment ─────

CREATE OR REPLACE VIEW payment_receipts AS
SELECT
  t.payment_id,
  t.id                        AS internal_id,
  t.tx_signature              AS on_chain_hash,
  t.tx_block_time             AS on_chain_timestamp,
  t.receipt_hash,
  t.inr_amount,
  t.usdc_amount,
  t.quote_fx_rate,
  t.merchant_upi_id,
  t.merchant_name,
  t.user_id                   AS from_wallet,
  t.status,
  t.refund_tx_signature,
  s.utr                       AS utr_number,
  s.provider,
  s.provider_payout_id,
  t.created_at                AS initiated_at,
  t.updated_at                AS last_updated_at
FROM transactions t
LEFT JOIN settlements s ON s.transaction_id = t.id
  AND s.status = 'completed';

-- ── Index: lookup by on-chain signature ──────────────────────────────────────
-- Already exists as a unique index in schema.sql, but adding non-unique
-- on refund_tx_signature for lookups.
CREATE INDEX IF NOT EXISTS idx_txn_refund_sig
  ON transactions(refund_tx_signature)
  WHERE refund_tx_signature IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_txn_receipt_hash
  ON transactions(receipt_hash)
  WHERE receipt_hash IS NOT NULL;

-- ── Verification ─────────────────────────────────────────────────────────────
-- Run after migration:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'transactions' AND table_schema = 'public'
-- ORDER BY ordinal_position;
