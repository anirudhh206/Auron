/**
 * @auron/sdk — TypeScript SDK for the Auron Settlement Infrastructure
 *
 * Auron settles USDC payments from Solana wallets to Indian UPI accounts in seconds.
 * This SDK wraps the Auron API for use in browser and Node.js applications.
 *
 * @example
 * ```ts
 * import { AuronClient } from '@auron/sdk';
 *
 * const client = new AuronClient({ apiKey: 'your-api-key' });
 *
 * // 1. Get a quote
 * const quote = await client.getQuote(500); // ₹500 → X USDC
 *
 * // 2. Sign the Solana USDC transfer in your wallet (outside SDK scope)
 * const sig = await wallet.sendUsdc(AURON_TREASURY, quote.usdcAmount);
 *
 * // 3. Submit
 * const payment = await client.pay({
 *   merchantUpiId: 'merchant@paytm',
 *   merchantName:  'Swiggy',
 *   inrAmount:     500,
 *   usdcAmount:    quote.usdcAmount,
 *   txSignature:   sig,
 *   userId:        wallet.publicKey,
 * });
 *
 * // 4. Wait for settlement
 * const final = await client.waitForCompletion(payment.paymentId);
 * console.log('UTR:', final.settlement?.utr);
 * ```
 */

export { AuronClient } from './client';
export { AuronError, isAuronError } from './errors';
export type {
  AuronConfig,
  PaymentInput,
  PaymentResponse,
  PaymentStatus,
  PaymentStatusResponse,
  QuoteResponse,
  ParseIntentOptions,
  ParsedIntent,
  IntentResponse,
  SecurityFlag,
  WaitOptions,
} from './types';
