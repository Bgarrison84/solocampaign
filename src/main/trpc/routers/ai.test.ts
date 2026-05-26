/**
 * Wave 0 test stubs for the ai tRPC router (plan 03-03).
 * These tests verify the intended behavior contract but are skipped until
 * the implementation lands in plan 03-03.
 *
 * Tests cover: SESS-05 (listReferenceDocs and getMessages tRPC queries)
 */

import { describe, it, expect } from 'vitest'

describe('ai tRPC router', () => {
  it.skip('listReferenceDocs returns available reference documents — MISSING: implemented in plan 03-03', async () => {
    // MISSING — implemented in plan 03-03 (SESS-05: listReferenceDocs query)
    // Expects array of { path: string, title: string } objects
    expect(true).toBe(true)
  })

  it.skip('getMessages returns last N messages for a campaign — MISSING: implemented in plan 03-03', async () => {
    // MISSING — implemented in plan 03-03 (SESS-05: getMessages query)
    // Input: { campaignId: string, limit?: number }
    // Output: Message[]
    expect(true).toBe(true)
  })

  it.skip('updateAiConfig mutation persists provider config — MISSING: implemented in plan 03-03', async () => {
    // MISSING — implemented in plan 03-03 (SESS-05: updateAiConfig mutation)
    expect(true).toBe(true)
  })

  it.skip('sendMessage mutation persists user message and triggers AI stream — MISSING: implemented in plan 03-03', async () => {
    // MISSING — implemented in plan 03-03 (SESS-05: sendMessage mutation)
    expect(true).toBe(true)
  })

  it.skip('saveApiKey mutation encrypts key via SecretStorageService — MISSING: implemented in plan 03-03', async () => {
    // MISSING — implemented in plan 03-03 (D-23: keys never in SQLite)
    expect(true).toBe(true)
  })
})
