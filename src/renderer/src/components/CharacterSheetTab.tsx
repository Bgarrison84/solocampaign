import React, { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Download, Loader2 } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { useCampaignViewStore } from '../stores/campaignViewStore'
import { Button } from './ui/button'
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
import { LevelUpBanner } from './sheet/LevelUpBanner'
import { LevelUpModal, XP_THRESHOLDS } from './LevelUpModal'
import { CompanionsSection } from './CompanionsSection'
import { cn } from '../lib/utils'
import type { Campaign } from '../../../main/db/schema'
import type { CharacterWithResources } from '../../../main/db/charactersRepo'

interface CharacterSheetTabProps {
  campaignId: string
  /** Campaign data passed from CampaignViewScreen for partySize + encumbranceEnabled. */
  campaign?: Campaign | null
}

/**
 * Orchestrator component for the Character Sheet tab.
 *
 * Phase 7 additions (07-08):
 * - Party switcher chips (party mode only, partySize > 1) driven by activeCharacterId from Zustand
 * - "+ Add Character" chip when partyMembers.length < partySize
 * - CompanionsSection shown when any companions exist (even solo mode)
 * - Multiclass header handled by SheetHeader (07-05)
 * - Encumbrance display in inventory handled elsewhere (passed via campaign.encumbranceEnabled)
 *
 * Queries characters.list({campaignId}) and splits:
 * - partyMembers: isCompanion=false
 * - companions: isCompanion=true
 *
 * activeCharacterId from campaignViewStore defaults to first party member when null.
 */
export function CharacterSheetTab({ campaignId, campaign }: CharacterSheetTabProps) {
  const queryClient = useQueryClient()
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [showAddWizard, setShowAddWizard] = useState(false)
  const [pdfExportError, setPdfExportError] = useState<string | null>(null)

  const activeCharacterId = useCampaignViewStore((s) => s.activeCharacterId)
  const setActiveCharacterId = useCampaignViewStore((s) => s.setActiveCharacterId)

  // PDF export mutation (D-13, D-14, DIST-02)
  const exportPdfMutation = useMutation({
    mutationFn: ({ characterId }: { characterId: string }) =>
      trpc.characters.exportPdf.mutate({ characterId }),
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'PDF export failed.'
      setPdfExportError(message)
    },
    onSuccess: () => {
      setPdfExportError(null)
    },
  })

  const partySize = campaign?.partySize ?? 1

  // Query all characters (party members + companions) for this campaign
  const charactersQuery = useQuery({
    queryKey: ['characters', 'list', campaignId],
    queryFn: () => trpc.characters.list.query({ campaignId }),
    enabled: !!campaignId,
  })

  const allCharacters = charactersQuery.data ?? []
  const partyMembers = allCharacters.filter((c) => !c.isCompanion)
  const companions = allCharacters.filter((c) => c.isCompanion)

  // Determine which character's sheet to display.
  // In solo mode (partySize <= 1) this will always be the first (and only) member.
  const effectiveActiveId = activeCharacterId ?? partyMembers[0]?.id ?? null

  if (charactersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground">Building your character…</p>
      </div>
    )
  }

  // No party members yet — auto-launch wizard per D-04
  if (partyMembers.length === 0) {
    if (showAddWizard) {
      return (
        <CreateCharacterWizard
          campaignId={campaignId}
          onComplete={() => {
            setShowAddWizard(false)
            queryClient.invalidateQueries({ queryKey: ['characters', 'list', campaignId] })
          }}
        />
      )
    }
    return <CreateCharacterWizard campaignId={campaignId} />
  }

  // If Add Character wizard is open, show it
  if (showAddWizard) {
    return (
      <CreateCharacterWizard
        campaignId={campaignId}
        onComplete={() => {
          setShowAddWizard(false)
          queryClient.invalidateQueries({ queryKey: ['characters', 'list', campaignId] })
        }}
      />
    )
  }

  const activeCharacter: CharacterWithResources | undefined = partyMembers.find(
    (c) => c.id === effectiveActiveId,
  ) ?? partyMembers[0]

  if (!activeCharacter) return null

  const nextLevel = activeCharacter.level + 1
  const isLevelUpAvailable =
    (XP_THRESHOLDS[nextLevel] !== undefined) &&
    activeCharacter.xp >= XP_THRESHOLDS[nextLevel]

  // HP mutation handler for companions
  function handleUpdateCompanionHp(companionId: string, delta: number) {
    trpc.characters.updateHp.mutate({ characterId: companionId, delta }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['characters', 'list', campaignId] })
    })
  }

  // Remove companion handler
  function handleRemoveCompanion(companionId: string) {
    trpc.characters.deleteCompanion.mutate({ companionId, campaignId }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['characters', 'list', campaignId] })
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
        {/* Party switcher chips — only in party mode (partySize > 1) */}
        {partySize > 1 && (
          <div
            role="tablist"
            aria-label="Party members"
            className="flex flex-row gap-2 flex-wrap -mx-4 px-4 pb-2 border-b border-border"
          >
            {partyMembers.map((member) => {
              const isActive = member.id === effectiveActiveId
              return (
                <button
                  key={member.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCharacterId(member.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm font-semibold border cursor-pointer select-none transition-colors',
                    isActive
                      ? 'bg-accent-gold/20 border-accent-gold text-accent-gold'
                      : 'bg-secondary border-border text-foreground hover:border-muted-foreground',
                  )}
                >
                  {member.name}
                </button>
              )
            })}

            {/* "+ Add Character" chip — shown until partySize is filled */}
            {partyMembers.length < partySize && (
              <button
                onClick={() => setShowAddWizard(true)}
                className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold border border-dashed border-border text-muted-foreground hover:border-accent-gold hover:text-accent-gold cursor-pointer select-none transition-colors"
                aria-label="Add Character"
              >
                <Plus className="h-3 w-3" />
                Add Character
              </button>
            )}
          </div>
        )}

        {/* CompanionsSection — shown whenever companions exist (even in solo mode) */}
        {(companions.length > 0 || partySize > 1) && (
          <CompanionsSection
            campaignId={campaignId}
            companions={companions}
            onUpdateHp={handleUpdateCompanionHp}
            onRemove={handleRemoveCompanion}
            onAdd={() => {
              queryClient.invalidateQueries({ queryKey: ['characters', 'list', campaignId] })
            }}
          />
        )}

        {/* PDF export button row (D-13, D-14, DIST-02) */}
        <div className="flex flex-row items-center justify-end -mt-1 mb-1">
          {pdfExportError && (
            <span className="text-xs text-destructive mr-2" role="alert">
              {pdfExportError}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Export character sheet as PDF"
            disabled={!effectiveActiveId || exportPdfMutation.isPending}
            onClick={() => {
              if (effectiveActiveId) {
                setPdfExportError(null)
                exportPdfMutation.mutate({ characterId: effectiveActiveId })
              }
            }}
          >
            {exportPdfMutation.isPending ? (
              <>
                <Loader2 className="animate-spin mr-1" size={14} />
                Generating...
              </>
            ) : (
              <>
                <Download size={14} className="mr-1" />
                Export PDF
              </>
            )}
          </Button>
        </div>

        {/* Level-up banner at top, above SheetHeader (UI-SPEC §S7a, D-30, PROG-01) */}
        {isLevelUpAvailable && (
          <LevelUpBanner
            nextLevel={nextLevel}
            onLevelUp={() => setShowLevelUpModal(true)}
          />
        )}
        <SheetHeader character={activeCharacter} />
        <AbilityScoresSection character={activeCharacter} />
        <SavingThrowsSection character={activeCharacter} />
        <SkillsSection character={activeCharacter} />
        <CombatStatsSection character={activeCharacter} />
        <ResourcesSection character={activeCharacter} />
        <SpellListSection
          character={activeCharacter}
          onCastPrefix={(prefix) =>
            window.dispatchEvent(new CustomEvent('campaign:chat-prefix', { detail: prefix }))
          }
        />
        <CurrencySection character={activeCharacter} />
        <EquipmentSection character={activeCharacter} />
        <ProficienciesSection character={activeCharacter} />
        <TraitsSection character={activeCharacter} />
      </div>

      {/* Level-up modal — HP choice + slot table + confirm (D-31, D-32) */}
      <LevelUpModal
        open={showLevelUpModal}
        onClose={() => setShowLevelUpModal(false)}
        character={activeCharacter}
      />
    </>
  )
}
