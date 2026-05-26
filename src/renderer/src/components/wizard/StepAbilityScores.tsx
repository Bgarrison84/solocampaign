import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  type WizardState,
  type AbilityName,
  STANDARD_ARRAY,
  ABILITY_NAMES,
  ABILITY_ABBREVIATIONS,
} from './wizardTypes'
import { calcAbilityModifier } from '../../../../main/characters/calculations'

interface StepAbilityScoresProps {
  wizardState: WizardState
  onChange: (partial: Partial<WizardState>) => void
}

/**
 * Step 3 — Ability Score assignment.
 * Per UI-SPEC §3.4 and D-10: standard array with optional manual override per stat.
 * Per D-16: saving throws are class-fixed, shown read-only. Skills are player-chosen.
 */
function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6))
  dice.sort((a, b) => a - b)
  return dice[1] + dice[2] + dice[3]
}

export function StepAbilityScores({ wizardState, onChange }: StepAbilityScoresProps) {
  const [overrideErrors, setOverrideErrors] = useState<Partial<Record<AbilityName, string>>>({})

  const scores = wizardState.abilityScores
  const overrides = wizardState.abilityOverrides
  const selectedClass = wizardState.selectedClass

  function handleRollAll() {
    const rolled: Record<AbilityName, number> = {
      strength: roll4d6DropLowest(),
      dexterity: roll4d6DropLowest(),
      constitution: roll4d6DropLowest(),
      intelligence: roll4d6DropLowest(),
      wisdom: roll4d6DropLowest(),
      charisma: roll4d6DropLowest(),
    }
    onChange({
      abilityScores: rolled,
      abilityOverrides: {
        strength: true,
        dexterity: true,
        constitution: true,
        intelligence: true,
        wisdom: true,
        charisma: true,
      },
    })
    setOverrideErrors({})
  }

  // Which standard array values are currently assigned (excluding the one for a given ability)
  function getAssignedValues(excludeAbility?: AbilityName): number[] {
    return ABILITY_NAMES.filter((a) => a !== excludeAbility && !overrides[a])
      .map((a) => scores[a])
      .filter((v): v is number => v !== null)
  }

  // Available standard array values for a given ability's dropdown
  function getAvailableValues(ability: AbilityName): number[] {
    const assigned = getAssignedValues(ability)
    return STANDARD_ARRAY.filter(
      (v) => !assigned.includes(v) || v === scores[ability],
    )
  }

  // Count assigned standard array values
  const assignedCount = ABILITY_NAMES.filter(
    (a) => scores[a] !== null,
  ).length

  // Handle standard array selection
  function handleScoreSelect(ability: AbilityName, value: string) {
    if (value === '') {
      onChange({
        abilityScores: { ...scores, [ability]: null },
      })
    } else {
      onChange({
        abilityScores: { ...scores, [ability]: parseInt(value, 10) },
        abilityOverrides: { ...overrides, [ability]: false },
      })
    }
  }

  // Toggle override mode for an ability
  function toggleOverride(ability: AbilityName) {
    if (overrides[ability]) {
      // Clear override, reset to null
      onChange({
        abilityScores: { ...scores, [ability]: null },
        abilityOverrides: { ...overrides, [ability]: false },
      })
      setOverrideErrors((prev) => ({ ...prev, [ability]: undefined }))
    } else {
      onChange({
        abilityOverrides: { ...overrides, [ability]: true },
        abilityScores: { ...scores, [ability]: null },
      })
    }
  }

  // Handle override input change
  function handleOverrideInput(ability: AbilityName, raw: string) {
    const n = parseInt(raw, 10)
    if (!raw || isNaN(n)) {
      onChange({ abilityScores: { ...scores, [ability]: null } })
      setOverrideErrors((prev) => ({ ...prev, [ability]: undefined }))
      return
    }
    if (n < 1 || n > 30) {
      setOverrideErrors((prev) => ({
        ...prev,
        [ability]: 'Enter a number between 1 and 30.',
      }))
      onChange({ abilityScores: { ...scores, [ability]: null } })
    } else {
      setOverrideErrors((prev) => ({ ...prev, [ability]: undefined }))
      onChange({ abilityScores: { ...scores, [ability]: n } })
    }
  }

  // Saving throw proficiencies (class-fixed, read-only per D-16)
  const classSaves = selectedClass?.savingThrowProficiencies ?? []

  // Skill proficiency state
  const eligibleSkills = selectedClass?.skillChoices ?? []
  const required = selectedClass?.skillChoiceCount ?? 0
  const selected = wizardState.selectedSkillProficiencies
  const remaining = required - selected.length

  function toggleSkill(skill: string) {
    if (selected.includes(skill)) {
      onChange({
        selectedSkillProficiencies: selected.filter((s) => s !== skill),
      })
    } else if (selected.length < required) {
      onChange({
        selectedSkillProficiencies: [...selected, skill],
      })
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left column — standard array display (200px) */}
      <div className="w-[200px] flex-shrink-0 border-r border-border overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Standard Array
          </p>
        </div>
        <button
          type="button"
          onClick={handleRollAll}
          className="w-full mb-3 px-2 py-1.5 text-sm font-semibold rounded border border-border hover:bg-surface/60 transition-colors"
          title="Roll 4d6 drop lowest for each ability"
        >
          Roll Stats (4d6)
        </button>
        <div className="flex flex-col gap-2">
          {[...STANDARD_ARRAY].map((value) => {
            const assignedTo = ABILITY_NAMES.find(
              (a) => scores[a] === value && !overrides[a],
            )
            return (
              <div
                key={value}
                className={cn(
                  'flex items-center justify-between px-2 py-1 rounded text-sm font-semibold bg-surface',
                  assignedTo ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                <span>{value}</span>
                {assignedTo && (
                  <span className="text-xs text-muted-foreground">
                    → {ABILITY_ABBREVIATIONS[assignedTo]}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {assignedCount} of 6 assigned
        </p>
      </div>

      {/* Right column — assignment + proficiency selection (460px) */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Ability score rows */}
        <div className="space-y-3 mb-6">
          {ABILITY_NAMES.map((ability) => {
            const score = scores[ability]
            const isOverride = overrides[ability]
            const modifier = score !== null ? calcAbilityModifier(score) : null
            const isSaveProficient = classSaves
              .map((s) => s.toLowerCase())
              .includes(ability.toLowerCase())

            return (
              <div key={ability} className="space-y-1">
                <div className="flex items-center gap-3">
                  {/* Ability abbreviation */}
                  <span className="text-sm font-semibold w-10">
                    {ABILITY_ABBREVIATIONS[ability]}
                  </span>

                  {/* Dropdown or override input */}
                  {isOverride ? (
                    <div className="flex-1">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        placeholder="1–30"
                        defaultValue={score ?? ''}
                        onChange={(e) => handleOverrideInput(ability, e.target.value)}
                        className="h-9"
                      />
                      {overrideErrors[ability] && (
                        <p className="text-sm text-destructive mt-1">
                          {overrideErrors[ability]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1">
                      <Select
                        value={score !== null ? String(score) : ''}
                        onValueChange={(v) => handleScoreSelect(ability, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="— Choose —" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableValues(ability).map((v) => (
                            <SelectItem key={v} value={String(v)}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Modifier */}
                  <span className="text-sm font-semibold w-12 text-center">
                    {modifier !== null
                      ? modifier >= 0
                        ? `+${modifier}`
                        : `${modifier}`
                      : '—'}
                  </span>

                  {/* Saving throw checkbox (read-only per D-16) */}
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={isSaveProficient}
                      readOnly
                      disabled
                      className="w-4 h-4 accent-amber-500"
                      title={
                        isSaveProficient
                          ? `${ABILITY_ABBREVIATIONS[ability]} saving throw (class-granted)`
                          : `${ABILITY_ABBREVIATIONS[ability]} saving throw (not proficient)`
                      }
                    />
                    <span className="text-xs text-muted-foreground">Save</span>
                  </div>
                </div>

                {/* Override toggle */}
                <div className="pl-10">
                  <button
                    type="button"
                    onClick={() => toggleOverride(ability)}
                    className="text-sm text-muted-foreground underline cursor-pointer"
                  >
                    {isOverride ? 'Clear override' : 'Override'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Validation message */}
        {assignedCount < 6 && (
          <p className="text-sm text-destructive mb-4">
            Assign all 6 ability scores to continue.
          </p>
        )}

        {/* Skill proficiency picker */}
        {selectedClass && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-semibold">Skill Proficiencies</h4>
              <span
                className={cn(
                  'text-sm font-semibold',
                  remaining > 0 ? 'text-muted-foreground' : 'text-accent-gold',
                )}
              >
                {selected.length} / {required} selected
              </span>
            </div>
            <div className="space-y-2">
              {eligibleSkills.map((skill) => {
                const isSelected = selected.includes(skill)
                const isDisabled = !isSelected && selected.length >= required
                const label = skill.charAt(0).toUpperCase() + skill.slice(1)
                return (
                  <label
                    key={skill}
                    className={cn(
                      'flex items-center gap-2 cursor-pointer text-sm',
                      isDisabled && 'opacity-40 pointer-events-none',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSkill(skill)}
                      disabled={isDisabled}
                      className="w-4 h-4 accent-amber-500"
                    />
                    {label}
                  </label>
                )
              })}
            </div>

            {remaining > 0 && selected.length > 0 && (
              <p className="text-sm text-destructive mt-2">
                Select {remaining} more skill{' '}
                {remaining === 1 ? 'proficiency' : 'proficiencies'} to continue.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function isStep2Valid(state: WizardState): boolean {
  const allAssigned = Object.values(state.abilityScores).every((v) => v !== null)
  const skillsOk =
    state.selectedSkillProficiencies.length === (state.selectedClass?.skillChoiceCount ?? 0)
  return allAssigned && skillsOk
}
