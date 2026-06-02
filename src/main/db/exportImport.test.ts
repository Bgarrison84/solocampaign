/**
 * Tests for exportImport.ts (Phase 8 — DIST-01, DIST-03).
 * Wave 0 tests: verify export serialization, UUID remapping, FK-ordered transactional
 * insert, rollback on constraint failure, version/type validation, and dispatcher logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

// Mock electron modules
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/test'), isPackaged: false },
}))
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// We mock getDb() so our tests run against an in-memory DB
vi.mock('./index', () => ({
  getDb: vi.fn(),
}))

import { getDb } from './index'
import {
  exportCampaign,
  importCampaign,
  importCampaignOrTemplate,
} from './exportImport'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')

  // Create the schema tables in FK-safe order (same as migration)
  sqlite.exec(`
    CREATE TABLE campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cover_image_path TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      provider_type TEXT,
      endpoint_url TEXT,
      model_name TEXT,
      reference_docs TEXT NOT NULL DEFAULT '[]',
      dm_personality TEXT,
      strictness TEXT NOT NULL DEFAULT 'balanced',
      fallback_endpoint_url TEXT,
      fallback_model_name TEXT,
      rolling_summary TEXT,
      permadeath_mode INTEGER NOT NULL DEFAULT 0,
      world_time_of_day TEXT,
      world_day_number INTEGER,
      world_season TEXT,
      world_location_path TEXT,
      party_size INTEGER NOT NULL DEFAULT 1,
      world_setup_mode TEXT,
      world_brief TEXT,
      world_document TEXT,
      encumbrance_enabled INTEGER NOT NULL DEFAULT 0,
      homebrew_content TEXT
    );

    CREATE TABLE custom_feats (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      session_number INTEGER NOT NULL,
      started_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      ended_at INTEGER,
      location TEXT,
      goal TEXT,
      context_notes TEXT,
      ai_recap TEXT,
      player_notes TEXT,
      is_summarized INTEGER NOT NULL DEFAULT 0,
      UNIQUE(campaign_id, session_number)
    );

    CREATE TABLE characters (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      subrace TEXT,
      class TEXT NOT NULL,
      subclass TEXT,
      background TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      backstory TEXT,
      strength INTEGER NOT NULL,
      dexterity INTEGER NOT NULL,
      constitution INTEGER NOT NULL,
      intelligence INTEGER NOT NULL,
      wisdom INTEGER NOT NULL,
      charisma INTEGER NOT NULL,
      saving_throw_proficiencies TEXT NOT NULL DEFAULT '[]',
      skill_proficiencies TEXT NOT NULL DEFAULT '[]',
      skill_expertise TEXT NOT NULL DEFAULT '[]',
      ac INTEGER NOT NULL,
      initiative_bonus INTEGER NOT NULL,
      speed INTEGER NOT NULL,
      proficiency_bonus INTEGER NOT NULL DEFAULT 2,
      languages TEXT NOT NULL DEFAULT '[]',
      tool_proficiencies TEXT NOT NULL DEFAULT '[]',
      armor_proficiencies TEXT NOT NULL DEFAULT '[]',
      weapon_proficiencies TEXT NOT NULL DEFAULT '[]',
      racial_traits_text TEXT,
      class_feature_text TEXT,
      background_feature_text TEXT,
      equipment_package TEXT,
      portrait_path TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      classes TEXT,
      is_companion INTEGER NOT NULL DEFAULT 0,
      negative_traits TEXT
    );

    CREATE TABLE character_resources (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      hp_current INTEGER NOT NULL,
      hp_max INTEGER NOT NULL,
      hp_temp INTEGER NOT NULL DEFAULT 0,
      spell_slots TEXT NOT NULL DEFAULT '{}',
      cp INTEGER NOT NULL DEFAULT 0,
      sp INTEGER NOT NULL DEFAULT 0,
      ep INTEGER NOT NULL DEFAULT 0,
      gp INTEGER NOT NULL DEFAULT 0,
      pp INTEGER NOT NULL DEFAULT 0,
      conditions TEXT NOT NULL DEFAULT '[]',
      death_save_successes INTEGER NOT NULL DEFAULT 0,
      death_save_failures INTEGER NOT NULL DEFAULT 0,
      has_inspiration INTEGER NOT NULL DEFAULT 0,
      concentrating_on TEXT,
      hit_dice_current INTEGER,
      hit_dice_total INTEGER,
      pact_slots TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE character_items (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      weight REAL NOT NULL DEFAULT 0,
      is_attuned INTEGER NOT NULL DEFAULT 0,
      is_magic INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE character_spells (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      spell_name TEXT NOT NULL,
      spell_level INTEGER NOT NULL DEFAULT 0,
      is_prepared INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE character_feats (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      feat_name TEXT NOT NULL,
      feat_source TEXT NOT NULL DEFAULT 'srd',
      custom_feat_id TEXT REFERENCES custom_feats(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      session_id TEXT REFERENCES sessions(id)
    );

    CREATE TABLE combatants (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      session_id TEXT REFERENCES sessions(id),
      name TEXT NOT NULL,
      hp_current INTEGER NOT NULL,
      hp_max INTEGER NOT NULL,
      ac INTEGER NOT NULL DEFAULT 10,
      initiative INTEGER NOT NULL DEFAULT 0,
      initiative_order INTEGER NOT NULL DEFAULT 0,
      conditions TEXT NOT NULL DEFAULT '[]',
      is_player INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE campaign_events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      session_id TEXT REFERENCES sessions(id),
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE quests (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE npcs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      relationship TEXT NOT NULL DEFAULT 'Unknown',
      faction_name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE factions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'Neutral',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE(campaign_id, name)
    );

    CREATE TABLE campaign_reference_docs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `)

  return sqlite
}

function seedTestData(sqlite: ReturnType<typeof Database>) {
  const campaignId = 'test-campaign-id-1111-aaaa'
  const characterId = 'test-char-id-2222-bbbb'
  const sessionId = 'test-session-id-3333-cccc'
  const customFeatId = 'test-feat-id-4444-dddd'

  // Campaign
  sqlite
    .prepare(
      `INSERT INTO campaigns (id, name, party_size, strictness, reference_docs) VALUES (?, ?, 1, 'balanced', '[]')`,
    )
    .run(campaignId, 'Test Campaign')

  // Custom feat (must be before character_feats)
  sqlite
    .prepare(
      `INSERT INTO custom_feats (id, campaign_id, name, description) VALUES (?, ?, ?, ?)`,
    )
    .run(customFeatId, campaignId, 'Homebrew Feat', 'A custom feat')

  // Session
  sqlite
    .prepare(
      `INSERT INTO sessions (id, campaign_id, session_number) VALUES (?, ?, ?)`,
    )
    .run(sessionId, campaignId, 1)

  // Character
  sqlite
    .prepare(
      `INSERT INTO characters (id, campaign_id, name, race, class, background, strength, dexterity, constitution, intelligence, wisdom, charisma, ac, initiative_bonus, speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(characterId, campaignId, 'Aldric', 'Human', 'Fighter', 'Soldier', 16, 14, 14, 10, 12, 8, 16, 2, 30)

  // Character resources
  sqlite
    .prepare(
      `INSERT INTO character_resources (id, character_id, hp_current, hp_max) VALUES (?, ?, ?, ?)`,
    )
    .run('res-id-5555-eeee', characterId, 12, 12)

  // Character feat (with nullable customFeatId)
  sqlite
    .prepare(
      `INSERT INTO character_feats (id, character_id, feat_name, feat_source, custom_feat_id) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('cfeat-6666-ffff', characterId, 'Homebrew Feat', 'custom', customFeatId)

  // 2 Messages (one with sessionId, one without)
  sqlite
    .prepare(
      `INSERT INTO messages (id, campaign_id, role, content, session_id) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('msg-id-7777-gggg', campaignId, 'user', 'Hello', sessionId)
  sqlite
    .prepare(
      `INSERT INTO messages (id, campaign_id, role, content, session_id) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('msg-id-8888-hhhh', campaignId, 'assistant', 'Welcome!', null)

  // Quest
  sqlite
    .prepare(
      `INSERT INTO quests (id, campaign_id, name, description, status) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('quest-id-9999-iiii', campaignId, 'Find the Sword', 'A legendary sword', 'Active')

  // Faction
  sqlite
    .prepare(
      `INSERT INTO factions (id, campaign_id, name, tier) VALUES (?, ?, ?, ?)`,
    )
    .run('faction-aaaa-jjjj', campaignId, 'The Order', 'Friendly')

  return { campaignId, characterId, sessionId, customFeatId }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('exportImport', () => {
  let sqlite: ReturnType<typeof Database>
  let campaignId: string

  beforeEach(() => {
    sqlite = createTestDb()
    const ids = seedTestData(sqlite)
    campaignId = ids.campaignId

    // Wire getDb() mock to return an object with $client pointing to our in-memory DB
    const mockDb = { $client: sqlite } as ReturnType<typeof drizzle> & { $client: typeof sqlite }
    vi.mocked(getDb).mockReturnValue(mockDb)
  })

  afterEach(() => {
    sqlite.close()
    vi.clearAllMocks()
  })

  // Test 1: exportCampaign serializes all 15 table keys and includes seeded rows
  it('exportCampaign includes all 15 table keys and seeded rows', () => {
    const payload = exportCampaign(campaignId)

    expect(payload.version).toBe(1)
    expect(payload.type).toBe('campaignExport')
    expect(typeof payload.exportedAt).toBe('string')

    const { data } = payload
    // All 15 keys present
    expect(data).toHaveProperty('campaign')
    expect(data).toHaveProperty('customFeats')
    expect(data).toHaveProperty('sessions')
    expect(data).toHaveProperty('characters')
    expect(data).toHaveProperty('characterResources')
    expect(data).toHaveProperty('characterItems')
    expect(data).toHaveProperty('characterSpells')
    expect(data).toHaveProperty('characterFeats')
    expect(data).toHaveProperty('messages')
    expect(data).toHaveProperty('combatants')
    expect(data).toHaveProperty('campaignEvents')
    expect(data).toHaveProperty('quests')
    expect(data).toHaveProperty('npcs')
    expect(data).toHaveProperty('factions')
    expect(data).toHaveProperty('campaignReferenceDocs')

    // Seeded rows are present
    expect(data.campaign.id).toBe(campaignId)
    expect(data.campaign.name).toBe('Test Campaign')
    expect(data.sessions).toHaveLength(1)
    expect(data.characters).toHaveLength(1)
    expect(data.characterResources).toHaveLength(1)
    expect(data.messages).toHaveLength(2)
    expect(data.quests).toHaveLength(1)
    expect(data.factions).toHaveLength(1)
    expect(data.customFeats).toHaveLength(1)
    expect(data.characterFeats).toHaveLength(1)
  })

  // Test 2: importCampaign produces a new campaign id with all child rows referencing new ids
  it('importCampaign remaps all UUIDs and no old id survives', () => {
    const payload = exportCampaign(campaignId)
    const newCampaignId = importCampaign(payload)

    // New campaign id must differ from original
    expect(newCampaignId).not.toBe(campaignId)

    // Check row is in DB with new id
    const newCampaign = sqlite.prepare('SELECT * FROM campaigns WHERE id = ?').get(newCampaignId) as { id: string; name: string } | undefined
    expect(newCampaign).toBeDefined()
    expect(newCampaign!.name).toBe('Test Campaign')

    // No child row should reference the old campaignId
    const allMessages = sqlite.prepare('SELECT campaign_id FROM messages').all() as { campaign_id: string }[]
    for (const msg of allMessages) {
      expect(msg.campaign_id).not.toBe(campaignId)
    }

    // No old session id should survive (session_id references in messages)
    const importedSession = sqlite.prepare('SELECT id FROM sessions WHERE campaign_id = ?').get(newCampaignId) as { id: string } | undefined
    expect(importedSession).toBeDefined()

    // Messages with sessionId should reference the NEW session id
    const messagesWithSession = sqlite
      .prepare('SELECT session_id FROM messages WHERE campaign_id = ? AND session_id IS NOT NULL')
      .all(newCampaignId) as { session_id: string }[]
    for (const msg of messagesWithSession) {
      expect(msg.session_id).toBe(importedSession!.id)
    }
  })

  // Test 3: importing twice yields two distinct campaigns (faction unique constraint safe)
  it('importing twice yields two independent campaigns without UNIQUE violation', () => {
    const payload = exportCampaign(campaignId)
    const id1 = importCampaign(payload)
    const id2 = importCampaign(payload)

    expect(id1).not.toBe(id2)

    // Both exist in DB
    const c1 = sqlite.prepare('SELECT id FROM campaigns WHERE id = ?').get(id1)
    const c2 = sqlite.prepare('SELECT id FROM campaigns WHERE id = ?').get(id2)
    expect(c1).toBeDefined()
    expect(c2).toBeDefined()

    // Factions were imported twice without UNIQUE(campaign_id, name) violation
    const factions1 = sqlite.prepare('SELECT * FROM factions WHERE campaign_id = ?').all(id1)
    const factions2 = sqlite.prepare('SELECT * FROM factions WHERE campaign_id = ?').all(id2)
    expect(factions1).toHaveLength(1)
    expect(factions2).toHaveLength(1)
  })

  // Test 4: a forced constraint violation rolls back leaving row counts unchanged
  it('rolls back entire import transaction on constraint failure', () => {
    const payload = exportCampaign(campaignId)

    // Count campaigns before
    const countBefore = (sqlite.prepare('SELECT COUNT(*) as n FROM campaigns').get() as { n: number }).n

    // Corrupt the payload to cause a NOT NULL violation: null out the required 'name' field
    const corruptPayload = {
      ...payload,
      data: {
        ...payload.data,
        campaign: { ...payload.data.campaign, name: null },
      },
    }

    // Import should throw due to NOT NULL constraint on campaigns.name
    expect(() => importCampaign(corruptPayload as Parameters<typeof importCampaign>[0])).toThrow()

    // Row count must be unchanged
    const countAfter = (sqlite.prepare('SELECT COUNT(*) as n FROM campaigns').get() as { n: number }).n
    expect(countAfter).toBe(countBefore)
  })

  // Test 5: importCampaignOrTemplate throws on version !== 1
  it('importCampaignOrTemplate throws on version 2 with "newer version" message', () => {
    const badPayload = { version: 2, type: 'campaignExport', exportedAt: new Date().toISOString(), data: {} }

    expect(() => importCampaignOrTemplate(badPayload)).toThrow(/newer version/i)
  })

  // Test 6: importCampaignOrTemplate returns kind:'template' for type 'starterTemplate'
  it('importCampaignOrTemplate returns kind:template for type starterTemplate', () => {
    const templatePayload = {
      version: 1,
      type: 'starterTemplate',
      exportedAt: new Date().toISOString(),
      name: 'Epic Fantasy',
      worldSetupMode: 'brief',
      worldBrief: 'A world of magic and dragons',
      worldDocument: null,
      dmPersonality: 'dramatic',
      strictness: 'balanced',
      partySize: 2,
      encumbranceEnabled: false,
      homebrewContent: null,
    }

    const result = importCampaignOrTemplate(templatePayload)
    expect(result.kind).toBe('template')
    if (result.kind === 'template') {
      expect(result.template.name).toBe('Epic Fantasy')
    }
  })
})
