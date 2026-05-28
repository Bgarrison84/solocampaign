/**
 * useRecapStream — manages the session recap streaming state and IPC listener lifecycle.
 *
 * Listeners are registered inside startRecap (not in a useEffect) so they are
 * always set up synchronously before startStream is invoked — no tokens can be dropped.
 */

import { useCallback, useEffect, useState } from 'react'

// ── Window type augmentation ──────────────────────────────────────────────────

declare global {
  interface Window {
    sessionRecap: {
      startStream: (payload: { campaignId: string; sessionId: string }) => Promise<void>
      onToken: (cb: (token: string) => void) => void
      onFinish: (cb: (finalText: string) => void) => void
      onError: (cb: (err: { message: string }) => void) => void
      removeAllListeners: () => void
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface RecapStreamError {
  message: string
}

export interface UseRecapStreamReturn {
  recapText: string
  finalText: string
  isStreaming: boolean
  error: RecapStreamError | null
  startRecap: () => void
  clearError: () => void
}

export function useRecapStream(
  campaignId: string,
  sessionId: string | null,
): UseRecapStreamReturn {
  const [recapText, setRecapText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<RecapStreamError | null>(null)

  // Reset state when session changes; clean up listeners on unmount
  useEffect(() => {
    setRecapText('')
    setFinalText('')
    setIsStreaming(false)
    setError(null)
    return () => {
      window.sessionRecap.removeAllListeners()
    }
  }, [campaignId, sessionId])

  const startRecap = useCallback(() => {
    if (!sessionId) return

    setIsStreaming(true)
    setRecapText('')
    setFinalText('')
    setError(null)

    // Register listeners synchronously BEFORE invoking startStream so no tokens are dropped
    window.sessionRecap.removeAllListeners()
    window.sessionRecap.onToken((token: string) => {
      setRecapText((prev) => prev + token)
    })
    window.sessionRecap.onFinish((fullText: string) => {
      setIsStreaming(false)
      setFinalText(fullText)
    })
    window.sessionRecap.onError((err: { message: string }) => {
      setIsStreaming(false)
      setError(err)
    })

    window.sessionRecap
      .startStream({ campaignId, sessionId })
      .catch((err: unknown) => {
        setIsStreaming(false)
        setError({
          message:
            err instanceof Error ? err.message : 'Failed to generate recap. Please try again.',
        })
      })
  }, [campaignId, sessionId])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return { recapText, finalText, isStreaming, error, startRecap, clearError }
}
