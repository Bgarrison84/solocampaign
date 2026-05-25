import { describe, it, expect } from 'vitest'
import {
  calcAbilityModifier,
  calcHP,
  calcAC,
  calcInitiativeBonus,
  buildSpellSlots,
} from './calculations'
import type { SpellSlotsByClass } from '../db/contentTypes'

describe('calcAbilityModifier', () => {
  it('returns 0 for score 10 (base)', () => {
    expect(calcAbilityModifier(10)).toBe(0)
  })

  it('returns 0 for score 11 (rounds down to 0)', () => {
    expect(calcAbilityModifier(11)).toBe(0)
  })

  it('returns +3 for score 16', () => {
    expect(calcAbilityModifier(16)).toBe(3)
  })

  it('returns -1 for score 8', () => {
    expect(calcAbilityModifier(8)).toBe(-1)
  })

  it('returns +5 for score 20', () => {
    expect(calcAbilityModifier(20)).toBe(5)
  })

  it('returns -5 for score 1 (minimum ability score)', () => {
    expect(calcAbilityModifier(1)).toBe(-5)
  })

  it('returns -2 for score 6', () => {
    expect(calcAbilityModifier(6)).toBe(-2)
  })
})

describe('calcHP', () => {
  it('returns hit die + CON modifier for standard Fighter (d10, CON 16)', () => {
    expect(calcHP(10, 16)).toBe(13) // 10 + 3
  })

  it('returns hit die + CON modifier for Wizard (d6, CON 10)', () => {
    expect(calcHP(6, 10)).toBe(6) // 6 + 0
  })

  it('returns hit die + CON modifier for Barbarian (d12, CON 14)', () => {
    expect(calcHP(12, 14)).toBe(14) // 12 + 2
  })

  it('correctly applies negative CON modifier', () => {
    expect(calcHP(8, 8)).toBe(7) // 8 + (-1)
  })
})

describe('calcAC', () => {
  it('returns 10 + DEX modifier for unarmored (DEX 14 = +2)', () => {
    expect(calcAC(14)).toBe(12) // 10 + 2
  })

  it('returns armorBase + DEX modifier when armorBase provided (DEX 14, base 13)', () => {
    expect(calcAC(14, 13)).toBe(15) // 13 + 2
  })

  it('returns 10 for unarmored with DEX 10', () => {
    expect(calcAC(10)).toBe(10) // 10 + 0
  })

  it('applies negative DEX modifier for unarmored', () => {
    expect(calcAC(8)).toBe(9) // 10 + (-1)
  })

  it('returns chain mail AC (base 16) with DEX 10', () => {
    expect(calcAC(10, 16)).toBe(16) // 16 + 0
  })
})

describe('calcInitiativeBonus', () => {
  it('equals DEX modifier (DEX 14 = +2)', () => {
    expect(calcInitiativeBonus(14)).toBe(2)
  })

  it('equals DEX modifier (DEX 10 = 0)', () => {
    expect(calcInitiativeBonus(10)).toBe(0)
  })

  it('equals DEX modifier (DEX 8 = -1)', () => {
    expect(calcInitiativeBonus(8)).toBe(-1)
  })
})

describe('buildSpellSlots', () => {
  const spellSlotsByClass: SpellSlotsByClass = {
    cleric: {
      1: { '1': 2 },
      2: { '1': 3 },
      3: { '1': 4, '2': 2 },
    },
    wizard: {
      1: { '1': 2 },
      2: { '1': 3 },
    },
    fighter: {}, // non-spellcaster (no levels defined)
  }

  it('returns correct spell slots for Cleric level 1', () => {
    const result = buildSpellSlots('cleric', 1, spellSlotsByClass)
    expect(result).toEqual({ '1': { used: 0, max: 2 } })
  })

  it('returns multiple slot levels for Cleric level 3', () => {
    const result = buildSpellSlots('cleric', 3, spellSlotsByClass)
    expect(result).toEqual({
      '1': { used: 0, max: 4 },
      '2': { used: 0, max: 2 },
    })
  })

  it('returns {} for a non-spellcasting class (fighter)', () => {
    const result = buildSpellSlots('fighter', 1, spellSlotsByClass)
    expect(result).toEqual({})
  })

  it('returns {} for a class not in the table', () => {
    const result = buildSpellSlots('barbarian', 1, spellSlotsByClass)
    expect(result).toEqual({})
  })

  it('initializes used count to 0 for all slot levels', () => {
    const result = buildSpellSlots('wizard', 2, spellSlotsByClass)
    expect(result['1'].used).toBe(0)
  })
})
