/**
 * @auron/sdk — Error types
 */

export type AuronErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'PAYMENT_LIMIT_EXCEEDED'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'INVALID_UPI_ID'
  | 'TX_VERIFICATION_FAILED'
  | 'SETTLEMENT_FAILED'
  | 'PAYMENT_NOT_FOUND'
  | 'INTENT_PARSE_FAILED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class AuronError extends Error {
  readonly code: AuronErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, code: AuronErrorCode, status?: number, retryable = false) {
    super(message);
    this.name = 'AuronError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isAuronError(err: unknown): err is AuronError {
  return err instanceof AuronError;
}
