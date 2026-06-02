import { app } from 'electron'
import path from 'node:path'
import log from 'electron-log'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type Database from 'better-sqlite3'

/**
 * Apply all pending Drizzle migrations at startup.
 *
 * Migration path resolution (Pitfall #3 — ASAR footgun):
 * - Dev: __dirname is dist/main/, so go up two levels to reach resources/migrations
 * - Packaged: use process.resourcesPath/migrations (set via electron-builder extraResources)
 *
 * After migrations run, PRAGMA integrity_check is performed.
 * Per Pitfall #9: a non-'ok' result is logged at ERROR level but does NOT throw
 * (Phase 1 log-only; Phase 2+ will add UI surface).
 */
type PragmaColumn = { name: string }

function repairMissingColumns(sqlite: InstanceType<typeof Database>): void {
  const existingCols = (sqlite.pragma('table_info(campaigns)') as PragmaColumn[]).map(c => c.name)
  const campaignFixes: Array<[string, string]> = [
    ['party_size', 'ALTER TABLE campaigns ADD COLUMN party_size INTEGER NOT NULL DEFAULT 1'],
    ['world_setup_mode', 'ALTER TABLE campaigns ADD COLUMN world_setup_mode TEXT'],
    ['world_brief', 'ALTER TABLE campaigns ADD COLUMN world_brief TEXT'],
    ['world_document', 'ALTER TABLE campaigns ADD COLUMN world_document TEXT'],
    ['encumbrance_enabled', 'ALTER TABLE campaigns ADD COLUMN encumbrance_enabled INTEGER NOT NULL DEFAULT 0'],
    ['homebrew_content', 'ALTER TABLE campaigns ADD COLUMN homebrew_content TEXT'],
  ]
  for (const [col, sql] of campaignFixes) {
    if (!existingCols.includes(col)) {
      sqlite.exec(sql)
      log.info(`[db] Schema repair: added missing column campaigns.${col}`)
    }
  }

  const charCols = (sqlite.pragma('table_info(characters)') as PragmaColumn[]).map(c => c.name)
  const charFixes: Array<[string, string]> = [
    ['classes', 'ALTER TABLE characters ADD COLUMN classes TEXT'],
    ['is_companion', 'ALTER TABLE characters ADD COLUMN is_companion INTEGER NOT NULL DEFAULT 0'],
    ['negative_traits', 'ALTER TABLE characters ADD COLUMN negative_traits TEXT'],
  ]
  for (const [col, sql] of charFixes) {
    if (!charCols.includes(col)) {
      sqlite.exec(sql)
      log.info(`[db] Schema repair: added missing column characters.${col}`)
    }
  }
}

// Use a wide type so applyMigrations accepts any schema-typed Drizzle instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyMigrations(
  db: BetterSQLite3Database<any>,
  sqlite: InstanceType<typeof Database>,
): Promise<void> {
  const migrationsFolder = app.isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(__dirname, '../../resources/migrations')

  log.info('[db] Running Drizzle migrations from:', migrationsFolder)

  try {
    migrate(db, { migrationsFolder })
    log.info('[db] Migrations complete')
  } catch (err) {
    log.error('[db] Migration failed — cannot continue with a partial schema:', err)
    throw err
  }

  // Schema repair: add columns that were added to migration 0007 after it had
  // already been applied to some dev databases (edit-after-apply drift).
  // Uses PRAGMA table_info to check existence — idempotent on any DB state.
  repairMissingColumns(sqlite)

  // PRAGMA integrity_check after migrations (D-16, Pitfall #9)
  // Use simple: true to get a scalar string ('ok' or the first error line).
  const integrityResult = sqlite.pragma('integrity_check', { simple: true }) as string
  if (integrityResult !== 'ok') {
    log.error('[db] PRAGMA integrity_check returned non-ok result:', integrityResult)
    // Phase 1: log only. Phase 2+ will surface this to the user.
  } else {
    log.info('[db] PRAGMA integrity_check: ok')
  }
}
