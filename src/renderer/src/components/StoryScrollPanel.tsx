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
 * Accessibility:
 *   - aria-live="polite" aria-atomic="false" on the scroll area (progressive token announcements)
 *   - aria-hidden="true" on the blinking cursor span (sighted UX only)
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

  // ── Empty state ───────────────────────────────────────────────────────────

  const showEmptyState = messages.length === 0 && !isStreaming && !error

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        aria-live="polite"
        aria-atomic="false"
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
