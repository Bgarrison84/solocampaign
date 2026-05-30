/**
 * Tests for npcsRepo (STATE-02).
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

describe('npcsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-npcs-test-'))
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
    const { npcsRepo } = await import('./npcsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, npcsRepo, campaign }
  }

  it('create returns an NPC with defaults (Unknown relationship, null faction)', async () => {
    const { npcsRepo, campaign } = await getRepo()

    const npc = npcsRepo.create({
      campaignId: campaign.id,
      name: 'Gundren',
      description: 'A dwarf merchant',
    })

    expect(npc.id).toBeTruthy()
    expect(npc.name).toBe('Gundren')
    expect(npc.description).toBe('A dwarf merchant')
    expect(npc.relationship).toBe('Unknown')
    expect(npc.factionName).toBeNull()
  })

  it('create accepts an explicit relationship and factionName', async () => {
    const { npcsRepo, campaign } = await getRepo()

    const npc = npcsRepo.create({
      campaignId: campaign.id,
      name: 'Sildar',
      relationship: 'Friendly',
      factionName: 'Lords Alliance',
    })

    expect(npc.relationship).toBe('Friendly')
    expect(npc.factionName).toBe('Lords Alliance')
  })

  it('patch updates only provided fields, leaving others unchanged', async () => {
    const { npcsRepo, campaign } = await getRepo()

    const npc = npcsRepo.create({
      campaignId: campaign.id,
      name: 'Iarno',
      description: 'A wizard',
      relationship: 'Neutral',
    })

    npcsRepo.patch(npc.id, { relationship: 'Hostile' })

    const list = npcsRepo.list(campaign.id)
    expect(list).toHaveLength(1)
    expect(list[0].relationship).toBe('Hostile')
    // description must be untouched
    expect(list[0].description).toBe('A wizard')
  })

  it('patch with no fields is a no-op', async () => {
    const { npcsRepo, campaign } = await getRepo()

    const npc = npcsRepo.create({
      campaignId: campaign.id,
      name: 'Toblen',
      description: 'Shopkeeper',
    })

    npcsRepo.patch(npc.id, {})

    const list = npcsRepo.list(campaign.id)
    expect(list[0].description).toBe('Shopkeeper')
    expect(list[0].relationship).toBe('Unknown')
  })

  it('list returns NPCs ordered by createdAt ASC (D-06)', async () => {
    const { npcsRepo, campaign } = await getRepo()

    npcsRepo.create({ campaignId: campaign.id, name: 'First' })
    npcsRepo.create({ campaignId: campaign.id, name: 'Second' })
    npcsRepo.create({ campaignId: campaign.id, name: 'Third' })

    const list = npcsRepo.list(campaign.id)
    expect(list).toHaveLength(3)
    for (let i = 1; i < list.length; i++) {
      expect(list[i].createdAt.getTime()).toBeGreaterThanOrEqual(list[i - 1].createdAt.getTime())
    }
  })
})
