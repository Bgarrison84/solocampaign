import { create } from 'zustand'
import { trpc } from '../lib/trpc'

/**
 * Panel size state for the split-panel campaign view.
 *
 * Holds the current left/right panel sizes in memory and provides
 * async load/save helpers that call the prefs tRPC procedures.
 *
 * Per D-11: default split ratio is 60/40 (chat left / right panel).
 * Per D-14: sizes persist per-campaign via electron-store through prefs tRPC.
 */
interface PanelSizeState {
  /** Current panel sizes. Defaults to 60/40 until load() resolves. */
  sizes: { leftSize: number; rightSize: number }
  /** True once load(campaignId) has returned. Prevents rendering before sizes are known. */
  isLoaded: boolean
  /** Load persisted sizes for a campaign from prefs tRPC. Resets isLoaded to false during load. */
  load: (campaignId: string) => Promise<void>
  /** Persist panel sizes for a campaign. Updates local state immediately, persists async. */
  save: (campaignId: string, leftSize: number, rightSize: number) => Promise<void>
  /** Update local state only — called on every resize event (before the debounced save fires). */
  setLocalSizes: (leftSize: number, rightSize: number) => void
}

export const usePanelSizeStore = create<PanelSizeState>()((set) => ({
  sizes: { leftSize: 60, rightSize: 40 },
  isLoaded: false,

  load: async (campaignId: string) => {
    const saved = await trpc.prefs.panelSize.get.query({ campaignId })
    set({ sizes: saved, isLoaded: true })
  },

  save: async (campaignId: string, leftSize: number, rightSize: number) => {
    set({ sizes: { leftSize, rightSize } })
    await trpc.prefs.panelSize.set.mutate({ campaignId, leftSize, rightSize })
  },

  setLocalSizes: (leftSize: number, rightSize: number) => {
    set({ sizes: { leftSize, rightSize } })
  },
}))
