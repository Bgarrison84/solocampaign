import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { campaigns } from './schema'
import type { Campaign } from './schema'

export interface AiConfigInput {
  providerType?: string | null
  endpointUrl?: string | null
  modelName?: string | null
  referenceDocs?: string[] // stored as JSON array string
  dmPersonality?: string | null
  strictness?: string
  fallbackEndpointUrl?: string | null
  fallbackModelName?: string | null
}

export const campaignsRepo = {
  list(): Campaign[] {
    const db = getDb()
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).all()
  },

  create({ name }: { name: string }): Campaign {
    const db = getDb()
    const id = randomUUID()
    const now = Date.now()

    db.insert(campaigns)
      .values({ id, name, createdAt: new Date(now) })
      .run()

    const created = db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .get()

    if (!created) {
      throw new Error('Failed to create campaign')
    }

    return created
  },

  get(id: string): Campaign | undefined {
    const db = getDb()
    return db.select().from(campaigns).where(eq(campaigns.id, id)).get()
  },

  /**
   * Persist a cover image relative path for a campaign.
   * Ownership of cover-image persistence lives here (campaign domain) — D-24, W4 fix.
   */
  updateCoverImagePath(campaignId: string, relativePath: string): void {
    const db = getDb()
    db.update(campaigns)
      .set({ coverImagePath: relativePath })
      .where(eq(campaigns.id, campaignId))
      .run()
  },

  /**
   * Persist AI provider config for a campaign.
   * API keys are NOT stored here — they live in SecretStorageService (D-08/D-23).
   * referenceDocs is serialized as JSON string for storage.
   */
  updateAiConfig(campaignId: string, config: AiConfigInput): void {
    const db = getDb()
    db.update(campaigns)
      .set({
        providerType: config.providerType ?? null,
        endpointUrl: config.endpointUrl ?? null,
        modelName: config.modelName ?? null,
        referenceDocs: JSON.stringify(config.referenceDocs ?? []),
        dmPersonality: config.dmPersonality ?? null,
        strictness: config.strictness ?? 'balanced',
        fallbackEndpointUrl: config.fallbackEndpointUrl ?? null,
        fallbackModelName: config.fallbackModelName ?? null,
      })
      .where(eq(campaigns.id, campaignId))
      .run()
  },

  /**
   * Persist the Layer 3 rolling campaign summary.
   * Called at session end after generating the rolling summary (D-16/D-21).
   * Pass null to clear the rolling summary (e.g. when olderSessions is empty).
   */
  updateRollingSummary(campaignId: string, value: string | null): void {
    const db = getDb()
    db.update(campaigns)
      .set({ rollingSummary: value })
      .where(eq(campaigns.id, campaignId))
      .run()
  },

  /**
   * Persist the permadeath mode flag for a campaign (PROG-04).
   * When true, character death at 0 HP is final and cannot be reversed.
   */
  setPermadeath(campaignId: string, value: boolean): void {
    const db = getDb()
    db.update(campaigns)
      .set({ permadeathMode: value })
      .where(eq(campaigns.id, campaignId))
      .run()
  },

  /**
   * Persist the in-world clock (STATE-04). At least one field must be provided.
   * Only the supplied fields are written; others remain unchanged.
   */
  updateWorldTime(
    campaignId: string,
    input: { timeOfDay?: string; dayNumber?: number; season?: string },
  ): void {
    const db = getDb()
    const set: Partial<typeof campaigns.$inferInsert> = {}
    if (input.timeOfDay !== undefined) set.worldTimeOfDay = input.timeOfDay
    if (input.dayNumber !== undefined) set.worldDayNumber = input.dayNumber
    if (input.season !== undefined) set.worldSeason = input.season
    if (Object.keys(set).length === 0) return
    db.update(campaigns).set(set).where(eq(campaigns.id, campaignId)).run()
  },

  /**
   * Persist the current location breadcrumb (WORLD-03). The path array is stored
   * as a JSON string (Pitfall 4 — consumers guard JSON.parse with a try/catch).
   */
  updateLocation(campaignId: string, path: string[]): void {
    const db = getDb()
    db.update(campaigns)
      .set({ worldLocationPath: JSON.stringify(path) })
      .where(eq(campaigns.id, campaignId))
      .run()
  },

  /**
   * Read the four world-state columns for a campaign. Used by the worldState tRPC
   * router (renderer header) and the Wave 2 contextBuilder world-state injection.
   * Returns undefined if the campaign does not exist.
   */
  getWorldState(
    campaignId: string,
  ):
    | {
        worldTimeOfDay: string | null
        worldDayNumber: number | null
        worldSeason: string | null
        worldLocationPath: string | null
      }
    | undefined {
    const db = getDb()
    return db
      .select({
        worldTimeOfDay: campaigns.worldTimeOfDay,
        worldDayNumber: campaigns.worldDayNumber,
        worldSeason: campaigns.worldSeason,
        worldLocationPath: campaigns.worldLocationPath,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .get()
  },

  /**
   * Persist free-form homebrew content for a campaign (RULES-03).
   * Called by campaigns.updateHomebrew tRPC mutation.
   * Content capped at 50,000 chars to match the campaign_reference_docs cap.
   */
  updateHomebrew(campaignId: string, homebrewContent: string): void {
    const db = getDb()
    db.update(campaigns)
      .set({ homebrewContent: homebrewContent.substring(0, 50_000) })
      .where(eq(campaigns.id, campaignId))
      .run()
  },

  /**
   * Persist the AI-generated or player-written world brief for a campaign (WORLD-01).
   * Called by the generateWorldBrief tRPC mutation.
   */
  updateWorldBrief(campaignId: string, worldBrief: string): void {
    const db = getDb()
    db.update(campaigns)
      .set({ worldBrief })
      .where(eq(campaigns.id, campaignId))
      .run()
  },

  /**
   * Read the world overview columns for the contextBuilder injection (WORLD-01, STATE-06).
   * Returns worldBrief, worldDocument, and encumbranceEnabled — the three Phase 7 fields
   * needed to build the World Overview block in the system prompt.
   * Returns undefined if the campaign does not exist.
   */
  getWorldOverview(
    campaignId: string,
  ):
    | {
        worldBrief: string | null
        worldDocument: string | null
        encumbranceEnabled: boolean
      }
    | undefined {
    const db = getDb()
    return db
      .select({
        worldBrief: campaigns.worldBrief,
        worldDocument: campaigns.worldDocument,
        encumbranceEnabled: campaigns.encumbranceEnabled,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .get()
  },

  delete(id: string): void {
    const db = getDb()
    db.delete(campaigns).where(eq(campaigns.id, id)).run()
  },
}
