import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Must be set before electron mock closes over it
let testDir = ''

// Mock electron before any imports that use it
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
    isPackaged: false,
  },
}))

// Minimal valid content fixtures
const minimalRace = {
  id: 'human',
  name: 'Human',
  size: 'Medium',
  speed: 30,
  abilityScoreIncreases: [],
  traits: [],
  languages: ['Common'],
  source: 'test',
}

const minimalClass = {
  id: 'fighter',
  name: 'Fighter',
  hitDie: 10,
  primaryAbility: ['strength'],
  savingThrowProficiencies: ['strength', 'constitution'],
  armorProficiencies: ['all armor'],
  weaponProficiencies: ['simple', 'martial'],
  toolProficiencies: [],
  skillChoiceCount: 2,
  skillChoices: ['athletics', 'acrobatics'],
  startingEquipmentPackages: [],
  level1Features: [{ name: 'Fighting Style', description: 'Choose a fighting style.' }],
  spellcaster: false,
  choosesSubclassAtLevel1: false,
  source: 'test',
}

const minimalBackground = {
  id: 'acolyte',
  name: 'Acolyte',
  skillProficiencies: ['insight', 'religion'],
  toolProficiencies: [],
  languages: [],
  feature: { name: 'Shelter of the Faithful', description: 'You have shelter in temples.' },
  suggestedPersonalityTraits: [],
  suggestedIdeals: [],
  suggestedBonds: [],
  suggestedFlaws: [],
  startingEquipment: [],
  startingGold: 15,
  source: 'test',
}

const minimalEquipment = {
  fighter: [
    {
      id: 'fighter-a',
      label: 'Option A: Chain mail and a shield',
      items: [{ name: 'Chain mail', quantity: 1, weight: 55 }],
    },
  ],
}

const minimalSpellSlotsByClass = {
  cleric: {
    1: { '1': 2 },
    2: { '1': 3 },
  },
}

function makeReadFileSync(data: Record<string, unknown>) {
  return vi.fn((filePath: string) => {
    const fileName = filePath.replace(/\\/g, '/').split('/').pop()!
    if (fileName in data) return JSON.stringify(data[fileName])
    throw new Error(`ENOENT: no such file or directory: ${filePath}`)
  })
}

const fileData = {
  'races.json': [minimalRace],
  'classes.json': [minimalClass],
  'backgrounds.json': [minimalBackground],
  'equipment.json': minimalEquipment,
  'spells-by-class.json': minimalSpellSlotsByClass,
}

describe('contentLoader', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-content-test-'))
    vi.resetModules()
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    vi.resetModules()
  })

  async function loadFresh(readFileSync: ReturnType<typeof vi.fn>) {
    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('node:fs', () => ({
      default: { readFileSync },
    }))
    vi.resetModules()
    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('node:fs', () => ({
      default: { readFileSync },
    }))
    const { loadContent, _resetContentCache } = await import('./contentLoader')
    _resetContentCache()
    return { loadContent, _resetContentCache }
  }

  it('loadContent returns an object with required keys', async () => {
    const readFileSync = makeReadFileSync(fileData)
    const { loadContent } = await loadFresh(readFileSync)

    const content = loadContent()

    expect(content).toHaveProperty('races')
    expect(content).toHaveProperty('classes')
    expect(content).toHaveProperty('backgrounds')
    expect(content).toHaveProperty('equipment')
    expect(content).toHaveProperty('spellSlotsByClass')
  })

  it('loadContent returns arrays for races, classes, backgrounds', async () => {
    const readFileSync = makeReadFileSync(fileData)
    const { loadContent } = await loadFresh(readFileSync)

    const content = loadContent()

    expect(Array.isArray(content.races)).toBe(true)
    expect(Array.isArray(content.classes)).toBe(true)
    expect(Array.isArray(content.backgrounds)).toBe(true)
    expect(content.races[0].id).toBe('human')
    expect(content.classes[0].id).toBe('fighter')
  })

  it('loadContent returns the same cached instance on second call', async () => {
    const readFileSync = makeReadFileSync(fileData)
    const { loadContent } = await loadFresh(readFileSync)

    const first = loadContent()
    const second = loadContent()

    // Same reference — cache hit
    expect(first).toBe(second)
    // readFileSync called only once per file (5 files total)
    expect(readFileSync).toHaveBeenCalledTimes(5)
  })

  it('loadContent throws and logs when a file is missing', async () => {
    const mockLog = { error: vi.fn(), info: vi.fn() }

    vi.doMock('electron-log', () => ({ default: mockLog }))
    vi.doMock('node:fs', () => ({
      default: {
        readFileSync: vi.fn(() => {
          throw new Error('ENOENT: no such file')
        }),
      },
    }))
    vi.resetModules()
    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('electron-log', () => ({ default: mockLog }))
    vi.doMock('node:fs', () => ({
      default: {
        readFileSync: vi.fn(() => {
          throw new Error('ENOENT: no such file')
        }),
      },
    }))

    const { loadContent, _resetContentCache } = await import('./contentLoader')
    _resetContentCache()

    expect(() => loadContent()).toThrow('ENOENT: no such file')
    expect(mockLog.error).toHaveBeenCalledWith(
      '[contentLoader] failed to load content JSON:',
      expect.any(Error),
    )
  })
})
