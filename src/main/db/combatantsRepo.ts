/**
 * Repository for the combatants domain (COMB-02).
 * All methods are synchronous, following the sessionsRepo pattern.
 * The initiative tracker stores one row per combatant per campaign; isActive
 * flips to false when an encounter ends rather than deleting rows.
 */

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { combatants } from './schema'
import type { Combatant } from './schema'

export const combatantsRepo = {
  /**
   * Add a combatant to the tracker.
   * Sets hpCurrent = hpMax, conditions = '[]', isActive = true.
   * Returns the created Combatant row.
   */
  create(input: {
    campaignId: string
    sessionId?: string | null
    name: string
    hpMax: number
    ac: number
    initiative: number
    initiativeOrder: number
    isPlayer: boolean
  }): Combatant {
    const db = getDb()
    const id = randomUUID()

    db.insert(combatants)
      .values({
        id,
        campaignId: input.campaignId,
        sessionId: input.sessionId ?? null,
        name: input.name,
        hpCurrent: input.hpMax,
        hpMax: input.hpMax,
        ac: input.ac,
        initiative: input.initiative,
        initiativeOrder: input.initiativeOrder,
        conditions: '[]',
        isPlayer: input.isPlayer,
        isActive: true,
      })
      .run()

    const created = db.select().from(combatants).where(eq(combatants.id, id)).get()

    if (!created) {
      throw new Error('[combatants] Failed to retrieve combatant after insert')
    }

    return created
  },

  /**
   * List all active combatants for a campaign, ordered by initiativeOrder ascending.
   */
  listActive(campaignId: string): Combatant[] {
    const db = getDb()
    return db
      .select()
      .from(combatants)
      .where(and(eq(combatants.campaignId, campaignId), eq(combatants.isActive, true)))
      .orderBy(asc(combatants.initiativeOrder))
      .all()
  },

  /**
   * Set a combatant's current HP.
   */
  updateHp(id: string, hpCurrent: number): void {
    const db = getDb()
    db.update(combatants).set({ hpCurrent }).where(eq(combatants.id, id)).run()
  },

  /**
   * Replace a combatant's conditions JSON string.
   */
  updateConditions(id: string, conditionsJson: string): void {
    const db = getDb()
    db.update(combatants).set({ conditions: conditionsJson }).where(eq(combatants.id, id)).run()
  },

  /**
   * Delete a single combatant by id.
   */
  remove(id: string): void {
    const db = getDb()
    db.delete(combatants).where(eq(combatants.id, id)).run()
  },

  /**
   * End combat for a campaign: bulk-set isActive = false for all active combatants.
   */
  endCombat(campaignId: string): void {
    const db = getDb()
    db.update(combatants)
      .set({ isActive: false })
      .where(and(eq(combatants.campaignId, campaignId), eq(combatants.isActive, true)))
      .run()
  },

  /**
   * Alias of endCombat — used when a new session starts to clear any lingering
   * active combatants from a previous session.
   */
  clearForCampaign(campaignId: string): void {
    this.endCombat(campaignId)
  },
}
