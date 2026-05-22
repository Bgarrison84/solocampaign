import path from 'node:path'
import { copyFile, readdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import log from 'electron-log'

/**
 * Backup rotation per D-16.
 *
 * If the database file already exists, copies it to a timestamped backup in the
 * same userData directory, then deletes the oldest backups beyond the last 10.
 *
 * Called BEFORE the Database constructor so the backup reflects the previous
 * clean state of the DB (before WAL pragmas or migrations run this session).
 *
 * "Before each session open" in D-16 is interpreted as before the SQLite
 * connection is opened at app launch. Phase 4 may add per-campaign-session
 * backups when sessions have a lifecycle.
 */
export async function rotateBackups(dbPath: string, userDataDir: string): Promise<void> {
  if (!existsSync(dbPath)) {
    // Fresh install — no DB to back up yet
    log.info('[db] No existing database to back up (first launch)')
    return
  }

  // ISO timestamp with colons and periods replaced so the filename is safe on Windows
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFilename = `solocampaign-backup-${stamp}.db`
  const backupPath = path.join(userDataDir, backupFilename)

  try {
    await copyFile(dbPath, backupPath)
    log.info('[db] Backup created:', backupFilename)
  } catch (err) {
    // Non-fatal: log and continue. A failed backup is worse than no backup but we
    // should not prevent the app from starting.
    log.error('[db] Failed to create backup:', err)
    return
  }

  // Rotate: keep only the last 10 backups (T-DB-05 — prevent disk exhaustion)
  try {
    const allFiles = await readdir(userDataDir)
    const backups = allFiles
      .filter((f) => f.startsWith('solocampaign-backup-') && f.endsWith('.db'))
      .sort() // ISO timestamps sort lexicographically = chronologically

    const MAX_BACKUPS = 10
    while (backups.length > MAX_BACKUPS) {
      const oldest = backups.shift()!
      const oldestPath = path.join(userDataDir, oldest)
      try {
        await unlink(oldestPath)
        log.info('[db] Deleted old backup:', oldest)
      } catch (err) {
        log.warn('[db] Failed to delete old backup:', oldest, err)
      }
    }
  } catch (err) {
    log.warn('[db] Failed to read userData dir for backup rotation:', err)
  }
}
