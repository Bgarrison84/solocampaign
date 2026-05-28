/**
 * SessionStartModal — Session start dialog (UI-SPEC S2).
 *
 * Three optional fields:
 * - Current Location: pre-filled from the last completed session (D-07)
 * - Session Goal: what the player wants to accomplish
 * - Context Notes: anything the DM should know before starting
 *
 * On submit: calls sessions.start mutation, then sets sessionStore state and closes.
 * Enter key moves focus field-to-field; no accidental submission.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { trpc } from '../lib/trpc'
import { useSessionStore } from '../stores/sessionStore'

export interface SessionStartModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  /** Pre-filled from last session's location (D-07) */
  lastLocation?: string | null
}

export function SessionStartModal({
  open,
  onClose,
  campaignId,
  lastLocation,
}: SessionStartModalProps) {
  const [location, setLocation] = useState('')
  const [goal, setGoal] = useState('')
  const [notes, setNotes] = useState('')

  const goalRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Reset fields on open; pre-fill location from last session
  useEffect(() => {
    if (open) {
      setLocation(lastLocation ?? '')
      setGoal('')
      setNotes('')
    }
  }, [open, lastLocation])

  const startMutation = useMutation({
    mutationFn: (input: {
      campaignId: string
      location?: string
      goal?: string
      contextNotes?: string
    }) => trpc.sessions.start.mutate(input),
    onSuccess: (result) => {
      useSessionStore.getState().startSession(result.id, result.sessionNumber, {
        location: location.trim() || null,
        goal: goal.trim() || null,
        contextNotes: notes.trim() || null,
      })
      onClose()
    },
  })

  const handleSubmit = () => {
    if (startMutation.isPending) return
    startMutation.mutate({
      campaignId,
      location: location.trim() || undefined,
      goal: goal.trim() || undefined,
      contextNotes: notes.trim() || undefined,
    })
  }

  const inputClassName =
    'bg-secondary border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary'

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !startMutation.isPending) onClose()
      }}
    >
      <DialogContent className="max-w-[480px] w-full max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Start Session</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Current Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-location" className="text-sm font-semibold">
              Current Location
            </Label>
            <Input
              id="session-location"
              type="text"
              autoFocus
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Forest > Ancient Ruins > Crypt Level 2"
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  goalRef.current?.focus()
                }
              }}
              className={inputClassName}
            />
            <p className="text-[12px] text-muted-foreground">Where does this session begin?</p>
          </div>

          {/* Session Goal */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-goal" className="text-sm font-semibold">
              Session Goal
            </Label>
            <Input
              id="session-goal"
              type="text"
              ref={goalRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What are you trying to accomplish?"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  notesRef.current?.focus()
                }
              }}
              className={inputClassName}
            />
          </div>

          {/* Context Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-notes" className="text-sm font-semibold">
              Context Notes
            </Label>
            <Textarea
              id="session-notes"
              rows={3}
              className={`resize-none ${inputClassName}`}
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the DM should know before you start — ongoing effects, NPC relationships, loose threads."
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={startMutation.isPending}
          >
            Not Yet
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Starting…
              </>
            ) : (
              'Begin Session'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
