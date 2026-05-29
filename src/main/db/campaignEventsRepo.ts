/**
 * Repository for the campaign_events domain (STATE-05).
 * Append-only mechanical event log, following the messagesRepo pattern.
 * All methods are synchronous.
 */

import { desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { campaignEvents } from './schema'
import type { CampaignEvent } from './schema'

export const campaignEventsRepo = {
  /**
   * Append an event row. No retrieval after insert (append-only).
   * payload is a pre-serialized JSON string.
   */
  insert(input: {
    campaignId: string
    sessionId?: string | null
    eventType: string
    payload: string
  }): void {
    const db = getDb()
    db.insert(campaignEvents)
      .values({
        id: randomUUID(),
        campaignId: input.campaignId,
        sessionId: input.sessionId ?? null,
        eventType: input.eventType,
        payload: input.payload,
      })
      .run()
  },

  /**
   * Return the most-recent events for a campaign, newest-first, limited.
   */
  listByCampaign(campaignId: string, limit = 50): CampaignEvent[] {
    const db = getDb()
    // Secondary sort by rowid (insertion order) keeps ordering stable when
    // multiple events share the same created_at millisecond.
    return db
      .select()
      .from(campaignEvents)
      .where(eq(campaignEvents.campaignId, campaignId))
      .orderBy(desc(campaignEvents.createdAt), desc(sql`rowid`))
      .limit(limit)
      .all()
  },
}
