import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronLeft, Moon, Play, SlidersHorizontal, Square, Swords, Trash2 } from 'lucide-react'
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
import { useSessionStore } from '../stores/sessionStore'
import { useCombatStore } from '../stores/combatStore'
import { CharacterSheetTab } from '../components/CharacterSheetTab'
import { CombatTrackerTab } from '../components/CombatTrackerTab'
import { SessionJournalTab } from '../components/SessionJournalTab'
import { StoryScrollPanel } from '../components/StoryScrollPanel'
import { ChatInputArea } from '../components/ChatInputArea'
import { AiSettingsModal } from '../components/AiSettingsModal'
import { SessionStartModal } from '../components/SessionStartModal'
import { EndSessionModal } from '../components/EndSessionModal'
import { RestPickerDialog } from '../components/RestPickerDialog'
import { ShortRestHitDiceModal } from '../components/ShortRestHitDiceModal'
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

  // Session lifecycle state — plan 04-05
  const sessionStore = useSessionStore()
  const [showSessionStart, setShowSessionStart] = useState(false)
  const [showEndSession, setShowEndSession] = useState(false)

  // Combat state — plan 05-03. activeTab lives in the store so handleStartCombat can
  // auto-switch the right panel to the Combat tab (D-17); the <Tabs> below is controlled.
  const activeTab = useCombatStore((s) => s.activeTab)
  const setActiveTab = useCombatStore((s) => s.setActiveTab)
  const isCombatActive = useCombatStore((s) => s.isCombatActive)

  // Rest system state — plan 05-06 (D-34, PROG-02)
  const [showRestPicker, setShowRestPicker] = useState(false)
  const [showShortRest, setShowShortRest] = useState(false)

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

  // Restore active session from DB on campaign load (handles page refresh / navigate back — D-05)
  const activeSessionQuery = useQuery({
    queryKey: ['sessions', 'getActive', id],
    queryFn: () => trpc.sessions.getActive.query({ campaignId: id! }),
    enabled: !!id,
  })

  // Pre-fill location for SessionStartModal from the last completed session (D-07)
  const lastLocationQuery = useQuery({
    queryKey: ['sessions', 'lastLocation', id],
    queryFn: () => trpc.sessions.getLastLocation.query({ campaignId: id! }),
    enabled: !!id,
  })

  // Message count query for D-04 auto-narration guard (prevent re-firing on page refresh)
  const messagesQuery = useQuery({
    queryKey: ['ai', 'getMessages', id],
    queryFn: () => trpc.ai.getMessages.query({ campaignId: id! }),
    enabled: !!id,
    staleTime: Infinity,
  })

  // Character query for ShortRestHitDiceModal (needs hitDice + CON data)
  const characterQuery = useQuery({
    queryKey: ['characters', 'getByCampaignId', id],
    queryFn: () => trpc.characters.getByCampaignId.query({ campaignId: id! }),
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

  // Combat start/end mutations — plan 05-03
  const startCombatMutation = useMutation({
    mutationFn: () => trpc.combat.startCombat.mutate({ campaignId: id! }),
  })
  const endCombatMutation = useMutation({
    mutationFn: () => trpc.combat.endCombat.mutate({ campaignId: id! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combat', 'listActive', id] })
    },
  })

  // startCombat (store action) sets activeTab='combat-tracker' to auto-switch the panel (D-17)
  const handleStartCombat = useCallback(() => {
    useCombatStore.getState().startCombat(id!)
    startCombatMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const handleEndCombat = useCallback(() => {
    useCombatStore.getState().endCombat()
    endCombatMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  /**
   * handleRest — send the context message to the AI and close the picker (D-34, PROG-02).
   * Does NOT pre-apply recovery (D-35 — only the AI's processRest grants it).
   * Exact copywriting per UI-SPEC §S8a: "[Player requests a short rest]" / "[Player requests a long rest]"
   */
  const handleRest = useCallback(
    (type: 'short' | 'long') => {
      const content =
        type === 'short'
          ? '[Player requests a short rest]'
          : '[Player requests a long rest]'
      aiStream.send(content)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiStream],
  )

  // Set campaign name in title bar when data loads; clear on unmount (D-13)
  useEffect(() => {
    if (campaignQuery.data?.name) {
      setCampaignName(campaignQuery.data.name)
    }
    return () => {
      setCampaignName(null)
    }
  }, [campaignQuery.data?.name, setCampaignName])

  // Restore active session on campaign load (handles window reload / navigation back — D-05)
  useEffect(() => {
    if (activeSessionQuery.data) {
      const s = activeSessionQuery.data
      useSessionStore.getState().startSession(s.id, s.sessionNumber, {
        location: s.location ?? null,
        goal: s.goal ?? null,
        contextNotes: s.contextNotes ?? null,
      })
    } else if (activeSessionQuery.isSuccess && !activeSessionQuery.data) {
      // No active session — ensure store is cleared (page refresh with no active session)
      useSessionStore.getState().endSession()
    }
  }, [activeSessionQuery.data, activeSessionQuery.isSuccess])

  // Register L1Overflow listener on mount; window.aiStream.onFinish now carries meta (plan 04-04)
  // Note: useAiStream also registers onFinish; both run for the same event.
  // useAiStream handles cleanup via removeAllListeners on its effect cleanup.
  useEffect(() => {
    const handler = (meta?: { isL1Overflow?: boolean }) => {
      if (meta?.isL1Overflow) {
        useSessionStore.getState().setL1Overflow(true)
      }
    }
    window.aiStream.onFinish(handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * processRest short-rest modal hook (PROG-02, D-35, D-36, UI-SPEC §S8b).
   *
   * Wired path: main emits 'ai:mutations-applied' when processRest tool call is applied.
   * If any chip has type='rest' and label='Short rest taken', the ShortRestHitDiceModal opens.
   * Long rest needs no modal — recovery is auto-applied by 05-02 (applyRest).
   */
  useEffect(() => {
    window.aiStream.onMutationsApplied((payload) => {
      if (!id || payload.campaignId !== id) return
      const hasShortRest = payload.chips.some(
        (c) => c.type === 'rest' && c.label === 'Short rest taken',
      )
      if (hasShortRest) {
        setShowShortRest(true)
      }
    })
    // Cleanup via removeAllListeners on unmount (called by useAiStream effect cleanup above)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // D-04: When isSessionActive transitions to true and no messages exist for this campaign yet,
  // auto-send a trigger prompt so the AI narrates the session opening without the player typing.
  // CR-01 fix: track which sessionId has already triggered auto-narration via a ref so this only
  // fires once per new session (not every session after session 1, and not on page-reload mid-session).
  const prevIsSessionActive = useRef(false)
  const autoNarrationSentRef = useRef<string | null>(null)
  useEffect(() => {
    const justActivated = sessionStore.isSessionActive && !prevIsSessionActive.current
    prevIsSessionActive.current = sessionStore.isSessionActive
    if (!justActivated) return
    if (!id || !sessionStore.activeSessionId) return
    // Only fire once per unique sessionId
    if (autoNarrationSentRef.current === sessionStore.activeSessionId) return
    // Only auto-narrate if no campaign messages exist (truly first session, first message)
    const messageCount = messagesQuery.data?.length ?? null
    if (messageCount === null) return // still loading — bail, will re-run when data arrives
    if (messageCount > 0) return
    autoNarrationSentRef.current = sessionStore.activeSessionId
    window.aiStream.sendMessage({
      campaignId: id,
      content: '[Begin session narration]',
    })
  }, [sessionStore.isSessionActive, sessionStore.activeSessionId, id, messagesQuery.data])

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
        <TooltipProvider>
          <Tooltip delayDuration={600}>
            <TooltipTrigger asChild>
              {!isCombatActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartCombat}
                  className="gap-2"
                >
                  <Swords className="h-4 w-4" />
                  Start Combat
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEndCombat}
                  className="gap-2 border-destructive/60 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  <Swords className="h-4 w-4" />
                  End Combat
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {!isCombatActive ? 'Begin a combat encounter' : 'End the current encounter'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* Rest button — opens Short/Long rest picker (D-34, PROG-02, UI-SPEC §S1) */}
        <TooltipProvider>
          <Tooltip delayDuration={600}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowRestPicker(true)}
              >
                <Moon className="h-4 w-4" />
                Rest
              </Button>
            </TooltipTrigger>
            <TooltipContent>Take a short or long rest</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip delayDuration={600}>
            <TooltipTrigger asChild>
              {!sessionStore.isSessionActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSessionStart(true)}
                  className="gap-1.5"
                >
                  <Play className="h-4 w-4" />
                  Start Session
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEndSession(true)}
                  className="gap-1.5 border-destructive/60 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  <Square className="h-4 w-4" />
                  End Session
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {!sessionStore.isSessionActive
                ? 'Begin a new play session'
                : 'End this session and save a recap'}
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
              isL1Overflow={sessionStore.isL1Overflow}
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
              isSessionActive={sessionStore.isSessionActive}
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
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
                  Journal
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

              <TabsContent value="combat-tracker" className="flex-1 overflow-hidden p-0">
                <CombatTrackerTab campaignId={id} />
              </TabsContent>

              <TabsContent value="npc-tracker" className="flex-1 overflow-auto p-6">
                <div className="flex flex-col items-center max-w-[400px] mx-auto" style={{ paddingTop: '30%' }}>
                  <h2 className="text-xl font-semibold text-foreground mb-2">NPC Tracker</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    NPCs you meet will be tracked here once the AI starts populating them in Phase 6.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="session-journal" className="flex-1 overflow-hidden p-0">
                <SessionJournalTab campaignId={id} />
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

    {/* Session Start modal — plan 04-05 */}
    {id && (
      <SessionStartModal
        open={showSessionStart}
        onClose={() => setShowSessionStart(false)}
        campaignId={id}
        lastLocation={lastLocationQuery.data ?? null}
      />
    )}

    {/* End Session modal — plan 04-05 */}
    {id && sessionStore.activeSessionId && (
      <EndSessionModal
        open={showEndSession}
        onClose={() => setShowEndSession(false)}
        campaignId={id}
        sessionId={sessionStore.activeSessionId}
        sessionNumber={sessionStore.sessionNumber}
      />
    )}

    {/* Rest picker — Short/Long rest selector (D-34, PROG-02) */}
    {id && (
      <RestPickerDialog
        open={showRestPicker}
        onClose={() => setShowRestPicker(false)}
        onSelectRest={handleRest}
      />
    )}

    {/* Short Rest Hit Dice modal — opens when AI grants short rest (D-36, PROG-02) */}
    {id && characterQuery.data && (
      <ShortRestHitDiceModal
        open={showShortRest}
        onClose={() => setShowShortRest(false)}
        character={characterQuery.data}
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
