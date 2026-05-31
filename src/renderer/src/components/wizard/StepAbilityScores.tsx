import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Separator } from '../ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
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
  type AbilityScoreMethod,
  STANDARD_ARRAY,
  ABILITY_NAMES,
  ABILITY_ABBREVIATIONS,
} from './wizardTypes'
import { calcAbilityModifier } from '../../../../main/characters/calculations'
import {
  PRESET_FLAWS,
  POINT_BUY_COST,
  calcPointBuyCost,
  calcPointBuyBudget,
} from '../../lib/pointBuy'

interface StepAbilityScoresProps {
  wizardState: WizardState
  onChange: (partial: Partial<WizardState>) => void
}

/**
 * Step 3 — Ability Score assignment.
 * Supports four methods: Standard Array, 4d6 Roll, Point Buy, Manual.
 * Point Buy includes a live budget counter and optional Negative Traits panel.
 * 4d6 Roll supports per-stat reroll (once per stat; button disappears after use, D-06).
 */
function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.ceil(Math.random() * 6))
  dice.sort((a, b) => a - b)
  return dice[1] + dice[2] + dice[3]
}

const METHOD_LABELS: Record<AbilityScoreMethod, string> = {
  'standard-array': 'Standard Array',
  '4d6-roll': '4d6 Roll',
  'point-buy': 'Point Buy',
  manual: 'Manual',
}

/** Empty ability scores object */
function emptyScores(): WizardState['abilityScores'] {
  return {
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  }
}

/** Empty ability overrides object */
function emptyOverrides(): WizardState['abilityOverrides'] {
  return {
    strength: false,
    dexterity: false,
    constitution: false,
    intelligence: false,
    wisdom: false,
    charisma: false,
  }
}

/** Default point buy scores (all at 8, lowest cost) */
function defaultPointBuyScores(): WizardState['abilityScores'] {
  return {
    strength: 8,
    dexterity: 8,
    constitution: 8,
    intelligence: 8,
    wisdom: 8,
    charisma: 8,
  }
}

export function StepAbilityScores({ wizardState, onChange }: StepAbilityScoresProps) {
  const [overrideErrors, setOverrideErrors] = useState<Partial<Record<AbilityName, string>>>({})
  // Tracks which stats have been rerolled (per-stat reroll flag, D-06)
  const [rerollUsed, setRerollUsed] = useState<Partial<Record<AbilityName, boolean>>>({})
  // Tracks which stats have a green flash from a reroll
  const [rerollFlash, setRerollFlash] = useState<Partial<Record<AbilityName, boolean>>>({})
  // Confirmation dialog for switching methods when scores already assigned
  const [pendingMethod, setPendingMethod] = useState<AbilityScoreMethod | null>(null)

  const method = wizardState.abilityScoreMethod
  const scores = wizardState.abilityScores
  const overrides = wizardState.abilityOverrides
  const selectedClass = wizardState.selectedClass
  const negativeTraits = wizardState.negativeTraits

  // ── Method switching ──────────────────────────────────────────────────────

  function hasAnyScore(): boolean {
    return Object.values(scores).some((v) => v !== null)
  }

  function handleMethodChange(newMethod: AbilityScoreMethod) {
    if (newMethod === method) return
    if (hasAnyScore()) {
      setPendingMethod(newMethod)
    } else {
      applyMethodSwitch(newMethod)
    }
  }

  function applyMethodSwitch(newMethod: AbilityScoreMethod) {
    const newScores = newMethod === 'point-buy' ? defaultPointBuyScores() : emptyScores()
    onChange({
      abilityScoreMethod: newMethod,
      abilityScores: newScores,
      abilityOverrides: emptyOverrides(),
      negativeTraits: newMethod === 'point-buy'
        ? negativeTraits
        : { presetFlaws: [], freeFormFlaws: ['', ''] },
    })
    setOverrideErrors({})
    setRerollUsed({})
    setRerollFlash({})
    setPendingMethod(null)
  }

  function cancelMethodSwitch() {
    setPendingMethod(null)
  }

  // ── 4d6 Roll ─────────────────────────────────────────────────────────────

  function handleRollAll() {
    const rolled: WizardState['abilityScores'] = {
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
    // Roll All does NOT reset the used-reroll state (per D-06 spec)
  }

  function handlePerStatReroll(ability: AbilityName) {
    const oldScore = scores[ability] ?? 0
    const newScore = roll4d6DropLowest()
    const kept = Math.max(oldScore, newScore)
    onChange({ abilityScores: { ...scores, [ability]: kept } })
    // Mark this stat's reroll as used (D-06: button disappears once used)
    setRerollUsed((prev) => ({ ...prev, [ability]: true }))
    // Green flash for 600ms
    setRerollFlash((prev) => ({ ...prev, [ability]: true }))
    setTimeout(() => {
      setRerollFlash((prev) => ({ ...prev, [ability]: false }))
    }, 600)
  }

  // ── Standard Array ────────────────────────────────────────────────────────

  function getAssignedValues(excludeAbility?: AbilityName): number[] {
    return ABILITY_NAMES.filter((a) => a !== excludeAbility && !overrides[a])
      .map((a) => scores[a])
      .filter((v): v is number => v !== null)
  }

  function getAvailableValues(ability: AbilityName): number[] {
    const assigned = getAssignedValues(ability)
    return STANDARD_ARRAY.filter(
      (v) => !assigned.includes(v) || v === scores[ability],
    )
  }

  const assignedCount = ABILITY_NAMES.filter((a) => scores[a] !== null).length

  function handleScoreSelect(ability: AbilityName, value: string) {
    if (value === '') {
      onChange({ abilityScores: { ...scores, [ability]: null } })
    } else {
      onChange({
        abilityScores: { ...scores, [ability]: parseInt(value, 10) },
        abilityOverrides: { ...overrides, [ability]: false },
      })
    }
  }

  // ── Manual override ───────────────────────────────────────────────────────

  function toggleOverride(ability: AbilityName) {
    if (overrides[ability]) {
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

  // ── Point Buy helpers ─────────────────────────────────────────────────────

  function handlePointBuyStep(ability: AbilityName, delta: number) {
    const current = scores[ability] ?? 8
    const next = current + delta
    if (next < 8 || next > 15) return
    onChange({ abilityScores: { ...scores, [ability]: next } })
  }

  const pointBuySpent = calcPointBuyCost(scores)
  const pointBuyBudget = calcPointBuyBudget(
    negativeTraits.presetFlaws,
    negativeTraits.freeFormFlaws,
  )

  function budgetColorClass(): string {
    if (pointBuySpent > pointBuyBudget) return 'text-destructive'
    if (pointBuySpent === pointBuyBudget) return 'text-accent-gold'
    return 'text-muted-foreground'
  }

  // ── Negative Traits ───────────────────────────────────────────────────────

  function togglePresetFlaw(id: string) {
    const current = negativeTraits.presetFlaws
    const next = current.includes(id)
      ? current.filter((f) => f !== id)
      : [...current, id]
    onChange({ negativeTraits: { ...negativeTraits, presetFlaws: next } })
  }

  function setFreeFormFlaw(index: 0 | 1, value: string) {
    // Security: strip newlines per T-07-04-01 — injection-time strip handled in contextBuilder,
    // but length-bound the field here (wizard responsibility per threat register)
    const sanitized = value.replace(/[\r\n]/g, ' ').slice(0, 280)
    const next: [string, string] = [...negativeTraits.freeFormFlaws] as [string, string]
    next[index] = sanitized
    onChange({ negativeTraits: { ...negativeTraits, freeFormFlaws: next } })
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  const classSaves = selectedClass?.savingThrowProficiencies ?? []
  const eligibleSkills = selectedClass?.skillChoices ?? []
  const required = selectedClass?.skillChoiceCount ?? 0
  const selected = wizardState.selectedSkillProficiencies
  const remaining = required - selected.length

  function toggleSkill(skill: string) {
    if (selected.includes(skill)) {
      onChange({ selectedSkillProficiencies: selected.filter((s) => s !== skill) })
    } else if (selected.length < required) {
      onChange({ selectedSkillProficiencies: [...selected, skill] })
    }
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  /** Skill proficiencies panel (shared across all methods) */
  function renderSkillPanel() {
    if (!selectedClass) return null
    return (
      <div className="border-t border-border pt-4 mt-4">
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
    )
  }

  /** Method-switch confirmation inline banner */
  function renderSwitchConfirmation() {
    if (!pendingMethod) return null
    return (
      <div className="rounded border border-border bg-surface/60 px-3 py-2 mb-3 text-sm flex items-center gap-3">
        <span className="flex-1 text-muted-foreground">
          Switching to {METHOD_LABELS[pendingMethod]} will clear your current scores.
        </span>
        <button
          type="button"
          onClick={() => applyMethodSwitch(pendingMethod)}
          className="h-7 px-2 text-xs font-semibold rounded bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-colors"
        >
          Yes, switch
        </button>
        <button
          type="button"
          onClick={cancelMethodSwitch}
          className="h-7 px-2 text-xs font-semibold rounded border border-border hover:bg-surface/60 transition-colors"
        >
          Keep current
        </button>
      </div>
    )
  }

  /** Standard Array tab content */
  function renderStandardArrayTab() {
    return (
      <div className="flex h-full overflow-hidden">
        {/* Left — standard array values sidebar */}
        <div className="w-[180px] flex-shrink-0 border-r border-border overflow-y-auto p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Standard Array
          </p>
          <div className="flex flex-col gap-1.5">
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
          <p className="text-xs text-muted-foreground mt-2">
            {assignedCount} of 6 assigned
          </p>
        </div>

        {/* Right — dropdowns */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3 mb-4">
            {ABILITY_NAMES.map((ability) => {
              const score = scores[ability]
              const modifier = score !== null ? calcAbilityModifier(score) : null
              const isSaveProficient = classSaves
                .map((s) => s.toLowerCase())
                .includes(ability.toLowerCase())

              return (
                <div key={ability} className="flex items-center gap-3">
                  <span className="text-sm font-semibold w-10">
                    {ABILITY_ABBREVIATIONS[ability]}
                  </span>
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
                  <span className="text-sm font-semibold w-12 text-center">
                    {modifier !== null
                      ? modifier >= 0
                        ? `+${modifier}`
                        : `${modifier}`
                      : '—'}
                  </span>
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
              )
            })}
          </div>
          {assignedCount < 6 && (
            <p className="text-sm text-destructive mb-4">
              Assign all 6 ability scores to continue.
            </p>
          )}
          {renderSkillPanel()}
        </div>
      </div>
    )
  }

  /** 4d6 Roll tab content */
  function render4d6Tab() {
    return (
      <div className="overflow-y-auto p-3">
        <button
          type="button"
          onClick={handleRollAll}
          className="mb-4 px-3 py-1.5 text-sm font-semibold rounded border border-border hover:bg-surface/60 transition-colors"
          title="Roll 4d6 drop lowest for each ability"
        >
          Roll Stats (4d6)
        </button>
        <div className="space-y-3 mb-4">
          {ABILITY_NAMES.map((ability) => {
            const score = scores[ability]
            const modifier = score !== null ? calcAbilityModifier(score) : null
            const isSaveProficient = classSaves
              .map((s) => s.toLowerCase())
              .includes(ability.toLowerCase())
            const isUsed = rerollUsed[ability] === true
            const isFlashing = rerollFlash[ability] === true

            return (
              <div key={ability} className="flex items-center gap-3">
                <span className="text-sm font-semibold w-10">
                  {ABILITY_ABBREVIATIONS[ability]}
                </span>
                <span
                  className={cn(
                    'font-mono text-sm w-8 text-center rounded px-1 transition-colors duration-600',
                    isFlashing
                      ? 'bg-green-950/40 text-green-400'
                      : 'text-foreground',
                  )}
                >
                  {score ?? '—'}
                </span>
                <span className="text-sm font-semibold w-12 text-center">
                  {modifier !== null
                    ? modifier >= 0
                      ? `+${modifier}`
                      : `${modifier}`
                    : '—'}
                </span>
                <div className="flex items-center gap-1 mr-2">
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
                {/* Per-stat reroll: button disappears once used (D-06) */}
                {score !== null && (
                  isUsed ? (
                    <span className="text-xs text-muted-foreground">checkmark used</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePerStatReroll(ability)}
                      aria-label={`Reroll ${ABILITY_ABBREVIATIONS[ability]}`}
                      className="h-6 w-6 flex items-center justify-center rounded text-sm hover:bg-surface/60 border border-border transition-colors"
                      title={`Reroll ${ABILITY_ABBREVIATIONS[ability]} (keeps better result)`}
                    >
                      🎲
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
        {assignedCount < 6 && (
          <p className="text-sm text-destructive mb-4">
            Click "Roll Stats" to generate ability scores.
          </p>
        )}
        {renderSkillPanel()}
      </div>
    )
  }

  /** Point Buy tab content */
  function renderPointBuyTab() {
    return (
      <div className="overflow-y-auto p-3">
        {/* Budget bar */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Points Spent</span>
          <span
            className={cn(
              'font-mono text-sm font-semibold',
              budgetColorClass(),
            )}
          >
            {pointBuySpent} / {pointBuyBudget} pts
          </span>
        </div>
        {pointBuySpent > pointBuyBudget && (
          <p className="text-sm text-destructive mb-3">
            Over budget — reduce scores or add more negative traits.
          </p>
        )}

        {/* Score rows */}
        <div className="space-y-2 mb-4">
          {ABILITY_NAMES.map((ability) => {
            const score = scores[ability] ?? 8
            const modifier = calcAbilityModifier(score)
            const isSaveProficient = classSaves
              .map((s) => s.toLowerCase())
              .includes(ability.toLowerCase())
            const canDecrement = score > 8
            const canIncrement = score < 15

            return (
              <div key={ability} className="flex items-center gap-2">
                <span className="text-sm font-semibold w-10">
                  {ABILITY_ABBREVIATIONS[ability]}
                </span>
                <button
                  type="button"
                  onClick={() => handlePointBuyStep(ability, -1)}
                  disabled={!canDecrement}
                  className="h-7 w-7 flex items-center justify-center rounded border border-border text-sm font-semibold hover:bg-surface/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Decrease ${ABILITY_ABBREVIATIONS[ability]}`}
                >
                  −
                </button>
                <span className="font-mono text-sm font-semibold w-8 text-center">
                  {score}
                </span>
                <button
                  type="button"
                  onClick={() => handlePointBuyStep(ability, 1)}
                  disabled={!canIncrement}
                  className="h-7 w-7 flex items-center justify-center rounded border border-border text-sm font-semibold hover:bg-surface/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Increase ${ABILITY_ABBREVIATIONS[ability]}`}
                >
                  +
                </button>
                <span className="text-xs text-muted-foreground w-12 text-center">
                  {modifier >= 0 ? `+${modifier}` : `${modifier}`}
                </span>
                <span className="text-xs text-muted-foreground w-14 text-right">
                  {POINT_BUY_COST[score] ?? 0} pts
                </span>
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
            )
          })}
        </div>

        <Separator className="my-4" />

        {/* Negative Traits panel */}
        <div>
          <h4 className="text-sm font-semibold mb-0.5">Negative Traits</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Take on mechanical flaws to earn additional point-buy points.
          </p>

          {/* Preset flaws */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Preset Flaws
          </p>
          <div className="space-y-2 mb-4">
            {PRESET_FLAWS.map((flaw) => {
              const checked = negativeTraits.presetFlaws.includes(flaw.id)
              return (
                <label
                  key={flaw.id}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePresetFlaw(flaw.id)}
                    className="accent-amber-500"
                  />
                  <span className="font-semibold">{flaw.name}</span>
                  <span className="text-xs text-muted-foreground flex-1">
                    {flaw.penalty}
                  </span>
                  <span className="text-xs font-mono rounded px-1 bg-surface border border-border text-accent-gold whitespace-nowrap">
                    +{flaw.points} pts
                  </span>
                </label>
              )
            })}
          </div>

          {/* Free-form flaws */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Free-Form Flaws (up to 2)
          </p>
          <div className="space-y-2">
            {([0, 1] as const).map((i) => {
              const value = negativeTraits.freeFormFlaws[i]
              const isFilled = value.trim().length > 0
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Textarea
                      rows={2}
                      value={value}
                      onChange={(e) => setFreeFormFlaw(i, e.target.value)}
                      placeholder={`Describe a narrative flaw… (flaw ${i + 1})`}
                      className="resize-none text-sm"
                      maxLength={280}
                    />
                  </div>
                  {isFilled && (
                    <span className="text-xs font-mono rounded px-1 bg-surface border border-border text-accent-gold mt-1 whitespace-nowrap">
                      +2 pts
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {renderSkillPanel()}
      </div>
    )
  }

  /** Manual tab content */
  function renderManualTab() {
    return (
      <div className="overflow-y-auto p-3">
        <div className="space-y-3 mb-4">
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
                  <span className="text-sm font-semibold w-10">
                    {ABILITY_ABBREVIATIONS[ability]}
                  </span>
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
                  <span className="text-sm font-semibold w-12 text-center">
                    {modifier !== null
                      ? modifier >= 0
                        ? `+${modifier}`
                        : `${modifier}`
                      : '—'}
                  </span>
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
              </div>
            )
          })}
        </div>
        {assignedCount < 6 && (
          <p className="text-sm text-destructive mb-4">
            Enter all 6 ability scores to continue.
          </p>
        )}
        {renderSkillPanel()}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Method selector tabs */}
      <Tabs
        value={method}
        onValueChange={(v) => handleMethodChange(v as AbilityScoreMethod)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="px-3 pt-3 pb-0 flex-shrink-0">
          <TabsList className="h-9 w-full grid grid-cols-4">
            <TabsTrigger value="standard-array" className="text-xs px-2">
              Standard Array
            </TabsTrigger>
            <TabsTrigger value="4d6-roll" className="text-xs px-2">
              4d6 Roll
            </TabsTrigger>
            <TabsTrigger value="point-buy" className="text-xs px-2">
              Point Buy
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs px-2">
              Manual
            </TabsTrigger>
          </TabsList>
          {renderSwitchConfirmation()}
        </div>

        <TabsContent value="standard-array" className="flex-1 overflow-hidden mt-0">
          {renderStandardArrayTab()}
        </TabsContent>

        <TabsContent value="4d6-roll" className="flex-1 overflow-auto mt-0">
          {render4d6Tab()}
        </TabsContent>

        <TabsContent value="point-buy" className="flex-1 overflow-auto mt-0">
          {renderPointBuyTab()}
        </TabsContent>

        <TabsContent value="manual" className="flex-1 overflow-auto mt-0">
          {renderManualTab()}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function isStep2Valid(state: WizardState): boolean {
  const method = state.abilityScoreMethod
  const allAssigned = Object.values(state.abilityScores).every((v) => v !== null)
  const skillsOk =
    state.selectedSkillProficiencies.length === (state.selectedClass?.skillChoiceCount ?? 0)

  if (method === 'point-buy') {
    const spent = calcPointBuyCost(state.abilityScores)
    const budget = calcPointBuyBudget(
      state.negativeTraits.presetFlaws,
      state.negativeTraits.freeFormFlaws,
    )
    return allAssigned && spent <= budget && skillsOk
  }

  return allAssigned && skillsOk
}
