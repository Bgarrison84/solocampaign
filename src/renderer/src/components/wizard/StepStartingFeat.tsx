/**
 * StepStartingFeat — Optional wizard step for choosing a starting feat (CHAR-05, 07-06).
 *
 * Mounts FeatPicker and stores the chosen feat in WizardState.startingFeat.
 * The step is skippable — a "Skip" button advances without selecting a feat.
 *
 * UI-SPEC: §CreateCharacterWizard Starting Feat step; §FeatPicker (reused here).
 */

import React from 'react'
import { FeatPicker } from '../FeatPicker'
import { Button } from '../ui/button'
import type { WizardState } from './wizardTypes'
import type { FeatSelection } from '../FeatPicker'

interface StepStartingFeatProps {
  wizardState: WizardState
  campaignId: string
  onChange: (partial: Partial<WizardState>) => void
  /** Called when the user clicks "Skip" — advances without a feat */
  onSkip: () => void
}

export function StepStartingFeat({
  wizardState,
  campaignId,
  onChange,
  onSkip,
}: StepStartingFeatProps) {
  function handleSelect(sel: FeatSelection) {
    onChange({ startingFeat: sel })
  }

  function handleClear() {
    onChange({ startingFeat: null })
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-4 h-full overflow-y-auto">
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Starting Feat</h3>
        <p className="text-sm text-muted-foreground">
          Choose an optional feat to start with. Some backgrounds and variant human characters
          begin with a feat. You can skip this step if it doesn't apply to your character.
        </p>
      </div>

      {/* Selected feat banner (shown when a feat is selected) */}
      {wizardState.startingFeat && (
        <div className="flex items-center justify-between rounded-lg border border-accent-gold bg-secondary/80 px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {wizardState.startingFeat.featName}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {wizardState.startingFeat.featSource === 'srd' ? 'SRD Feat' : 'Custom Feat'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClear}
          >
            Remove
          </Button>
        </div>
      )}

      {/* FeatPicker */}
      <FeatPicker
        campaignId={campaignId}
        selectedFeatName={wizardState.startingFeat?.featName ?? null}
        onSelect={handleSelect}
      />

      {/* Skip affordance */}
      <div className="flex justify-start">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={onSkip}
        >
          No starting feat — skip this step
        </Button>
      </div>
    </div>
  )
}
