import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronLeft, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../components/ui/tooltip'
import { trpc } from '../lib/trpc'
import { usePanelSizeStore } from '../stores/panelSizeStore'
import { useWindowStore } from '../stores/windowStore'
import { CharacterSheetTab } from '../components/CharacterSheetTab'
import { StoryScrollPanel } from '../components/StoryScrollPanel'
import { ChatInputArea } from '../components/ChatInputArea'
import { AiSettingsModal } from '../components/AiSettingsModal'
import { useAiStream } from '../hooks/useAiStream'

export function CampaignViewScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const store = usePanelSizeStore()
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setCampaignName = useWindowStore((s) => s.setCampaignName)
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // AI streaming state — plan 03-04
  // useAiStream requires a non-null campaignId; we render a fallback before this point if id is null
  const aiStream = useAiStream(id ?? '')

  // Ref to imperatively scroll the story scroll to bottom after player sends a message
  const scrollToBottomRef = useRef<(() => void) | null>(null)

  // AiSettingsModal open state — plan 03-05: wired to the actual AiSettingsModal
  const [showAiSettings, setShowAiSettings] = useState(false)
  const handleOpenSettings = useCallback(() => {
    setShowAiSettings(true)
  }, [])

  // Track the last user message content to support Retry and Switch-to-fallback (D-18/D-19)
  const lastUserContentRef = useRef<string>('')

  const campaignQuery = useQuery({
    queryKey: ['campaigns', 'get', id],
    queryFn: () => trpc.campaigns.get.query({ id: id! }),
    enabled: !!id,
  })

  const coverMutation = useMutation({
    mutationFn: () => trpc.campaigns.importCoverImage.mutate({ campaignId: id! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'getCoverDataUrl', id] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => trpc.campaigns.delete.mutate({ id: id! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      navigate('/')
    },
  })

  // Set campaign name in title bar when data loads; clear on unmount (D-13)
  useEffect(() => {
    if (campaignQuery.data?.name) {
      setCampaignName(campaignQuery.data.name)
    }
    return () => {
      setCampaignName(null)
    }
  }, [campaignQuery.data?.name, setCampaignName])

  // Load persisted panel sizes on mount or campaign change
  useEffect(() => {
    if (!id) return
    // Resets isLoaded so we wait for the real values
    usePanelSizeStore.setState({ isLoaded: false })
    store.load(id).then(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Debounced save on resize — 500ms after dragging stops
  const handleLayout = useCallback(
    (sizes: number[]) => {
      if (sizes.length === 2 && id) {
        store.setLocalSizes(sizes[0], sizes[1])
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
        saveDebounceRef.current = setTimeout(() => {
          store.save(id, sizes[0], sizes[1])
        }, 500)
      }
    },
    // store is a Zustand store ref — stable across renders; id is the real dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]
  )

  if (!id) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground">No campaign selected.</p>
      </div>
    )
  }

  if (campaignQuery.isLoading || !store.isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground">Loading campaign...</p>
      </div>
    )
  }

  if (!campaignQuery.data) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground">Campaign not found.</p>
      </div>
    )
  }

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Action bar — back navigation + delete */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-border bg-card shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Campaigns
        </Button>
        <span className="flex-1" />
        <TooltipProvider>
          <Tooltip delayDuration={600}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenSettings}
                className="gap-1 text-muted-foreground hover:text-foreground transition-colors duration-200"
                aria-describedby="ai-settings-tooltip"
              >
                <SlidersHorizontal className="h-4 w-4" />
                AI Settings
              </Button>
            </TooltipTrigger>
            <TooltipContent id="ai-settings-tooltip">
              Configure AI provider, DM personality, and rules
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
        >
          <Trash2 className="h-4 w-4" />
          Delete Campaign
        </Button>
      </div>

      <PanelGroup
        direction="horizontal"
        className="flex-1"
        onLayout={handleLayout}
      >
        {/* Left panel — story scroll + chat input (plan 03-04) */}
        <Panel defaultSize={store.sizes.leftSize} minSize={30}>
          <div className="flex flex-col h-full bg-background">
            <StoryScrollPanel
              campaignId={id}
              isStreaming={aiStream.isStreaming}
              streamingContent={aiStream.streamingContent}
              error={aiStream.error}
              hasFallback={!!(campaignQuery.data?.fallbackEndpointUrl)}
              onRetry={() => {
                // Retry: re-send the last user message with the same provider
                aiStream.clearError()
                // The last message in history is the user's — re-send by triggering send again
                // StoryScrollPanel does not track lastContent; we rely on CampaignViewScreen to re-send
                // The retry callback is connected below via lastUserContentRef
                if (lastUserContentRef.current) {
                  aiStream.send(lastUserContentRef.current)
                }
              }}
              onSwitchToFallback={() => {
                // D-19: switch to fallback for this session, re-attempt immediately
                aiStream.clearError()
                if (lastUserContentRef.current) {
                  aiStream.send(lastUserContentRef.current, { useFallback: true })
                }
              }}
              onOpenSettings={handleOpenSettings}
              scrollToBottomRef={scrollToBottomRef}
              className="flex-1"
            />
            <ChatInputArea
              onSend={(content) => {
                lastUserContentRef.current = content
                aiStream.send(content)
                // Force-scroll to bottom after player submits
                scrollToBottomRef.current?.()
              }}
              isStreaming={aiStream.isStreaming}
              disabled={!campaignQuery.data?.providerType}
              onOpenSettings={handleOpenSettings}
              className="shrink-0"
            />
          </div>
        </Panel>

        {/* Resize handle — 4px wide, col-resize cursor, --border color */}
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

        {/* Right panel — 5-tab shell */}
        <Panel defaultSize={store.sizes.rightSize} minSize={25}>
          <div className="flex flex-col h-full bg-background">
            <Tabs defaultValue="character-sheet" className="flex flex-col h-full">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-card h-auto px-0">
                <TabsTrigger
                  value="character-sheet"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                >
                  Character Sheet
                </TabsTrigger>
                <TabsTrigger
                  value="combat-tracker"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                >
                  Combat Tracker
                </TabsTrigger>
                <TabsTrigger
                  value="npc-tracker"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                >
                  NPC Tracker
                </TabsTrigger>
                <TabsTrigger
                  value="session-journal"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                >
                  Session Journal
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                >
                  Inventory
                </TabsTrigger>
                {/* Trailing action — Change Cover Image */}
                <div className="ml-auto pr-2 flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => coverMutation.mutate()}
                    disabled={coverMutation.isPending}
                  >
                    <Camera className="mr-1 h-4 w-4" />
                    {coverMutation.isPending ? 'Importing...' : 'Change Cover Image'}
                  </Button>
                </div>
              </TabsList>

              <TabsContent value="character-sheet" className="flex-1 overflow-hidden p-0">
                <CharacterSheetTab campaignId={id} />
              </TabsContent>

              <TabsContent value="combat-tracker" className="flex-1 overflow-auto p-6">
                <div className="flex flex-col items-center max-w-[400px] mx-auto" style={{ paddingTop: '30%' }}>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Combat Tracker</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    Initiative, HP, and conditions will appear here once combat lands in Phase 5.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="npc-tracker" className="flex-1 overflow-auto p-6">
                <div className="flex flex-col items-center max-w-[400px] mx-auto" style={{ paddingTop: '30%' }}>
                  <h2 className="text-xl font-semibold text-foreground mb-2">NPC Tracker</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    NPCs you meet will be tracked here once the AI starts populating them in Phase 6.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="session-journal" className="flex-1 overflow-auto p-6">
                <div className="flex flex-col items-center max-w-[400px] mx-auto" style={{ paddingTop: '30%' }}>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Session Journal</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    Your session recaps and notes will live here once session memory ships in Phase 4.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="inventory" className="flex-1 overflow-auto p-6">
                <div className="flex flex-col items-center max-w-[400px] mx-auto" style={{ paddingTop: '30%' }}>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Inventory</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    Items, currency, and attunement will appear here once your character has belongings in Phase 2.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Panel>
      </PanelGroup>
    </div>

    {/* AI Settings modal — opened by gear button in action bar or onOpenSettings from chat area */}
    {id && (
      <AiSettingsModal
        campaignId={id}
        open={showAiSettings}
        onClose={() => setShowAiSettings(false)}
      />
    )}

    {/* Delete confirmation dialog */}
    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete this campaign?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will permanently delete{' '}
          <span className="font-semibold text-foreground">{campaignQuery.data?.name}</span>{' '}
          and all its characters. This cannot be undone.
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
