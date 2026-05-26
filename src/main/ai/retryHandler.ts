/**
 * Retry handler for AI provider calls.
 * D-18: 3 attempts with exponential backoff 1s → 2s → 4s.
 * SESS-08: After all retries exhausted, the final error is re-thrown.
 */

export interface RetryOptions {
  /** Number of attempts (default: 3) */
  maxAttempts?: number
  /** Base delay in ms — doubles each attempt (default: 1000ms) */
  baseDelayMs?: number
  /** Injectable sleep function for testing with fake timers */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry an async operation with exponential backoff.
 * Attempts: maxAttempts (default 3), backoff: baseDelayMs * 2^attempt.
 * Delays: 1000ms → 2000ms → 4000ms (with defaults).
 * On all attempts failing, rejects with the final error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3
  const baseDelayMs = opts?.baseDelayMs ?? 1000
  const sleep = opts?.sleep ?? defaultSleep

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts - 1) {
        // Backoff: 1000ms, 2000ms, 4000ms for attempts 0, 1, 2
        const delayMs = baseDelayMs * Math.pow(2, attempt)
        await sleep(delayMs)
      }
    }
  }

  throw lastError
}
