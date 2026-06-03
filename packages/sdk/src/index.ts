/**
 * @auron/sdk — TypeScript SDK for the Auron Settlement Infrastructure
 *
 * Allows developers to integrate Auron's USDC→INR settlement pipeline
 * into their own applications.
 *
 * Phase 1 (Milestone 4): Basic payment initiation + status polling
 * Phase 2: Webhook support, batch payments, treasury queries
 *
 * @example
 * ```ts
 * import { AuronClient } from '@auron/sdk';
 *
 * const auron = new AuronClient({ apiKey: 'your-api-key' });
 *
 * const payment = await auron.pay({
 *   upiId:        'merchant@upi',
 *   merchantName: 'Swiggy',
 *   inrAmount:    450,
 * });
 *
 * console.log(payment.paymentId); // track settlement status
 * ```
 */

export * from './types';
export * from './client';
