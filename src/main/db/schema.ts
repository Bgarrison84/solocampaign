import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  coverImagePath: text('cover_image_path'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  // AI config columns — D-07 (no api_key: keys live in SecretStorageService only — D-08/D-23)
  providerType: text('provider_type'),
  endpointUrl: text('endpoint_url'),
  modelName: text('model_name'),
  referenceDocs: text('reference_docs').notNull().default('[]'),
  dmPersonality: text('dm_personality'),
  strictness: text('strictness').notNull().default('balanced'),
  fallbackEndpointUrl: text('fallback_endpoint_url'),
  fallbackModelName: text('fallback_model_name'),
  // D-21: Layer 3 rolling campaign summary (regenerated at each session end)
  rollingSummary: text('rolling_summary'),
  // Phase 5 (PROG-04): permadeath mode — when true, death at 0 HP is final
  permadeathMode: integer('permadeath_mode', { mode: 'boolean' }).notNull().default(false),
  // Phase 6 (STATE-04, WORLD-03): in-world state columns — all nullable, AI-managed
  worldTimeOfDay: text('world_time_of_day'),
  worldDayNumber: integer('world_day_number'),
  worldSeason: text('world_season'),
  worldLocationPath: text('world_location_path'),
  // Phase 7 (PARTY-01): party size at campaign creation (1–4)
  partySize: integer('party_size').notNull().default(1),
  // Phase 7 (WORLD-01): world setup mode ('ai' | 'brief' | 'import' — nullable for legacy)
  worldSetupMode: text('world_setup_mode'),
  // Phase 7 (WORLD-01): AI-generated or player-written world brief (~500–800 words)
  worldBrief: text('world_brief'),
  // Phase 7 (WORLD-01/RULES-04): imported world document (PDF/text extracted content)
  worldDocument: text('world_document'),
  // Phase 7 (STATE-06): encumbrance tracking toggle (default off)
  encumbranceEnabled: integer('encumbrance_enabled', { mode: 'boolean' }).notNull().default(false),
  // Phase 7 (RULES-03): free-form homebrew content (text injected into AI context)
  homebrewContent: text('homebrew_content'),
})

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert

// D-19: Sessions table — one row per play session per campaign
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sessionNumber: integer('session_number').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    // nullable — null while session is active
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    // Session start context fields (all optional)
    location: text('location'),
    goal: text('goal'),
    contextNotes: text('context_notes'),
    // End-of-session content
    aiRecap: text('ai_recap'),
    playerNotes: text('player_notes'),
    // D-19: set true when Layer 3 rolling summary has incorporated this session
    isSummarized: integer('is_summarized', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => ({
    // WR-04: enforce uniqueness at DB level so duplicate session numbers cannot be written
    uniqueCampaignSession: unique().on(table.campaignId, table.sessionNumber),
  }),
)

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

// Messages table — D-17: one continuous chat per campaign
// D-20: session_id nullable FK added in Phase 4; rows from Phase 3 get session_id = NULL
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  // D-20: nullable FK to sessions — no ON DELETE SET NULL (SQLite rejects on ALTER TABLE ADD)
  sessionId: text('session_id').references(() => sessions.id),
})

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

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
    // Phase 7 (CHAR-04): multiclass classes JSON array [{className, level, subclass?}]; null for single-class characters
    classes: text('classes'),
    // Phase 7 (PARTY-02): true for familiars, animal companions, and summoned creatures
    isCompanion: integer('is_companion', { mode: 'boolean' }).notNull().default(false),
    // Phase 7 (CHAR-03): negative traits JSON {presetFlaws: string[], freeFormFlaws: string[]}
    negativeTraits: text('negative_traits'),
    // Phase 7 (PARTY-01): uniqueCampaign removed — multiple characters per campaign now supported.
    // The unique index is dropped in migration 0007 via DROP INDEX IF EXISTS characters_campaign_id_unique.
    // Application-level enforcement via charactersRepo (partySize check).
  },
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
  // Phase 5: concentration tracking (D-25, Pitfall 8) — nullable
  concentratingOn: text('concentrating_on'),
  // Phase 5: hit dice for short-rest healing — nullable until seeded
  hitDiceCurrent: integer('hit_dice_current'),
  hitDiceTotal: integer('hit_dice_total'),
  // Phase 5: warlock pact magic slots — JSON { "1": {used:0,max:1}, ... }
  pactSlots: text('pact_slots').notNull().default('{}'),
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

// Phase 5 (COMB-02): combatants — initiative tracker rows per campaign/session.
export const combatants = sqliteTable('combatants', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  // nullable FK — combat may begin outside a tracked session
  sessionId: text('session_id').references(() => sessions.id),
  name: text('name').notNull(),
  hpCurrent: integer('hp_current').notNull(),
  hpMax: integer('hp_max').notNull(),
  ac: integer('ac').notNull().default(10),
  initiative: integer('initiative').notNull().default(0),
  initiativeOrder: integer('initiative_order').notNull().default(0),
  // JSON array of active condition strings
  conditions: text('conditions').notNull().default('[]'),
  isPlayer: integer('is_player', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export type Combatant = typeof combatants.$inferSelect
export type NewCombatant = typeof combatants.$inferInsert

// Phase 5 (STATE-05): campaign_events — append-only mechanical event log.
export const campaignEvents = sqliteTable('campaign_events', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  // nullable FK — events may occur outside a tracked session
  sessionId: text('session_id').references(() => sessions.id),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type CampaignEvent = typeof campaignEvents.$inferSelect
export type NewCampaignEvent = typeof campaignEvents.$inferInsert

// Phase 5 (CHAR-08): character_spells — per-character known/prepared spell list.
export const characterSpells = sqliteTable('character_spells', {
  id: text('id').primaryKey(),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  spellName: text('spell_name').notNull(),
  spellLevel: integer('spell_level').notNull().default(0),
  isPrepared: integer('is_prepared', { mode: 'boolean' }).notNull().default(true),
})

export type CharacterSpell = typeof characterSpells.$inferSelect
export type NewCharacterSpell = typeof characterSpells.$inferInsert

// ============ Phase 6: Quests, NPCs, Factions ============

// STATE-01: quests — AI-managed quest log per campaign
export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('Active'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type Quest = typeof quests.$inferSelect
export type NewQuest = typeof quests.$inferInsert

// STATE-02: npcs — AI-tracked NPCs per campaign
export const npcs = sqliteTable('npcs', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  relationship: text('relationship').notNull().default('Unknown'),
  factionName: text('faction_name'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type Npc = typeof npcs.$inferSelect
export type NewNpc = typeof npcs.$inferInsert

// STATE-03: factions — AI-tracked factions with campaign-scoped unique name
export const factions = sqliteTable(
  'factions',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tier: text('tier').notNull().default('Neutral'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    // Pitfall 5: campaign-scoped unique name prevents duplicate faction rows on repeated upserts
    uniqueCampaignName: unique('factions_campaign_name_unique').on(table.campaignId, table.name),
  }),
)

export type Faction = typeof factions.$inferSelect
export type NewFaction = typeof factions.$inferInsert

// ============ Phase 7: Content Depth & Advanced Character ============

// Phase 7 (CHAR-05, RULES-03): custom_feats — campaign-scoped homebrew feats (name + description only)
// Must be declared BEFORE characterFeats due to FK reference from characterFeats.customFeatId → customFeats.id.
export const customFeats = sqliteTable('custom_feats', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type CustomFeat = typeof customFeats.$inferSelect
export type NewCustomFeat = typeof customFeats.$inferInsert

// Phase 7 (CHAR-05, PROG-03): character_feats — feats acquired by a character
// feat_source: 'srd' | 'custom' | 'epic_boon'
export const characterFeats = sqliteTable('character_feats', {
  id: text('id').primaryKey(),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  featName: text('feat_name').notNull(),
  featSource: text('feat_source').notNull().default('srd'),
  customFeatId: text('custom_feat_id').references(() => customFeats.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type CharacterFeat = typeof characterFeats.$inferSelect
export type NewCharacterFeat = typeof characterFeats.$inferInsert

// Phase 7 (RULES-04, WORLD-01): campaign_reference_docs — user-imported PDF/text docs per campaign
// Content is capped at 50,000 chars at write time in campaignReferenceDocsRepo (Pitfall 7).
export const campaignReferenceDocs = sqliteTable('campaign_reference_docs', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  content: text('content').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type CampaignReferenceDoc = typeof campaignReferenceDocs.$inferSelect
export type NewCampaignReferenceDoc = typeof campaignReferenceDocs.$inferInsert
