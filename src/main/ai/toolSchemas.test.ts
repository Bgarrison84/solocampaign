/**
 * Wave 0 RED scaffold for toolSchemas (COMB-01..STATE-05, T-5-01 bounds).
 *
 * This file imports from ./toolSchemas, which DOES NOT YET EXIST — it is
 * implemented in Wave 1 (plan 05-02). Until then these assertions fail to
 * resolve, which is the intended RED state. Do not delete or weaken these
 * assertions; 05-02 turns them green.
 */

import { describe, it, expect } from 'vitest'
import {
  PHASE5_TOOLS,
  updateHpSchema,
  addCombatantSchema,
  awardXpSchema,
  deductSpellSlotSchema,
  showDiceRollSchema,
} from './toolSchemas'

describe('toolSchemas', () => {
  describe('updateHpSchema', () => {
    it('accepts a valid HP delta with a source', () => {
      expect(updateHpSchema.safeParse({ delta: -6, source: 'Goblin' }).success).toBe(true)
    })

    it('rejects a non-numeric delta', () => {
      expect(updateHpSchema.safeParse({ delta: 'lots' }).success).toBe(false)
    })
  })

  describe('addCombatantSchema', () => {
    it('accepts a combatant and defaults ac to 10', () => {
      const result = addCombatantSchema.safeParse({ campaignId: 'c1', name: 'Goblin', hpMax: 14 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ac).toBe(10)
      }
    })

    it('rejects hpMax below the minimum of 1', () => {
      expect(addCombatantSchema.safeParse({ campaignId: 'c1', name: 'X', hpMax: -5 }).success).toBe(false)
    })
  })

  describe('awardXpSchema', () => {
    it('rejects a negative XP amount', () => {
      expect(awardXpSchema.safeParse({ campaignId: 'c1', amount: -50 }).success).toBe(false)
    })
  })

  describe('deductSpellSlotSchema', () => {
    it('defaults slotType to normal and count to 1', () => {
      const result = deductSpellSlotSchema.safeParse({ characterId: 'char-1', slotLevel: 1 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.slotType).toBe('normal')
        expect(result.data.count).toBe(1)
      }
    })
  })

  describe('showDiceRollSchema', () => {
    it('accepts a dice-roll payload', () => {
      const result = showDiceRollSchema.safeParse({
        label: 'Atk',
        expression: '1d20+3',
        result: 14,
        breakdown: [11, 3],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('PHASE5_TOOLS', () => {
    it('has exactly 12 tools covering the full mutation surface', () => {
      const keys = Object.keys(PHASE5_TOOLS)
      expect(keys).toHaveLength(12)
      const expected = [
        'updateHp',
        'applyCondition',
        'removeCondition',
        'deductSpellSlot',
        'restoreSpellSlots',
        'awardXp',
        'updateCurrency',
        'addCombatant',
        'removeCombatant',
        'endCombat',
        'processRest',
        'showDiceRoll',
      ]
      for (const tool of expected) {
        expect(keys).toContain(tool)
      }
    })
  })
})
