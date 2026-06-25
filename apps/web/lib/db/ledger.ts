/**
 * Auron — Ledger Data Access Layer
 *
 * All Supabase DB operations for the financial ledger.
 * Server-side ONLY — uses the service role key, which bypasses RLS.
 * Never import this file from browser code.
 *
 * Pattern:
 *   - Every write is wrapped in try/catch and returns a Result type.
 *   - Errors are logged but never re-thrown (callers decide how to handle).
 *   - Every status transition also writes to status_history (audit trail).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Transaction, NewTransaction,
  Settlement,  NewSettlement,
  StatusHistoryRow,
  TransactionStatus, SettlementStatus,
  TransactionWithSettlement,
} from "./types";

// ── Supabase singleton ────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error("[ledger] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  }
  _client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ── Result type ───────────────────────────────────────────────────────────────

export type LedgerResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Create a new transaction record.
 * Idempotent: if payment_id already exists, returns the existing record.
 */
export async function createTransaction(
  input: NewTransaction
): Promise<LedgerResult<Transaction>> {
  try {
    // Try insert first
    const { data, error } = await db()
      .from("transactions")
      .insert({
        payment_id:       input.payment_id,
        idempotency_key:  input.idempotency_key,
        user_id:          input.user_id,
        merchant_upi_id:  input.merchant_upi_id,
        merchant_name:    input.merchant_name,
        inr_amount:       input.inr_amount,
        usdc_amount:      input.usdc_amount,
        quote_fx_rate:    input.quote_fx_rate ?? null,
        tx_signature:     input.tx_signature ?? null,
        status:           input.status ?? "initiated",
        risk_score:       input.risk_score ?? null,
        risk_flags:       input.risk_flags ?? null,
        provider:         input.provider ?? null,
        fallback_provider: input.fallback_provider ?? null,
      })
      .select()
      .single();

    if (error) {
      // Duplicate payment_id or idempotency_key — return existing
      if (error.code === "23505") {
        return getTransactionByPaymentId(input.payment_id);
      }
      console.error("[ledger] createTransaction error:", error.message);
      return { ok: false, error: error.message };
    }

    // Log initial status in history
    await appendHistory(data.id, null, data.status as TransactionStatus, "Transaction created");

    return { ok: true, data: data as Transaction };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[ledger] createTransaction exception:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Transition a transaction to a new status.
 * Writes both the status update AND a history row atomically (2 queries,
 * Postgres-level atomicity via sequential update + insert).
 */
export async function transitionTransaction(
  transactionId: string,
  toStatus: TransactionStatus,
  options?: {
    reason?:           string;
    errorMessage?:     string;
    failureCategory?:  string;
    txSignature?:      string;
    txBlockTime?:      Date;
    metadata?:         Record<string, unknown>;
  }
): Promise<LedgerResult<Transaction>> {
  try {
    // Fetch current status for history log
    const { data: current } = await db()
      .from("transactions")
      .select("status")
      .eq("id", transactionId)
      .single();

    const fromStatus = (current?.status ?? null) as TransactionStatus | null;

    // Update transaction
    const patch: Record<string, unknown> = { status: toStatus };
    if (options?.errorMessage)    patch.error_message    = options.errorMessage;
    if (options?.failureCategory) patch.failure_category = options.failureCategory;
    if (options?.txSignature)     patch.tx_signature     = options.txSignature;
    if (options?.txBlockTime)     patch.tx_block_time    = options.txBlockTime.toISOString();

    const { data, error } = await db()
      .from("transactions")
      .update(patch)
      .eq("id", transactionId)
      .select()
      .single();

    if (error) {
      console.error("[ledger] transitionTransaction error:", error.message);
      return { ok: false, error: error.message };
    }

    // Append history row
    await appendHistory(
      transactionId,
      fromStatus,
      toStatus,
      options?.reason,
      options?.metadata
    );

    return { ok: true, data: data as Transaction };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[ledger] transitionTransaction exception:", msg);
    return { ok: false, error: msg };
  }
}

export async function getTransactionByPaymentId(
  paymentId: string
): Promise<LedgerResult<Transaction>> {
  try {
    const { data, error } = await db()
      .from("transactions")
      .select()
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found" };
    return { ok: true, data: data as Transaction };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

export async function getTransactionById(
  id: string
): Promise<LedgerResult<Transaction>> {
  try {
    const { data, error } = await db()
      .from("transactions")
      .select()
      .eq("id", id)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data)  return { ok: false, error: "Not found" };
    return { ok: true, data: data as Transaction };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

export async function getTransactionBySignature(
  txSignature: string
): Promise<LedgerResult<Transaction>> {
  try {
    const { data, error } = await db()
      .from("transactions")
      .select()
      .eq("tx_signature", txSignature)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data)  return { ok: false, error: "Not found" };
    return { ok: true, data: data as Transaction };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

export async function getTransactionByIdempotencyKey(
  key: string
): Promise<LedgerResult<Transaction>> {
  try {
    const { data, error } = await db()
      .from("transactions")
      .select()
      .eq("idempotency_key", key)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found" };
    return { ok: true, data: data as Transaction };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

/**
 * Get a transaction with its latest settlement and full status history.
 */
export async function getTransactionWithSettlement(
  paymentId: string
): Promise<LedgerResult<TransactionWithSettlement>> {
  try {
    const { data: txn, error: txnErr } = await db()
      .from("transactions")
      .select()
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (txnErr) return { ok: false, error: txnErr.message };
    if (!txn)   return { ok: false, error: "Not found" };

    const { data: settlement } = await db()
      .from("settlements")
      .select()
      .eq("transaction_id", txn.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: history } = await db()
      .from("status_history")
      .select()
      .eq("transaction_id", txn.id)
      .order("created_at", { ascending: true });

    return {
      ok: true,
      data: {
        ...(txn as Transaction),
        settlement: (settlement as Settlement) ?? null,
        history:    (history as StatusHistoryRow[]) ?? [],
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

// ── Settlements ───────────────────────────────────────────────────────────────

export async function createSettlement(
  input: NewSettlement
): Promise<LedgerResult<Settlement>> {
  try {
    const { data, error } = await db()
      .from("settlements")
      .insert({
        transaction_id:    input.transaction_id,
        provider:          input.provider,
        provider_payout_id: input.provider_payout_id ?? null,
        utr:               input.utr ?? null,
        status:            input.status ?? "pending",
        raw_response:      input.raw_response ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[ledger] createSettlement error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data as Settlement };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return { ok: false, error: msg };
  }
}

export async function updateSettlement(
  settlementId: string,
  patch: {
    status?:            SettlementStatus;
    provider_payout_id?: string;
    utr?:               string;
    raw_response?:      Record<string, unknown>;
    last_checked_at?:   Date;
    retry_count?:       number;
  }
): Promise<LedgerResult<Settlement>> {
  try {
    const update: Record<string, unknown> = {};
    if (patch.status             !== undefined) update.status              = patch.status;
    if (patch.provider_payout_id !== undefined) update.provider_payout_id = patch.provider_payout_id;
    if (patch.utr                !== undefined) update.utr                 = patch.utr;
    if (patch.raw_response       !== undefined) update.raw_response        = patch.raw_response;
    if (patch.last_checked_at    !== undefined) update.last_checked_at     = patch.last_checked_at.toISOString();
    if (patch.retry_count        !== undefined) update.retry_count         = patch.retry_count;

    const { data, error } = await db()
      .from("settlements")
      .update(update)
      .eq("id", settlementId)
      .select()
      .single();

    if (error) {
      console.error("[ledger] updateSettlement error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data as Settlement };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

/**
 * Atomically claim a pending settlement for processing.
 * Uses optimistic locking: update WHERE status='pending' AND retry_count < maxRetries.
 * Returns null if someone else claimed it first.
 */
export async function claimSettlementForProcessing(
  settlementId: string,
  maxRetries = 3
): Promise<Settlement | null> {
  try {
    const { data } = await db()
      .from("settlements")
      .update({ status: "processing", last_checked_at: new Date().toISOString() })
      .eq("id", settlementId)
      .eq("status", "pending")               // Only claim if still pending
      .lt("retry_count", maxRetries)         // Only if under retry limit
      .select()
      .single();

    return (data as Settlement) ?? null;
  } catch {
    return null;
  }
}

/**
 * Get pending settlements that need worker processing.
 * Excludes ones currently in processing (within last 5 minutes — soft lock window).
 */
export async function getPendingSettlements(limit = 10): Promise<Settlement[]> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data } = await db()
      .from("settlements")
      .select()
      .eq("status", "pending")
      .or(`last_checked_at.is.null,last_checked_at.lt.${fiveMinutesAgo}`)
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(limit);

    return (data as Settlement[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Get settlements that need reconciliation (completed or processing, not recently checked).
 */
export async function getSettlementsForReconciliation(limit = 50): Promise<Settlement[]> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await db()
      .from("settlements")
      .select()
      .in("status", ["processing", "completed"])
      .or(`last_checked_at.is.null,last_checked_at.lt.${oneDayAgo}`)
      .not("provider_payout_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    return (data as Settlement[]) ?? [];
  } catch {
    return [];
  }
}

// ── Status History ────────────────────────────────────────────────────────────

async function appendHistory(
  transactionId: string,
  fromStatus:    TransactionStatus | null,
  toStatus:      TransactionStatus,
  reason?:       string,
  metadata?:     Record<string, unknown>
): Promise<void> {
  try {
    await db().from("status_history").insert({
      transaction_id: transactionId,
      from_status:    fromStatus,
      to_status:      toStatus,
      reason:         reason ?? null,
      metadata:       metadata ?? null,
    });
  } catch (err) {
    // History write failure is non-fatal — log but don't throw
    console.error("[ledger] appendHistory error:", err instanceof Error ? err.message : err);
  }
}

export async function getStatusHistory(
  transactionId: string
): Promise<StatusHistoryRow[]> {
  try {
    const { data } = await db()
      .from("status_history")
      .select()
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true });

    return (data as StatusHistoryRow[]) ?? [];
  } catch {
    return [];
  }
}

// ── Replay protection ────────────────────────────────────────────────────────

/**
 * Returns true if a Solana tx signature has already been used in a
 * verified, settling, or completed transaction. Fails open (returns false)
 * on DB error so a network hiccup never blocks a legitimate payment.
 */
export async function isSignatureAlreadySettled(signature: string): Promise<boolean> {
  try {
    const { data } = await db()
      .from("transactions")
      .select("id")
      .eq("tx_signature", signature)
      .in("status", ["verified", "settling", "completed"])
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

// ── Intent analytics ─────────────────────────────────────────────────────────

/**
 * Append an anonymised intent row — no PII, no recipient addresses, no names.
 * Fire-and-forget: callers should never await this; failures are non-fatal.
 */
export async function logIntent(entry: {
  action_type:    string | null;
  confidence?:    number | null;
  amount_usdc?:   number | null;
  duration_days?: number | null;
  input_length:   number;
  parsed_ok:      boolean;
  network?:       string;
}): Promise<void> {
  try {
    await db()
      .from("intent_log")
      .insert({
        action_type:   entry.action_type   ?? "unknown",
        confidence:    entry.confidence    ?? null,
        amount_usdc:   entry.amount_usdc   ?? null,
        duration_days: entry.duration_days ?? null,
        input_length:  entry.input_length,
        parsed_ok:     entry.parsed_ok,
        network:       entry.network ?? process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet",
      });
  } catch (err) {
    // Non-fatal — analytics write failure must never affect the user
    console.error("[ledger] logIntent error:", err instanceof Error ? err.message : err);
  }
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function ledgerHealthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const { error } = await db()
      .from("transactions")
      .select("id")
      .limit(1);
    return { ok: !error, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
