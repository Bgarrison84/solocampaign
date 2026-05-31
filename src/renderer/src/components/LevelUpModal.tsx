/**
 * LevelUpModal — Dialog for level-up flow (D-31, D-32, D-33, PROG-01, UI-SPEC §S7b).
 *
 * Presents:
 *  - New level number (Display role, 28px)
 *  - HP Gain section: Roll d{hitDie} (inline Roll button, shows result) OR Take average
 *  - New spell slot totals table (from spells-by-class.json; skipped for non-spellcasters)
 *  - Subclass deferred note at subclass-granting levels (D-33)
 *  - Footer: "Not Now" (ghost) | "Confirm Level Up" (default/gold, disabled until HP chosen)
 *
 * On confirm: calls trpc.characters.levelUp + trpc.characters.recordSystemMessage.
 */

import React, { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { trpc } from '../lib/trpc'
import { rollExpression } from '../lib/dice'
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
 * Levels at which each class gains a subclass (D-33 — show deferred note).
 * D-33 says: "Subclass selection deferred to Phase 7"; we show the italic note here.
 */
const SUBCLASS_LEVELS: Record<string, number[]> = {
  barbarian: [3], fighter: [3], paladin: [3], ranger: [3],
  bard: [3], cleric: [1], druid: [2], monk: [3], rogue: [3], warlock: [1],
  sorcerer: [1], wizard: [2],
}

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

// ─── Spell slots for the next level ────────────────────────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────────────────

interface LevelUpModalProps {
  open: boolean
  onClose: () => void
  character: CharacterWithResources
}

export function LevelUpModal({ open, onClose, character }: LevelUpModalProps) {
  const queryClient = useQueryClient()

  const nextLevel = character.level + 1
  const classKey = character.class.toLowerCase()
  const hitDie = HIT_DIE_BY_CLASS[classKey] ?? 8
  const hitDieAverage = Math.floor(hitDie / 2) + 1
  const con = conMod(character.constitution)

  // HP gain state
  const [hpMethod, setHpMethod] = useState<'roll' | 'average' | null>(null)
  const [hpRollResult, setHpRollResult] = useState<number | null>(null)

  // Derived HP gain values
  const hpBase =
    hpMethod === 'average'
      ? hitDieAverage
      : hpMethod === 'roll' && hpRollResult !== null
        ? hpRollResult
        : null

  const hpGainTotal = hpBase !== null ? Math.max(1, hpBase + con) : null

  // Slot data for display
  const newSpellSlots = open ? getNewSpellSlots(character.class, nextLevel) : null

  // Subclass level check (D-33)
  const subclassLevels = SUBCLASS_LEVELS[classKey] ?? []
  const isSubclassLevel = subclassLevels.includes(nextLevel)

  // Confirm disabled until HP method + optional roll resolved
  const confirmDisabled =
    hpGainTotal === null ||
    (hpMethod === 'roll' && hpRollResult === null)

  const handleRollHp = useCallback(() => {
    const roll = rollExpression(`d${hitDie}`)
    setHpRollResult(roll.result)
  }, [hitDie])

  const levelUpMutation = useMutation({
    mutationFn: (vars: { hpGain: number; newSlotMax: Record<string, number> }) =>
      trpc.characters.levelUp.mutate({
        characterId: character.id,
        hpGain: vars.hpGain,
        newSlotMax: vars.newSlotMax,
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
      handleClose()
    },
  })

  const handleConfirm = () => {
    if (hpGainTotal === null) return
    // Build new slot max map from the slots at next level
    const newSlotMax: Record<string, number> = {}
    if (newSpellSlots) {
      for (const [level, max] of Object.entries(newSpellSlots)) {
        newSlotMax[level] = max
      }
    }
    levelUpMutation.mutate({ hpGain: hpGainTotal, newSlotMax })
  }

  const handleClose = () => {
    // Reset state on close
    setHpMethod(null)
    setHpRollResult(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !levelUpMutation.isPending) handleClose()
      }}
    >
      <DialogContent className="max-w-[480px] w-full max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Level Up</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">
          {/* New level display */}
          <div className="flex flex-col gap-1">
            <div className="text-[28px] font-semibold text-foreground leading-tight">
              {nextLevel}
            </div>
            <p className="text-sm text-foreground">You are now Level {nextLevel}!</p>
            <p className="text-sm text-muted-foreground">Congratulations, {character.name}.</p>
          </div>

          {/* HP Gain section */}
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

          {/* New Spell Slots section */}
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

          {/* Subclass deferred note (D-33) */}
          {isSubclassLevel && (
            <p className="text-xs text-muted-foreground italic">
              Subclass selection will be available in a future update.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={levelUpMutation.isPending}
          >
            Not Now
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={confirmDisabled || levelUpMutation.isPending}
          >
            {levelUpMutation.isPending ? (
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
