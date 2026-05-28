/**
 * Repository for the sessions domain.
 * All methods are synchronous, following the messagesRepo pattern.
 * D-19: sessions table with monotonically increasing session_number per campaign.
 * D-20: sessions FK referenced by messages.session_id.
 */

import { asc, desc, eq, sql, and, isNull, isNotNull, lt } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { sessions } from './schema'
import type { Session } from './schema'

export const sessionsRepo = {
  /**
   * Create a new session for a campaign.
   * Computes monotonic session_number = MAX(session_number) + 1 per campaign.
   * Returns the created Session row.
   */
  create(input: {
    campaignId: string
    location?: string | null
    goal?: string | null
    contextNotes?: string | null
  }): Session {
    const db = getDb()
    const id = randomUUID()

    // Compute next session_number
    const maxRow = db
      .select({ max: sql<number>`MAX(session_number)` })
      .from(sessions)
      .where(eq(sessions.campaignId, input.campaignId))
      .get()

    const sessionNumber = (maxRow?.max ?? 0) + 1

    db.insert(sessions)
      .values({
        id,
        campaignId: input.campaignId,
        sessionNumber,
        location: input.location ?? null,
        goal: input.goal ?? null,
        contextNotes: input.contextNotes ?? null,
      })
      .run()

    const created = db.select().from(sessions).where(eq(sessions.id, id)).get()

    if (!created) {
      throw new Error('[sessions] Failed to retrieve session after insert')
    }

    return created
  },

  /**
   * Get a session by its ID.
   */
  getById(sessionId: string): Session | undefined {
    const db = getDb()
    return db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
  },

  /**
   * Get the currently active (not yet ended) session for a campaign.
   * Returns undefined if no session is active.
   */
  getActiveByCampaignId(campaignId: string): Session | undefined {
    const db = getDb()
    return db
      .select()
      .from(sessions)
      .where(and(eq(sessions.campaignId, campaignId), isNull(sessions.endedAt)))
      .get()
  },

  /**
   * Get the N most recently completed sessions for a campaign.
   * Returns them in chronological order (oldest-first within the N).
   * Used for Layer 2 memory injection (D-15).
   */
  getLastNCompleted(campaignId: string, n: number): Session[] {
    const db = getDb()
    const rows = db
      .select()
      .from(sessions)
      .where(and(eq(sessions.campaignId, campaignId), isNotNull(sessions.endedAt)))
      .orderBy(desc(sessions.sessionNumber))
      .limit(n)
      .all()

    // reverse to oldest-first within the N
    return rows.reverse()
  },

  /**
   * Get all completed sessions older than a given session number.
   * Ordered by session_number ascending.
   * Used for Layer 3 rolling summary generation (D-16).
   */
  getOlderThan(campaignId: string, beforeSessionNumber: number): Session[] {
    const db = getDb()
    return db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.campaignId, campaignId),
          isNotNull(sessions.endedAt),
          lt(sessions.sessionNumber, beforeSessionNumber),
        ),
      )
      .orderBy(asc(sessions.sessionNumber))
      .all()
  },

  /**
   * List all completed sessions for a campaign, newest-first.
   * Used by the Session Journal tab (D-22).
   */
  list(campaignId: string): Session[] {
    const db = getDb()
    return db
      .select()
      .from(sessions)
      .where(and(eq(sessions.campaignId, campaignId), isNotNull(sessions.endedAt)))
      .orderBy(desc(sessions.sessionNumber))
      .all()
  },

  /**
   * End a session by setting endedAt to now.
   * Returns the updated Session row.
   */
  end(sessionId: string): Session {
    const db = getDb()

    db.update(sessions)
      .set({ endedAt: new Date(Date.now()) })
      .where(eq(sessions.id, sessionId))
      .run()

    const updated = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()

    if (!updated) {
      throw new Error(`[sessions] Session not found after end: ${sessionId}`)
    }

    return updated
  },

  /**
   * Save the AI-generated recap and optional player notes for a session.
   * Returns the updated Session row.
   */
  saveRecap(sessionId: string, aiRecap: string, playerNotes?: string | null): Session {
    const db = getDb()

    const updateValues: Partial<typeof sessions.$inferInsert> = { aiRecap }
    if (playerNotes !== undefined) {
      updateValues.playerNotes = playerNotes
    }

    db.update(sessions).set(updateValues).where(eq(sessions.id, sessionId)).run()

    const updated = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()

    if (!updated) {
      throw new Error(`[sessions] Session not found after saveRecap: ${sessionId}`)
    }

    return updated
  },

  /**
   * Update the player notes for a session.
   * Returns the updated Session row.
   */
  updatePlayerNotes(sessionId: string, playerNotes: string): Session {
    const db = getDb()

    db.update(sessions).set({ playerNotes }).where(eq(sessions.id, sessionId)).run()

    const updated = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()

    if (!updated) {
      throw new Error(`[sessions] Session not found after updatePlayerNotes: ${sessionId}`)
    }

    return updated
  },

  /**
   * Mark a session as incorporated into the rolling summary (Layer 3).
   * D-19: isSummarized = true prevents re-inclusion in future rolling summaries.
   */
  markSummarized(sessionId: string): void {
    const db = getDb()
    db.update(sessions).set({ isSummarized: true }).where(eq(sessions.id, sessionId)).run()
  },

  /**
   * Get the location from the most recently completed session for a campaign.
   * Returns null if no sessions have been completed or the last session has no location.
   * Used to pre-fill the location field on the next session start (D-07).
   */
  getLastLocation(campaignId: string): string | null {
    const db = getDb()
    const row = db
      .select({ location: sessions.location })
      .from(sessions)
      .where(and(eq(sessions.campaignId, campaignId), isNotNull(sessions.endedAt)))
      .orderBy(desc(sessions.sessionNumber))
      .limit(1)
      .get()

    return row?.location ?? null
  },

  /**
   * End all active sessions for a campaign.
   * Called by the app before-quit handler to clean up mid-session exits (D-06).
   */
  endAllActive(campaignId: string): void {
    const db = getDb()
    db.update(sessions)
      .set({ endedAt: new Date(Date.now()) })
      .where(and(eq(sessions.campaignId, campaignId), isNull(sessions.endedAt)))
      .run()
  },
}
