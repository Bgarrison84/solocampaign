/**
 * Tests for contextBuilder v2.
 * SESS-06: Character summary format (D-21).
 * SESS-07: Strictness directive + DM personality injection.
 * D-20: Message history from current session (L1).
 * D-14: L1 overflow detection (>24000 chars → fallback to last 30).
 * D-15: L2 session recaps in system prompt.
 * D-16: L3 rolling campaign summary in system prompt.
 * D-17: System prompt injection order.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock repos and referenceDocLoader
vi.mock('../db/charactersRepo', () => ({
  charactersRepo: {
    getByCampaignId: vi.fn(),
  },
}))

vi.mock('../db/messagesRepo', () => ({
  messagesRepo: {
    getLastN: vi.fn().mockReturnValue([]),
    getBySessionId: vi.fn().mockReturnValue([]),
    getLastNForSession: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('../db/sessionsRepo', () => ({
  sessionsRepo: {
    getLastNCompleted: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('./referenceDocLoader', () => ({
  readReferenceDocs: vi.fn().mockReturnValue([]),
}))

import { buildContext, STRICTNESS_DIRECTIVES, abilityMod, formatCharacterSummary } from './contextBuilder'
import { charactersRepo } from '../db/charactersRepo'
import { messagesRepo } from '../db/messagesRepo'
import { sessionsRepo } from '../db/sessionsRepo'
import { readReferenceDocs } from './referenceDocLoader'
import type { CharacterWithResources } from '../db/charactersRepo'
import type { Session } from '../db/schema'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCharacter(overrides: Partial<CharacterWithResources> = {}): CharacterWithResources {
  return {
    id: 'char-1',
    campaignId: 'campaign-1',
    name: 'Aldric the Bold',
    race: 'Human',
    subrace: null,
    class: 'Fighter',
    subclass: null,
    background: 'Soldier',
    level: 1,
    xp: 0,
    backstory: null,
    strength: 16,
    dexterity: 14,
    constitution: 15,
    intelligence: 10,
    wisdom: 12,
    charisma: 8,
    savingThrowProficiencies: [],
    skillProficiencies: [],
    skillExpertise: [],
    languages: [],
    toolProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    ac: 16,
    initiativeBonus: 2,
    speed: 30,
    proficiencyBonus: 2,
    racialTraitsText: null,
    classFeatureText: null,
    backgroundFeatureText: null,
    equipmentPackage: null,
    portraitPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resources: {
      id: 'res-1',
      characterId: 'char-1',
      hpCurrent: 11,
      hpMax: 11,
      hpTemp: 0,
      spellSlots: {},
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 10,
      pp: 0,
      conditions: [],
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      hasInspiration: false,
      concentratingOn: null,
      hitDiceCurrent: null,
      hitDiceTotal: null,
      pactSlots: '{}',
      updatedAt: new Date(),
    },
    items: [],
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    campaignId: 'campaign-1',
    sessionNumber: 1,
    startedAt: new Date(),
    endedAt: new Date(),
    location: null,
    goal: null,
    contextNotes: null,
    aiRecap: null,
    playerNotes: null,
    isSummarized: false,
    ...overrides,
  }
}

describe('contextBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(messagesRepo.getBySessionId).mockReturnValue([])
    vi.mocked(messagesRepo.getLastNForSession).mockReturnValue([])
    vi.mocked(sessionsRepo.getLastNCompleted).mockReturnValue([])
    vi.mocked(readReferenceDocs).mockReturnValue([])
  })

  describe('abilityMod', () => {
    it('calculates correct modifier for various scores', () => {
      expect(abilityMod(10)).toBe('+0')
      expect(abilityMod(16)).toBe('+3')
      expect(abilityMod(8)).toBe('-1')
      expect(abilityMod(20)).toBe('+5')
      expect(abilityMod(1)).toBe('-5')
    })
  })

  describe('buildSystemPrompt includes character name, level, race, and class', () => {
    it('includes character name, level, race, and class', () => {
      const char = makeCharacter()
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(char)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).toContain('Aldric the Bold')
      expect(systemPrompt).toContain('Level 1')
      expect(systemPrompt).toContain('Human')
      expect(systemPrompt).toContain('Fighter')
    })

    it('includes HP, AC, speed, initiative', () => {
      const char = makeCharacter()
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(char)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).toContain('HP: 11/11')
      expect(systemPrompt).toContain('AC: 16')
      expect(systemPrompt).toContain('Speed: 30 ft')
      expect(systemPrompt).toContain('Initiative: +2')
    })

    it('includes strictness directive for "strict" mode', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'strict' },
      })

      expect(systemPrompt).toContain(STRICTNESS_DIRECTIVES.strict)
      expect(systemPrompt).toContain('rules-as-written')
    })

    it('includes strictness directive for "narrative" mode', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'narrative' },
      })

      expect(systemPrompt).toContain(STRICTNESS_DIRECTIVES.narrative)
      expect(systemPrompt).toContain('Rules are flavor')
    })

    it('includes strictness directive for "balanced" mode', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).toContain(STRICTNESS_DIRECTIVES.balanced)
    })

    it('injects DM personality text when provided', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: {
          strictness: 'balanced',
          dmPersonality: 'A grim, world-weary narrator with dark humor.',
        },
      })

      expect(systemPrompt).toContain('A grim, world-weary narrator with dark humor.')
    })

    it('uses generic DM fallback when personality is empty', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced', dmPersonality: '' },
      })

      expect(systemPrompt).toContain('Classic adventure DM')
    })

    it('appends reference doc content when docs selected', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)
      vi.mocked(readReferenceDocs).mockReturnValue([
        { title: 'SRD v5.1', content: '# SRD Content\nRules here.' },
      ])

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: {
          strictness: 'balanced',
          referenceDocs: ['SRD v5.1/SRD v5.1.md'],
        },
      })

      expect(systemPrompt).toContain('=== SRD v5.1 ===')
      expect(systemPrompt).toContain('# SRD Content')
      expect(readReferenceDocs).toHaveBeenCalledWith(['SRD v5.1/SRD v5.1.md'])
    })

    it('returns session messages for context window when sessionId provided', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)
      vi.mocked(messagesRepo.getBySessionId).mockReturnValue([
        { id: '1', campaignId: 'campaign-1', role: 'user', content: 'Hello DM', createdAt: new Date(), sessionId: 'session-1' },
        { id: '2', campaignId: 'campaign-1', role: 'assistant', content: 'Welcome adventurer!', createdAt: new Date(), sessionId: 'session-1' },
      ])

      const { messages } = buildContext({
        campaignId: 'campaign-1',
        sessionId: 'session-1',
        config: { strictness: 'balanced' },
      })

      expect(messagesRepo.getBySessionId).toHaveBeenCalledWith('session-1')
      expect(messages).toHaveLength(2)
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello DM' })
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Welcome adventurer!' })
    })

    it('omits Spell Slots line when character has no spell slots', () => {
      const char = makeCharacter({ resources: { ...makeCharacter().resources, spellSlots: {} } })
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(char)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).not.toContain('Spell Slots:')
    })

    it('renders Active Conditions: None when no conditions active', () => {
      const char = makeCharacter({ resources: { ...makeCharacter().resources, conditions: [] } })
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(char)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).toContain('Active Conditions: None')
    })

    it('renders active conditions as comma-separated list', () => {
      const char = makeCharacter({
        resources: { ...makeCharacter().resources, conditions: ['Poisoned', 'Blinded'] },
      })
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(char)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).toContain('Active Conditions: Poisoned, Blinded')
    })
  })

  describe('formatCharacterSummary', () => {
    it('includes spell slots line when character has spell slots', () => {
      const char = makeCharacter({
        resources: {
          ...makeCharacter().resources,
          spellSlots: {
            '1': { used: 0, max: 2 },
            '2': { used: 1, max: 3 },
          },
        },
      })

      const summary = formatCharacterSummary(char)
      expect(summary).toContain('Spell Slots:')
      expect(summary).toContain('1st: 0/2')
      expect(summary).toContain('2nd: 1/3')
    })

    it('includes subclass in the character line when present', () => {
      const char = makeCharacter({ subclass: 'Battle Master' })
      const summary = formatCharacterSummary(char)
      expect(summary).toContain('Fighter (Battle Master)')
    })
  })

  // ─── ContextBuilder v2 behavior tests ─────────────────────────────────────────
  describe('v2 behavior', () => {
    it('assembles L1 from session messages (getBySessionId) when sessionId is provided', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)
      vi.mocked(messagesRepo.getBySessionId).mockReturnValue([
        { id: 'm1', campaignId: 'campaign-1', role: 'user', content: 'I enter the tavern.', createdAt: new Date(), sessionId: 's1' },
        { id: 'm2', campaignId: 'campaign-1', role: 'assistant', content: 'The tavern is dark.', createdAt: new Date(), sessionId: 's1' },
        { id: 'm3', campaignId: 'campaign-1', role: 'user', content: 'I talk to the innkeeper.', createdAt: new Date(), sessionId: 's1' },
        { id: 'm4', campaignId: 'campaign-1', role: 'assistant', content: 'He shrugs.', createdAt: new Date(), sessionId: 's1' },
        { id: 'm5', campaignId: 'campaign-1', role: 'user', content: 'I order ale.', createdAt: new Date(), sessionId: 's1' },
      ])

      const { messages, isL1Overflow } = buildContext({
        campaignId: 'campaign-1',
        sessionId: 's1',
        config: { strictness: 'balanced' },
      })

      expect(messagesRepo.getBySessionId).toHaveBeenCalledWith('s1')
      expect(messages).toHaveLength(5)
      expect(isL1Overflow).toBe(false)
    })

    it('L1 overflow triggers fallback to getLastNForSession(30) + sets isL1Overflow flag', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      // Create messages that total > 24000 chars
      const longContent = 'x'.repeat(5000)
      const overflowMessages = Array.from({ length: 6 }, (_, i) => ({
        id: `m${i}`,
        campaignId: 'campaign-1',
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: longContent, // 6 * 5000 = 30000 > 24000
        createdAt: new Date(),
        sessionId: 's1',
      }))

      const fallbackMessages = [
        { id: 'f1', campaignId: 'campaign-1', role: 'user' as const, content: 'fallback message', createdAt: new Date(), sessionId: 's1' },
      ]

      vi.mocked(messagesRepo.getBySessionId).mockReturnValue(overflowMessages)
      vi.mocked(messagesRepo.getLastNForSession).mockReturnValue(fallbackMessages)

      const { messages, isL1Overflow } = buildContext({
        campaignId: 'campaign-1',
        sessionId: 's1',
        config: { strictness: 'balanced' },
      })

      expect(isL1Overflow).toBe(true)
      expect(messagesRepo.getLastNForSession).toHaveBeenCalledWith('s1', 30)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({ role: 'user', content: 'fallback message' })
    })

    it('L2 summaries injected with labels (Previous Sessions — Session N:)', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      vi.mocked(sessionsRepo.getLastNCompleted).mockReturnValue([
        makeSession({ id: 'sess-1', sessionNumber: 1, aiRecap: 'The party began their journey.' }),
        makeSession({ id: 'sess-2', sessionNumber: 2, aiRecap: 'They reached the dungeon.' }),
        makeSession({ id: 'sess-3', sessionNumber: 3, aiRecap: 'They defeated the goblin king.' }),
      ])

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      expect(sessionsRepo.getLastNCompleted).toHaveBeenCalledWith('campaign-1', 3)
      expect(systemPrompt).toContain('Previous Sessions — Session')
      expect(systemPrompt).toContain('The party began their journey.')
      expect(systemPrompt).toContain('They reached the dungeon.')
      expect(systemPrompt).toContain('They defeated the goblin king.')
    })

    it('L3 rolling summary injected under "Campaign History So Far:" when present', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: {
          strictness: 'balanced',
          rollingSummary: 'The heroes have been adventuring for three months, defeating many foes.',
        },
      })

      expect(systemPrompt).toContain('Campaign History So Far:')
      expect(systemPrompt).toContain('The heroes have been adventuring for three months, defeating many foes.')
    })

    it('system prompt injection order matches D-17: preamble > ref docs > L3 > L2 > session start context', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)
      vi.mocked(readReferenceDocs).mockReturnValue([
        { title: 'SRD', content: 'Rules content.' },
      ])
      vi.mocked(sessionsRepo.getLastNCompleted).mockReturnValue([
        makeSession({ id: 'sess-1', sessionNumber: 1, aiRecap: 'Session one summary.' }),
      ])

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        sessionContext: { location: 'Tavern', goal: 'Find the map', contextNotes: null },
        config: {
          strictness: 'balanced',
          rollingSummary: 'Campaign history text.',
          referenceDocs: ['SRD/SRD.md'],
        },
      })

      const preamblePos = systemPrompt.indexOf('Dungeon Master')
      const refDocPos = systemPrompt.indexOf('=== SRD ===')
      const l3Pos = systemPrompt.indexOf('Campaign History So Far:')
      const l2Pos = systemPrompt.indexOf('Previous Sessions — Session')
      const sessionCtxPos = systemPrompt.indexOf('Current Session:')

      // All blocks should be present
      expect(preamblePos).toBeGreaterThanOrEqual(0)
      expect(refDocPos).toBeGreaterThanOrEqual(0)
      expect(l3Pos).toBeGreaterThanOrEqual(0)
      expect(l2Pos).toBeGreaterThanOrEqual(0)
      expect(sessionCtxPos).toBeGreaterThanOrEqual(0)

      // Verify injection order
      expect(preamblePos).toBeLessThan(refDocPos)
      expect(refDocPos).toBeLessThan(l3Pos)
      expect(l3Pos).toBeLessThan(l2Pos)
      expect(l2Pos).toBeLessThan(sessionCtxPos)
    })

    it('session start context (location, goal, contextNotes) appears under "Current Session:" label', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        sessionId: 's1',
        sessionContext: {
          location: 'The Misty Mountains',
          goal: 'Recover the ancient artifact',
          contextNotes: 'Party is low on resources',
        },
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).toContain('Current Session:')
      expect(systemPrompt).toContain('Location: The Misty Mountains')
      expect(systemPrompt).toContain('Goal: Recover the ancient artifact')
      expect(systemPrompt).toContain('Notes: Party is low on resources')
    })

    it('falls back to empty messages for L1 when no sessionId is provided (sessionId=null)', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { messages, isL1Overflow } = buildContext({
        campaignId: 'campaign-1',
        sessionId: null,
        config: { strictness: 'balanced' },
      })

      // No session — L1 is empty
      expect(messagesRepo.getBySessionId).not.toHaveBeenCalled()
      expect(messages).toHaveLength(0)
      expect(isL1Overflow).toBe(false)
    })
  })
})
