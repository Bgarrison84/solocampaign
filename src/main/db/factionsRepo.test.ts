/**
 * Tests for factionsRepo (STATE-03).
 * Uses an in-memory SQLite DB with the real Drizzle schema applied via migrations.
 * Mirrors the combatantsRepo/campaignEventsRepo harness.
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

describe('factionsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-factions-test-'))
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

    const { campaignsRepo } = await import('./campaignsRepo')
    const { factionsRepo } = await import('./factionsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, factionsRepo, campaign }
  }

  it('upsert creates a faction with default Neutral tier', async () => {
    const { factionsRepo, campaign } = await getRepo()

    const faction = factionsRepo.upsert({ campaignId: campaign.id, name: 'Harpers' })
    expect(faction.id).toBeTruthy()
    expect(faction.name).toBe('Harpers')
    expect(faction.tier).toBe('Neutral')
  })

  it('upsert twice with same (campaignId, name) yields exactly one row with the latest tier', async () => {
    const { factionsRepo, campaign } = await getRepo()

    factionsRepo.upsert({ campaignId: campaign.id, name: 'Zhentarim', tier: 'Hostile' })
    const updated = factionsRepo.upsert({ campaignId: campaign.id, name: 'Zhentarim', tier: 'Allied' })

    expect(updated.tier).toBe('Allied')
    const list = factionsRepo.list(campaign.id)
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Zhentarim')
    expect(list[0].tier).toBe('Allied')
  })

  it('upsert keeps the same row id across updates (no duplicate)', async () => {
    const { factionsRepo, campaign } = await getRepo()

    const first = factionsRepo.upsert({ campaignId: campaign.id, name: 'Emerald Enclave', tier: 'Neutral' })
    const second = factionsRepo.upsert({ campaignId: campaign.id, name: 'Emerald Enclave', tier: 'Friendly' })
    expect(second.id).toBe(first.id)
  })

  it('the same faction name in two campaigns are distinct rows', async () => {
    const { factionsRepo, campaignsRepo, campaign } = await getRepo()

    const other = campaignsRepo.create({ name: 'Other' })
    factionsRepo.upsert({ campaignId: campaign.id, name: 'Harpers', tier: 'Allied' })
    factionsRepo.upsert({ campaignId: other.id, name: 'Harpers', tier: 'Hostile' })

    expect(factionsRepo.list(campaign.id)).toHaveLength(1)
    expect(factionsRepo.list(other.id)).toHaveLength(1)
    expect(factionsRepo.list(campaign.id)[0].tier).toBe('Allied')
    expect(factionsRepo.list(other.id)[0].tier).toBe('Hostile')
  })

  it('list returns factions ordered by createdAt ASC', async () => {
    const { factionsRepo, campaign } = await getRepo()

    factionsRepo.upsert({ campaignId: campaign.id, name: 'A' })
    factionsRepo.upsert({ campaignId: campaign.id, name: 'B' })
    factionsRepo.upsert({ campaignId: campaign.id, name: 'C' })

    const list = factionsRepo.list(campaign.id)
    expect(list).toHaveLength(3)
    for (let i = 1; i < list.length; i++) {
      expect(list[i].createdAt.getTime()).toBeGreaterThanOrEqual(list[i - 1].createdAt.getTime())
    }
  })
})
