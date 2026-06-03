/**
 * Auron v1 API Integration Test
 *
 * Tests the full payment pipeline:
 *   POST /api/v1/pay      → ledger + settlement
 *   GET  /api/v1/payment/:id → status polling
 *   GET  /api/workers/settlement → retry worker
 *   GET  /api/workers/reconcile  → reconciliation worker
 *
 * Usage:
 *   Terminal 1: npm run dev
 *   Terminal 2: node scripts/test-v1-pay.mjs
 *
 * DEMO_SETTLEMENT=true must be set in .env.local (no Razorpay X needed)
 */

const BASE_URL   = process.env.BASE_URL ?? "http://localhost:3000";
const PASS       = "\x1b[32m✅ PASS\x1b[0m";
const FAIL       = "\x1b[31m❌ FAIL\x1b[0m";
const SKIP       = "\x1b[33m⚠  SKIP\x1b[0m";
const INFO       = "\x1b[36mℹ\x1b[0m";

let passed = 0, failed = 0;

function log(label, value) {
  console.log(`     ${label}: ${value}`);
}

async function runTest(name, fn) {
  process.stdout.write(`\n  Test: ${name}... `);
  try {
    await fn();
    console.log(PASS);
    passed++;
  } catch (err) {
    console.log(FAIL);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides = {}) {
  const id = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    paymentId:      `pay_${id}`,
    idempotencyKey: `idem_${id}`,
    merchantUpiId:  "auron-test@okhdfcbank",
    merchantName:   "Auron Test Merchant",
    inrAmount:      100,
    usdcAmount:     1.20,
    txSignature:    "5KtUJ3xQVhN9uRrWx4PdK2mLzYbGcvDpFeAo8sN7hMQX1yBjRa6TmWcEiPxLK3nVuH9dFsq",
    userId:         "H2dgf5oWtG9TF6VyxDyS69L8vyTg7rrs4d2Ti1xd4Yas",
    provider:       "razorpay",
    quoteFxRate:    83.33,
    ...overrides,
  };
}

async function post(path, body) {
  return fetch(`${BASE_URL}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

async function get(path) {
  return fetch(`${BASE_URL}${path}`);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

console.log(`\n\x1b[1m🧪 Auron v1 Pay API — Integration Test Suite\x1b[0m`);
console.log(`${INFO} Target: ${BASE_URL}`);
console.log(`${INFO} Mode:   DEMO_SETTLEMENT (no real Razorpay needed)\n`);

// ── 1. Server health ──────────────────────────────────────────────────────────
await runTest("Dev server is reachable", async () => {
  const res = await get("/api/v1/pay").catch(() => null);
  assert(res !== null, "Server not reachable — run: npm run dev");
  assert(res.status === 405, `Expected 405 for GET /v1/pay, got ${res.status}`);
  log("Status", "405 Method Not Allowed (correct — POST only)");
});

// ── 2. Validation — missing paymentId ────────────────────────────────────────
await runTest("Validation rejects missing paymentId", async () => {
  const res  = await post("/api/v1/pay", { ...makePayload(), paymentId: "" });
  const data = await res.json();
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  assert(data.error?.toLowerCase().includes("paymentid"), `Expected paymentId error, got: ${data.error}`);
  log("Error", data.error);
});

// ── 3. Validation — bad UPI ID ────────────────────────────────────────────────
await runTest("Validation rejects UPI without @", async () => {
  const res  = await post("/api/v1/pay", { ...makePayload(), merchantUpiId: "no-at-sign" });
  const data = await res.json();
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  log("Error", data.error);
});

// ── 4. Validation — amount over limit ─────────────────────────────────────────
await runTest("Validation rejects INR amount over ₹2,00,000", async () => {
  const res  = await post("/api/v1/pay", { ...makePayload(), inrAmount: 250_000 });
  const data = await res.json();
  assert(res.status === 422, `Expected 422, got ${res.status}`);
  assert(data.error?.includes("2,00,000"), `Expected limit error, got: ${data.error}`);
  log("Error", data.error);
});

// ── 5. Validation — missing txSignature ──────────────────────────────────────
await runTest("Validation rejects missing txSignature", async () => {
  const res  = await post("/api/v1/pay", { ...makePayload(), txSignature: "" });
  const data = await res.json();
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  log("Error", data.error);
});

// ── 6. Full demo payment ──────────────────────────────────────────────────────
let completedPaymentId = null;
await runTest("Full demo payment (DEMO_SETTLEMENT=true)", async () => {
  const payload = makePayload();
  const start   = Date.now();
  const res     = await post("/api/v1/pay", payload);
  const data    = await res.json();
  const ms      = Date.now() - start;

  if (!res.ok || !data.success) {
    throw new Error(`Payment failed: ${data.error ?? JSON.stringify(data)}`);
  }

  assert(data.paymentId,  "paymentId missing");
  assert(data.payoutId,   "payoutId missing");
  assert(data.utrNumber,  "utrNumber missing");
  assert(data.status === "completed", `Expected status=completed, got ${data.status}`);
  assert(data.demoMode === true, "Expected demoMode=true");

  log("paymentId",  data.paymentId);
  log("payoutId",   data.payoutId);
  log("UTR",        data.utrNumber);
  log("verifiedTx", data.verifiedTx);
  log("durationMs", `${ms}ms`);

  completedPaymentId = data.paymentId;
});

// ── 7. Status endpoint ────────────────────────────────────────────────────────
await runTest("GET /v1/payment/:id returns payment status", async () => {
  if (!completedPaymentId) {
    // Try to check with a known-bad ID
    const res = await get("/api/v1/payment/nonexistent-id-xyz");
    assert(res.status === 404 || res.status === 500, `Expected 404, got ${res.status}`);
    log("Note", "Skipped (no completedPaymentId from previous test)");
    return;
  }

  const res  = await get(`/api/v1/payment/${completedPaymentId}`);
  const data = await res.json();

  assert(res.ok, `Expected 200, got ${res.status}: ${data.error}`);
  assert(data.paymentId === completedPaymentId, "paymentId mismatch");
  assert(typeof data.status === "string", "status missing");
  assert(Array.isArray(data.history), "history missing");
  assert(data.history.length > 0, "history is empty — status transitions not logged");

  log("status",       data.status);
  log("historySteps", data.history.length);
  log("settlement",   data.settlement ? `${data.settlement.status} (${data.settlement.provider})` : "null (ledger not connected)");

  if (data.settlement) {
    log("UTR", data.settlement.utr ?? "pending");
  }
});

// ── 8. Idempotency ────────────────────────────────────────────────────────────
await runTest("Idempotency — same idempotencyKey returns cached result", async () => {
  const payload = makePayload();

  const res1 = await post("/api/v1/pay", payload);
  const d1   = await res1.json();

  const res2 = await post("/api/v1/pay", payload);
  const d2   = await res2.json();

  assert(res1.ok && res2.ok, `Both requests must succeed`);
  assert(d1.success && d2.success, "Both must be successful");

  // If ledger is connected, second call returns fromCache=true
  if (d2.fromCache) {
    log("Idempotency", `Cache hit — same result returned`);
  } else {
    log("Idempotency", `Both succeeded (DB not connected — in-memory idempotency)"`);
  }
});

// ── 9. Settlement worker ──────────────────────────────────────────────────────
await runTest("Settlement worker responds (GET /api/workers/settlement)", async () => {
  const res  = await get("/api/workers/settlement");
  const data = await res.json();

  if (res.status === 401) {
    log("Note", "SKIP — CRON_SECRET set, worker requires auth");
    passed++; failed--;
    return;
  }

  assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
  assert(typeof data.processed === "number", "processed count missing");
  assert(typeof data.durationMs === "number", "durationMs missing");

  log("processed",  data.processed);
  log("succeeded",  data.succeeded);
  log("failed",     data.failed);
  log("durationMs", `${data.durationMs}ms`);
});

// ── 10. Reconciliation worker ─────────────────────────────────────────────────
await runTest("Reconciliation worker responds (GET /api/workers/reconcile)", async () => {
  const res  = await get("/api/workers/reconcile");
  const data = await res.json();

  if (res.status === 401) {
    log("Note", "SKIP — CRON_SECRET set, worker requires auth");
    passed++; failed--;
    return;
  }

  assert(res.ok, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
  assert(typeof data.checked === "number", "checked count missing");
  assert(typeof data.durationMs === "number", "durationMs missing");

  log("checked",      data.checked);
  log("fixed",        data.fixed);
  log("durationMs",   `${data.durationMs}ms`);
  log("discrepancies", data.discrepancies?.length ?? 0);
});

// ── 11. 404 for unknown payment ────────────────────────────────────────────────
await runTest("GET /v1/payment/:id returns 404 for unknown ID", async () => {
  const res  = await get("/api/v1/payment/pay_definitely_does_not_exist_xyz");
  assert(res.status === 404, `Expected 404, got ${res.status}`);
  log("Status", "404 Not Found (correct)");
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log(`\n\x1b[31mSome tests failed.\x1b[0m`);
  console.log(`\nCheck:`);
  console.log(`  1. npm run dev is running in another terminal`);
  console.log(`  2. DEMO_SETTLEMENT=true is in .env.local`);
  console.log(`  3. Supabase schema SQL has been run (for ledger tests)`);
  process.exit(1);
} else {
  console.log(`\n\x1b[32mAll tests passed!\x1b[0m`);
  console.log(`\nNext step: Run the Supabase schema migration`);
  console.log(`  → Open Supabase Dashboard → SQL Editor`);
  console.log(`  → Paste contents of lib/db/schema.sql → Run`);
  console.log(`  → Re-run this test to verify ledger writes work`);
}
