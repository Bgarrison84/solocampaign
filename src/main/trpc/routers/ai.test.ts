/**
 * Tests for the ai tRPC router (plan 03-03).
 * Turns the Wave 0 stubs green.
 *
 * Tests cover:
 *   - listReferenceDocs: SESS-05
 *   - getMessages: SESS-05
 *   - updateAiConfig: SESS-05 (tested via campaigns router in campaigns.test.ts)
 *   - cancelStream: D-19 in-memory fallback state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aiRouter } from './ai'

// Mock referenceDocLoader so tests don't hit the real filesystem
vi.mock('../../ai/referenceDocLoader', () => ({
  listReferenceDocs: vi.fn(() => [
    {
      relativePath: 'solo-adventurers-guide/solo-adventurers-guide.md',
      title: 'Solo Adventurers Guide',
      sizeBytes: 150_000,
      isLarge: false,
    },
    {
      relativePath: 'dungeon-masters-guide/dungeon-masters-guide.md',
      title: 'Dungeon Masters Guide',
      sizeBytes: 250_000,
      isLarge: true,
    },
  ]),
}))

// Mock messagesRepo so tests don't hit the real DB
vi.mock('../../db/messagesRepo', () => ({
  messagesRepo: {
    getLastN: vi.fn((campaignId: string, n: number) => {
      if (campaignId === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') {
        return [
          {
            id: 'msg-001',
            campaignId,
            role: 'user',
            content: 'I approach the dungeon entrance.',
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            id: 'msg-002',
            campaignId,
            role: 'assistant',
            content: 'The heavy stone door looms before you, carved with ancient runes.',
            createdAt: new Date('2026-01-01T00:00:01Z'),
          },
        ]
      }
      return []
    }),
  },
}))

// Mock aiSessionState
vi.mock('../../ai/aiSessionState', () => ({
  sessionFallbackMap: {
    setFallbackActive: vi.fn(),
    isFallbackActive: vi.fn(() => false),
    clearFallback: vi.fn(),
  },
}))

const TEST_CAMPAIGN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

describe('ai tRPC router', () => {
  const caller = aiRouter.createCaller({})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listReferenceDocs returns available reference documents', async () => {
    const docs = await caller.listReferenceDocs()

    expect(docs).toHaveLength(2)
    expect(docs[0]).toMatchObject({
      relativePath: 'solo-adventurers-guide/solo-adventurers-guide.md',
      title: 'Solo Adventurers Guide',
      isLarge: false,
    })
    // sizeBytes should NOT be returned (internal detail)
    expect(docs[0]).not.toHaveProperty('sizeBytes')
  })

  it('listReferenceDocs flags large documents', async () => {
    const docs = await caller.listReferenceDocs()
    const largeDoc = docs.find((d) => d.title === 'Dungeon Masters Guide')

    expect(largeDoc).toBeDefined()
    expect(largeDoc?.isLarge).toBe(true)
  })

  it('getMessages returns last N messages for a campaign', async () => {
    const messages = await caller.getMessages({ campaignId: TEST_CAMPAIGN_ID })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('I approach the dungeon entrance.')
    expect(messages[1].role).toBe('assistant')
  })

  it('getMessages returns empty array for unknown campaign', async () => {
    const messages = await caller.getMessages({
      campaignId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    })
    expect(messages).toEqual([])
  })

  it('cancelStream clears the session fallback state', async () => {
    const { sessionFallbackMap } = await import('../../ai/aiSessionState')

    const result = await caller.cancelStream({ campaignId: TEST_CAMPAIGN_ID })

    expect(result).toEqual({ cancelled: true })
    expect(sessionFallbackMap.clearFallback).toHaveBeenCalledWith(TEST_CAMPAIGN_ID)
  })
})
