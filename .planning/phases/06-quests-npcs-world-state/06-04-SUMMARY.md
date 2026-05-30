---
phase: 06-quests-npcs-world-state
plan: 04
subsystem: renderer-ui
tags: [quests, ui, tab, tanstack-query, read-only, badge, empty-state]
requires:
  - "06-02: trpc.quests.list router (returns Quest[]) + quests/npcs/worldState/factions routers registered in router.ts"
provides:
  - "QuestsTab component (src/renderer/src/components/QuestsTab.tsx) — read-only, AI-populated quest log tab"
affects:
  - "06-06 CampaignViewScreen wiring: mounts <QuestsTab campaignId={id} /> as the 6th tab content"
tech-stack:
  added: []
  patterns:
    - "Pure TanStack Query consumer: useQuery({ queryKey: ['quests','list',campaignId], queryFn, enabled }) -> data ?? [] (no loading spinner)"
    - "Quest type inferred from the tRPC proxy client via Awaited<ReturnType<typeof trpc.quests.list.query>>[number] — no cross-process schema import"
    - "Read-only projection of AI tool-call state (D-04): zero buttons/inputs/mutations; semantic status-color helper"
    - "Empty-state convention reused verbatim from CombatTrackerTab S2a (centered column, lucide icon, heading + body)"
key-files:
  created:
    - src/renderer/src/components/QuestsTab.tsx
  modified: []
decisions:
  - "Quest row type derived via Awaited<ReturnType<typeof trpc.quests.list.query>>[number] instead of importing the main-process Quest schema type — keeps the renderer decoupled from main and uses the wire shape the proxy client actually returns"
  - "Verify command run against tsconfig.json (the project's single unified tsconfig); the plan's tsconfig.web.json does not exist — same Rule 3 tooling deviation recorded by waves 1 and 2"
metrics:
  duration: ~10min
  tasks: 1
  files: 1
  completed: 2026-05-30
---

# Phase 6 Plan 04: QuestsTab Quest Log Component Summary

Built the new `QuestsTab` component — the read-only, AI-populated 6th right-panel tab (STATE-01). It renders the campaign quest log as a chronological list of rows (name + status badge + one-line description) via a single TanStack Query call to `trpc.quests.list`, with an empty state and semantic status-badge coloring. No player-edit controls (D-04). This is the player-facing surface that 06-06 (CampaignViewScreen wiring) mounts.

## What Was Built

**Task 1 — QuestsTab component (rows, status badges, empty state)** (commit `1dbfa8e`)
- `src/renderer/src/components/QuestsTab.tsx` exporting `QuestsTab({ campaignId }: { campaignId: string })`.
- `questsQuery = useQuery({ queryKey: ['quests','list',campaignId], queryFn: () => trpc.quests.list.query({ campaignId }), enabled: !!campaignId })`, with `const quests = questsQuery.data ?? []`. No loading spinner (TanStack returns `[]` before data).
- Container `<div className="h-full flex flex-col overflow-hidden">` wrapping `<ScrollArea className="flex-1">` with an inner `<div className="flex flex-col gap-2 p-3">` — verbatim per UI-SPEC §S2.
- `QuestRow`: `bg-card border border-border rounded-lg px-3 py-2 flex items-start gap-3`; name as `text-sm font-semibold text-foreground truncate`; `<Badge variant="outline" className={cn('text-xs font-semibold shrink-0', questStatusColor(quest.status))}>{quest.status}</Badge>`; description as `<p className="text-xs text-muted-foreground leading-[1.4]">` rendered only when present.
- `questStatusColor(status)` helper verbatim from UI-SPEC §S2: Active → `text-green-400 border-green-400`, Completed → `text-muted-foreground border-border`, Failed → `text-red-400 border-red-400`, default → muted.
- `QuestsEmptyState` per UI-SPEC §S2a: centered column, `<ScrollText className="h-8 w-8 text-muted-foreground/40 mb-2" />`, heading "No quests yet", body "Quests will appear here as the story unfolds and the DM introduces them."
- Quest element type derived from the proxy client: `type Quest = Awaited<ReturnType<typeof trpc.quests.list.query>>[number]` — no main-process schema import.
- Fully read-only: rendered as React text nodes (`{quest.name}`, `{quest.description}`), no `dangerouslySetInnerHTML`, static Tailwind classNames (T-06-04-01 mitigated).

## Verification

- `npx tsc --noEmit -p tsconfig.json` → **0 errors in QuestsTab.tsx**. (Plan specified `tsconfig.web.json`, which does not exist in this single-tsconfig project — used `tsconfig.json`, same Rule 3 deviation waves 1 and 2 recorded.) The only project-wide errors are pre-existing in `src/main/ai/llmProvider.ts` and `src/renderer/src/screens/CampaignViewScreen.tsx` — both out-of-scope and logged by Wave 1's `deferred-items.md`; untouched here.
- `grep -cE "<button|<input|\.mutate\(|useMutation|dangerouslySetInnerHTML" QuestsTab.tsx` → **0** (read-only constraint + XSS mitigation confirmed).
- Empty-state strings "No quests yet" and "Quests will appear here as the story unfolds and the DM introduces them." present; `ScrollText` imported from lucide-react; `Badge` imported from `ui/badge`; `questStatusColor` maps Active→green / Completed→muted / Failed→red.

## Deviations from Plan

### Auto-fixed / Adjusted

**1. [Rule 3 — Blocking config] Plan verify command referenced a non-existent `tsconfig.web.json`**
- **Found during:** Task 1 verification.
- **Issue:** The plan's `<automated>` verify was `npx tsc --noEmit -p tsconfig.web.json`. This project ships a single unified `tsconfig.json`; `tsconfig.web.json` is absent (would error TS5058).
- **Fix:** Ran `npx tsc --noEmit -p tsconfig.json` (the project typecheck target) and confirmed 0 errors in QuestsTab.tsx. Consistent with the 06-01 and 06-02 summaries.
- **Files modified:** none (tooling adjustment).
- **Commit:** n/a.

## Deferred Issues

None introduced by this plan. Pre-existing typecheck errors in `src/main/ai/llmProvider.ts` and `src/renderer/src/screens/CampaignViewScreen.tsx` remain out of scope (logged by Wave 1's `deferred-items.md` and noted in 06-02-SUMMARY.md). `CampaignViewScreen.tsx` is the integration point for 06-06, which will mount QuestsTab and is the appropriate place to address its pre-existing mutation-payload typing.

## Known Stubs

None. QuestsTab is a complete, fully-wired consumer of the live `trpc.quests.list` router (delivered in 06-02). It receives real quest data; the only reason a deployed instance shows the empty state is that the AI has not yet called `addQuest` — which is correct runtime behavior, not a stub. Tab mounting (06-06) is a downstream wiring boundary, not a stub in this component.

## Threat Flags

None. All surface is covered by the plan's `<threat_model>`: AI-generated quest name/description rendered as React text nodes with static classNames and no `dangerouslySetInnerHTML` (T-06-04-01 mitigated); arbitrary list length handled by ScrollArea (T-06-04-02 accepted, single-user local); no new packages (T-06-04-SC — uses existing Badge, ScrollArea, lucide ScrollText).

## Self-Check: PASSED

- src/renderer/src/components/QuestsTab.tsx — FOUND
- Commit 1dbfa8e (Task 1) — FOUND
