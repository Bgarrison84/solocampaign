import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { trpc } from '../../lib/trpc'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { Stepper } from './Stepper'
import { ConditionBadge } from './ConditionBadge'
import { SpellSlotPips } from './SpellSlotPips'
import { ALL_CONDITIONS, ordinal, type ConditionName } from './sheetHelpers'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface ResourcesSectionProps {
  character: CharacterWithResources
}

export function ResourcesSection({ character }: ResourcesSectionProps) {
  const queryClient = useQueryClient()
  const QUERY_KEY = ['characters', 'getByCampaignId', character.campaignId] as const

  // ─── HP Mutation ───────────────────────────────────────────────────────────
  const hpMutation = useMutation({
    mutationFn: (delta: number) =>
      trpc.characters.updateHp.mutate({ characterId: character.id, delta }),
    onMutate: async (delta) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            hpCurrent: Math.max(
              0,
              Math.min(prev.resources.hpMax, prev.resources.hpCurrent + delta),
            ),
          },
        })
      }
      return { prev }
    },
    onError: (_err, _delta, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  // ─── Temp HP Mutation ──────────────────────────────────────────────────────
  const tempHpMutation = useMutation({
    mutationFn: (delta: number) =>
      trpc.characters.updateTempHp.mutate({ characterId: character.id, delta }),
    onMutate: async (delta) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            hpTemp: Math.max(0, prev.resources.hpTemp + delta),
          },
        })
      }
      return { prev }
    },
    onError: (_err, _delta, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  // ─── Inspiration Mutation ──────────────────────────────────────────────────
  const inspirationMutation = useMutation({
    mutationFn: () =>
      trpc.characters.toggleInspiration.mutate({ characterId: character.id }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            hasInspiration: !prev.resources.hasInspiration,
          },
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  // ─── Death Saves Mutation ──────────────────────────────────────────────────
  const deathSavesMutation = useMutation({
    mutationFn: ({ successes, failures }: { successes: number; failures: number }) =>
      trpc.characters.updateDeathSaves.mutate({
        characterId: character.id,
        successes,
        failures,
      }),
    onMutate: async ({ successes, failures }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            deathSaveSuccesses: successes,
            deathSaveFailures: failures,
          },
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  // ─── Spell Slot Mutation ───────────────────────────────────────────────────
  const spellSlotMutation = useMutation({
    mutationFn: ({ slotLevel, delta }: { slotLevel: string; delta: number }) =>
      trpc.characters.updateSpellSlot.mutate({
        characterId: character.id,
        slotLevel,
        delta,
      }),
    onMutate: async ({ slotLevel, delta }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        const slot = prev.resources.spellSlots[slotLevel]
        if (slot) {
          queryClient.setQueryData(QUERY_KEY, {
            ...prev,
            resources: {
              ...prev.resources,
              spellSlots: {
                ...prev.resources.spellSlots,
                [slotLevel]: {
                  ...slot,
                  used: Math.max(0, Math.min(slot.max, slot.used + delta)),
                },
              },
            },
          })
        }
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  // ─── Condition Toggle Mutation ─────────────────────────────────────────────
  const conditionMutation = useMutation({
    mutationFn: (condition: ConditionName) =>
      trpc.characters.toggleCondition.mutate({ characterId: character.id, condition }),
    onMutate: async (condition) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        const conditions = prev.resources.conditions
        const newConditions = conditions.includes(condition)
          ? conditions.filter((c) => c !== condition)
          : [...conditions, condition]
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            conditions: newConditions,
          },
        })
      }
      return { prev }
    },
    onError: (_err, _condition, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  // ─── Death saves click handler ─────────────────────────────────────────────
  function handleSuccessClick(n: number) {
    const current = character.resources.deathSaveSuccesses
    const newVal = current === n ? n - 1 : n
    deathSavesMutation.mutate({
      successes: Math.max(0, newVal),
      failures: character.resources.deathSaveFailures,
    })
  }

  function handleFailureClick(n: number) {
    const current = character.resources.deathSaveFailures
    const newVal = current === n ? n - 1 : n
    deathSavesMutation.mutate({
      successes: character.resources.deathSaveSuccesses,
      failures: Math.max(0, newVal),
    })
  }

  // ─── Spell slots ──────────────────────────────────────────────────────────
  const spellSlotEntries = Object.entries(character.resources.spellSlots).sort(
    ([a], [b]) => parseInt(a) - parseInt(b),
  )
  const isSpellcaster = spellSlotEntries.length > 0

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">Resources</h2>

      {/* ── Hit Points ────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-sm font-semibold mb-1">Hit Points</p>
        <div className="flex flex-row items-center gap-3">
          <Stepper
            value={character.resources.hpCurrent}
            min={0}
            max={character.resources.hpMax}
            size="lg"
            label="Hit Points"
            onChange={(delta) => hpMutation.mutate(delta)}
          />
          <span className="text-muted-foreground text-base font-semibold">
            / {character.resources.hpMax}
          </span>
        </div>
        <div className="flex flex-row items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">Temp HP</span>
          <Stepper
            value={character.resources.hpTemp}
            min={0}
            size="sm"
            label="Temp HP"
            onChange={(delta) => tempHpMutation.mutate(delta)}
          />
        </div>
      </div>

      {/* ── Inspiration ────────────────────────────────────────── */}
      <div className="mb-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => inspirationMutation.mutate()}
          className={cn(
            'flex flex-row items-center gap-2',
            character.resources.hasInspiration &&
              'bg-accent-gold/20 border-accent-gold text-accent-gold',
          )}
          aria-pressed={character.resources.hasInspiration}
        >
          <Star
            className="w-4 h-4"
            fill={character.resources.hasInspiration ? 'currentColor' : 'none'}
          />
          Inspiration
        </Button>
      </div>

      {/* ── Death Saves ────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-sm font-semibold mb-2">Death Saves</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center gap-3">
            <span className="text-base font-semibold w-20">Successes</span>
            <div className="flex flex-row gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleSuccessClick(n)}
                  aria-label={`Death save success ${n}`}
                  aria-pressed={character.resources.deathSaveSuccesses >= n}
                  className={cn(
                    'w-5 h-5 rounded border transition-colors',
                    character.resources.deathSaveSuccesses >= n
                      ? 'bg-accent-gold border-accent-gold'
                      : 'border-border bg-transparent',
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-row items-center gap-3">
            <span className="text-base font-semibold w-20">Failures</span>
            <div className="flex flex-row gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleFailureClick(n)}
                  aria-label={`Death save failure ${n}`}
                  aria-pressed={character.resources.deathSaveFailures >= n}
                  className={cn(
                    'w-5 h-5 rounded border transition-colors',
                    character.resources.deathSaveFailures >= n
                      ? 'bg-destructive border-destructive'
                      : 'border-border bg-transparent',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Spell Slots ────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-sm font-semibold mb-2">Spell Slots</p>
        {isSpellcaster ? (
          <div className="flex flex-col gap-2">
            {spellSlotEntries.map(([slotLevel, slot]) => (
              <SpellSlotPips
                key={slotLevel}
                slotLevel={parseInt(slotLevel)}
                used={slot.used}
                max={slot.max}
                onUse={() => spellSlotMutation.mutate({ slotLevel, delta: 1 })}
                onRecover={() => spellSlotMutation.mutate({ slotLevel, delta: -1 })}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Not a spellcaster — spell slots are tracked here when available.
          </p>
        )}
      </div>

      {/* ── Conditions ─────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-semibold mb-2">Conditions</p>
        <div className="flex flex-wrap gap-1">
          {ALL_CONDITIONS.map((condition) => (
            <ConditionBadge
              key={condition}
              condition={condition}
              active={character.resources.conditions.includes(condition)}
              onToggle={() => conditionMutation.mutate(condition)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
