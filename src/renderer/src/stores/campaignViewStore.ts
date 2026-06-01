import { create } from 'zustand'

/**
 * Zustand store for campaign view UI state.
 *
 * activeCharacterId: the character whose sheet is currently displayed in party mode.
 * - null when no campaign is loaded or in solo mode (falls back to the first party member)
 * - MUST be reset to null when the active campaign changes (Pitfall 6)
 *
 * Actions:
 * - setActiveCharacterId(id): switch the displayed sheet to this character
 * - resetActiveCharacterId(): clear selection (called on campaign change — Pitfall 6)
 */

interface CampaignViewState {
  /** The character ID whose sheet is currently displayed, or null (defaults to first member). */
  activeCharacterId: string | null

  /** Set the active character for the sheet switcher. */
  setActiveCharacterId: (id: string | null) => void

  /** Reset active character — call this whenever the active campaign changes (Pitfall 6). */
  resetActiveCharacterId: () => void
}

export const useCampaignViewStore = create<CampaignViewState>()((set) => ({
  activeCharacterId: null,

  setActiveCharacterId: (id) => set({ activeCharacterId: id }),

  resetActiveCharacterId: () => set({ activeCharacterId: null }),
}))
