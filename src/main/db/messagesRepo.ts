/**
 * Repository for the messages domain.
 * All methods are synchronous, following the campaignsRepo pattern.
 * D-17: messages table keyed by campaign_id, role/content/created_at.
 * D-20: getLastN returns up to n messages in chronological (ascending) order.
 */

import { asc, desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { messages } from './schema'
import type { Message } from './schema'

export interface InsertMessageInput {
  campaignId: string
  role: 'user' | 'assistant'
  content: string
  // D-20: optional session FK — set from main-process sessionActiveMap only
  sessionId?: string | null
}

export const messagesRepo = {
  /**
   * Insert a new message row.
   * Returns the created Message row with id + createdAt.
   */
  insert(input: InsertMessageInput): Message {
    const db = getDb()
    const id = randomUUID()

    db.insert(messages)
      .values({
        id,
        campaignId: input.campaignId,
        role: input.role,
        content: input.content,
        sessionId: input.sessionId ?? null,
      })
      .run()

    const created = db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .get()

    if (!created) {
      throw new Error('[messages] Failed to retrieve message after insert')
    }

    return created
  },

  /**
   * Return up to n most-recent messages for a campaign in chronological order.
   * Uses a subquery with DESC rowid (insertion order) + limit, then delivers
   * the results in ascending order — D-20.
   * rowid is the stable, auto-increment SQLite row ID — reliable even when
   * multiple rows share the same created_at millisecond.
   */
  getLastN(campaignId: string, n: number): Message[] {
    const db = getDb()

    // Use raw SQL to get the last N by rowid (insertion order), then return ascending
    const rows = db
      .select()
      .from(messages)
      .where(eq(messages.campaignId, campaignId))
      .orderBy(desc(sql`rowid`))
      .limit(n)
      .all()

    return rows.reverse()
  },

  /**
   * Return all messages for a campaign in chronological order.
   * Used when loading a campaign — Phase 3 has no session boundaries.
   * Uses rowid for stable insertion order when created_at timestamps collide.
   */
  getByCampaignId(campaignId: string): Message[] {
    const db = getDb()
    return db
      .select()
      .from(messages)
      .where(eq(messages.campaignId, campaignId))
      .orderBy(asc(sql`rowid`))
      .all()
  },

  /**
   * Return all messages for a session in chronological order.
   * Used for recap generation (D-11: all messages from the current session).
   */
  getBySessionId(sessionId: string): Message[] {
    const db = getDb()
    return db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(sql`rowid`))
      .all()
  },

  /**
   * Return the last n messages for a session in chronological order.
   * Used for Layer 1 hot-context when L1 overflow threshold is exceeded (D-14).
   */
  getLastNForSession(sessionId: string, n: number): Message[] {
    const db = getDb()
    const rows = db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(sql`rowid`))
      .limit(n)
      .all()

    return rows.reverse()
  },
}
