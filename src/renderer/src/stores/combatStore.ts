import { create } from 'zustand'

/**
 * Zustand store for combat lifecycle + controlled right-panel tab state.
 *
 * Drives the combat flow in CampaignViewScreen + CombatTrackerTab:
 * - isCombatActive: toggles the Combat tab between empty state and the initiative list;
 *   also enables the 2s poll on combatants.listActive (D-09)
 * - activeCampaignId: the campaign combat is running for; null when no combat
 * - currentTurnOrder: the initiative_order of the combatant whose turn it is (AI-driven, D-13)
 * - activeTab: which right-panel tab is shown. Lives here (not as local useState in
 *   CampaignViewScreen) so startCombat can auto-switch the panel to 'combat-tracker' (D-17)
 *
 * Actions:
 * - startCombat(campaignId): set combat active + activeCampaignId + auto-switch to Combat tab
 * - endCombat(): clear combat state but KEEP activeTab on Combat (UI-SPEC S1: "tab stays on Combat")
 * - setCurrentTurn(order): AI advances the active combatant (D-13)
 * - setActiveTab(tab): controlled-tab onValueChange handler for <Tabs>
 */

interface CombatState {
  /** True when combat is in progress — renders the initiative list and enables polling */
  isCombatActive: boolean
  /** Campaign combat is running for; null when no combat */
  activeCampaignId: string | null
  /** initiative_order of the combatant whose turn it is (AI-driven, D-13) */
  currentTurnOrder: number
  /** Controlled value for the right-panel <Tabs>; default 'character-sheet' */
  activeTab: string

  /** Begin combat for a campaign — sets isCombatActive + activeCampaignId + activeTab='combat-tracker' (D-17) */
  startCombat: (campaignId: string) => void
  /** End combat — clears combat state but leaves activeTab on Combat (UI-SPEC S1) */
  endCombat: () => void
  /** Set the active turn's initiative order (AI-driven turn advance, D-13) */
  setCurrentTurn: (order: number) => void
  /** Controlled-tab handler for <Tabs onValueChange> */
  setActiveTab: (tab: string) => void
}

export const useCombatStore = create<CombatState>()((set) => ({
  isCombatActive: false,
  activeCampaignId: null,
  currentTurnOrder: 0,
  activeTab: 'character-sheet',

  startCombat: (campaignId) =>
    set({
      isCombatActive: true,
      activeCampaignId: campaignId,
      activeTab: 'combat-tracker',
    }),

  endCombat: () =>
    set({
      isCombatActive: false,
      activeCampaignId: null,
      currentTurnOrder: 0,
      // activeTab intentionally NOT reset — player stays on the Combat tab (UI-SPEC S1)
    }),

  setCurrentTurn: (order) => set({ currentTurnOrder: order }),

  setActiveTab: (tab) => set({ activeTab: tab }),
}))
