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
