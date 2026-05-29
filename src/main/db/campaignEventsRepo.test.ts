/**
 * Tests for campaignEventsRepo (STATE-05).
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

describe('campaignEventsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-events-test-'))
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
    const { campaignEventsRepo } = await import('./campaignEventsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, campaignEventsRepo, campaign }
  }

  it('insert then listByCampaign returns the event with matching eventType and payload', async () => {
    const { campaignEventsRepo, campaign } = await getRepo()

    campaignEventsRepo.insert({
      campaignId: campaign.id,
      eventType: 'hp_change',
      payload: JSON.stringify({ delta: -3 }),
    })

    const events = campaignEventsRepo.listByCampaign(campaign.id)
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('hp_change')
    expect(JSON.parse(events[0].payload)).toEqual({ delta: -3 })
  })

  it('listByCampaign respects limit and desc createdAt (insertion) ordering', async () => {
    const { campaignEventsRepo, campaign } = await getRepo()

    campaignEventsRepo.insert({ campaignId: campaign.id, eventType: 'first', payload: '{}' })
    campaignEventsRepo.insert({ campaignId: campaign.id, eventType: 'second', payload: '{}' })
    campaignEventsRepo.insert({ campaignId: campaign.id, eventType: 'third', payload: '{}' })

    // Newest-first ordering: the most recently inserted event comes first.
    const all = campaignEventsRepo.listByCampaign(campaign.id)
    expect(all.map((e) => e.eventType)).toEqual(['third', 'second', 'first'])

    // Limit caps the result count, returning the newest N.
    const limited = campaignEventsRepo.listByCampaign(campaign.id, 2)
    expect(limited).toHaveLength(2)
    expect(limited.map((e) => e.eventType)).toEqual(['third', 'second'])
  })
})
