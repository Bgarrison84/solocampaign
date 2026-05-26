/**
 * Tests for contextBuilder.
 * SESS-06: Character summary format (D-21).
 * SESS-07: Strictness directive + DM personality injection.
 * D-20: Last 20 messages from messagesRepo.
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
  },
}))

vi.mock('./referenceDocLoader', () => ({
  readReferenceDocs: vi.fn().mockReturnValue([]),
}))

import { buildContext, STRICTNESS_DIRECTIVES, abilityMod, formatCharacterSummary } from './contextBuilder'
import { charactersRepo } from '../db/charactersRepo'
import { messagesRepo } from '../db/messagesRepo'
import { readReferenceDocs } from './referenceDocLoader'
import type { CharacterWithResources } from '../db/charactersRepo'

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
      updatedAt: new Date(),
    },
    items: [],
    ...overrides,
  }
}

describe('contextBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(messagesRepo.getLastN).mockReturnValue([])
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
        config: { strictness: 'strict' },
      })

      expect(systemPrompt).toContain(STRICTNESS_DIRECTIVES.strict)
      expect(systemPrompt).toContain('rules-as-written')
    })

    it('includes strictness directive for "narrative" mode', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        config: { strictness: 'narrative' },
      })

      expect(systemPrompt).toContain(STRICTNESS_DIRECTIVES.narrative)
      expect(systemPrompt).toContain('Rules are flavor')
    })

    it('includes strictness directive for "balanced" mode', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).toContain(STRICTNESS_DIRECTIVES.balanced)
    })

    it('injects DM personality text when provided', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
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
        config: {
          strictness: 'balanced',
          referenceDocs: ['SRD v5.1/SRD v5.1.md'],
        },
      })

      expect(systemPrompt).toContain('=== SRD v5.1 ===')
      expect(systemPrompt).toContain('# SRD Content')
      expect(readReferenceDocs).toHaveBeenCalledWith(['SRD v5.1/SRD v5.1.md'])
    })

    it('returns last 20 messages for context window', () => {
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(undefined)
      vi.mocked(messagesRepo.getLastN).mockReturnValue([
        { id: '1', campaignId: 'campaign-1', role: 'user', content: 'Hello DM', createdAt: new Date() },
        { id: '2', campaignId: 'campaign-1', role: 'assistant', content: 'Welcome adventurer!', createdAt: new Date() },
      ])

      const { messages } = buildContext({
        campaignId: 'campaign-1',
        config: { strictness: 'balanced' },
      })

      expect(messagesRepo.getLastN).toHaveBeenCalledWith('campaign-1', 20)
      expect(messages).toHaveLength(2)
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello DM' })
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Welcome adventurer!' })
    })

    it('omits Spell Slots line when character has no spell slots', () => {
      const char = makeCharacter({ resources: { ...makeCharacter().resources, spellSlots: {} } })
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(char)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
        config: { strictness: 'balanced' },
      })

      expect(systemPrompt).not.toContain('Spell Slots:')
    })

    it('renders Active Conditions: None when no conditions active', () => {
      const char = makeCharacter({ resources: { ...makeCharacter().resources, conditions: [] } })
      vi.mocked(charactersRepo.getByCampaignId).mockReturnValue(char)

      const { systemPrompt } = buildContext({
        campaignId: 'campaign-1',
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
})
