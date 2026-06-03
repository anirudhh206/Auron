/**
 * In-memory store for OnMeta webhook UTR confirmations.
 * Shared between the webhook receiver and the offramp status poller.
 */
export const webhookUTRStore = new Map<string, {
  utrNumber: string;
  payoutId: string;
  confirmedAt: number;
  event: string;
}>();
