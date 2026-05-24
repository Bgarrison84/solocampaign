import { create } from 'zustand'

/**
 * Zustand store for window-level UI state.
 *
 * campaignName: shown in the title bar as "SoloCampaign — {name}" when inside
 * a campaign route. Set by CampaignViewScreen on mount/data load, cleared on unmount.
 * Phase 3 may extend this store with additional window-level state.
 */
interface WindowState {
  campaignName: string | null
  setCampaignName: (name: string | null) => void
}

export const useWindowStore = create<WindowState>()((set) => ({
  campaignName: null,
  setCampaignName: (name) => set({ campaignName: name }),
}))
