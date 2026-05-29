/**
 * Wave 0 RED scaffold for mutationPipeline (PROG-02, COMB-03, T-5-01).
 *
 * This file imports from ./mutationPipeline, which DOES NOT YET EXIST — it is
 * implemented in Wave 1 (plan 05-02). Until then these assertions fail to
 * resolve, which is the intended RED state. Do not delete or weaken these
 * assertions; 05-02 turns them green.
 */

import { describe, it, expect } from 'vitest'
import { stripAndParseJsonTail } from './mutationPipeline'

describe('mutationPipeline', () => {
  describe('stripAndParseJsonTail', () => {
    it('returns the text unchanged with null mutations when there is no JSON tail', () => {
      expect(stripAndParseJsonTail('hello world')).toEqual({
        cleanText: 'hello world',
        mutations: null,
      })
    })

    it('strips a trailing fenced json block and parses its mutations array', () => {
      const text =
        'You strike the goblin.\n\n```json\n{"mutations":[{"toolName":"updateHp","args":{"delta":-3}}]}\n```'
      const { cleanText, mutations } = stripAndParseJsonTail(text)
      expect(cleanText).toBe('You strike the goblin.')
      expect(Array.isArray(mutations)).toBe(true)
      expect(mutations).toHaveLength(1)
      expect(mutations?.[0]).toMatchObject({ toolName: 'updateHp' })
    })

    it('returns null mutations and unchanged text for a malformed json tail', () => {
      const text = 'Narrative.\n\n```json\n{not valid json}\n```'
      const { cleanText, mutations } = stripAndParseJsonTail(text)
      expect(mutations).toBeNull()
      expect(cleanText).toBe(text)
    })

    it('does NOT treat a code block that is not at end-of-string as a tail (Pitfall 3)', () => {
      const text =
        'Before.\n\n```json\n{"mutations":[{"toolName":"updateHp","args":{"delta":-3}}]}\n```\n\nMore narrative after the block.'
      const { cleanText, mutations } = stripAndParseJsonTail(text)
      expect(mutations).toBeNull()
      expect(cleanText).toBe(text)
    })
  })

  describe('applyMutationBatch', () => {
    // Full long-rest (HP to max, all spell slots restored) and short-rest
    // (hitDiceCurrent decrements) behavior is asserted in 05-02 with a test DB.
    it.todo('long rest restores HP to max and refills all spell slots')
    it.todo('short rest decrements hitDiceCurrent by the dice spent')
  })
})
