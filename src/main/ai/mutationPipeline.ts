/**
 * Phase 5 mutation pipeline (D-02, D-04, D-05, D-06).
 *
 * Turns AI-generated tool calls (or the JSON-tail fallback block) into bounded,
 * validated DB writes. Every tool call is `safeParse`d against its Zod schema
 * before any mutation (T-05-02-01 tampering mitigation). The whole batch runs in
 * a single `db.transaction()` (D-04); a single failing call is logged and skipped
 * so the rest still apply (D-06 silent-failure isolation). Every applied mutation
 * appends a `campaign_events` row (D-05).
 *
 * The return surfaces what the renderer should display: toast chips (one per
 * mutation) and dice-roll chip data (so index.ts can persist dice_roll messages).
 */

import { eq } from 'drizzle-orm'
import log from 'electron-log'
import { getDb } from '../db/index'
import { characterResources } from '../db/schema'
import { charactersRepo } from '../db/charactersRepo'
import { combatantsRepo } from '../db/combatantsRepo'
import { campaignEventsRepo } from '../db/campaignEventsRepo'
import type { SpellSlotMap } from '../db/contentTypes'
import {
  updateHpSchema,
  applyConditionSchema,
  removeConditionSchema,
  deductSpellSlotSchema,
  restoreSpellSlotsSchema,
  awardXpSchema,
  updateCurrencySchema,
  addCombatantSchema,
  removeCombatantSchema,
  endCombatSchema,
  processRestSchema,
  showDiceRollSchema,
} from './toolSchemas'

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface MutationChip {
  id: string
  label: string
  type: 'hp' | 'xp' | 'condition' | 'slot' | 'currency' | 'combat' | 'rest'
}

export interface ShowDiceRollData {
  label: string
  expression: string
  result: number
  breakdown: number[]
}

export interface MutationToolCall {
  toolName: string
  args: unknown
}

interface Accumulators {
  chips: MutationChip[]
  diceRolls: ShowDiceRollData[]
}

// ─── JSON-tail Fallback Parser (D-02, Pitfall 3) ──────────────────────────────

/**
 * Matches a fenced ```json block ONLY when it sits at the very end of the string.
 * The `$` anchor (with optional trailing whitespace) is what keeps mid-text code
 * blocks from being treated as a mutation tail (Pitfall 3).
 */
export const JSON_TAIL_REGEX = /\n*```json\n([\s\S]+?)\n```\s*$/

export function stripAndParseJsonTail(text: string): {
  cleanText: string
  mutations: MutationToolCall[] | null
} {
  const match = text.match(JSON_TAIL_REGEX)
  if (!match) return { cleanText: text, mutations: null }

  const cleanText = text.slice(0, text.length - match[0].length).trimEnd()
  try {
    const parsed = JSON.parse(match[1]) as { mutations?: unknown }
    const mutations = Array.isArray(parsed.mutations)
      ? (parsed.mutations as MutationToolCall[])
      : null
    return { cleanText, mutations }
  } catch {
    // Malformed JSON — treat as if there were no tail (text unchanged, no mutations).
    return { cleanText: text, mutations: null }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chipId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function logEvent(
  campaignId: string,
  sessionId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): void {
  campaignEventsRepo.insert({
    campaignId,
    sessionId,
    eventType,
    payload: JSON.stringify(payload),
  })
}

/**
 * Resolve the player characterId for a campaign when a tool targets the player
 * without an explicit characterId. Returns undefined if no character exists.
 */
function resolvePlayerCharacterId(campaignId: string): string | undefined {
  return charactersRepo.getByCampaignId(campaignId)?.id
}

// ─── Per-tool Dispatch ──────────────────────────────────────────────────────

function applyOneTool(
  toolName: string,
  args: unknown,
  campaignId: string,
  sessionId: string | null,
  acc: Accumulators,
): void {
  switch (toolName) {
    case 'updateHp': {
      const r = updateHpSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid updateHp args')
        return
      }
      const { characterId, combatantId, delta, source } = r.data
      if (combatantId) {
        // Clamp 0..hpMax for the targeted combatant.
        const combatant = combatantsRepo
          .listActive(campaignId)
          .find((c) => c.id === combatantId)
        if (!combatant) return
        const next = Math.max(0, Math.min(combatant.hpMax, combatant.hpCurrent + delta))
        combatantsRepo.updateHp(combatantId, next)
      } else {
        const charId = characterId ?? resolvePlayerCharacterId(campaignId)
        if (!charId) return
        charactersRepo.updateHp(charId, delta)
      }
      acc.chips.push({
        id: chipId(),
        label: delta < 0 ? `${delta} HP` : `+${delta} HP`,
        type: 'hp',
      })
      logEvent(campaignId, sessionId, 'hp_change', { characterId, combatantId, delta, source })
      return
    }

    case 'applyCondition':
    case 'removeCondition': {
      const schema = toolName === 'applyCondition' ? applyConditionSchema : removeConditionSchema
      const r = schema.safeParse(args)
      if (!r.success) {
        log.warn(`[mutationPipeline] invalid ${toolName} args`)
        return
      }
      const { characterId, combatantId, condition } = r.data
      const adding = toolName === 'applyCondition'
      if (combatantId) {
        const combatant = combatantsRepo
          .listActive(campaignId)
          .find((c) => c.id === combatantId)
        if (!combatant) return
        const conditions = JSON.parse(combatant.conditions) as string[]
        const idx = conditions.indexOf(condition)
        if (adding && idx < 0) conditions.push(condition)
        if (!adding && idx >= 0) conditions.splice(idx, 1)
        combatantsRepo.updateConditions(combatantId, JSON.stringify(conditions))
      } else {
        const charId = characterId ?? resolvePlayerCharacterId(campaignId)
        if (!charId) return
        // toggleCondition flips presence — guard so we only add/remove as intended.
        const current = charactersRepo.getWithResources(charId)?.resources.conditions ?? []
        const present = current.includes(condition)
        if ((adding && !present) || (!adding && present)) {
          charactersRepo.toggleCondition(charId, condition)
        }
      }
      acc.chips.push({ id: chipId(), label: `${adding ? '+' : '-'} ${condition}`, type: 'condition' })
      logEvent(campaignId, sessionId, adding ? 'condition_applied' : 'condition_removed', {
        characterId,
        combatantId,
        condition,
      })
      return
    }

    case 'deductSpellSlot': {
      const r = deductSpellSlotSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid deductSpellSlot args')
        return
      }
      const { characterId, slotLevel, count, slotType } = r.data
      if (slotType === 'pact') {
        adjustPactSlots(characterId, { [String(slotLevel)]: count })
      } else {
        charactersRepo.updateSpellSlot(characterId, String(slotLevel), count)
      }
      acc.chips.push({ id: chipId(), label: `Spell slot used (L${slotLevel})`, type: 'slot' })
      logEvent(campaignId, sessionId, 'spell_slot_deducted', { characterId, slotLevel, count, slotType })
      return
    }

    case 'restoreSpellSlots': {
      const r = restoreSpellSlotsSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid restoreSpellSlots args')
        return
      }
      const { characterId, slots, slotType } = r.data
      if (slotType === 'pact') {
        const negated: Record<string, number> = {}
        for (const [level, n] of Object.entries(slots)) negated[level] = -n
        adjustPactSlots(characterId, negated)
      } else {
        for (const [level, n] of Object.entries(slots)) {
          charactersRepo.updateSpellSlot(characterId, level, -n)
        }
      }
      acc.chips.push({ id: chipId(), label: 'Spell slots restored', type: 'slot' })
      logEvent(campaignId, sessionId, 'spell_slot_restored', { characterId, slots, slotType })
      return
    }

    case 'awardXp': {
      const r = awardXpSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid awardXp args')
        return
      }
      const charId = resolvePlayerCharacterId(r.data.campaignId)
      if (!charId) return
      charactersRepo.updateXp(charId, r.data.amount)
      acc.chips.push({ id: chipId(), label: `+${r.data.amount} XP`, type: 'xp' })
      logEvent(campaignId, sessionId, 'xp_awarded', { amount: r.data.amount })
      return
    }

    case 'updateCurrency': {
      const r = updateCurrencySchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid updateCurrency args')
        return
      }
      const charId = resolvePlayerCharacterId(r.data.campaignId)
      if (!charId) return
      const denoms = ['cp', 'sp', 'ep', 'gp', 'pp'] as const
      for (const denom of denoms) {
        const delta = r.data[denom]
        if (delta !== 0) {
          charactersRepo.updateCurrency(charId, denom, delta)
          acc.chips.push({
            id: chipId(),
            label: `${delta > 0 ? '+' : ''}${delta} ${denom.toUpperCase()}`,
            type: 'currency',
          })
        }
      }
      logEvent(campaignId, sessionId, 'currency_changed', {
        cp: r.data.cp,
        sp: r.data.sp,
        ep: r.data.ep,
        gp: r.data.gp,
        pp: r.data.pp,
      })
      return
    }

    case 'addCombatant': {
      const r = addCombatantSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid addCombatant args')
        return
      }
      const c = r.data
      combatantsRepo.create({
        campaignId: c.campaignId,
        sessionId: c.sessionId ?? sessionId,
        name: c.name,
        hpMax: c.hpMax,
        ac: c.ac,
        initiative: c.initiative,
        initiativeOrder: c.initiativeOrder,
        isPlayer: c.isPlayer,
      })
      acc.chips.push({ id: chipId(), label: `${c.name} added to combat`, type: 'combat' })
      logEvent(campaignId, sessionId, 'combatant_added', { name: c.name, hpMax: c.hpMax, ac: c.ac })
      return
    }

    case 'removeCombatant': {
      const r = removeCombatantSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid removeCombatant args')
        return
      }
      combatantsRepo.remove(r.data.combatantId)
      acc.chips.push({ id: chipId(), label: 'Combatant removed', type: 'combat' })
      logEvent(campaignId, sessionId, 'combatant_removed', { combatantId: r.data.combatantId })
      return
    }

    case 'endCombat': {
      const r = endCombatSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid endCombat args')
        return
      }
      combatantsRepo.endCombat(r.data.campaignId)
      acc.chips.push({ id: chipId(), label: 'Combat ended', type: 'combat' })
      logEvent(campaignId, sessionId, 'combat_ended', {})
      return
    }

    case 'processRest': {
      const r = processRestSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid processRest args')
        return
      }
      const charId = resolvePlayerCharacterId(campaignId)
      if (!charId) return
      const summary = applyRest(r.data.type, charId)
      acc.chips.push({
        id: chipId(),
        label: r.data.type === 'long' ? 'Long rest taken' : 'Short rest taken',
        type: 'rest',
      })
      logEvent(campaignId, sessionId, 'rest_taken', {
        type: r.data.type,
        hpRecovered: summary.hpRecovered,
        slotsRestored: summary.slotsRestored,
        hitDiceSpent: summary.hitDiceSpent,
      })
      return
    }

    case 'showDiceRoll': {
      const r = showDiceRollSchema.safeParse(args)
      if (!r.success) {
        log.warn('[mutationPipeline] invalid showDiceRoll args')
        return
      }
      // Display-only — no mutation. Surface to renderer + log the roll.
      acc.diceRolls.push({
        label: r.data.label,
        expression: r.data.expression,
        result: r.data.result,
        breakdown: r.data.breakdown,
      })
      logEvent(campaignId, sessionId, 'dice_roll', {
        label: r.data.label,
        expression: r.data.expression,
        result: r.data.result,
        breakdown: r.data.breakdown,
      })
      return
    }

    default:
      log.warn('[mutationPipeline] unknown tool', toolName)
  }
}

// ─── Pact-slot helper (D-40) ──────────────────────────────────────────────────

/**
 * Adjust the warlock pactSlots JSON map by a per-level delta (positive = used more).
 * Used count is clamped to [0, max].
 */
function adjustPactSlots(characterId: string, deltaByLevel: Record<string, number>): void {
  const db = getDb()
  const row = db
    .select({ pactSlots: characterResources.pactSlots })
    .from(characterResources)
    .where(eq(characterResources.characterId, characterId))
    .get()
  if (!row) return
  const slots = JSON.parse(row.pactSlots) as SpellSlotMap
  for (const [level, delta] of Object.entries(deltaByLevel)) {
    const slot = slots[level]
    if (!slot) continue
    slots[level] = { ...slot, used: Math.max(0, Math.min(slot.max, slot.used + delta)) }
  }
  db.update(characterResources)
    .set({ pactSlots: JSON.stringify(slots) })
    .where(eq(characterResources.characterId, characterId))
    .run()
}

// ─── Rest recovery (D-36, D-37, D-40) ─────────────────────────────────────────

interface RestSummary {
  hpRecovered: number
  slotsRestored: number
  hitDiceSpent: number
}

/**
 * LONG rest: HP to max, all spell slots used=0, pact slots used=0,
 *   hitDiceCurrent restored up to total by floor(total/2) (min 1), death saves cleared.
 * SHORT rest: pact slots used=0 (Warlock D-40), death saves cleared (D-37).
 *   Hit-dice HP recovery is applied by the renderer ShortRestHitDiceModal (05-06),
 *   so processRest short does not touch HP or hitDiceCurrent.
 */
function applyRest(type: 'short' | 'long', characterId: string): RestSummary {
  const db = getDb()
  const row = db
    .select()
    .from(characterResources)
    .where(eq(characterResources.characterId, characterId))
    .get()
  if (!row) return { hpRecovered: 0, slotsRestored: 0, hitDiceSpent: 0 }

  const pact = resetAllSlots(JSON.parse(row.pactSlots) as SpellSlotMap)

  if (type === 'short') {
    db.update(characterResources)
      .set({
        pactSlots: JSON.stringify(pact.slots),
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        updatedAt: new Date(Date.now()),
      })
      .where(eq(characterResources.characterId, characterId))
      .run()
    return { hpRecovered: 0, slotsRestored: pact.restored, hitDiceSpent: 0 }
  }

  // LONG rest
  const normal = resetAllSlots(JSON.parse(row.spellSlots) as SpellSlotMap)
  const hpRecovered = row.hpMax - row.hpCurrent

  let nextHitDice = row.hitDiceCurrent
  if (row.hitDiceTotal != null && row.hitDiceCurrent != null) {
    const regain = Math.max(1, Math.floor(row.hitDiceTotal / 2))
    nextHitDice = Math.min(row.hitDiceTotal, row.hitDiceCurrent + regain)
  }

  db.update(characterResources)
    .set({
      hpCurrent: row.hpMax,
      spellSlots: JSON.stringify(normal.slots),
      pactSlots: JSON.stringify(pact.slots),
      hitDiceCurrent: nextHitDice,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      updatedAt: new Date(Date.now()),
    })
    .where(eq(characterResources.characterId, characterId))
    .run()

  return {
    hpRecovered,
    slotsRestored: normal.restored + pact.restored,
    hitDiceSpent: 0,
  }
}

/** Set every slot's used count to 0, returning the new map and how many slots were freed. */
function resetAllSlots(slots: SpellSlotMap): { slots: SpellSlotMap; restored: number } {
  let restored = 0
  const next: SpellSlotMap = {}
  for (const [level, slot] of Object.entries(slots)) {
    restored += slot.used
    next[level] = { ...slot, used: 0 }
  }
  return { slots: next, restored }
}

// ─── Batch entry point (D-04, D-06) ───────────────────────────────────────────

/**
 * Apply a batch of tool calls inside a single DB transaction.
 * A single failing call is logged and skipped (D-06); the others still apply.
 * Returns the chips + dice-roll data the renderer should display.
 */
export async function applyMutationBatch(
  toolCalls: MutationToolCall[],
  campaignId: string,
  sessionId: string | null,
): Promise<{ chips: MutationChip[]; diceRolls: ShowDiceRollData[] }> {
  const acc: Accumulators = { chips: [], diceRolls: [] }
  const db = getDb()

  db.transaction(() => {
    for (const call of toolCalls) {
      try {
        applyOneTool(call.toolName, call.args, campaignId, sessionId, acc)
      } catch (err) {
        // D-06: silent — log and continue so one bad call doesn't abort the batch.
        log.error(
          '[mutationPipeline] tool call failed:',
          call.toolName,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  })

  return { chips: acc.chips, diceRolls: acc.diceRolls }
}
