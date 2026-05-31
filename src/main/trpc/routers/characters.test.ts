/**
 * Tests for the characters tRPC router.
 * Uses tRPC v10's router.createCaller({}) API — NOT createCallerFactory (that is v11).
 * Runs against an in-memory SQLite DB with migrations applied.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../../db/schema'

// Must be set before electron mock closes over it
let testDir = ''

// Mock electron before any imports that depend on it
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
    isPackaged: false,
  },
}))

// Migrations directory (relative to this test file)
const MIGRATIONS_FOLDER = resolve(__dirname, '../../../../resources/migrations')

/**
 * Build a fresh in-memory SQLite DB with the real schema via migrations.
 */
function makeInMemoryDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  return { db, sqlite }
}

describe('characters tRPC router', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-trpc-char-test-'))
    vi.resetModules()
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    vi.resetModules()
  })

  /**
   * Build a tRPC router caller with fresh in-memory DB for each test.
   * Uses tRPC v10's router.createCaller({}) (NOT createCallerFactory).
   */
  async function makeRouter() {
    const { db } = makeInMemoryDb()

    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('../../db/index', () => ({
      getDb: () => db,
      db,
    }))

    // Mock fs/promises for getPortraitDataUrl (not needed for most tests)
    vi.doMock('fs/promises', () => ({
      readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    }))

    // Mock contentLoader to avoid needing JSON files on disk in tests
    vi.doMock('../../db/contentLoader', () => ({
      loadContent: vi.fn().mockReturnValue({
        races: [],
        classes: [],
        backgrounds: [],
        equipment: {},
        spellSlotsByClass: {
          cleric: { 1: { '1': 2 } },
          fighter: {},
        },
      }),
    }))

    vi.resetModules()
    // Re-apply mocks after resetModules
    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('../../db/index', () => ({
      getDb: () => db,
      db,
    }))
    vi.doMock('fs/promises', () => ({
      readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    }))
    vi.doMock('../../db/contentLoader', () => ({
      loadContent: vi.fn().mockReturnValue({
        races: [],
        classes: [],
        backgrounds: [],
        equipment: {},
        spellSlotsByClass: {
          cleric: { 1: { '1': 2 } },
          fighter: {},
        },
      }),
    }))

    const { campaignsRepo } = await import('../../db/campaignsRepo')
    const { charactersRouter } = await import('./characters')

    // Create a campaign to satisfy FK constraint
    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    // tRPC v10 API: router.createCaller(ctx)
    const caller = charactersRouter.createCaller({})
    return { caller, campaign, campaignsRepo }
  }

  // Minimal valid character input for tests
  const baseCharInput = {
    name: 'Aldric the Bold',
    race: 'Human',
    class: 'Fighter',
    background: 'Soldier',
    level: 1 as const,
    abilityScores: {
      strength: 16,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    },
    savingThrowProficiencies: ['strength', 'constitution'],
    skillProficiencies: ['athletics', 'intimidation'],
    languages: ['Common'],
    equipmentPackageId: 'fighter-a',
    startingItems: [] as Array<{ name: string; quantity: number; weight: number; isMagic?: boolean }>,
    startingGold: 50,
    traitsText: '',
    classFeatureText: 'Second Wind',
    backgroundFeatureText: 'Military Rank',
    hitDie: 10,
    speed: 30,
  }

  // ─── characters.create ────────────────────────────────────────────────────────

  describe('characters.create', () => {
    it('writes a character to DB and returns CharacterWithResources', async () => {
      const { caller, campaign } = await makeRouter()

      const result = await caller.create({
        ...baseCharInput,
        campaignId: campaign.id,
      })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Aldric the Bold')
      expect(result.resources).toBeDefined()
      expect(result.resources.hpCurrent).toBeGreaterThan(0)
      expect(result.items).toBeDefined()
    })

    it('getByCampaignId returns the created character', async () => {
      const { caller, campaign } = await makeRouter()

      await caller.create({ ...baseCharInput, campaignId: campaign.id })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found).not.toBeNull()
      expect(found?.name).toBe('Aldric the Bold')
    })

    it('rejects malformed input: empty name fails Zod (min 1 char)', async () => {
      const { caller, campaign } = await makeRouter()

      await expect(
        caller.create({ ...baseCharInput, campaignId: campaign.id, name: '' })
      ).rejects.toThrow()
    })

    it('rejects malformed input: ability score below 1 fails Zod', async () => {
      const { caller, campaign } = await makeRouter()

      await expect(
        caller.create({
          ...baseCharInput,
          campaignId: campaign.id,
          abilityScores: { ...baseCharInput.abilityScores, strength: 0 },
        })
      ).rejects.toThrow()
    })

    it('rejects malformed input: ability score above 30 fails Zod', async () => {
      const { caller, campaign } = await makeRouter()

      await expect(
        caller.create({
          ...baseCharInput,
          campaignId: campaign.id,
          abilityScores: { ...baseCharInput.abilityScores, strength: 31 },
        })
      ).rejects.toThrow()
    })

    it('allows a second character in the same campaign (Phase 7 party mode — D-18)', async () => {
      // Phase 7 (PARTY-01, D-18): the uniqueCampaign DB constraint was dropped in migration 0007.
      // Multiple characters per campaign are now allowed up to the campaign's partySize limit.
      // Application-level partySize enforcement lives in charactersRepo (planned for 07-04).
      const { caller, campaign } = await makeRouter()

      const first = await caller.create({ ...baseCharInput, campaignId: campaign.id, name: 'First' })
      const second = await caller.create({ ...baseCharInput, campaignId: campaign.id, name: 'Second' })

      expect(first.id).toBeTruthy()
      expect(second.id).toBeTruthy()
      expect(first.id).not.toBe(second.id)
    })
  })

  // ─── characters.updateHp ─────────────────────────────────────────────────────

  describe('characters.updateHp', () => {
    it('delta +5 from 10 with max 12 → 12 (clamp at hpMax)', async () => {
      const { caller, campaign } = await makeRouter()

      // hitDie=10, CON=14 (mod+2) → HP=12
      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      const charId = character.id

      // HP should be 12 (10 + 2), reduce to 10 first
      await caller.updateHp({ characterId: charId, delta: -2 })
      let current = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(current?.resources.hpCurrent).toBe(10)

      // Now +5 → should clamp at 12 (hpMax)
      await caller.updateHp({ characterId: charId, delta: 5 })
      current = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(current?.resources.hpCurrent).toBe(12)
    })

    it('delta -100 clamps hpCurrent to 0', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await caller.updateHp({ characterId: character.id, delta: -100 })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found?.resources.hpCurrent).toBe(0)
    })

    it('rejects out-of-range delta (> 9999) via Zod', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await expect(
        caller.updateHp({ characterId: character.id, delta: 10000 })
      ).rejects.toThrow()
    })
  })

  // ─── characters.updateXp ─────────────────────────────────────────────────────

  describe('characters.updateXp', () => {
    it('delta +300 from xp=0 → xp=300 persists via getByCampaignId', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await caller.updateXp({ characterId: character.id, delta: 300 })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found?.xp).toBe(300)
    })

    it('delta -500 from xp=300 clamps to 0', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await caller.updateXp({ characterId: character.id, delta: 300 })
      await caller.updateXp({ characterId: character.id, delta: -500 })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found?.xp).toBe(0)
    })

    it('rejects out-of-range delta (> 999999) via Zod', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await expect(
        caller.updateXp({ characterId: character.id, delta: 10_000_000 })
      ).rejects.toThrow()
    })
  })

  // ─── characters.toggleCondition ──────────────────────────────────────────────

  describe('characters.toggleCondition', () => {
    it("adds 'poisoned' condition and persists via getByCampaignId", async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await caller.toggleCondition({ characterId: character.id, condition: 'poisoned' })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found?.resources.conditions).toContain('poisoned')
    })

    it("removes 'poisoned' when called again (toggle semantics)", async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await caller.toggleCondition({ characterId: character.id, condition: 'poisoned' })
      await caller.toggleCondition({ characterId: character.id, condition: 'poisoned' })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found?.resources.conditions).not.toContain('poisoned')
    })

    it('rejects unknown condition name not in the 14-condition enum', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      await expect(
        caller.toggleCondition({ characterId: character.id, condition: 'cursed' as any })
      ).rejects.toThrow()
    })
  })

  // ─── characters.toggleItemAttuned ────────────────────────────────────────────

  describe('characters.toggleItemAttuned', () => {
    it('flips isAttuned from false to true and persists', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({
        ...baseCharInput,
        campaignId: campaign.id,
        startingItems: [{ name: 'Magic Sword', quantity: 1, weight: 3, isMagic: true }],
      })

      const item = character.items[0]
      expect(item.isAttuned).toBe(false)

      await caller.toggleItemAttuned({ itemId: item.id })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found?.items[0].isAttuned).toBe(true)
    })
  })

  // ─── characters.toggleInspiration ────────────────────────────────────────────

  describe('characters.toggleInspiration', () => {
    it('flips hasInspiration from false to true', async () => {
      const { caller, campaign } = await makeRouter()

      const character = await caller.create({ ...baseCharInput, campaignId: campaign.id })
      expect(character.resources.hasInspiration).toBe(false)

      await caller.toggleInspiration({ characterId: character.id })

      const found = await caller.getByCampaignId({ campaignId: campaign.id })
      expect(found?.resources.hasInspiration).toBe(true)
    })
  })
})
