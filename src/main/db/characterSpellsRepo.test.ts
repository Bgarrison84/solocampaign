/**
 * Tests for characterSpellsRepo (CHAR-08).
 * Uses an in-memory SQLite DB with the real Drizzle schema applied via migrations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

let testDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
    isPackaged: false,
  },
}))

const MIGRATIONS_FOLDER = resolve(__dirname, '../../../resources/migrations')

function makeInMemoryDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  return { db, sqlite }
}

const baseCharacter = {
  name: 'Elara the Wise',
  race: 'Human',
  class: 'Wizard',
  background: 'Sage',
  strength: 8,
  dexterity: 14,
  constitution: 13,
  intelligence: 16,
  wisdom: 12,
  charisma: 10,
  ac: 12,
  initiativeBonus: 2,
  speed: 30,
  calculatedHp: 8,
  spellSlots: { '1': { used: 0, max: 2 } },
  startingGold: 50,
  savingThrowProficiencies: ['intelligence', 'wisdom'],
  skillProficiencies: ['arcana', 'history'],
  languages: ['Common'],
  armorProficiencies: [],
  weaponProficiencies: ['daggers'],
}

describe('characterSpellsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-spells-test-'))
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
    vi.doMock('./index', () => ({ getDb: () => db, db }))

    vi.resetModules()
    vi.doMock('electron', () => ({
      app: { getPath: vi.fn(() => testDir), isPackaged: false },
    }))
    vi.doMock('./index', () => ({ getDb: () => db, db }))

    const { campaignsRepo } = await import('./campaignsRepo')
    const { charactersRepo } = await import('./charactersRepo')
    const { characterSpellsRepo } = await import('./characterSpellsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })
    const character = charactersRepo.createWithResources({ ...baseCharacter, campaignId: campaign.id })

    return { db, characterSpellsRepo, campaign, character }
  }

  it('seed inserts the given spells', async () => {
    const { characterSpellsRepo, character } = await getRepo()

    characterSpellsRepo.seed(character.id, [
      { spellName: 'Magic Missile', spellLevel: 1, isPrepared: true },
      { spellName: 'Fire Bolt', spellLevel: 0, isPrepared: true },
    ])

    const spells = characterSpellsRepo.listByCharacter(character.id)
    expect(spells).toHaveLength(2)
    expect(spells.map((s) => s.spellName).sort()).toEqual(['Fire Bolt', 'Magic Missile'])
  })

  it('seed called twice replaces (no duplicates)', async () => {
    const { characterSpellsRepo, character } = await getRepo()

    characterSpellsRepo.seed(character.id, [
      { spellName: 'Magic Missile', spellLevel: 1, isPrepared: true },
      { spellName: 'Shield', spellLevel: 1, isPrepared: true },
    ])
    characterSpellsRepo.seed(character.id, [
      { spellName: 'Fire Bolt', spellLevel: 0, isPrepared: true },
    ])

    const spells = characterSpellsRepo.listByCharacter(character.id)
    expect(spells).toHaveLength(1)
    expect(spells[0].spellName).toBe('Fire Bolt')
  })

  it('listByCharacter returns spells ordered by spellLevel ascending', async () => {
    const { characterSpellsRepo, character } = await getRepo()

    characterSpellsRepo.seed(character.id, [
      { spellName: 'Fireball', spellLevel: 3, isPrepared: true },
      { spellName: 'Fire Bolt', spellLevel: 0, isPrepared: true },
      { spellName: 'Magic Missile', spellLevel: 1, isPrepared: true },
    ])

    const spells = characterSpellsRepo.listByCharacter(character.id)
    expect(spells.map((s) => s.spellLevel)).toEqual([0, 1, 3])
  })
})
