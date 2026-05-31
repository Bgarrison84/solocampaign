import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

// Must be set before electron mock closes over it
let testDir = ''

// Mock electron before any imports that depend on it
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
    isPackaged: false,
  },
}))

// Migrations directory (relative to this test file, going up to resources/)
const MIGRATIONS_FOLDER = resolve(__dirname, '../../../resources/migrations')

/**
 * Build a fresh in-memory SQLite DB with the real Drizzle schema applied via migrations.
 * Returns both the Drizzle instance and a mock getDb that returns it.
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

describe('charactersRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-repo-test-'))
    vi.resetModules()
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    vi.resetModules()
  })

  async function getRepo() {
    const { db } = makeInMemoryDb()

    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('./index', () => ({
      getDb: () => db,
      db,
    }))

    vi.resetModules()
    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('./index', () => ({
      getDb: () => db,
      db,
    }))

    const { campaignsRepo } = await import('./campaignsRepo')
    const { charactersRepo } = await import('./charactersRepo')

    // Create a test campaign to satisfy FK constraint
    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, charactersRepo, campaign }
  }

  const baseInput = {
    name: 'Aldric the Bold',
    race: 'Human',
    class: 'Fighter',
    background: 'Soldier',
    strength: 16,
    dexterity: 14,
    constitution: 14,
    intelligence: 10,
    wisdom: 12,
    charisma: 8,
    ac: 12,
    initiativeBonus: 2,
    speed: 30,
    calculatedHp: 12,
    spellSlots: {},
    startingGold: 50,
    savingThrowProficiencies: ['strength', 'constitution'],
    skillProficiencies: ['athletics', 'intimidation'],
    languages: ['Common'],
    armorProficiencies: ['light armor', 'medium armor', 'heavy armor', 'shields'],
    weaponProficiencies: ['simple weapons', 'martial weapons'],
  }

  it('createWithResources inserts all 3 tables atomically', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const result = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })

    expect(result.id).toBeDefined()
    expect(result.name).toBe('Aldric the Bold')
    expect(result.resources).toBeDefined()
    expect(result.resources.hpCurrent).toBe(12)
    expect(result.resources.hpMax).toBe(12)
    expect(result.items).toBeDefined()
    expect(Array.isArray(result.items)).toBe(true)
  })

  it('createWithResources with startingItems inserts items rows', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const result = charactersRepo.createWithResources({
      ...baseInput,
      campaignId: campaign.id,
      startingItems: [
        { name: 'Longsword', quantity: 1, weight: 3 },
        { name: 'Shield', quantity: 1, weight: 6 },
      ],
    })

    expect(result.items).toHaveLength(2)
    expect(result.items[0].name).toBe('Longsword')
    expect(result.items[1].name).toBe('Shield')
  })

  it('getWithResources returns parsed objects (spellSlots is object, not string)', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    const fetched = charactersRepo.getWithResources(created.id)!

    expect(typeof fetched.resources.spellSlots).toBe('object')
    expect(typeof fetched.resources.spellSlots).not.toBe('string')
  })

  it('getWithResources returns parsed conditions array', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    const fetched = charactersRepo.getWithResources(created.id)!

    expect(Array.isArray(fetched.resources.conditions)).toBe(true)
    expect(fetched.resources.conditions).toHaveLength(0)
  })

  it('getWithResources returns parsed skillProficiencies array', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    const fetched = charactersRepo.getWithResources(created.id)!

    expect(Array.isArray(fetched.skillProficiencies)).toBe(true)
    expect(fetched.skillProficiencies).toContain('athletics')
  })

  it('updateHp clamped at hpMax: hpCurrent=12, hpMax=12, delta=+5 → 12', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    // HP starts at 12, hpMax=12 → clamp at 12
    charactersRepo.updateHp(created.id, 5)
    const after = charactersRepo.getWithResources(created.id)!
    expect(after.resources.hpCurrent).toBe(12)
  })

  it('updateHp delta: hpCurrent=10, hpMax=20, delta=+5 → 15', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({
      ...baseInput,
      campaignId: campaign.id,
      calculatedHp: 20,
    })
    // Reduce to 10
    charactersRepo.updateHp(created.id, -10)
    let current = charactersRepo.getWithResources(created.id)!
    expect(current.resources.hpCurrent).toBe(10)

    // Now +5 → 15
    charactersRepo.updateHp(created.id, 5)
    current = charactersRepo.getWithResources(created.id)!
    expect(current.resources.hpCurrent).toBe(15)
  })

  it('updateHp delta -100 clamps to 0', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    charactersRepo.updateHp(created.id, -100)
    const after = charactersRepo.getWithResources(created.id)!
    expect(after.resources.hpCurrent).toBe(0)
  })

  it('updateXp delta +300 from 0 → 300', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    expect(created.xp).toBe(0)

    charactersRepo.updateXp(created.id, 300)
    const after = charactersRepo.getWithResources(created.id)!
    expect(after.xp).toBe(300)
  })

  it('updateXp delta -500 from 300 clamps to 0', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    charactersRepo.updateXp(created.id, 300)
    charactersRepo.updateXp(created.id, -500)
    const after = charactersRepo.getWithResources(created.id)!
    expect(after.xp).toBe(0)
  })

  it('toggleCondition adds condition when not present', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    expect(created.resources.conditions).toHaveLength(0)

    charactersRepo.toggleCondition(created.id, 'poisoned')
    const after = charactersRepo.getWithResources(created.id)!
    expect(after.resources.conditions).toContain('poisoned')
  })

  it('toggleCondition removes condition when already present', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    charactersRepo.toggleCondition(created.id, 'poisoned')
    charactersRepo.toggleCondition(created.id, 'poisoned')
    const after = charactersRepo.getWithResources(created.id)!
    expect(after.resources.conditions).not.toContain('poisoned')
    expect(after.resources.conditions).toHaveLength(0)
  })

  it('getByCampaignId returns the character row by FK', async () => {
    const { charactersRepo, campaign } = await getRepo()

    const created = charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })
    const found = charactersRepo.getByCampaignId(campaign.id)!

    expect(found).toBeDefined()
    expect(found.id).toBe(created.id)
    expect(found.campaignId).toBe(campaign.id)
  })

  it('getByCampaignId returns undefined for campaign with no character', async () => {
    const { campaignsRepo, charactersRepo } = await getRepo()

    const emptyCampaign = campaignsRepo.create({ name: 'Empty Campaign' })
    const result = charactersRepo.getByCampaignId(emptyCampaign.id)

    expect(result).toBeUndefined()
  })

  // ─── Phase 7: partySize enforcement + createCompanion (PARTY-01, PARTY-02) ───

  it('createWithResources throws when campaign already has partySize non-companion characters (PARTY-01)', async () => {
    const { db, charactersRepo, campaign } = await getRepo()

    // Set partySize to 1 on the campaign row so the limit is 1
    db.update(schema.campaigns)
      .set({ partySize: 1 })
      .where(eq(schema.campaigns.id, campaign.id))
      .run()

    // First character succeeds
    charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })

    // Second non-companion character must throw (party is full)
    expect(() =>
      charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id }),
    ).toThrow()
  })

  it('createCompanion bypasses partySize check (companions do not count toward party limit)', async () => {
    const { db, charactersRepo, campaign } = await getRepo()

    // Set partySize to 1 — party is full after one player character
    db.update(schema.campaigns)
      .set({ partySize: 1 })
      .where(eq(schema.campaigns.id, campaign.id))
      .run()

    // Create one player character to fill the slot
    charactersRepo.createWithResources({ ...baseInput, campaignId: campaign.id })

    // A companion must succeed even though the party is full
    expect(() =>
      charactersRepo.createCompanion({
        campaignId: campaign.id,
        name: 'Shadowfax',
        type: 'Animal Companion',
        hpMax: 25,
        ac: 13,
      }),
    ).not.toThrow()
  })

  it('createCompanion inserts a characters row with isCompanion=true and a characterResources row', async () => {
    const { db, charactersRepo, campaign } = await getRepo()

    const companion = charactersRepo.createCompanion({
      campaignId: campaign.id,
      name: 'Ember',
      type: 'Familiar',
      hpMax: 10,
      ac: 12,
    })

    expect(companion.id).toBeDefined()
    expect(companion.isCompanion).toBe(true)
    expect(companion.name).toBe('Ember')

    // characterResources row must exist with correct HP
    const res = db
      .select()
      .from(schema.characterResources)
      .where(eq(schema.characterResources.characterId, companion.id))
      .get()
    expect(res).toBeDefined()
    expect(res!.hpMax).toBe(10)
    expect(res!.hpCurrent).toBe(10)

    // AC is stored on the characters row (not characterResources)
    expect(companion.ac).toBe(12)
  })
})
