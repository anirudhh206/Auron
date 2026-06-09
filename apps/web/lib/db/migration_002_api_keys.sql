-- ═══════════════════════════════════════════════════════════════════════════
-- Auron — Migration 002: API Keys
-- Run in: Supabase Dashboard → SQL Editor → Run
--
-- Enables programmatic / AI-agent access to /api/v1/pay.
-- Raw keys are NEVER stored — only SHA-256(key) hex.
-- Key format: ak_live_<32 random chars>  or  ak_test_<32 random chars>
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Security: raw key is never stored — only the SHA-256 hash (hex)
  key_hash        TEXT           UNIQUE NOT NULL,

  -- Identity
  agent_name      TEXT           NOT NULL,          -- human label, e.g. "My Claude Agent v1"
  agent_id        TEXT           UNIQUE NOT NULL,   -- slug, e.g. "my-claude-agent-v1"

  -- Limits
  daily_limit_inr NUMERIC(12, 2) NOT NULL DEFAULT 100000,  -- ₹1,00,000/day default

  -- Lifecycle
  is_active       BOOLEAN        NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);

-- Row-level security: no direct client access — service role only
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access"
  ON api_keys
  FOR ALL
  USING (false);

-- Index for the hot path: key lookup on every /api/v1/pay request
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx
  ON api_keys (key_hash)
  WHERE is_active = true;

-- ── Seed: insert a test key for local development ──────────────────────────
-- Raw key:  ak_test_auron_local_dev_key_00000000
-- Hash:     SHA-256 of the above, hex
-- To generate your own:
--   node -e "const c=require('crypto');console.log(c.createHash('sha256').update('ak_test_auron_local_dev_key_00000000').digest('hex'))"
--
INSERT INTO api_keys (key_hash, agent_name, agent_id, daily_limit_inr)
VALUES (
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  'Local Dev Agent',
  'local-dev-agent',
  100000
)
ON CONFLICT (agent_id) DO NOTHING;
