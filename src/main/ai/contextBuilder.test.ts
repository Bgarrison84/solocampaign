/**
 * Wave 0 test stubs for contextBuilder (plan 03-02).
 * These tests verify the intended behavior contract but are skipped until
 * the implementation lands in plan 03-02.
 *
 * Tests cover: SESS-06 (character summary format), SESS-07 (strictness directive + personality injection)
 */

import { describe, it, expect } from 'vitest'

describe('contextBuilder', () => {
  it.skip('buildSystemPrompt includes character name, level, race, and class — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    // const { contextBuilder } = await import('./contextBuilder')
    // const prompt = contextBuilder.buildSystemPrompt({ character: mockCharacter, campaign: mockCampaign, referenceDocs: [] })
    // expect(prompt).toContain('Aldric the Bold')
    // expect(prompt).toContain('Level 1')
    // expect(prompt).toContain('Human')
    // expect(prompt).toContain('Fighter')
    expect(true).toBe(true)
  })

  it.skip('buildSystemPrompt includes HP, AC, speed, initiative — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (D-21 character summary format)
    expect(true).toBe(true)
  })

  it.skip('buildSystemPrompt includes strictness directive for "strict" mode — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (SESS-06: strictness directive)
    // expect(prompt).toContain('rules-as-written')
    expect(true).toBe(true)
  })

  it.skip('buildSystemPrompt includes strictness directive for "narrative" mode — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (SESS-06)
    expect(true).toBe(true)
  })

  it.skip('buildSystemPrompt injects DM personality text when provided — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (SESS-07)
    expect(true).toBe(true)
  })

  it.skip('buildSystemPrompt appends reference doc content when docs selected — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (D-05)
    expect(true).toBe(true)
  })

  it.skip('getMessageHistory returns last 20 messages for context window — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (D-20)
    expect(true).toBe(true)
  })
})
