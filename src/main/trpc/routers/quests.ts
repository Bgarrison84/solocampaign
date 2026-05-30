/**
 * Quests tRPC router (STATE-01).
 *
 * Read-only surface for the renderer QuestsTab. Quest writes happen exclusively
 * through the AI mutation pipeline (addQuest / updateQuestStatus) — the player
 * never mutates quests (D-04). campaignId is Zod-validated (V5 input validation).
 */

import { z } from 'zod'
import { t } from '../_base'
import { questsRepo } from '../../db/questsRepo'
import { campaignIdSchema } from '../schemas'

export const questsRouter = t.router({
  /**
   * List all quests for a campaign in chronological (oldest-first) order (D-02).
   */
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => questsRepo.list(input.campaignId)),
})
