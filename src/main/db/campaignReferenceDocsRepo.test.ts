/**
 * Tests for campaignReferenceDocsRepo (Phase 7 — RULES-04, WORLD-01).
 * Uses an in-memory SQLite DB with the real Drizzle schema applied via migrations.
 * Mirrors the questsRepo/npcsRepo test harness.
 *
 * Key assertion: content is capped at 50,000 chars at storage time (Pitfall 7).
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

describe('campaignReferenceDocsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-refdocs-test-'))
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
    const { campaignReferenceDocsRepo } = await import('./campaignReferenceDocsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, campaignReferenceDocsRepo, campaign }
  }

  it('create returns a reference doc with a non-empty id and correct fields', async () => {
    const { campaignReferenceDocsRepo, campaign } = await getRepo()

    const doc = campaignReferenceDocsRepo.create({
      campaignId: campaign.id,
      filename: 'homebrew-rules.txt',
      content: 'Some custom rules content here.',
    })

    expect(doc.id).toBeTruthy()
    expect(doc.campaignId).toBe(campaign.id)
    expect(doc.filename).toBe('homebrew-rules.txt')
    expect(doc.content).toBe('Some custom rules content here.')
  })

  it('create caps content at 50,000 chars (Pitfall 7 — DoS prevention)', async () => {
    const { campaignReferenceDocsRepo, campaign } = await getRepo()

    // Create a 60,000-char string and verify it is stored at exactly 50,000 chars
    const oversizedContent = 'A'.repeat(60_000)
    expect(oversizedContent.length).toBe(60_000)

    const doc = campaignReferenceDocsRepo.create({
      campaignId: campaign.id,
      filename: 'large-document.pdf',
      content: oversizedContent,
    })

    expect(doc.content.length).toBe(50_000)
  })

  it('create stores content under 50,000 chars unchanged', async () => {
    const { campaignReferenceDocsRepo, campaign } = await getRepo()

    const shortContent = 'Short content.'
    const doc = campaignReferenceDocsRepo.create({
      campaignId: campaign.id,
      filename: 'short.txt',
      content: shortContent,
    })

    expect(doc.content).toBe(shortContent)
    expect(doc.content.length).toBe(shortContent.length)
  })

  it('list returns the created doc', async () => {
    const { campaignReferenceDocsRepo, campaign } = await getRepo()

    campaignReferenceDocsRepo.create({
      campaignId: campaign.id,
      filename: 'rules.txt',
      content: 'Custom rules.',
    })

    const docs = campaignReferenceDocsRepo.list(campaign.id)
    expect(docs).toHaveLength(1)
    expect(docs[0].filename).toBe('rules.txt')
  })

  it('list returns docs in createdAt ASC order', async () => {
    const { campaignReferenceDocsRepo, campaign } = await getRepo()

    campaignReferenceDocsRepo.create({ campaignId: campaign.id, filename: 'first.txt', content: '' })
    campaignReferenceDocsRepo.create({ campaignId: campaign.id, filename: 'second.txt', content: '' })

    const docs = campaignReferenceDocsRepo.list(campaign.id)
    expect(docs).toHaveLength(2)
    for (let i = 1; i < docs.length; i++) {
      expect(docs[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        docs[i - 1].createdAt.getTime(),
      )
    }
  })

  it('list does not return docs from other campaigns', async () => {
    const { campaignReferenceDocsRepo, campaignsRepo, campaign } = await getRepo()

    const otherCampaign = campaignsRepo.create({ name: 'Other Campaign' })
    campaignReferenceDocsRepo.create({ campaignId: campaign.id, filename: 'mine.txt', content: '' })
    campaignReferenceDocsRepo.create({
      campaignId: otherCampaign.id,
      filename: 'theirs.txt',
      content: '',
    })

    const docs = campaignReferenceDocsRepo.list(campaign.id)
    expect(docs).toHaveLength(1)
    expect(docs[0].filename).toBe('mine.txt')
  })

  it('delete removes the doc', async () => {
    const { campaignReferenceDocsRepo, campaign } = await getRepo()

    const doc = campaignReferenceDocsRepo.create({
      campaignId: campaign.id,
      filename: 'rules.txt',
      content: 'content',
    })

    campaignReferenceDocsRepo.delete(doc.id, campaign.id)

    const docs = campaignReferenceDocsRepo.list(campaign.id)
    expect(docs).toHaveLength(0)
  })

  it('delete with wrong campaignId does not delete the doc', async () => {
    const { campaignReferenceDocsRepo, campaign } = await getRepo()

    const doc = campaignReferenceDocsRepo.create({
      campaignId: campaign.id,
      filename: 'rules.txt',
      content: 'content',
    })

    campaignReferenceDocsRepo.delete(doc.id, 'wrong-campaign-id')

    const docs = campaignReferenceDocsRepo.list(campaign.id)
    expect(docs).toHaveLength(1)
  })
})
