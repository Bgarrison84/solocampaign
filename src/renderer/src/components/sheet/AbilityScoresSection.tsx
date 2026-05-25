import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../../lib/trpc'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { calcAbilityModifier } from '../../../../main/characters/calculations'
import { formatModifier } from './sheetHelpers'
import { cn } from '../../lib/utils'

interface AbilityScoresSectionProps {
  character: CharacterWithResources
}

type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'

const ABILITIES: { key: AbilityName; abbr: string }[] = [
  { key: 'strength', abbr: 'STR' },
  { key: 'dexterity', abbr: 'DEX' },
  { key: 'constitution', abbr: 'CON' },
  { key: 'intelligence', abbr: 'INT' },
  { key: 'wisdom', abbr: 'WIS' },
  { key: 'charisma', abbr: 'CHA' },
]

interface AbilityInputProps {
  abilityKey: AbilityName
  abbr: string
  baseValue: number
  characterId: string
  queryKey: readonly unknown[]
  queryClient: ReturnType<typeof useQueryClient>
  character: CharacterWithResources
}

function AbilityInput({
  abilityKey,
  abbr,
  baseValue,
  characterId,
  queryKey,
  queryClient,
  character,
}: AbilityInputProps) {
  const [displayValue, setDisplayValue] = useState(String(baseValue))
  const [isInvalid, setIsInvalid] = useState(false)

  // Sync when character data changes (e.g. after invalidation)
  useEffect(() => {
    setDisplayValue(String(baseValue))
    setIsInvalid(false)
  }, [baseValue])

  const updateMutation = useMutation({
    mutationFn: (value: number) =>
      trpc.characters.updateAbilityScore.mutate({ characterId, ability: abilityKey, value }),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<CharacterWithResources>(queryKey as string[])
      if (prev) {
        queryClient.setQueryData(queryKey, { ...prev, [abilityKey]: value })
      }
      return { prev }
    },
    onError: (_err, _value, context) => {
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  function handleBlur() {
    const parsed = parseInt(displayValue, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 30) {
      setIsInvalid(true)
      setDisplayValue(String(baseValue))
      return
    }
    setIsInvalid(false)
    if (parsed !== baseValue) {
      updateMutation.mutate(parsed)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      setDisplayValue(String(baseValue))
      setIsInvalid(false)
      e.currentTarget.blur()
    }
  }

  const score = parseInt(displayValue, 10)
  const modifier = !isNaN(score) && score >= 1 && score <= 30
    ? calcAbilityModifier(score)
    : calcAbilityModifier(baseValue)

  return (
    <div className="border border-border rounded-lg p-2 text-center flex flex-col items-center gap-1">
      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{abbr}</span>
      <div className="relative w-full">
        <input
          type="number"
          min={1}
          max={30}
          value={displayValue}
          onChange={(e) => setDisplayValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full border-0 bg-transparent text-center text-4xl font-semibold p-0 focus:outline-none focus:ring-1 focus:ring-accent-gold rounded',
            isInvalid && 'ring-1 ring-destructive',
          )}
          aria-label={`${abbr} ability score`}
          title={isInvalid ? 'Enter a number between 1 and 30.' : undefined}
        />
        {isInvalid && (
          <p className="text-sm text-destructive mt-1">Enter a number between 1 and 30.</p>
        )}
      </div>
      <span className="text-sm text-muted-foreground">{formatModifier(modifier)}</span>
    </div>
  )
}

export function AbilityScoresSection({ character }: AbilityScoresSectionProps) {
  const queryClient = useQueryClient()
  const QUERY_KEY = ['characters', 'getByCampaignId', character.campaignId] as const

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Ability Scores</h2>
      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map(({ key, abbr }) => (
          <AbilityInput
            key={key}
            abilityKey={key}
            abbr={abbr}
            baseValue={character[key]}
            characterId={character.id}
            queryKey={QUERY_KEY}
            queryClient={queryClient}
            character={character}
          />
        ))}
      </div>
    </section>
  )
}
