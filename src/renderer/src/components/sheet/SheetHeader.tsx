import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../../lib/trpc'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { PortraitSlot } from './PortraitSlot'
import { Stepper } from './Stepper'
import { XP_THRESHOLDS } from './sheetHelpers'

interface SheetHeaderProps {
  character: CharacterWithResources
}

export function SheetHeader({ character }: SheetHeaderProps) {
  const queryClient = useQueryClient()
  const QUERY_KEY = ['characters', 'getByCampaignId', character.campaignId]
  const PORTRAIT_KEY = ['characters', 'getPortraitDataUrl', character.id]

  // Portrait data query
  const portraitQuery = useQuery({
    queryKey: PORTRAIT_KEY,
    queryFn: () => trpc.characters.getPortraitDataUrl.query({ characterId: character.id }),
  })

  // Portrait import mutation
  const importPortraitMutation = useMutation({
    mutationFn: () =>
      trpc.characters.importPortrait.mutate({
        characterId: character.id,
        campaignId: character.campaignId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PORTRAIT_KEY })
    },
  })

  // XP update mutation (zero-debounce, optimistic)
  const xpMutation = useMutation({
    mutationFn: (delta: number) =>
      trpc.characters.updateXp.mutate({ characterId: character.id, delta }),
    onMutate: async (delta) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          xp: Math.max(0, prev.xp + delta),
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

  const currentLevel = character.level
  const nextLevelXp = XP_THRESHOLDS[currentLevel] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1]

  return (
    <div className="flex flex-row gap-4 items-start">
      <PortraitSlot
        dataUrl={portraitQuery.data ?? null}
        characterName={character.name}
        onImportClick={() => importPortraitMutation.mutate()}
        isLoading={importPortraitMutation.isPending}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-semibold leading-tight">{character.name}</h1>
        <p className="text-sm text-muted-foreground">
          {character.race} {character.class} · Level {character.level}
        </p>
        <div className="flex flex-row items-center gap-2">
          <span className="text-sm text-muted-foreground">
            XP: {character.xp} / {nextLevelXp}
          </span>
          <Stepper
            value={character.xp}
            min={0}
            size="sm"
            label="XP"
            onChange={(delta) => xpMutation.mutate(delta)}
          />
        </div>
      </div>
    </div>
  )
}
