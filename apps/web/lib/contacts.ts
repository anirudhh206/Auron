/**
 * Auron Contacts — Network Effects Engine
 *
 * Every time a user pays someone, we record them as a contact.
 * This creates the core network moat: "Send ₹500 to Priya" works
 * because Priya is in this table — no wallet address required.
 *
 * Network flywheel:
 *   User pays Priya → Priya is added as a contact
 *   If Priya later joins Auron → is_auron_user flips to true
 *   User sees "3 of your contacts are on Auron" → drives referral
 *   More contacts on Auron → UX gets better → retention improves
 */

import { createClient } from "./supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  upiId?: string;
  walletAddress?: string;
  displayName: string;
  avatarUrl?: string;
  txCount: number;
  lastPaidAt: string;
  isFavourite: boolean;
  isAuronUser: boolean;
}

export interface UpsertContactParams {
  ownerSupabaseUid: string;
  upiId?: string;
  walletAddress?: string;
  displayName: string;
}

// ─── Upsert contact after every payment ──────────────────────────────────────
// Called automatically after every successful transaction.
// Increments tx_count if contact already exists.
export async function upsertContact(params: UpsertContactParams): Promise<void> {
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_uid", params.ownerSupabaseUid)
    .single();

  if (!owner) return;

  // Try to find existing contact
  const matchField = params.upiId ? "upi_id" : "wallet_address";
  const matchValue = params.upiId ?? params.walletAddress;

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, tx_count")
    .eq("owner_user_id", owner.id)
    .eq(matchField, matchValue!)
    .single();

  if (existing) {
    await supabase
      .from("contacts")
      .update({ tx_count: existing.tx_count + 1, last_paid_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    // Check if this contact is already an Auron user
    const contactUserQuery = params.upiId
      ? supabase.from("users").select("id").eq("phone", params.upiId)
      : supabase.from("users").select("id").eq("wallet_address", params.walletAddress!);

    const { data: contactUser } = await contactUserQuery.single();

    await supabase.from("contacts").insert({
      owner_user_id: owner.id,
      upi_id: params.upiId ?? null,
      wallet_address: params.walletAddress ?? null,
      display_name: params.displayName,
      is_auron_user: !!contactUser,
      contact_user_id: contactUser?.id ?? null,
    });
  }
}

// ─── Resolve name → payment destination ──────────────────────────────────────
// Powers "send ₹500 to Priya" — returns UPI ID or wallet address from name.
export async function resolveContactByName(
  ownerSupabaseUid: string,
  name: string
): Promise<Contact | null> {
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("users").select("id").eq("supabase_uid", ownerSupabaseUid).single();
  if (!owner) return null;

  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_user_id", owner.id)
    .ilike("display_name", `%${name}%`)
    .order("tx_count", { ascending: false })
    .limit(1)
    .single();

  return data ? mapContact(data) : null;
}

// ─── Get all contacts (sorted by recency + frequency) ─────────────────────────

export async function getContacts(ownerSupabaseUid: string): Promise<Contact[]> {
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("users").select("id").eq("supabase_uid", ownerSupabaseUid).single();
  if (!owner) return [];

  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_user_id", owner.id)
    .order("last_paid_at", { ascending: false })
    .limit(50);

  return (data ?? []).map(mapContact);
}

// ─── Auron network size (for "X of your contacts are on Auron" prompt) ────────

export async function getAuronNetworkCount(ownerSupabaseUid: string): Promise<number> {
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("users").select("id").eq("supabase_uid", ownerSupabaseUid).single();
  if (!owner) return 0;

  const { count } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", owner.id)
    .eq("is_auron_user", true);

  return count ?? 0;
}

// ─── Mark contacts as Auron users (called when a new user joins) ──────────────
// When someone new registers, flip is_auron_user for all contacts that reference them.
export async function activateContactInNetworks(newUserSupabaseUid: string): Promise<void> {
  const supabase = await createClient();

  const { data: newUser } = await supabase
    .from("users")
    .select("id, wallet_address, phone")
    .eq("supabase_uid", newUserSupabaseUid)
    .single();

  if (!newUser) return;

  const updates: Array<Promise<unknown>> = [];

  if (newUser.wallet_address) {
    updates.push(
      (supabase.from("contacts")
        .update({ is_auron_user: true, contact_user_id: newUser.id })
        .eq("wallet_address", newUser.wallet_address) as unknown as Promise<unknown>)
    );
  }
  if (newUser.phone) {
    updates.push(
      (supabase.from("contacts")
        .update({ is_auron_user: true, contact_user_id: newUser.id })
        .eq("upi_id", newUser.phone) as unknown as Promise<unknown>)
    );
  }

  await Promise.all(updates);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    upiId: row.upi_id as string | undefined,
    walletAddress: row.wallet_address as string | undefined,
    displayName: row.display_name as string,
    avatarUrl: row.avatar_url as string | undefined,
    txCount: row.tx_count as number,
    lastPaidAt: row.last_paid_at as string,
    isFavourite: row.is_favourite as boolean,
    isAuronUser: row.is_auron_user as boolean,
  };
}
