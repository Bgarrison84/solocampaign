/**
 * EndSessionModal — End-session recap dialog (UI-SPEC S5).
 *
 * Flow:
 * 1. Modal opens → recap streaming begins immediately (startRecap called on open)
 * 2. Phase A: streaming — read-only div shows tokens + blinking cursor
 * 3. Phase B: done — transitions to editable Textarea pre-filled with finalText
 * 4. Player can edit the recap and add personal notes
 * 5. Save Session: calls sessions.saveRecap → endSession store → close
 *
 * Keyboard: Ctrl+Enter fires Save Session when enabled (not streaming, not saving).
 */

import React, { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import dayjs from 'dayjs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { trpc } from '../lib/trpc'
import { useSessionStore } from '../stores/sessionStore'
import { useRecapStream } from '../hooks/useRecapStream'

export interface EndSessionModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  sessionId: string | null
  sessionNumber: number | null
}

export function EndSessionModal({
  open,
  onClose,
  campaignId,
  sessionId,
  sessionNumber,
}: EndSessionModalProps) {
  const queryClient = useQueryClient()
  const [playerNotes, setPlayerNotes] = useState('')
  const [recapText, setRecapText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const recap = useRecapStream(campaignId, sessionId)

  // Start streaming when modal opens
  useEffect(() => {
    if (open && sessionId) {
      setPlayerNotes('')
      setRecapText('')
      setSaveError(null)
      recap.clearError()
      recap.startRecap()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId])

  // When streaming completes, seed the editable textarea with finalText
  useEffect(() => {
    if (!recap.isStreaming && recap.finalText) {
      setRecapText(recap.finalText)
    }
  }, [recap.isStreaming, recap.finalText])

  const saveMutation = useMutation({
    mutationFn: (input: {
      sessionId: string
      campaignId: string
      aiRecap: string
      playerNotes?: string
    }) => trpc.sessions.saveRecap.mutate(input),
    onSuccess: () => {
      useSessionStore.getState().endSession()
      queryClient.invalidateQueries({ queryKey: ['sessions', 'list', campaignId] })
      onClose()
    },
    onError: () => {
      setSaveError('Could not save the session. Try again.')
    },
  })

  const handleSave = () => {
    if (recap.isStreaming || saveMutation.isPending) return
    if (!sessionId) return
    setSaveError(null)
    saveMutation.mutate({
      sessionId,
      campaignId,
      aiRecap: recapText,
      playerNotes: playerNotes.trim() || undefined,
    })
  }

  // Ctrl+Enter to save when enabled
  useHotkeys(
    'ctrl+enter',
    (e) => {
      e.preventDefault()
      handleSave()
    },
    {
      enableOnFormTags: ['TEXTAREA'],
      enabled: open && !recap.isStreaming && !saveMutation.isPending,
    },
  )

  const streamingPhase = recap.isStreaming || !recap.finalText

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !saveMutation.isPending) onClose()
      }}
    >
      <DialogContent className="max-w-[560px] w-full max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>End Session</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Session {sessionNumber ?? '—'} — {dayjs().format('MMM D, YYYY')}
          </p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Session Recap */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-semibold">Session Recap</Label>

            {/* Phase A: streaming — read-only div */}
            {streamingPhase && (
              <div
                aria-live="polite"
                aria-atomic="false"
                className="text-sm leading-[1.6] text-foreground bg-secondary border border-border rounded-md px-4 py-4 min-h-[160px] overflow-y-auto"
              >
                {recap.recapText}
                {recap.isStreaming && (
                  <span
                    aria-hidden="true"
                    className="animate-[blink_1s_ease-in-out_infinite] text-foreground"
                  >
                    |
                  </span>
                )}
              </div>
            )}

            {/* Phase B: done — editable textarea */}
            {!streamingPhase && (
              <>
                <Textarea
                  value={recapText}
                  onChange={(e) => setRecapText(e.target.value)}
                  className="text-sm leading-[1.6] text-foreground bg-secondary border border-border rounded-md min-h-[160px] resize-y px-4 py-4"
                />
                <p className="text-[12px] text-muted-foreground">
                  You can edit the recap — the saved version becomes part of the AI&apos;s memory
                  for future sessions.
                </p>
              </>
            )}

            {/* Recap error */}
            {recap.error && (
              <p className="text-sm text-destructive">{recap.error.message}</p>
            )}
          </div>

          {/* Player Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end-session-player-notes" className="text-sm font-semibold">
              Player Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="end-session-player-notes"
              rows={3}
              className="resize-none min-h-[80px] bg-secondary border border-border rounded-md text-sm"
              value={playerNotes}
              onChange={(e) => setPlayerNotes(e.target.value)}
              placeholder="Personal notes — your own observations, theories, reminders."
            />
            <p className="text-[12px] text-muted-foreground">
              Visible only to you — not injected into the AI&apos;s context.
            </p>
          </div>
        </div>

        <DialogFooter>
          {saveError && (
            <p className="text-sm text-destructive mr-auto">{saveError}</p>
          )}
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={saveMutation.isPending}
          >
            Keep Playing
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={recap.isStreaming || saveMutation.isPending}
          >
            {recap.isStreaming ? (
              'Generating recap…'
            ) : saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Saving…
              </>
            ) : (
              'Save Session'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
