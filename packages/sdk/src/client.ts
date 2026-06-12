/**
 * @auron/sdk — AuronClient
 */

import type {
  AuronConfig,
  PaymentInput,
  PaymentResponse,
  PaymentStatusResponse,
  QuoteResponse,
  ParseIntentOptions,
  IntentResponse,
  WaitOptions,
} from './types';
import { AuronError } from './errors';

const DEFAULT_BASE_URL = 'https://auron-mocha.vercel.app';
const DEFAULT_TIMEOUT_MS = 30_000;

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}${rand}`;
}

export class AuronClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: AuronConfig) {
    if (!config.apiKey) throw new AuronError('apiKey is required', 'INVALID_API_KEY');
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // ── Private fetch wrapper ──────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AuronError(`Request timed out after ${this.timeoutMs}ms`, 'TIMEOUT', undefined, true);
      }
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new AuronError(msg, 'NETWORK_ERROR', undefined, true);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      const message = (data.error as string | undefined) ?? res.statusText;
      throw new AuronError(
        message,
        httpStatusToCode(res.status),
        res.status,
        res.status >= 500 || res.status === 429,
      );
    }

    return res.json() as Promise<T>;
  }

  // ── Quote ──────────────────────────────────────────────────────────────────

  /**
   * Get a live USDC quote for an INR amount.
   * Call this before signing the Solana transaction to know how much USDC to send.
   *
   * @example
   * const quote = await client.getQuote(500);
   * // quote.usdcAmount is what your user signs on Solana
   */
  async getQuote(inrAmount: number): Promise<QuoteResponse> {
    if (!inrAmount || inrAmount <= 0) {
      throw new AuronError('inrAmount must be a positive number', 'VALIDATION_ERROR');
    }

    interface RawRate { auronRate: number; marketRate: number; spreadPercent: number }
    const rate = await this.request<RawRate>('GET', '/api/rate');

    const usdcAmount = parseFloat((inrAmount / rate.auronRate).toFixed(6));
    const now = Date.now();

    return {
      usdcAmount,
      marketRate: rate.marketRate,
      auronRate: rate.auronRate,
      spreadPercent: rate.spreadPercent,
      quotedAt: new Date(now).toISOString(),
      expiresAt: now + 60_000,
    };
  }

  // ── Payment initiation ─────────────────────────────────────────────────────

  /**
   * Submit a confirmed USDC→INR payment to the Auron settlement pipeline.
   *
   * You must:
   * 1. Call `getQuote(inrAmount)` to get `usdcAmount`
   * 2. Have the user sign a Solana USDC transfer to the Auron treasury for that amount
   * 3. Pass the confirmed `txSignature` here
   *
   * @example
   * const quote  = await client.getQuote(500);
   * const sig    = await wallet.sendUsdc(treasuryAddress, quote.usdcAmount);
   * const result = await client.pay({
   *   merchantUpiId: 'merchant@paytm',
   *   merchantName:  'Swiggy',
   *   inrAmount:     500,
   *   usdcAmount:    quote.usdcAmount,
   *   txSignature:   sig,
   *   userId:        wallet.publicKey,
   * });
   */
  async pay(input: PaymentInput): Promise<PaymentResponse> {
    if (!input.merchantUpiId?.includes('@')) {
      throw new AuronError('merchantUpiId must be a valid UPI ID (e.g. merchant@paytm)', 'INVALID_UPI_ID');
    }
    if (!input.merchantName?.trim()) {
      throw new AuronError('merchantName is required', 'VALIDATION_ERROR');
    }
    if (!input.inrAmount || input.inrAmount <= 0) {
      throw new AuronError('inrAmount must be a positive number', 'VALIDATION_ERROR');
    }
    if (!input.usdcAmount || input.usdcAmount <= 0) {
      throw new AuronError('usdcAmount must be a positive number — get it from getQuote()', 'VALIDATION_ERROR');
    }
    if (!input.txSignature?.trim()) {
      throw new AuronError('txSignature is required — sign the USDC transfer on Solana first', 'VALIDATION_ERROR');
    }
    if (!input.userId?.trim()) {
      throw new AuronError('userId (wallet public key) is required', 'VALIDATION_ERROR');
    }

    const paymentId = generateId();
    const idempotencyKey = input.idempotencyKey ?? generateId();

    interface RawPayResponse {
      paymentId: string;
      status: string;
      usdcAmount: number;
      inrAmount: number;
      fxRate?: number;
      txSignature: string;
      utr?: string;
      createdAt: string;
    }

    const data = await this.request<RawPayResponse>('POST', '/api/v1/pay', {
      paymentId,
      idempotencyKey,
      merchantUpiId: input.merchantUpiId.trim(),
      merchantName: input.merchantName.trim(),
      inrAmount: input.inrAmount,
      usdcAmount: input.usdcAmount,
      txSignature: input.txSignature.trim(),
      userId: input.userId.trim(),
      quoteFxRate: input.quoteFxRate,
    });

    return {
      paymentId: data.paymentId,
      status: data.status as PaymentResponse['status'],
      usdcAmount: data.usdcAmount,
      inrAmount: data.inrAmount,
      fxRate: data.fxRate,
      txSignature: data.txSignature,
      utr: data.utr,
      createdAt: data.createdAt,
    };
  }

  // ── Status polling ─────────────────────────────────────────────────────────

  /**
   * Fetch the current status of a payment.
   */
  async getPayment(paymentId: string): Promise<PaymentStatusResponse> {
    if (!paymentId?.trim()) {
      throw new AuronError('paymentId is required', 'VALIDATION_ERROR');
    }
    return this.request<PaymentStatusResponse>('GET', `/api/v1/payment/${encodeURIComponent(paymentId)}`);
  }

  /**
   * Poll until a payment reaches `completed` or `failed`, then return the final status.
   *
   * @example
   * const final = await client.waitForCompletion(payment.paymentId, {
   *   onPoll: (s) => console.log('status:', s.status),
   * });
   * console.log('UTR:', final.settlement?.utr);
   */
  async waitForCompletion(
    paymentId: string,
    options: WaitOptions = {},
  ): Promise<PaymentStatusResponse> {
    const intervalMs = options.intervalMs ?? 2_000;
    const timeoutMs = options.timeoutMs ?? 60_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getPayment(paymentId);
      options.onPoll?.(status);

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'refunded') {
        return status;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(intervalMs, remaining));
    }

    throw new AuronError(
      `Payment ${paymentId} did not complete within ${timeoutMs}ms`,
      'TIMEOUT',
      undefined,
      true,
    );
  }

  // ── Intent parsing ─────────────────────────────────────────────────────────

  /**
   * Parse a natural-language payment intent using Claude AI.
   * Returns a structured action with security flags.
   *
   * @example
   * const result = await client.parseIntent('send ₹500 to priya@upi', {
   *   userId: wallet.publicKey,
   *   spendCeiling: 10000,
   * });
   * if (result.type === 'action' && result.action?.action === 'transfer') {
   *   // result.action.recipient, result.action.amount
   * }
   */
  async parseIntent(message: string, options: ParseIntentOptions = {}): Promise<IntentResponse> {
    if (!message?.trim()) {
      throw new AuronError('message is required', 'VALIDATION_ERROR');
    }
    if (message.length > 500) {
      throw new AuronError('message must be 500 characters or fewer', 'VALIDATION_ERROR');
    }

    return this.request<IntentResponse>('POST', '/api/parse-intent', {
      message: message.trim(),
      userId: options.userId ?? 'sdk-anonymous',
      spendCeiling: options.spendCeiling,
      thirtyDayAvg: options.thirtyDayAvg,
      isNewRecipient: options.isNewRecipient,
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpStatusToCode(status: number): import('./errors').AuronErrorCode {
  if (status === 401 || status === 403) return 'INVALID_API_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'PAYMENT_NOT_FOUND';
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 422) return 'PAYMENT_LIMIT_EXCEEDED';
  if (status === 503) return 'INSUFFICIENT_LIQUIDITY';
  return 'UNKNOWN';
}
