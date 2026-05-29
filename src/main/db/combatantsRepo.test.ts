/**
 * Tests for combatantsRepo (COMB-02).
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

describe('combatantsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-combat-test-'))
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
    const { combatantsRepo } = await import('./combatantsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, combatantsRepo, campaign }
  }

  const baseCombatant = {
    name: 'Goblin',
    hpMax: 14,
    ac: 13,
    initiative: 12,
    initiativeOrder: 0,
    isPlayer: false,
  }

  it('create returns a combatant with hpCurrent === hpMax and isActive true', async () => {
    const { combatantsRepo, campaign } = await getRepo()

    const combatant = combatantsRepo.create({ ...baseCombatant, campaignId: campaign.id })

    expect(combatant.id).toBeDefined()
    expect(combatant.name).toBe('Goblin')
    expect(combatant.hpCurrent).toBe(14)
    expect(combatant.hpMax).toBe(14)
    expect(combatant.isActive).toBe(true)
    expect(combatant.conditions).toBe('[]')
  })

  it('listActive returns created combatants in initiativeOrder', async () => {
    const { combatantsRepo, campaign } = await getRepo()

    combatantsRepo.create({ ...baseCombatant, name: 'Second', initiativeOrder: 2, campaignId: campaign.id })
    combatantsRepo.create({ ...baseCombatant, name: 'First', initiativeOrder: 1, campaignId: campaign.id })

    const list = combatantsRepo.listActive(campaign.id)
    expect(list).toHaveLength(2)
    expect(list.map((c) => c.name)).toEqual(['First', 'Second'])
  })

  it('updateHp changes hpCurrent', async () => {
    const { combatantsRepo, campaign } = await getRepo()

    const combatant = combatantsRepo.create({ ...baseCombatant, campaignId: campaign.id })
    combatantsRepo.updateHp(combatant.id, 5)

    const list = combatantsRepo.listActive(campaign.id)
    expect(list[0].hpCurrent).toBe(5)
  })

  it('endCombat sets all to inactive so listActive returns empty', async () => {
    const { combatantsRepo, campaign } = await getRepo()

    combatantsRepo.create({ ...baseCombatant, name: 'A', campaignId: campaign.id })
    combatantsRepo.create({ ...baseCombatant, name: 'B', campaignId: campaign.id })
    expect(combatantsRepo.listActive(campaign.id)).toHaveLength(2)

    combatantsRepo.endCombat(campaign.id)
    expect(combatantsRepo.listActive(campaign.id)).toHaveLength(0)
  })
})
