-- ═══════════════════════════════════════════════════════════════════════════
-- Auron — Financial Ledger Schema
-- Run once in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── transactions ──────────────────────────────────────────────────────────────
-- Single source of truth for every payment initiated on Auron.
-- Immutable identity fields; status + error fields are mutable.
CREATE TABLE IF NOT EXISTS transactions (
  -- Identity
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        TEXT        UNIQUE NOT NULL,          -- client-generated ID
  idempotency_key   TEXT        UNIQUE NOT NULL,          -- de-dup key (24h)

  -- Parties
  user_id           TEXT        NOT NULL,                 -- Solana wallet pubkey
  merchant_upi_id   TEXT        NOT NULL,                 -- recipient UPI handle
  merchant_name     TEXT        NOT NULL,

  -- Amounts (immutable after creation)
  inr_amount        NUMERIC(12, 2) NOT NULL CHECK (inr_amount  > 0),
  usdc_amount       NUMERIC(12, 6) NOT NULL CHECK (usdc_amount > 0),
  quote_fx_rate     NUMERIC(10, 4),                       -- INR/USDC rate at quote time

  -- Solana
  tx_signature      TEXT,                                 -- on-chain sig (added after sign)
  tx_block_time     TIMESTAMPTZ,                          -- confirmed block timestamp

  -- Status machine
  -- initiated → quoted → signed → verified → settling → completed | failed
  status            TEXT        NOT NULL DEFAULT 'initiated'
                    CHECK (status IN (
                      'initiated', 'quoted', 'signed', 'verified',
                      'settling',  'completed', 'failed'
                    )),

  -- Failure details
  error_message     TEXT,
  failure_category  TEXT,
  retry_count       INT         NOT NULL DEFAULT 0,

  -- Metadata (JSON snapshots at decision time)
  risk_score        NUMERIC(5, 4),
  risk_flags        TEXT[],
  provider          TEXT,                                 -- settlement provider chosen
  fallback_provider TEXT,                                 -- fallback if primary fails

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── settlements ───────────────────────────────────────────────────────────────
-- One row per settlement attempt. In practice 1-per-transaction,
-- but can have multiple if retried via different providers.
CREATE TABLE IF NOT EXISTS settlements (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

  -- Provider
  provider            TEXT        NOT NULL,               -- 'razorpay' | 'onmeta' | 'manual'
  provider_payout_id  TEXT,                               -- e.g. "pout_xxx" from Razorpay
  utr                 TEXT,                               -- UPI Transaction Reference

  -- Status machine
  -- pending → processing → completed | failed
  status              TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Retry tracking
  retry_count         INT         NOT NULL DEFAULT 0,
  last_checked_at     TIMESTAMPTZ,                        -- last reconciliation check

  -- Raw response from provider (for debugging / audits)
  raw_response        JSONB,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── status_history ────────────────────────────────────────────────────────────
-- Append-only audit trail. Never update or delete rows here.
CREATE TABLE IF NOT EXISTS status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  from_status     TEXT,                                   -- null for first transition
  to_status       TEXT        NOT NULL,
  reason          TEXT,                                   -- human-readable message
  metadata        JSONB,                                  -- arbitrary debug data
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_txn_payment_id       ON transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_txn_idempotency_key  ON transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_txn_user_id          ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_status           ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_txn_created_at       ON transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stl_transaction_id   ON settlements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stl_status           ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_stl_provider_payout  ON settlements(provider_payout_id)
                                                       WHERE provider_payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stl_updated_at       ON settlements(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_txn_id       ON status_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at   ON status_history(created_at DESC);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_settlements_updated_at ON settlements;
CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- All DB operations go through server routes using the service role key.
-- The service role bypasses RLS automatically — no explicit policies needed.
-- Enabling RLS prevents accidental exposure via the anon/public Supabase client.
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history  ENABLE ROW LEVEL SECURITY;

-- ── Verification ─────────────────────────────────────────────────────────────
-- Run after migration to confirm schema is correct:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('transactions', 'settlements', 'status_history')
-- ORDER BY table_name, ordinal_position;
