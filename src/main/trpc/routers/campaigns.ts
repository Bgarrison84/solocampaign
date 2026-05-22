import { z } from 'zod'
import { t } from '../_base'
import { campaignsRepo } from '../../db/campaignsRepo'
import { campaignNameSchema, campaignIdSchema } from '../schemas'

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
})
