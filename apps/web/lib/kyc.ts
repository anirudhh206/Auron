/**
 * Auron KYC Engine
 *
 * India requires AML/KYC compliance for any crypto-to-fiat payment service.
 * This module gates UPI payments behind identity verification.
 *
 * Provider strategy (swappable via KYC_PROVIDER env var):
 *   - 'sumsub'     → Global KYC leader, used by Binance / Coinbase. SDK available.
 *   - 'idfy'       → India-specific. Supports Aadhaar OTP + PAN verification.
 *   - 'digilocker' → Government of India's official digital locker. Highest trust.
 *
 * For devnet / demo mode: set KYC_PROVIDER=demo — bypasses verification.
 * For production:         set KYC_PROVIDER=sumsub + SUMSUB_APP_TOKEN + SUMSUB_SECRET_KEY
 *
 * KYC Tiers (maps to RBI payment limits):
 *   unverified  → ₹0/day   (no UPI payments, only wallet-to-wallet)
 *   pending     → ₹0/day   (documents submitted, under review)
 *   approved    → ₹5,000/day default (upgradeable to ₹50,000/day with enhanced KYC)
 *   rejected    → ₹0/day   (must resubmit)
 */

import { createClient } from "./supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KycStatus = "unverified" | "pending" | "approved" | "rejected" | "manual_review";

export interface KycState {
  status: KycStatus;
  dailyLimitInr: number;
  monthlyLimitInr: number;
  canMakeUpiPayments: boolean;
  rejectionReason?: string;
  verifiedAt?: string;
}

export interface KycInitResult {
  applicantId: string;   // provider's reference ID
  sdkToken?: string;     // Sumsub SDK token for frontend flow
  redirectUrl?: string;  // DigiLocker redirect URL
}

// ─── KYC gate check ───────────────────────────────────────────────────────────
// Call this before every UPI payment. Returns current KYC state.
export async function getKycState(supabaseUid: string): Promise<KycState> {
  // Demo / devnet bypass
  if (process.env.KYC_PROVIDER === "demo" || process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet") {
    return {
      status: "approved",
      dailyLimitInr: 5000,
      monthlyLimitInr: 50000,
      canMakeUpiPayments: true,
    };
  }

  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("kyc_status, daily_limit_inr, monthly_limit_inr, kyc_rejected_at, kyc_rejection_reason, kyc_verified_at")
    .eq("supabase_uid", supabaseUid)
    .single();

  if (error || !user) {
    return { status: "unverified", dailyLimitInr: 0, monthlyLimitInr: 0, canMakeUpiPayments: false };
  }

  const status = user.kyc_status as KycStatus;
  return {
    status,
    dailyLimitInr: Number(user.daily_limit_inr),
    monthlyLimitInr: Number(user.monthly_limit_inr),
    canMakeUpiPayments: status === "approved",
    rejectionReason: user.kyc_rejection_reason ?? undefined,
    verifiedAt: user.kyc_verified_at ?? undefined,
  };
}

// ─── Initiate KYC flow ────────────────────────────────────────────────────────
// Creates an applicant record with the provider and returns the SDK token
// (Sumsub) or redirect URL (DigiLocker) for the frontend to launch the flow.
export async function initiateKyc(
  supabaseUid: string,
  provider: "sumsub" | "idfy" | "digilocker" = "sumsub"
): Promise<KycInitResult> {
  const supabase = await createClient();

  // Ensure user row exists
  await supabase.from("users").upsert(
    { supabase_uid: supabaseUid, kyc_status: "pending", kyc_provider: provider },
    { onConflict: "supabase_uid", ignoreDuplicates: false }
  );

  if (provider === "sumsub") {
    return initiateSumsub(supabaseUid);
  }
  if (provider === "digilocker") {
    return initiateDigiLocker(supabaseUid);
  }
  throw new Error(`Unsupported KYC provider: ${provider}`);
}

// ─── Sumsub integration ───────────────────────────────────────────────────────

async function initiateSumsub(userId: string): Promise<KycInitResult> {
  const appToken = process.env.SUMSUB_APP_TOKEN;
  const secretKey = process.env.SUMSUB_SECRET_KEY;

  if (!appToken || !secretKey) throw new Error("Sumsub credentials not configured");

  // Create applicant
  const applicantRes = await fetch("https://api.sumsub.com/resources/applicants?levelName=basic-kyc-level", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": appToken,
    },
    body: JSON.stringify({
      externalUserId: userId,
      lang: "en",
      requiredIdDocs: {
        docSets: [
          { idDocSetType: "IDENTITY", types: ["ID_CARD", "PASSPORT", "DRIVERS"], subTypes: ["FRONT_SIDE", "BACK_SIDE"] },
          { idDocSetType: "SELFIE", types: ["SELFIE"] },
        ],
      },
    }),
  });

  if (!applicantRes.ok) throw new Error(`Sumsub applicant creation failed: ${applicantRes.statusText}`);
  const applicant = await applicantRes.json() as { id: string };

  // Get SDK access token (expires in 10 min — frontend launches SDK immediately)
  const tokenRes = await fetch(
    `https://api.sumsub.com/resources/accessTokens?userId=${userId}&levelName=basic-kyc-level&ttlInSecs=600`,
    {
      method: "POST",
      headers: { "X-App-Token": appToken },
    }
  );

  if (!tokenRes.ok) throw new Error(`Sumsub token fetch failed: ${tokenRes.statusText}`);
  const tokenData = await tokenRes.json() as { token: string };

  return { applicantId: applicant.id, sdkToken: tokenData.token };
}

// ─── DigiLocker integration ───────────────────────────────────────────────────

async function initiateDigiLocker(userId: string): Promise<KycInitResult> {
  const clientId = process.env.DIGILOCKER_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/kyc/digilocker/callback`;

  if (!clientId) throw new Error("DigiLocker credentials not configured");

  const state = Buffer.from(JSON.stringify({ uid: userId, ts: Date.now() })).toString("base64url");

  const redirectUrl = `https://digilocker.gov.in/public/oauth2/1/authorize?` +
    `response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}&dl_flow=signup`;

  return { applicantId: `digilocker_${userId}`, redirectUrl };
}

// ─── Webhook handler (called by provider on status change) ───────────────────

export async function handleKycWebhook(
  provider: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();

  if (provider === "sumsub") {
    const { applicantId, type, reviewResult } = payload as {
      applicantId: string;
      type: string;
      reviewResult?: { reviewAnswer: string; rejectLabels?: string[] };
    };

    if (type !== "applicantReviewed") return;

    const newStatus: KycStatus =
      reviewResult?.reviewAnswer === "GREEN" ? "approved" :
      reviewResult?.reviewAnswer === "RED"   ? "rejected" : "manual_review";

    await supabase
      .from("users")
      .update({
        kyc_status: newStatus,
        kyc_reference_id: applicantId,
        kyc_verified_at:  newStatus === "approved" ? new Date().toISOString() : null,
        kyc_rejected_at:  newStatus === "rejected"  ? new Date().toISOString() : null,
        kyc_rejection_reason: reviewResult?.rejectLabels?.join(", ") ?? null,
        // Upgrade limits on approval
        daily_limit_inr:   newStatus === "approved" ? 5000   : 0,
        monthly_limit_inr: newStatus === "approved" ? 50000  : 0,
      })
      .eq("kyc_reference_id", applicantId);

    await supabase.from("kyc_submissions").update({
      status: newStatus === "approved" ? "approved" : "rejected",
      rejection_reason: reviewResult?.rejectLabels?.join(", ") ?? null,
      reviewed_at: new Date().toISOString(),
      raw_response: payload,
    }).eq("provider_ref", applicantId);
  }
}
