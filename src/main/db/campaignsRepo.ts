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

  delete(id: string): void {
    const db = getDb()
    db.delete(campaigns).where(eq(campaigns.id, id)).run()
  },
}
