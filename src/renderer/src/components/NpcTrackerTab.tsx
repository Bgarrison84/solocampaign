import { useQuery } from '@tanstack/react-query'
import { Users, ChevronDown } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

interface NpcTrackerTabProps {
  campaignId: string
}

/**
 * NPC Tracker tab (STATE-02, STATE-03) — replaces the Phase 5 placeholder.
 *
 * Read-only, AI-populated surface (UI-SPEC §S3). Renders:
 * - A chronological NPC list (encounter order, sorted by createdAt ASC in npcsRepo.list),
 *   each row showing name + relationship tag + one-line description.
 * - A collapsible Factions section below the NPC list (§S3b), each faction showing
 *   name + tier badge. The section starts expanded (defaultOpen) and exists for panel
 *   space management as factions grow.
 * - An empty state (§S3a) shown only when there are no NPCs AND no factions.
 *
 * The player never mutates NPCs or factions (D-09): all writes come from the AI mutation
 * pipeline (addNpc / updateNpc / updateFaction). No edit controls live here.
 */
export function NpcTrackerTab({ campaignId }: NpcTrackerTabProps) {
  const npcsQuery = useQuery({
    queryKey: ['npcs', 'list', campaignId],
    queryFn: () => trpc.npcs.list.query({ campaignId }),
    enabled: !!campaignId,
  })
  const factionsQuery = useQuery({
    queryKey: ['factions', 'list', campaignId],
    queryFn: () => trpc.factions.list.query({ campaignId }),
    enabled: !!campaignId,
  })

  const npcs = npcsQuery.data ?? []
  const factions = factionsQuery.data ?? []

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {npcs.length === 0 && factions.length === 0 && <NpcTrackerEmptyState />}

          {npcs.map((npc) => (
            <NpcRow key={npc.id} npc={npc} />
          ))}

          {/* Factions section — rendered when factions exist, even if the NPC list is empty */}
          {factions.length > 0 && <FactionSection factions={factions} />}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── NPC row ─────────────────────────────────────────────────────────────────

interface NpcRowProps {
  npc: {
    id: string
    name: string
    description: string | null
    relationship: string
  }
}

function NpcRow({ npc }: NpcRowProps) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-start gap-3">
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{npc.name}</span>
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold shrink-0', npcRelationshipColor(npc.relationship))}
          >
            {npc.relationship}
          </Badge>
        </div>
        {npc.description && (
          <p className="text-xs text-muted-foreground leading-[1.4]">{npc.description}</p>
        )}
      </div>
    </div>
  )
}

// ─── Factions section ────────────────────────────────────────────────────────

interface FactionSectionProps {
  factions: Array<{ id: string; name: string; tier: string }>
}

function FactionSection({ factions }: FactionSectionProps) {
  return (
    <Collapsible className="mt-4" defaultOpen={true}>
      <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 data-[state=open]:rotate-180" />
        <span>Factions</span>
        {factions.length > 0 && (
          <span className="text-xs text-muted-foreground/60 ml-1">({factions.length})</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1 px-1">
          {factions.map((f) => (
            <div
              key={f.id}
              className="bg-card border border-border rounded-lg px-3 py-1.5 flex items-center gap-3"
            >
              <span className="text-sm text-foreground flex-1 truncate">{f.name}</span>
              <Badge
                variant="outline"
                className={cn('text-xs font-semibold shrink-0', factionTierColor(f.tier))}
              >
                {f.tier}
              </Badge>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Empty state (S3a) ───────────────────────────────────────────────────────

function NpcTrackerEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
      <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm font-semibold text-muted-foreground">No NPCs yet</p>
      <p className="text-sm text-muted-foreground/70">
        Characters you meet will be tracked here as the DM introduces them.
      </p>
    </div>
  )
}

// ─── Color helpers ───────────────────────────────────────────────────────────

/** Semantic relationship-tag color (UI-SPEC §S3). */
function npcRelationshipColor(relationship: string): string {
  switch (relationship) {
    case 'Friendly':
      return 'text-green-400 border-green-400'
    case 'Hostile':
      return 'text-red-400 border-red-400'
    case 'Neutral':
      return 'text-muted-foreground border-border'
    case 'Unknown':
      return 'text-muted-foreground border-border'
    default:
      return 'text-muted-foreground border-border'
  }
}

/** Semantic faction-tier badge color (UI-SPEC §S3b, verbatim from 06-RESEARCH § Pattern 6). */
function factionTierColor(tier: string): string {
  switch (tier) {
    case 'Hostile':
      return 'text-red-400 border-red-400'
    case 'Unfriendly':
      return 'text-orange-400 border-orange-400'
    case 'Neutral':
      return 'text-muted-foreground border-border'
    case 'Friendly':
      return 'text-green-400 border-green-400'
    case 'Allied':
      return 'text-sky-400 border-sky-400'
    default:
      return 'text-muted-foreground border-border'
  }
}
