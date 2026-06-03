import { z } from 'zod'
import { t } from '../_base'
import Store from 'electron-store'
import path from 'node:path'
import { unlink } from 'node:fs/promises'
import { TRPCError } from '@trpc/server'
import Database from 'better-sqlite3'
import { app, dialog } from 'electron'
import { getDb } from '../../db/index'
import log from 'electron-log'

/**
 * App-global preferences store backed by electron-store.
 *
 * Keys:
 *   - fontSize: 'small' | 'normal' | 'large' — text size scale (D-07, A11Y-01)
 *   - highContrast: boolean — high contrast dark theme toggle (D-08, A11Y-01)
 *   - dataFolder: string | null — custom SQLite data folder path (D-09, DIST-04)
 *   - dismissedUpdateVersion: string | null — last update version dismissed by user (D-05, DIST-05)
 *
 * Stored in userData/appPrefs.json (electron-store default).
 * Separate from campaign data (SQLite) and per-campaign panel prefs (prefs.json).
 */
interface AppPrefs {
  fontSize: 'small' | 'normal' | 'large'
  highContrast: boolean
  dataFolder: string | null
  dismissedUpdateVersion: string | null
}

export const appPrefsStore = new Store<AppPrefs>({
  name: 'appPrefs',
  defaults: {
    fontSize: 'normal',
    highContrast: false,
    dataFolder: null,
    dismissedUpdateVersion: null,
  },
})

/**
 * appPrefs tRPC router.
 *
 * Procedures:
 *   - get (query) → { fontSize, highContrast, dataFolder, dismissedUpdateVersion }
 *   - setFontSize (mutation) → { updated: true }
 *   - setHighContrast (mutation) → { updated: true }
 *   - getCurrentDataFolder (query) → { path: string, isCustom: boolean }
 *   - pickDataFolder (mutation) → { canceled: boolean, folderPath?: string }
 *   - changeDataFolder (mutation, { folderPath }) → { success: true, pendingRestart: true }
 *   - checkForUpdate (query) → UpdateInfo ({ available, version, releaseUrl })
 *   - dismissUpdate (mutation, { version }) → { dismissed: true }
 *
 * T-08-01 (Tampering): Zod enum/boolean validation at procedure boundary rejects any
 * value outside the allowed set before it reaches the store.
 * T-08-17 (Integrity): changeDataFolder uses sqlite.backup() NOT fs.copyFile (WAL-safe).
 * T-08-18 (Tampering): folderPath comes from OS openDirectory dialog; validated z.string().min(1).
 * T-09-04 (Tampering): dismissUpdate validates input via Zod z.object({ version: z.string() })
 * before appPrefsStore.set — renderer input treated as untrusted.
 */
export const appPrefsRouter = t.router({
  /**
   * Read the full appPrefs store.
   * Returns current values for fontSize, highContrast, and dataFolder.
   */
  get: t.procedure.query(() => {
    return appPrefsStore.store
  }),

  /**
   * Persist a new font size selection.
   * T-08-01: Zod enum validates input before store write.
   */
  setFontSize: t.procedure
    .input(z.object({ fontSize: z.enum(['small', 'normal', 'large']) }))
    .mutation(({ input }) => {
      appPrefsStore.set('fontSize', input.fontSize)
      return { updated: true as const }
    }),

  /**
   * Persist the high contrast toggle state.
   * T-08-01: Zod boolean validates input before store write.
   */
  setHighContrast: t.procedure
    .input(z.object({ highContrast: z.boolean() }))
    .mutation(({ input }) => {
      appPrefsStore.set('highContrast', input.highContrast)
      return { updated: true as const }
    }),

  /**
   * Get the current data folder path and whether it is a custom path.
   *
   * Returns:
   *   - path: custom path if set, otherwise app.getPath('userData')
   *   - isCustom: true if a custom path has been persisted; false if using the default
   *
   * DIST-04: Powers the "Campaign Data Folder" display in SettingsScreen.
   */
  getCurrentDataFolder: t.procedure.query(() => {
    const custom = appPrefsStore.get('dataFolder', null)
    return {
      path: custom ?? app.getPath('userData'),
      isCustom: custom !== null,
    }
  }),

  /**
   * Open the OS folder-picker dialog and return the selected path.
   * Does NOT copy or migrate anything — that is changeDataFolder's job.
   *
   * Returns { canceled: true } if user dismisses the dialog.
   * Returns { canceled: false, folderPath: string } if user picks a folder.
   *
   * T-08-18: The folder path is sourced from OS openDirectory dialog (trusted absolute path).
   */
  pickDataFolder: t.procedure.mutation(async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    if (canceled || !filePaths[0]) {
      return { canceled: true as const }
    }
    return { canceled: false as const, folderPath: filePaths[0] }
  }),

  /**
   * Migrate the SQLite database to a new data folder.
   *
   * CRITICAL — DIST-04, T-08-17:
   *   Uses sqlite.backup(newDbPath) NOT fs.copyFile.
   *   SQLite in WAL mode uses three files (.db, .db-wal, .db-shm).
   *   fs.copyFile only copies .db → corrupted database at destination.
   *   .backup() handles WAL atomically and produces a clean copy.
   *
   * Steps:
   *   1. Build destination path: path.join(folderPath, 'solocampaign.db')
   *   2. WAL-safe copy: sqlite.backup(newDbPath)
   *   3. Integrity check: open readonly copy, PRAGMA integrity_check, close
   *   4. If integrity_check !== 'ok': delete copy, throw TRPCError
   *   5. Persist: appPrefsStore.set('dataFolder', folderPath)
   *   6. Return { success: true, pendingRestart: true }
   *
   * The new path takes effect on next app launch (initDatabase reads appPrefs.dataFolder).
   */
  changeDataFolder: t.procedure
    .input(z.object({ folderPath: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const newDbPath = path.join(input.folderPath, 'solocampaign.db')

      try {
        // Step 1: WAL-safe backup — CRITICAL: NOT fs.copyFile (Landmine 2, Pitfall 1)
        const sqlite = getDb().$client
        await sqlite.backup(newDbPath)

        // Step 2: Verify integrity of the new copy
        const newDb = new Database(newDbPath, { readonly: true })
        const result = newDb
          .prepare('PRAGMA integrity_check')
          .get() as { integrity_check: string }
        newDb.close()

        // Step 3: Reject if integrity check failed — delete corrupted copy and throw
        if (result.integrity_check !== 'ok') {
          await unlink(newDbPath).catch(() => {})
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Integrity check failed on the new database copy.',
          })
        }

        // Step 4: Persist new folder path — takes effect on next launch
        appPrefsStore.set('dataFolder', input.folderPath)
        log.info('[appPrefs] Data folder changed to:', input.folderPath)

        return { success: true as const, pendingRestart: true as const }
      } catch (err) {
        if (err instanceof TRPCError) {
          throw err
        }
        log.error('[appPrefs] changeDataFolder failed:', err)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to change data folder.',
        })
      }
    }),

  /**
   * Check GitHub Releases for a newer version of SoloCampaign.
   *
   * Delegates to the pure updateChecker service (dynamically imported to enable mocking in tests).
   * Uses app.getVersion() as the currentVersion baseline.
   *
   * Returns UpdateInfo: { available, version, releaseUrl } — see updateChecker.ts for full contract.
   * Errors are silent (no throw, no electron-log) per D-04. The renderer calls this as a
   * background query via TanStack Query; never blocks startup.
   *
   * DIST-05: Powers the UpdateBanner renderer component (Plan 02).
   */
  checkForUpdate: t.procedure.query(async () => {
    const { checkForUpdate } = await import('../../services/updateChecker')
    const currentVersion = app.getVersion()
    return checkForUpdate(currentVersion)
  }),

  /**
   * Persist the dismissed update version so the same banner does not reappear.
   *
   * T-09-04 (Tampering): Zod z.object({ version: z.string() }) validates input at the
   * procedure boundary before appPrefsStore.set — renderer input is untrusted.
   *
   * Logic (Pitfall 7): The dismissed version is never cleared. When a newer release
   * arrives (e.g. v0.3.0), the renderer compares data.version !== dismissedUpdateVersion
   * and shows the banner again automatically.
   *
   * DIST-05: Called by UpdateBanner when user clicks the ✕ dismiss button.
   */
  dismissUpdate: t.procedure
    .input(z.object({ version: z.string() }))
    .mutation(({ input }) => {
      appPrefsStore.set('dismissedUpdateVersion', input.version)
      return { dismissed: true as const }
    }),
})
