import React, { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { trpc } from '../lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Textarea } from './ui/textarea'
import {
  AiProviderFields,
  AiProviderValue,
  defaultAiProviderValue,
  isAiProviderFieldsValid,
  validateAiProviderFields,
} from './AiProviderFields'

interface AiSettingsModalProps {
  campaignId: string
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

export function AiSettingsModal({ campaignId, open, onClose }: AiSettingsModalProps) {
  const queryClient = useQueryClient()

  // Fetch campaign to pre-fill
  const campaignQuery = useQuery({
    queryKey: ['campaigns', 'get', campaignId],
    queryFn: () => trpc.campaigns.get.query({ id: campaignId }),
    enabled: open && !!campaignId,
  })

  const campaign = campaignQuery.data

  // Provider fields state — API keys always empty (D-23: keys never returned)
  const [aiProvider, setAiProvider] = useState<AiProviderValue>(defaultAiProviderValue)
  const [providerErrors, setProviderErrors] = useState<
    Partial<Record<keyof AiProviderValue, string>>
  >({})

  // Step 3 fields
  const [dmPersonality, setDmPersonality] = useState('')
  const [strictness, setStrictness] = useState<Strictness>('balanced')

  // Pre-fill when campaign data loads
  useEffect(() => {
    if (!open) return
    if (!campaign) return

    setAiProvider({
      providerType:
        campaign.providerType === 'openai-compatible' || campaign.providerType === 'gemini'
          ? campaign.providerType
          : 'openai-compatible',
      endpointUrl: campaign.endpointUrl ?? '',
      modelName: campaign.modelName ?? '',
      // D-23: API key fields always empty — keys are write-only
      apiKey: '',
      referenceDocs: Array.isArray(campaign.referenceDocs) ? campaign.referenceDocs : [],
      fallbackEndpointUrl: campaign.fallbackEndpointUrl ?? '',
      fallbackModelName: campaign.fallbackModelName ?? '',
      // D-23: fallback key field always empty
      fallbackApiKey: '',
    })

    setDmPersonality(campaign.dmPersonality ?? '')
    setStrictness(
      campaign.strictness === 'strict' ||
        campaign.strictness === 'balanced' ||
        campaign.strictness === 'narrative'
        ? campaign.strictness
        : 'balanced',
    )
    setProviderErrors({})
  }, [open, campaign])

  const updateAiConfigMutation = useMutation({
    mutationFn: (data: Parameters<typeof trpc.campaigns.updateAiConfig.mutate>[0]) =>
      trpc.campaigns.updateAiConfig.mutate(data),
    onSuccess: () => {
      // Invalidate the campaign get query so the view screen picks up new config
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'get', campaignId] })
      onClose()
    },
  })

  function handleSave() {
    const errors = validateAiProviderFields(aiProvider)
    if (Object.keys(errors).length > 0) {
      setProviderErrors(errors)
      return
    }
    setProviderErrors({})

    updateAiConfigMutation.mutate({
      campaignId,
      providerType: aiProvider.providerType,
      endpointUrl: aiProvider.endpointUrl.trim() || undefined,
      modelName: aiProvider.modelName.trim(),
      // D-23: only send apiKey when user typed something; blank = keep current key
      apiKey: aiProvider.apiKey || undefined,
      dmPersonality: dmPersonality.trim() || undefined,
      strictness,
      referenceDocs: aiProvider.referenceDocs,
      fallbackEndpointUrl: aiProvider.fallbackEndpointUrl.trim() || undefined,
      fallbackModelName: aiProvider.fallbackModelName.trim() || undefined,
      fallbackApiKey: aiProvider.fallbackApiKey || undefined,
    })
  }

  const isSaving = updateAiConfigMutation.isPending
  const isValid = isAiProviderFieldsValid(aiProvider)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-[560px] w-full max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            AI Settings{campaign?.name ? ` — ${campaign.name}` : ''}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto py-4 px-1 flex flex-col gap-6">
          {campaignQuery.isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading settings…
            </p>
          )}

          {campaignQuery.isError && (
            <p className="text-sm text-destructive text-center py-8">
              Failed to load campaign settings.
            </p>
          )}

          {!campaignQuery.isLoading && !campaignQuery.isError && (
            <>
              {/* Provider config (Step 2 content) */}
              <AiProviderFields
                value={aiProvider}
                onChange={(next) => {
                  setAiProvider(next)
                  setProviderErrors({})
                }}
                keepExistingKeyMode
                errors={providerErrors}
              />

              {/* Divider between Step 2 and Step 3 content */}
              <div className="border-t border-border" />

              {/* DM Personality (Step 3 content) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-dm-personality" className="text-sm font-semibold">
                  DM Personality{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Describe the tone and style of your DM. This shapes every response the AI
                  gives.
                </p>
                <Textarea
                  id="settings-dm-personality"
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

              {/* Rules Strictness (Step 3 content) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-strictness" className="text-sm font-semibold">
                  Rules Strictness
                </Label>
                <Select
                  value={strictness}
                  onValueChange={(v) => setStrictness(v as Strictness)}
                >
                  <SelectTrigger id="settings-strictness">
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

              {updateAiConfigMutation.error && (
                <p className="text-sm text-destructive">
                  {updateAiConfigMutation.error instanceof Error
                    ? updateAiConfigMutation.error.message
                    : "Couldn't save settings. Please try again."}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isValid || campaignQuery.isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
