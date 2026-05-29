/**
 * Repository for the characters domain.
 * All methods are synchronous, following the campaignsRepo pattern.
 * JSON columns are parsed before returning — the renderer never receives raw JSON strings.
 */

import { eq, asc, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import log from 'electron-log'
import { getDb } from './index'
import {
  characters,
  characterResources,
  characterItems,
} from './schema'
import type {
  Character,
  CharacterResources,
  CharacterItem,
  NewCharacter,
  NewCharacterResources,
  NewCharacterItem,
} from './schema'
import type { SpellSlotMap } from './contentTypes'

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface CharacterWithResources extends Omit<Character, 'savingThrowProficiencies' | 'skillProficiencies' | 'skillExpertise' | 'languages' | 'toolProficiencies' | 'armorProficiencies' | 'weaponProficiencies'> {
  savingThrowProficiencies: string[]
  skillProficiencies: string[]
  skillExpertise: string[]
  languages: string[]
  toolProficiencies: string[]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  resources: Omit<CharacterResources, 'conditions' | 'spellSlots'> & {
    conditions: string[]
    spellSlots: SpellSlotMap
  }
  items: CharacterItem[]
}

export interface CreateCharacterInput
  extends Pick<
    NewCharacter,
    | 'campaignId'
    | 'name'
    | 'race'
    | 'class'
    | 'background'
    | 'strength'
    | 'dexterity'
    | 'constitution'
    | 'intelligence'
    | 'wisdom'
    | 'charisma'
    | 'ac'
    | 'initiativeBonus'
    | 'speed'
  > {
  subrace?: string | null
  subclass?: string | null
  backstory?: string | null
  savingThrowProficiencies?: string[]
  skillProficiencies?: string[]
  skillExpertise?: string[]
  languages?: string[]
  toolProficiencies?: string[]
  armorProficiencies?: string[]
  weaponProficiencies?: string[]
  racialTraitsText?: string | null
  classFeatureText?: string | null
  backgroundFeatureText?: string | null
  equipmentPackage?: string | null
  // Resource fields
  calculatedHp: number
  spellSlots?: SpellSlotMap
  startingGold?: number
  // Starting items
  startingItems?: Array<{ name: string; quantity: number; weight: number; isMagic?: boolean }>
}

// ─── JSON Parse Helpers ────────────────────────────────────────────────────────

function parseCharacterJsonFields(
  char: Character,
): Omit<CharacterWithResources, 'resources' | 'items'> {
  return {
    ...char,
    savingThrowProficiencies: JSON.parse(char.savingThrowProficiencies) as string[],
    skillProficiencies: JSON.parse(char.skillProficiencies) as string[],
    skillExpertise: JSON.parse(char.skillExpertise) as string[],
    languages: JSON.parse(char.languages) as string[],
    toolProficiencies: JSON.parse(char.toolProficiencies) as string[],
    armorProficiencies: JSON.parse(char.armorProficiencies) as string[],
    weaponProficiencies: JSON.parse(char.weaponProficiencies) as string[],
  }
}

function parseResourcesJsonFields(
  res: CharacterResources,
): CharacterWithResources['resources'] {
  return {
    ...res,
    conditions: JSON.parse(res.conditions) as string[],
    spellSlots: JSON.parse(res.spellSlots) as SpellSlotMap,
  }
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const charactersRepo = {
  /**
   * Atomically create a character with its resources and starting items
   * in a single synchronous transaction (Pitfall 1: NEVER async tx).
   */
  createWithResources(input: CreateCharacterInput): CharacterWithResources {
    const db = getDb()
    const charId = randomUUID()
    const resId = randomUUID()

    const spellSlotsJson = JSON.stringify(input.spellSlots ?? {})
    const now = new Date(Date.now())

    // db.transaction() must be synchronous — do NOT use async (tx) =>
    db.transaction((tx) => {
      tx.insert(characters)
        .values({
          id: charId,
          campaignId: input.campaignId,
          name: input.name,
          race: input.race,
          subrace: input.subrace ?? null,
          class: input.class,
          subclass: input.subclass ?? null,
          background: input.background,
          level: 1,
          xp: 0,
          backstory: input.backstory ?? null,
          strength: input.strength,
          dexterity: input.dexterity,
          constitution: input.constitution,
          intelligence: input.intelligence,
          wisdom: input.wisdom,
          charisma: input.charisma,
          savingThrowProficiencies: JSON.stringify(input.savingThrowProficiencies ?? []),
          skillProficiencies: JSON.stringify(input.skillProficiencies ?? []),
          skillExpertise: JSON.stringify(input.skillExpertise ?? []),
          ac: input.ac,
          initiativeBonus: input.initiativeBonus,
          speed: input.speed,
          proficiencyBonus: 2,
          languages: JSON.stringify(input.languages ?? []),
          toolProficiencies: JSON.stringify(input.toolProficiencies ?? []),
          armorProficiencies: JSON.stringify(input.armorProficiencies ?? []),
          weaponProficiencies: JSON.stringify(input.weaponProficiencies ?? []),
          racialTraitsText: input.racialTraitsText ?? null,
          classFeatureText: input.classFeatureText ?? null,
          backgroundFeatureText: input.backgroundFeatureText ?? null,
          equipmentPackage: input.equipmentPackage ?? null,
          portraitPath: null,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      tx.insert(characterResources)
        .values({
          id: resId,
          characterId: charId,
          hpCurrent: input.calculatedHp,
          hpMax: input.calculatedHp,
          hpTemp: 0,
          spellSlots: spellSlotsJson,
          cp: 0,
          sp: 0,
          ep: 0,
          gp: input.startingGold ?? 0,
          pp: 0,
          conditions: '[]',
          deathSaveSuccesses: 0,
          deathSaveFailures: 0,
          hasInspiration: false,
          updatedAt: now,
        })
        .run()

      for (const item of input.startingItems ?? []) {
        tx.insert(characterItems)
          .values({
            id: randomUUID(),
            characterId: charId,
            name: item.name,
            quantity: item.quantity,
            weight: item.weight,
            isAttuned: false,
            isMagic: item.isMagic ?? false,
            description: null,
            sortOrder: 0,
            createdAt: now,
          })
          .run()
      }
    })

    const created = this.getWithResources(charId)
    if (!created) {
      throw new Error('[characters] Failed to retrieve character after create')
    }
    return created
  },

  /**
   * Get a character with its resources and items, with all JSON columns parsed.
   */
  getWithResources(characterId: string): CharacterWithResources | undefined {
    const db = getDb()

    const char = db.select().from(characters).where(eq(characters.id, characterId)).get()
    if (!char) return undefined

    const res = db
      .select()
      .from(characterResources)
      .where(eq(characterResources.characterId, characterId))
      .get()

    if (!res) {
      log.error('[characters] Missing character_resources row for characterId:', characterId)
      return undefined
    }

    const items = db
      .select()
      .from(characterItems)
      .where(eq(characterItems.characterId, characterId))
      .orderBy(asc(characterItems.sortOrder))
      .all()

    return {
      ...parseCharacterJsonFields(char),
      resources: parseResourcesJsonFields(res),
      items,
    }
  },

  /**
   * Get a character by campaign ID (D-04: auto-launch check).
   * Returns undefined if no character exists for this campaign.
   */
  getByCampaignId(campaignId: string): CharacterWithResources | undefined {
    const db = getDb()
    const char = db
      .select()
      .from(characters)
      .where(eq(characters.campaignId, campaignId))
      .get()
    if (!char) return undefined
    return this.getWithResources(char.id)
  },

  /**
   * Update a single ability score (value validated as 1-30 in the tRPC layer).
   */
  updateAbilityScore(
    characterId: string,
    ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma',
    value: number,
  ): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characters)
      .set({ [ability]: value, updatedAt: now })
      .where(eq(characters.id, characterId))
      .run()
  },

  /**
   * Delta-based XP mutation on the characters.xp column.
   * Clamps via MAX(0, xp + delta) to prevent negative XP.
   */
  updateXp(characterId: string, delta: number): void {
    const db = getDb()
    db.update(characters)
      .set({ xp: sql`MAX(0, xp + ${delta})` })
      .where(eq(characters.id, characterId))
      .run()
  },

  /**
   * Delta-based HP mutation on character_resources.
   * Clamps via MAX(0, MIN(hp_max, hp_current + delta)).
   */
  updateHp(characterId: string, delta: number): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characterResources)
      .set({
        hpCurrent: sql`MAX(0, MIN(hp_max, hp_current + ${delta}))`,
        updatedAt: now,
      })
      .where(eq(characterResources.characterId, characterId))
      .run()
  },

  /**
   * Delta-based temp HP mutation. Clamps at 0 minimum.
   */
  updateTempHp(characterId: string, delta: number): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characterResources)
      .set({
        hpTemp: sql`MAX(0, hp_temp + ${delta})`,
        updatedAt: now,
      })
      .where(eq(characterResources.characterId, characterId))
      .run()
  },

  /**
   * Delta-based currency mutation. Denomination in {cp, sp, ep, gp, pp}. Clamps at 0.
   */
  updateCurrency(
    characterId: string,
    denomination: 'cp' | 'sp' | 'ep' | 'gp' | 'pp',
    delta: number,
  ): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characterResources)
      .set({
        [denomination]: sql`MAX(0, ${sql.raw(denomination)} + ${delta})`,
        updatedAt: now,
      })
      .where(eq(characterResources.characterId, characterId))
      .run()
  },

  /**
   * Update a spell slot's used count for a given slot level.
   * Reads → parses → mutates in-memory → stringifies → writes back atomically.
   * Used count is clamped to [0, max].
   */
  updateSpellSlot(characterId: string, slotLevel: string, delta: number): void {
    const db = getDb()
    const now = new Date(Date.now())

    db.transaction((tx) => {
      const res = tx
        .select({ spellSlots: characterResources.spellSlots })
        .from(characterResources)
        .where(eq(characterResources.characterId, characterId))
        .get()

      if (!res) return

      const slots = JSON.parse(res.spellSlots) as SpellSlotMap
      const slot = slots[slotLevel]
      if (!slot) return

      const newUsed = Math.max(0, Math.min(slot.max, slot.used + delta))
      slots[slotLevel] = { ...slot, used: newUsed }

      tx.update(characterResources)
        .set({ spellSlots: JSON.stringify(slots), updatedAt: now })
        .where(eq(characterResources.characterId, characterId))
        .run()
    })
  },

  /**
   * Toggle a condition on/off.
   * Reads → parses conditions array → adds or removes → stringifies → writes.
   */
  toggleCondition(characterId: string, condition: string): void {
    const db = getDb()
    const now = new Date(Date.now())

    db.transaction((tx) => {
      const res = tx
        .select({ conditions: characterResources.conditions })
        .from(characterResources)
        .where(eq(characterResources.characterId, characterId))
        .get()

      if (!res) return

      const conditions = JSON.parse(res.conditions) as string[]
      const idx = conditions.indexOf(condition)
      if (idx >= 0) {
        conditions.splice(idx, 1)
      } else {
        conditions.push(condition)
      }

      tx.update(characterResources)
        .set({ conditions: JSON.stringify(conditions), updatedAt: now })
        .where(eq(characterResources.characterId, characterId))
        .run()
    })
  },

  /**
   * Set death save counts to absolute values (0-3 each).
   * Toggle behavior is handled in the renderer.
   */
  updateDeathSaves(characterId: string, successes: number, failures: number): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characterResources)
      .set({
        deathSaveSuccesses: Math.max(0, Math.min(3, successes)),
        deathSaveFailures: Math.max(0, Math.min(3, failures)),
        updatedAt: now,
      })
      .where(eq(characterResources.characterId, characterId))
      .run()
  },

  /**
   * Flip the hasInspiration boolean.
   */
  toggleInspiration(characterId: string): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characterResources)
      .set({
        hasInspiration: sql`NOT has_inspiration`,
        updatedAt: now,
      })
      .where(eq(characterResources.characterId, characterId))
      .run()
  },

  /**
   * Flip the isAttuned boolean on a character_items row.
   */
  toggleItemAttuned(itemId: string): void {
    const db = getDb()
    db.update(characterItems)
      .set({ isAttuned: sql`NOT is_attuned` })
      .where(eq(characterItems.id, itemId))
      .run()
  },

  /**
   * Update the portrait path (relative path under userData/images/{campaignId}/).
   */
  updatePortraitPath(characterId: string, relativePath: string): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characters)
      .set({ portraitPath: relativePath, updatedAt: now })
      .where(eq(characters.id, characterId))
      .run()
  },

  /**
   * Level up a character: increment level (capped at 20), increase hpMax and hpCurrent
   * by hpGain, and merge the provided newSlotMax into the spellSlots JSON (preserving
   * existing `used` counts, defaulting `used` to 0 for newly added slot levels).
   * (D-31, D-32, T-05-06-01)
   */
  levelUp(characterId: string, hpGain: number, newSlotMax: Record<string, number>): void {
    const db = getDb()
    const now = new Date(Date.now())

    db.transaction((tx) => {
      // Increment level, capped at 20
      tx.update(characters)
        .set({ level: sql`MIN(20, level + 1)`, updatedAt: now })
        .where(eq(characters.id, characterId))
        .run()

      // Increase HP
      tx.update(characterResources)
        .set({
          hpMax: sql`hp_max + ${hpGain}`,
          hpCurrent: sql`hp_current + ${hpGain}`,
          updatedAt: now,
        })
        .where(eq(characterResources.characterId, characterId))
        .run()

      // Merge spell slot max changes (preserves used counts)
      if (Object.keys(newSlotMax).length > 0) {
        const res = tx
          .select({ spellSlots: characterResources.spellSlots })
          .from(characterResources)
          .where(eq(characterResources.characterId, characterId))
          .get()

        if (res) {
          const slots = JSON.parse(res.spellSlots) as SpellSlotMap
          for (const [level, max] of Object.entries(newSlotMax)) {
            const existing = slots[level]
            if (existing) {
              // Preserve used count, update max
              slots[level] = { used: existing.used, max }
            } else {
              // New slot level — default used to 0
              slots[level] = { used: 0, max }
            }
          }
          tx.update(characterResources)
            .set({ spellSlots: JSON.stringify(slots), updatedAt: now })
            .where(eq(characterResources.characterId, characterId))
            .run()
        }
      }
    })
  },

  /**
   * Apply short-rest HP recovery: increase hpCurrent (clamped to hpMax) and
   * decrement hitDiceCurrent by the dice spent (clamped at 0).
   * (D-36, T-05-06-01)
   */
  applyShortRestHp(characterId: string, hpRecovered: number, diceSpent: number): void {
    const db = getDb()
    const now = new Date(Date.now())
    db.update(characterResources)
      .set({
        hpCurrent: sql`MIN(hp_max, hp_current + ${hpRecovered})`,
        hitDiceCurrent: sql`MAX(0, COALESCE(hit_dice_current, 0) - ${diceSpent})`,
        updatedAt: now,
      })
      .where(eq(characterResources.characterId, characterId))
      .run()
  },
}
