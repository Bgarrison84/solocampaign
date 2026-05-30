/**
 * Repository for the npcs domain (STATE-02).
 * AI-tracked NPCs per campaign. All methods are synchronous,
 * following the sessionsRepo pattern.
 */

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import { getDb } from './index'
import { npcs } from './schema'
import type { Npc } from './schema'

export const npcsRepo = {
  /**
   * Create an NPC. relationship defaults to 'Unknown', description to '',
   * factionName to null. Inserts then selects the row back.
   */
  create(input: {
    campaignId: string
    name: string
    description?: string
    relationship?: string
    factionName?: string | null
  }): Npc {
    const db = getDb()
    const id = randomUUID()

    db.insert(npcs)
      .values({
        id,
        campaignId: input.campaignId,
        name: input.name,
        description: input.description ?? '',
        relationship: input.relationship ?? 'Unknown',
        factionName: input.factionName ?? null,
      })
      .run()

    const created = db.select().from(npcs).where(eq(npcs.id, id)).get()
    if (!created) {
      throw new Error('[npcs] Failed to retrieve npc after insert')
    }
    return created
  },

  /**
   * List all NPCs for a campaign in chronological (oldest-first) order (D-06).
   */
  list(campaignId: string): Npc[] {
    const db = getDb()
    return db
      .select()
      .from(npcs)
      .where(eq(npcs.campaignId, campaignId))
      .orderBy(asc(npcs.createdAt))
      .all()
  },

  /**
   * Partially update an NPC. campaignId is required to prevent cross-campaign writes.
   * Only the provided fields are written; absent fields are left untouched.
   */
  patch(
    npcId: string,
    campaignId: string,
    fields: { description?: string; relationship?: string; factionName?: string | null },
  ): void {
    const db = getDb()
    const set: Partial<typeof npcs.$inferInsert> = {}
    if (fields.description !== undefined) set.description = fields.description
    if (fields.relationship !== undefined) set.relationship = fields.relationship
    if (fields.factionName !== undefined) set.factionName = fields.factionName
    if (Object.keys(set).length === 0) return
    const result = db
      .update(npcs)
      .set(set)
      .where(and(eq(npcs.id, npcId), eq(npcs.campaignId, campaignId)))
      .run()
    if (result.changes === 0) {
      log.warn('[npcsRepo] patch: no NPC matched id/campaignId', npcId, campaignId)
    }
  },
}
