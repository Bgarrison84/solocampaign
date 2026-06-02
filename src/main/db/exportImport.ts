/**
 * Campaign export/import for DIST-01 and DIST-03 dispatch groundwork.
 *
 * exportCampaign  — SELECT all 15 tables, return typed payload
 * importCampaign  — UUID remap + FK-ordered transactional INSERT
 * importCampaignOrTemplate — version/type dispatcher
 *
 * Security: all ids regenerated via crypto.randomUUID (T-08-10).
 * API keys are in SecretStorageService, not SQLite — no exclusion needed (T-08-07).
 * portraitPath / coverImagePath set to null on import (binary not portable).
 */

import { randomUUID } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import log from 'electron-log'
import { getDb } from './index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single row from the campaigns table (all columns). */
// biome-ignore lint: known any type needed for raw DB rows
export type RawRow = Record<string, unknown>

export interface CampaignExportData {
  campaign: RawRow
  customFeats: RawRow[]
  sessions: RawRow[]
  characters: RawRow[]
  characterResources: RawRow[]
  characterItems: RawRow[]
  characterSpells: RawRow[]
  characterFeats: RawRow[]
  messages: RawRow[]
  combatants: RawRow[]
  campaignEvents: RawRow[]
  quests: RawRow[]
  npcs: RawRow[]
  factions: RawRow[]
  campaignReferenceDocs: RawRow[]
}

export interface CampaignExportPayload {
  version: 1
  type: 'campaignExport'
  exportedAt: string
  data: CampaignExportData
}

export interface StarterTemplatePayload {
  version: 1
  type: 'starterTemplate'
  exportedAt: string
  name: string
  worldSetupMode: string
  worldBrief: string | null
  worldDocument: string | null
  dmPersonality: string
  strictness: string
  partySize: number
  encumbranceEnabled: boolean
  homebrewContent: string | null
}

export type ImportResult =
  | { kind: 'campaign'; campaignId: string }
  | { kind: 'template'; template: StarterTemplatePayload }

// ---------------------------------------------------------------------------
// exportCampaign
// ---------------------------------------------------------------------------

/**
 * Serialize the full campaign (all 15 tables) to a CampaignExportPayload.
 * Reads via raw better-sqlite3 ($client) so we get plain object rows without
 * Drizzle type overhead, making UUID remapping straightforward.
 */
export function exportCampaign(campaignId: string): CampaignExportPayload {
  try {
    const sqlite = getDb().$client

    // Campaign row
    const campaign = sqlite
      .prepare('SELECT * FROM campaigns WHERE id = ?')
      .get(campaignId) as RawRow

    if (!campaign) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Campaign ${campaignId} not found` })
    }

    // Custom feats (referenced by character_feats.custom_feat_id — must be fetched early)
    const customFeats = sqlite
      .prepare('SELECT * FROM custom_feats WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // Sessions
    const sessions = sqlite
      .prepare('SELECT * FROM sessions WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // Characters
    const characters = sqlite
      .prepare('SELECT * FROM characters WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    const characterIds = characters.map((c) => c.id as string)

    // Character resources (keyed by character_id)
    const characterResources =
      characterIds.length > 0
        ? (sqlite
            .prepare(
              `SELECT * FROM character_resources WHERE character_id IN (${characterIds.map(() => '?').join(',')})`,
            )
            .all(...characterIds) as RawRow[])
        : []

    // Character items
    const characterItems =
      characterIds.length > 0
        ? (sqlite
            .prepare(
              `SELECT * FROM character_items WHERE character_id IN (${characterIds.map(() => '?').join(',')})`,
            )
            .all(...characterIds) as RawRow[])
        : []

    // Character spells
    const characterSpells =
      characterIds.length > 0
        ? (sqlite
            .prepare(
              `SELECT * FROM character_spells WHERE character_id IN (${characterIds.map(() => '?').join(',')})`,
            )
            .all(...characterIds) as RawRow[])
        : []

    // Character feats (may reference custom_feat_id)
    const characterFeats =
      characterIds.length > 0
        ? (sqlite
            .prepare(
              `SELECT * FROM character_feats WHERE character_id IN (${characterIds.map(() => '?').join(',')})`,
            )
            .all(...characterIds) as RawRow[])
        : []

    // Messages
    const messages = sqlite
      .prepare('SELECT * FROM messages WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // Combatants
    const combatants = sqlite
      .prepare('SELECT * FROM combatants WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // Campaign events
    const campaignEvents = sqlite
      .prepare('SELECT * FROM campaign_events WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // Quests
    const quests = sqlite
      .prepare('SELECT * FROM quests WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // NPCs
    const npcs = sqlite
      .prepare('SELECT * FROM npcs WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // Factions
    const factions = sqlite
      .prepare('SELECT * FROM factions WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    // Campaign reference docs
    const campaignReferenceDocs = sqlite
      .prepare('SELECT * FROM campaign_reference_docs WHERE campaign_id = ?')
      .all(campaignId) as RawRow[]

    return {
      version: 1,
      type: 'campaignExport',
      exportedAt: new Date().toISOString(),
      data: {
        campaign,
        customFeats,
        sessions,
        characters,
        characterResources,
        characterItems,
        characterSpells,
        characterFeats,
        messages,
        combatants,
        campaignEvents,
        quests,
        npcs,
        factions,
        campaignReferenceDocs,
      },
    }
  } catch (err) {
    log.error('[exportImport] exportCampaign failed:', err)
    throw err
  }
}

// ---------------------------------------------------------------------------
// importCampaign
// ---------------------------------------------------------------------------

/**
 * Import a CampaignExportPayload into the DB.
 * All ids are regenerated via crypto.randomUUID — no old id survives (T-08-10).
 * Inserts in FK-safe order inside a single transaction that rolls back on any error.
 * Returns the new campaign id.
 */
export function importCampaign(payload: CampaignExportPayload): string {
  if (payload.version !== 1 || payload.type !== 'campaignExport') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'importCampaign called with an incompatible payload. Use importCampaignOrTemplate.',
    })
  }

  try {
    const sqlite = getDb().$client

    // UUID remap helper — lazily assigns new UUIDs keyed by old UUID
    const idMap = new Map<string, string>()
    function remap(oldId: string | null | undefined): string | null {
      if (oldId == null) return null
      if (!idMap.has(oldId)) {
        idMap.set(oldId, randomUUID())
      }
      return idMap.get(oldId)!
    }

    // Pre-generate the new campaign id now so we can reference it inline
    const newCampaignId = remap(payload.data.campaign.id as string)!

    // Pre-register all entity ids so they are consistent across tables
    for (const row of payload.data.customFeats) remap(row.id as string)
    for (const row of payload.data.sessions) remap(row.id as string)
    for (const row of payload.data.characters) remap(row.id as string)
    for (const row of payload.data.characterResources) remap(row.id as string)
    for (const row of payload.data.characterItems) remap(row.id as string)
    for (const row of payload.data.characterSpells) remap(row.id as string)
    for (const row of payload.data.characterFeats) remap(row.id as string)
    for (const row of payload.data.messages) remap(row.id as string)
    for (const row of payload.data.combatants) remap(row.id as string)
    for (const row of payload.data.campaignEvents) remap(row.id as string)
    for (const row of payload.data.quests) remap(row.id as string)
    for (const row of payload.data.npcs) remap(row.id as string)
    for (const row of payload.data.factions) remap(row.id as string)
    for (const row of payload.data.campaignReferenceDocs) remap(row.id as string)

    const insertAll = sqlite.transaction(() => {
      const { data } = payload

      // 1. campaigns
      {
        const c = data.campaign
        sqlite
          .prepare(
            `INSERT INTO campaigns (id, name, cover_image_path, created_at, provider_type,
              endpoint_url, model_name, reference_docs, dm_personality, strictness,
              fallback_endpoint_url, fallback_model_name, rolling_summary, permadeath_mode,
              world_time_of_day, world_day_number, world_season, world_location_path,
              party_size, world_setup_mode, world_brief, world_document,
              encumbrance_enabled, homebrew_content)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            newCampaignId,
            c.name,
            null, // cover_image_path — binary not portable
            c.created_at,
            c.provider_type,
            c.endpoint_url,
            c.model_name,
            c.reference_docs ?? '[]',
            c.dm_personality,
            c.strictness ?? 'balanced',
            c.fallback_endpoint_url,
            c.fallback_model_name,
            c.rolling_summary,
            c.permadeath_mode ?? 0,
            c.world_time_of_day,
            c.world_day_number,
            c.world_season,
            c.world_location_path,
            c.party_size ?? 1,
            c.world_setup_mode,
            c.world_brief,
            c.world_document,
            c.encumbrance_enabled ?? 0,
            c.homebrew_content,
          )
      }

      // 2. custom_feats (before character_feats — FK: character_feats.custom_feat_id)
      const insertCustomFeat = sqlite.prepare(
        `INSERT INTO custom_feats (id, campaign_id, name, description, created_at) VALUES (?,?,?,?,?)`,
      )
      for (const cf of data.customFeats) {
        insertCustomFeat.run(remap(cf.id as string), newCampaignId, cf.name, cf.description ?? '', cf.created_at)
      }

      // 3. sessions (before messages / combatants / campaign_events — nullable FK)
      const insertSession = sqlite.prepare(
        `INSERT INTO sessions (id, campaign_id, session_number, started_at, ended_at,
           location, goal, context_notes, ai_recap, player_notes, is_summarized)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      for (const s of data.sessions) {
        insertSession.run(
          remap(s.id as string),
          newCampaignId,
          s.session_number,
          s.started_at,
          s.ended_at,
          s.location,
          s.goal,
          s.context_notes,
          s.ai_recap,
          s.player_notes,
          s.is_summarized ?? 0,
        )
      }

      // 4. characters (before character_resources / items / spells / feats)
      const insertCharacter = sqlite.prepare(
        `INSERT INTO characters (id, campaign_id, name, race, subrace, class, subclass,
           background, level, xp, backstory, strength, dexterity, constitution, intelligence,
           wisdom, charisma, saving_throw_proficiencies, skill_proficiencies, skill_expertise,
           ac, initiative_bonus, speed, proficiency_bonus, languages, tool_proficiencies,
           armor_proficiencies, weapon_proficiencies, racial_traits_text, class_feature_text,
           background_feature_text, equipment_package, portrait_path, created_at, updated_at,
           classes, is_companion, negative_traits)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      for (const ch of data.characters) {
        insertCharacter.run(
          remap(ch.id as string),
          newCampaignId,
          ch.name,
          ch.race,
          ch.subrace,
          ch.class,
          ch.subclass,
          ch.background,
          ch.level ?? 1,
          ch.xp ?? 0,
          ch.backstory,
          ch.strength,
          ch.dexterity,
          ch.constitution,
          ch.intelligence,
          ch.wisdom,
          ch.charisma,
          ch.saving_throw_proficiencies ?? '[]',
          ch.skill_proficiencies ?? '[]',
          ch.skill_expertise ?? '[]',
          ch.ac,
          ch.initiative_bonus,
          ch.speed,
          ch.proficiency_bonus ?? 2,
          ch.languages ?? '[]',
          ch.tool_proficiencies ?? '[]',
          ch.armor_proficiencies ?? '[]',
          ch.weapon_proficiencies ?? '[]',
          ch.racial_traits_text,
          ch.class_feature_text,
          ch.background_feature_text,
          ch.equipment_package,
          null, // portrait_path — binary not portable
          ch.created_at,
          ch.updated_at,
          ch.classes,
          ch.is_companion ?? 0,
          ch.negative_traits,
        )
      }

      // 5. character_resources
      const insertCharRes = sqlite.prepare(
        `INSERT INTO character_resources (id, character_id, hp_current, hp_max, hp_temp,
           spell_slots, cp, sp, ep, gp, pp, conditions, death_save_successes,
           death_save_failures, has_inspiration, concentrating_on, hit_dice_current,
           hit_dice_total, pact_slots, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      for (const r of data.characterResources) {
        insertCharRes.run(
          remap(r.id as string),
          remap(r.character_id as string),
          r.hp_current,
          r.hp_max,
          r.hp_temp ?? 0,
          r.spell_slots ?? '{}',
          r.cp ?? 0,
          r.sp ?? 0,
          r.ep ?? 0,
          r.gp ?? 0,
          r.pp ?? 0,
          r.conditions ?? '[]',
          r.death_save_successes ?? 0,
          r.death_save_failures ?? 0,
          r.has_inspiration ?? 0,
          r.concentrating_on,
          r.hit_dice_current,
          r.hit_dice_total,
          r.pact_slots ?? '{}',
          r.updated_at,
        )
      }

      // 6. character_items
      const insertCharItem = sqlite.prepare(
        `INSERT INTO character_items (id, character_id, name, quantity, weight,
           is_attuned, is_magic, description, sort_order, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      for (const item of data.characterItems) {
        insertCharItem.run(
          remap(item.id as string),
          remap(item.character_id as string),
          item.name,
          item.quantity ?? 1,
          item.weight ?? 0,
          item.is_attuned ?? 0,
          item.is_magic ?? 0,
          item.description,
          item.sort_order ?? 0,
          item.created_at,
        )
      }

      // 7. character_spells
      const insertCharSpell = sqlite.prepare(
        `INSERT INTO character_spells (id, character_id, spell_name, spell_level, is_prepared)
         VALUES (?,?,?,?,?)`,
      )
      for (const sp of data.characterSpells) {
        insertCharSpell.run(
          remap(sp.id as string),
          remap(sp.character_id as string),
          sp.spell_name,
          sp.spell_level ?? 0,
          sp.is_prepared ?? 1,
        )
      }

      // 8. character_feats (custom_feat_id is nullable — remap if present)
      const insertCharFeat = sqlite.prepare(
        `INSERT INTO character_feats (id, character_id, feat_name, feat_source, custom_feat_id, created_at)
         VALUES (?,?,?,?,?,?)`,
      )
      for (const cf of data.characterFeats) {
        insertCharFeat.run(
          remap(cf.id as string),
          remap(cf.character_id as string),
          cf.feat_name,
          cf.feat_source ?? 'srd',
          remap(cf.custom_feat_id as string | null),
          cf.created_at,
        )
      }

      // 9. messages (session_id nullable)
      const insertMsg = sqlite.prepare(
        `INSERT INTO messages (id, campaign_id, role, content, created_at, session_id)
         VALUES (?,?,?,?,?,?)`,
      )
      for (const m of data.messages) {
        insertMsg.run(
          remap(m.id as string),
          newCampaignId,
          m.role,
          m.content,
          m.created_at,
          remap(m.session_id as string | null),
        )
      }

      // 10. combatants (session_id nullable)
      const insertCombatant = sqlite.prepare(
        `INSERT INTO combatants (id, campaign_id, session_id, name, hp_current, hp_max,
           ac, initiative, initiative_order, conditions, is_player, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      for (const cb of data.combatants) {
        insertCombatant.run(
          remap(cb.id as string),
          newCampaignId,
          remap(cb.session_id as string | null),
          cb.name,
          cb.hp_current,
          cb.hp_max,
          cb.ac ?? 10,
          cb.initiative ?? 0,
          cb.initiative_order ?? 0,
          cb.conditions ?? '[]',
          cb.is_player ?? 0,
          cb.is_active ?? 1,
        )
      }

      // 11. campaign_events (session_id nullable)
      const insertEvent = sqlite.prepare(
        `INSERT INTO campaign_events (id, campaign_id, session_id, event_type, payload, created_at)
         VALUES (?,?,?,?,?,?)`,
      )
      for (const ev of data.campaignEvents) {
        insertEvent.run(
          remap(ev.id as string),
          newCampaignId,
          remap(ev.session_id as string | null),
          ev.event_type,
          ev.payload ?? '{}',
          ev.created_at,
        )
      }

      // 12. quests
      const insertQuest = sqlite.prepare(
        `INSERT INTO quests (id, campaign_id, name, description, status, created_at)
         VALUES (?,?,?,?,?,?)`,
      )
      for (const q of data.quests) {
        insertQuest.run(
          remap(q.id as string),
          newCampaignId,
          q.name,
          q.description ?? '',
          q.status ?? 'Active',
          q.created_at,
        )
      }

      // 13. npcs
      const insertNpc = sqlite.prepare(
        `INSERT INTO npcs (id, campaign_id, name, description, relationship, faction_name, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      for (const n of data.npcs) {
        insertNpc.run(
          remap(n.id as string),
          newCampaignId,
          n.name,
          n.description ?? '',
          n.relationship ?? 'Unknown',
          n.faction_name,
          n.created_at,
        )
      }

      // 14. factions (UNIQUE(campaign_id, name) — new campaign_id makes it safe)
      const insertFaction = sqlite.prepare(
        `INSERT INTO factions (id, campaign_id, name, tier, created_at) VALUES (?,?,?,?,?)`,
      )
      for (const f of data.factions) {
        insertFaction.run(
          remap(f.id as string),
          newCampaignId,
          f.name,
          f.tier ?? 'Neutral',
          f.created_at,
        )
      }

      // 15. campaign_reference_docs
      const insertDoc = sqlite.prepare(
        `INSERT INTO campaign_reference_docs (id, campaign_id, filename, content, created_at)
         VALUES (?,?,?,?,?)`,
      )
      for (const d of data.campaignReferenceDocs) {
        insertDoc.run(
          remap(d.id as string),
          newCampaignId,
          d.filename,
          d.content ?? '',
          d.created_at,
        )
      }
    })

    insertAll()

    log.info('[exportImport] importCampaign complete, newCampaignId:', newCampaignId)
    return newCampaignId
  } catch (err) {
    log.error('[exportImport] importCampaign failed:', err)
    throw err
  }
}

// ---------------------------------------------------------------------------
// importCampaignOrTemplate
// ---------------------------------------------------------------------------

/**
 * Top-level version/type dispatcher.
 * - version !== 1 → "newer version" error (T-08-06)
 * - type === 'campaignExport' → importCampaign
 * - type === 'starterTemplate' → return template fields (no DB write)
 * - other → "Unrecognized file format" error
 */
export function importCampaignOrTemplate(parsed: unknown): ImportResult {
  const p = parsed as { version?: unknown; type?: unknown }

  if (p.version !== 1) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'This export was created with a newer version of SoloCampaign. Update the app to import it.',
    })
  }

  if (p.type === 'campaignExport') {
    const campaignId = importCampaign(parsed as CampaignExportPayload)
    return { kind: 'campaign', campaignId }
  }

  if (p.type === 'starterTemplate') {
    return { kind: 'template', template: parsed as StarterTemplatePayload }
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Unrecognized file format. Expected a SoloCampaign campaign export or starter template.',
  })
}
