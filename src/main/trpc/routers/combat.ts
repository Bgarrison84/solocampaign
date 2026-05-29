/**
 * Combat tRPC router (COMB-02, COMB-04).
 *
 * Procedures:
 * - listActive: return active combatants for a campaign, asc initiativeOrder
 * - startCombat: log combat_started event (combatants are added separately via addCombatant)
 * - endCombat: bulk-set isActive=false + log combat_ended event
 * - updateHp: set a combatant's current HP (player or AI)
 * - updateConditions: replace a combatant's conditions JSON from a validated string array
 * - addCombatant: insert a combatant + log combatant_added event; returns the created row
 *
 * Security:
 * - T-05-03-01: Every procedure validates input with Zod. campaignIdSchema (uuid) for campaignId;
 *   hpCurrent .int().min(0).max(9999); conditions array(string.max(50)).max(20); addCombatant
 *   bounds hpMax/ac/initiative/initiativeOrder.
 * - T-05-03-02: Conditions are stored as JSON.stringify of a validated string array; the renderer
 *   guards JSON.parse on read (default []).
 *
 * Every state-changing mutation logs to campaign_events (combat_started / combat_ended /
 * combatant_added) so the AI context builder + journal can read the mechanical event log.
 */

import { z } from 'zod'
import { t } from '../_base'
import { combatantsRepo } from '../../db/combatantsRepo'
import { campaignEventsRepo } from '../../db/campaignEventsRepo'
import { campaignIdSchema } from '../schemas'
import log from 'electron-log'

export const combatRouter = t.router({
  /**
   * List all active combatants for a campaign, ordered by initiativeOrder ascending.
   */
  listActive: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => combatantsRepo.listActive(input.campaignId)),

  /**
   * Mark combat as started. Combatants are added separately (player Add form or AI addCombatant).
   * Logs a combat_started event.
   */
  startCombat: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(({ input }) => {
      campaignEventsRepo.insert({
        campaignId: input.campaignId,
        eventType: 'combat_started',
        payload: '{}',
      })
      log.debug('[combat] startCombat', { campaignId: input.campaignId })
      return { started: true }
    }),

  /**
   * End combat for a campaign: bulk-set all active combatants to isActive=false.
   * Logs a combat_ended event.
   */
  endCombat: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(({ input }) => {
      combatantsRepo.endCombat(input.campaignId)
      campaignEventsRepo.insert({
        campaignId: input.campaignId,
        eventType: 'combat_ended',
        payload: '{}',
      })
      log.debug('[combat] endCombat', { campaignId: input.campaignId })
      return { ended: true }
    }),

  /**
   * Set a combatant's current HP (player stepper or AI updateHp tool).
   */
  updateHp: t.procedure
    .input(
      z.object({
        combatantId: z.string(),
        hpCurrent: z.number().int().min(0).max(9999),
      }),
    )
    .mutation(({ input }) => {
      combatantsRepo.updateHp(input.combatantId, input.hpCurrent)
      return { updated: true }
    }),

  /**
   * Replace a combatant's conditions from a validated string array (player condition picker
   * or AI applyCondition tool). Stored as a JSON string.
   */
  updateConditions: t.procedure
    .input(
      z.object({
        combatantId: z.string(),
        conditions: z.array(z.string().max(50)).max(20),
      }),
    )
    .mutation(({ input }) => {
      combatantsRepo.updateConditions(input.combatantId, JSON.stringify(input.conditions))
      return { updated: true }
    }),

  /**
   * Add a combatant to the tracker (player Add form or AI addCombatant tool).
   * Logs a combatant_added event and returns the created row.
   */
  addCombatant: t.procedure
    .input(
      z.object({
        campaignId: campaignIdSchema,
        sessionId: z.string().optional(),
        name: z.string().min(1).max(100),
        hpMax: z.number().int().min(1).max(9999),
        ac: z.number().int().min(1).max(99).default(10),
        initiative: z.number().int().default(0),
        initiativeOrder: z.number().int().default(0),
        isPlayer: z.boolean().default(false),
      }),
    )
    .mutation(({ input }) => {
      const created = combatantsRepo.create(input)
      campaignEventsRepo.insert({
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        eventType: 'combatant_added',
        payload: JSON.stringify({ name: input.name }),
      })
      log.debug('[combat] addCombatant', { campaignId: input.campaignId, name: input.name })
      return created
    }),
})
