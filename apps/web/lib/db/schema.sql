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
-- Prevents replay attacks: same Solana signature cannot settle twice.
-- Partial index allows multiple NULL values (unsigned/demo payments).
CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_tx_signature
  ON transactions(tx_signature)
  WHERE tx_signature IS NOT NULL;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Auron — KYC & Network Schema (append to financial ledger schema above)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── users ────────────────────────────────────────────────────────────────────
-- One row per Supabase auth user. Created on first login.
CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid      TEXT        UNIQUE NOT NULL,  -- auth.users.id
  wallet_address    TEXT        UNIQUE,            -- Solana pubkey (set after connect)
  phone             TEXT        UNIQUE,             -- E.164 format, verified via OTP
  phone_verified_at TIMESTAMPTZ,                    -- NULL = unverified / skipped
  full_name         TEXT,

  -- KYC state machine: unverified → pending → approved | rejected | manual_review
  kyc_status        TEXT        NOT NULL DEFAULT 'unverified'
                    CHECK (kyc_status IN (
                      'unverified', 'pending', 'approved', 'rejected', 'manual_review'
                    )),
  kyc_provider      TEXT,                           -- 'sumsub' | 'idfy' | 'digilocker'
  kyc_reference_id  TEXT,                           -- provider's applicant/verification ID
  kyc_verified_at   TIMESTAMPTZ,
  kyc_rejected_at   TIMESTAMPTZ,
  kyc_rejection_reason TEXT,

  -- Limits (personalised after KYC tier)
  daily_limit_inr   NUMERIC(12,2)  NOT NULL DEFAULT 5000,   -- ₹5,000 default
  monthly_limit_inr NUMERIC(12,2)  NOT NULL DEFAULT 50000,  -- ₹50,000 default
  spend_ceiling_inr NUMERIC(12,2)  NOT NULL DEFAULT 500,    -- per-tx ceiling

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── kyc_submissions ───────────────────────────────────────────────────────────
-- Each KYC attempt. Append-only — never update or delete rows.
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  provider          TEXT        NOT NULL,           -- 'sumsub' | 'idfy' | 'digilocker'
  provider_ref      TEXT,                           -- provider's external ID
  doc_type          TEXT,                           -- 'aadhaar' | 'pan' | 'passport'
  doc_last4         TEXT,                           -- last 4 digits of doc (never full)

  -- Status
  status            TEXT        NOT NULL DEFAULT 'submitted'
                    CHECK (status IN (
                      'submitted', 'under_review', 'approved', 'rejected'
                    )),
  rejection_reason  TEXT,
  raw_response      JSONB,                          -- provider webhook payload (for audit)

  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

-- ── contacts ──────────────────────────────────────────────────────────────────
-- Network effects table. Every time a user pays someone, we record a contact.
-- "Send ₹500 to Priya" works because Priya is in this table.
CREATE TABLE IF NOT EXISTS contacts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Contact identity (one of these is always set)
  upi_id            TEXT,                           -- UPI handle (e.g. priya@upi)
  wallet_address    TEXT,                           -- Solana address
  phone             TEXT,                           -- E.164 phone number

  display_name      TEXT        NOT NULL,           -- "Priya", "Swiggy Merchant", etc.
  avatar_url        TEXT,

  -- Signals
  tx_count          INT         NOT NULL DEFAULT 1, -- how many times paid
  last_paid_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_favourite      BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Auron network flag: true if this contact is also an Auron user
  is_auron_user     BOOLEAN     NOT NULL DEFAULT FALSE,
  contact_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (owner_user_id, upi_id),
  UNIQUE (owner_user_id, wallet_address)
);

-- ── intent_log ────────────────────────────────────────────────────────────────
-- Anonymised intent analytics — powers the data flywheel.
-- PII (names, addresses) is stripped before insert. Used to improve Claude parsing.
CREATE TABLE IF NOT EXISTS intent_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type       TEXT        NOT NULL,           -- 'transfer_usdc' | 'upi_payment' | etc.
  confidence        NUMERIC(4,3),                   -- Claude confidence score
  amount_usdc       NUMERIC(12,6),
  duration_days     INT,                            -- for lock intents
  input_length      INT,                            -- character length (not the text)
  parsed_ok         BOOLEAN     NOT NULL DEFAULT TRUE,
  network           TEXT        NOT NULL DEFAULT 'devnet',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid   ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_users_wallet         ON users(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_kyc_status     ON users(kyc_status);

CREATE INDEX IF NOT EXISTS idx_kyc_user_id          ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status           ON kyc_submissions(status);

CREATE INDEX IF NOT EXISTS idx_contacts_owner       ON contacts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_upi         ON contacts(upi_id)         WHERE upi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_wallet      ON contacts(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_auron       ON contacts(is_auron_user)  WHERE is_auron_user = TRUE;

CREATE INDEX IF NOT EXISTS idx_intent_action        ON intent_log(action_type);
CREATE INDEX IF NOT EXISTS idx_intent_created_at    ON intent_log(created_at DESC);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_log        ENABLE ROW LEVEL SECURITY;

-- ── Verification ─────────────────────────────────────────────────────────────
-- Run after migration to confirm schema is correct:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'transactions', 'settlements', 'status_history',
--     'users', 'kyc_submissions', 'contacts', 'intent_log'
--   )
-- ORDER BY table_name, ordinal_position;
