/**
 * Repository for the custom_feats domain (Phase 7 — CHAR-05, RULES-03).
 * Campaign-scoped homebrew feats: name + description only.
 * The AI interprets their mechanical effects.
 * All methods are synchronous, following the questsRepo/npcsRepo pattern.
 */

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import { getDb } from './index'
import { customFeats } from './schema'
import type { CustomFeat } from './schema'

export const customFeatsRepo = {
  /**
   * Create a campaign-scoped custom feat.
   * Inserts then selects the row back so DB defaults are reflected.
   */
  create(input: { campaignId: string; name: string; description: string }): CustomFeat {
    const db = getDb()
    const id = randomUUID()

    db.insert(customFeats)
      .values({
        id,
        campaignId: input.campaignId,
        name: input.name,
        description: input.description,
      })
      .run()

    const created = db.select().from(customFeats).where(eq(customFeats.id, id)).get()
    if (!created) {
      throw new Error('[customFeatsRepo] Failed to retrieve custom feat after insert')
    }
    return created
  },

  /**
   * List all custom feats for a campaign in chronological (oldest-first) order.
   */
  listByCampaign(campaignId: string): CustomFeat[] {
    const db = getDb()
    return db
      .select()
      .from(customFeats)
      .where(eq(customFeats.campaignId, campaignId))
      .orderBy(asc(customFeats.createdAt))
      .all()
  },

  /**
   * Delete a custom feat. campaignId guard prevents cross-campaign deletes.
   */
  delete(id: string, campaignId: string): void {
    const db = getDb()
    const result = db
      .delete(customFeats)
      .where(and(eq(customFeats.id, id), eq(customFeats.campaignId, campaignId)))
      .run()
    if (result.changes === 0) {
      log.warn('[customFeatsRepo] delete: no feat matched id/campaignId', id, campaignId)
    }
  },
}
