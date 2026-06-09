/**
 * Auron — API Key Validation
 * Server-side ONLY. Never import from browser/client code.
 *
 * Flow:
 *   1. Caller sends:  x-api-key: ak_live_xxx  (or ak_test_xxx)
 *   2. We SHA-256 the raw key and look up the hash in api_keys table.
 *   3. If found + active → return agent context.
 *   4. If not found or revoked → return null (caller returns 401).
 *   5. If header absent → return null (human wallet flow, allowed).
 *
 * Raw keys are NEVER stored anywhere — only the SHA-256 hash.
 */

import crypto                                from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentContext {
  agentId:       string;
  agentName:     string;
  dailyLimitInr: number;
}

export type ApiKeyValidationResult =
  | { valid: true;  agent: AgentContext }
  | { valid: false; reason: "invalid_key" | "revoked_key" | "db_error" };

// ── Supabase singleton ────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error("[api-key] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  }
  _client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ── Hash ──────────────────────────────────────────────────────────────────────

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate an API key from the x-api-key header.
 *
 * Returns null if no key is present (human wallet flow — allowed).
 * Returns ApiKeyValidationResult if a key is present (must be checked by caller).
 */
export async function validateApiKey(
  rawKey: string | null | undefined
): Promise<{ present: false } | { present: true; result: ApiKeyValidationResult }> {
  // No header — human wallet flow, pass through
  if (!rawKey || !rawKey.trim()) {
    return { present: false };
  }

  const hash = hashKey(rawKey.trim());

  type ApiKeyRow = {
    agent_id:        string;
    agent_name:      string;
    daily_limit_inr: number;
    is_active:       boolean;
    revoked_at:      string | null;
  };

  let data: ApiKeyRow | null = null;

  try {
    const res = await db()
      .from("api_keys")
      .select("agent_id, agent_name, daily_limit_inr, is_active, revoked_at")
      .eq("key_hash", hash)
      .single();

    data = (res.data as ApiKeyRow | null) ?? null;
  } catch {
    return { present: true, result: { valid: false, reason: "db_error" } };
  }

  if (!data) {
    return { present: true, result: { valid: false, reason: "invalid_key" } };
  }

  if (!data.is_active || data.revoked_at !== null) {
    return { present: true, result: { valid: false, reason: "revoked_key" } };
  }

  // Fire-and-forget last_used_at update — never block the request for this
  void db()
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", hash);

  return {
    present: true,
    result: {
      valid: true,
      agent: {
        agentId:       data.agent_id,
        agentName:     data.agent_name,
        dailyLimitInr: Number(data.daily_limit_inr),
      },
    },
  };
}
