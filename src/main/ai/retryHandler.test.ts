/**
 * Tests for retryHandler.
 * SESS-08: 3 retry attempts, exponential backoff 1s → 2s → 4s, final error surfaces.
 */

import { describe, it, expect, vi } from 'vitest'
import { withRetry } from './retryHandler'

describe('retryHandler', () => {
  it('retries the operation up to 3 times before giving up', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    // Use no-op sleep to avoid real delays
    const sleep = vi.fn().mockResolvedValue(undefined)
    await expect(withRetry(fn, { sleep })).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('succeeds on second attempt without calling onError', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValue('success')
    const sleep = vi.fn().mockResolvedValue(undefined)
    const result = await withRetry(fn, { sleep })
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('uses exponential backoff: 1s → 2s → 4s delays', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const sleep = vi.fn().mockResolvedValue(undefined)
    await expect(withRetry(fn, { baseDelayMs: 1000, sleep })).rejects.toThrow('fail')
    // 3 attempts: delay after attempt 0 (1000ms) and after attempt 1 (2000ms); no delay after attempt 2
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenNthCalledWith(1, 1000)
    expect(sleep).toHaveBeenNthCalledWith(2, 2000)
  })

  it('calls final error callback after all retries exhausted', async () => {
    const finalError = new Error('terminal error')
    const fn = vi.fn().mockRejectedValue(finalError)
    const sleep = vi.fn().mockResolvedValue(undefined)
    let caughtError: Error | null = null
    try {
      await withRetry(fn, { sleep })
    } catch (err) {
      caughtError = err as Error
    }
    expect(caughtError).toBe(finalError)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('succeeds immediately on first attempt with no retries or delays', async () => {
    const fn = vi.fn().mockResolvedValue(42)
    const sleep = vi.fn().mockResolvedValue(undefined)
    const result = await withRetry(fn, { sleep })
    expect(result).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})
