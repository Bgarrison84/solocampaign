import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import type { Race } from '../../../../main/db/contentTypes'
import type { WizardState } from './wizardTypes'

interface StepRaceProps {
  wizardState: WizardState
  races: Race[]
  onChange: (partial: Partial<WizardState>) => void
}

/**
 * Step 1 — Race (Species) + Character Name + Backstory.
 * Per UI-SPEC §3.2 and D-13 (name collected in Step 1).
 *
 * Layout:
 * - Full-width name + backstory fields above the two-column selector
 * - Left column (200px): scrollable race list, grouped by parentRace
 * - Right column (460px): stat block for hovered/selected race
 */
export function StepRace({ wizardState, races, onChange }: StepRaceProps) {
  const [hoveredRace, setHoveredRace] = useState<Race | null>(null)

  const displayRace = hoveredRace ?? wizardState.selectedRace

  // Group races: parent races first, subraces under them
  const parentRaces = races.filter((r) => !r.parentRace)
  const subracesByParent = races
    .filter((r) => r.parentRace)
    .reduce<Record<string, Race[]>>((acc, r) => {
      const parent = r.parentRace!
      if (!acc[parent]) acc[parent] = []
      acc[parent].push(r)
      return acc
    }, {})

  const showNameError = wizardState.characterName.trim().length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Name + Backstory above the columns */}
      <div className="px-6 pb-4 pt-4 border-b border-border flex-shrink-0">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="character-name">
              Character Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="character-name"
              value={wizardState.characterName}
              onChange={(e) => onChange({ characterName: e.target.value })}
              placeholder="Enter your character's name"
              maxLength={100}
            />
            {showNameError && wizardState.characterName !== '' && (
              <p className="text-sm text-destructive">Character name is required.</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="backstory">Backstory (optional)</Label>
            <textarea
              id="backstory"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              value={wizardState.backstory}
              onChange={(e) => onChange({ backstory: e.target.value })}
              placeholder="Add an optional backstory…"
              rows={3}
              maxLength={2000}
            />
          </div>
        </div>
      </div>

      {/* Two-column area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column — race selector (200px) */}
        <div className="w-[200px] flex-shrink-0 border-r border-border overflow-y-auto">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-3 pb-1">
            Choose a Species
          </p>
          {parentRaces.map((race) => {
            const subraces = subracesByParent[race.name] ?? []
            const isSelected = wizardState.selectedRace?.id === race.id
            return (
              <React.Fragment key={race.id}>
                {/* Parent race entry */}
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 transition-colors',
                    isSelected
                      ? 'bg-accent-gold/10 border-l-2 border-accent-gold'
                      : 'hover:bg-surface/60 border-l-2 border-transparent',
                  )}
                  onClick={() =>
                    onChange({ selectedRace: race, selectedSubrace: null })
                  }
                  onMouseEnter={() => setHoveredRace(race)}
                  onMouseLeave={() => setHoveredRace(null)}
                >
                  <p className="text-base font-semibold leading-tight">{race.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {race.size} · {race.speed}ft
                  </p>
                </button>
                {/* Subraces */}
                {subraces.map((sub) => {
                  const isSubSelected = wizardState.selectedRace?.id === sub.id
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      className={cn(
                        'w-full text-left pl-6 pr-3 py-2 transition-colors',
                        isSubSelected
                          ? 'bg-accent-gold/10 border-l-2 border-accent-gold'
                          : 'hover:bg-surface/60 border-l-2 border-transparent',
                      )}
                      onClick={() =>
                        onChange({
                          selectedRace: sub,
                          selectedSubrace: sub.subrace ?? null,
                        })
                      }
                      onMouseEnter={() => setHoveredRace(sub)}
                      onMouseLeave={() => setHoveredRace(null)}
                    >
                      <p className="text-base font-semibold leading-tight">{sub.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {sub.size} · {sub.speed}ft
                      </p>
                    </button>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>

        {/* Right column — stat block (460px) */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayRace ? (
            <div>
              <h3 className="text-xl font-semibold mb-1">{displayRace.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{displayRace.source}</p>

              <div className="text-sm mb-3">
                <span className="font-semibold">Size:</span> {displayRace.size} ·{' '}
                <span className="font-semibold">Speed:</span> {displayRace.speed}ft
                {displayRace.darkvision ? (
                  <>
                    {' '}
                    · <span className="font-semibold">Darkvision:</span>{' '}
                    {displayRace.darkvision}ft
                  </>
                ) : null}
              </div>

              {displayRace.abilityScoreIncreases.length > 0 && (
                <div className="text-sm mb-3">
                  <span className="font-semibold">Ability Score Increases:</span>{' '}
                  {displayRace.abilityScoreIncreases
                    .map((asi) => `+${asi.bonus} ${asi.ability.toUpperCase()}`)
                    .join(', ')}
                </div>
              )}

              {displayRace.languages.length > 0 && (
                <div className="text-sm mb-3">
                  <span className="font-semibold">Languages:</span>{' '}
                  {displayRace.languages.join(', ')}
                  {(displayRace.freeLanguageChoices ?? 0) > 0 &&
                    ` + ${displayRace.freeLanguageChoices} choice`}
                </div>
              )}

              {displayRace.traits.length > 0 && (
                <div className="space-y-2">
                  {displayRace.traits.map((trait, idx) => (
                    <div key={idx}>
                      <h4 className="text-sm font-semibold">{trait.name}</h4>
                      <p className="text-sm text-muted-foreground">{trait.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                Select a species to continue.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function isStep0Valid(state: WizardState): boolean {
  return state.characterName.trim().length >= 1 && state.selectedRace !== null
}
