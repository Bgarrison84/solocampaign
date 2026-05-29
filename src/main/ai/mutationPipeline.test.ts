/**
 * mutationPipeline tests (PROG-02, COMB-03, STATE-05, T-5-01).
 *
 * stripAndParseJsonTail is pure and tested directly. applyMutationBatch is
 * exercised against an in-memory SQLite DB seeded with the real schema, using
 * the same vi.doMock('../db/index') harness as the repo tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { stripAndParseJsonTail } from './mutationPipeline'

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

describe('mutationPipeline', () => {
  describe('stripAndParseJsonTail', () => {
    it('returns the text unchanged with null mutations when there is no JSON tail', () => {
      expect(stripAndParseJsonTail('hello world')).toEqual({
        cleanText: 'hello world',
        mutations: null,
      })
    })

    it('strips a trailing fenced json block and parses its mutations array', () => {
      const text =
        'You strike the goblin.\n\n```json\n{"mutations":[{"toolName":"updateHp","args":{"delta":-3}}]}\n```'
      const { cleanText, mutations } = stripAndParseJsonTail(text)
      expect(cleanText).toBe('You strike the goblin.')
      expect(Array.isArray(mutations)).toBe(true)
      expect(mutations).toHaveLength(1)
      expect(mutations?.[0]).toMatchObject({ toolName: 'updateHp' })
    })

    it('returns null mutations and unchanged text for a malformed json tail', () => {
      const text = 'Narrative.\n\n```json\n{not valid json}\n```'
      const { cleanText, mutations } = stripAndParseJsonTail(text)
      expect(mutations).toBeNull()
      expect(cleanText).toBe(text)
    })

    it('does NOT treat a code block that is not at end-of-string as a tail (Pitfall 3)', () => {
      const text =
        'Before.\n\n```json\n{"mutations":[{"toolName":"updateHp","args":{"delta":-3}}]}\n```\n\nMore narrative after the block.'
      const { cleanText, mutations } = stripAndParseJsonTail(text)
      expect(mutations).toBeNull()
      expect(cleanText).toBe(text)
    })
  })

  describe('applyMutationBatch', () => {
    beforeEach(async () => {
      testDir = await mkdtemp(join(tmpdir(), 'solocampaign-mutation-test-'))
      vi.resetModules()
    })

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true })
      vi.resetModules()
    })

    async function setup() {
      const { db } = makeInMemoryDb()

      vi.doMock('electron', () => ({
        app: { getPath: vi.fn(() => testDir), isPackaged: false },
      }))
      vi.doMock('../db/index', () => ({ getDb: () => db, db }))

      vi.resetModules()
      vi.doMock('electron', () => ({
        app: { getPath: vi.fn(() => testDir), isPackaged: false },
      }))
      vi.doMock('../db/index', () => ({ getDb: () => db, db }))

      const { campaignsRepo } = await import('../db/campaignsRepo')
      const { charactersRepo } = await import('../db/charactersRepo')
      const { applyMutationBatch } = await import('./mutationPipeline')

      const campaign = campaignsRepo.create({ name: 'Combat Campaign' })
      const character = charactersRepo.createWithResources({
        campaignId: campaign.id,
        name: 'Mira',
        race: 'Elf',
        class: 'Wizard',
        background: 'Sage',
        strength: 8,
        dexterity: 14,
        constitution: 12,
        intelligence: 16,
        wisdom: 10,
        charisma: 10,
        ac: 12,
        initiativeBonus: 2,
        speed: 30,
        calculatedHp: 20,
        spellSlots: { '1': { used: 0, max: 2 }, '2': { used: 0, max: 1 } },
        startingGold: 10,
      })

      return { db, campaign, character, charactersRepo, applyMutationBatch }
    }

    function countEvents(db: ReturnType<typeof drizzle>, campaignId: string, eventType: string): number {
      return db
        .select()
        .from(schema.campaignEvents)
        .where(eq(schema.campaignEvents.campaignId, campaignId))
        .all()
        .filter((e) => e.eventType === eventType).length
    }

    it('updateHp lowers player HP and writes a campaign_events hp_change row', async () => {
      const { db, campaign, character, charactersRepo, applyMutationBatch } = await setup()

      await applyMutationBatch(
        [{ toolName: 'updateHp', args: { delta: -6, source: 'Goblin' } }],
        campaign.id,
        null,
      )

      const after = charactersRepo.getWithResources(character.id)
      expect(after?.resources.hpCurrent).toBe(14)
      expect(countEvents(db, campaign.id, 'hp_change')).toBe(1)
    })

    it('long rest restores HP to max and refills all spell slots', async () => {
      const { db, campaign, character, charactersRepo, applyMutationBatch } = await setup()

      // Spend some resources first.
      charactersRepo.updateHp(character.id, -10)
      charactersRepo.updateSpellSlot(character.id, '1', 2)

      await applyMutationBatch(
        [{ toolName: 'processRest', args: { type: 'long' } }],
        campaign.id,
        null,
      )

      const after = charactersRepo.getWithResources(character.id)
      expect(after?.resources.hpCurrent).toBe(after?.resources.hpMax)
      expect(after?.resources.spellSlots['1'].used).toBe(0)
      expect(after?.resources.spellSlots['2'].used).toBe(0)
      expect(countEvents(db, campaign.id, 'rest_taken')).toBe(1)
    })

    it('short rest clears death saves and refills pact slots without touching HP', async () => {
      const { db, campaign, character, charactersRepo, applyMutationBatch } = await setup()

      // Seed pact slots + a damaged HP + death saves directly.
      db.update(schema.characterResources)
        .set({
          pactSlots: JSON.stringify({ '1': { used: 1, max: 1 } }),
          hpCurrent: 8,
          deathSaveSuccesses: 2,
          deathSaveFailures: 1,
        })
        .where(eq(schema.characterResources.characterId, character.id))
        .run()

      await applyMutationBatch(
        [{ toolName: 'processRest', args: { type: 'short' } }],
        campaign.id,
        null,
      )

      const row = db
        .select()
        .from(schema.characterResources)
        .where(eq(schema.characterResources.characterId, character.id))
        .get()
      const pact = JSON.parse(row!.pactSlots) as Record<string, { used: number; max: number }>
      expect(pact['1'].used).toBe(0)
      expect(row!.deathSaveSuccesses).toBe(0)
      expect(row!.deathSaveFailures).toBe(0)
      // Short rest must NOT auto-heal HP (renderer hit-dice modal handles that).
      expect(row!.hpCurrent).toBe(8)
    })

    it('applies valid calls even when one call in the batch is invalid (D-06)', async () => {
      const { db, campaign, character, charactersRepo, applyMutationBatch } = await setup()

      await applyMutationBatch(
        [
          // Invalid: addCombatant requires a name + hpMax >= 1.
          { toolName: 'addCombatant', args: { campaignId: campaign.id, name: 'X', hpMax: -5 } },
          // Valid: should still apply.
          { toolName: 'awardXp', args: { campaignId: campaign.id, amount: 100 } },
        ],
        campaign.id,
        null,
      )

      const after = charactersRepo.getWithResources(character.id)
      expect(after?.xp).toBe(100)
      expect(countEvents(db, campaign.id, 'xp_awarded')).toBe(1)
      // The invalid combatant call wrote no combatant_added event.
      expect(countEvents(db, campaign.id, 'combatant_added')).toBe(0)
    })

    it('showDiceRoll returns dice data and applies no mutation', async () => {
      const { db, campaign, applyMutationBatch } = await setup()

      const { diceRolls } = await applyMutationBatch(
        [
          {
            toolName: 'showDiceRoll',
            args: { label: 'Attack', expression: '1d20+3', result: 14, breakdown: [11, 3] },
          },
        ],
        campaign.id,
        null,
      )

      expect(diceRolls).toHaveLength(1)
      expect(diceRolls[0]).toMatchObject({ label: 'Attack', result: 14 })
      expect(countEvents(db, campaign.id, 'dice_roll')).toBe(1)
    })
  })
})
