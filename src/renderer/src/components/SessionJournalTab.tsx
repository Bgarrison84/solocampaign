import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useHotkeys } from 'react-hotkeys-hook'
import dayjs from 'dayjs'
import { ChevronDown, Circle } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible'
import { ScrollArea } from './ui/scroll-area'
import { Textarea } from './ui/textarea'
import { useSessionStore } from '../stores/sessionStore'
import { cn } from '../lib/utils'

// Infer the session row type from the tRPC query result (no cross-process import needed)
type SessionRow = Awaited<ReturnType<typeof trpc.sessions.list.query>>[number]

// ─── SessionCard ──────────────────────────────────────────────────────────────
//
// File-local sub-component for a single completed session card.
// Each card is an independent Collapsible (not an accordion — multiple can be open).
// useHotkeys must be called inside a component (not conditionally in a map), so we
// extract this to a named function component.

function SessionCard({
  session,
  isOpen,
  onToggle,
  note,
  onNoteChange,
  onSave,
  saveError,
  isSaving,
}: {
  session: SessionRow
  isOpen: boolean
  onToggle: () => void
  note: string
  onNoteChange: (value: string) => void
  onSave: () => void
  saveError: string | null
  isSaving: boolean
}) {
  // Ctrl+Enter saves notes when the card is open and not already saving (D-24)
  useHotkeys(
    'ctrl+enter',
    (e) => {
      e.preventDefault()
      onSave()
    },
    {
      enableOnFormTags: ['TEXTAREA'],
      enabled: isOpen && !isSaving,
    },
  )

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary cursor-pointer transition-colors text-left"
            aria-expanded={isOpen}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-150 shrink-0',
                isOpen && 'rotate-180',
              )}
            />
            <span className="text-sm font-semibold text-foreground">
              Session {session.sessionNumber}
            </span>
            <span className="text-sm text-muted-foreground">
              {dayjs(session.startedAt).format('MMM D, YYYY')}
            </span>
            {session.location && (
              <span className="text-sm italic text-muted-foreground truncate flex-1">
                — {session.location}
              </span>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="px-4 py-4 flex flex-col gap-4 bg-secondary">

              {/* AI Recap — read-only (D-13) */}
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">Session Recap</h3>
                <div className="text-sm leading-[1.6] text-foreground whitespace-pre-wrap">
                  {session.aiRecap ?? (
                    <span className="text-muted-foreground italic">No recap recorded.</span>
                  )}
                </div>
              </div>

              {/* Player Notes — always editable (D-24) */}
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">Player Notes</h3>
                <Textarea
                  value={note}
                  onChange={(e) => onNoteChange(e.target.value)}
                  placeholder="Click to add personal notes…"
                  className="min-h-[64px] bg-background border-border text-sm text-foreground placeholder:text-muted-foreground resize-y"
                />
                {saveError && (
                  <p className="text-sm text-destructive">{saveError}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[12px] text-muted-foreground">Ctrl+Enter to save</span>
                  <button
                    type="button"
                    className="text-sm text-primary underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving…' : 'Save Notes'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─── SessionJournalTab ────────────────────────────────────────────────────────
//
// Main exported component. Renders a scrollable timeline of completed sessions
// newest-first (from trpc.sessions.list, which returns DESC by session_number).
// An in-progress placeholder appears at the top when isSessionActive is true.
// Empty state is shown when no sessions exist and no session is active.

export function SessionJournalTab({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient()
  const isSessionActive = useSessionStore((s) => s.isSessionActive)
  const currentSessionNumber = useSessionStore((s) => s.sessionNumber)

  // ── data fetching ──────────────────────────────────────────────────────────

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'list', campaignId],
    queryFn: () => trpc.sessions.list.query({ campaignId }),
    enabled: !!campaignId,
  })

  const sessions = sessionsQuery.data ?? []

  // ── per-card open/close state (Set — multiple can be open simultaneously) ──

  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── per-card edited notes (Map — tracks local edits before save) ───────────

  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map())
  const getNote = (sessionId: string, fallback: string | null) =>
    notesMap.has(sessionId) ? notesMap.get(sessionId)! : (fallback ?? '')
  const setNote = useCallback((sessionId: string, value: string) => {
    setNotesMap((prev) => new Map(prev).set(sessionId, value))
  }, [])

  // ── per-card save errors ───────────────────────────────────────────────────

  const [errorMap, setErrorMap] = useState<Map<string, string | null>>(new Map())
  const setError = useCallback((sessionId: string, msg: string | null) => {
    setErrorMap((prev) => new Map(prev).set(sessionId, msg))
  }, [])

  // ── save mutation (shared; called with { sessionId, playerNotes }) ─────────

  const saveNotesMutation = useMutation({
    mutationFn: (vars: { sessionId: string; playerNotes: string }) =>
      trpc.sessions.updatePlayerNotes.mutate(vars),
    onSuccess: (_data, vars) => {
      setError(vars.sessionId, null)
      queryClient.invalidateQueries({ queryKey: ['sessions', 'list', campaignId] })
    },
    onError: (_err, vars) => {
      setError(vars.sessionId, 'Could not save notes. Try again.')
    },
  })

  const handleSaveNotes = useCallback(
    (sessionId: string, currentNote: string) => {
      setError(sessionId, null)
      saveNotesMutation.mutate({ sessionId, playerNotes: currentNote })
    },
    [saveNotesMutation, setError],
  )

  // ── in-progress session number ─────────────────────────────────────────────

  const maxSessionNumber =
    sessions.length > 0 ? Math.max(...sessions.map((s) => s.sessionNumber)) : 0
  const inProgressNumber = isSessionActive
    ? (currentSessionNumber ?? maxSessionNumber + 1)
    : null

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden p-0">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-4">

          {/* Empty state */}
          {sessions.length === 0 && !isSessionActive && (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">
                No sessions yet. Start a session to begin journaling.
              </p>
            </div>
          )}

          {/* In-progress session placeholder — always first */}
          {inProgressNumber !== null && (
            <div
              role="status"
              aria-disabled="true"
              className="bg-card/50 border border-border rounded-lg px-4 py-3 flex items-center gap-2 opacity-60 cursor-not-allowed"
            >
              <Circle className="h-3 w-3 text-amber-500 animate-pulse shrink-0" />
              <span className="text-sm italic text-muted-foreground">
                Session {inProgressNumber} in progress
              </span>
            </div>
          )}

          {/* Completed session cards — newest-first (DB returns DESC by session_number) */}
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isOpen={openIds.has(session.id)}
              onToggle={() => toggleOpen(session.id)}
              note={getNote(session.id, session.playerNotes)}
              onNoteChange={(value) => setNote(session.id, value)}
              onSave={() =>
                handleSaveNotes(session.id, getNote(session.id, session.playerNotes))
              }
              saveError={errorMap.get(session.id) ?? null}
              isSaving={
                saveNotesMutation.isPending &&
                saveNotesMutation.variables?.sessionId === session.id
              }
            />
          ))}

        </div>
      </ScrollArea>
    </div>
  )
}
