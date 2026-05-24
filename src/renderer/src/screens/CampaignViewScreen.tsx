import React, { useCallback, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { trpc } from '../lib/trpc'
import { usePanelSizeStore } from '../stores/panelSizeStore'
import { useWindowStore } from '../stores/windowStore'

export function CampaignViewScreen() {
  const { id } = useParams<{ id: string }>()
  const store = usePanelSizeStore()
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setCampaignName = useWindowStore((s) => s.setCampaignName)

  const campaignQuery = useQuery({
    queryKey: ['campaigns', 'get', id],
    queryFn: () => trpc.campaigns.get.query({ id: id! }),
    enabled: !!id,
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
    <div className="flex flex-col h-full">
      <PanelGroup
        direction="horizontal"
        className="flex-1"
        onLayout={handleLayout}
      >
        {/* Left panel — narrative chat shell (Phase 3 fills with real chat) */}
        <Panel defaultSize={store.sizes.leftSize} minSize={30}>
          <div className="flex items-center justify-center h-full bg-background">
            <p className="text-sm text-muted-foreground font-normal">
              AI narration appears here.
            </p>
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
              </TabsList>

              <TabsContent value="character-sheet" className="flex-1 overflow-auto p-6">
                <div className="flex flex-col items-center max-w-[400px] mx-auto" style={{ paddingTop: '30%' }}>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Character Sheet</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    Your character sheet will appear here after character creation (Phase 2).
                  </p>
                </div>
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
  )
}
