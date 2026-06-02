import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileText, ImagePlus, Loader2, User, Users } from 'lucide-react'
import { trpc } from '../lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Textarea } from './ui/textarea'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { WizardProgress } from './wizard/WizardProgress'
import {
  AiProviderFields,
  AiProviderValue,
  defaultAiProviderValue,
  validateAiProviderFields,
  isAiProviderFieldsValid,
} from './AiProviderFields'
import {
  StepWorldSetup,
  type WorldSetupMode,
  type WorldSetupState,
} from './wizard/StepWorldSetup'
import { cn } from '../lib/utils'

/**
 * Renderer-side representation of a StarterTemplatePayload (D-15).
 * Matches the shape exported by exportImport.ts (main process).
 * The AI provider/key fields are intentionally absent (D-16 — importer enters own key).
 */
export interface StarterTemplate {
  version: 1
  type: 'starterTemplate'
  exportedAt: string
  name: string
  worldSetupMode: string
  worldBrief: string | null
  worldDocument: string | null
  dmPersonality: string
  strictness: string
  partySize: number
  encumbranceEnabled: boolean
  homebrewContent: string | null
}

interface CreateCampaignModalProps {
  open: boolean
  onClose: () => void
  /** When provided, the wizard pre-fills all D-15 world config fields from this template. */
  initialTemplate?: StarterTemplate | null
}

type Strictness = 'strict' | 'balanced' | 'narrative'

const STRICTNESS_DESCRIPTIONS: Record<Strictness, string> = {
  strict:
    'The AI DM applies all D&D 5e rules exactly as written. It will cite specific rules if asked.',
  balanced:
    'The AI DM is rules-aware but prioritizes story and fun over strict RAW adherence.',
  narrative:
    'Rules are flavor. The AI DM improvises freely and prioritizes dramatic storytelling.',
}

const STEP_LABELS = ['Campaign', 'World Setup', 'AI Provider', 'DM Style']

type PartySize = 1 | 2 | 3 | 4

const PARTY_SIZE_OPTIONS: Array<{
  value: PartySize
  label: string
  descriptor: string
  icon: React.ElementType
}> = [
  { value: 1, label: 'Solo', descriptor: '1 character', icon: User },
  { value: 2, label: 'Small Party', descriptor: '2 characters', icon: Users },
  { value: 3, label: 'Party', descriptor: '3 characters', icon: Users },
  { value: 4, label: 'Full Party', descriptor: '4 characters', icon: Users },
]

export function CreateCampaignModal({ open, onClose, initialTemplate }: CreateCampaignModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Step state (0-indexed, 0–3)
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(-1)

  // Step 0 state — Campaign details
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [partySize, setPartySize] = useState<PartySize>(1)
  const [encumbranceEnabled, setEncumbranceEnabled] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Step 1 state — World Setup
  const [worldSetup, setWorldSetup] = useState<WorldSetupState>({
    worldSetupMode: 'ai',
    worldBrief: '',
    worldDocument: null,
    worldDocumentFilename: null,
  })

  // Step 2 state — AI Provider
  const [aiProvider, setAiProvider] = useState<AiProviderValue>(defaultAiProviderValue)
  const [providerErrors, setProviderErrors] = useState<
    Partial<Record<keyof AiProviderValue, string>>
  >({})

  // Step 3 state — DM Personality & Rules
  const [dmPersonality, setDmPersonality] = useState('')
  const [strictness, setStrictness] = useState<Strictness>('balanced')

  // Homebrew content — carried from template pre-fill; passed to campaigns.updateHomebrew after creation
  const [homebrewContent, setHomebrewContent] = useState<string | null>(null)

  // Cancel confirmation dialog
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // World brief generation error (non-blocking, shown after modal close)
  const [worldBriefError, setWorldBriefError] = useState<string | null>(null)

  // Spinner sub-state: 'creating' | 'generating' | null
  const [submitPhase, setSubmitPhase] = useState<'creating' | 'generating' | null>(null)

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof trpc.campaigns.create.mutate>[0]) =>
      trpc.campaigns.create.mutate(data),
  })

  const updateAiConfigMutation = useMutation({
    mutationFn: (data: Parameters<typeof trpc.campaigns.updateAiConfig.mutate>[0]) =>
      trpc.campaigns.updateAiConfig.mutate(data),
  })

  const generateBriefMutation = useMutation({
    mutationFn: (data: { campaignId: string }) =>
      trpc.campaigns.generateWorldBrief.mutate(data),
  })

  const updateHomebrewMutation = useMutation({
    mutationFn: (data: { campaignId: string; homebrewContent: string }) =>
      trpc.campaigns.updateHomebrew.mutate(data),
  })

  // Reset all state when modal opens
  useEffect(() => {
    if (open) {
      setStep(0)
      setCompletedUpTo(-1)
      setName('')
      setNameError(null)
      setPartySize(1)
      setEncumbranceEnabled(false)
      setWorldSetup({
        worldSetupMode: 'ai',
        worldBrief: '',
        worldDocument: null,
        worldDocumentFilename: null,
      })
      setAiProvider(defaultAiProviderValue)
      setProviderErrors({})
      setDmPersonality('')
      setStrictness('balanced')
      setHomebrewContent(null)
      setWorldBriefError(null)
      setSubmitPhase(null)
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
    }
  }, [open])

  // Pre-fill all D-15 wizard fields from the starter template (D-16).
  // AI provider/key fields are intentionally NOT pre-filled — the importer enters their own key.
  // Runs after the reset effect (same dep array length, batched by React) so template values
  // correctly overwrite the blank defaults set by the reset effect above.
  useEffect(() => {
    if (open && initialTemplate) {
      setName(initialTemplate.name ?? '')
      setWorldSetup({
        worldSetupMode: (initialTemplate.worldSetupMode as WorldSetupMode) ?? 'ai',
        worldBrief: initialTemplate.worldBrief ?? '',
        worldDocument: initialTemplate.worldDocument ?? null,
        worldDocumentFilename: null,
      })
      setDmPersonality(initialTemplate.dmPersonality ?? '')
      setStrictness((initialTemplate.strictness as Strictness) ?? 'balanced')
      setPartySize((initialTemplate.partySize as PartySize) ?? 1)
      setEncumbranceEnabled(initialTemplate.encumbranceEnabled ?? false)
      setHomebrewContent(initialTemplate.homebrewContent ?? null)
    }
  }, [open, initialTemplate])

  const trimmedName = name.trim()
  const isStep0Valid = trimmedName.length >= 1 && trimmedName.length <= 80
  const isStep2Valid = isAiProviderFieldsValid(aiProvider)

  const handleCancel = useCallback(() => {
    if (name.trim() || aiProvider.modelName || aiProvider.endpointUrl || dmPersonality) {
      setShowCancelConfirm(true)
    } else {
      onClose()
    }
  }, [name, aiProvider.modelName, aiProvider.endpointUrl, dmPersonality, onClose])

  const handleCancelConfirm = useCallback(() => {
    setShowCancelConfirm(false)
    onClose()
  }, [onClose])

  const handleNextStep0 = useCallback(() => {
    if (!isStep0Valid) {
      setNameError('Give your campaign a name to continue.')
      return
    }
    setNameError(null)
    setCompletedUpTo(Math.max(completedUpTo, 0))
    setStep(1)
  }, [isStep0Valid, completedUpTo])

  const handleNextStep1 = useCallback(() => {
    // World Setup step is always valid (permissive)
    setCompletedUpTo(Math.max(completedUpTo, 1))
    setStep(2)
  }, [completedUpTo])

  const handleNextStep2 = useCallback(() => {
    const errors = validateAiProviderFields(aiProvider)
    if (Object.keys(errors).length > 0) {
      setProviderErrors(errors)
      return
    }
    setProviderErrors({})
    setCompletedUpTo(Math.max(completedUpTo, 2))
    setStep(3)
  }, [aiProvider, completedUpTo])

  const handleSubmit = useCallback(async () => {
    if (submitPhase !== null) return

    try {
      setSubmitPhase('creating')

      // Determine which world content to pass at creation time
      const isAiMode = worldSetup.worldSetupMode === 'ai'
      const isBriefMode = worldSetup.worldSetupMode === 'brief'
      const isImportMode = worldSetup.worldSetupMode === 'import'

      // Step 1: Create campaign with all new fields
      const campaign = await createMutation.mutateAsync({
        name: trimmedName,
        partySize,
        encumbranceEnabled,
        worldSetupMode: worldSetup.worldSetupMode,
        worldBrief: isBriefMode ? worldSetup.worldBrief || undefined : undefined,
        worldDocument: isImportMode ? worldSetup.worldDocument ?? undefined : undefined,
      })

      // Step 2: Persist AI config
      await updateAiConfigMutation.mutateAsync({
        campaignId: campaign.id,
        providerType: aiProvider.providerType,
        endpointUrl: aiProvider.endpointUrl.trim() || undefined,
        modelName: aiProvider.modelName.trim(),
        apiKey: aiProvider.apiKey || undefined,
        dmPersonality: dmPersonality.trim() || undefined,
        strictness,
        referenceDocs: aiProvider.referenceDocs,
        fallbackEndpointUrl: aiProvider.fallbackEndpointUrl.trim() || undefined,
        fallbackModelName: aiProvider.fallbackModelName.trim() || undefined,
        fallbackApiKey: aiProvider.fallbackApiKey || undefined,
      })

      // Step 2b: Persist homebrew content if pre-filled from a starter template (D-19)
      if (homebrewContent) {
        await updateHomebrewMutation.mutateAsync({
          campaignId: campaign.id,
          homebrewContent,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })

      // Step 3: If AI Generates mode, call generateWorldBrief before navigating
      if (isAiMode) {
        setSubmitPhase('generating')
        try {
          await generateBriefMutation.mutateAsync({ campaignId: campaign.id })
        } catch {
          // Non-blocking: campaign exists with null worldBrief
          setWorldBriefError(
            'World brief generation failed. You can write a brief manually from the campaign settings later.',
          )
        }
      }

      setSubmitPhase(null)
      onClose()
      navigate(`/campaign/${campaign.id}`)
    } catch {
      setSubmitPhase(null)
      // Error handled by mutation state — user can retry
    }
  }, [
    submitPhase,
    worldSetup,
    createMutation,
    updateAiConfigMutation,
    updateHomebrewMutation,
    generateBriefMutation,
    trimmedName,
    partySize,
    encumbranceEnabled,
    homebrewContent,
    aiProvider,
    dmPersonality,
    strictness,
    queryClient,
    onClose,
    navigate,
  ])

  const isSubmitting = submitPhase !== null
  const submitError =
    createMutation.error || updateAiConfigMutation.error

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleCancel()
        }}
      >
        <DialogContent className="max-w-[560px] w-full max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <p className="text-sm text-muted-foreground">Step {step + 1} of 4</p>
          </DialogHeader>

          {/* Wizard progress */}
          <WizardProgress
            totalSteps={4}
            currentStep={step}
            completedUpTo={completedUpTo}
            stepLabels={STEP_LABELS}
            onStepClick={(s) => setStep(s)}
          />

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto py-4 px-1">
            {/* Template pre-fill banner — shown only when initialTemplate is provided (D-16) */}
            {initialTemplate && (
              <Alert className="mb-4">
                <FileText className="h-4 w-4" />
                <AlertTitle>Pre-filled from template: {initialTemplate.name}</AlertTitle>
                <AlertDescription>
                  Review and edit the settings below before creating your campaign.
                </AlertDescription>
              </Alert>
            )}

            {/* Step 0: Campaign Details */}
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">Campaign Details</h2>

                {/* Campaign name */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="campaign-name" className="text-sm font-semibold">
                    Campaign name
                  </Label>
                  <Input
                    id="campaign-name"
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNextStep0()
                      if (e.key === 'Escape') handleCancel()
                    }}
                    placeholder="e.g. The Lost Mines of Phandelver"
                    maxLength={80}
                  />
                  {nameError && (
                    <p className="text-sm text-destructive">{nameError}</p>
                  )}
                </div>

                {/* Party Size */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold">Party Size</Label>
                  <RadioGroup
                    value={String(partySize)}
                    onValueChange={(v: string) => setPartySize(Number(v) as PartySize)}
                    className="grid grid-cols-2 gap-2"
                  >
                    {PARTY_SIZE_OPTIONS.map((option) => {
                      const Icon = option.icon
                      const isSelected = partySize === option.value
                      return (
                        <label
                          key={option.value}
                          className={cn(
                            'flex items-start gap-2 bg-secondary rounded-lg p-3 border cursor-pointer transition-colors',
                            isSelected
                              ? 'border-accent-gold bg-secondary/80'
                              : 'border-border hover:border-muted-foreground',
                          )}
                        >
                          <RadioGroupItem value={String(option.value)} className="mt-0.5 shrink-0" />
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 mt-0.5',
                              isSelected ? 'text-accent-gold' : 'text-muted-foreground',
                            )}
                          />
                          <div className="flex flex-col gap-0">
                            <span className="text-sm font-semibold leading-snug">
                              {option.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {option.descriptor}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </RadioGroup>
                </div>

                {/* Encumbrance toggle */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="encumbrance-toggle"
                    checked={encumbranceEnabled}
                    onCheckedChange={(checked) =>
                      setEncumbranceEnabled(checked === true)
                    }
                  />
                  <Label htmlFor="encumbrance-toggle" className="text-sm font-normal cursor-pointer">
                    Enable encumbrance tracking (track carried weight vs. capacity)
                  </Label>
                </div>

                {/* Cover image placeholder */}
                <div className="flex flex-col gap-1.5">
                  <div className="w-full h-[120px] bg-muted rounded-md flex flex-col items-center justify-center gap-2 border border-border">
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    <p className="text-[12px] text-muted-foreground text-center">
                      Cover image (optional — add from campaign view)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: World Setup */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">World Setup</h2>
                <p className="text-sm text-muted-foreground">
                  How would you like to establish the world for this campaign?
                </p>
                <StepWorldSetup
                  wizardState={worldSetup}
                  onChange={(partial) =>
                    setWorldSetup((prev) => ({ ...prev, ...partial }))
                  }
                />
              </div>
            )}

            {/* Step 2: AI Provider */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">Configure AI Provider</h2>
                <AiProviderFields
                  value={aiProvider}
                  onChange={(next) => {
                    setAiProvider(next)
                    setProviderErrors({})
                  }}
                  errors={providerErrors}
                />
              </div>
            )}

            {/* Step 3: DM Personality & Rules */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">
                  DM Personality &amp; Rules
                </h2>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dm-personality" className="text-sm font-semibold">
                    DM Personality{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Describe the tone and style of your DM. This shapes every response the AI
                    gives.
                  </p>
                  <Textarea
                    id="dm-personality"
                    rows={5}
                    maxLength={2000}
                    value={dmPersonality}
                    onChange={(e) => setDmPersonality(e.target.value)}
                    placeholder="A classic adventure DM — balanced tone, fair challenges, memorable moments."
                    className="resize-none"
                  />
                  <span className="text-xs text-muted-foreground text-right block">
                    {dmPersonality.length}/2000
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="strictness-select" className="text-sm font-semibold">
                    Rules Strictness
                  </Label>
                  <Select
                    value={strictness}
                    onValueChange={(v) => setStrictness(v as Strictness)}
                  >
                    <SelectTrigger id="strictness-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strict">Strict</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="narrative">Narrative</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1 p-3 bg-card rounded-md border border-border">
                    {STRICTNESS_DESCRIPTIONS[strictness]}
                  </p>
                </div>

                {/* Non-blocking world brief error from previous attempt */}
                {worldBriefError && (
                  <p className="text-sm text-amber-400 p-3 bg-amber-950/40 rounded-md border border-amber-800">
                    {worldBriefError}
                  </p>
                )}

                {submitError && (
                  <p className="text-sm text-destructive">
                    {submitError instanceof Error
                      ? submitError.message
                      : "Couldn't create the campaign. Please try again."}
                  </p>
                )}

                {/* AI brief generation progress */}
                {submitPhase === 'generating' && (
                  <p className="text-sm text-muted-foreground text-center">
                    This may take up to 30 seconds depending on your AI provider.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            {step === 0 && (
              <>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleNextStep0} disabled={!isStep0Valid}>
                  Next
                </Button>
              </>
            )}

            {step === 1 && (
              <>
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button type="button" onClick={handleNextStep1}>
                  Next
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep2}
                  disabled={!isStep2Valid}
                >
                  Next
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                  {submitPhase === 'generating' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Generating your world…
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Creating…
                    </>
                  ) : (
                    'Create Campaign'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cancel campaign creation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your progress will not be saved. You'll return to the campaign list.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelConfirm(false)}
            >
              Keep editing
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancelConfirm}>
              Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
