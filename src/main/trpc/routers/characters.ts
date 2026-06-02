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
import { dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { t } from '../_base'
import { charactersRepo } from '../../db/charactersRepo'
import { characterSpellsRepo } from '../../db/characterSpellsRepo'
import { messagesRepo } from '../../db/messagesRepo'
import { loadContent } from '../../db/contentLoader'
import {
  calcHP,
  calcAC,
  calcInitiativeBonus,
  buildSpellSlots,
  calcAbilityModifier,
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
import { generateCharacterPdf } from '../../services/pdfService'
import type { CharacterPdfData } from '../../services/pdfService'

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
   * List all characters (party members + companions) for a campaign.
   * Used by CharacterSheetTab to build the party switcher and companions section (PARTY-01, PARTY-02).
   */
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => {
      return charactersRepo.listByCampaign(input.campaignId)
    }),

  /**
   * Add a companion to a campaign.
   * Server-side Zod validation mirrors addCompanionSchema (T-07-08-01).
   */
  addCompanion: t.procedure
    .input(
      z.object({
        campaignId: campaignIdSchema,
        name: z.string().min(1).max(100),
        type: z.enum(['Familiar', 'Animal Companion', 'Summoned Creature']),
        hpMax: z.number().int().min(1).max(9999),
        ac: z.number().int().min(1).max(30),
      }),
    )
    .mutation(({ input }) => {
      return charactersRepo.createCompanion(input)
    }),

  /**
   * Remove a companion from a campaign.
   * Scoped to campaign (T-07-08-01).
   */
  deleteCompanion: t.procedure
    .input(
      z.object({
        companionId: characterIdSchema,
        campaignId: campaignIdSchema,
      }),
    )
    .mutation(({ input }) => {
      charactersRepo.deleteCompanion(input.companionId, input.campaignId)
      return { deleted: true }
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

  /**
   * Export the active character's sheet as a print-friendly PDF (DIST-02).
   *
   * Security:
   * - T-08-14: characterId validated as UUID by Zod schema
   * - T-08-15: Save path is from OS showSaveDialog (trusted) — renderer never supplies a path
   * - T-08-16: PDF content is the user's own character data; no secrets/keys
   *
   * D-12: hasSpells = character_spells.length > 0 → controls page 2 (spell list)
   * D-14: Export whichever character is activeCharacterId in campaignViewStore
   */
  exportPdf: t.procedure
    .input(z.object({ characterId: characterIdSchema }))
    .mutation(async ({ input }) => {
      // Fetch character with resources + items
      const character = charactersRepo.getWithResources(input.characterId)
      if (!character) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found.',
        })
      }

      // Fetch character spells
      const characterSpells = characterSpellsRepo.listByCharacter(input.characterId)

      // ── Build CharacterPdfData ──────────────────────────────────────────────
      const profBonus = character.proficiencyBonus

      // Ability modifiers
      const strMod = calcAbilityModifier(character.strength)
      const dexMod = calcAbilityModifier(character.dexterity)
      const conMod = calcAbilityModifier(character.constitution)
      const intMod = calcAbilityModifier(character.intelligence)
      const wisMod = calcAbilityModifier(character.wisdom)
      const chaMod = calcAbilityModifier(character.charisma)

      const abilityModifiers = { strMod, dexMod, conMod, intMod, wisMod, chaMod }
      const abilityScoreMap: Record<string, number> = {
        strength: character.strength,
        dexterity: character.dexterity,
        constitution: character.constitution,
        intelligence: character.intelligence,
        wisdom: character.wisdom,
        charisma: character.charisma,
      }
      const abilityModMap: Record<string, number> = {
        strength: strMod,
        dexterity: dexMod,
        constitution: conMod,
        intelligence: intMod,
        wisdom: wisMod,
        charisma: chaMod,
      }

      // Saving throws
      const savingThrows = (['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).reduce(
        (acc, ability) => {
          const proficient = character.savingThrowProficiencies.includes(ability)
          const baseMod = abilityModMap[ability]
          acc[ability] = {
            proficient,
            value: baseMod + (proficient ? profBonus : 0),
          }
          return acc
        },
        {} as CharacterPdfData['savingThrows'],
      )

      // Skills (D&D 5e standard 18 skills)
      const SKILLS_DEF: Array<{ key: string; name: string; ability: keyof typeof abilityScoreMap }> = [
        { key: 'acrobatics', name: 'Acrobatics', ability: 'dexterity' },
        { key: 'animalHandling', name: 'Animal Handling', ability: 'wisdom' },
        { key: 'arcana', name: 'Arcana', ability: 'intelligence' },
        { key: 'athletics', name: 'Athletics', ability: 'strength' },
        { key: 'deception', name: 'Deception', ability: 'charisma' },
        { key: 'history', name: 'History', ability: 'intelligence' },
        { key: 'insight', name: 'Insight', ability: 'wisdom' },
        { key: 'intimidation', name: 'Intimidation', ability: 'charisma' },
        { key: 'investigation', name: 'Investigation', ability: 'intelligence' },
        { key: 'medicine', name: 'Medicine', ability: 'wisdom' },
        { key: 'nature', name: 'Nature', ability: 'intelligence' },
        { key: 'perception', name: 'Perception', ability: 'wisdom' },
        { key: 'performance', name: 'Performance', ability: 'charisma' },
        { key: 'persuasion', name: 'Persuasion', ability: 'charisma' },
        { key: 'religion', name: 'Religion', ability: 'intelligence' },
        { key: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dexterity' },
        { key: 'stealth', name: 'Stealth', ability: 'dexterity' },
        { key: 'survival', name: 'Survival', ability: 'wisdom' },
      ]

      const skills = SKILLS_DEF.map((sk) => {
        const proficient = character.skillProficiencies.includes(sk.key)
        const expertise = character.skillExpertise.includes(sk.key)
        const baseMod = abilityModMap[sk.ability]
        const bonus = expertise ? profBonus * 2 : proficient ? profBonus : 0
        return {
          name: sk.name,
          ability: sk.ability,
          proficient,
          expertise,
          value: baseMod + bonus,
        }
      })

      // Passive perception
      const perceptionSkill = skills.find((s) => s.name === 'Perception')!
      const passivePerception = 10 + perceptionSkill.value

      // Resolve class label (multiclass support via classes JSON column)
      let classLabel = character.class
      try {
        if (character.classes) {
          const classes = JSON.parse(character.classes as string) as Array<{ className: string; level: number }>
          if (Array.isArray(classes) && classes.length > 1) {
            classLabel = classes.map((c) => `${c.className} ${c.level}`).join(' / ')
          } else if (Array.isArray(classes) && classes.length === 1) {
            classLabel = classes[0].className
          }
        }
      } catch {
        // Fallback to character.class if JSON parse fails
      }

      // hasSpells: true if character has any spells (D-12)
      const hasSpells = characterSpells.length > 0

      const data: CharacterPdfData = {
        name: character.name,
        race: character.race ?? '',
        classLabel,
        background: character.background ?? '',
        level: character.level,

        strength: character.strength,
        dexterity: character.dexterity,
        constitution: character.constitution,
        intelligence: character.intelligence,
        wisdom: character.wisdom,
        charisma: character.charisma,

        ...abilityModifiers,

        savingThrows,
        skills,
        passivePerception,

        hpCurrent: character.resources.hpCurrent,
        hpMax: character.resources.hpMax,
        hpTemp: character.resources.hpTemp,
        ac: character.ac,
        speed: character.speed,
        initiative: character.initiativeBonus,
        proficiencyBonus: profBonus,
        hasInspiration: character.resources.hasInspiration,

        deathSaveSuccesses: character.resources.deathSaveSuccesses,
        deathSaveFailures: character.resources.deathSaveFailures,

        conditions: character.resources.conditions,

        cp: character.resources.cp,
        sp: character.resources.sp,
        ep: character.resources.ep,
        gp: character.resources.gp,
        pp: character.resources.pp,

        equipment: character.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          isMagic: item.isMagic,
        })),

        // Personality traits from sheet fields (stored as text columns)
        personality: undefined,
        ideals: undefined,
        bonds: undefined,
        flaws: undefined,

        hasSpells,
        spellSlots: character.resources.spellSlots,
        spells: characterSpells.map((spell) => ({
          name: spell.spellName,
          level: spell.spellLevel,
          isPrepared: spell.isPrepared,
        })),
      }

      // ── Generate PDF ──────────────────────────────────────────────────────
      const buffer = await generateCharacterPdf(data)

      // ── Save dialog ───────────────────────────────────────────────────────
      const safeName = (character.name ?? 'character').toLowerCase().replace(/\s+/g, '-')
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${safeName}-sheet.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) {
        return { canceled: true }
      }

      await writeFile(filePath, buffer)
      return { canceled: false }
    }),
})
