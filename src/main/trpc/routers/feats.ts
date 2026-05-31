/**
 * Feats tRPC router (CHAR-05, PROG-03, RULES-01).
 *
 * Procedures:
 *   feats.listSrd               — full SRD feats list (static, from library cache)
 *   feats.listEpicBoons         — full epic boons list (static, from library cache)
 *   feats.listByCharacter       — feats a character has acquired (from character_feats table)
 *   feats.add                   — add a feat to a character
 *   feats.remove                — remove a feat from a character
 *   feats.listCustomByCampaign  — campaign-scoped homebrew feats
 *   feats.createCustom          — create a homebrew feat for a campaign
 *   feats.deleteCustom          — delete a homebrew feat for a campaign
 *
 * Static content (SRD) is loaded via getFeats/getEpicBoons from library.ts — no
 * DB access for those queries. Character and custom feats go through their repos.
 *
 * Security (T-07-03-02):
 * - Custom feat name is capped at 100 chars (Zod max 100).
 * - Custom feat description is capped at 2000 chars (Zod max 2000).
 * - Inputs are Zod-validated at the tRPC boundary.
 */

import { z } from 'zod'
import { t } from '../_base'
import { campaignIdSchema } from '../schemas'
import { characterFeatsRepo } from '../../db/characterFeatsRepo'
import { customFeatsRepo } from '../../db/customFeatsRepo'
import { getFeats, getEpicBoons } from './library'

// ─── Router ───────────────────────────────────────────────────────────────────

export const featsRouter = t.router({
  /**
   * Return the full SRD feats list (static content, loaded once via library.ts cache).
   */
  listSrd: t.procedure.query(() => getFeats()),

  /**
   * Return the full Epic Boons list (static content, loaded once via library.ts cache).
   */
  listEpicBoons: t.procedure.query(() => getEpicBoons()),

  /**
   * List all feats a character has acquired, ordered chronologically (oldest-first).
   */
  listByCharacter: t.procedure
    .input(z.object({ characterId: z.string() }))
    .query(({ input }) => characterFeatsRepo.listByCharacter(input.characterId)),

  /**
   * Add a feat to a character.
   * featSource: 'srd' | 'custom' | 'epic_boon'.
   * customFeatId is required (non-null) when featSource is 'custom'.
   */
  add: t.procedure
    .input(
      z.object({
        characterId: z.string(),
        featName: z.string().min(1).max(200),
        featSource: z.enum(['srd', 'custom', 'epic_boon']),
        customFeatId: z.string().optional(),
      }),
    )
    .mutation(({ input }) =>
      characterFeatsRepo.add({
        characterId: input.characterId,
        featName: input.featName,
        featSource: input.featSource,
        customFeatId: input.customFeatId,
      }),
    ),

  /**
   * Remove a feat from a character. characterId guard prevents cross-character deletes.
   */
  remove: t.procedure
    .input(z.object({ featId: z.string(), characterId: z.string() }))
    .mutation(({ input }) => characterFeatsRepo.remove(input.featId, input.characterId)),

  /**
   * List campaign-scoped homebrew feats (ordered oldest-first).
   */
  listCustomByCampaign: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => customFeatsRepo.listByCampaign(input.campaignId)),

  /**
   * Create a campaign-scoped homebrew feat (CHAR-05, RULES-03).
   * Security (T-07-03-02): name ≤ 100 chars, description ≤ 2000 chars.
   */
  createCustom: t.procedure
    .input(
      z.object({
        campaignId: campaignIdSchema,
        name: z.string().min(1).max(100),
        description: z.string().max(2000),
      }),
    )
    .mutation(({ input }) =>
      customFeatsRepo.create({
        campaignId: input.campaignId,
        name: input.name,
        description: input.description,
      }),
    ),

  /**
   * Delete a campaign-scoped homebrew feat. campaignId guard prevents cross-campaign deletes.
   */
  deleteCustom: t.procedure
    .input(z.object({ id: z.string(), campaignId: campaignIdSchema }))
    .mutation(({ input }) => customFeatsRepo.delete(input.id, input.campaignId)),
})
