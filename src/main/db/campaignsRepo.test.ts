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

describe('campaignsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-campaigns-test-'))
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

    return { db, campaignsRepo }
  }

  it('create returns a campaign with id and createdAt', async () => {
    const { campaignsRepo } = await getRepo()

    const campaign = campaignsRepo.create({ name: 'Epic Adventure' })

    expect(campaign.id).toBeDefined()
    expect(campaign.name).toBe('Epic Adventure')
    expect(campaign.createdAt).toBeInstanceOf(Date)
  })

  it('list returns all created campaigns', async () => {
    const { campaignsRepo } = await getRepo()

    campaignsRepo.create({ name: 'Alpha' })
    campaignsRepo.create({ name: 'Beta' })

    const campaigns = campaignsRepo.list()
    expect(campaigns.length).toBeGreaterThanOrEqual(2)
    const names = campaigns.map((c) => c.name)
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
  })

  it('get returns the campaign by id', async () => {
    const { campaignsRepo } = await getRepo()

    const created = campaignsRepo.create({ name: 'Test Get' })
    const fetched = campaignsRepo.get(created.id)

    expect(fetched).toBeDefined()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.name).toBe('Test Get')
  })

  it('get returns undefined for missing id', async () => {
    const { campaignsRepo } = await getRepo()

    expect(campaignsRepo.get('nonexistent-id')).toBeUndefined()
  })

  it('delete removes the campaign', async () => {
    const { campaignsRepo } = await getRepo()

    const campaign = campaignsRepo.create({ name: 'To Delete' })
    campaignsRepo.delete(campaign.id)

    expect(campaignsRepo.get(campaign.id)).toBeUndefined()
  })

  // ── AI Config Round-Trip (SESS-05) ──────────────────────────────────────────

  it('updateAiConfig persists all 8 AI config fields and get() returns them', async () => {
    const { campaignsRepo } = await getRepo()

    const campaign = campaignsRepo.create({ name: 'AI Config Campaign' })

    campaignsRepo.updateAiConfig(campaign.id, {
      providerType: 'openai-compatible',
      endpointUrl: 'http://localhost:1234/v1',
      modelName: 'mistral-7b-instruct',
      referenceDocs: ['SRD_CC_v5.1.md', 'Monsters_SRD.md'],
      dmPersonality: 'A gruff but fair dungeon master',
      strictness: 'strict',
      fallbackEndpointUrl: 'http://localhost:5678/v1',
      fallbackModelName: 'llama-3-8b',
    })

    const fetched = campaignsRepo.get(campaign.id)!
    expect(fetched.providerType).toBe('openai-compatible')
    expect(fetched.endpointUrl).toBe('http://localhost:1234/v1')
    expect(fetched.modelName).toBe('mistral-7b-instruct')
    // referenceDocs is stored as JSON string in DB; parse to verify
    expect(JSON.parse(fetched.referenceDocs)).toEqual(['SRD_CC_v5.1.md', 'Monsters_SRD.md'])
    expect(fetched.dmPersonality).toBe('A gruff but fair dungeon master')
    expect(fetched.strictness).toBe('strict')
    expect(fetched.fallbackEndpointUrl).toBe('http://localhost:5678/v1')
    expect(fetched.fallbackModelName).toBe('llama-3-8b')
  })

  it('updateAiConfig with null optionals stores nulls', async () => {
    const { campaignsRepo } = await getRepo()

    const campaign = campaignsRepo.create({ name: 'Minimal AI Config' })

    campaignsRepo.updateAiConfig(campaign.id, {
      providerType: 'gemini',
      modelName: 'gemini-2.0-flash',
      referenceDocs: [],
      strictness: 'narrative',
    })

    const fetched = campaignsRepo.get(campaign.id)!
    expect(fetched.providerType).toBe('gemini')
    expect(fetched.endpointUrl).toBeNull()
    expect(fetched.modelName).toBe('gemini-2.0-flash')
    expect(JSON.parse(fetched.referenceDocs)).toEqual([])
    expect(fetched.dmPersonality).toBeNull()
    expect(fetched.strictness).toBe('narrative')
    expect(fetched.fallbackEndpointUrl).toBeNull()
    expect(fetched.fallbackModelName).toBeNull()
  })

  it('new campaign has default strictness "balanced" and empty referenceDocs', async () => {
    const { campaignsRepo } = await getRepo()

    const campaign = campaignsRepo.create({ name: 'Fresh Campaign' })
    const fetched = campaignsRepo.get(campaign.id)!

    expect(fetched.strictness).toBe('balanced')
    expect(fetched.referenceDocs).toBe('[]')
    expect(fetched.providerType).toBeNull()
    expect(fetched.modelName).toBeNull()
  })

  it('updateAiConfig does NOT store any api_key field (security: D-08/D-23)', async () => {
    const { campaignsRepo } = await getRepo()

    const campaign = campaignsRepo.create({ name: 'Security Test' })

    // Type system prevents api_key, but let's confirm the DB row shape
    campaignsRepo.updateAiConfig(campaign.id, {
      providerType: 'openai-compatible',
      endpointUrl: 'http://localhost:1234/v1',
      modelName: 'test-model',
    })

    const fetched = campaignsRepo.get(campaign.id)!
    const keys = Object.keys(fetched)

    expect(keys).not.toContain('apiKey')
    expect(keys).not.toContain('api_key')
    expect(keys).not.toContain('fallbackApiKey')
    expect(keys).not.toContain('fallback_api_key')
  })
})
