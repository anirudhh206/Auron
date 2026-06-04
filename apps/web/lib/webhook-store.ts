/**
 * @deprecated
 *
 * This in-memory store is no longer used for production webhook handling.
 * The OnMeta webhook handler now writes directly to Supabase so confirmations
 * persist across all Vercel invocations.
 *
 * This stub is kept only so existing imports don't break at compile time.
 * Remove once all callers have been updated to read UTR from the ledger.
 */
export const webhookUTRStore = new Map<string, {
  utrNumber:   string;
  payoutId:    string;
  confirmedAt: number;
  event:       string;
}>();
