/**
 * ShortRestHitDiceModal — Hit-die roll modal for short rest (D-36, PROG-02, UI-SPEC §S8b).
 *
 * Opens automatically when the AI grants a short rest via processRest({type:'short'}).
 * Player chooses how many hit dice to roll, rolls them, sees per-die results, then
 * clicks "Done" to apply HP recovery + decrement hit dice spent via applyShortRestHp.
 *
 * Clicking "Skip" closes without applying anything (D-35 — short rest confirmed by AI,
 * but player may choose not to spend hit dice).
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
import { Stepper } from './sheet/Stepper'
import { trpc } from '../lib/trpc'
import { rollExpression } from '../lib/dice'
import { HIT_DIE_BY_CLASS } from './LevelUpModal'
import type { CharacterWithResources } from '../../../main/db/charactersRepo'

interface ShortRestHitDiceModalProps {
  open: boolean
  onClose: () => void
  character: CharacterWithResources | null | undefined
}

/** Compute CON modifier */
function conMod(constitution: number): number {
  return Math.floor((constitution - 10) / 2)
}

export function ShortRestHitDiceModal({
  open,
  onClose,
  character,
}: ShortRestHitDiceModalProps) {
  const queryClient = useQueryClient()

  const [diceToRoll, setDiceToRoll] = useState(1)
  const [rollResults, setRollResults] = useState<number[]>([])

  if (!character) return null

  const classKey = character.class.toLowerCase()
  const hitDie = HIT_DIE_BY_CLASS[classKey] ?? 8
  const con = conMod(character.constitution)

  // Hit dice available: use DB values if seeded, otherwise fall back to character level
  const hitDiceCurrent = character.resources.hitDiceCurrent ?? character.level
  const hitDiceTotal = character.resources.hitDiceTotal ?? character.level

  // Per-die HP: max(0, roll + con)
  const perDieHp = rollResults.map((r) => Math.max(0, r + con))
  const totalHpRecovered = perDieHp.reduce((sum, hp) => sum + hp, 0)

  const handleRollHitDice = useCallback(() => {
    const results: number[] = []
    for (let i = 0; i < diceToRoll; i++) {
      const roll = rollExpression(`d${hitDie}`)
      results.push(roll.result)
    }
    setRollResults(results)
  }, [diceToRoll, hitDie])

  const applyMutation = useMutation({
    mutationFn: () =>
      trpc.characters.applyShortRestHp.mutate({
        characterId: character.id,
        hpRecovered: totalHpRecovered,
        diceSpent: diceToRoll,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['characters', 'getByCampaignId', character.campaignId],
      })
      handleClose()
    },
  })

  const handleClose = () => {
    setDiceToRoll(1)
    setRollResults([])
    onClose()
  }

  const hasRolled = rollResults.length > 0
  const doneDisabled = !hasRolled || applyMutation.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !applyMutation.isPending) handleClose()
      }}
    >
      <DialogContent className="max-w-[440px] w-full max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Short Rest — Hit Dice</DialogTitle>
        </DialogHeader>

        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          {hitDiceCurrent <= 0 ? (
            /* WR-05: guard against hitDiceCurrent=0 — Stepper min(1) > max(0) is invalid */
            <p className="text-sm text-muted-foreground">
              No hit dice remaining. You have spent all{' '}
              <span className="font-semibold">{hitDiceTotal}</span> hit dice.
              Take a long rest to recover them.
            </p>
          ) : (
          <>
          {/* Info text */}
          <p className="text-sm text-foreground">
            You have{' '}
            <span className="font-semibold">{hitDiceCurrent}</span> of{' '}
            <span className="font-semibold">{hitDiceTotal}</span> hit dice remaining.
            Roll hit dice to recover HP.
          </p>

          {/* Dice count stepper */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground">Roll how many?</span>
            <Stepper
              value={diceToRoll}
              min={1}
              max={hitDiceCurrent}
              size="sm"
              label="Hit dice to roll"
              onChange={(delta) =>
                setDiceToRoll((prev) => Math.max(1, Math.min(hitDiceCurrent, prev + delta)))
              }
            />
            <span className="text-sm text-muted-foreground">(max: {hitDiceCurrent})</span>
          </div>

          {/* Roll button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRollHitDice}
            disabled={hitDiceCurrent < 1}
          >
            Roll Hit Dice
          </Button>

          {/* Per-die results */}
          {rollResults.length > 0 && (
            <div className="flex flex-col gap-1">
              {rollResults.map((roll, i) => (
                <div
                  key={i}
                  className="text-sm font-mono text-foreground flex items-center gap-1"
                >
                  <span className="text-muted-foreground">d{hitDie} &rarr;</span>
                  <span className="font-semibold">{roll}</span>
                  <span className="text-muted-foreground">
                    +CON ({con >= 0 ? '+' : ''}{con})
                  </span>
                  <span>=</span>
                  <span className="font-semibold text-green-400">
                    {Math.max(0, roll + con)} HP
                  </span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex items-center justify-between mt-1">
                <span className="text-sm text-foreground">Total HP recovered:</span>
                <span className="text-sm font-semibold text-green-400">
                  +{totalHpRecovered}
                </span>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={applyMutation.isPending}
          >
            Skip
          </Button>
          <Button
            variant="default"
            onClick={() => applyMutation.mutate()}
            disabled={doneDisabled}
          >
            {applyMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Applying&hellip;
              </>
            ) : (
              `Done (+${totalHpRecovered} HP)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
