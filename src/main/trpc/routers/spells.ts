/**
 * Spells tRPC router (CHAR-08).
 *
 * Procedures:
 * - listAllSpells: returns the full resources/spells.json array (static content, loaded once)
 * - listByCharacter: returns a character's spell list from character_spells table
 * - seedFromJson: seeds a character's spell list from spells.json filtered by class
 * - castSpell: deducts a spell slot (no deduction for cantrips, slotLevel=0)
 * - undoCast: reverses a slot deduction (30s undo chip support)
 * - updateConcentration: sets or clears concentratingOn on characterResources
 *
 * Security:
 * - T-05-05-01: All inputs validated with Zod (characterId string, slotLevel int 0-9, spellName max(100), campaignId uuid)
 * - T-05-05-02: castSpell uses optimistic triple (onMutate/onError/onSettled) in renderer; server clamps via updateSpellSlot
 * - T-05-05-SC: No new npm packages
 */

import { z } from 'zod'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'
import { t } from '../_base'
import { campaignIdSchema } from '../schemas'
import { characterSpellsRepo } from '../../db/characterSpellsRepo'
import { charactersRepo } from '../../db/charactersRepo'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/index'
import { characterResources } from '../../db/schema'

// ─── Spell JSON type ──────────────────────────────────────────────────────────

export interface SpellEntry {
  name: string
  level: number
  school: string
  castTime: string
  range: string
  duration: string
  components: string
  concentration: boolean
  ritual: boolean
  classes: string[]
  description: string
}

// ─── Resource path resolution (mirrors contentLoader.ts) ─────────────────────

function getResourcesPath(): string {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../resources')
}

// ─── Module-level cache for spells.json (loaded once at startup) ───────────────

let _spells: SpellEntry[] | null = null

function getSpells(): SpellEntry[] {
  if (_spells) return _spells
  const rp = getResourcesPath()
  try {
    _spells = JSON.parse(fs.readFileSync(path.join(rp, 'spells.json'), 'utf-8')) as SpellEntry[]
  } catch (err) {
    log.error('[spells] failed to load spells.json:', err)
    throw err
  }
  return _spells
}

// ─── Concentration setter (added to augment charactersRepo) ───────────────────

function setConcentration(characterId: string, spellName: string | null): void {
  const db = getDb()
  const now = new Date(Date.now())
  db.update(characterResources)
    .set({ concentratingOn: spellName, updatedAt: now })
    .where(eq(characterResources.characterId, characterId))
    .run()
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const spellsRouter = t.router({
  /**
   * Return the full spells.json array (static SRD content).
   * No input — static content, safe to return in full (T-05-05-03).
   */
  listAllSpells: t.procedure.query(() => {
    return getSpells()
  }),

  /**
   * List a character's spell list from character_spells, ordered by spellLevel asc.
   */
  listByCharacter: t.procedure
    .input(z.object({ characterId: z.string() }))
    .query(({ input }) => {
      return characterSpellsRepo.listByCharacter(input.characterId)
    }),

  /**
   * Seed a character's spell list from spells.json filtered by class.
   * Per A4: seeds all class spells from level 0 up to the highest slot level the
   * character has, or up to level 3 if slot data is unavailable.
   * Idempotent — characterSpellsRepo.seed deletes existing rows first.
   */
  seedFromJson: t.procedure
    .input(
      z.object({
        characterId: z.string(),
        className: z.string(),
        campaignId: campaignIdSchema,
      }),
    )
    .mutation(({ input }) => {
      const character = charactersRepo.getByCampaignId(input.campaignId)
      const slotKeys = character ? Object.keys(character.resources.spellSlots) : []
      const maxSlotLevel =
        slotKeys.length > 0
          ? Math.max(...slotKeys.map((k) => parseInt(k)))
          : 3

      const classKey = input.className.toLowerCase()
      const spells = getSpells()
      const filtered = spells
        .filter((s) => s.classes.includes(classKey) && s.level <= maxSlotLevel)
        .map((s) => ({
          spellName: s.name,
          spellLevel: s.level,
          isPrepared: true,
        }))

      characterSpellsRepo.seed(input.characterId, filtered)

      log.debug('[spells] seedFromJson', {
        characterId: input.characterId,
        className: input.className,
        seeded: filtered.length,
        maxSlotLevel,
      })

      return { seeded: filtered.length }
    }),

  /**
   * Deduct a spell slot for a cast. slotLevel=0 means cantrip — no deduction (D-29).
   * T-05-05-01: slotLevel validated as int 0-9; spellName max 100.
   */
  castSpell: t.procedure
    .input(
      z.object({
        characterId: z.string(),
        spellName: z.string().max(100),
        slotLevel: z.number().int().min(0).max(9),
        campaignId: campaignIdSchema,
      }),
    )
    .mutation(({ input }) => {
      if (input.slotLevel > 0) {
        // Leveled spell — deduct slot (D-24, D-29)
        charactersRepo.updateSpellSlot(input.characterId, String(input.slotLevel), 1)
      }
      log.debug('[spells] castSpell', {
        characterId: input.characterId,
        spellName: input.spellName,
        slotLevel: input.slotLevel,
      })
      return { cast: true }
    }),

  /**
   * Reverse a spell slot deduction (30s undo chip).
   * T-05-05-01: slotLevel validated as int 1-9 (cantrips have no slot to restore).
   */
  undoCast: t.procedure
    .input(
      z.object({
        characterId: z.string(),
        slotLevel: z.number().int().min(1).max(9),
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateSpellSlot(input.characterId, String(input.slotLevel), -1)
      log.debug('[spells] undoCast', {
        characterId: input.characterId,
        slotLevel: input.slotLevel,
      })
      return { restored: true }
    }),

  /**
   * Set or clear concentratingOn on characterResources.
   * Pass spellName=null to clear concentration (D-25).
   */
  updateConcentration: t.procedure
    .input(
      z.object({
        characterId: z.string(),
        spellName: z.string().max(100).nullable(),
      }),
    )
    .mutation(({ input }) => {
      setConcentration(input.characterId, input.spellName)
      log.debug('[spells] updateConcentration', {
        characterId: input.characterId,
        spellName: input.spellName,
      })
      return { updated: true }
    }),
})
