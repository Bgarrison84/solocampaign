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
import { messagesRepo } from '../../db/messagesRepo'
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
import { importImage, getImageDataUrl } from '../../imageService'

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
   *
   * Phase 7 (07-06): accepts negativeTraits from point-buy wizard step (CHAR-03).
   * negativeTraits is optional; non-null only when the player used Point Buy mode with flaws.
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
        // Phase 7 (07-06, CHAR-03): negative traits from point-buy step — Zod-bounded
        negativeTraits: z
          .object({
            presetFlaws: z.array(z.string().min(1).max(100)).max(12),
            freeFormFlaws: z.array(z.string().max(280)).max(2),
          })
          .optional(),
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
          // Phase 7 (07-06, CHAR-03): persist negative traits if provided
          negativeTraits: input.negativeTraits ?? null,
        })
      } catch (err: unknown) {
        const errObj = err as { code?: string; message?: string }
        // Catch PARTY-01 party-full error from charactersRepo (07-06)
        if (errObj?.message?.includes('Party is full') || errObj?.message?.includes('partySize')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: "This campaign's party is full.",
          })
        }
        // Catch SQLite UNIQUE constraint violation (T-02-05, Pitfall 7)
        if (
          errObj?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
          (errObj?.message?.includes('UNIQUE constraint failed') ?? false)
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
   * Uses imageService.getImageDataUrl as the single source of truth.
   */
  getPortraitDataUrl: t.procedure
    .input(z.object({ characterId: characterIdSchema }))
    .query(async ({ input }) => {
      const withResources = charactersRepo.getWithResources(input.characterId)
      if (!withResources?.portraitPath) return null
      return await getImageDataUrl(withResources.portraitPath)
    }),

  /**
   * Import a portrait image for a character.
   * Opens a native OS file dialog, resizes to max 1024px, stores relative path in DB.
   * Returns null if the user cancels the dialog (no image selected).
   * Both characterId and campaignId are required — campaignId scopes the image folder.
   */
  importPortrait: t.procedure
    .input(z.object({ characterId: characterIdSchema, campaignId: campaignIdSchema }))
    .mutation(async ({ input }) => {
      const relativePath = await importImage(input.campaignId, 'portrait')
      if (relativePath === null) return null
      charactersRepo.updatePortraitPath(input.characterId, relativePath)
      return relativePath
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

  /**
   * Level up a character: increment level (uncapped — D-24), add hpGain to hpMax/hpCurrent,
   * and merge new slot maxes (preserving used counts).
   * Optional `classes` replaces characters.classes JSON (multiclass — D-07/D-08).
   * Optional `subclass` writes characters.subclass (subclass selection — D-15).
   * When neither is provided, single-class behavior is identical to the Phase 5 path.
   * Zod bounds: hpGain 1–50 (T-05-06-01); newSlotMax values 0–9.
   * (D-24, D-31, PROG-01)
   */
  levelUp: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        hpGain: z.number().int().min(1).max(50),
        newSlotMax: z.record(z.string(), z.number().int().min(0).max(9)),
        classes: z
          .array(
            z.object({
              className: z.string().min(1).max(100),
              level: z.number().int().min(1).max(30),
            }),
          )
          .optional(),
        subclass: z.string().max(100).optional(),
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.levelUp(input.characterId, input.hpGain, input.newSlotMax, {
        classes: input.classes,
        subclass: input.subclass,
      })
      return { leveled: true }
    }),

  /**
   * Record a system message in the story scroll (role 'system').
   * Content bounded to 500 chars to prevent XSS-equivalent rendering exploits (T-05-06-02).
   * (D-32, PROG-01)
   */
  recordSystemMessage: t.procedure
    .input(
      z.object({
        campaignId: campaignIdSchema,
        content: z.string().min(1).max(500),
        sessionId: z.string().optional(),
      }),
    )
    .mutation(({ input }) => {
      messagesRepo.insert({
        campaignId: input.campaignId,
        role: 'system',
        content: input.content,
        sessionId: input.sessionId ?? null,
      })
      return { recorded: true }
    }),

  /**
   * Apply short-rest HP recovery: increase hpCurrent (clamped to hpMax) and decrement
   * hitDiceCurrent by diceSpent (clamped at 0).
   * Zod bounds: hpRecovered 0–9999, diceSpent 0–20 (T-05-06-01, D-36).
   */
  applyShortRestHp: t.procedure
    .input(
      z.object({
        characterId: characterIdSchema,
        hpRecovered: z.number().int().min(0).max(9999),
        diceSpent: z.number().int().min(0).max(20),
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.applyShortRestHp(input.characterId, input.hpRecovered, input.diceSpent)
      return { applied: true }
    }),
})
