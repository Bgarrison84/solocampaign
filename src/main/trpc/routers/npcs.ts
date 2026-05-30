/**
 * NPCs tRPC router (STATE-02).
 *
 * Read-only surface for the renderer NpcTrackerTab. NPC writes happen exclusively
 * through the AI mutation pipeline (addNpc / updateNpc) — the player never mutates
 * NPCs (D-09). campaignId is Zod-validated (V5 input validation).
 */

import { z } from 'zod'
import { t } from '../_base'
import { npcsRepo } from '../../db/npcsRepo'
import { campaignIdSchema } from '../schemas'

export const npcsRouter = t.router({
  /**
   * List all NPCs for a campaign in chronological (encounter) order (D-06).
   */
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => npcsRepo.list(input.campaignId)),
})
