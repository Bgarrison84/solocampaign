import { app } from 'electron'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import log from 'electron-log'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export async function initDatabase() {
  const userData = app.getPath('userData')
  const dbPath = path.join(userData, 'solocampaign.db')

  log.info('[db] Opening database at:', dbPath)

  const sqlite = new Database(dbPath)

  // Apply WAL pragmas for safety and performance
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')

  // Create campaigns table directly (Drizzle migrate() is added in 01-02)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  log.info('[db] Database initialized')

  _db = drizzle(sqlite, { schema })
}

export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _db
}

export { _db as db }
