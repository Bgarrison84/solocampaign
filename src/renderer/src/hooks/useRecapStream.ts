/**
 * useRecapStream — manages the session recap streaming state and IPC listener lifecycle.
 *
 * Architecture mirrors useAiStream.ts:
 *   - Registers onToken/onFinish/onError listeners in a useEffect
 *   - Calls window.sessionRecap.removeAllListeners() in cleanup
 *   - Accumulates tokens in recapText; sets finalText on stream completion
 *
 * Usage:
 *   const { recapText, finalText, isStreaming, error, startRecap, clearError } =
 *     useRecapStream(campaignId, sessionId)
 */

import { useCallback, useEffect, useState } from 'react'

// ── Window type augmentation ──────────────────────────────────────────────────

declare global {
  interface Window {
    sessionRecap: {
      /**
       * Initiate recap streaming for a session.
       * Register onToken/onFinish/onError BEFORE calling startStream.
       */
      startStream: (payload: { campaignId: string; sessionId: string }) => Promise<void>

      /**
       * Register a callback to receive streamed recap token chunks.
       */
      onToken: (cb: (token: string) => void) => void

      /**
       * Register a callback fired when the recap stream completes.
       * Receives the full concatenated text from the main process.
       */
      onFinish: (cb: (finalText: string) => void) => void

      /**
       * Register a callback fired when recap streaming fails.
       */
      onError: (cb: (err: { message: string }) => void) => void

      /**
       * Remove all recap stream listeners.
       * MUST be called in React useEffect cleanup to prevent listener stacking.
       */
      removeAllListeners: () => void
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface RecapStreamError {
  message: string
}

export interface UseRecapStreamReturn {
  /** Accumulated raw tokens during the active stream */
  recapText: string
  /** Full text set when streaming completes (from onFinish); used to seed the editable textarea */
  finalText: string
  isStreaming: boolean
  error: RecapStreamError | null
  /** Start the recap stream — sets isStreaming, resets state, calls window.sessionRecap.startStream */
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

  // Register listeners; cleanup on unmount or campaignId/sessionId change
  useEffect(() => {
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

  return {
    recapText,
    finalText,
    isStreaming,
    error,
    startRecap,
    clearError,
  }
}
