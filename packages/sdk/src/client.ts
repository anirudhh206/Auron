/**
 * AuronClient — Main SDK client
 * Full implementation in Milestone 4 (post-grant)
 */

import type { AuronConfig, PaymentRequest, PaymentResponse, PaymentStatusResponse } from './types';

const DEFAULT_BASE_URL = 'https://auron-mocha.vercel.app';

export class AuronClient {
  private readonly apiKey:  string;
  private readonly baseUrl: string;

  constructor(config: AuronConfig) {
    this.apiKey  = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  /**
   * Initiate a USDC → INR payment to a UPI account.
   * The caller must sign the USDC transfer on Solana separately.
   */
  async pay(_request: PaymentRequest): Promise<PaymentResponse> {
    // Full implementation in Milestone 4
    throw new Error('AuronClient.pay() — full implementation in Milestone 4 (post-grant KYB)');
  }

  /**
   * Poll settlement status for a payment.
   */
  async getPayment(paymentId: string): Promise<PaymentStatusResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/payment/${paymentId}`, {
      headers: { 'x-api-key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Auron API error: ${res.status}`);
    return res.json() as Promise<PaymentStatusResponse>;
  }
}
