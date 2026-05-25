import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  coverImagePath: text('cover_image_path'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert

export const characters = sqliteTable(
  'characters',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    race: text('race').notNull(),
    subrace: text('subrace'),
    class: text('class').notNull(),
    subclass: text('subclass'),
    background: text('background').notNull(),
    level: integer('level').notNull().default(1),
    xp: integer('xp').notNull().default(0),
    backstory: text('backstory'),
    // Ability scores (base + racial bonuses already applied)
    strength: integer('strength').notNull(),
    dexterity: integer('dexterity').notNull(),
    constitution: integer('constitution').notNull(),
    intelligence: integer('intelligence').notNull(),
    wisdom: integer('wisdom').notNull(),
    charisma: integer('charisma').notNull(),
    // Proficiency selections (JSON arrays)
    savingThrowProficiencies: text('saving_throw_proficiencies').notNull().default('[]'),
    skillProficiencies: text('skill_proficiencies').notNull().default('[]'),
    skillExpertise: text('skill_expertise').notNull().default('[]'),
    // Auto-calculated stats
    ac: integer('ac').notNull(),
    initiativeBonus: integer('initiative_bonus').notNull(),
    speed: integer('speed').notNull(),
    proficiencyBonus: integer('proficiency_bonus').notNull().default(2),
    // Language and tool proficiencies (JSON arrays of strings)
    languages: text('languages').notNull().default('[]'),
    toolProficiencies: text('tool_proficiencies').notNull().default('[]'),
    armorProficiencies: text('armor_proficiencies').notNull().default('[]'),
    weaponProficiencies: text('weapon_proficiencies').notNull().default('[]'),
    // Traits text (denormalized from content JSON for fast display)
    racialTraitsText: text('racial_traits_text'),
    classFeatureText: text('class_feature_text'),
    backgroundFeatureText: text('background_feature_text'),
    // Equipment package chosen
    equipmentPackage: text('equipment_package'),
    // Images
    portraitPath: text('portrait_path'),
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    // D-03: one character per campaign in Phase 2
    uniqueCampaign: unique().on(table.campaignId),
  }),
)

export type Character = typeof characters.$inferSelect
export type NewCharacter = typeof characters.$inferInsert

export const characterResources = sqliteTable('character_resources', {
  id: text('id').primaryKey(),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  // HP
  hpCurrent: integer('hp_current').notNull(),
  hpMax: integer('hp_max').notNull(),
  hpTemp: integer('hp_temp').notNull().default(0),
  // Spell slots: stored as JSON per slot level { "1": {used:0,max:2}, ... }
  spellSlots: text('spell_slots').notNull().default('{}'),
  // Currency
  cp: integer('cp').notNull().default(0),
  sp: integer('sp').notNull().default(0),
  ep: integer('ep').notNull().default(0),
  gp: integer('gp').notNull().default(0),
  pp: integer('pp').notNull().default(0),
  // Conditions: JSON array of active condition strings
  conditions: text('conditions').notNull().default('[]'),
  // Death saves
  deathSaveSuccesses: integer('death_save_successes').notNull().default(0),
  deathSaveFailures: integer('death_save_failures').notNull().default(0),
  // Inspiration
  hasInspiration: integer('has_inspiration', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type CharacterResources = typeof characterResources.$inferSelect
export type NewCharacterResources = typeof characterResources.$inferInsert

export const characterItems = sqliteTable('character_items', {
  id: text('id').primaryKey(),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  weight: real('weight').notNull().default(0),
  isAttuned: integer('is_attuned', { mode: 'boolean' }).notNull().default(false),
  isMagic: integer('is_magic', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type CharacterItem = typeof characterItems.$inferSelect
export type NewCharacterItem = typeof characterItems.$inferInsert
