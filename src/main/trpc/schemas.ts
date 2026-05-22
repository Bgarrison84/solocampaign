import { z } from 'zod'

export const campaignNameSchema = z.string().trim().min(1).max(80)
export const campaignIdSchema = z.string().uuid()
