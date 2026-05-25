/**
 * Pure D&D 5e calculation functions.
 * No electron, no DB imports — these are safe to test without any mocking.
 */

import type { SpellSlotsByClass } from '../db/contentTypes'

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
