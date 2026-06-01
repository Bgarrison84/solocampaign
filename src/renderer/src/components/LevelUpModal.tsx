/**
 * LevelUpModal — Extended level-up flow (D-07, D-15, D-24, D-25, CHAR-04, CHAR-05, PROG-03).
 *
 * Four new branches added in Phase 7 (07-05):
 *  1. Multiclass choice (top of body) — continue primary class OR add/level a secondary class
 *  2. ASI/Feat choice at ASI levels (4, 8, 12, 16, 19) — +2 or +1/+1, OR pick a feat
 *  3. Subclass picker at the class's subclass level — replaces Phase 5 "deferred" note
 *  4. Epic Boon picker at levels > 20 — replaces ASI/feat section
 *
 * Single-class characters are unaffected — all new branches gate behind guards (Pitfall 5).
 * No hard level-20 cap (D-24 — removed from charactersRepo.levelUp in Task 0).
 *
 * Persistence contract (PRESCRIBED):
 *   Multiclass pick → trpc.characters.levelUp({ ..., classes: ClassEntry[] })
 *   Subclass pick   → trpc.characters.levelUp({ ..., subclass: string })
 *   Feat            → trpc.feats.add({ featSource: 'srd'|'custom' })
 *   Epic Boon       → trpc.feats.add({ featSource: 'epic_boon' })
 */

import React, { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { trpc } from '../lib/trpc'
import { rollExpression } from '../lib/dice'
import { FeatPicker } from './FeatPicker'
import type { FeatSelection } from './FeatPicker'
import type { CharacterWithResources } from '../../../main/db/charactersRepo'

// ─── D&D 5e constants ──────────────────────────────────────────────────────────

/**
 * XP required to reach each level (PROG-01, D-30, cited: D&D 5e SRD 5.1).
 * Levels 21+ extend the curve using the per-level delta from the 17–20 segment
 * (~40 000–50 000 XP per level). D-24: no hard level-20 cap.
 */
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000,
  // D-24: extended past level 20 (50 000 XP per level, matching the late-game delta)
  21: 405000, 22: 455000, 23: 505000, 24: 555000, 25: 605000,
  26: 655000, 27: 705000, 28: 755000, 29: 805000, 30: 855000,
}

/** Hit die by class (verified: resources/classes.json hitDie field) */
export const HIT_DIE_BY_CLASS: Record<string, number> = {
  barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  sorcerer: 6, wizard: 6,
}

/**
 * Levels at which each class gains a subclass (D-15).
 * Phase 7 replaces the Phase 5 "deferred" note with an actual picker.
 */
const SUBCLASS_LEVELS: Record<string, number[]> = {
  barbarian: [3], fighter: [3], paladin: [3], ranger: [3],
  bard: [3], cleric: [1], druid: [2], monk: [3], rogue: [3], warlock: [1],
  sorcerer: [1], wizard: [2],
}

/**
 * Levels at which most classes gain an Ability Score Improvement (ASI).
 * (Standard 5e ASI levels — not class-specific for this guard.)
 */
const ASI_LEVELS = [4, 8, 12, 16, 19]

/** All 12 SRD base class names for the multiclass picker. */
const SRD_CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
  'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
  'Warlock', 'Wizard',
]

/** Ability score names for ASI pickers. */
const ABILITY_NAMES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as const
type AbilityName = typeof ABILITY_NAMES[number]

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ClassEntry {
  className: string
  level: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Ordinal string for a slot level (1 → "1st", etc.) */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** Compute CON modifier */
function conMod(constitution: number): number {
  return Math.floor((constitution - 10) / 2)
}

/**
 * Load spells-by-class.json and return the slot table for the given class at nextLevel.
 * Returns null for non-spellcasters or if class is not found.
 */
function getNewSpellSlots(
  className: string,
  nextLevel: number,
): Record<string, number> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const spellsByClass = require('../../../../resources/spells-by-class.json') as Record<
      string,
      Record<string, Record<string, number>>
    >
    const classKey = className.toLowerCase()
    const levelKey = String(nextLevel)
    const classData = spellsByClass[classKey]
    if (!classData) return null
    const levelData = classData[levelKey]
    if (!levelData) return null
    return levelData
  } catch {
    return null
  }
}

/**
 * Load classes.json and return the subclasses array for a given class key.
 */
function getClassSubclasses(classKey: string): Array<{ id: string; name: string; description: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const classes = require('../../../../resources/classes.json') as Array<{
      id: string
      subclasses?: Array<{ id: string; name: string; description: string }>
    }>
    const cls = classes.find((c) => c.id === classKey)
    return cls?.subclasses ?? []
  } catch {
    return []
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface LevelUpModalProps {
  open: boolean
  onClose: () => void
  character: CharacterWithResources
}

export function LevelUpModal({ open, onClose, character }: LevelUpModalProps) {
  const queryClient = useQueryClient()

  // ── Multiclass guard (D-07, D-08) ──
  // character.classes is a JSON column: ClassEntry[] | null
  // If null or empty, fall back to the primary class column.
  const classes: ClassEntry[] = (() => {
    try {
      const raw = (character as unknown as { classes?: string | null }).classes
      if (!raw) return [{ className: character.class, level: character.level }]
      const parsed = typeof raw === 'string' ? (JSON.parse(raw) as ClassEntry[]) : raw
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : [{ className: character.class, level: character.level }]
    } catch {
      return [{ className: character.class, level: character.level }]
    }
  })()

  const isMulticlass = classes.length > 1
  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0)
  // nextLevel is the total level after this level-up (D-24: uncapped)
  const nextLevel = totalLevel + 1

  // ── Class-derived values (only meaningful for single-class path) ──
  const primaryClassKey = classes[0]?.className?.toLowerCase() ?? character.class.toLowerCase()
  const classKey = !isMulticlass ? primaryClassKey : primaryClassKey
  const hitDie = HIT_DIE_BY_CLASS[classKey] ?? 8
  const hitDieAverage = Math.floor(hitDie / 2) + 1
  const con = conMod(character.constitution)

  // ── Level branch guards ──
  const isEpicBoonLevel = nextLevel > 20
  const isASILevel = ASI_LEVELS.includes(nextLevel)
  // Subclass levels only apply when NOT multiclassing (D-15 note)
  const subclassLevels = !isMulticlass ? (SUBCLASS_LEVELS[classKey] ?? []) : []
  const isSubclassLevel = subclassLevels.includes(nextLevel)

  // ── Spell slots (only for single-class, skip when multiclassing to keep it simple) ──
  const newSpellSlots =
    open && !isMulticlass ? getNewSpellSlots(character.class, nextLevel) : null

  // ── Subclass options ──
  const classSubclasses = isSubclassLevel ? getClassSubclasses(classKey) : []

  // ─────────────────────────────────────────────────────────────────────────────
  // Component state
  // ─────────────────────────────────────────────────────────────────────────────

  // HP
  const [hpMethod, setHpMethod] = useState<'roll' | 'average' | null>(null)
  const [hpRollResult, setHpRollResult] = useState<number | null>(null)

  // Multiclass choice
  const [multiclassChoice, setMulticlassChoice] = useState<'continue' | 'add'>('continue')
  const [selectedMulticlass, setSelectedMulticlass] = useState<string | null>(null)

  // ASI choice
  const [asiChoice, setAsiChoice] = useState<'asi' | 'feat' | null>(null)
  const [asiType, setAsiType] = useState<'plus2' | 'plus1plus1'>('plus2')
  const [asiAbility1, setAsiAbility1] = useState<AbilityName | null>(null)
  const [asiAbility2, setAsiAbility2] = useState<AbilityName | null>(null)
  const [selectedFeat, setSelectedFeat] = useState<FeatSelection | null>(null)

  // Subclass
  const [selectedSubclass, setSelectedSubclass] = useState<string | null>(null)
  const [subclassDescription, setSubclassDescription] = useState<string>('')

  // Submit error
  const [levelUpError, setLevelUpError] = useState<string | null>(null)

  // Epic Boon
  const { data: epicBoons = [] } = useQuery({
    queryKey: ['feats', 'listEpicBoons'],
    queryFn: () => trpc.feats.listEpicBoons.query(),
    enabled: open && isEpicBoonLevel,
  })
  const [selectedBoon, setSelectedBoon] = useState<{ id: string; name: string; description: string } | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────────────────────

  const hpBase =
    hpMethod === 'average'
      ? hitDieAverage
      : hpMethod === 'roll' && hpRollResult !== null
        ? hpRollResult
        : null

  const hpGainTotal = hpBase !== null ? Math.max(1, hpBase + con) : null

  // Build the classes array that will be persisted on multiclass pick
  const updatedClasses: ClassEntry[] = (() => {
    if (!isMulticlass && multiclassChoice === 'continue') {
      // Single-class continuing: not passed (no change)
      return []
    }
    if (multiclassChoice === 'add' && selectedMulticlass) {
      // Adding or leveling a multiclass
      const existingIdx = classes.findIndex(
        (c) => c.className.toLowerCase() === selectedMulticlass.toLowerCase(),
      )
      if (existingIdx >= 0) {
        // Level up existing multiclass
        return classes.map((c, i) =>
          i === existingIdx ? { ...c, level: c.level + 1 } : c,
        )
      } else {
        // Add new class at level 1
        return [...classes, { className: selectedMulticlass, level: 1 }]
      }
    }
    // Continue primary class
    return classes.map((c, i) => (i === 0 ? { ...c, level: c.level + 1 } : c))
  })()

  // confirmDisabled: gate all required choices
  const confirmDisabled = (() => {
    if (hpGainTotal === null || (hpMethod === 'roll' && hpRollResult === null)) return true
    // Multiclass: if "add" selected but no class chosen
    if (isMulticlass && multiclassChoice === 'add' && !selectedMulticlass) return true
    // Subclass required
    if (isSubclassLevel && !selectedSubclass) return true
    // ASI/feat required (not at epic boon levels)
    if (isASILevel && !isEpicBoonLevel) {
      if (!asiChoice) return true
      if (asiChoice === 'feat' && !selectedFeat) return true
      if (asiChoice === 'asi') {
        if (asiType === 'plus2' && !asiAbility1) return true
        if (asiType === 'plus1plus1' && (!asiAbility1 || !asiAbility2)) return true
      }
    }
    // Epic boon required
    if (isEpicBoonLevel && !selectedBoon) return true
    return false
  })()

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const featAddMutation = useMutation({
    mutationFn: (vars: {
      characterId: string
      featName: string
      featSource: 'srd' | 'custom' | 'epic_boon'
      customFeatId?: string
    }) => trpc.feats.add.mutate(vars),
  })

  const levelUpMutation = useMutation({
    mutationFn: (vars: {
      hpGain: number
      newSlotMax: Record<string, number>
      classes?: ClassEntry[]
      subclass?: string
    }) =>
      trpc.characters.levelUp.mutate({
        characterId: character.id,
        hpGain: vars.hpGain,
        newSlotMax: vars.newSlotMax,
        classes: vars.classes,
        subclass: vars.subclass,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['characters', 'getByCampaignId', character.campaignId],
        }),
        trpc.characters.recordSystemMessage.mutate({
          campaignId: character.campaignId,
          content: `[System: ${character.name} reached Level ${nextLevel}!]`,
        }),
      ])
      await queryClient.invalidateQueries({
        queryKey: ['ai', 'getMessages', character.campaignId],
      })
      if (isASILevel && !isEpicBoonLevel && asiChoice === 'feat' && selectedFeat) {
        await queryClient.invalidateQueries({
          queryKey: ['feats', 'listByCharacter', character.id],
        })
      }
      if (isEpicBoonLevel) {
        await queryClient.invalidateQueries({
          queryKey: ['feats', 'listByCharacter', character.id],
        })
      }
      handleClose()
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleRollHp = useCallback(() => {
    const roll = rollExpression(`d${hitDie}`)
    setHpRollResult(roll.result)
  }, [hitDie])

  const handleConfirm = async () => {
    if (hpGainTotal === null) return
    setLevelUpError(null)

    try {
      // Build new slot max
      const newSlotMax: Record<string, number> = {}
      if (newSpellSlots) {
        for (const [level, max] of Object.entries(newSpellSlots)) {
          newSlotMax[level] = max
        }
      }

      // Determine classes to persist
      const classesToPersist =
        isMulticlass || multiclassChoice === 'add'
          ? updatedClasses.length > 0 ? updatedClasses : undefined
          : undefined

      // Determine subclass to persist
      const subclassToPersist = isSubclassLevel && selectedSubclass ? selectedSubclass : undefined

      // Level up first — only persist feat/boon if level-up succeeds (CR-03)
      await levelUpMutation.mutateAsync({
        hpGain: hpGainTotal,
        newSlotMax,
        classes: classesToPersist,
        subclass: subclassToPersist,
      })

      // Persist feat / epic boon only after successful level-up
      if (isASILevel && !isEpicBoonLevel && asiChoice === 'feat' && selectedFeat) {
        await featAddMutation.mutateAsync({
          characterId: character.id,
          featName: selectedFeat.featName,
          featSource: selectedFeat.featSource,
          customFeatId: selectedFeat.customFeatId,
        })
      }
      if (isEpicBoonLevel && selectedBoon) {
        await featAddMutation.mutateAsync({
          characterId: character.id,
          featName: selectedBoon.name,
          featSource: 'epic_boon',
        })
      }
    } catch (err) {
      setLevelUpError(err instanceof Error ? err.message : 'Level-up failed. Please try again.')
    }
  }

  const handleClose = () => {
    // Reset all state on close
    setLevelUpError(null)
    setHpMethod(null)
    setHpRollResult(null)
    setMulticlassChoice('continue')
    setSelectedMulticlass(null)
    setAsiChoice(null)
    setAsiType('plus2')
    setAsiAbility1(null)
    setAsiAbility2(null)
    setSelectedFeat(null)
    setSelectedSubclass(null)
    setSubclassDescription('')
    setSelectedBoon(null)
    onClose()
  }

  const isPending = levelUpMutation.isPending || featAddMutation.isPending

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isPending) handleClose()
      }}
    >
      <DialogContent className="max-w-[520px] w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Level Up</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="px-6 py-4 flex flex-col gap-5 overflow-y-auto flex-1">
          {/* New level display */}
          <div className="flex flex-col gap-1">
            <div className="text-[28px] font-semibold text-foreground leading-tight">
              {nextLevel}
            </div>
            <p className="text-sm text-foreground">You are now Level {nextLevel}!</p>
            <p className="text-sm text-muted-foreground">Congratulations, {character.name}.</p>
          </div>

          {/* ── Multiclass choice (only shown when character already has multiple classes,
               or when the player explicitly wants to add one — always offered) ── */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Class progression:</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="multiclass-choice"
                value="continue"
                checked={multiclassChoice === 'continue'}
                onChange={() => setMulticlassChoice('continue')}
              />
              <span className="text-sm text-foreground">
                Continue as {classes[0]?.className ?? character.class} (Level {(classes[0]?.level ?? character.level) + (multiclassChoice === 'continue' ? 1 : 0)})
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="multiclass-choice"
                value="add"
                checked={multiclassChoice === 'add'}
                onChange={() => setMulticlassChoice('add')}
              />
              <span className="text-sm text-foreground">Add / level multiclass</span>
            </label>
            {multiclassChoice === 'add' && (
              <div className="ml-6">
                <Select
                  value={selectedMulticlass ?? ''}
                  onValueChange={(v) => setSelectedMulticlass(v)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Choose a class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SRD_CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                        {classes.find((c) => c.className === cls) &&
                          ` (Level ${classes.find((c) => c.className === cls)!.level})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMulticlass && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {classes.find((c) => c.className === selectedMulticlass)
                      ? `Leveling ${selectedMulticlass} to ${(classes.find((c) => c.className === selectedMulticlass)!.level) + 1}`
                      : `Adding ${selectedMulticlass} as a new class at Level 1`}
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* ── HP Gain section (single-class path uses class hit die; multiclass uses primary hit die) ── */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Choose how to gain HP:</p>

            {/* Roll option */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hp-method"
                value="roll"
                checked={hpMethod === 'roll'}
                onChange={() => {
                  setHpMethod('roll')
                  setHpRollResult(null)
                }}
              />
              <span className="text-sm text-foreground">Roll d{hitDie}</span>
              {hpMethod === 'roll' && hpRollResult !== null && (
                <span className="text-sm font-mono font-semibold text-foreground ml-2">
                  &rarr; {hpRollResult}
                </span>
              )}
              {hpMethod === 'roll' && hpRollResult === null && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs ml-2"
                  onClick={(e) => {
                    e.preventDefault()
                    handleRollHp()
                  }}
                  type="button"
                >
                  Roll
                </Button>
              )}
            </label>

            {/* Average option */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hp-method"
                value="average"
                checked={hpMethod === 'average'}
                onChange={() => setHpMethod('average')}
              />
              <span className="text-sm text-foreground">Take average {hitDieAverage}</span>
            </label>

            {/* HP summary */}
            {hpGainTotal !== null && (
              <p className="text-sm text-muted-foreground">
                HP gained:{' '}
                <span className="font-semibold text-foreground">+{hpGainTotal}</span>
                {con !== 0 && (
                  <span>
                    {' '}({hpBase} + CON modifier {con >= 0 ? '+' : ''}{con})
                  </span>
                )}
              </p>
            )}
          </div>

          {/* ── New Spell Slots section (single-class only) ── */}
          {newSpellSlots && Object.keys(newSpellSlots).length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                New spell slot totals at Level {nextLevel}:
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(newSpellSlots).map(([level, max]) => (
                  <span key={level}>
                    {ordinal(parseInt(level, 10))}: {max}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Subclass picker (only at isSubclassLevel, not multiclass) ── */}
          {isSubclassLevel && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground">Choose Your Subclass</p>
                <p className="text-xs text-muted-foreground">
                  At Level {nextLevel}, your {classes[0]?.className ?? character.class} gains a subclass.
                  Your choice shapes your abilities from here forward.
                </p>
                {classSubclasses.length > 0 ? (
                  <>
                    <Select
                      value={selectedSubclass ?? ''}
                      onValueChange={(v) => {
                        setSelectedSubclass(v)
                        const sc = classSubclasses.find((s) => s.id === v)
                        setSubclassDescription(sc?.description ?? '')
                      }}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Choose a subclass…" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubclasses.map((sc) => (
                          <SelectItem key={sc.id} value={sc.id}>
                            {sc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {subclassDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {subclassDescription}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No subclass data available for this class.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── ASI / Feat section (only at ASI levels, not Epic Boon levels) ── */}
          {isASILevel && !isEpicBoonLevel && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-foreground">Ability Score Improvement or Feat</p>
                <p className="text-xs text-muted-foreground">
                  At Level {nextLevel} you gain an ASI or a feat.
                </p>

                {/* ASI option */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="asi-choice"
                    value="asi"
                    checked={asiChoice === 'asi'}
                    onChange={() => setAsiChoice('asi')}
                  />
                  <span className="text-sm text-foreground">Ability Score Improvement</span>
                </label>
                {asiChoice === 'asi' && (
                  <div className="ml-6 flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="asi-type"
                        value="plus2"
                        checked={asiType === 'plus2'}
                        onChange={() => setAsiType('plus2')}
                      />
                      +2 to one ability
                    </label>
                    {asiType === 'plus2' && (
                      <Select value={asiAbility1 ?? ''} onValueChange={(v) => setAsiAbility1(v as AbilityName)}>
                        <SelectTrigger className="h-8 w-48">
                          <SelectValue placeholder="Choose ability" />
                        </SelectTrigger>
                        <SelectContent>
                          {ABILITY_NAMES.map((a) => (
                            <SelectItem key={a} value={a}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="asi-type"
                        value="plus1plus1"
                        checked={asiType === 'plus1plus1'}
                        onChange={() => setAsiType('plus1plus1')}
                      />
                      +1 to two abilities
                    </label>
                    {asiType === 'plus1plus1' && (
                      <div className="flex gap-2">
                        <Select value={asiAbility1 ?? ''} onValueChange={(v) => setAsiAbility1(v as AbilityName)}>
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue placeholder="First" />
                          </SelectTrigger>
                          <SelectContent>
                            {ABILITY_NAMES.map((a) => (
                              <SelectItem key={a} value={a}>{a}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={asiAbility2 ?? ''} onValueChange={(v) => setAsiAbility2(v as AbilityName)}>
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue placeholder="Second" />
                          </SelectTrigger>
                          <SelectContent>
                            {ABILITY_NAMES.map((a) => (
                              <SelectItem key={a} value={a}>{a}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Feat option */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="asi-choice"
                    value="feat"
                    checked={asiChoice === 'feat'}
                    onChange={() => setAsiChoice('feat')}
                  />
                  <span className="text-sm text-foreground">Choose a Feat</span>
                </label>
                {asiChoice === 'feat' && (
                  <div className="ml-6">
                    <FeatPicker
                      campaignId={character.campaignId}
                      selectedFeatName={selectedFeat?.featName ?? null}
                      onSelect={(sel) => setSelectedFeat(sel)}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Epic Boon picker (levels > 20; replaces ASI/feat section) ── */}
          {isEpicBoonLevel && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground">Epic Boon</p>
                <p className="text-xs text-muted-foreground">
                  Choose one boon for reaching Level {nextLevel}.
                </p>
                <ScrollArea className="h-[240px] rounded-md border border-border">
                  <div className="p-1">
                    {epicBoons.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">Loading boons…</p>
                    )}
                    {epicBoons.map((boon) => {
                      const isSelected = selectedBoon?.id === boon.id
                      return (
                        <div
                          key={boon.id}
                          className={[
                            'flex flex-col px-2 py-2 rounded-sm cursor-pointer select-none transition-colors',
                            isSelected
                              ? 'bg-secondary border-l-2 border-accent-gold'
                              : 'hover:bg-accent/50',
                          ].join(' ')}
                          onClick={() => setSelectedBoon(boon as { id: string; name: string; description: string })}
                        >
                          <span className="text-[14px] font-semibold leading-tight text-foreground">
                            {(boon as { name: string }).name}
                          </span>
                          <span className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                            {(boon as { description: string }).description}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {levelUpError && (
            <p className="text-sm text-destructive w-full mb-2">{levelUpError}</p>
          )}
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isPending}
          >
            Not Now
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={confirmDisabled || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Leveling Up&hellip;
              </>
            ) : (
              'Confirm Level Up'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
