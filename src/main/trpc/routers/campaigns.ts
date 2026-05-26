import { z } from 'zod'
import { t } from '../_base'
import { campaignsRepo } from '../../db/campaignsRepo'
import { campaignNameSchema, campaignIdSchema, aiConfigSchema } from '../schemas'
import { importImage, getImageDataUrl } from '../../imageService'
import { secretStorage } from '../../secrets'

export const campaignsRouter = t.router({
  list: t.procedure.query(() => {
    return campaignsRepo.list()
  }),

  create: t.procedure
    .input(z.object({ name: campaignNameSchema }))
    .mutation(({ input }) => {
      return campaignsRepo.create({ name: input.name })
    }),

  get: t.procedure
    .input(z.object({ id: campaignIdSchema }))
    .query(({ input }) => {
      return campaignsRepo.get(input.id)
    }),

  delete: t.procedure
    .input(z.object({ id: campaignIdSchema }))
    .mutation(({ input }) => {
      campaignsRepo.delete(input.id)
    }),

  /**
   * Import a cover image for a campaign.
   * Opens a native OS file dialog, resizes to max 1024px, stores relative path in DB.
   * Returns null if the user cancels the dialog (no image selected).
   * Cover-image persistence lives in campaignsRepo (campaign domain — W4 fix).
   */
  importCoverImage: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(async ({ input }) => {
      const relativePath = await importImage(input.campaignId, 'cover')
      if (relativePath === null) return null
      campaignsRepo.updateCoverImagePath(input.campaignId, relativePath)
      return relativePath
    }),

  /**
   * Get campaign cover image as a base64 data URL.
   * Returns null if no cover image is set or if the file no longer exists.
   */
  getCoverDataUrl: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(async ({ input }) => {
      const campaign = campaignsRepo.get(input.campaignId)
      if (!campaign || !campaign.coverImagePath) return null
      return await getImageDataUrl(campaign.coverImagePath)
    }),

  /**
   * Persist AI provider config for a campaign.
   *
   * Security contract (D-07, D-08, D-23):
   * - The 8 non-secret columns are persisted to SQLite via campaignsRepo.updateAiConfig.
   * - apiKey: if non-empty string → encrypt('ai-key-{campaignId}');
   *           if empty string → remove('ai-key-{campaignId}') (clears previously stored key);
   *           if undefined → leave stored key untouched.
   * - Same logic for fallbackApiKey → key 'ai-fallback-{campaignId}'.
   * - NEVER persist a key to SQLite. NEVER return a key.
   * - Key naming: 'ai-key-{campaignId}' and 'ai-fallback-{campaignId}'.
   *   Campaign UUIDs use hyphens, which are in [a-zA-Z0-9_.-] — valid for secretKeySchema.
   *   Total lengths: 7+36=43 chars (primary), 11+36=47 chars (fallback) — under 64-char max.
   */
  updateAiConfig: t.procedure
    .input(aiConfigSchema)
    .mutation(async ({ input }) => {
      const { campaignId, apiKey, fallbackApiKey, ...configFields } = input

      // Persist the 8 non-secret columns (referenceDocs serialized to JSON by campaignsRepo)
      campaignsRepo.updateAiConfig(campaignId, {
        providerType: configFields.providerType,
        endpointUrl: configFields.endpointUrl ?? null,
        modelName: configFields.modelName,
        referenceDocs: configFields.referenceDocs,
        dmPersonality: configFields.dmPersonality ?? null,
        strictness: configFields.strictness,
        fallbackEndpointUrl: configFields.fallbackEndpointUrl ?? null,
        fallbackModelName: configFields.fallbackModelName ?? null,
      })

      // Handle primary API key — key = 'ai-key-{campaignId}' (D-08)
      if (apiKey !== undefined) {
        if (apiKey.length > 0) {
          await secretStorage.encrypt('ai-key-' + campaignId, apiKey)
        } else {
          await secretStorage.remove('ai-key-' + campaignId)
        }
      }
      // If apiKey is undefined, leave the stored key untouched

      // Handle fallback API key — key = 'ai-fallback-{campaignId}' (D-08)
      if (fallbackApiKey !== undefined) {
        if (fallbackApiKey.length > 0) {
          await secretStorage.encrypt('ai-fallback-' + campaignId, fallbackApiKey)
        } else {
          await secretStorage.remove('ai-fallback-' + campaignId)
        }
      }
      // If fallbackApiKey is undefined, leave the stored key untouched

      // Return the updated campaign row (contains no key columns — D-23)
      return campaignsRepo.get(campaignId)
    }),
})
