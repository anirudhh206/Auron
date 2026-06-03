/**
 * Retry utilities — exponential backoff with full jitter.
 *
 * Why full jitter? Thundering herd problem: if many payments fail at the same
 * time (OnMeta down), deterministic backoff causes them all to retry together,
 * amplifying the load spike. Full jitter spreads retries across the window.
 *
 * Reference: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first try). Default: 3 */
  maxAttempts: number;
  /** Delay before 2nd attempt in ms. Default: 1000 */
  initialDelayMs: number;
  /** Maximum delay cap in ms. Default: 30_000 */
  maxDelayMs: number;
  /** Backoff multiplier per attempt. Default: 2 */
  backoffFactor: number;
  /** Error filter — return false to abort without retrying */
  shouldRetry?: (err: Error, attempt: number) => boolean;
  /** Called before each retry with delay info */
  onRetry?: (err: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffFactor: 2,
};

/** Full-jitter sleep: random(0, min(cap, base * 2^attempt)) */
function backoffDelay(attempt: number, opts: RetryOptions): number {
  const cap = opts.maxDelayMs;
  const base = opts.initialDelayMs;
  const ceiling = Math.min(cap, base * Math.pow(opts.backoffFactor, attempt - 1));
  return Math.floor(Math.random() * ceiling);
}

/**
 * Retry `fn` up to `maxAttempts` times with exponential backoff + jitter.
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Allow caller to abort retries for non-retryable errors
      if (opts.shouldRetry && !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      if (attempt === opts.maxAttempts) break;

      const delayMs = backoffDelay(attempt, opts);
      opts.onRetry?.(lastError, attempt, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/** Sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll a condition function until it returns truthy or timeout is reached.
 * Uses exponential backoff between polls to reduce load.
 */
export async function pollUntil<T>(
  fn: () => Promise<T | null | false | undefined>,
  options: {
    timeoutMs: number;
    intervalMs?: number;
    maxIntervalMs?: number;
    onTick?: (elapsed: number) => void;
  }
): Promise<T> {
  const {
    timeoutMs,
    intervalMs = 2_000,
    maxIntervalMs = 10_000,
    onTick,
  } = options;

  const start = Date.now();
  let interval = intervalMs;

  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result as T;

    const elapsed = Date.now() - start;
    onTick?.(elapsed);

    await sleep(interval);
    // Grow interval slightly — reduces polling load as time goes on
    interval = Math.min(interval * 1.25, maxIntervalMs);
  }

  throw new Error(`Polling timed out after ${timeoutMs}ms`);
}

/**
 * Non-retryable error categories — abort immediately on these.
 * Used as `shouldRetry` filter for OnMeta calls.
 */
export function isNonRetryableOfframpError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  // OnMeta 4xx = client error — retrying won't help
  return (
    msg.includes("invalid upi") ||
    msg.includes("upi id not found") ||
    msg.includes("invalid amount") ||
    msg.includes("kyc") ||
    msg.includes("blacklisted") ||
    msg.includes("400") ||
    msg.includes("422")
  );
}
