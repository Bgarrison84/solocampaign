/**
 * World-state tRPC router (STATE-03, STATE-04, WORLD-03).
 *
 * Read-only surface for the campaign header (time + location breadcrumb) and the
 * NpcTrackerTab Factions section. All world-state writes happen through the AI
 * mutation pipeline (updateWorldTime / updateLocation / updateFaction).
 *
 * The UI-SPEC NpcTrackerTab queries `trpc.factions.list`, so a standalone
 * `factionsRouter` is also exported here and registered as the top-level
 * `factions` key in router.ts (in addition to `worldState.factions`).
 * campaignId is Zod-validated on every procedure (V5 input validation).
 */

import { z } from 'zod'
import { t } from '../_base'
import { campaignsRepo } from '../../db/campaignsRepo'
import { factionsRepo } from '../../db/factionsRepo'
import { campaignIdSchema } from '../schemas'

const campaignInput = z.object({ campaignId: campaignIdSchema })

export const worldStateRouter = t.router({
  /**
   * Read the four world-state columns (time of day, day number, season, location
   * path JSON) for the campaign header. Returns undefined if the campaign is gone.
   */
  get: t.procedure
    .input(campaignInput)
    .query(({ input }) => campaignsRepo.getWorldState(input.campaignId)),

  /**
   * List factions for the campaign (also exposed as the top-level `factions` key).
   */
  factions: t.procedure
    .input(campaignInput)
    .query(({ input }) => factionsRepo.list(input.campaignId)),
})

/**
 * Standalone factions router so `trpc.factions.list.query({ campaignId })`
 * resolves for the NpcTrackerTab (UI-SPEC). Mirrors worldState.factions.
 */
export const factionsRouter = t.router({
  list: t.procedure
    .input(campaignInput)
    .query(({ input }) => factionsRepo.list(input.campaignId)),
})
