import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
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

describe('messagesRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-msg-test-'))
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
    const { messagesRepo } = await import('./messagesRepo')

    // Create a test campaign to satisfy FK constraint
    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, messagesRepo, campaign }
  }

  it('insert creates a message row and returns it with id + createdAt', async () => {
    const { messagesRepo, campaign } = await getRepo()

    const msg = messagesRepo.insert({
      campaignId: campaign.id,
      role: 'user',
      content: 'Hello, dungeon master!',
    })

    expect(msg.id).toBeDefined()
    expect(msg.campaignId).toBe(campaign.id)
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('Hello, dungeon master!')
    expect(msg.createdAt).toBeInstanceOf(Date)
  })

  it('insert creates an assistant message', async () => {
    const { messagesRepo, campaign } = await getRepo()

    const msg = messagesRepo.insert({
      campaignId: campaign.id,
      role: 'assistant',
      content: 'The tavern is dark and smoky...',
    })

    expect(msg.role).toBe('assistant')
    expect(msg.content).toBe('The tavern is dark and smoky...')
  })

  it('getLastN returns messages in chronological order (ascending created_at)', async () => {
    const { messagesRepo, campaign } = await getRepo()

    messagesRepo.insert({ campaignId: campaign.id, role: 'user', content: 'First' })
    messagesRepo.insert({ campaignId: campaign.id, role: 'assistant', content: 'Second' })
    messagesRepo.insert({ campaignId: campaign.id, role: 'user', content: 'Third' })

    const msgs = messagesRepo.getLastN(campaign.id, 10)

    expect(msgs).toHaveLength(3)
    expect(msgs[0].content).toBe('First')
    expect(msgs[1].content).toBe('Second')
    expect(msgs[2].content).toBe('Third')
  })

  it('getLastN limits to n messages (returns the most recent n in chrono order)', async () => {
    const { messagesRepo, campaign } = await getRepo()

    for (let i = 1; i <= 5; i++) {
      messagesRepo.insert({
        campaignId: campaign.id,
        role: i % 2 === 0 ? 'assistant' : 'user',
        content: `Message ${i}`,
      })
    }

    const msgs = messagesRepo.getLastN(campaign.id, 3)

    expect(msgs).toHaveLength(3)
    // Should be the last 3 (messages 3, 4, 5) in chronological order
    expect(msgs[0].content).toBe('Message 3')
    expect(msgs[1].content).toBe('Message 4')
    expect(msgs[2].content).toBe('Message 5')
  })

  it('getLastN returns empty array when no messages exist', async () => {
    const { messagesRepo, campaign } = await getRepo()

    const msgs = messagesRepo.getLastN(campaign.id, 20)
    expect(msgs).toHaveLength(0)
  })

  it('getLastN is scoped to campaign — does not return other campaign messages', async () => {
    const { campaignsRepo, messagesRepo, campaign } = await getRepo()

    const otherCampaign = campaignsRepo.create({ name: 'Other Campaign' })

    messagesRepo.insert({ campaignId: campaign.id, role: 'user', content: 'Mine' })
    messagesRepo.insert({ campaignId: otherCampaign.id, role: 'user', content: 'Not mine' })

    const msgs = messagesRepo.getLastN(campaign.id, 10)

    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('Mine')
  })

  it('cascade delete: deleting campaign removes its messages', async () => {
    const { campaignsRepo, messagesRepo, campaign } = await getRepo()

    messagesRepo.insert({ campaignId: campaign.id, role: 'user', content: 'Will be deleted' })
    messagesRepo.insert({ campaignId: campaign.id, role: 'assistant', content: 'Also deleted' })

    expect(messagesRepo.getLastN(campaign.id, 10)).toHaveLength(2)

    campaignsRepo.delete(campaign.id)

    expect(messagesRepo.getLastN(campaign.id, 10)).toHaveLength(0)
  })

  it('getByCampaignId returns all messages in chronological order', async () => {
    const { messagesRepo, campaign } = await getRepo()

    messagesRepo.insert({ campaignId: campaign.id, role: 'user', content: 'Alpha' })
    messagesRepo.insert({ campaignId: campaign.id, role: 'assistant', content: 'Beta' })

    const all = messagesRepo.getByCampaignId(campaign.id)

    expect(all).toHaveLength(2)
    expect(all[0].content).toBe('Alpha')
    expect(all[1].content).toBe('Beta')
  })
})
