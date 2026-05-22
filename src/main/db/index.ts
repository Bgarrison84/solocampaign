import { app } from 'electron'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import log from 'electron-log'
import * as schema from './schema'
import { rotateBackups } from './backupRotation'
import { applyMigrations } from './migrate'

let _db: ReturnType<typeof drizzle> | null = null

export async function initDatabase() {
  const userData = app.getPath('userData')
  const dbPath = path.join(userData, 'solocampaign.db')

  log.info('[db] Opening database at:', dbPath)

  // 1. Backup rotation BEFORE opening the DB (D-16)
  //    Pitfall #8: DB MUST NOT open if single-instance lock was not acquired.
  //    The lock check in index.ts gates app.whenReady, so by the time we reach
  //    here the lock is confirmed.
  await rotateBackups(dbPath, userData)

  // 2. Open the database
  const sqlite = new Database(dbPath)

  // 3. Apply WAL pragmas for safety and performance (D-16)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')

  // 4. Wrap in Drizzle
  const db = drizzle(sqlite, { schema })

  // 5. Apply Drizzle migrations (replaces raw CREATE TABLE from 01-01)
  //    applyMigrations also runs PRAGMA integrity_check (D-16, Pitfall #9)
  await applyMigrations(db, sqlite)

  log.info('[db] Database initialized')

  _db = db
}

export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _db
}

export { _db as db }
