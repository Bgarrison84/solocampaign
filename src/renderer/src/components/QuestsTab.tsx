import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

interface QuestsTabProps {
  campaignId: string
}

type Quest = Awaited<ReturnType<typeof trpc.quests.list.query>>[number]

/**
 * Quests tab — the 6th right-panel tab (STATE-01, UI-SPEC §S2).
 *
 * Read-only, chronological projection of the AI-populated quest log. Each quest
 * renders as name + status badge + one-line description. The player never edits
 * quests — all quest state is owned by the AI mutation pipeline (addQuest /
 * updateQuestStatus, D-04). No loading spinner: TanStack Query returns [] before
 * data loads.
 */
export function QuestsTab({ campaignId }: QuestsTabProps) {
  const questsQuery = useQuery({
    queryKey: ['quests', 'list', campaignId],
    queryFn: () => trpc.quests.list.query({ campaignId }),
    enabled: !!campaignId,
  })
  const quests = questsQuery.data ?? []

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* No loading spinner — TanStack Query returns [] before data loads */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {quests.length === 0 && <QuestsEmptyState />}
          {quests.map((q) => (
            <QuestRow key={q.id} quest={q} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Quest row ──────────────────────────────────────────────────────────────

function QuestRow({ quest }: { quest: Quest }) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-start gap-3">
      {/* Name + badge row */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{quest.name}</span>
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold shrink-0', questStatusColor(quest.status))}
          >
            {quest.status}
          </Badge>
        </div>
        {quest.description && (
          <p className="text-xs text-muted-foreground leading-[1.4]">{quest.description}</p>
        )}
      </div>
    </div>
  )
}

// ─── Empty state (S2a) ──────────────────────────────────────────────────────

function QuestsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
      <ScrollText className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm font-semibold text-muted-foreground">No quests yet</p>
      <p className="text-sm text-muted-foreground/70">
        Quests will appear here as the story unfolds and the DM introduces them.
      </p>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Semantic quest-status badge color (UI-SPEC §S2 / D-02): Active green, Completed muted, Failed red. */
function questStatusColor(status: string): string {
  switch (status) {
    case 'Active':
      return 'text-green-400 border-green-400'
    case 'Completed':
      return 'text-muted-foreground border-border'
    case 'Failed':
      return 'text-red-400 border-red-400'
    default:
      return 'text-muted-foreground border-border'
  }
}
