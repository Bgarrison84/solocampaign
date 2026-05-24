import { z } from 'zod'
import { t } from '../_base'
import Store from 'electron-store'

/**
 * Per-campaign panel size store backed by electron-store.
 * Keyed by campaign UUID — values are { leftSize, rightSize } (0–100).
 *
 * Stored in userData/prefs.json (electron-store default).
 * Separate from the SQLite campaign data per D-14 (window prefs in electron-store).
 */
const store = new Store<Record<string, { leftSize: number; rightSize: number }>>({ name: 'prefs' })

/**
 * Zod input schema for persisting panel sizes.
 *
 * T-01-04-01: campaignId validated as UUID; leftSize + rightSize bounded 0–100.
 */
const panelSizeSchema = z.object({
  campaignId: z.string().uuid(),
  leftSize: z.number().min(0).max(100),
  rightSize: z.number().min(0).max(100),
})

/**
 * Preferences tRPC router.
 *
 * Provides per-campaign panel size persistence via electron-store (not SQLite).
 * Panel size data is UI preference, not campaign data — electron-store is correct per D-14.
 */
export const prefsRouter = t.router({
  panelSize: t.router({
    /**
     * Get persisted panel sizes for a campaign.
     * Returns { leftSize: 60, rightSize: 40 } as default if no value persisted.
     */
    get: t.procedure
      .input(z.object({ campaignId: z.string().uuid() }))
      .query(({ input }) => {
        return store.get(input.campaignId) ?? { leftSize: 60, rightSize: 40 }
      }),

    /**
     * Persist panel sizes for a campaign.
     * Called with 500ms debounce from the renderer on resize.
     */
    set: t.procedure
      .input(panelSizeSchema)
      .mutation(({ input }) => {
        store.set(input.campaignId, { leftSize: input.leftSize, rightSize: input.rightSize })
      }),
  }),
})
