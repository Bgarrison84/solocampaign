import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import type { DndClass } from '../../../../main/db/contentTypes'
import type { WizardState } from './wizardTypes'

interface StepClassProps {
  wizardState: WizardState
  classes: DndClass[]
  onChange: (partial: Partial<WizardState>) => void
}

/**
 * Step 2 — Class selection.
 * Per UI-SPEC §3.3: flat list + stat block. Subclass picker for Cleric/Sorcerer/Warlock (D-09).
 */
export function StepClass({ wizardState, classes, onChange }: StepClassProps) {
  const [hoveredClass, setHoveredClass] = useState<DndClass | null>(null)

  const displayClass = hoveredClass ?? wizardState.selectedClass

  function getSubclassLabel(className: string): string {
    switch (className.toLowerCase()) {
      case 'cleric':
        return 'Divine Domain'
      case 'sorcerer':
        return 'Sorcerous Origin'
      case 'warlock':
        return 'Otherworldly Patron'
      default:
        return 'Subclass'
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left column — class list (200px) */}
      <div className="w-[200px] flex-shrink-0 border-r border-border overflow-y-auto">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-3 pb-1">
          Choose a Class
        </p>
        {classes.map((cls) => {
          const isSelected = wizardState.selectedClass?.id === cls.id
          return (
            <button
              key={cls.id}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 transition-colors border-l-2',
                isSelected
                  ? 'bg-accent-gold/10 border-accent-gold'
                  : 'hover:bg-surface/60 border-transparent',
              )}
              onClick={() => {
                onChange({
                  selectedClass: cls,
                  selectedSubclass: null,
                  selectedSkillProficiencies: [],
                  selectedEquipmentPackage: null,
                })
              }}
              onMouseEnter={() => setHoveredClass(cls)}
              onMouseLeave={() => setHoveredClass(null)}
            >
              <p className="text-base font-semibold leading-tight">{cls.name}</p>
              <p className="text-sm text-muted-foreground">
                d{cls.hitDie} · {cls.primaryAbility.join(' or ')}
              </p>
            </button>
          )
        })}

        {/* Subclass picker for classes that choose at level 1 (D-09) */}
        {wizardState.selectedClass?.choosesSubclassAtLevel1 && (
          <div className="px-3 py-3 border-t border-border mt-2">
            <Label htmlFor="subclass-select" className="text-sm font-semibold">
              {getSubclassLabel(wizardState.selectedClass.name)}
            </Label>
            <div className="mt-2">
              <Select
                value={wizardState.selectedSubclass ?? ''}
                onValueChange={(value) => onChange({ selectedSubclass: value || null })}
              >
                <SelectTrigger id="subclass-select" className="w-full">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(wizardState.selectedClass.subclasses ?? []).map((sub) => (
                    <SelectItem key={sub.id} value={sub.name}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Right column — stat block (460px) */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayClass ? (
          <div>
            <h3 className="text-xl font-semibold mb-1">{displayClass.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{displayClass.source}</p>

            <div className="space-y-2 text-sm mb-4">
              <div>
                <span className="font-semibold">Hit Die:</span> d{displayClass.hitDie}
              </div>
              <div>
                <span className="font-semibold">Primary Ability:</span>{' '}
                {displayClass.primaryAbility.join(', ')}
              </div>
              <div>
                <span className="font-semibold">Saving Throw Proficiencies:</span>{' '}
                {displayClass.savingThrowProficiencies.join(', ')} (auto-applied)
              </div>
              {displayClass.armorProficiencies.length > 0 && (
                <div>
                  <span className="font-semibold">Armor Proficiencies:</span>{' '}
                  {displayClass.armorProficiencies.join(', ')}
                </div>
              )}
              {displayClass.weaponProficiencies.length > 0 && (
                <div>
                  <span className="font-semibold">Weapon Proficiencies:</span>{' '}
                  {displayClass.weaponProficiencies.join(', ')}
                </div>
              )}
              {displayClass.toolProficiencies.length > 0 && (
                <div>
                  <span className="font-semibold">Tool Proficiencies:</span>{' '}
                  {displayClass.toolProficiencies.join(', ')}
                </div>
              )}
              <div>
                <span className="font-semibold">Skill Choices:</span> Choose{' '}
                {displayClass.skillChoiceCount} from:{' '}
                {displayClass.skillChoices.join(', ')}
              </div>
            </div>

            {displayClass.startingEquipmentPackages.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-1">Starting Equipment Packages</h4>
                {displayClass.startingEquipmentPackages.map((pkg) => (
                  <p key={pkg.id} className="text-sm text-muted-foreground">
                    {pkg.label}
                  </p>
                ))}
              </div>
            )}

            {displayClass.level1Features.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Level 1 Features</h4>
                {displayClass.level1Features.map((feature, idx) => (
                  <div key={idx}>
                    <h5 className="text-sm font-semibold">{feature.name}</h5>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Subclass features when one is selected */}
            {wizardState.selectedSubclass &&
              wizardState.selectedClass?.id === displayClass.id && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  {(() => {
                    const sub = displayClass.subclasses?.find(
                      (s) => s.name === wizardState.selectedSubclass,
                    )
                    if (!sub) return null
                    return (
                      <>
                        <h4 className="text-sm font-semibold">
                          {sub.name} Features
                        </h4>
                        {sub.features.map((f, i) => (
                          <div key={i}>
                            <h5 className="text-sm font-semibold">{f.name}</h5>
                            <p className="text-sm text-muted-foreground">{f.description}</p>
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>
              )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Select a class to continue.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function isStep1Valid(state: WizardState): boolean {
  return (
    state.selectedClass !== null &&
    (!state.selectedClass.choosesSubclassAtLevel1 || state.selectedSubclass !== null)
  )
}
