/**
 * Repository for the campaign_reference_docs domain (Phase 7 — RULES-04, WORLD-01).
 * User-imported PDF/text documents stored per campaign.
 * Content is capped at 50,000 chars at write time to prevent DoS (Pitfall 7).
 * All methods are synchronous, following the questsRepo/npcsRepo pattern.
 */

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import { getDb } from './index'
import { campaignReferenceDocs } from './schema'
import type { CampaignReferenceDoc } from './schema'

export const campaignReferenceDocsRepo = {
  /**
   * Store an imported document for a campaign.
   * CRITICAL (Pitfall 7): caps content at 50,000 chars before insert to prevent
   * unbounded memory usage when querying all reference docs for AI context.
   * Inserts then selects the row back so DB defaults are reflected.
   */
  create(input: {
    campaignId: string
    filename: string
    content: string
  }): CampaignReferenceDoc {
    const db = getDb()
    const id = randomUUID()
    // Pitfall 7: cap content at storage time — never store more than 50,000 chars
    const cappedContent = input.content.substring(0, 50_000)

    db.insert(campaignReferenceDocs)
      .values({
        id,
        campaignId: input.campaignId,
        filename: input.filename,
        content: cappedContent,
      })
      .run()

    const created = db
      .select()
      .from(campaignReferenceDocs)
      .where(eq(campaignReferenceDocs.id, id))
      .get()
    if (!created) {
      throw new Error('[campaignReferenceDocsRepo] Failed to retrieve doc after insert')
    }
    return created
  },

  /**
   * List all reference docs for a campaign in chronological (oldest-first) order.
   */
  list(campaignId: string): CampaignReferenceDoc[] {
    const db = getDb()
    return db
      .select()
      .from(campaignReferenceDocs)
      .where(eq(campaignReferenceDocs.campaignId, campaignId))
      .orderBy(asc(campaignReferenceDocs.createdAt))
      .all()
  },

  /**
   * Delete a reference doc. campaignId guard prevents cross-campaign deletes.
   */
  delete(id: string, campaignId: string): void {
    const db = getDb()
    const result = db
      .delete(campaignReferenceDocs)
      .where(
        and(
          eq(campaignReferenceDocs.id, id),
          eq(campaignReferenceDocs.campaignId, campaignId),
        ),
      )
      .run()
    if (result.changes === 0) {
      log.warn(
        '[campaignReferenceDocsRepo] delete: no doc matched id/campaignId',
        id,
        campaignId,
      )
    }
  },
}
