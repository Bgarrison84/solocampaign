import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, Loader2 } from 'lucide-react'
import { trpc } from '../lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Textarea } from './ui/textarea'
import { WizardProgress } from './wizard/WizardProgress'
import {
  AiProviderFields,
  AiProviderValue,
  defaultAiProviderValue,
  validateAiProviderFields,
  isAiProviderFieldsValid,
} from './AiProviderFields'

interface CreateCampaignModalProps {
  open: boolean
  onClose: () => void
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

const STEP_LABELS = ['Campaign', 'AI Provider', 'DM Style']

export function CreateCampaignModal({ open, onClose }: CreateCampaignModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Step state (0-indexed)
  const [step, setStep] = useState(0)
  const [completedUpTo, setCompletedUpTo] = useState(-1)

  // Step 1 state
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Step 2 state
  const [aiProvider, setAiProvider] = useState<AiProviderValue>(defaultAiProviderValue)
  const [providerErrors, setProviderErrors] = useState<
    Partial<Record<keyof AiProviderValue, string>>
  >({})

  // Step 3 state
  const [dmPersonality, setDmPersonality] = useState('')
  const [strictness, setStrictness] = useState<Strictness>('balanced')

  // Cancel confirmation dialog
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => trpc.campaigns.create.mutate(data),
  })

  const updateAiConfigMutation = useMutation({
    mutationFn: (data: Parameters<typeof trpc.campaigns.updateAiConfig.mutate>[0]) =>
      trpc.campaigns.updateAiConfig.mutate(data),
  })

  // Reset all state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(0)
      setCompletedUpTo(-1)
      setName('')
      setNameError(null)
      setAiProvider(defaultAiProviderValue)
      setProviderErrors({})
      setDmPersonality('')
      setStrictness('balanced')
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
    }
  }, [open])

  const trimmedName = name.trim()
  const isStep1Valid = trimmedName.length >= 1 && trimmedName.length <= 80
  const isStep2Valid = isAiProviderFieldsValid(aiProvider)

  const handleCancel = useCallback(() => {
    // If any data has been entered, show confirmation
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

  const handleNextStep1 = useCallback(() => {
    if (!isStep1Valid) {
      setNameError('Give your campaign a name to continue.')
      return
    }
    setNameError(null)
    setCompletedUpTo(Math.max(completedUpTo, 0))
    setStep(1)
  }, [isStep1Valid, completedUpTo])

  const handleNextStep2 = useCallback(() => {
    const errors = validateAiProviderFields(aiProvider)
    if (Object.keys(errors).length > 0) {
      setProviderErrors(errors)
      return
    }
    setProviderErrors({})
    setCompletedUpTo(Math.max(completedUpTo, 1))
    setStep(2)
  }, [aiProvider, completedUpTo])

  const handleSubmit = useCallback(async () => {
    if (createMutation.isPending || updateAiConfigMutation.isPending) return

    try {
      // Step 1: Create campaign
      const campaign = await createMutation.mutateAsync({ name: trimmedName })

      // Step 2+3: Persist AI config
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

      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      onClose()
      navigate(`/campaign/${campaign.id}`)
    } catch {
      // Error handled by mutation state — user can retry
    }
  }, [
    createMutation,
    updateAiConfigMutation,
    trimmedName,
    aiProvider,
    dmPersonality,
    strictness,
    queryClient,
    onClose,
    navigate,
  ])

  const isSubmitting = createMutation.isPending || updateAiConfigMutation.isPending
  const submitError = createMutation.error || updateAiConfigMutation.error

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
            <p className="text-sm text-muted-foreground">Step {step + 1} of 3</p>
          </DialogHeader>

          {/* Wizard progress */}
          <WizardProgress
            totalSteps={3}
            currentStep={step}
            completedUpTo={completedUpTo}
            stepLabels={STEP_LABELS}
            onStepClick={(s) => setStep(s)}
          />

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto py-4 px-1">
            {/* Step 1: Campaign Details */}
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground">Campaign Details</h2>

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
                      if (e.key === 'Enter') handleNextStep1()
                      if (e.key === 'Escape') handleCancel()
                    }}
                    placeholder="e.g. The Lost Mines of Phandelver"
                    maxLength={80}
                  />
                  {nameError && (
                    <p className="text-sm text-destructive">{nameError}</p>
                  )}
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

            {/* Step 2: AI Provider */}
            {step === 1 && (
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
            {step === 2 && (
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

                {(createMutation.error || updateAiConfigMutation.error) && (
                  <p className="text-sm text-destructive">
                    {submitError instanceof Error
                      ? submitError.message
                      : "Couldn't create the campaign. Please try again."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            {step === 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep1}
                  disabled={!isStep1Valid}
                >
                  Next
                </Button>
              </>
            )}

            {step === 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(0)}
                >
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

            {step === 2 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
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
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelConfirm}
            >
              Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
