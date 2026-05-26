/**
 * useAiStream — manages the AI streaming state and IPC listener lifecycle.
 *
 * Architecture:
 *   - Registers onToken/onFinish/onError listeners in a useEffect
 *   - Calls window.aiStream.removeAllListeners() in the cleanup to prevent
 *     duplicate handlers accumulating across campaign switches (constraint #7 / T-03-04-02)
 *   - On finish: invalidates the getMessages TanStack Query so the completed
 *     assistant message renders via react-markdown in StoryScrollPanel
 *
 * Usage:
 *   const { isStreaming, streamingContent, error, send, clearError } = useAiStream(campaignId)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export interface AiStreamError {
  message: string
}

export interface UseAiStreamReturn {
  isStreaming: boolean
  /** Accumulated raw tokens during the active stream. Empty string when not streaming. */
  streamingContent: string
  error: AiStreamError | null
  send: (content: string, opts?: { useFallback?: boolean }) => void
  clearError: () => void
}

export function useAiStream(campaignId: string): UseAiStreamReturn {
  const queryClient = useQueryClient()

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<AiStreamError | null>(null)

  // Track the last user message content for retry support
  const lastContentRef = useRef<string>('')
  const lastOptsRef = useRef<{ useFallback?: boolean } | undefined>(undefined)

  // Register listeners once; cleanup on unmount or campaignId change
  useEffect(() => {
    // onToken: append raw token to streamingContent
    window.aiStream.onToken((token: string) => {
      setStreamingContent((prev) => prev + token)
    })

    // onFinish: clear streaming state and invalidate getMessages query so
    // the completed assistant message is fetched and rendered via react-markdown
    window.aiStream.onFinish(() => {
      setIsStreaming(false)
      setStreamingContent('')
      queryClient.invalidateQueries({ queryKey: ['ai', 'getMessages', campaignId] })
    })

    // onError: surface the generic error string to the UI (no key/stack trace — D-23 / T-03-04-01)
    window.aiStream.onError((err: { message: string }) => {
      setIsStreaming(false)
      setStreamingContent('')
      setError({ message: err.message })
    })

    return () => {
      // CRITICAL: remove all listeners on cleanup to prevent listener stacking
      // across re-renders and campaign switches (constraint #7 / RESEARCH.md Pitfall 2)
      window.aiStream.removeAllListeners()
    }
  }, [campaignId, queryClient])

  const send = useCallback(
    (content: string, opts?: { useFallback?: boolean }) => {
      if (!content.trim()) return

      // Store for potential retry
      lastContentRef.current = content
      lastOptsRef.current = opts

      // Clear previous error and streaming state
      setError(null)
      setStreamingContent('')
      setIsStreaming(true)

      window.aiStream
        .sendMessage({
          campaignId,
          content,
          useFallback: opts?.useFallback,
        })
        .catch((err: unknown) => {
          // sendMessage itself failing (invoke error) — surface as stream error
          setIsStreaming(false)
          setStreamingContent('')
          setError({
            message:
              err instanceof Error
                ? err.message
                : 'Failed to send message. Please try again.',
          })
        })
    },
    [campaignId],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isStreaming,
    streamingContent,
    error,
    send,
    clearError,
  }
}
