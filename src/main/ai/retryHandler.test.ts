/**
 * Wave 0 test stubs for retryHandler (plan 03-02).
 * These tests verify the intended behavior contract but are skipped until
 * the implementation lands in plan 03-02.
 *
 * Tests cover: SESS-08 (3 retry attempts, exponential backoff, final error callback)
 */

import { describe, it, expect } from 'vitest'

describe('retryHandler', () => {
  it.skip('retries the operation up to 3 times before giving up — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (SESS-08: 3 retry attempts)
    // const { withRetry } = await import('./retryHandler')
    // const fn = vi.fn().mockRejectedValue(new Error('fail'))
    // await expect(withRetry(fn, 3)).rejects.toThrow('fail')
    // expect(fn).toHaveBeenCalledTimes(3)
    expect(true).toBe(true)
  })

  it.skip('succeeds on second attempt without calling onError — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })

  it.skip('uses exponential backoff: 1s → 2s → 4s delays — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (SESS-08: exponential backoff timing)
    // Delays: 1000ms, 2000ms, 4000ms
    expect(true).toBe(true)
  })

  it.skip('calls final error callback after all retries exhausted — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (SESS-08: final error callback)
    expect(true).toBe(true)
  })

  it.skip('does not retry on non-retryable errors — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })
})
