import { z } from 'zod'
import { t } from '../_base'
import { campaignsRepo } from '../../db/campaignsRepo'
import { campaignNameSchema, campaignIdSchema } from '../schemas'
import { importImage, getImageDataUrl } from '../../imageService'

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
})
