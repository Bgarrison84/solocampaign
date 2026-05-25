import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import type { Background } from '../../../../main/db/contentTypes'
import type { WizardState } from './wizardTypes'
import { ALL_LANGUAGES } from './wizardTypes'

interface StepBackgroundProps {
  wizardState: WizardState
  backgrounds: Background[]
  onChange: (partial: Partial<WizardState>) => void
}

/**
 * Step 4 — Background selection.
 * Per UI-SPEC §3.5 and D-11.
 */
export function StepBackground({ wizardState, backgrounds, onChange }: StepBackgroundProps) {
  const [hoveredBg, setHoveredBg] = useState<Background | null>(null)

  const displayBg = hoveredBg ?? wizardState.selectedBackground

  const freeLanguageChoices = wizardState.selectedBackground?.freeLanguageChoices ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Two-column area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column — background list (200px) */}
        <div className="w-[200px] flex-shrink-0 border-r border-border overflow-y-auto">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-3 pb-1">
            Choose a Background
          </p>
          {backgrounds.map((bg) => {
            const isSelected = wizardState.selectedBackground?.id === bg.id
            return (
              <button
                key={bg.id}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 transition-colors border-l-2',
                  isSelected
                    ? 'bg-accent-gold/10 border-accent-gold'
                    : 'hover:bg-surface/60 border-transparent',
                )}
                onClick={() =>
                  onChange({
                    selectedBackground: bg,
                    selectedLanguage: null,
                  })
                }
                onMouseEnter={() => setHoveredBg(bg)}
                onMouseLeave={() => setHoveredBg(null)}
              >
                <p className="text-base font-semibold leading-tight">{bg.name}</p>
                <p className="text-sm text-muted-foreground">
                  {bg.skillProficiencies.join(', ')}
                </p>
              </button>
            )
          })}
        </div>

        {/* Right column — stat block (460px) */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayBg ? (
            <div>
              <h3 className="text-xl font-semibold mb-1">{displayBg.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{displayBg.source}</p>

              <div className="space-y-2 text-sm mb-4">
                {displayBg.skillProficiencies.length > 0 && (
                  <div>
                    <span className="font-semibold">Auto-granted: </span>
                    {displayBg.skillProficiencies.join(', ')} (skills)
                  </div>
                )}
                {displayBg.toolProficiencies.length > 0 ? (
                  <div>
                    <span className="font-semibold">Tool Proficiencies:</span>{' '}
                    {displayBg.toolProficiencies.join(', ')}
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold">Tool Proficiencies:</span> None
                  </div>
                )}
                {displayBg.languages.length > 0 && (
                  <div>
                    <span className="font-semibold">Languages:</span>{' '}
                    {displayBg.languages.join(', ')}
                    {(displayBg.freeLanguageChoices ?? 0) > 0 &&
                      ` + ${displayBg.freeLanguageChoices} choice`}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold">{displayBg.feature.name}</h4>
                <p className="text-sm text-muted-foreground">{displayBg.feature.description}</p>
              </div>

              {displayBg.suggestedPersonalityTraits.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Suggested Personality Traits
                  </h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-1">
                    {displayBg.suggestedPersonalityTraits.slice(0, 3).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Language picker */}
              {wizardState.selectedBackground?.id === displayBg.id && freeLanguageChoices > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <Label htmlFor="language-select" className="text-sm font-semibold">
                    Choose a Language
                  </Label>
                  <div className="mt-2">
                    <Select
                      value={wizardState.selectedLanguage ?? ''}
                      onValueChange={(v) => onChange({ selectedLanguage: v || null })}
                    >
                      <SelectTrigger id="language-select">
                        <SelectValue placeholder="Choose a language…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_LANGUAGES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!wizardState.selectedLanguage && (
                      <p className="text-sm text-destructive mt-1">
                        Choose a language to continue.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                Select a background to continue.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Optional role-play fields (full-width below columns) */}
      <div className="border-t border-border px-6 py-4 flex-shrink-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="personality-trait">Personality Trait (optional)</Label>
            <Input
              id="personality-trait"
              value={wizardState.personalityTrait}
              onChange={(e) => onChange({ personalityTrait: e.target.value })}
              placeholder="Write your own or use the suggestion above…"
              maxLength={200}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ideal">Ideal (optional)</Label>
            <Input
              id="ideal"
              value={wizardState.ideal}
              onChange={(e) => onChange({ ideal: e.target.value })}
              placeholder="Write your own or use the suggestion above…"
              maxLength={200}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bond">Bond (optional)</Label>
            <Input
              id="bond"
              value={wizardState.bond}
              onChange={(e) => onChange({ bond: e.target.value })}
              placeholder="Write your own or use the suggestion above…"
              maxLength={200}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="flaw">Flaw (optional)</Label>
            <Input
              id="flaw"
              value={wizardState.flaw}
              onChange={(e) => onChange({ flaw: e.target.value })}
              placeholder="Write your own or use the suggestion above…"
              maxLength={200}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function isStep3Valid(state: WizardState): boolean {
  return (
    state.selectedBackground !== null &&
    ((state.selectedBackground.freeLanguageChoices ?? 0) === 0 ||
      state.selectedLanguage !== null)
  )
}
