/**
 * Repository for the character_spells domain (CHAR-08).
 * Per-character known/prepared spell list, following the sessionsRepo pattern.
 * All methods are synchronous.
 */

import { asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { characterSpells } from './schema'
import type { CharacterSpell } from './schema'

export const characterSpellsRepo = {
  /**
   * Replace a character's spell list with the given spells.
   * Deletes existing rows for the character first, then inserts each spell.
   */
  seed(
    characterId: string,
    spells: Array<{ spellName: string; spellLevel: number; isPrepared: boolean }>,
  ): void {
    const db = getDb()
    db.delete(characterSpells).where(eq(characterSpells.characterId, characterId)).run()
    for (const spell of spells) {
      db.insert(characterSpells)
        .values({
          id: randomUUID(),
          characterId,
          spellName: spell.spellName,
          spellLevel: spell.spellLevel,
          isPrepared: spell.isPrepared,
        })
        .run()
    }
  },

  /**
   * List a character's spells, ordered by spellLevel ascending.
   */
  listByCharacter(characterId: string): CharacterSpell[] {
    const db = getDb()
    return db
      .select()
      .from(characterSpells)
      .where(eq(characterSpells.characterId, characterId))
      .orderBy(asc(characterSpells.spellLevel))
      .all()
  },

  /**
   * Delete all spells for a character.
   */
  removeAll(characterId: string): void {
    const db = getDb()
    db.delete(characterSpells).where(eq(characterSpells.characterId, characterId)).run()
  },
}
