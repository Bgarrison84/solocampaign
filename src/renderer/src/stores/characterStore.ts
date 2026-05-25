import { create } from 'zustand'
import type { WizardState } from '../components/wizard/wizardTypes'

/**
 * Character UI store.
 *
 * Holds wizard draft state (in-progress form before confirmation) and
 * any persistent UI state that lives outside TanStack Query.
 *
 * Note: Live-resource mutations (HP, conditions, currency, spell slots)
 * use TanStack Query optimistic updates — they do NOT go through this store.
 */
interface CharacterStoreState {
  /** Wizard draft — cleared on close or confirm */
  wizardDraft: WizardState | null
  /** Replace the full draft */
  setWizardDraft: (draft: WizardState | null) => void
  /** Merge a partial update into the current draft */
  updateWizardStep: (partial: Partial<WizardState>) => void
}

export const useCharacterStore = create<CharacterStoreState>()((set) => ({
  wizardDraft: null,

  setWizardDraft: (draft) => set({ wizardDraft: draft }),

  updateWizardStep: (partial) =>
    set((s) => ({
      wizardDraft: s.wizardDraft ? { ...s.wizardDraft, ...partial } : null,
    })),
}))
