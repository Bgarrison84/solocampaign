import { describe, it, expect } from 'vitest'
import { rollExpression, isValidExpression } from './dice'

describe('dice', () => {
  describe('rollExpression()', () => {
    it('d20 result is between 1 and 20', () => {
      const roll = rollExpression('d20')
      expect(roll.result).toBeGreaterThanOrEqual(1)
      expect(roll.result).toBeLessThanOrEqual(20)
      expect(roll.expression).toBe('d20')
    })

    it('2d6+3 result is between 5 and 15 with a breakdown of 2 dice', () => {
      const roll = rollExpression('2d6+3')
      expect(roll.result).toBeGreaterThanOrEqual(5)
      expect(roll.result).toBeLessThanOrEqual(15)
      expect(roll.breakdown.length).toBe(2)
      for (const die of roll.breakdown) {
        expect(die).toBeGreaterThanOrEqual(1)
        expect(die).toBeLessThanOrEqual(6)
      }
    })

    it('4d6kh3 returns a result and a breakdown of the rolled dice', () => {
      const roll = rollExpression('4d6kh3')
      expect(typeof roll.result).toBe('number')
      expect(roll.result).toBeGreaterThanOrEqual(3)
      expect(roll.result).toBeLessThanOrEqual(18)
      // All four rolled dice (including the dropped die) appear in the breakdown.
      expect(roll.breakdown.length).toBe(4)
    })
  })

  describe('isValidExpression()', () => {
    it('returns false for an invalid expression', () => {
      expect(isValidExpression('not-a-roll')).toBe(false)
    })

    it('returns true for a valid expression', () => {
      expect(isValidExpression('2d6+3')).toBe(true)
    })
  })
})
