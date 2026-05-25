import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { trpc } from '../../lib/trpc'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface EquipmentSectionProps {
  character: CharacterWithResources
}

export function EquipmentSection({ character }: EquipmentSectionProps) {
  const queryClient = useQueryClient()
  const QUERY_KEY = ['characters', 'getByCampaignId', character.campaignId] as const

  const attunemntCount = character.items.filter((i) => i.isAttuned).length

  const toggleAttunedMutation = useMutation({
    mutationFn: (itemId: string) =>
      trpc.characters.toggleItemAttuned.mutate({ itemId }),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId ? { ...item, isAttuned: !item.isAttuned } : item,
          ),
        })
      }
      return { prev }
    },
    onError: (_err, _itemId, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  return (
    <section>
      <div className="flex flex-row items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Equipment</h2>
        <span className="text-sm text-muted-foreground">{attunemntCount} / 3 Attuned</span>
      </div>

      {character.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No equipment — add items from the starting packages or edit your sheet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="font-semibold pb-1 pr-2">Name</th>
              <th className="font-semibold pb-1 pr-2 w-12">Qty</th>
              <th className="font-semibold pb-1 pr-2 w-20">Weight</th>
              <th className="font-semibold pb-1 w-20">Attune</th>
            </tr>
          </thead>
          <tbody>
            {character.items.map((item) => (
              <tr key={item.id} className="border-t border-border/50">
                <td className="py-1 pr-2">{item.name}</td>
                <td className="py-1 pr-2">{item.quantity}</td>
                <td className="py-1 pr-2 text-muted-foreground">
                  {item.weight > 0 ? `${item.weight} lb` : '—'}
                </td>
                <td className="py-1">
                  {item.isMagic ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={item.isAttuned ? 'Attuned' : 'Attune'}
                      onClick={() => toggleAttunedMutation.mutate(item.id)}
                      className={cn(
                        'h-auto py-0.5 px-2',
                        item.isAttuned ? 'text-accent-gold' : 'text-muted-foreground',
                      )}
                    >
                      <Star
                        className="w-4 h-4"
                        fill={item.isAttuned ? 'currentColor' : 'none'}
                      />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
