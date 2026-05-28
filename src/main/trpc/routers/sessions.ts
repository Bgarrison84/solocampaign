/**
 * Sessions tRPC router.
 *
 * Procedures:
 * - start: create session row + set sessionActiveMap + return { id, sessionNumber }
 * - end: set ended_at + clear sessionActiveMap + return { ended: true }
 * - saveRecap: persist aiRecap + playerNotes + clear sessionActiveMap + schedule rolling summary
 * - updatePlayerNotes: update playerNotes only + return { updated: true }
 * - list: return sessions array for campaignId newest-first
 * - getActive: return active session for campaignId or null
 * - getLastLocation: return location from last completed session or null
 *
 * Security:
 * - T-04-03-02: Zod sessionRecapSchema (max 50000) validates aiRecap at tRPC boundary
 * - T-04-03-04: campaignIdSchema (uuid) validates campaignId at tRPC boundary
 * - T-04-03-05: Rolling summary runs in Promise.resolve().then() — non-blocking, non-fatal
 * - T-04-03-SC: No npm installs in this plan
 *
 * D-06: app.before-quit session auto-end is handled in src/main/index.ts (raw SQL UPDATE).
 */

import { z } from 'zod'
import { t } from '../_base'
import { sessionsRepo } from '../../db/sessionsRepo'
import { campaignsRepo } from '../../db/campaignsRepo'
import { sessionActiveMap } from '../../ai/aiSessionState'
import { secretStorage } from '../../secrets'
import { generateRollingSummary } from '../../ai/recapGenerator'
import log from 'electron-log'
import {
  campaignIdSchema,
  sessionIdSchema,
  sessionLocationSchema,
  sessionGoalSchema,
  sessionContextNotesSchema,
  sessionRecapSchema,
  playerNotesSchema,
} from '../schemas'
import type { LLMProviderConfig } from '../../ai/llmProvider'

// ─── D-06 recovery helper ─────────────────────────────────────────────────────
//
// If the app exited mid-session (via before-quit raw SQL UPDATE), there may be
// sessions with endedAt set but isSummarized=false. This runs before a new
// session is started so Layer 3 memory is up-to-date for the next session.
// Errors are caught and logged — non-fatal (rolling summary is best-effort).
async function runD06Recovery(campaignId: string): Promise<void> {
  const unsummarized = sessionsRepo.getUnsummarized(campaignId)
  if (unsummarized.length === 0) return

  log.debug('[sessions] D-06 recovery: found unsummarized sessions', {
    campaignId,
    count: unsummarized.length,
  })

  try {
    const campaign = campaignsRepo.get(campaignId)
    if (!campaign) {
      log.error('[sessions] D-06 recovery: campaign not found', { campaignId })
      return
    }

    // Use the most recently ended unsummarized session as reference point
    const lastUnsummarized = unsummarized[unsummarized.length - 1]

    // Sessions older than the current L2 window
    const olderSessions = sessionsRepo.getOlderThan(
      campaignId,
      lastUnsummarized.sessionNumber - 2,
    )

    if (olderSessions.length === 0) {
      // Nothing old enough to summarize — mark all as summarized and return
      for (const s of unsummarized) {
        sessionsRepo.markSummarized(s.id)
      }
      return
    }

    const apiKey = await secretStorage.decrypt('ai-key-' + campaignId)

    const providerConfig: LLMProviderConfig = {
      type: (campaign.providerType as 'openai-compatible' | 'gemini') ?? 'openai-compatible',
      endpointUrl: campaign.endpointUrl ?? undefined,
      modelName: campaign.modelName ?? '',
      apiKey: apiKey ?? undefined,
    }

    const summary = await generateRollingSummary(
      providerConfig,
      olderSessions.map((s) => ({
        sessionNumber: s.sessionNumber,
        aiRecap: s.aiRecap ?? '',
      })),
    )

    const truncated = summary.substring(0, 4000)

    campaignsRepo.updateRollingSummary(campaignId, truncated)

    // Mark all recovered sessions as summarized
    for (const s of unsummarized) {
      sessionsRepo.markSummarized(s.id)
    }

    log.debug('[sessions] D-06 recovery: rolling summary updated', {
      campaignId,
      summaryLength: truncated.length,
      sessionCount: unsummarized.length,
    })
  } catch (err) {
    // Non-fatal — new session will proceed, L3 just won't be updated
    log.error(
      '[sessions] D-06 recovery failed:',
      err instanceof Error ? err.message : String(err),
    )
  }
}

export const sessionsRouter = t.router({
  /**
   * Start a new session for a campaign.
   * Creates a DB row and marks the session as active in the in-memory sessionActiveMap.
   * Returns { id, sessionNumber } so the caller can store the session ID in UI state.
   */
  start: t.procedure
    .input(
      z.object({
        campaignId: campaignIdSchema,
        location: sessionLocationSchema.nullish(),
        goal: sessionGoalSchema.nullish(),
        contextNotes: sessionContextNotesSchema.nullish(),
      }),
    )
    .mutation(async ({ input }) => {
      // D-06 recovery: if any sessions ended without a rolling summary (e.g. app crash / before-quit),
      // generate the rolling summary now before starting the new session so L3 is current.
      await runD06Recovery(input.campaignId)

      const session = sessionsRepo.create({
        campaignId: input.campaignId,
        location: input.location ?? null,
        goal: input.goal ?? null,
        contextNotes: input.contextNotes ?? null,
      })

      // Track this session as active for the campaign (D-04 / sessionActiveMap)
      sessionActiveMap.set(input.campaignId, session.id)

      log.debug('[sessions] start', { campaignId: input.campaignId, sessionId: session.id, sessionNumber: session.sessionNumber })

      return { id: session.id, sessionNumber: session.sessionNumber }
    }),

  /**
   * End an active session by setting ended_at and clearing sessionActiveMap.
   */
  end: t.procedure
    .input(z.object({ sessionId: sessionIdSchema }))
    .mutation(({ input }) => {
      const session = sessionsRepo.end(input.sessionId)

      // Clear the in-memory active session tracking
      sessionActiveMap.clear(session.campaignId)

      log.debug('[sessions] end', { sessionId: input.sessionId })

      return { ended: true }
    }),

  /**
   * Save the AI-generated recap and optional player notes for a completed session.
   * Clears sessionActiveMap and schedules background rolling summary generation.
   *
   * Rolling summary (Layer 3):
   * - Runs in Promise.resolve().then() to not block the tRPC response
   * - try/catch prevents any failure from crashing the app (T-04-03-05)
   * - Uses primary provider only (Pitfall 4)
   */
  saveRecap: t.procedure
    .input(
      z.object({
        sessionId: sessionIdSchema,
        campaignId: campaignIdSchema,
        aiRecap: sessionRecapSchema,
        playerNotes: playerNotesSchema.optional(),
      }),
    )
    .mutation(({ input }) => {
      // CR-05: End the session first (set endedAt) so it appears in getLastNCompleted / L2 / Journal
      sessionsRepo.end(input.sessionId)
      // Persist recap + notes to DB
      sessionsRepo.saveRecap(input.sessionId, input.aiRecap, input.playerNotes ?? null)

      // Clear in-memory active session
      sessionActiveMap.clear(input.campaignId)

      log.debug('[sessions] saveRecap', { sessionId: input.sessionId, campaignId: input.campaignId })

      // Schedule background rolling summary (D-16) — non-blocking, non-fatal (T-04-03-05)
      const { sessionId, campaignId } = input
      Promise.resolve().then(async () => {
        try {
          const campaign = campaignsRepo.get(campaignId)
          if (!campaign) {
            log.error('[sessions] Rolling summary: campaign not found', { campaignId })
            return
          }

          const savedSession = sessionsRepo.getById(sessionId)
          if (!savedSession) {
            log.error('[sessions] Rolling summary: session not found', { sessionId })
            return
          }

          // Sessions older than current L2 window (keep N, N-1, N-2 in L2; roll up < N-2)
          const olderSessions = sessionsRepo.getOlderThan(
            campaignId,
            savedSession.sessionNumber - 2, // CR-03 fix: was -3 (off-by-one)
          )

          if (olderSessions.length === 0) {
            // No old sessions to summarize yet — leave existing L3 intact (WR-02 fix)
            return
          }

          // Decrypt API key for primary provider (Pitfall 4 — never use fallback for recap)
          const apiKey = await secretStorage.decrypt('ai-key-' + campaignId)

          const providerConfig: LLMProviderConfig = {
            type: (campaign.providerType as 'openai-compatible' | 'gemini') ?? 'openai-compatible',
            endpointUrl: campaign.endpointUrl ?? undefined,
            modelName: campaign.modelName ?? '',
            apiKey: apiKey ?? undefined,
          }

          const summary = await generateRollingSummary(
            providerConfig,
            olderSessions.map((s) => ({
              sessionNumber: s.sessionNumber,
              aiRecap: s.aiRecap ?? '',
            })),
          )

          // Truncate to 4000 chars (L3 cap: CHARS_L3_CAP from contextBuilder)
          const truncated = summary.substring(0, 4000)

          campaignsRepo.updateRollingSummary(campaignId, truncated)
          sessionsRepo.markSummarized(sessionId)

          log.debug('[sessions] Rolling summary updated', { campaignId, summaryLength: truncated.length })
        } catch (err) {
          // Non-fatal — next session start will have an empty/stale L3
          log.error('[sessions] Rolling summary failed:', err instanceof Error ? err.message : String(err))
          // Do not rethrow — T-04-03-05
        }
      })

      return { saved: true }
    }),

  /**
   * Update player notes for a session (editable from Journal tab at any time — D-24).
   */
  updatePlayerNotes: t.procedure
    .input(z.object({ sessionId: sessionIdSchema, playerNotes: playerNotesSchema }))
    .mutation(({ input }) => {
      sessionsRepo.updatePlayerNotes(input.sessionId, input.playerNotes)
      return { updated: true }
    }),

  /**
   * List all completed sessions for a campaign, newest-first (D-22).
   */
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => {
      return sessionsRepo.list(input.campaignId)
    }),

  /**
   * Get the active session for a campaign, or null if no session is in progress.
   */
  getActive: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => {
      const session = sessionsRepo.getActiveByCampaignId(input.campaignId) ?? null
      // CR-02: Re-hydrate in-memory sessionActiveMap after app restart/page reload
      if (session) {
        sessionActiveMap.set(input.campaignId, session.id)
      } else {
        sessionActiveMap.clear(input.campaignId)
      }
      return session
    }),

  /**
   * Get the location from the last completed session (used to pre-fill session start modal — D-07).
   */
  getLastLocation: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => {
      return sessionsRepo.getLastLocation(input.campaignId)
    }),
})
