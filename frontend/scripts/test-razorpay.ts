/**
 * Razorpay Payout Test Script
 *
 * Usage:
 *   npx ts-node scripts/test-razorpay.ts
 *
 * Tests:
 *   1. API credentials are set
 *   2. Contact creation works
 *   3. Fund account creation works
 *   4. Payout initiation works
 *   5. Response is cached on retry
 */

import { initiateRazorpayPayout } from "../lib/razorpay";

async function runTests() {
  console.log("🧪 Razorpay Integration Test Suite\n");

  // ── Test 1: Check credentials ──────────────────────────────────────────────
  console.log("Test 1: Checking API credentials...");
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("❌ FAILED: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set");
    console.error("   Set these env vars first:");
    console.error("   export RAZORPAY_KEY_ID=rzp_test_xxxxx");
    console.error("   export RAZORPAY_KEY_SECRET=xxxxx");
    process.exit(1);
  }
  console.log(`✅ PASSED: Found credentials`);
  console.log(`   Key ID: ${keyId.slice(0, 15)}...`);
  console.log(`   Key Secret: ${keySecret.slice(0, 10)}...`);

  // ── Test 2: Initiate a test payout ────────────────────────────────────────
  console.log("\nTest 2: Initiating test payout...");
  const testId = `test-${Date.now()}`;
  const result = await initiateRazorpayPayout({
    amount: 100,
    upiId: "auron-test@okhdfcbank",
    recipientName: "Auron Test",
    referenceId: testId,
    description: "Test payout from Auron",
  });

  if (result.success) {
    console.log(`✅ PASSED: Payout initiated successfully`);
    console.log(`   Payout ID: ${result.payoutId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   UTR: ${result.utr ?? "pending"}`);
  } else {
    console.error(`❌ FAILED: ${result.error}`);
    console.error(`   Error Code: ${result.errorCode ?? "none"}`);
    console.error(`   Retryable: ${result.retryable}`);
    process.exit(1);
  }

  // ── Test 3: Verify idempotency (cache hit) ────────────────────────────────
  console.log("\nTest 3: Testing idempotency (should return cached result)...");
  const result2 = await initiateRazorpayPayout({
    amount: 100,
    upiId: "auron-test@okhdfcbank",
    recipientName: "Auron Test",
    referenceId: testId,
    description: "Duplicate test payout",
  });

  if (result2.payoutId === result.payoutId) {
    console.log(`✅ PASSED: Idempotency works (same payout ID returned)`);
  } else {
    console.error(`❌ FAILED: Different payout ID returned on duplicate request`);
    console.error(`   First: ${result.payoutId}, Second: ${result2.payoutId}`);
    process.exit(1);
  }

  // ── Success ────────────────────────────────────────────────────────────────
  console.log("\n✅ All tests passed!");
  console.log("\nYou can now use Razorpay payouts in Auron.");
  console.log("Next: Run the full app and test an end-to-end payment.");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
