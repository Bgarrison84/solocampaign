import { z } from 'zod'
import { t } from '../_base'
import Store from 'electron-store'

/**
 * App-global preferences store backed by electron-store.
 *
 * Keys:
 *   - fontSize: 'small' | 'normal' | 'large' — text size scale (D-07, A11Y-01)
 *   - highContrast: boolean — high contrast dark theme toggle (D-08, A11Y-01)
 *   - dataFolder: string | null — custom SQLite data folder path (D-09, DIST-04)
 *
 * Stored in userData/appPrefs.json (electron-store default).
 * Separate from campaign data (SQLite) and per-campaign panel prefs (prefs.json).
 *
 * Note: changeDataFolder and getCurrentDataFolder are added in plan 08-06.
 * This router exposes only the read + appearance-write surface for plans 08-01 and 08-02.
 */
interface AppPrefs {
  fontSize: 'small' | 'normal' | 'large'
  highContrast: boolean
  dataFolder: string | null
}

export const appPrefsStore = new Store<AppPrefs>({
  name: 'appPrefs',
  defaults: {
    fontSize: 'normal',
    highContrast: false,
    dataFolder: null,
  },
})

/**
 * appPrefs tRPC router.
 *
 * Procedures:
 *   - get (query) → { fontSize, highContrast, dataFolder }
 *   - setFontSize (mutation) → { updated: true }
 *   - setHighContrast (mutation) → { updated: true }
 *
 * T-08-01 (Tampering): Zod enum/boolean validation at procedure boundary rejects any
 * value outside the allowed set before it reaches the store.
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
})
