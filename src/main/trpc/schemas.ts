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

// AI config schema — persists provider configuration + stores keys via SecretStorageService (D-07, D-08, D-23)
// apiKey and fallbackApiKey are validated here but NEVER persisted to SQLite — they go to safeStorage only.
export const aiConfigSchema = z.object({
  campaignId: z.string().uuid(),
  providerType: z.enum(['openai-compatible', 'gemini']),
  endpointUrl: z.string().url().optional(),
  modelName: z.string().min(1),
  apiKey: z.string().optional(), // validated + stored via SecretStorageService, not in DB
  dmPersonality: z.string().max(2000).optional(),
  strictness: z.enum(['strict', 'balanced', 'narrative']).default('balanced'),
  referenceDocs: z.array(z.string()).default([]),
  fallbackEndpointUrl: z.string().url().optional(),
  fallbackModelName: z.string().optional(),
  fallbackApiKey: z.string().optional(),
})

// IPC message schema — validated at the ipcMain.handle('ai:send-message') boundary (T-03-03-03)
export const sendMessageSchema = z.object({
  campaignId: z.string().uuid(),
  content: z.string().min(1).max(10000),
})

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
