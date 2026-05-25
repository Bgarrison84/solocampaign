import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import { CreateCharacterWizard } from './CreateCharacterWizard'

interface CharacterSheetTabProps {
  campaignId: string
}

/**
 * Orchestrator component for the Character Sheet tab.
 *
 * Queries characters.getByCampaignId and branches on the result:
 * - Loading: shows "Building your character…" per UI-SPEC §6.5
 * - null (no character): auto-launches CreateCharacterWizard (D-04, non-dismissible)
 * - data: shows character sheet (Plan 06 fills this in)
 */
export function CharacterSheetTab({ campaignId }: CharacterSheetTabProps) {
  const characterQuery = useQuery({
    queryKey: ['characters', 'getByCampaignId', campaignId],
    queryFn: () => trpc.characters.getByCampaignId.query({ campaignId }),
    enabled: !!campaignId,
  })

  if (characterQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground">Building your character…</p>
      </div>
    )
  }

  if (!characterQuery.data) {
    // No character yet — auto-launch wizard per D-04
    // Wizard cannot be dismissed; cancel navigates to campaign list
    return <CreateCharacterWizard campaignId={campaignId} />
  }

  // Character exists — Plan 06 replaces this with the full 10-section sheet
  const character = characterQuery.data
  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <div className="text-center text-muted-foreground">
        <p className="text-xl font-semibold text-foreground">{character.name}</p>
        <p className="text-sm">
          {character.race} {character.class} · Level {character.level}
        </p>
        <p className="text-sm mt-2">
          Character sheet UI coming in Plan 06.
        </p>
      </div>
    </div>
  )
}
