import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { trpc } from '../lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { WizardProgress } from './wizard/WizardProgress'
import { StepRace } from './wizard/StepRace'
import { StepClass } from './wizard/StepClass'
import { StepAbilityScores } from './wizard/StepAbilityScores'
import { StepBackground } from './wizard/StepBackground'
import { StepEquipment } from './wizard/StepEquipment'
import { StepStartingFeat } from './wizard/StepStartingFeat'
import { StepReview } from './wizard/StepReview'
import {
  initialWizardState,
  TOTAL_STEPS,
  STEP_NAMES,
  type WizardState,
  type AbilityName,
} from './wizard/wizardTypes'
import type { Race, DndClass, Background, EquipmentPackageOption } from '../../../main/db/contentTypes'

interface CreateCharacterWizardProps {
  campaignId: string
  /**
   * Optional callback invoked after character creation completes successfully.
   * When provided, the wizard calls this instead of navigating to '/'.
   * Use for re-triggered party-member creation.
   */
  onComplete?: () => void
}

/**
 * 7-step character creation wizard (extended for Phase 7).
 *
 * Per D-04: modal is non-dismissible. The only exits are:
 * - Complete all 7 steps and click "Create Character" → character saved
 * - Click "Cancel Character Creation" → AlertDialog confirmation → navigate to '/' (or call onComplete)
 *
 * Steps:
 *  0 = Race (+ name/backstory)
 *  1 = Class
 *  2 = Ability Scores
 *  3 = Background
 *  4 = Equipment
 *  5 = Starting Feat (optional — skippable)
 *  6 = Review
 *
 * Phase 7 additions (07-06):
 *  - Step 5: Optional Starting Feat via FeatPicker (CHAR-05)
 *  - negativeTraits (from ability step) persisted to characters.negativeTraits
 *  - trpc.feats.add called after character creation when a starting feat is chosen
 *  - onComplete prop for re-triggerable party-member creation (PARTY-01)
 *  - Party-full error surfaced inline ("This campaign's party is full.")
 */
export function CreateCharacterWizard({ campaignId, onComplete }: CreateCharacterWizardProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(-1)
  const [wizardState, setWizardState] = useState<WizardState>(initialWizardState)
  const [error, setError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Pre-fetch content on mount
  const racesQuery = useQuery({
    queryKey: ['content', 'races', 'list'],
    queryFn: () => trpc.content.races.list.query(),
  })

  const classesQuery = useQuery({
    queryKey: ['content', 'classes', 'list'],
    queryFn: () => trpc.content.classes.list.query(),
  })

  const backgroundsQuery = useQuery({
    queryKey: ['content', 'backgrounds', 'list'],
    queryFn: () => trpc.content.backgrounds.list.query(),
  })

  const equipmentQuery = useQuery({
    queryKey: ['content', 'equipment', 'listForClass', wizardState.selectedClass?.name],
    queryFn: () =>
      trpc.content.equipment.listForClass.query({
        className: wizardState.selectedClass!.name,
      }),
    enabled: !!wizardState.selectedClass,
  })

  const spellSlotsQuery = useQuery({
    queryKey: ['content', 'spellSlots', 'forClass', wizardState.selectedClass?.name],
    queryFn: () =>
      trpc.content.spellSlots.forClass.query({
        className: wizardState.selectedClass!.name,
      }),
    enabled: !!wizardState.selectedClass,
  })

  // Character creation mutation
  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof trpc.characters.create.mutate>[0]) =>
      trpc.characters.create.mutate(input),
    onSuccess: async (character) => {
      queryClient.invalidateQueries({ queryKey: ['characters', 'getByCampaignId', campaignId] })
      setError(null)

      // After character created, persist starting feat if chosen (CHAR-05, 07-06)
      if (wizardState.startingFeat) {
        try {
          await trpc.feats.add.mutate({
            characterId: character.id,
            featName: wizardState.startingFeat.featName,
            featSource: wizardState.startingFeat.featSource,
            customFeatId: wizardState.startingFeat.customFeatId,
          })
          // Invalidate feats for the new character
          queryClient.invalidateQueries({
            queryKey: ['feats', 'listByCharacter', character.id],
          })
        } catch (featErr: unknown) {
          // Log but don't block — character was created successfully
          console.error('[CreateCharacterWizard] Failed to save starting feat:', featErr)
        }
      }

      // Navigate or callback
      if (onComplete) {
        onComplete()
      } else {
        navigate(`/campaign/${campaignId}`)
      }
    },
    onError: (err: Error) => {
      // PARTY-01: surface party-full error inline (D-18)
      if (
        err.message?.includes('Party is full') ||
        err.message?.includes('partySize')
      ) {
        setError("This campaign's party is full.")
      } else {
        setError(err.message || 'Failed to create character. Please try again.')
      }
    },
  })

  // Compute per-step validity
  function isCurrentStepValid(): boolean {
    switch (step) {
      case 0: // Race
        return wizardState.characterName.trim().length >= 1 && wizardState.selectedRace !== null
      case 1: // Class
        return (
          wizardState.selectedClass !== null &&
          (!wizardState.selectedClass.choosesSubclassAtLevel1 ||
            wizardState.selectedSubclass !== null)
        )
      case 2: // Ability Scores
        return (
          Object.values(wizardState.abilityScores).every((v) => v !== null) &&
          wizardState.selectedSkillProficiencies.length ===
            (wizardState.selectedClass?.skillChoiceCount ?? 0)
        )
      case 3: // Background
        return (
          wizardState.selectedBackground !== null &&
          ((wizardState.selectedBackground.freeLanguageChoices ?? 0) === 0 ||
            wizardState.selectedLanguage !== null)
        )
      case 4: // Equipment
        return wizardState.selectedEquipmentPackage !== null
      case 5: // Starting Feat — always valid (step is optional/skippable)
        return true
      case 6: // Review
        return true
      default:
        return false
    }
  }

  function handleNext() {
    if (!isCurrentStepValid()) return
    setCompletedUpTo(Math.max(completedUpTo, step))
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleStepClick(targetStep: number) {
    if (targetStep <= completedUpTo && targetStep !== step) {
      setStep(targetStep)
    }
  }

  /** Skip the Starting Feat step without clearing any previously chosen feat */
  function handleSkipFeat() {
    setCompletedUpTo(Math.max(completedUpTo, step))
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  }

  function updateWizard(partial: Partial<WizardState>) {
    setWizardState((prev) => ({ ...prev, ...partial }))
  }

  async function handleConfirm() {
    if (createMutation.isPending) return
    const s = wizardState

    // Assemble racial ASI — the server will apply them, but we need base scores here
    const baseScores = {
      strength: s.abilityScores.strength ?? 8,
      dexterity: s.abilityScores.dexterity ?? 8,
      constitution: s.abilityScores.constitution ?? 8,
      intelligence: s.abilityScores.intelligence ?? 8,
      wisdom: s.abilityScores.wisdom ?? 8,
      charisma: s.abilityScores.charisma ?? 8,
    }

    // Race traits text
    const racialTraitsText = s.selectedRace
      ? s.selectedRace.traits.map((t) => `${t.name}: ${t.description}`).join('\n\n')
      : ''

    // Class features text
    const classFeatureText = s.selectedClass
      ? s.selectedClass.level1Features.map((f) => `${f.name}: ${f.description}`).join('\n\n')
      : ''

    // Background feature text
    const backgroundFeatureText = s.selectedBackground
      ? `${s.selectedBackground.feature.name}: ${s.selectedBackground.feature.description}`
      : ''

    // Build languages: race languages + background languages + chosen language
    const raceLanguages = s.selectedRace?.languages ?? []
    const bgLanguages = s.selectedBackground?.languages ?? []
    const chosenLanguage = s.selectedLanguage ? [s.selectedLanguage] : []
    const allLanguages = [...new Set([...raceLanguages, ...bgLanguages, ...chosenLanguage])]

    // Build skill proficiencies: wizard selected + background auto-granted
    const bgSkills = s.selectedBackground?.skillProficiencies ?? []
    const allSkills = [...new Set([...s.selectedSkillProficiencies, ...bgSkills])]

    // Starting items from equipment package + background
    const pkgItems = s.selectedEquipmentPackage?.items ?? []
    const bgItems = (s.selectedBackground?.startingEquipment ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      weight: item.weight,
      isMagic: false,
    }))
    const allItems = [
      ...pkgItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        weight: item.weight,
        isMagic: item.isMagic ?? false,
      })),
      ...bgItems,
    ]

    // Gold
    const pkgGold = s.selectedEquipmentPackage?.startingGold ?? 0
    const bgGold = s.selectedBackground?.startingGold ?? 0
    const totalGold = pkgGold + bgGold

    // Full backstory: backstory + optional role-play fields
    const backstoryParts = [s.backstory]
    if (s.personalityTrait) backstoryParts.push(`Personality Trait: ${s.personalityTrait}`)
    if (s.ideal) backstoryParts.push(`Ideal: ${s.ideal}`)
    if (s.bond) backstoryParts.push(`Bond: ${s.bond}`)
    if (s.flaw) backstoryParts.push(`Flaw: ${s.flaw}`)
    const fullBackstory = backstoryParts.filter(Boolean).join('\n\n')

    // Determine armor base AC from equipment package
    const armorItem = s.selectedEquipmentPackage?.items.find((item) => {
      const name = item.name.toLowerCase()
      return (
        name.includes('chain mail') ||
        name.includes('leather armor') ||
        name.includes('scale mail') ||
        name.includes('ring mail') ||
        name.includes('hide armor') ||
        name.includes('studded leather') ||
        name.includes('breastplate') ||
        name.includes('half plate') ||
        name.includes('splint') ||
        name.includes('plate armor')
      )
    })

    // Simple armor base AC lookup (Phase 2: approximate)
    let armorBaseAc: number | undefined
    if (armorItem) {
      const n = armorItem.name.toLowerCase()
      if (n.includes('chain mail')) armorBaseAc = 16
      else if (n.includes('plate')) armorBaseAc = 18
      else if (n.includes('splint')) armorBaseAc = 17
      else if (n.includes('half plate')) armorBaseAc = 15
      else if (n.includes('breastplate')) armorBaseAc = 14
      else if (n.includes('scale mail') || n.includes('ring mail')) armorBaseAc = 14
      else if (n.includes('hide')) armorBaseAc = 12
      else if (n.includes('studded leather')) armorBaseAc = 12
      else if (n.includes('leather')) armorBaseAc = 11
    }

    // Build negativeTraits payload — only include if any traits were chosen (Point Buy only)
    const hasNegativeTraits =
      s.negativeTraits.presetFlaws.length > 0 ||
      s.negativeTraits.freeFormFlaws.some((f) => f.trim().length > 0)

    createMutation.mutate({
      campaignId,
      name: s.characterName.trim(),
      race: s.selectedRace!.name,
      subrace: s.selectedSubrace ?? undefined,
      class: s.selectedClass!.name,
      subclass: s.selectedSubclass ?? undefined,
      background: s.selectedBackground!.name,
      level: 1,
      abilityScores: baseScores,
      savingThrowProficiencies: s.selectedClass?.savingThrowProficiencies ?? [],
      skillProficiencies: allSkills,
      languages: allLanguages,
      backstory: fullBackstory || undefined,
      equipmentPackageId: s.selectedEquipmentPackage?.id,
      startingItems: allItems,
      startingGold: totalGold,
      traitsText: racialTraitsText || undefined,
      classFeatureText: classFeatureText || undefined,
      backgroundFeatureText: backgroundFeatureText || undefined,
      hitDie: s.selectedClass!.hitDie,
      armorBaseAc,
      speed: s.selectedRace?.speed ?? 30,
      // Phase 7 (07-06): persist negative traits (CHAR-03)
      negativeTraits: hasNegativeTraits ? s.negativeTraits : undefined,
    })
  }

  function handleCancel() {
    if (onComplete) {
      onComplete()
    } else {
      navigate('/')
    }
  }

  const isValid = isCurrentStepValid()
  const races = (racesQuery.data ?? []) as Race[]
  const classes = (classesQuery.data ?? []) as DndClass[]
  const backgrounds = (backgroundsQuery.data ?? []) as Background[]
  const equipmentPackages = (equipmentQuery.data ?? []) as EquipmentPackageOption[]

  // The Review step is now step index 6
  const REVIEW_STEP = TOTAL_STEPS - 1

  return (
    <>
      {/* Non-dismissible dialog per D-04 */}
      <Dialog open={true} onOpenChange={() => { /* no-op — wizard cannot be dismissed */ }}>
        <DialogContent className="sm:max-w-[720px] w-full h-[85vh] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Your Character</DialogTitle>
            <WizardProgress
              totalSteps={TOTAL_STEPS}
              currentStep={step}
              completedUpTo={completedUpTo}
              stepLabels={STEP_NAMES}
              onStepClick={handleStepClick}
            />
          </DialogHeader>

          {/* Step body */}
          <div className="flex-1 overflow-hidden min-h-0">
            {step === 0 && (
              <StepRace
                wizardState={wizardState}
                races={races}
                onChange={updateWizard}
              />
            )}
            {step === 1 && (
              <StepClass
                wizardState={wizardState}
                classes={classes}
                onChange={updateWizard}
              />
            )}
            {step === 2 && (
              <StepAbilityScores
                wizardState={wizardState}
                onChange={updateWizard}
              />
            )}
            {step === 3 && (
              <StepBackground
                wizardState={wizardState}
                backgrounds={backgrounds}
                onChange={updateWizard}
              />
            )}
            {step === 4 && (
              <StepEquipment
                wizardState={wizardState}
                equipmentPackages={equipmentPackages}
                onChange={updateWizard}
              />
            )}
            {step === 5 && (
              <StepStartingFeat
                wizardState={wizardState}
                campaignId={campaignId}
                onChange={updateWizard}
                onSkip={handleSkipFeat}
              />
            )}
            {step === REVIEW_STEP && (
              <StepReview
                wizardState={wizardState}
                spellSlotsData={(spellSlotsQuery.data ?? null) as Record<number, Record<string, number>> | null}
              />
            )}
          </div>

          {/* Error display */}
          {error && (
            <p className="text-sm text-destructive px-6">{error}</p>
          )}

          <DialogFooter className="flex flex-row items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCancelConfirm(true)}
              disabled={createMutation.isPending}
            >
              Cancel Character Creation
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={createMutation.isPending}
                >
                  Back
                </Button>
              )}
              {step < REVIEW_STEP ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!isValid || createMutation.isPending}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Character'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cancel character creation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your progress will be lost. You'll return to the campaign list.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelConfirm(false)}
            >
              Keep building
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
            >
              Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
