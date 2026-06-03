/**
 * Auron Recipient Resolver — client-side
 *
 * Resolves any human-readable identifier to a Solana wallet address
 * before a transaction is built. Resolution order:
 *
 *   1. Already a valid Solana address → return as-is (instant)
 *   2. Ends in .sol                   → SNS lookup via /api/resolve-recipient
 *   3. Looks like a phone number      → Supabase users lookup via /api/resolve-recipient
 *   4. Anything else                  → throw, ask user to clarify
 *
 * Usage (in ChatInterface.tsx before buildTransferSOL / buildTransferUSDC):
 *
 *   const resolved = await resolveRecipient(action.recipient);
 *   // resolved.address  → Solana public key string
 *   // resolved.display  → "priya.sol" or "Priya Sharma" (show in confirm card)
 *   // resolved.type     → "wallet" | "sol_domain" | "phone"
 */

export type RecipientType = "wallet" | "sol_domain" | "phone";

export interface ResolvedRecipient {
  address: string;       // Solana base58 public key — ready to use in a transaction
  display: string;       // Human-readable label for the confirm card UI
  type: RecipientType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidSolanaAddress(s: string): boolean {
  // Base58, 32–44 chars — quick client-side pre-check before hitting the API
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
}

function isSolDomain(s: string): boolean {
  return s.trim().toLowerCase().endsWith(".sol");
}

function isPhoneNumber(s: string): boolean {
  return /^\+?[\d\s\-().]{7,15}$/.test(s.trim());
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export async function resolveRecipient(raw: string): Promise<ResolvedRecipient> {
  const input = raw.trim();

  if (!input) throw new Error("Recipient cannot be empty.");

  // Fast path — already a valid wallet address
  if (isValidSolanaAddress(input)) {
    return {
      address: input,
      display: `${input.slice(0, 4)}…${input.slice(-4)}`,
      type: "wallet",
    };
  }

  // Everything else goes through the server-side resolver
  if (!isSolDomain(input) && !isPhoneNumber(input)) {
    throw new Error(
      `"${input}" isn't a Solana address, .sol domain, or phone number. ` +
      `Ask for their wallet address, .sol domain, or registered phone number.`
    );
  }

  const res = await fetch("/api/resolve-recipient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: input }),
  });

  const data = await res.json() as {
    address?: string;
    display?: string;
    type?: RecipientType;
    error?: string;
    hint?: string;
  };

  if (!res.ok || !data.address) {
    // Surface a clean, user-facing error
    if (data.hint === "not_registered") {
      throw new Error(data.error ?? "This phone number isn't registered on Auron.");
    }
    throw new Error(data.error ?? `Could not resolve "${input}".`);
  }

  return {
    address: data.address,
    display: data.display ?? input,
    type: data.type ?? "wallet",
  };
}

// ─── Batch resolver (for future contact suggestions) ─────────────────────────

export async function resolveRecipientSafe(
  raw: string
): Promise<ResolvedRecipient | { error: string }> {
  try {
    return await resolveRecipient(raw);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not resolve recipient." };
  }
}
