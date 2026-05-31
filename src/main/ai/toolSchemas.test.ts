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
  PHASE6_TOOLS,
  ALL_TOOLS,
  updateHpSchema,
  addCombatantSchema,
  awardXpSchema,
  deductSpellSlotSchema,
  showDiceRollSchema,
  addQuestSchema,
  updateQuestStatusSchema,
  addNpcSchema,
  updateNpcSchema,
  updateFactionSchema,
  updateWorldTimeSchema,
  updateLocationSchema,
  awardInspirationSchema,
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

  // ─── Phase 6 schemas (STATE-01..04, WORLD-03, PARTY-03) ──────────────────────

  describe('addQuestSchema', () => {
    it('accepts a quest with a name and description', () => {
      expect(
        addQuestSchema.safeParse({ name: 'Find the amulet', description: 'A relic lost in the crypt' })
          .success,
      ).toBe(true)
    })

    it('rejects an empty name', () => {
      expect(addQuestSchema.safeParse({ name: '', description: 'x' }).success).toBe(false)
    })
  })

  describe('updateQuestStatusSchema', () => {
    it('accepts a valid status', () => {
      expect(
        updateQuestStatusSchema.safeParse({ questId: 'q1', status: 'Completed' }).success,
      ).toBe(true)
    })

    it('rejects an invalid status enum', () => {
      expect(
        updateQuestStatusSchema.safeParse({ questId: 'q1', status: 'Abandoned' }).success,
      ).toBe(false)
    })
  })

  describe('addNpcSchema', () => {
    it('accepts an NPC with a relationship and optional faction', () => {
      const r = addNpcSchema.safeParse({
        name: 'Borin',
        description: 'The blacksmith of Redpine',
        relationship: 'Friendly',
        factionName: 'Redpine Guild',
      })
      expect(r.success).toBe(true)
    })

    it('rejects an invalid relationship enum', () => {
      expect(
        addNpcSchema.safeParse({ name: 'X', description: '', relationship: 'Enemy' }).success,
      ).toBe(false)
    })
  })

  describe('updateNpcSchema', () => {
    it('accepts a partial patch with only npcId', () => {
      expect(updateNpcSchema.safeParse({ npcId: 'n1' }).success).toBe(true)
    })

    it('accepts a patch updating relationship only', () => {
      expect(
        updateNpcSchema.safeParse({ npcId: 'n1', relationship: 'Hostile' }).success,
      ).toBe(true)
    })
  })

  describe('updateFactionSchema', () => {
    it('accepts a valid tier', () => {
      expect(
        updateFactionSchema.safeParse({ factionName: 'City Watch', tier: 'Allied' }).success,
      ).toBe(true)
    })

    it('rejects an invalid tier enum', () => {
      expect(
        updateFactionSchema.safeParse({ factionName: 'City Watch', tier: 'Loved' }).success,
      ).toBe(false)
    })
  })

  describe('updateWorldTimeSchema', () => {
    it('accepts a valid world-time payload', () => {
      expect(
        updateWorldTimeSchema.safeParse({ timeOfDay: 'Evening', dayNumber: 14, season: 'Autumn' })
          .success,
      ).toBe(true)
    })

    it('rejects dayNumber 0', () => {
      expect(
        updateWorldTimeSchema.safeParse({ timeOfDay: 'Morning', dayNumber: 0, season: 'Spring' })
          .success,
      ).toBe(false)
    })
  })

  describe('updateLocationSchema', () => {
    it('accepts a 1-10 segment path', () => {
      expect(
        updateLocationSchema.safeParse({ path: ['Forest', 'Ancient Ruins', 'Crypt Level 2'] }).success,
      ).toBe(true)
    })

    it('rejects an empty path', () => {
      expect(updateLocationSchema.safeParse({ path: [] }).success).toBe(false)
    })
  })

  describe('awardInspirationSchema', () => {
    it('accepts a characterId', () => {
      expect(awardInspirationSchema.safeParse({ characterId: 'char-1' }).success).toBe(true)
    })

    it('rejects a missing characterId', () => {
      expect(awardInspirationSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('PHASE6_TOOLS', () => {
    it('has exactly 8 Phase 6 tools', () => {
      const keys = Object.keys(PHASE6_TOOLS)
      expect(keys).toHaveLength(8)
      const expected = [
        'addQuest',
        'updateQuestStatus',
        'addNpc',
        'updateNpc',
        'updateFaction',
        'updateWorldTime',
        'updateLocation',
        'awardInspiration',
      ]
      for (const tool of expected) {
        expect(keys).toContain(tool)
      }
    })
  })

  describe('ALL_TOOLS', () => {
    it('combines all 20 tools (12 Phase 5 + 8 Phase 6)', () => {
      // Note: this count will be 22 after Phase 7 companion tools are added.
      // Updated below in Phase 7 tests.
      expect(Object.keys(ALL_TOOLS)).toHaveLength(20)
    })

    it('includes every Phase 5 and Phase 6 tool', () => {
      for (const key of Object.keys(PHASE5_TOOLS)) expect(ALL_TOOLS).toHaveProperty(key)
      for (const key of Object.keys(PHASE6_TOOLS)) expect(ALL_TOOLS).toHaveProperty(key)
    })

    it('has no tool with an execute property (D-04, Pitfall 1)', () => {
      for (const value of Object.values(ALL_TOOLS)) {
        expect(value).not.toHaveProperty('execute')
      }
    })
  })
})

// ─── Phase 7 Tool Schema Tests (PARTY-02) ─────────────────────────────────────

import {
  addCompanionSchema,
  removeCompanionSchema,
  PHASE7_TOOLS,
} from './toolSchemas'

describe('Phase 7 toolSchemas', () => {
  describe('addCompanionSchema', () => {
    it('accepts a valid companion', () => {
      const r = addCompanionSchema.safeParse({
        name: 'Shadowfax',
        type: 'Animal Companion',
        hpMax: 50,
        ac: 12,
      })
      expect(r.success).toBe(true)
    })

    it('rejects an empty name', () => {
      expect(
        addCompanionSchema.safeParse({ name: '', type: 'Familiar', hpMax: 10, ac: 12 }).success,
      ).toBe(false)
    })

    it('rejects name longer than 100 chars', () => {
      expect(
        addCompanionSchema.safeParse({
          name: 'x'.repeat(101),
          type: 'Familiar',
          hpMax: 10,
          ac: 12,
        }).success,
      ).toBe(false)
    })

    it('rejects ac > 30', () => {
      expect(
        addCompanionSchema.safeParse({ name: 'X', type: 'Familiar', hpMax: 10, ac: 31 }).success,
      ).toBe(false)
    })

    it('rejects hpMax <= 0', () => {
      expect(
        addCompanionSchema.safeParse({ name: 'X', type: 'Familiar', hpMax: 0, ac: 12 }).success,
      ).toBe(false)
    })

    it('rejects invalid type enum', () => {
      expect(
        addCompanionSchema.safeParse({ name: 'X', type: 'Dragon', hpMax: 10, ac: 12 }).success,
      ).toBe(false)
    })

    it('accepts all three companion types', () => {
      for (const type of ['Familiar', 'Animal Companion', 'Summoned Creature'] as const) {
        expect(
          addCompanionSchema.safeParse({ name: 'X', type, hpMax: 10, ac: 12 }).success,
        ).toBe(true)
      }
    })
  })

  describe('removeCompanionSchema', () => {
    it('accepts a companionId', () => {
      expect(removeCompanionSchema.safeParse({ companionId: 'char-companion-1' }).success).toBe(
        true,
      )
    })

    it('rejects missing companionId', () => {
      expect(removeCompanionSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('PHASE7_TOOLS', () => {
    it('contains addCompanion and removeCompanion', () => {
      expect(PHASE7_TOOLS).toHaveProperty('addCompanion')
      expect(PHASE7_TOOLS).toHaveProperty('removeCompanion')
    })

    it('has no execute property on any tool (D-04)', () => {
      for (const value of Object.values(PHASE7_TOOLS)) {
        expect(value).not.toHaveProperty('execute')
      }
    })
  })

  describe('ALL_TOOLS (Phase 7 updated)', () => {
    it('includes addCompanion and removeCompanion in ALL_TOOLS', () => {
      expect(ALL_TOOLS).toHaveProperty('addCompanion')
      expect(ALL_TOOLS).toHaveProperty('removeCompanion')
    })

    it('has 22 tools total (20 Phase 5+6 + 2 Phase 7)', () => {
      expect(Object.keys(ALL_TOOLS)).toHaveLength(22)
    })
  })
})
