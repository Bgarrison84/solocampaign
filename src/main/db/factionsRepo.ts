/**
 * Repository for the factions domain (STATE-03).
 * AI-tracked factions per campaign. Upsert is keyed on (campaignId, name) so
 * repeated updateFaction calls mutate one row rather than accumulating
 * duplicates (Pitfall 5). All methods are synchronous.
 */

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { factions } from './schema'
import type { Faction } from './schema'

export const factionsRepo = {
  /**
   * Create-or-update a faction by (campaignId, name). tier defaults to 'Neutral'.
   * On conflict with the unique (campaign_id, name) index, the existing row's
   * tier is updated. Selects the row back and returns it.
   */
  upsert(input: { campaignId: string; name: string; tier?: string }): Faction {
    const db = getDb()
    const tier = input.tier ?? 'Neutral'

    db.insert(factions)
      .values({ id: randomUUID(), campaignId: input.campaignId, name: input.name, tier })
      .onConflictDoUpdate({
        target: [factions.campaignId, factions.name],
        set: { tier },
      })
      .run()

    const row = db
      .select()
      .from(factions)
      .where(and(eq(factions.campaignId, input.campaignId), eq(factions.name, input.name)))
      .get()
    if (!row) {
      throw new Error('[factions] Failed to retrieve faction after upsert')
    }
    return row
  },

  /**
   * List all factions for a campaign in chronological (oldest-first) order.
   */
  list(campaignId: string): Faction[] {
    const db = getDb()
    return db
      .select()
      .from(factions)
      .where(eq(factions.campaignId, campaignId))
      .orderBy(asc(factions.createdAt))
      .all()
  },
}
