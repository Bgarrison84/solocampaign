import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import { CreateCharacterWizard } from './CreateCharacterWizard'
import { SheetHeader } from './sheet/SheetHeader'
import { AbilityScoresSection } from './sheet/AbilityScoresSection'
import { SavingThrowsSection } from './sheet/SavingThrowsSection'
import { SkillsSection } from './sheet/SkillsSection'
import { CombatStatsSection } from './sheet/CombatStatsSection'
import { ResourcesSection } from './sheet/ResourcesSection'
import { CurrencySection } from './sheet/CurrencySection'
import { EquipmentSection } from './sheet/EquipmentSection'
import { SpellListSection } from './sheet/SpellListSection'
import { ProficienciesSection } from './sheet/ProficienciesSection'
import { TraitsSection } from './sheet/TraitsSection'

interface CharacterSheetTabProps {
  campaignId: string
}

/**
 * Orchestrator component for the Character Sheet tab.
 *
 * Queries characters.getByCampaignId and branches on the result:
 * - Loading: shows "Building your character…" per UI-SPEC §6.5
 * - null (no character): auto-launches CreateCharacterWizard (D-04, non-dismissible)
 * - data: renders full 10-section character sheet
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

  // Character exists — render all 10 sections per UI-SPEC §4.1
  const character = characterQuery.data
  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <SheetHeader character={character} />
      <AbilityScoresSection character={character} />
      <SavingThrowsSection character={character} />
      <SkillsSection character={character} />
      <CombatStatsSection character={character} />
      <ResourcesSection character={character} />
      <SpellListSection
        character={character}
        onCastPrefix={(prefix) =>
          window.dispatchEvent(new CustomEvent('campaign:chat-prefix', { detail: prefix }))
        }
      />
      <CurrencySection character={character} />
      <EquipmentSection character={character} />
      <ProficienciesSection character={character} />
      <TraitsSection character={character} />
    </div>
  )
}
