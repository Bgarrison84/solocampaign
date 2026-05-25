import { z } from 'zod'

export const campaignNameSchema = z.string().trim().min(1).max(80)
export const campaignIdSchema = z.string().uuid()

// Character creation schemas
export const characterNameSchema = z.string().trim().min(1).max(100)
export const backstorySchema = z.string().max(2000)
export const abilityScoreSchema = z.number().int().min(1).max(30)

// Live-resource mutation schemas (delta-based)
export const hpDeltaSchema = z.number().int().min(-9999).max(9999)
export const currencyDeltaSchema = z.number().int().min(-999999).max(999999)
export const xpDeltaSchema = z.number().int().min(-999999).max(999999)

// Condition names — exactly the 14 standard D&D 5e conditions
export const conditionNameSchema = z.enum([
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
])
