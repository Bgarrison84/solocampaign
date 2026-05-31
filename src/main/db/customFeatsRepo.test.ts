/**
 * Tests for customFeatsRepo (Phase 7 — CHAR-05, RULES-03).
 * Uses an in-memory SQLite DB with the real Drizzle schema applied via migrations.
 * Mirrors the questsRepo/npcsRepo test harness.
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

describe('customFeatsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-customfeats-test-'))
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
    const { customFeatsRepo } = await import('./customFeatsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })

    return { db, campaignsRepo, customFeatsRepo, campaign }
  }

  it('create returns a custom feat with a non-empty id and correct fields', async () => {
    const { customFeatsRepo, campaign } = await getRepo()

    const feat = customFeatsRepo.create({
      campaignId: campaign.id,
      name: 'Shadow Step',
      description: 'Once per turn, teleport to an adjacent shadow.',
    })

    expect(feat.id).toBeTruthy()
    expect(feat.campaignId).toBe(campaign.id)
    expect(feat.name).toBe('Shadow Step')
    expect(feat.description).toBe('Once per turn, teleport to an adjacent shadow.')
  })

  it('listByCampaign returns the created feat', async () => {
    const { customFeatsRepo, campaign } = await getRepo()

    customFeatsRepo.create({
      campaignId: campaign.id,
      name: 'Shadow Step',
      description: 'A custom movement ability.',
    })

    const feats = customFeatsRepo.listByCampaign(campaign.id)
    expect(feats).toHaveLength(1)
    expect(feats[0].name).toBe('Shadow Step')
  })

  it('listByCampaign returns feats in createdAt ASC order', async () => {
    const { customFeatsRepo, campaign } = await getRepo()

    customFeatsRepo.create({ campaignId: campaign.id, name: 'First', description: '' })
    customFeatsRepo.create({ campaignId: campaign.id, name: 'Second', description: '' })

    const feats = customFeatsRepo.listByCampaign(campaign.id)
    expect(feats).toHaveLength(2)
    for (let i = 1; i < feats.length; i++) {
      expect(feats[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        feats[i - 1].createdAt.getTime(),
      )
    }
  })

  it('listByCampaign does not return feats from other campaigns', async () => {
    const { customFeatsRepo, campaignsRepo, campaign } = await getRepo()

    const otherCampaign = campaignsRepo.create({ name: 'Other Campaign' })
    customFeatsRepo.create({ campaignId: campaign.id, name: 'Mine', description: '' })
    customFeatsRepo.create({ campaignId: otherCampaign.id, name: 'Theirs', description: '' })

    const feats = customFeatsRepo.listByCampaign(campaign.id)
    expect(feats).toHaveLength(1)
    expect(feats[0].name).toBe('Mine')
  })

  it('delete removes the feat from the campaign', async () => {
    const { customFeatsRepo, campaign } = await getRepo()

    const feat = customFeatsRepo.create({
      campaignId: campaign.id,
      name: 'Shadow Step',
      description: '',
    })

    customFeatsRepo.delete(feat.id, campaign.id)

    const feats = customFeatsRepo.listByCampaign(campaign.id)
    expect(feats).toHaveLength(0)
  })

  it('delete with wrong campaignId does not delete the feat', async () => {
    const { customFeatsRepo, campaign } = await getRepo()

    const feat = customFeatsRepo.create({
      campaignId: campaign.id,
      name: 'Shadow Step',
      description: '',
    })

    customFeatsRepo.delete(feat.id, 'wrong-campaign-id')

    const feats = customFeatsRepo.listByCampaign(campaign.id)
    expect(feats).toHaveLength(1)
  })
})
