/**
 * ChatInputArea — Player input bar (UI-SPEC §S1b / D-14).
 *
 * Features:
 *   - Auto-growing Textarea (min 56px, max 112px) via scrollHeight
 *   - Send button (gold, disabled while streaming or when empty)
 *   - Ctrl+Enter shortcut via react-hotkeys-hook
 *   - Plain Enter inserts newline (no override)
 *   - Loader2 spinner + "Sending…" label while streaming
 *   - Disabled state when no AI provider configured (amber notice + "Open settings." link)
 *   - Accessibility: sr-only label for the textarea
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dice6, Loader2, Play } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { DiceRollerPopover } from './DiceRollerPopover'
import { cn } from '../lib/utils'

export interface ChatInputAreaProps {
  /** Called with the trimmed content when the player submits */
  onSend: (content: string) => void
  /** Whether the AI stream is currently active */
  isStreaming: boolean
  /** True when no AI provider is configured for this campaign */
  disabled?: boolean
  /**
   * True when a session is active — unlocks the input.
   * Defaults to true to avoid breaking callers that don't yet pass this prop.
   */
  isSessionActive?: boolean
  /** Open the AI settings modal (gear icon modal, Plan 03-05) */
  onOpenSettings: () => void
  className?: string
}

export function ChatInputArea({
  onSend,
  isStreaming,
  disabled = false,
  isSessionActive = true,
  onOpenSettings,
  className,
}: ChatInputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Track empty state to reactively disable Send button
  const [isEmpty, setIsEmpty] = useState(true)
  // Dice roller popover open state (UI-SPEC §S3)
  const [dicePopoverOpen, setDicePopoverOpen] = useState(false)

  // When isSessionActive transitions to true, autofocus the textarea
  useEffect(() => {
    if (isSessionActive) {
      // Small timeout to let the DOM swap complete before focusing
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [isSessionActive])

  const handleSend = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const value = textarea.value.trim()
    if (!value || isStreaming || disabled) return

    onSend(value)

    // Clear textarea, reset height, and update empty state
    textarea.value = ''
    textarea.style.height = 'auto'
    setIsEmpty(true)
  }, [onSend, isStreaming, disabled])

  // Ctrl+Enter to send (works when focus is in the textarea)
  useHotkeys(
    'ctrl+enter',
    (e) => {
      e.preventDefault()
      handleSend()
    },
    {
      enableOnFormTags: ['TEXTAREA'],
      enabled: !isStreaming && !disabled && !!isSessionActive,
    },
  )

  // Auto-grow textarea on input change (capped via max-h Tailwind class)
  // Also updates isEmpty state reactively
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
    setIsEmpty(!textarea.value.trim())
  }, [])

  // Prepend a dice-roll prefix to the textarea, replacing any prior roll prefix
  // (UI-SPEC §S3 / D-19). Refreshes height + isEmpty via handleInput, then focuses.
  const handleRoll = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current
      if (!ta) return
      const existing = ta.value
      const stripped = existing.replace(/^\[[\w\d+\-*/]+: \d+\] /, '')
      ta.value = prefix + stripped
      handleInput()
      ta.focus()
    },
    [handleInput],
  )

  // Listen for spell cast prefixes dispatched by SpellListSection (05-05).
  // Reuses handleRoll so cast and dice prefixes share the same prepend/replace logic.
  useEffect(() => {
    const handler = (e: Event) => {
      const prefix = (e as CustomEvent<string>).detail
      if (prefix) handleRoll(prefix)
    }
    window.addEventListener('campaign:chat-prefix', handler)
    return () => window.removeEventListener('campaign:chat-prefix', handler)
  }, [handleRoll])

  const sendDisabled = isStreaming || disabled || isEmpty
  const diceDisabled = disabled || isStreaming

  // Locked state: no active session — show banner instead of input
  if (!isSessionActive) {
    return (
      <div className={cn('border-t border-border bg-background px-4 py-4 flex items-center gap-2', className)}>
        <div role="status" aria-live="polite" className="flex items-center gap-2">
          <Play className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Start your session to begin playing.</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('border-t border-border bg-background p-3 flex flex-col gap-1', className)}>
      {/* sr-only label for accessibility */}
      <Label htmlFor="chat-input" className="sr-only">
        Your message
      </Label>

      {/* Input row: Textarea + Send button */}
      <div className="flex flex-row items-end gap-2">
        <Textarea
          id="chat-input"
          ref={textareaRef}
          placeholder="What do you do?"
          disabled={disabled || isStreaming}
          onInput={handleInput}
          className={cn(
            'flex-1 min-h-[56px] max-h-[112px] resize-none bg-secondary border border-border rounded-md',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:ring-1 focus:ring-primary focus:border-primary transition-all overflow-y-auto',
          )}
          aria-label="Send a message to the AI Dungeon Master"
        />

        {/* Dice roller (UI-SPEC §S3) — between Textarea and Send.
            Both PopoverTrigger (inside DiceRollerPopover) and TooltipTrigger
            compose onto the same Button via nested `asChild`. */}
        <Tooltip delayDuration={600}>
          <DiceRollerPopover
            open={dicePopoverOpen}
            onOpenChange={setDicePopoverOpen}
            onRoll={handleRoll}
          >
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                aria-label="Open dice roller"
                disabled={diceDisabled}
              >
                <Dice6 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
          </DiceRollerPopover>
          <TooltipContent>Roll dice</TooltipContent>
        </Tooltip>

        <Button
          variant="default"
          size="sm"
          onClick={handleSend}
          disabled={sendDisabled}
          aria-label="Send message"
          className="w-16 h-9 shrink-0"
        >
          {isStreaming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Sending…
            </>
          ) : (
            'Send'
          )}
        </Button>
      </div>

      {/* Ctrl+Enter hint OR no-config amber notice */}
      {disabled ? (
        <p className="text-[12px] text-amber-500 mt-1">
          Configure an AI provider to start playing.{' '}
          <button
            className="underline hover:no-underline"
            onClick={onOpenSettings}
            type="button"
          >
            Open settings.
          </button>
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground mt-1">Ctrl+Enter to send</p>
      )}
    </div>
  )
}
