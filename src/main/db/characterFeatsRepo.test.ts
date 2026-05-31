/**
 * Tests for characterFeatsRepo (Phase 7 — CHAR-05).
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
import { eq } from 'drizzle-orm'
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

// Minimal character input for test fixtures
const baseCharInput = {
  name: 'Aldric the Bold',
  race: 'Human',
  class: 'Fighter',
  background: 'Soldier',
  strength: 16,
  dexterity: 14,
  constitution: 14,
  intelligence: 10,
  wisdom: 12,
  charisma: 8,
  ac: 14,
  initiativeBonus: 2,
  speed: 30,
  calculatedHp: 12,
  spellSlots: {},
  startingGold: 50,
  savingThrowProficiencies: ['strength', 'constitution'],
  skillProficiencies: ['athletics'],
  languages: ['Common'],
  armorProficiencies: [],
  weaponProficiencies: [],
}

describe('characterFeatsRepo', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-charfeats-test-'))
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
    const { charactersRepo } = await import('./charactersRepo')
    const { characterFeatsRepo } = await import('./characterFeatsRepo')

    const campaign = campaignsRepo.create({ name: 'Test Campaign' })
    const character = charactersRepo.createWithResources({
      ...baseCharInput,
      campaignId: campaign.id,
    })

    return { db, campaignsRepo, charactersRepo, characterFeatsRepo, campaign, character }
  }

  it('add returns a feat with a non-empty id and correct fields', async () => {
    const { characterFeatsRepo, character } = await getRepo()

    const feat = characterFeatsRepo.add({
      characterId: character.id,
      featName: 'Alert',
      featSource: 'srd',
    })

    expect(feat.id).toBeTruthy()
    expect(feat.characterId).toBe(character.id)
    expect(feat.featName).toBe('Alert')
    expect(feat.featSource).toBe('srd')
    expect(feat.customFeatId).toBeNull()
  })

  it('listByCharacter returns the feat after adding', async () => {
    const { characterFeatsRepo, character } = await getRepo()

    characterFeatsRepo.add({
      characterId: character.id,
      featName: 'Great Weapon Master',
      featSource: 'srd',
    })

    const feats = characterFeatsRepo.listByCharacter(character.id)
    expect(feats).toHaveLength(1)
    expect(feats[0].featName).toBe('Great Weapon Master')
  })

  it('listByCharacter returns feats in createdAt ASC order', async () => {
    const { characterFeatsRepo, character } = await getRepo()

    characterFeatsRepo.add({ characterId: character.id, featName: 'Alert', featSource: 'srd' })
    characterFeatsRepo.add({ characterId: character.id, featName: 'Lucky', featSource: 'srd' })
    characterFeatsRepo.add({
      characterId: character.id,
      featName: 'Tough',
      featSource: 'srd',
    })

    const feats = characterFeatsRepo.listByCharacter(character.id)
    expect(feats).toHaveLength(3)
    for (let i = 1; i < feats.length; i++) {
      expect(feats[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        feats[i - 1].createdAt.getTime(),
      )
    }
  })

  it('remove deletes the feat', async () => {
    const { characterFeatsRepo, character } = await getRepo()

    const feat = characterFeatsRepo.add({
      characterId: character.id,
      featName: 'Alert',
      featSource: 'srd',
    })

    characterFeatsRepo.remove(feat.id, character.id)

    const feats = characterFeatsRepo.listByCharacter(character.id)
    expect(feats).toHaveLength(0)
  })

  it('remove with wrong characterId does not delete the feat', async () => {
    const { characterFeatsRepo, character } = await getRepo()

    const feat = characterFeatsRepo.add({
      characterId: character.id,
      featName: 'Alert',
      featSource: 'srd',
    })

    characterFeatsRepo.remove(feat.id, 'wrong-char-id')

    const feats = characterFeatsRepo.listByCharacter(character.id)
    expect(feats).toHaveLength(1)
  })

  it('supports epic_boon feat source', async () => {
    const { characterFeatsRepo, character } = await getRepo()

    const feat = characterFeatsRepo.add({
      characterId: character.id,
      featName: 'Boon of Combat Prowess',
      featSource: 'epic_boon',
    })

    expect(feat.featSource).toBe('epic_boon')
  })

  it('listByCharacter does not return feats from other characters', async () => {
    const { db, characterFeatsRepo, charactersRepo, campaign, character } = await getRepo()

    // Set partySize to 2 so a second character can be created (Phase 7 party mode, PARTY-01)
    db.update(schema.campaigns).set({ partySize: 2 }).where(eq(schema.campaigns.id, campaign.id)).run()

    const otherChar = charactersRepo.createWithResources({
      ...baseCharInput,
      name: 'Other Hero',
      campaignId: campaign.id,
    })

    characterFeatsRepo.add({ characterId: character.id, featName: 'Mine', featSource: 'srd' })
    characterFeatsRepo.add({
      characterId: otherChar.id,
      featName: 'Theirs',
      featSource: 'srd',
    })

    const feats = characterFeatsRepo.listByCharacter(character.id)
    expect(feats).toHaveLength(1)
    expect(feats[0].featName).toBe('Mine')
  })
})
