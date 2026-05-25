import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../../lib/trpc'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { Stepper } from './Stepper'

interface CurrencySectionProps {
  character: CharacterWithResources
}

type Denomination = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'

const DENOMINATIONS: { key: Denomination; abbr: string; fullName: string }[] = [
  { key: 'cp', abbr: 'CP', fullName: 'Copper' },
  { key: 'sp', abbr: 'SP', fullName: 'Silver' },
  { key: 'ep', abbr: 'EP', fullName: 'Electrum' },
  { key: 'gp', abbr: 'GP', fullName: 'Gold' },
  { key: 'pp', abbr: 'PP', fullName: 'Platinum' },
]

export function CurrencySection({ character }: CurrencySectionProps) {
  const queryClient = useQueryClient()
  const QUERY_KEY = ['characters', 'getByCampaignId', character.campaignId] as const

  const currencyMutation = useMutation({
    mutationFn: ({ denomination, delta }: { denomination: Denomination; delta: number }) =>
      trpc.characters.updateCurrency.mutate({ characterId: character.id, denomination, delta }),
    onMutate: async ({ denomination, delta }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            [denomination]: Math.max(0, prev.resources[denomination] + delta),
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

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Currency</h2>
      <div className="grid grid-cols-5 gap-2">
        {DENOMINATIONS.map(({ key, abbr, fullName }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold uppercase text-muted-foreground">{abbr}</span>
            <Stepper
              value={character.resources[key]}
              min={0}
              size="md"
              label={fullName}
              onChange={(delta) => currencyMutation.mutate({ denomination: key, delta })}
            />
            <span className="text-sm text-muted-foreground">{fullName}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
