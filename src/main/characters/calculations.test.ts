import { describe, it, expect } from 'vitest'
import {
  calcAbilityModifier,
  calcHP,
  calcAC,
  calcInitiativeBonus,
  buildSpellSlots,
  calcPointBuyCost,
  calcPointBuyBudget,
  calcMulticlassCasterLevel,
  calcMulticlassSpellSlots,
  proficiencyBonusForLevel,
} from './calculations'
import type { SpellSlotsByClass } from '../db/contentTypes'
import type { ClassEntry } from './calculations'

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

// ─── Phase 7: Point Buy calculations ─────────────────────────────────────────

describe('calcPointBuyCost', () => {
  it('returns 0 when all scores are 8', () => {
    expect(
      calcPointBuyCost({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }),
    ).toBe(0)
  })

  it('returns 54 when all scores are 15', () => {
    // 9 pts each × 6 stats = 54
    expect(
      calcPointBuyCost({ str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 }),
    ).toBe(54)
  })

  it('returns correct total for mixed scores: str:14,dex:13,con:12,int:10,wis:8,cha:8', () => {
    // 7+5+4+2+0+0 = 18
    expect(
      calcPointBuyCost({ str: 14, dex: 13, con: 12, int: 10, wis: 8, cha: 8 }),
    ).toBe(18)
  })

  it('returns 0 for scores below 8 (out-of-table scores default to 0)', () => {
    expect(calcPointBuyCost({ str: 7 })).toBe(0)
  })

  it('returns correct cost for individual score lookups', () => {
    // Verify individual costs from the RAW table
    expect(calcPointBuyCost({ a: 8 })).toBe(0)
    expect(calcPointBuyCost({ a: 9 })).toBe(1)
    expect(calcPointBuyCost({ a: 10 })).toBe(2)
    expect(calcPointBuyCost({ a: 11 })).toBe(3)
    expect(calcPointBuyCost({ a: 12 })).toBe(4)
    expect(calcPointBuyCost({ a: 13 })).toBe(5)
    expect(calcPointBuyCost({ a: 14 })).toBe(7)
    expect(calcPointBuyCost({ a: 15 })).toBe(9)
  })
})

describe('calcPointBuyBudget', () => {
  it('returns 27 with no flaws', () => {
    expect(calcPointBuyBudget([], [])).toBe(27)
  })

  it('adds preset flaw points to the 27-point budget', () => {
    // One preset flaw worth 2 pts
    expect(calcPointBuyBudget([2], [])).toBe(29)
  })

  it('adds 2 pts per non-empty free-form flaw (up to 2)', () => {
    expect(calcPointBuyBudget([], ['My flaw', 'Another flaw'])).toBe(31)
  })

  it('caps free-form bonus at 2 flaws (3 entries still only +4)', () => {
    expect(calcPointBuyBudget([], ['Flaw 1', 'Flaw 2', 'Flaw 3'])).toBe(31)
  })

  it('ignores empty/whitespace-only free-form flaw entries', () => {
    expect(calcPointBuyBudget([], ['  ', ''])).toBe(27)
  })

  it('combines preset and free-form bonuses', () => {
    // 27 + 3 (preset) + 4 (2 free-form) = 34
    expect(calcPointBuyBudget([3], ['flaw a', 'flaw b'])).toBe(34)
  })
})

// ─── Phase 7: Multiclass spell slot calculations ──────────────────────────────

describe('calcMulticlassCasterLevel', () => {
  it('returns 0 for a pure Fighter (non-caster base class)', () => {
    const classes: ClassEntry[] = [{ className: 'Fighter', level: 5 }]
    expect(calcMulticlassCasterLevel(classes)).toBe(0)
  })

  it('returns floor(level/2) for a half-caster Paladin', () => {
    const classes: ClassEntry[] = [{ className: 'Paladin', level: 6 }]
    expect(calcMulticlassCasterLevel(classes)).toBe(3) // floor(6/2)
  })

  it('returns full level for a full-caster Wizard', () => {
    const classes: ClassEntry[] = [{ className: 'Wizard', level: 5 }]
    expect(calcMulticlassCasterLevel(classes)).toBe(5)
  })

  it('returns 0 for Warlock (excluded from multiclass table)', () => {
    const classes: ClassEntry[] = [{ className: 'Warlock', level: 5 }]
    expect(calcMulticlassCasterLevel(classes)).toBe(0)
  })

  it('sums full Wizard level + 0 for Fighter base (no subclass)', () => {
    const classes: ClassEntry[] = [
      { className: 'Wizard', level: 5 },
      { className: 'Fighter', level: 3 },
    ]
    expect(calcMulticlassCasterLevel(classes)).toBe(5)
  })

  it('recognizes Fighter Eldritch Knight as third caster', () => {
    const classes: ClassEntry[] = [
      { className: 'Fighter', level: 6, subclass: 'Eldritch Knight' },
    ]
    expect(calcMulticlassCasterLevel(classes)).toBe(2) // floor(6/3)
  })

  it('recognizes Rogue Arcane Trickster as third caster', () => {
    const classes: ClassEntry[] = [
      { className: 'Rogue', level: 9, subclass: 'Arcane Trickster' },
    ]
    expect(calcMulticlassCasterLevel(classes)).toBe(3) // floor(9/3)
  })

  it('handles case-insensitive className matching for full casters', () => {
    const classes: ClassEntry[] = [{ className: 'wizard', level: 3 }]
    expect(calcMulticlassCasterLevel(classes)).toBe(3)
  })
})

describe('calcMulticlassSpellSlots', () => {
  it('returns {} for caster level 0 (pure non-casters)', () => {
    const classes: ClassEntry[] = [{ className: 'Fighter', level: 5 }]
    expect(calcMulticlassSpellSlots(classes)).toEqual({})
  })

  it('returns correct row for caster level 8 (Wizard 5 / Fighter 3)', () => {
    // Wizard 5 = caster level 5; Fighter 3 = 0; total caster level = 5
    // Level 5 row: {1:4, 2:3, 3:2}
    const classes: ClassEntry[] = [
      { className: 'Wizard', level: 5 },
      { className: 'Fighter', level: 3 },
    ]
    expect(calcMulticlassSpellSlots(classes)).toEqual({ 1: 4, 2: 3, 3: 2 })
  })

  it('returns correct row for caster level 8 (Wizard 8 solo)', () => {
    // Level 8 row: {1:4, 2:3, 3:3, 4:2}
    const classes: ClassEntry[] = [{ className: 'Wizard', level: 8 }]
    expect(calcMulticlassSpellSlots(classes)).toEqual({ 1: 4, 2: 3, 3: 3, 4: 2 })
  })

  it('returns correct row for caster level 3 (Paladin 6)', () => {
    // Paladin 6 = half caster = 3; Level 3 row: {1:4, 2:2}
    const classes: ClassEntry[] = [{ className: 'Paladin', level: 6 }]
    expect(calcMulticlassSpellSlots(classes)).toEqual({ 1: 4, 2: 2 })
  })

  it('returns level-20 row for max caster level', () => {
    const classes: ClassEntry[] = [{ className: 'Wizard', level: 20 }]
    expect(calcMulticlassSpellSlots(classes)).toEqual({
      1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1,
    })
  })
})

// ─── Phase 7: Proficiency bonus extension past level 20 ──────────────────────

describe('proficiencyBonusForLevel', () => {
  it('returns +2 for levels 1–4', () => {
    expect(proficiencyBonusForLevel(1)).toBe(2)
    expect(proficiencyBonusForLevel(4)).toBe(2)
  })

  it('returns +6 for level 20 (standard cap)', () => {
    expect(proficiencyBonusForLevel(20)).toBe(6)
  })

  it('returns +7 for level 21 (epic extension)', () => {
    expect(proficiencyBonusForLevel(21)).toBe(7)
  })

  it('returns correct values for levels 1–20 matching PHB table', () => {
    const expected: Record<number, number> = {
      1: 2, 2: 2, 3: 2, 4: 2,
      5: 3, 6: 3, 7: 3, 8: 3,
      9: 4, 10: 4, 11: 4, 12: 4,
      13: 5, 14: 5, 15: 5, 16: 5,
      17: 6, 18: 6, 19: 6, 20: 6,
    }
    for (const [level, bonus] of Object.entries(expected)) {
      expect(proficiencyBonusForLevel(Number(level))).toBe(bonus)
    }
  })
})
