/**
 * Wave 0 test stubs for recapGenerator.
 * recapGenerator does not exist yet — Plans 02/03 will create it and fill in these tests.
 * Using vi.mock placeholder so the file can be imported without errors.
 */

import { describe, it, vi } from 'vitest'

// recapGenerator will be created in a later plan (04-02 or 04-03)
// Stub the module so this test file can run without the implementation
vi.mock('./recapGenerator', () => ({
  recapGenerator: {
    generateSessionRecap: vi.fn(),
    generateRollingSummary: vi.fn(),
  },
}))

describe('recapGenerator', () => {
  describe('generateSessionRecap()', () => {
    it.todo('calls generateText with RECAP_SYSTEM_PROMPT')
    it.todo('passes all session messages as the conversation context')
    it.todo('returns the generated recap text string')
    it.todo('uses the campaign AI provider config (not DM personality — D-12)')
  })

  describe('generateRollingSummary()', () => {
    it.todo('calls generateText with ROLLING_SUMMARY_SYSTEM_PROMPT')
    it.todo('concatenates older session recaps as input context')
    it.todo('returns a summary string within the L3 token cap (1000 tokens, D-16)')
    it.todo('handles empty session list gracefully')
  })
})
