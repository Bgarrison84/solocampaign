/**
 * Tests for the sessions tRPC router.
 * Uses vi.mock to mock all repo dependencies (no real DB — avoids ABI mismatch issue).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock sessionsRepo
const TEST_CAMPAIGN_ID = '00000000-0000-4000-8000-000000000001'
const TEST_SESSION_ID = '00000000-0000-4000-8000-000000000002'

const mockSession = {
  id: TEST_SESSION_ID,
  campaignId: TEST_CAMPAIGN_ID,
  sessionNumber: 1,
  startedAt: new Date(),
  endedAt: null,
  location: 'Dark Forest',
  goal: null,
  contextNotes: null,
  aiRecap: null,
  playerNotes: null,
  isSummarized: false,
}

vi.mock('../../db/sessionsRepo', () => ({
  sessionsRepo: {
    create: vi.fn(),
    getById: vi.fn(),
    getActiveByCampaignId: vi.fn(),
    getLastNCompleted: vi.fn().mockReturnValue([]),
    getOlderThan: vi.fn().mockReturnValue([]),
    list: vi.fn().mockReturnValue([]),
    end: vi.fn(),
    saveRecap: vi.fn(),
    updatePlayerNotes: vi.fn(),
    markSummarized: vi.fn(),
    getLastLocation: vi.fn().mockReturnValue(null),
  },
}))

// Mock campaignsRepo
vi.mock('../../db/campaignsRepo', () => ({
  campaignsRepo: {
    get: vi.fn(),
    updateRollingSummary: vi.fn(),
  },
}))

// Mock sessionActiveMap (but track calls via spies)
const _activeMap = new Map<string, string>()
vi.mock('../../ai/aiSessionState', () => ({
  sessionActiveMap: {
    set: vi.fn((campaignId: string, sessionId: string) => _activeMap.set(campaignId, sessionId)),
    get: vi.fn((campaignId: string) => _activeMap.get(campaignId) ?? null),
    clear: vi.fn((campaignId: string) => _activeMap.delete(campaignId)),
  },
  sessionFallbackMap: {
    isFallbackActive: vi.fn().mockReturnValue(false),
    setFallbackActive: vi.fn(),
  },
  sessionAbortMap: {
    setAbortController: vi.fn(),
    clearAbortController: vi.fn(),
  },
}))

// Mock secretStorage
vi.mock('../../secrets', () => ({
  secretStorage: {
    init: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn().mockResolvedValue(null),
    remove: vi.fn(),
  },
}))

// Mock recapGenerator
vi.mock('../../ai/recapGenerator', () => ({
  generateRollingSummary: vi.fn().mockResolvedValue('rolling summary result'),
  generateSessionRecap: vi.fn().mockResolvedValue('session recap'),
  RECAP_SYSTEM_PROMPT: 'mock-recap-prompt',
  ROLLING_SUMMARY_SYSTEM_PROMPT: 'mock-rolling-prompt',
}))

import { sessionsRouter } from './sessions'
import { sessionsRepo } from '../../db/sessionsRepo'
import { sessionActiveMap } from '../../ai/aiSessionState'

describe('sessions tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _activeMap.clear()

    // Reset default mock implementations
    vi.mocked(sessionsRepo.create).mockReturnValue({ ...mockSession })
    vi.mocked(sessionsRepo.end).mockReturnValue({ ...mockSession, endedAt: new Date() })
    vi.mocked(sessionsRepo.getById).mockReturnValue({ ...mockSession })
    vi.mocked(sessionsRepo.getActiveByCampaignId).mockReturnValue(undefined)
    vi.mocked(sessionsRepo.getLastLocation).mockReturnValue(null)
    vi.mocked(sessionsRepo.list).mockReturnValue([])
    vi.mocked(sessionsRepo.getOlderThan).mockReturnValue([])
  })

  describe('sessions.start', () => {
    it('creates a session row in the DB with correct campaign_id and session_number', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.create).mockReturnValue({ ...mockSession, id: 'new-session', campaignId })

      const caller = sessionsRouter.createCaller({})
      const result = await caller.start({ campaignId })

      expect(sessionsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ campaignId }))
      expect(result.sessionNumber).toBe(1)
    })

    it('sets the active session in sessionActiveMap for the campaign', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      const sessionId = randomUUID()
      vi.mocked(sessionsRepo.create).mockReturnValue({ ...mockSession, id: sessionId, campaignId })

      const caller = sessionsRouter.createCaller({})
      const result = await caller.start({ campaignId })

      expect(sessionActiveMap.set).toHaveBeenCalledWith(campaignId, sessionId)
      expect(result.id).toBe(sessionId)
    })

    it('returns the created session id and sessionNumber', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.create).mockReturnValue({ ...mockSession, sessionNumber: 2 })

      const caller = sessionsRouter.createCaller({})
      const result = await caller.start({ campaignId, location: 'Forest', goal: 'Find the artifact' })

      expect(result).toMatchObject({
        id: expect.any(String),
        sessionNumber: expect.any(Number),
      })
    })

    it('passes optional fields (location, goal, contextNotes) to create', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.create).mockReturnValue({ ...mockSession })

      const caller = sessionsRouter.createCaller({})
      await caller.start({ campaignId, location: 'Tavern', goal: 'Rest', contextNotes: 'After the battle' })

      expect(sessionsRepo.create).toHaveBeenCalledWith({
        campaignId,
        location: 'Tavern',
        goal: 'Rest',
        contextNotes: 'After the battle',
      })
    })
  })

  describe('sessions.end', () => {
    it('calls sessionsRepo.end with the sessionId', async () => {
      const sessionId = TEST_SESSION_ID
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.end).mockReturnValue({ ...mockSession, campaignId, endedAt: new Date() })

      const caller = sessionsRouter.createCaller({})
      await caller.end({ sessionId })

      expect(sessionsRepo.end).toHaveBeenCalledWith(sessionId)
    })

    it('clears the active session from sessionActiveMap', async () => {
      const sessionId = TEST_SESSION_ID
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.end).mockReturnValue({ ...mockSession, campaignId, endedAt: new Date() })

      const caller = sessionsRouter.createCaller({})
      await caller.end({ sessionId })

      expect(sessionActiveMap.clear).toHaveBeenCalledWith(campaignId)
    })

    it('returns { ended: true }', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.end).mockReturnValue({ ...mockSession, campaignId, endedAt: new Date() })

      const caller = sessionsRouter.createCaller({})
      const result = await caller.end({ sessionId: TEST_SESSION_ID })

      expect(result).toEqual({ ended: true })
    })
  })

  describe('sessions.saveRecap', () => {
    it('persists aiRecap and playerNotes to the session row', async () => {
      const sessionId = TEST_SESSION_ID
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.saveRecap).mockReturnValue({ ...mockSession, aiRecap: 'recap', playerNotes: 'notes' })

      const caller = sessionsRouter.createCaller({})
      await caller.saveRecap({
        sessionId,
        campaignId,
        aiRecap: 'The party defeated the goblin king.',
        playerNotes: 'Need to remember the secret door.',
      })

      expect(sessionsRepo.saveRecap).toHaveBeenCalledWith(
        sessionId,
        'The party defeated the goblin king.',
        'Need to remember the secret door.',
      )
    })

    it('clears the active session from sessionActiveMap', async () => {
      const sessionId = TEST_SESSION_ID
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.saveRecap).mockReturnValue({ ...mockSession })

      const caller = sessionsRouter.createCaller({})
      await caller.saveRecap({ sessionId, campaignId, aiRecap: 'Recap.' })

      expect(sessionActiveMap.clear).toHaveBeenCalledWith(campaignId)
    })

    it('returns { saved: true }', async () => {
      const sessionId = TEST_SESSION_ID
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.saveRecap).mockReturnValue({ ...mockSession })

      const caller = sessionsRouter.createCaller({})
      const result = await caller.saveRecap({ sessionId, campaignId, aiRecap: 'Recap text.' })

      expect(result).toEqual({ saved: true })
    })
  })

  describe('sessions.updatePlayerNotes', () => {
    it('updates playerNotes on a completed session', async () => {
      const sessionId = TEST_SESSION_ID
      vi.mocked(sessionsRepo.updatePlayerNotes).mockReturnValue({ ...mockSession, playerNotes: 'Updated notes.' })

      const caller = sessionsRouter.createCaller({})
      const result = await caller.updatePlayerNotes({ sessionId, playerNotes: 'Updated notes.' })

      expect(sessionsRepo.updatePlayerNotes).toHaveBeenCalledWith(sessionId, 'Updated notes.')
      expect(result).toEqual({ updated: true })
    })
  })

  describe('sessions.list', () => {
    it('returns all completed sessions for a campaign in descending order', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      const mockSessions = [
        { ...mockSession, sessionNumber: 3 },
        { ...mockSession, sessionNumber: 2 },
        { ...mockSession, sessionNumber: 1 },
      ]
      vi.mocked(sessionsRepo.list).mockReturnValue(mockSessions)

      const caller = sessionsRouter.createCaller({})
      const sessions = await caller.list({ campaignId })

      expect(sessionsRepo.list).toHaveBeenCalledWith(campaignId)
      expect(sessions).toHaveLength(3)
      expect(sessions[0].sessionNumber).toBe(3)
    })
  })

  describe('sessions.getActive', () => {
    it('returns the active session for a campaign', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.getActiveByCampaignId).mockReturnValue({ ...mockSession })

      const caller = sessionsRouter.createCaller({})
      const active = await caller.getActive({ campaignId })

      expect(active).not.toBeNull()
      expect(active?.id).toBe(mockSession.id)
    })

    it('returns null when no session is active', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.getActiveByCampaignId).mockReturnValue(undefined)

      const caller = sessionsRouter.createCaller({})
      const active = await caller.getActive({ campaignId })

      expect(active).toBeNull()
    })
  })

  describe('sessions.getLastLocation', () => {
    it('returns the location from the most recently completed session', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.getLastLocation).mockReturnValue('Dark Forest')

      const caller = sessionsRouter.createCaller({})
      const loc = await caller.getLastLocation({ campaignId })

      expect(loc).toBe('Dark Forest')
    })

    it('returns null when no sessions exist', async () => {
      const campaignId = TEST_CAMPAIGN_ID
      vi.mocked(sessionsRepo.getLastLocation).mockReturnValue(null)

      const caller = sessionsRouter.createCaller({})
      const loc = await caller.getLastLocation({ campaignId })

      expect(loc).toBeNull()
    })
  })
})
