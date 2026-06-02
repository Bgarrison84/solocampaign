/**
 * StoryScrollPanel — Continuous story scroll chat area (UI-SPEC §S1a / D-11, D-12, D-13, D-16).
 *
 * Renders:
 *   - Completed AI messages via react-markdown + remark-gfm (constraint #8)
 *   - Completed player messages as separator + italic gold "You:" prefix block
 *   - Streaming content as RAW TEXT (NOT markdown — constraint #8) with blinking cursor
 *   - ChatErrorBlock inline when error is set (D-18)
 *   - Empty state when no messages exist and not streaming
 *
 * Auto-scroll behavior:
 *   - Scrolls to bottom on new tokens when user is within 100px of bottom
 *   - Suspends when user has scrolled up (isUserScrolledUp)
 *   - Force-scrolls to bottom on ai:finish, on history load, and after player submits
 *
 * Accessibility (A11Y-03):
 *   - Off-screen aria-live="polite" region announces streamed narration at paragraph boundaries
 *     (NOT per-token — avoids screen reader flood). The scroll-area div does NOT carry aria-live.
 *   - Paragraph boundary detection: \n\n with >20 chars or sentence-end [.!?] with >60 chars.
 *   - Buffer lives in a useRef (no per-token setState). Flushed on stream end.
 *   - aria-hidden="true" on the blinking cursor span (sighted UX only)
 *   - Announcement uses textContent (not innerHTML) — T-08-20 injection mitigation.
 *
 * Security (T-03-04-03): react-markdown sanitizes by default; no dangerouslySetInnerHTML.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { cn } from '../lib/utils'
import { ChatErrorBlock } from './ChatErrorBlock'
import type { AiStreamError } from '../hooks/useAiStream'

/**
 * Render a dice-roll breakdown array as a readable bracketed string
 * (UI-SPEC §S4). e.g. [11, 3] → "[11+3]".
 */
function formatBreakdown(breakdown: number[]): string {
  return `[${breakdown.join('+')}]`
}

export interface StoryScrollPanelProps {
  campaignId: string
  isStreaming: boolean
  /** Accumulated raw tokens during the active stream */
  streamingContent: string
  error: AiStreamError | null
  hasFallback: boolean
  /** True when the AI context window overflowed L1 — shows amber warning bar */
  isL1Overflow?: boolean
  onRetry: () => void
  onSwitchToFallback: () => void
  onOpenSettings: () => void
  /** Called to force-scroll imperatively (e.g. after player sends a message) */
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>
  className?: string
}

/**
 * Detect a paragraph or sentence boundary in `text`, returning the index AFTER the boundary.
 * Returns -1 if no boundary found.
 *
 * Primary: double-newline (\n\n) with > 20 chars before it.
 * Fallback: sentence-end ([.!?] followed by whitespace or newline) with > 60 chars before it.
 */
function findParagraphBoundary(text: string): number {
  const dn = text.indexOf('\n\n')
  if (dn > 20) return dn + 2
  const se = text.search(/[.!?][\s\n]/)
  if (se > 60) return se + 2
  return -1
}

export function StoryScrollPanel({
  campaignId,
  isStreaming,
  streamingContent,
  error,
  hasFallback,
  isL1Overflow = false,
  onRetry,
  onSwitchToFallback,
  onOpenSettings,
  scrollToBottomRef,
  className,
}: StoryScrollPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUpRef = useRef(false)

  // Off-screen ARIA live region for screen reader announcements (A11Y-03)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  // Buffer accumulates new tokens; never held in React state (avoids per-token re-renders)
  const paragraphBufferRef = useRef('')
  // Track how many characters of streamingContent we've already processed
  const lastProcessedLenRef = useRef(0)

  // Fetch completed message history
  const messagesQuery = useQuery({
    queryKey: ['ai', 'getMessages', campaignId],
    queryFn: () => trpc.ai.getMessages.query({ campaignId }),
    enabled: !!campaignId,
    staleTime: Infinity, // Only invalidated explicitly (on ai:finish) — D-16
  })

  const messages = messagesQuery.data ?? []

  // ── Scroll helpers ────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((instant = true) => {
    const el = scrollAreaRef.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: instant ? 'instant' : 'smooth',
    })
  }, [])

  // Expose scroll-to-bottom imperatively so CampaignViewScreen can call after send
  useEffect(() => {
    if (scrollToBottomRef) {
      scrollToBottomRef.current = () => {
        isUserScrolledUpRef.current = false
        scrollToBottom()
      }
    }
  }, [scrollToBottomRef, scrollToBottom])

  // Track user scroll position — suspend auto-scroll when user is reading older content
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isUserScrolledUpRef.current = distanceFromBottom > 100
  }, [])

  // Auto-scroll on new streaming tokens (only when user is at or near bottom)
  useEffect(() => {
    if (isStreaming && !isUserScrolledUpRef.current) {
      scrollToBottom()
    }
  }, [streamingContent, isStreaming, scrollToBottom])

  // Force-scroll to bottom when streaming finishes (ai:finish) regardless of position
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      isUserScrolledUpRef.current = false
      scrollToBottom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  // Scroll to bottom immediately when message history first loads
  useEffect(() => {
    if (messages.length > 0) {
      isUserScrolledUpRef.current = false
      scrollToBottom()
    }
    // Only run when data arrives the first time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesQuery.isSuccess])

  // ── ARIA live region — paragraph-boundary announcements (A11Y-03) ─────────
  // Feed NEW tokens (delta since last run) into paragraphBufferRef.
  // When a boundary is detected, announce via off-screen live region using
  // the double-update (clear → rAF set) pattern so screen readers detect change.
  // On stream end (isStreaming → false), flush any remaining buffer.
  // Security: textContent assignment (not innerHTML) — T-08-20 mitigated.
  useEffect(() => {
    const liveRegion = liveRegionRef.current
    if (!liveRegion) return

    if (isStreaming) {
      // Append only the NEW portion of the cumulative streamingContent
      const newDelta = streamingContent.slice(lastProcessedLenRef.current)
      lastProcessedLenRef.current = streamingContent.length
      paragraphBufferRef.current += newDelta

      // Check for a paragraph boundary in the accumulated buffer
      const boundaryIdx = findParagraphBoundary(paragraphBufferRef.current)
      if (boundaryIdx !== -1) {
        const announcement = paragraphBufferRef.current.slice(0, boundaryIdx).trim()
        paragraphBufferRef.current = paragraphBufferRef.current.slice(boundaryIdx)
        if (announcement) {
          // Double-update: clear first so screen reader detects the textContent change
          liveRegion.textContent = ''
          requestAnimationFrame(() => {
            liveRegion.textContent = announcement
          })
        }
      }
    } else {
      // Stream ended — flush remaining buffer as final announcement
      const remaining = paragraphBufferRef.current.trim()
      if (remaining) {
        liveRegion.textContent = ''
        requestAnimationFrame(() => {
          liveRegion.textContent = remaining
        })
      }
      // Reset buffer + delta tracker for the next stream
      paragraphBufferRef.current = ''
      lastProcessedLenRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingContent, isStreaming])

  // ── Empty state ───────────────────────────────────────────────────────────

  const showEmptyState = messages.length === 0 && !isStreaming && !error

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Off-screen ARIA live region — announces streamed narration at paragraph boundaries.
          Always rendered (never conditional — Landmine 4: conditionally rendered regions are
          missed by screen readers on first mount). Starts empty; content set via textContent.
          T-08-20: textContent (not innerHTML) prevents injection from AI-generated text.
          T-08-21: Updates fire only at paragraph/sentence boundaries, throttled via rAF. */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="false"
        aria-label="Story narration"
        className="sr-only"
      />

      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className={cn(
          'overflow-y-auto flex-1',
          // Custom thin scrollbar (Tailwind v4 scrollbar utilities where available, else native)
          'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
          className,
        )}
      >
        {/* Centered prose column */}
        <div className="max-w-[680px] mx-auto px-6 py-6">
          {/* Empty state */}
          {showEmptyState && (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                Begin your adventure.
              </p>
              <p className="text-sm text-muted-foreground/60">
                Type a message below to start the story.
              </p>
            </div>
          )}

          {/* Completed message history */}
          {messages.map((msg) => {
            // AI showDiceRoll chip (COMB-03 / UI-SPEC §S4) — persisted as a
            // dice_roll message in 05-02 with content = JSON.stringify(
            // { label, expression, result, breakdown }).
            if (msg.role === 'dice_roll') {
              // T-05-04-01: parse defensively — a malformed/oversized content
              // string must not crash the story panel. Skip the row on failure.
              let data: {
                label?: string
                expression?: string
                result?: number | string
                breakdown?: number[]
              }
              try {
                data = JSON.parse(msg.content)
              } catch {
                return null
              }
              const breakdown = Array.isArray(data.breakdown) ? data.breakdown : []
              return (
                <div
                  key={msg.id}
                  className="bg-amber-950/40 border border-amber-800/50 rounded-md px-3 py-2 mb-4 flex items-start gap-2 text-sm"
                  role="note"
                  aria-label={`Dice roll: ${data.label ?? 'roll'}`}
                >
                  <span aria-hidden="true" className="text-amber-400 shrink-0">
                    🎲
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground">
                      <span className="font-semibold">{data.label}</span>
                      {' — '}
                      <span className="font-mono">{data.expression}</span>
                      {' = '}
                      <span className="font-mono font-semibold text-amber-300">{data.result}</span>
                    </span>
                    {breakdown.length > 0 && (
                      <span className="text-xs font-mono text-muted-foreground">
                        ({formatBreakdown(breakdown)})
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            // Level-up / rest system event (D-32 / UI-SPEC §S7b) — persisted as a
            // system message in 05-06. Rendered as an italic amber system line.
            if (msg.role === 'system') {
              return (
                <div
                  key={msg.id}
                  className="text-sm italic text-amber-400 mb-4 px-2 py-1 bg-amber-950/20 rounded"
                  role="status"
                >
                  {msg.content}
                </div>
              )
            }

            if (msg.role === 'assistant') {
              return (
                <div key={msg.id} className="mb-4">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Constrain AI heading sizes so they don't overpower UI hierarchy (UI-SPEC Typography)
                      h1: ({ children }) => (
                        <h3 className="text-base font-semibold text-foreground mb-2">{children}</h3>
                      ),
                      h2: ({ children }) => (
                        <h3 className="text-base font-semibold text-foreground mb-2">{children}</h3>
                      ),
                      h3: ({ children }) => (
                        <h4 className="text-base font-semibold text-foreground mb-2">{children}</h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm leading-[1.6] text-foreground mb-4 last:mb-0">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="text-sm leading-[1.6] text-foreground pl-4 list-disc mb-4">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="text-sm leading-[1.6] text-foreground pl-4 list-decimal mb-4">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      em: ({ children }) => <em className="italic">{children}</em>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )
            }

            // Player entry block (D-12): horizontal rule + italic gold "You:" + message text
            return (
              <div key={msg.id}>
                <hr className="border-t border-border my-6" />
                <p className="text-sm leading-[1.6] text-foreground mb-4">
                  <span className="italic text-primary/80 mr-2">You:</span>
                  <span>{msg.content}</span>
                </p>
              </div>
            )
          })}

          {/* Active streaming content — raw text (NOT markdown — constraint #8) + blinking cursor */}
          {(isStreaming || streamingContent) && (
            <div className="text-sm leading-[1.6] text-foreground mb-4 whitespace-pre-wrap">
              {streamingContent}
              {isStreaming && (
                <span
                  aria-hidden="true"
                  className="animate-[blink_1s_ease-in-out_infinite] text-foreground"
                >
                  |
                </span>
              )}
            </div>
          )}

          {/* Inline error block — shown after 3 retries fail (D-18) */}
          {error && (
            <ChatErrorBlock
              message={error.message}
              hasFallback={hasFallback}
              onRetry={onRetry}
              onSwitchToFallback={onSwitchToFallback}
              onOpenSettings={onOpenSettings}
            />
          )}
        </div>
      </div>

      {/* L1 overflow warning bar — rendered BELOW scroll area, ABOVE ChatInputArea */}
      {isL1Overflow && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-amber-950/30 border-y border-amber-900/40 px-4 py-2 flex items-start gap-2 shrink-0"
        >
          <span className="sr-only">Context window warning:</span>
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-sm text-amber-400">
            Earlier conversation history is not visible to the AI — session context grew beyond
            model limit.
          </span>
        </div>
      )}
    </>
  )
}
