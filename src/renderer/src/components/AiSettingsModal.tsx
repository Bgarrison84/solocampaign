import React, { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { trpc } from '../lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Textarea } from './ui/textarea'
import { Separator } from './ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
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

/** Count words in a string (split on whitespace). */
function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
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

  // PROG-04: permadeath toggle
  const [permadeath, setPermadeath] = useState(false)

  // Homebrew tab state
  const [homebrewContent, setHomebrewContent] = useState('')
  const [homebrewImportError, setHomebrewImportError] = useState<string | null>(null)

  // Import doc error
  const [importDocError, setImportDocError] = useState<string | null>(null)

  // Query campaign reference docs (for the imported docs list)
  const campaignDocsQuery = useQuery({
    queryKey: ['campaignDocs', 'list', campaignId],
    queryFn: () => trpc.campaignDocs.list.query({ campaignId }),
    enabled: open && !!campaignId,
  })

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
      referenceDocs: (() => {
        if (Array.isArray(campaign.referenceDocs)) return campaign.referenceDocs as string[]
        if (typeof campaign.referenceDocs === 'string') {
          try { return JSON.parse(campaign.referenceDocs) as string[] } catch { return [] }
        }
        return []
      })(),
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
    setPermadeath(campaign.permadeathMode ?? false)
    setHomebrewContent(campaign.homebrewContent ?? '')
    setProviderErrors({})
    setHomebrewImportError(null)
    setImportDocError(null)
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

  const setPermadeathMutation = useMutation({
    mutationFn: (data: { campaignId: string; permadeathMode: boolean }) =>
      trpc.campaigns.setPermadeath.mutate(data),
  })

  const updateHomebrewMutation = useMutation({
    mutationFn: (data: { campaignId: string; homebrewContent: string }) =>
      trpc.campaigns.updateHomebrew.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'get', campaignId] })
    },
  })

  const importHomebrewTextMutation = useMutation({
    mutationFn: () => trpc.campaigns.importHomebrewTextWithDialog.mutate(),
    onSuccess: (text) => {
      if (text === null) return // user cancelled
      setHomebrewContent((prev) => {
        if (!prev.trim()) return text
        return prev + '\n\n' + text
      })
      setHomebrewImportError(null)
    },
    onError: () => {
      setHomebrewImportError('Could not read that file. Try a different file.')
    },
  })

  const importDocWithDialogMutation = useMutation({
    mutationFn: () => trpc.campaignDocs.importWithDialog.mutate({ campaignId }),
    onSuccess: (doc) => {
      if (doc === null) return // user cancelled
      queryClient.invalidateQueries({ queryKey: ['campaignDocs', 'list', campaignId] })
      setImportDocError(null)
    },
    onError: () => {
      setImportDocError('Could not read that file. Try a different PDF or use a text file instead.')
    },
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => trpc.campaignDocs.delete.mutate({ docId, campaignId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaignDocs', 'list', campaignId] })
    },
  })

  function handleSave() {
    const errors = validateAiProviderFields(aiProvider)
    if (Object.keys(errors).length > 0) {
      setProviderErrors(errors)
      return
    }
    setProviderErrors({})

    // Persist permadeath toggle (PROG-04) alongside the main config save
    setPermadeathMutation.mutate({ campaignId, permadeathMode: permadeath })

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

  function handleSaveHomebrew() {
    updateHomebrewMutation.mutate({ campaignId, homebrewContent })
  }

  const isSaving = updateAiConfigMutation.isPending || setPermadeathMutation.isPending
  const isSavingHomebrew = updateHomebrewMutation.isPending
  const isValid = isAiProviderFieldsValid(aiProvider)
  const importedDocs = campaignDocsQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-[580px] w-full max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            AI Settings{campaign?.name ? ` — ${campaign.name}` : ''}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ai-settings" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="ai-settings" className="flex-1">AI Settings</TabsTrigger>
            <TabsTrigger value="homebrew" className="flex-1">Homebrew</TabsTrigger>
          </TabsList>

          {/* ── AI Settings tab ── */}
          <TabsContent value="ai-settings" className="flex-1 overflow-y-auto py-4 px-1 flex flex-col gap-6 mt-0">
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

                {/* Permadeath toggle (PROG-04) */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold">Gameplay Options</p>
                  <div className="flex items-start gap-3 p-3 bg-card rounded-md border border-border">
                    <Checkbox
                      id="settings-permadeath"
                      checked={permadeath}
                      onCheckedChange={(v) => setPermadeath(!!v)}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="settings-permadeath" className="text-sm font-semibold cursor-pointer">
                        Permadeath mode
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, a character that dies cannot be revived.
                      </p>
                    </div>
                  </div>
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
          </TabsContent>

          {/* ── Homebrew tab ── */}
          <TabsContent value="homebrew" className="flex-1 overflow-y-auto py-4 px-1 flex flex-col gap-4 mt-0">
            {/* Homebrew Content section */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="homebrew-content" className="text-sm font-semibold">
                Homebrew Content
              </Label>
              <p className="text-sm text-muted-foreground">
                Custom races, classes, spells, and rules available to the AI DM.
              </p>
              <Textarea
                id="homebrew-content"
                rows={12}
                value={homebrewContent}
                onChange={(e) => setHomebrewContent(e.target.value)}
                placeholder="Paste or write homebrew content here…"
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {wordCount(homebrewContent)} words
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={importHomebrewTextMutation.isPending}
                  onClick={() => importHomebrewTextMutation.mutate()}
                >
                  {importHomebrewTextMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Importing…
                    </>
                  ) : (
                    'Import file…'
                  )}
                </Button>
              </div>
              {homebrewImportError && (
                <p className="text-xs text-destructive">{homebrewImportError}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveHomebrew}
                disabled={isSavingHomebrew}
              >
                {isSavingHomebrew ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Saving…
                  </>
                ) : (
                  'Save Homebrew'
                )}
              </Button>
            </div>

            <Separator />

            {/* Imported Rules Documents section */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Imported Rules Documents</p>

              {campaignDocsQuery.isLoading && (
                <p className="text-sm text-muted-foreground italic">Loading…</p>
              )}

              {!campaignDocsQuery.isLoading && importedDocs.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No imported documents.</p>
              )}

              {importedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex justify-between items-center py-1.5"
                >
                  <span className="text-sm text-muted-foreground truncate flex-1 mr-2">
                    {doc.filename}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteDocMutation.mutate(doc.id)}
                    disabled={deleteDocMutation.isPending}
                    aria-label={`Remove ${doc.filename}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start mt-1"
                onClick={() => importDocWithDialogMutation.mutate()}
                disabled={importDocWithDialogMutation.isPending}
              >
                {importDocWithDialogMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Importing…
                  </>
                ) : (
                  'Import PDF or text file…'
                )}
              </Button>

              {importDocError && (
                <p className="text-xs text-destructive">{importDocError}</p>
              )}
            </div>

            {updateHomebrewMutation.error && (
              <p className="text-sm text-destructive">
                {updateHomebrewMutation.error instanceof Error
                  ? updateHomebrewMutation.error.message
                  : "Couldn't save homebrew. Please try again."}
              </p>
            )}
          </TabsContent>
        </Tabs>

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
