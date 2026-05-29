/**
 * Phase 5 AI tool-call schema (D-01, D-04, D-08).
 *
 * Defines all 12 Phase 5 tools with bounded Zod schemas. Each tool is registered
 * via the AI SDK `tool()` helper with a natural-language `description` and an
 * `inputSchema` — and CRITICALLY no `execute` property (D-04, Pitfall 1): mutations
 * are batch-applied in the `onFinish` callback by mutationPipeline.ts, never during
 * the stream. Adding `execute` would cause double-application.
 *
 * Security (T-5-01 / T-05-02-01 tampering mitigation):
 *   Every numeric field is bounded (`.int().min().max()`) so AI-generated tool
 *   args cannot poison the DB with negative HP_max, infinite XP, etc. The same
 *   schemas are re-used by mutationPipeline.ts `safeParse()` before any DB write.
 *
 * Note on AI SDK v6: the `tool()` helper field is `inputSchema` (renamed from the
 * v4 `parameters`). The bare Zod schemas are exported separately so the mutation
 * pipeline can `safeParse` raw tool-call args.
 */

import { tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'

// ─── Zod Schemas (bounded — T-5-01) ──────────────────────────────────────────

/** updateHp: negative delta = damage, positive = heal. Targets a player (characterId) or a combatant (combatantId). */
export const updateHpSchema = z.object({
  characterId: z.string().optional(),
  combatantId: z.string().optional(),
  delta: z.number().int(),
  source: z.string().max(100).optional(),
})

/** applyCondition: add a status effect to a player or combatant. */
export const applyConditionSchema = z.object({
  characterId: z.string().optional(),
  combatantId: z.string().optional(),
  condition: z.string().max(50),
})

/** removeCondition: clear a status effect from a player or combatant. */
export const removeConditionSchema = z.object({
  characterId: z.string().optional(),
  combatantId: z.string().optional(),
  condition: z.string().max(50),
})

/** deductSpellSlot: spend one or more spell slots at a given level (D-40 supports Warlock pact slots). */
export const deductSpellSlotSchema = z.object({
  characterId: z.string(),
  slotLevel: z.number().int().min(1).max(9),
  count: z.number().int().min(1).max(4).default(1),
  slotType: z.enum(['normal', 'pact']).default('normal'),
})

/** restoreSpellSlots: restore a partial map of slot levels (e.g. {"1":2,"3":1}). */
export const restoreSpellSlotsSchema = z.object({
  characterId: z.string(),
  slots: z.record(z.string(), z.number().int().min(0)),
  slotType: z.enum(['normal', 'pact']).default('normal'),
})

/** awardXp: grant XP to the campaign's character after an encounter. */
export const awardXpSchema = z.object({
  campaignId: z.string(),
  amount: z.number().int().min(0).max(1000000),
})

/** updateCurrency: per-denomination deltas (Pitfall 7 — positive = gain, negative = spend). */
export const updateCurrencySchema = z.object({
  campaignId: z.string(),
  cp: z.number().int().default(0),
  sp: z.number().int().default(0),
  ep: z.number().int().default(0),
  gp: z.number().int().default(0),
  pp: z.number().int().default(0),
})

/** addCombatant: add an enemy/NPC to the initiative tracker (D-10). */
export const addCombatantSchema = z.object({
  campaignId: z.string(),
  sessionId: z.string().optional(),
  name: z.string().max(100),
  hpMax: z.number().int().min(1).max(9999),
  ac: z.number().int().min(1).max(99).default(10),
  initiative: z.number().int().default(0),
  initiativeOrder: z.number().int().default(0),
  isPlayer: z.boolean().default(false),
})

/** removeCombatant: remove a single combatant from the tracker. */
export const removeCombatantSchema = z.object({
  combatantId: z.string(),
})

/** endCombat: end the encounter — deactivates all active combatants for the campaign (D-14). */
export const endCombatSchema = z.object({
  campaignId: z.string(),
})

/** processRest: grant a short or long rest's resource recovery (D-35, D-36). */
export const processRestSchema = z.object({
  type: z.enum(['short', 'long']),
})

/** showDiceRoll: display-only — surfaces an AI dice roll as a chat chip (D-22). No mutation. */
export const showDiceRollSchema = z.object({
  label: z.string().max(100),
  expression: z.string().max(50),
  result: z.number().int(),
  breakdown: z.array(z.number()).max(20),
})

// ─── tool() Registrations (NO execute — D-04, Pitfall 1) ──────────────────────

export const updateHpTool = tool({
  description:
    'Apply an HP change to a player character or combatant. Use a negative delta for damage, positive for healing.',
  inputSchema: updateHpSchema,
})

export const applyConditionTool = tool({
  description:
    'Apply a status effect (Poisoned, Stunned, Blinded, Prone, etc.) to a player character or combatant.',
  inputSchema: applyConditionSchema,
})

export const removeConditionTool = tool({
  description:
    'Remove a status effect from a player character or combatant when it ends.',
  inputSchema: removeConditionSchema,
})

export const deductSpellSlotTool = tool({
  description:
    'Deduct one or more spell slots when the player casts a leveled spell. Use slotType "pact" for Warlock pact magic.',
  inputSchema: deductSpellSlotSchema,
})

export const restoreSpellSlotsTool = tool({
  description:
    'Restore spent spell slots, e.g. from a feature or item. Pass a map of slot levels to the number of slots to restore.',
  inputSchema: restoreSpellSlotsSchema,
})

export const awardXpTool = tool({
  description:
    'Award experience points after an encounter. A typical encounter is 50-500 XP depending on difficulty.',
  inputSchema: awardXpSchema,
})

export const updateCurrencyTool = tool({
  description:
    'Update the party currency when they find loot or spend money. Values are per-denomination deltas (positive = gain, negative = spend).',
  inputSchema: updateCurrencySchema,
})

export const addCombatantTool = tool({
  description:
    'Add an enemy or NPC to the initiative tracker at the start of combat. Include HP, AC, and initiative order.',
  inputSchema: addCombatantSchema,
})

export const removeCombatantTool = tool({
  description: 'Remove a combatant from the initiative tracker.',
  inputSchema: removeCombatantSchema,
})

export const endCombatTool = tool({
  description: 'End the current encounter when all enemies are defeated or combat is over.',
  inputSchema: endCombatSchema,
})

export const processRestTool = tool({
  description:
    "Grant the player's rest request when narratively appropriate. Use 'short' or 'long'.",
  inputSchema: processRestSchema,
})

export const showDiceRollTool = tool({
  description:
    'Show a dice roll in the chat (attack, saving throw, skill check). Always call this for every roll you make so the player can see it.',
  inputSchema: showDiceRollSchema,
})

/**
 * The full Phase 5 tool set passed to streamText({ tools }).
 * Exactly 12 tools, none with an execute property (D-04).
 */
export const PHASE5_TOOLS = {
  updateHp: updateHpTool,
  applyCondition: applyConditionTool,
  removeCondition: removeConditionTool,
  deductSpellSlot: deductSpellSlotTool,
  restoreSpellSlots: restoreSpellSlotsTool,
  awardXp: awardXpTool,
  updateCurrency: updateCurrencyTool,
  addCombatant: addCombatantTool,
  removeCombatant: removeCombatantTool,
  endCombat: endCombatTool,
  processRest: processRestTool,
  showDiceRoll: showDiceRollTool,
} as const satisfies ToolSet
