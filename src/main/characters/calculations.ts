/**
 * Pure D&D 5e calculation functions.
 * No electron, no DB imports — these are safe to test without any mocking.
 */

import type { SpellSlotsByClass } from '../db/contentTypes'

// ─── Phase 7: Type definitions ───────────────────────────────────────────────

/**
 * A single class entry in a multiclass character's `classes` JSON array.
 */
export interface ClassEntry {
  className: string
  level: number
  subclass?: string
}

// ─── Phase 7: Point Buy constants & functions ─────────────────────────────────

/**
 * RAW D&D 5e point buy cost table (verified from 5thsrd.org).
 * Scores below 8 or above 15 are not purchasable via point buy RAW.
 */
export const POINT_BUY_COST_TABLE: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

/**
 * Calculate the total point-buy cost for a set of ability scores.
 * Scores not in the table (< 8 or > 15) contribute 0.
 */
export function calcPointBuyCost(scores: Record<string, number>): number {
  return Object.values(scores).reduce(
    (sum, score) => sum + (POINT_BUY_COST_TABLE[score] ?? 0),
    0,
  )
}

/**
 * Calculate the total point-buy budget given selected flaws.
 * Base budget: 27 pts.
 * Preset flaws: add their point values.
 * Free-form flaws: each non-empty entry adds +2 pts, capped at 2 entries.
 */
export function calcPointBuyBudget(
  presetFlawPoints: number[],
  freeFormFlaws: string[],
): number {
  const presetPts = presetFlawPoints.reduce((sum, pts) => sum + pts, 0)
  const nonEmptyFreeForm = freeFormFlaws.filter((f) => f.trim().length > 0).length
  const freeFormPts = Math.min(nonEmptyFreeForm, 2) * 2
  return 27 + presetPts + freeFormPts
}

// ─── Phase 7: Multiclass spell slot constants & functions ─────────────────────

/**
 * Full caster classes: contribute their full level to multiclass caster level.
 */
const FULL_CASTERS = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard']

/**
 * Half caster classes: contribute floor(level/2) to multiclass caster level.
 */
const HALF_CASTERS = ['paladin', 'ranger']

/**
 * Check if a class entry qualifies as a third-caster (Eldritch Knight / Arcane Trickster).
 * These are subclass-gated: Fighter + Eldritch Knight, or Rogue + Arcane Trickster.
 */
function isThirdCaster(entry: ClassEntry): boolean {
  const cls = entry.className.toLowerCase()
  const sub = (entry.subclass ?? '').toLowerCase()
  if (cls === 'fighter' && sub.includes('eldritch knight')) return true
  if (cls === 'rogue' && sub.includes('arcane trickster')) return true
  return false
}

/**
 * Complete multiclass spell slot table (verified from 5thsrd.org/rules/multiclassing).
 * Key: combined caster level → { slotLevel: maxSlots }
 *
 * Levels 11–12, 13–14, 15–16, 19–20 share the same row; we store each level explicitly.
 */
export const MULTICLASS_SPELL_SLOTS: Record<number, Record<number, number>> = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  4:  { 1: 4, 2: 3 },
  5:  { 1: 4, 2: 3, 3: 2 },
  6:  { 1: 4, 2: 3, 3: 3 },
  7:  { 1: 4, 2: 3, 3: 3, 4: 1 },
  8:  { 1: 4, 2: 3, 3: 3, 4: 2 },
  9:  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
}

/**
 * Calculate the combined multiclass caster level from a character's class array.
 *
 * Rules (PHB Multiclassing — 5thsrd.org):
 * - Full casters (Bard, Cleric, Druid, Sorcerer, Wizard): add full class level
 * - Half casters (Paladin, Ranger): add floor(level / 2)
 * - Third casters (Fighter/Eldritch Knight, Rogue/Arcane Trickster): add floor(level / 3)
 * - Warlock: excluded — uses Pact Magic separately; contributes 0
 * - Non-casters (Barbarian, Fighter base, Monk, Rogue base): contribute 0
 */
export function calcMulticlassCasterLevel(classes: ClassEntry[]): number {
  return classes.reduce((total, entry) => {
    const cls = entry.className.toLowerCase()
    if (FULL_CASTERS.includes(cls)) {
      return total + entry.level
    }
    if (HALF_CASTERS.includes(cls)) {
      return total + Math.floor(entry.level / 2)
    }
    if (isThirdCaster(entry)) {
      return total + Math.floor(entry.level / 3)
    }
    // Warlock and non-casters contribute 0
    return total
  }, 0)
}

/**
 * Compute the multiclass spell slot map for a character's class array.
 * Returns {} if the combined caster level is 0 (no multiclass slots).
 */
export function calcMulticlassSpellSlots(classes: ClassEntry[]): Record<number, number> {
  const casterLevel = calcMulticlassCasterLevel(classes)
  if (casterLevel === 0) return {}
  // Clamp to the table's max (level 20)
  const tableLevel = Math.min(casterLevel, 20)
  return MULTICLASS_SPELL_SLOTS[tableLevel] ?? {}
}

// ─── Phase 7: Proficiency bonus extension past level 20 ──────────────────────

/**
 * Proficiency bonus for a given level.
 * Formula: Math.ceil(level / 4) + 1
 * Verified: PHB table levels 1–20; extends naturally to 21+ per community consensus.
 *   Level 1–4 = +2, 5–8 = +3, 9–12 = +4, 13–16 = +5, 17–20 = +6, 21–24 = +7, etc.
 */
export function proficiencyBonusForLevel(level: number): number {
  return Math.ceil(level / 4) + 1
}

/**
 * Compute the ability modifier for a given score.
 * Formula: floor((score - 10) / 2)
 */
export function calcAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * Compute max HP at level 1.
 * HP = class hit die + CON modifier
 */
export function calcHP(hitDie: number, constitutionScore: number): number {
  return hitDie + calcAbilityModifier(constitutionScore)
}

/**
 * Compute Armor Class.
 * Unarmored: 10 + DEX modifier
 * Armored: armorBase + DEX modifier
 */
export function calcAC(dexterityScore: number, armorBase?: number): number {
  if (armorBase !== undefined) {
    return armorBase + calcAbilityModifier(dexterityScore)
  }
  return 10 + calcAbilityModifier(dexterityScore)
}

/**
 * Compute initiative bonus (equals DEX modifier).
 */
export function calcInitiativeBonus(dexterityScore: number): number {
  return calcAbilityModifier(dexterityScore)
}

/**
 * Build a spell slot map for the given class and level.
 * Returns { slotLevel: { used: 0, max: N } } for each slot level the class has at that level.
 * Returns {} if the class is not a spellcaster or the level is not in the table.
 */
export function buildSpellSlots(
  className: string,
  level: number,
  spellSlotsByClass: SpellSlotsByClass,
): Record<string, { used: number; max: number }> {
  const table = spellSlotsByClass[className]?.[level]
  if (!table) return {}
  return Object.fromEntries(
    Object.entries(table).map(([slotLevel, max]) => [slotLevel, { used: 0, max }]),
  )
}
