/**
 * Repository for the character_feats domain (Phase 7 — CHAR-05, PROG-03).
 * Stores feats acquired by a character: SRD feats, custom feats, and epic boons.
 * All methods are synchronous, following the questsRepo/npcsRepo pattern.
 */

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import { getDb } from './index'
import { characterFeats } from './schema'
import type { CharacterFeat } from './schema'

export const characterFeatsRepo = {
  /**
   * Add a feat to a character.
   * feat_source: 'srd' | 'custom' | 'epic_boon'
   * customFeatId is required when feat_source is 'custom', null otherwise.
   */
  add(input: {
    characterId: string
    featName: string
    featSource: 'srd' | 'custom' | 'epic_boon'
    customFeatId?: string
  }): CharacterFeat {
    const db = getDb()
    const id = randomUUID()

    db.insert(characterFeats)
      .values({
        id,
        characterId: input.characterId,
        featName: input.featName,
        featSource: input.featSource,
        customFeatId: input.customFeatId ?? null,
      })
      .run()

    const created = db.select().from(characterFeats).where(eq(characterFeats.id, id)).get()
    if (!created) {
      throw new Error('[characterFeatsRepo] Failed to retrieve feat after insert')
    }
    return created
  },

  /**
   * List all feats for a character in chronological (oldest-first) order.
   */
  listByCharacter(characterId: string): CharacterFeat[] {
    const db = getDb()
    return db
      .select()
      .from(characterFeats)
      .where(eq(characterFeats.characterId, characterId))
      .orderBy(asc(characterFeats.createdAt))
      .all()
  },

  /**
   * Remove a feat. characterId guard prevents cross-character deletes.
   */
  remove(featId: string, characterId: string): void {
    const db = getDb()
    const result = db
      .delete(characterFeats)
      .where(and(eq(characterFeats.id, featId), eq(characterFeats.characterId, characterId)))
      .run()
    if (result.changes === 0) {
      log.warn('[characterFeatsRepo] remove: no feat matched id/characterId', featId, characterId)
    }
  },
}
