/**
 * Wave 0 test stub for the characters tRPC router.
 * Tests are marked as todo — they go green in Plan 02 when the router is built.
 *
 * These stubs document the expected behavior per 02-VALIDATION.md tasks
 * 2-xx-05, 2-xx-06, 2-xx-08, 2-xx-11.
 */
import { describe, it } from 'vitest'

describe('characters tRPC router', () => {
  describe('characters.create', () => {
    it.todo('writes a character to DB and returns CharacterWithResources')

    it.todo('rejects malformed input: empty name fails Zod (min 1 char)')

    it.todo('rejects malformed input: non-integer ability score fails Zod')

    it.todo('rejects malformed input: ability score below 1 fails Zod')

    it.todo('rejects malformed input: ability score above 30 fails Zod')

    it.todo('rejects malformed input: backstory exceeding 2000 chars fails Zod')
  })

  describe('characters.updateHp', () => {
    it.todo('delta-based mutation increases hpCurrent up to hpMax')

    it.todo('delta-based mutation clamps hpCurrent at 0 (cannot go negative)')

    it.todo('rejects out-of-range delta (> 9999) via Zod')

    it.todo('rejects out-of-range delta (< -9999) via Zod')
  })

  describe('characters.updateXp', () => {
    it.todo('delta mutates the xp column and persists across getByCampaignId')

    it.todo('clamps at 0 (cannot have negative XP)')

    it.todo('rejects out-of-range delta (> 999999) via Zod')

    it.todo('rejects out-of-range delta (< -999999) via Zod')
  })

  describe('characters.toggleItemAttuned', () => {
    it.todo('flips isAttuned from false to true on the items row')

    it.todo('flips isAttuned from true to false (toggle semantics)')
  })

  describe('characters.toggleCondition', () => {
    it.todo('adds condition to conditions array and persists across refetch')

    it.todo('removes condition when already present (toggle semantics)')

    it.todo('rejects unknown condition name not in the 14-condition enum via Zod')
  })
})
