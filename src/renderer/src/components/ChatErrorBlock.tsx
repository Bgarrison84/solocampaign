/**
 * ChatErrorBlock — Inline AI provider failure block (UI-SPEC §S5 / D-18).
 *
 * Rendered inside StoryScrollPanel at the end of the message list when the
 * primary provider fails after 3 retries with exponential backoff (D-18).
 *
 * NOT a modal or toast — appears inline in the story scroll (D-18).
 *
 * Accessibility: role="alert" aria-live="assertive" announces immediately to AT (UI-SPEC § Accessibility)
 * Security (T-03-04-01): only renders the generic message string — no stack traces, keys, or provider bodies
 */

import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'

export interface ChatErrorBlockProps {
  /** Generic error message string from the IPC error event */
  message: string
  /** Whether a fallback provider is configured for this campaign */
  hasFallback: boolean
  /** Retry with the same (or currently active) provider */
  onRetry: () => void
  /** Switch to the fallback provider for the current session (D-19) */
  onSwitchToFallback: () => void
  /** Open the AI settings modal to configure a fallback provider */
  onOpenSettings: () => void
}

export function ChatErrorBlock({
  message: _message,
  hasFallback,
  onRetry,
  onSwitchToFallback,
  onOpenSettings,
}: ChatErrorBlockProps) {
  // Determine whether this is a streaming timeout message to show the right body text
  const isTimeout =
    _message.toLowerCase().includes('time') ||
    _message.toLowerCase().includes('15 second') ||
    _message.toLowerCase().includes('no response')

  const bodyText = isTimeout
    ? 'No response arrived within 15 seconds. The model may be loading or the connection may be slow.'
    : hasFallback
      ? 'The provider failed to respond after 3 attempts.'
      : 'The provider failed to respond after 3 attempts. Configure a fallback provider for automatic recovery.'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-card border border-border border-l-4 border-l-destructive rounded-md p-4 flex flex-col gap-3 my-6 max-w-[680px] mx-auto"
    >
      {/* Error icon + title */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-sm font-semibold text-foreground">
          The AI DM stopped responding
        </span>
      </div>

      {/* Body message */}
      <p className="text-sm text-muted-foreground">{bodyText}</p>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasFallback ? (
          <>
            {/* With fallback: Switch to fallback (gold primary) + Retry (outline) */}
            <Button variant="default" size="sm" onClick={onSwitchToFallback}>
              Switch to fallback
            </Button>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </>
        ) : (
          <>
            {/* Without fallback: Retry (outline) + link to configure fallback */}
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
            <button
              className="text-sm text-primary underline hover:no-underline"
              onClick={onOpenSettings}
            >
              Configure fallback in AI settings
            </button>
          </>
        )}
      </div>
    </div>
  )
}
