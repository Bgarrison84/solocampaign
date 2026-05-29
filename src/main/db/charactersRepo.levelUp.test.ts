/**
 * TDD tests for charactersRepo.levelUp and applyShortRestHp (Phase 5, plan 05-06).
 *
 * These tests verify:
 * - levelUp increments level (capped at 20), adds hpGain to hp_max + hp_current,
 *   and sets the provided slot maxes (preserving used counts)
 * - applyShortRestHp recovers HP (clamped to hpMax) and decrements hitDiceCurrent
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

describe('charactersRepo.levelUp + applyShortRestHp', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-levelup-test-'))
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
    const { charactersRepo } = await import('./charactersRepo')

    const campaign = campaignsRepo.create({ name: 'Level Up Test Campaign' })

    const character = charactersRepo.createWithResources({
      campaignId: campaign.id,
      name: 'Theron Brightblade',
      race: 'Human',
      class: 'Wizard',
      background: 'Sage',
      strength: 10,
      dexterity: 14,
      constitution: 14,
      intelligence: 18,
      wisdom: 12,
      charisma: 10,
      ac: 12,
      initiativeBonus: 2,
      speed: 30,
      calculatedHp: 8,
      spellSlots: { '1': { used: 1, max: 2 } },
      startingGold: 10,
      savingThrowProficiencies: ['intelligence', 'wisdom'],
      skillProficiencies: ['arcana', 'history'],
      languages: ['Common', 'Elvish'],
      armorProficiencies: [],
      weaponProficiencies: ['daggers', 'quarterstaff'],
    })

    return { db, campaignsRepo, charactersRepo, campaign, character }
  }

  // ─── levelUp tests ──────────────────────────────────────────────────────────

  it('levelUp increments the character level by 1', async () => {
    const { charactersRepo, character } = await getRepo()
    expect(character.level).toBe(1)

    charactersRepo.levelUp(character.id, 5, {})
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.level).toBe(2)
  })

  it('levelUp adds hpGain to both hpMax and hpCurrent', async () => {
    const { charactersRepo, character } = await getRepo()
    const startHp = character.resources.hpMax

    charactersRepo.levelUp(character.id, 5, {})
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.resources.hpMax).toBe(startHp + 5)
    expect(updated.resources.hpCurrent).toBe(startHp + 5)
  })

  it('levelUp caps level at 20 (calling on a level-20 character does not exceed 20)', async () => {
    const { charactersRepo, character, db } = await getRepo()

    // Manually set level to 20 in DB
    db.run('UPDATE characters SET level = 20 WHERE id = ?', [character.id])

    charactersRepo.levelUp(character.id, 3, {})
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.level).toBe(20)
  })

  it('levelUp sets new slot maxes while preserving existing used counts', async () => {
    const { charactersRepo, character } = await getRepo()
    // Initial spellSlots: { '1': { used: 1, max: 2 } }
    expect(character.resources.spellSlots['1']?.used).toBe(1)

    // Level up and add new slot maxes (2nd level and new 2nd level spell slot)
    charactersRepo.levelUp(character.id, 4, { '1': 3, '2': 2 })
    const updated = charactersRepo.getWithResources(character.id)!

    // max for '1' should be 3; used should be preserved at 1
    expect(updated.resources.spellSlots['1']?.max).toBe(3)
    expect(updated.resources.spellSlots['1']?.used).toBe(1)
    // new '2' slot should be added with max 2 and used 0 (no prior data)
    expect(updated.resources.spellSlots['2']?.max).toBe(2)
    expect(updated.resources.spellSlots['2']?.used).toBe(0)
  })

  it('levelUp with empty newSlotMax does not mutate spell slots', async () => {
    const { charactersRepo, character } = await getRepo()
    const slotsBefore = { ...character.resources.spellSlots }

    charactersRepo.levelUp(character.id, 5, {})
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.resources.spellSlots['1']?.max).toBe(slotsBefore['1']?.max ?? 0)
    expect(updated.resources.spellSlots['1']?.used).toBe(slotsBefore['1']?.used ?? 0)
  })

  // ─── applyShortRestHp tests ──────────────────────────────────────────────────

  it('applyShortRestHp increases hpCurrent by hpRecovered', async () => {
    const { charactersRepo, character, db } = await getRepo()

    // Reduce HP first so there is room to heal
    db.run(
      'UPDATE character_resources SET hp_current = 3 WHERE character_id = ?',
      [character.id],
    )

    charactersRepo.applyShortRestHp(character.id, 5, 1)
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.resources.hpCurrent).toBe(8) // 3 + 5 = 8
  })

  it('applyShortRestHp clamps hpCurrent to hpMax', async () => {
    const { charactersRepo, character, db } = await getRepo()

    // Set HP to almost max
    db.run(
      'UPDATE character_resources SET hp_current = 6 WHERE character_id = ?',
      [character.id],
    )

    // hpMax = 8; recovering 10 should clamp to 8
    charactersRepo.applyShortRestHp(character.id, 10, 1)
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.resources.hpCurrent).toBe(updated.resources.hpMax)
  })

  it('applyShortRestHp decrements hitDiceCurrent by diceSpent', async () => {
    const { charactersRepo, character, db } = await getRepo()

    // Set hitDiceCurrent to 4
    db.run(
      'UPDATE character_resources SET hit_dice_current = 4, hit_dice_total = 4 WHERE character_id = ?',
      [character.id],
    )
    db.run(
      'UPDATE character_resources SET hp_current = 3 WHERE character_id = ?',
      [character.id],
    )

    charactersRepo.applyShortRestHp(character.id, 5, 2)
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.resources.hitDiceCurrent).toBe(2)
  })

  it('applyShortRestHp clamps hitDiceCurrent at 0 (never negative)', async () => {
    const { charactersRepo, character, db } = await getRepo()

    // Set hitDiceCurrent to 1
    db.run(
      'UPDATE character_resources SET hit_dice_current = 1, hit_dice_total = 1 WHERE character_id = ?',
      [character.id],
    )
    db.run(
      'UPDATE character_resources SET hp_current = 3 WHERE character_id = ?',
      [character.id],
    )

    // Spending 5 dice when only 1 available — should clamp at 0
    charactersRepo.applyShortRestHp(character.id, 5, 5)
    const updated = charactersRepo.getWithResources(character.id)!

    expect(updated.resources.hitDiceCurrent).toBe(0)
  })
})
