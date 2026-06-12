# @auron/sdk

TypeScript SDK for the [Auron](https://auron-mocha.vercel.app) settlement infrastructure — send USDC from a Solana wallet and deliver INR to any UPI account in seconds.

```bash
npm install @auron/sdk
```

---

## How it works

1. Your app calls `getQuote(inrAmount)` to get the live USDC amount
2. The user signs a Solana USDC transfer to the Auron treasury
3. You call `pay()` with the confirmed transaction signature
4. Auron verifies the on-chain transfer and routes INR to the merchant's UPI account
5. `waitForCompletion()` polls until you have the bank UTR

---

## Quick start

```ts
import { AuronClient } from '@auron/sdk';

const client = new AuronClient({
  apiKey:  'your-api-key',
  baseUrl: 'https://auron-mocha.vercel.app', // default
});

// 1. Get a live quote
const quote = await client.getQuote(500);
// → { usdcAmount: 5.29, auronRate: 94.54, expiresAt: ... }

// 2. Sign the Solana USDC transfer in your wallet (outside SDK scope)
const sig = await wallet.sendUsdc(AURON_TREASURY_ADDRESS, quote.usdcAmount);

// 3. Submit the payment
const payment = await client.pay({
  merchantUpiId: 'merchant@paytm',
  merchantName:  'Swiggy',
  inrAmount:     500,
  usdcAmount:    quote.usdcAmount,
  txSignature:   sig,
  userId:        wallet.publicKey,
});

// 4. Wait for settlement and get the UTR
const final = await client.waitForCompletion(payment.paymentId, {
  onPoll: (s) => console.log('status:', s.status),
});

console.log('UTR:', final.settlement?.utr);       // YESB...
console.log('Solscan:', `https://solscan.io/tx/${payment.txSignature}`);
```

---

## API reference

### `new AuronClient(config)`

```ts
const client = new AuronClient({
  apiKey:    string,   // required — from your Auron dashboard
  baseUrl?:  string,   // default: https://auron-mocha.vercel.app
  timeoutMs?: number,  // default: 30000
});
```

---

### `client.getQuote(inrAmount)`

Get a live USDC quote for an INR amount. The quote expires in 60 seconds.

```ts
const quote = await client.getQuote(500);
```

```ts
interface QuoteResponse {
  usdcAmount:    number;  // USDC to send (includes 0.85% spread)
  marketRate:    number;  // raw CoinGecko INR/USDC rate
  auronRate:     number;  // rate after spread
  spreadPercent: number;  // 0.85
  quotedAt:      string;  // ISO timestamp
  expiresAt:     number;  // Unix ms — quote valid for 60s
}
```

---

### `client.pay(input)`

Submit a confirmed USDC→INR payment. The Solana transaction must already be signed and confirmed before calling this.

```ts
const payment = await client.pay({
  merchantUpiId: 'merchant@paytm',  // required — must contain @
  merchantName:  'Swiggy',          // required
  inrAmount:     500,               // required — INR amount
  usdcAmount:    5.29,              // required — from getQuote()
  txSignature:   'sig...',          // required — confirmed Solana tx
  userId:        'wallet-pubkey',   // required — sender's wallet address
  idempotencyKey?: string,          // optional — auto-generated if omitted
  quoteFxRate?:    number,          // optional — for slippage guard
});
```

```ts
interface PaymentResponse {
  paymentId:    string;
  status:       PaymentStatus;
  usdcAmount:   number;
  inrAmount:    number;
  fxRate?:      number;
  txSignature:  string;
  utr?:         string;   // bank UTR — available after settlement
  createdAt:    string;
}
```

---

### `client.getPayment(paymentId)`

Fetch the current status of a payment.

```ts
const status = await client.getPayment(payment.paymentId);

console.log(status.status);           // 'settling' | 'completed' | ...
console.log(status.settlement?.utr);  // bank UTR when completed
console.log(status.history);          // full state transition log
```

---

### `client.waitForCompletion(paymentId, options?)`

Poll until the payment reaches `completed`, `failed`, or `refunded`.

```ts
const final = await client.waitForCompletion(payment.paymentId, {
  intervalMs: 2000,   // poll every 2s (default)
  timeoutMs:  60000,  // give up after 60s (default)
  onPoll: (s) => console.log(s.status),
});
```

Throws `AuronError` with code `"TIMEOUT"` if the payment doesn't settle within `timeoutMs`.

---

### `client.parseIntent(message, options?)`

Parse a natural-language payment instruction using Claude AI. Returns a structured intent with security flags.

```ts
const result = await client.parseIntent('send ₹500 to priya@upi', {
  userId:         'wallet-pubkey',  // for rate limiting
  spendCeiling:   10000,            // user's INR spend limit
  thirtyDayAvg:   2000,             // for anomaly detection
  isNewRecipient: true,
});

if (result.type === 'action') {
  console.log(result.action?.action);     // 'upi_payment'
  console.log(result.action?.recipient);  // 'priya@upi'
  console.log(result.action?.amount);     // 500
  console.log(result.securityFlags);      // [] or [{ type: 'NEW_RECIPIENT_LARGE', ... }]
}

if (result.type === 'clarification') {
  console.log(result.question); // "Which UPI account should I send to?"
}
```

---

## Payment statuses

| Status | Meaning |
|---|---|
| `initiated` | Payment record created |
| `quoted` | FX rate locked |
| `signed` | Solana tx received |
| `verified` | On-chain USDC transfer confirmed |
| `settling` | INR payout dispatched to provider |
| `completed` | INR delivered, bank UTR issued |
| `failed` | Settlement failed (see history) |
| `refunded` | USDC returned to sender |

---

## Error handling

All errors are instances of `AuronError` with a typed `code` field.

```ts
import { AuronClient, AuronError, isAuronError } from '@auron/sdk';

try {
  await client.pay({ ... });
} catch (err) {
  if (isAuronError(err)) {
    switch (err.code) {
      case 'INVALID_UPI_ID':         // bad UPI ID format
      case 'PAYMENT_LIMIT_EXCEEDED': // above ₹2L per-tx cap
      case 'INSUFFICIENT_LIQUIDITY': // treasury reserve too low
      case 'TX_VERIFICATION_FAILED': // Solana tx not confirmed
      case 'RATE_LIMITED':           // slow down
      case 'TIMEOUT':                // retry (err.retryable === true)
    }
    console.log(err.retryable); // true = safe to retry
    console.log(err.status);    // HTTP status code
  }
}
```

---

## TypeScript

The SDK ships full type definitions. No `@types/` package needed.

```ts
import type {
  AuronConfig,
  PaymentInput,
  PaymentResponse,
  PaymentStatus,
  PaymentStatusResponse,
  QuoteResponse,
  IntentResponse,
  ParsedIntent,
  SecurityFlag,
  WaitOptions,
} from '@auron/sdk';
```

---

## Requirements

- Node.js 18+ or any modern browser (uses `fetch` and `AbortController`)
- An Auron API key

---

## License

MIT
