import { create } from 'zustand'

/**
 * Zustand store for session lifecycle state.
 *
 * Drives the session start/end flow in CampaignViewScreen:
 * - isSessionActive: gates chat input (locked/unlocked)
 * - activeSessionId: used by EndSessionModal for recap IPC call
 * - sessionNumber: displayed in EndSessionModal header
 * - sessionContext: pre-populates EndSessionModal fields (location, goal, notes)
 * - isL1Overflow: triggers amber warning bar in StoryScrollPanel when context window overflows
 *
 * Actions:
 * - startSession: set on sessions.start mutation success (plan 04-05)
 * - endSession: set on sessions.saveRecap mutation success (plan 04-05)
 * - setL1Overflow: set from ai:finish isL1Overflow meta payload (plan 04-04 extension)
 */

export interface SessionContext {
  location: string | null
  goal: string | null
  contextNotes: string | null
}

interface SessionState {
  /** DB session ID while a session is active; null otherwise */
  activeSessionId: string | null
  /** True when a session is in progress — gates chat input and drives button swap */
  isSessionActive: boolean
  /** Session number from DB, shown in EndSessionModal header */
  sessionNumber: number | null
  /** Session context passed to EndSessionModal for pre-population */
  sessionContext: SessionContext | null
  /** True when the AI context window overflowed L1 — shown as amber warning bar */
  isL1Overflow: boolean

  /** Call on sessions.start success to unlock chat and set session state */
  startSession: (sessionId: string, sessionNumber: number, context: SessionContext) => void
  /** Call on sessions.saveRecap success to lock chat and clear session state */
  endSession: () => void
  /** Call from ai:finish handler when isL1Overflow is true in meta payload */
  setL1Overflow: (overflow: boolean) => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  activeSessionId: null,
  isSessionActive: false,
  sessionNumber: null,
  sessionContext: null,
  isL1Overflow: false,

  startSession: (sessionId, sessionNumber, context) =>
    set({
      activeSessionId: sessionId,
      isSessionActive: true,
      sessionNumber,
      sessionContext: context,
      isL1Overflow: false,
    }),

  endSession: () =>
    set({
      activeSessionId: null,
      isSessionActive: false,
      sessionNumber: null,
      sessionContext: null,
      isL1Overflow: false,
    }),

  setL1Overflow: (overflow) => set({ isL1Overflow: overflow }),
}))
