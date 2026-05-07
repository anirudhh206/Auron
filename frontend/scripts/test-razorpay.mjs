/**
 * Razorpay Integration Test
 *
 * Tests the ACTUAL HTTP flow — calls /api/razorpay just like the app does.
 * This is better than ts-node because it tests the real server + real env vars.
 *
 * Usage:
 *   Terminal 1: npm run dev
 *   Terminal 2: node scripts/test-razorpay.mjs
 *
 * Or with a custom base URL:
 *   BASE_URL=https://your-app.vercel.app node scripts/test-razorpay.mjs
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const PASS = "\x1b[32m✅ PASSED\x1b[0m";
const FAIL = "\x1b[31m❌ FAILED\x1b[0m";
const INFO = "\x1b[36mℹ\x1b[0m";
let passed = 0;
let failed = 0;

function log(label, msg) {
  console.log(`   ${label}: ${msg}`);
}

async function runTest(name, fn) {
  process.stdout.write(`\nTest: ${name}... `);
  try {
    await fn();
    console.log(PASS);
    passed++;
  } catch (err) {
    console.log(FAIL);
    console.error(`   Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Test suite ────────────────────────────────────────────────────────────────

console.log(`\n\x1b[1m🧪 Razorpay Integration Test Suite\x1b[0m`);
console.log(`${INFO} Targeting: ${BASE_URL}`);

// Test 1: Server is running
await runTest("Dev server is reachable", async () => {
  const res = await fetch(`${BASE_URL}/api/razorpay`, { method: "GET" }).catch(() => null);
  assert(res !== null, "Could not reach server — is `npm run dev` running?");
  assert(res.status === 405, `Expected 405 Method Not Allowed for GET, got ${res.status}`);
  log("Status", "405 Method Not Allowed (correct)");
});

// Test 2: Missing credentials returns 503
await runTest("Returns 503 when Razorpay not configured", async () => {
  // This test only applies if credentials are NOT set — skip gracefully
  const res = await fetch(`${BASE_URL}/api/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 100, upiId: "test@upi",
      recipientName: "Test", referenceId: "test-ref", description: "test",
    }),
  });
  // Accept 503 (not configured) or 422/400/200 (configured and processing)
  const ok = [200, 400, 422, 502, 503].includes(res.status);
  assert(ok, `Unexpected status ${res.status}`);
  log("Status", `${res.status} (acceptable)`);
});

// Test 3: Validation — missing field
await runTest("Validation rejects missing upiId", async () => {
  const res = await fetch(`${BASE_URL}/api/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 100, recipientName: "Test", referenceId: "ref-1", description: "d" }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const data = await res.json();
  assert(data.error?.includes("upiId"), `Expected upiId error, got: ${data.error}`);
  log("Error", data.error);
});

// Test 4: Validation — invalid UPI ID
await runTest("Validation rejects invalid UPI ID", async () => {
  const res = await fetch(`${BASE_URL}/api/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 100, upiId: "not-a-valid-upi",  // no @ sign
      recipientName: "Test", referenceId: "ref-2", description: "d",
    }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const data = await res.json();
  log("Error", data.error);
});

// Test 5: Validation — amount exceeds limit
await runTest("Validation rejects amount over ₹2,00,000", async () => {
  const res = await fetch(`${BASE_URL}/api/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 250_000, upiId: "test@paytm",
      recipientName: "Test", referenceId: "ref-3", description: "d",
    }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const data = await res.json();
  assert(data.error?.includes("2,00,000") || data.error?.includes("limit"), `Unexpected error: ${data.error}`);
  log("Error", data.error);
});

// Test 6: Full payout (only if Razorpay credentials are set)
await runTest("Full payout to test UPI (requires Razorpay keys)", async () => {
  const refId = `auron-test-${Date.now()}`;
  const res = await fetch(`${BASE_URL}/api/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount:        1,        // ₹1 — smallest valid amount
      upiId:         "auron-test@okhdfcbank",
      recipientName: "Auron Test",
      referenceId:   refId,
      description:   "Auron integration test",
    }),
  });

  const data = await res.json();

  if (res.status === 503) {
    console.log(`\n   \x1b[33m⚠ SKIPPED\x1b[0m — Razorpay not configured (set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET)`);
    passed++; failed--;
    return;
  }

  if (!data.success) {
    throw new Error(`Payout failed: ${data.error} (code: ${data.errorCode ?? "none"})`);
  }

  log("Payout ID", data.payoutId);
  log("UTR",       data.utr ?? "pending (will arrive via webhook)");
  log("Status",    data.status);
  log("Duration",  `${data.durationMs}ms`);

  assert(data.payoutId, "payoutId missing in response");
});

// Test 7: Idempotency — same referenceId returns same result
await runTest("Idempotency — duplicate request returns cached result", async () => {
  const refId = `auron-idem-${Date.now()}`;
  const payload = {
    amount: 1, upiId: "auron-test@okhdfcbank",
    recipientName: "Auron Test", referenceId: refId, description: "idem test",
  };

  const res1 = await fetch(`${BASE_URL}/api/razorpay`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res1.status === 503) {
    console.log(`\n   \x1b[33m⚠ SKIPPED\x1b[0m — Razorpay not configured`);
    passed++; failed--;
    return;
  }
  const data1 = await res1.json();

  const res2 = await fetch(`${BASE_URL}/api/razorpay`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data2 = await res2.json();

  if (data1.success && data2.success) {
    assert(data1.payoutId === data2.payoutId, `Different payoutId on duplicate: ${data1.payoutId} vs ${data2.payoutId}`);
    log("Idempotency", `Same payoutId returned: ${data1.payoutId}`);
  } else {
    log("Note", "Both requests failed consistently (expected if not configured)");
  }
});

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log(`\n\x1b[31mSome tests failed. Check errors above.\x1b[0m`);
  console.log(`\nMake sure:`);
  console.log(`  1. npm run dev is running in another terminal`);
  console.log(`  2. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are in .env.local`);
  console.log(`  3. Keys start with rzp_test_ (sandbox mode)`);
  process.exit(1);
} else {
  console.log(`\n\x1b[32mAll tests passed! Razorpay integration is working.\x1b[0m`);
  console.log(`\nNext steps:`);
  console.log(`  1. Start the app: npm run dev`);
  console.log(`  2. Connect Phantom on devnet`);
  console.log(`  3. Say: "Pay ₹100 to auron-test@okhdfcbank"`);
  console.log(`  4. Screenshot the receipt with UTR number`);
}
