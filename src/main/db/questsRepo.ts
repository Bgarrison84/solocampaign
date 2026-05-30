/**
 * Repository for the quests domain (STATE-01).
 * AI-managed quest log per campaign. All methods are synchronous,
 * following the sessionsRepo pattern.
 */

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import { getDb } from './index'
import { quests } from './schema'
import type { Quest } from './schema'

export const questsRepo = {
  /**
   * Create a quest. status defaults to 'Active', description to ''.
   * Inserts then selects the row back so DB defaults are reflected.
   */
  create(input: { campaignId: string; name: string; description?: string }): Quest {
    const db = getDb()
    const id = randomUUID()

    db.insert(quests)
      .values({
        id,
        campaignId: input.campaignId,
        name: input.name,
        description: input.description ?? '',
      })
      .run()

    const created = db.select().from(quests).where(eq(quests.id, id)).get()
    if (!created) {
      throw new Error('[quests] Failed to retrieve quest after insert')
    }
    return created
  },

  /**
   * List all quests for a campaign in chronological (oldest-first) order (D-02).
   */
  list(campaignId: string): Quest[] {
    const db = getDb()
    return db
      .select()
      .from(quests)
      .where(eq(quests.campaignId, campaignId))
      .orderBy(asc(quests.createdAt))
      .all()
  },

  /**
   * Update a quest's status. campaignId is required to prevent cross-campaign writes.
   */
  updateStatus(questId: string, campaignId: string, status: 'Active' | 'Completed' | 'Failed'): void {
    const db = getDb()
    const result = db
      .update(quests)
      .set({ status })
      .where(and(eq(quests.id, questId), eq(quests.campaignId, campaignId)))
      .run()
    if (result.changes === 0) {
      log.warn('[questsRepo] updateStatus: no quest matched id/campaignId', questId, campaignId)
    }
  },
}
