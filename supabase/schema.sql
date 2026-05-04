-- ─────────────────────────────────────────────────────────────────
-- AURON — Supabase Database Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────

-- ── Users ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                VARCHAR(255) UNIQUE,
  google_id            VARCHAR(255) UNIQUE,
  username             VARCHAR(100) UNIQUE,          -- their .init username e.g. "priya.init"
  display_name         VARCHAR(255),
  avatar_url           TEXT,
  pin_hash             VARCHAR(255),                 -- argon2id hashed PIN — NEVER plaintext
  wallet_address       VARCHAR(255) UNIQUE,          -- Initia wallet address
  daily_cap_amount     DECIMAL(18,6) DEFAULT 5000,   -- max spend per day (in INR equivalent)
  instant_send_ceiling DECIMAL(18,6) DEFAULT 500,    -- no-PIN threshold
  is_onboarded         BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  last_login_at        TIMESTAMPTZ,
  login_count          INTEGER DEFAULT 0
);

-- ── Sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token     VARCHAR(255) UNIQUE NOT NULL,
  device_fingerprint VARCHAR(255),
  ip_address        VARCHAR(45),
  is_travel_mode    BOOLEAN DEFAULT FALSE,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Transactions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES users(id),
  action_type       VARCHAR(50) NOT NULL,            -- 'transfer' | 'agreement' | 'timelock' | 'ownership'
  amount            DECIMAL(18,6),
  recipient_address VARCHAR(255),
  recipient_username VARCHAR(100),
  note              TEXT,
  tx_hash           VARCHAR(255) UNIQUE,             -- Initia blockchain tx hash
  status            VARCHAR(50) DEFAULT 'pending',   -- 'pending' | 'confirmed' | 'failed'
  fee_amount        DECIMAL(18,6),
  raw_user_input    TEXT,                            -- exactly what the user typed
  ai_parsed_action  JSONB,                           -- Claude's parsed intent
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at      TIMESTAMPTZ
);

-- ── Contacts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_address     VARCHAR(255) NOT NULL,
  contact_username    VARCHAR(100),
  nickname            VARCHAR(100),                  -- "Priya", "Mom", "Landlord"
  transaction_count   INTEGER DEFAULT 0,
  last_transacted_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_address)
);

-- ── Rate Limits ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint       VARCHAR(100) NOT NULL,
  request_count  INTEGER DEFAULT 1,
  window_start   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash   ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id       ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at    ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id    ON rate_limits(user_id);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits  ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own record
CREATE POLICY "users_own_row" ON users
  FOR ALL USING (auth.uid()::text = id::text);

-- Transactions belong to their user
CREATE POLICY "transactions_own" ON transactions
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));

-- Contacts belong to their user
CREATE POLICY "contacts_own" ON contacts
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));

-- ── Auto-update updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
