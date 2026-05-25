/**
 * characters tRPC router.
 * Exposes all character CRUD, live-play mutations, and image queries.
 *
 * Security:
 * - All inputs Zod-validated using shared schemas (T-02-05, T-02-06).
 * - getPortraitDataUrl derives path from DB column only — never accepts a raw path (T-02-07).
 * - importPortrait stubbed until Plan 04 (imageService.ts is implemented there).
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { t } from '../_base'
import { charactersRepo } from '../../db/charactersRepo'
import { loadContent } from '../../db/contentLoader'
import {
  calcHP,
  calcAC,
  calcInitiativeBonus,
  buildSpellSlots,
} from '../../characters/calculations'
import {
  campaignIdSchema,
  characterNameSchema,
  abilityScoreSchema,
  hpDeltaSchema,
  currencyDeltaSchema,
  xpDeltaSchema,
  conditionNameSchema,
} from '../schemas'
import { app } from 'electron'
import path from 'node:path'
import { promises as fsPromises } from 'fs'

// ─── Input schemas ─────────────────────────────────────────────────────────────

const characterIdSchema = z.string().uuid()

const abilityScoresSchema = z.object({
  strength: abilityScoreSchema,
  dexterity: abilityScoreSchema,
  constitution: abilityScoreSchema,
  intelligence: abilityScoreSchema,
  wisdom: abilityScoreSchema,
  charisma: abilityScoreSchema,
})

const abilityNameSchema = z.enum([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
])

const denominationSchema = z.enum(['cp', 'sp', 'ep', 'gp', 'pp'])

const startingItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1),
  weight: z.number().min(0),
  isMagic: z.boolean().optional(),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export const charactersRouter = t.router({
  /**
   * Create a character with auto-calculated stats (D-15).
   * Applies racial ASI bonuses to base ability scores before persisting.
   * Wraps DB insert in a transaction; throws CONFLICT on duplicate campaignId.
   */
  create: t.procedure
    .input(
      z.object({
        campaignId: campaignIdSchema,
        name: characterNameSchema,
        race: z.string().min(1).max(100),
        subrace: z.string().max(100).optional(),
        class: z.string().min(1).max(100),
        subclass: z.string().max(100).optional(),
        background: z.string().min(1).max(100),
        level: z.number().int().min(1).max(20).default(1),
        abilityScores: abilityScoresSchema,
        savingThrowProficiencies: z.array(z.string()).default([]),
        skillProficiencies: z.array(z.string()).default([]),
        languages: z.array(z.string()).default([]),
        backstory: z.string().max(2000).optional(),
        equipmentPackageId: z.string().optional(),
        startingItems: z.array(startingItemSchema).default([]),
        startingGold: z.number().int().min(0).default(0),
        traitsText: z.string().max(5000).optional(),
        classFeatureText: z.string().max(5000).optional(),
        backgroundFeatureText: z.string().max(5000).optional(),
        hitDie: z.number().int().min(4).max(12),
        armorBaseAc: z.number().int().min(0).max(20).optional(),
        speed: z.number().int().min(0).max(120).default(30),
      }),
    )
    .mutation(({ input }) => {
      // Apply racial ASI bonuses (D-15)
      // Look up the race from content to get ASI bonuses
      const content = loadContent()
      const raceData = content.races.find(
        (r) =>
          r.id === input.race.toLowerCase().replace(/\s+/g, '-') ||
          r.name.toLowerCase() === input.race.toLowerCase(),
      )
      const subraceData = input.subrace
        ? content.races.find(
            (r) =>
              r.subrace?.toLowerCase() === input.subrace!.toLowerCase() ||
              r.id === input.subrace!.toLowerCase().replace(/\s+/g, '-'),
          )
        : null

      // Start with base ability scores, then apply racial ASI bonuses
      const effectiveScores = { ...input.abilityScores }
      const asiSource = subraceData ?? raceData
      if (asiSource) {
        for (const asi of asiSource.abilityScoreIncreases) {
          const ability = asi.ability.toLowerCase() as keyof typeof effectiveScores
          if (ability in effectiveScores) {
            effectiveScores[ability] = Math.min(30, effectiveScores[ability] + asi.bonus)
          }
        }
      }

      // Auto-calculate HP, AC, initiative (D-15)
      const calculatedHp = calcHP(input.hitDie, effectiveScores.constitution)
      const calculatedAc = calcAC(effectiveScores.dexterity, input.armorBaseAc)
      const initiativeBonus = calcInitiativeBonus(effectiveScores.dexterity)

      // Build spell slots from content data (D-15)
      const spellSlots = buildSpellSlots(
        input.class.toLowerCase(),
        input.level,
        content.spellSlotsByClass,
      )

      // Get proficiency data from class content if available
      const classData = content.classes.find(
        (c) =>
          c.id === input.class.toLowerCase().replace(/\s+/g, '-') ||
          c.name.toLowerCase() === input.class.toLowerCase(),
      )
      const bgData = content.backgrounds.find(
        (b) =>
          b.id === input.background.toLowerCase().replace(/\s+/g, '-') ||
          b.name.toLowerCase() === input.background.toLowerCase(),
      )

      // Merge background proficiencies (auto-applied, D-15)
      const allSkillProficiencies = [...new Set([
        ...input.skillProficiencies,
        ...(bgData?.skillProficiencies ?? []),
      ])]
      const allToolProficiencies = [
        ...(classData?.toolProficiencies ?? []),
        ...(bgData?.toolProficiencies ?? []),
      ]
      const allLanguages = [...new Set([
        ...input.languages,
        ...(bgData?.languages ?? []),
      ])]

      try {
        return charactersRepo.createWithResources({
          campaignId: input.campaignId,
          name: input.name,
          race: input.race,
          subrace: input.subrace ?? null,
          class: input.class,
          subclass: input.subclass ?? null,
          background: input.background,
          strength: effectiveScores.strength,
          dexterity: effectiveScores.dexterity,
          constitution: effectiveScores.constitution,
          intelligence: effectiveScores.intelligence,
          wisdom: effectiveScores.wisdom,
          charisma: effectiveScores.charisma,
          savingThrowProficiencies: input.savingThrowProficiencies,
          skillProficiencies: allSkillProficiencies,
          languages: allLanguages,
          toolProficiencies: allToolProficiencies,
          armorProficiencies: classData?.armorProficiencies ?? [],
          weaponProficiencies: classData?.weaponProficiencies ?? [],
          ac: calculatedAc,
          initiativeBonus,
          speed: input.speed,
          racialTraitsText: input.traitsText ?? null,
          classFeatureText: input.classFeatureText ?? null,
          backgroundFeatureText: input.backgroundFeatureText ?? null,
          equipmentPackage: input.equipmentPackageId ?? null,
          calculatedHp,
          spellSlots,
          startingGold: input.startingGold,
          startingItems: input.startingItems,
        })
      } catch (err: unknown) {
        // Catch SQLite UNIQUE constraint violation (T-02-05, Pitfall 7)
        const sqliteErr = err as { code?: string; message?: string }
        if (
          sqliteErr?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
          (sqliteErr?.message?.includes('UNIQUE constraint failed') ?? false)
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A character already exists for this campaign.',
          })
        }
        throw err
      }
    }),

  /**
   * Get a character with resources and items by campaign ID.
   * Returns null if no character exists (triggers wizard auto-launch, D-04).
   */
  getByCampaignId: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => {
      return charactersRepo.getByCampaignId(input.campaignId) ?? null
    }),

  /**
   * Get character portrait as a base64 data URL (T-02-07).
   * Path derived from DB column only — renderer never sends a raw path.
   * Takes characterId (not campaignId) and uses getWithResources directly.
   */
  getPortraitDataUrl: t.procedure
    .input(z.object({ characterId: characterIdSchema }))
    .query(async ({ input }) => {
      const withResources = charactersRepo.getWithResources(input.characterId)

      if (!withResources?.portraitPath) return null

      const absolutePath = path.join(app.getPath('userData'), withResources.portraitPath)
      try {
        const buffer = await fsPromises.readFile(absolutePath)
        const ext = path.extname(withResources.portraitPath).slice(1).toLowerCase()
        const mimeType = ext === 'jpg' ? 'jpeg' : ext
        return `data:image/${mimeType};base64,${buffer.toString('base64')}`
      } catch (err: unknown) {
        const nodeErr = err as { code?: string }
        if (nodeErr?.code === 'ENOENT') return null
        throw err
      }
    }),

  /**
   * Import a portrait image for a character (stubbed until Plan 04).
   * imageService.ts (dialog + jimp resize + fs copy) is implemented in Plan 04.
   */
  importPortrait: t.procedure
    .input(z.object({ characterId: characterIdSchema }))
    .mutation(() => {
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Portrait import will be available in Plan 04.',
      })
    }),

  /**
   * Update a single ability score (1–30, Zod-validated).
   */
  updateAbilityScore: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        ability: abilityNameSchema,
        value: abilityScoreSchema,
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateAbilityScore(input.characterId, input.ability, input.value)
    }),

  /**
   * Delta-based XP mutation. Clamps at 0 (no negative XP).
   * Level-up flow is Phase 5 (D-15 / CHAR-07).
   */
  updateXp: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        delta: xpDeltaSchema,
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateXp(input.characterId, input.delta)
    }),

  /**
   * Delta-based HP mutation. Clamps at [0, hpMax].
   */
  updateHp: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        delta: hpDeltaSchema,
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateHp(input.characterId, input.delta)
    }),

  /**
   * Delta-based temp HP mutation. Clamps at 0 minimum.
   */
  updateTempHp: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        delta: hpDeltaSchema,
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateTempHp(input.characterId, input.delta)
    }),

  /**
   * Delta-based currency mutation. Denomination Zod-validated to cp/sp/ep/gp/pp.
   */
  updateCurrency: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        denomination: denominationSchema,
        delta: currencyDeltaSchema,
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateCurrency(input.characterId, input.denomination, input.delta)
    }),

  /**
   * Update spell slot used count for a given slot level.
   */
  updateSpellSlot: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        slotLevel: z.string().regex(/^[1-9]$/),
        delta: z.number().int().min(-9).max(9),
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateSpellSlot(input.characterId, input.slotLevel, input.delta)
    }),

  /**
   * Toggle a condition on/off. Condition name Zod-validated to 14 standard conditions.
   */
  toggleCondition: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        condition: conditionNameSchema,
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.toggleCondition(input.characterId, input.condition)
    }),

  /**
   * Set death save counts (absolute values, 0–3 each).
   */
  updateDeathSaves: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        successes: z.number().int().min(0).max(3),
        failures: z.number().int().min(0).max(3),
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.updateDeathSaves(input.characterId, input.successes, input.failures)
    }),

  /**
   * Toggle the hasInspiration boolean.
   */
  toggleInspiration: t.procedure
    .input(z.object({ characterId: characterIdSchema }))
    .mutation(({ input }) => {
      charactersRepo.toggleInspiration(input.characterId)
    }),

  /**
   * Flip the isAttuned flag on a character_items row.
   * Item is identified by itemId (unique across all characters).
   */
  toggleItemAttuned: t.procedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(({ input }) => {
      charactersRepo.toggleItemAttuned(input.itemId)
    }),
})
