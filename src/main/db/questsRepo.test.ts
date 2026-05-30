/**
 * Tests for questsRepo (STATE-01).
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

describe('questsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-quests-test-'))
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
    const { questsRepo } = await import('./questsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, questsRepo, campaign }
  }

  it('create returns a quest with default Active status and a non-empty id', async () => {
    const { questsRepo, campaign } = await getRepo()

    const quest = questsRepo.create({
      campaignId: campaign.id,
      name: 'Find the amulet',
      description: 'A side quest',
    })

    expect(quest.id).toBeTruthy()
    expect(quest.name).toBe('Find the amulet')
    expect(quest.description).toBe('A side quest')
    expect(quest.status).toBe('Active')
  })

  it('create defaults description to empty string when omitted', async () => {
    const { questsRepo, campaign } = await getRepo()

    const quest = questsRepo.create({ campaignId: campaign.id, name: 'No desc' })
    expect(quest.description).toBe('')
  })

  it('updateStatus changes the row status', async () => {
    const { questsRepo, campaign } = await getRepo()

    const quest = questsRepo.create({ campaignId: campaign.id, name: 'Slay the dragon' })
    questsRepo.updateStatus(quest.id, 'Completed')

    const list = questsRepo.list(campaign.id)
    expect(list).toHaveLength(1)
    expect(list[0].status).toBe('Completed')
  })

  it('list returns quests ordered by createdAt ASC (D-02)', async () => {
    const { questsRepo, campaign } = await getRepo()

    questsRepo.create({ campaignId: campaign.id, name: 'First' })
    questsRepo.create({ campaignId: campaign.id, name: 'Second' })
    questsRepo.create({ campaignId: campaign.id, name: 'Third' })

    const list = questsRepo.list(campaign.id)
    expect(list).toHaveLength(3)
    for (let i = 1; i < list.length; i++) {
      expect(list[i].createdAt.getTime()).toBeGreaterThanOrEqual(list[i - 1].createdAt.getTime())
    }
  })

  it('list does not return quests from other campaigns', async () => {
    const { questsRepo, campaignsRepo, campaign } = await getRepo()

    const other = campaignsRepo.create({ name: 'Other' })
    questsRepo.create({ campaignId: campaign.id, name: 'Mine' })
    questsRepo.create({ campaignId: other.id, name: 'Theirs' })

    const list = questsRepo.list(campaign.id)
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Mine')
  })
})
