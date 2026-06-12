/**
 * Quick smoke test for @auron/sdk
 * Run: node test-smoke.mjs
 * Requires the Auron dev server running at localhost:3000
 */

import { AuronClient, AuronError, isAuronError } from './dist/index.mjs';

const BASE_URL = 'http://localhost:3000';
const API_KEY  = 'demo';          // dev server accepts "demo" key

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}
function fail(label, err) {
  console.log(`  ✗  ${label}: ${err?.message ?? err}`);
  failed++;
}

// ── 1. Instantiation ──────────────────────────────────────────────────────────
console.log('\n── Instantiation ──');
try {
  const c = new AuronClient({ apiKey: API_KEY, baseUrl: BASE_URL });
  ok('AuronClient instantiates');
  void c; // used
} catch (e) { fail('AuronClient instantiates', e); }

try {
  new AuronClient({ apiKey: '' });
  fail('throws on empty apiKey', new Error('did not throw'));
} catch (e) {
  if (isAuronError(e) && e.code === 'INVALID_API_KEY') ok('throws INVALID_API_KEY on empty key');
  else fail('throws INVALID_API_KEY on empty key', e);
}

// ── 2. getQuote ───────────────────────────────────────────────────────────────
console.log('\n── getQuote ──');
const client = new AuronClient({ apiKey: API_KEY, baseUrl: BASE_URL });
try {
  const quote = await client.getQuote(500);
  if (typeof quote.usdcAmount !== 'number' || quote.usdcAmount <= 0)
    throw new Error(`bad usdcAmount: ${quote.usdcAmount}`);
  if (typeof quote.auronRate !== 'number' || quote.auronRate <= 0)
    throw new Error(`bad auronRate: ${quote.auronRate}`);
  if (typeof quote.expiresAt !== 'number')
    throw new Error('expiresAt missing');
  ok(`getQuote(500) → ${quote.usdcAmount} USDC @ ₹${quote.auronRate}`);
} catch (e) { fail('getQuote(500)', e); }

try {
  await client.getQuote(-1);
  fail('throws on negative amount', new Error('did not throw'));
} catch (e) {
  if (isAuronError(e)) ok('throws AuronError on negative amount');
  else fail('throws AuronError on negative amount', e);
}

// ── 3. parseIntent ────────────────────────────────────────────────────────────
console.log('\n── parseIntent ──');
try {
  const result = await client.parseIntent('send ₹200 to test@upi', { userId: 'sdk-test' });
  if (!result.type) throw new Error('no type in response');
  ok(`parseIntent → type="${result.type}" action="${result.action?.action ?? 'n/a'}"`);
} catch (e) { fail('parseIntent basic', e); }

try {
  await client.parseIntent('');
  fail('throws on empty message', new Error('did not throw'));
} catch (e) {
  if (isAuronError(e)) ok('throws AuronError on empty message');
  else fail('throws AuronError on empty message', e);
}

try {
  await client.parseIntent('x'.repeat(501));
  fail('throws on too-long message', new Error('did not throw'));
} catch (e) {
  if (isAuronError(e)) ok('throws AuronError on 501-char message');
  else fail('throws AuronError on 501-char message', e);
}

// ── 4. getPayment (404 path) ──────────────────────────────────────────────────
console.log('\n── getPayment ──');
try {
  await client.getPayment('nonexistent-id-12345');
  fail('throws on unknown paymentId', new Error('did not throw'));
} catch (e) {
  if (isAuronError(e) && (e.code === 'PAYMENT_NOT_FOUND' || e.status === 404))
    ok('throws PAYMENT_NOT_FOUND for unknown ID');
  else fail('throws PAYMENT_NOT_FOUND for unknown ID', e);
}

// ── 5. pay() validation (no real tx) ─────────────────────────────────────────
console.log('\n── pay() validation ──');
try {
  await client.pay({ merchantUpiId: 'noupisign', merchantName: 'Test', inrAmount: 100, usdcAmount: 1.2, txSignature: 'sig', userId: 'wallet' });
  fail('throws on invalid UPI ID', new Error('did not throw'));
} catch (e) {
  if (isAuronError(e) && e.code === 'INVALID_UPI_ID') ok('throws INVALID_UPI_ID');
  else fail('throws INVALID_UPI_ID', e);
}

try {
  await client.pay({ merchantUpiId: 'test@upi', merchantName: 'Test', inrAmount: -1, usdcAmount: 1.2, txSignature: 'sig', userId: 'wallet' });
  fail('throws on negative inrAmount', new Error('did not throw'));
} catch (e) {
  if (isAuronError(e)) ok('throws AuronError on negative inrAmount');
  else fail('throws AuronError on negative inrAmount', e);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
