---
phase: 05-rules-engine-dice-combat
plan: 07
subsystem: ui, trpc, database
tags: [mutation-chips, toast, cache-invalidation, permadeath, tanstack-query, ipc, shadcn]

# Dependency graph
requires:
  - phase: 05-02
    provides: "mutationPipeline.ts MutationChip type; ai:mutations-applied IPC event; applyMutationBatch"
  - phase: 05-03
    provides: "CampaignViewScreen Tabs region + right-panel flex column"
  - phase: 05-06
    provides: "window.aiStream.onMutationsApplied preload bridge"
provides:
  - "MutationChipStack: live chip overlay driven by ai:mutations-applied (D-07, §S6)"
  - "campaigns.setPermadeath tRPC procedure + campaignsRepo.setPermadeath (PROG-04)"
  - "AiSettingsModal: permadeath checkbox pre-filled + persisted on Save (PROG-04)"
  - "CampaignViewScreen: MutationChipStack mounted + ai:mutations-applied cache invalidation"
  - "electron.vite.config.ts: Vite resolve alias for shadcn absolute import paths (build fix)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MutationChipStack uses local useState<DisplayChip[]> + setTimeout auto-remove pattern"
    - "Both MutationChipStack and CampaignViewScreen listen to ai:mutations-applied independently — chip display vs. cache invalidation separation"
    - "Vite resolve.alias for 'src/renderer/src' maps tsconfig baseUrl absolute imports for Rollup"

key-files:
  created:
    - src/renderer/src/components/MutationChipStack.tsx
  modified:
    - src/main/db/campaignsRepo.ts
    - src/main/trpc/routers/campaigns.ts
    - src/renderer/src/components/AiSettingsModal.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - electron.vite.config.ts

key-decisions:
  - "MutationChipStack returns null when chips is empty — no DOM node when idle"
  - "MutationChipStack placed as sibling after TabsList (not inside it), with 'relative' added to Tabs flex container so 'absolute top-0' anchors correctly"
  - "setPermadeath is a dedicated procedure (not extending updateAiConfig) — keeps diff small and Zod validation explicit"
  - "setPermadeathMutation fires alongside updateAiConfigMutation on Save — both mutations fire; isSaving covers both to prevent double-submit"
  - "Vite resolve alias added to electron.vite.config.ts renderer block — resolves pre-existing shadcn absolute import failures in Rollup production build"

requirements-completed: [PROG-04, STATE-05]

# Metrics
duration: 7min
completed: 2026-05-29
---

# Phase 5 Plan 07: Wave 5 Integration — Mutation Chips + Permadeath Toggle Summary

**One-liner:** Live mutation chip overlay (hp/xp/condition/slot/currency/combat chips driven by ai:mutations-applied IPC), ai:mutations-applied cache invalidation wiring all prior-wave UIs, and permadeath toggle persisting campaigns.permadeathMode.

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-29T19:15:51Z
- **Completed:** 2026-05-29T19:22:~00Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

### Task 1: MutationChipStack component

`src/renderer/src/components/MutationChipStack.tsx` (151 lines):
- Subscribes to `window.aiStream.onMutationsApplied` on mount
- Maintains `DisplayChip[]` state; pushes each incoming chip, caps at 4 visible (FIFO), auto-removes via `setTimeout` at 4000ms
- Renders absolute/pointer-events-none container (`top-0 left-0 right-0 z-50`); each chip is `role="status" aria-live="polite"` pill
- `iconFor(type, label)` maps all 7 mutation types to lucide icons with correct colors per UI-SPEC §S6 table: hp damage=ArrowDown red, hp heal=ArrowUp green, xp=Star amber, condition applied=AlertCircle amber, condition removed=CheckCircle green, slot used=Zap sky, slot restored=RotateCcw muted, currency=Coins amber, combat addCombatant=UserPlus muted, other combat/rest=Shield muted

### Task 2: Permadeath toggle — PROG-04

- `campaignsRepo.setPermadeath(campaignId, value)` — synchronous Drizzle update of `permadeath_mode` boolean column
- `campaigns.setPermadeath` tRPC procedure with Zod validation: `campaignId: campaignIdSchema` (uuid) + `permadeathMode: z.boolean()` (T-05-07-01)
- `AiSettingsModal`: `permadeath` state pre-filled from `campaign.permadeathMode` in existing pre-fill `useEffect`; "Permadeath mode" `<Checkbox>` with label + muted description ("When enabled, a character that dies cannot be revived."); `setPermadeathMutation` fires on Save alongside `updateAiConfigMutation`; `isSaving` covers both mutations

### Task 3: CampaignViewScreen wiring

- `<MutationChipStack />` imported and rendered as a sibling between `<TabsList>` and the first `<TabsContent>` inside the right-panel `<Tabs>` element; `className="... relative"` added to Tabs so the chip stack's `absolute top-0` anchors correctly
- `useEffect` subscribes to `window.aiStream.onMutationsApplied` and when `payload.campaignId === id` invalidates three TanStack Query caches: `['combat','listActive',id]`, `['characters','getByCampaignId',id]`, `['ai','getMessages',id]` — so combat tracker, character sheet, and message list all refetch after AI mutations without manual refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: MutationChipStack** - `35d23ad` (feat)
2. **Task 2: permadeath toggle + AiSettingsModal** - `f01be1c` (feat)
3. **Task 3: CampaignViewScreen wiring + Vite alias fix** - `3e9b640` (feat)

_Plan metadata commit (this SUMMARY) follows separately._

## Files Created/Modified

- `src/renderer/src/components/MutationChipStack.tsx` — created (151 lines)
- `src/main/db/campaignsRepo.ts` — added `setPermadeath` method
- `src/main/trpc/routers/campaigns.ts` — added `setPermadeath` procedure
- `src/renderer/src/components/AiSettingsModal.tsx` — permadeath state + checkbox + mutation
- `src/renderer/src/screens/CampaignViewScreen.tsx` — MutationChipStack mount + cache invalidation useEffect
- `electron.vite.config.ts` — Vite resolve alias for shadcn absolute imports

## Decisions Made

- `setPermadeath` is a dedicated tRPC procedure rather than extending `updateAiConfig` — avoids modifying the existing secure API key handling path, keeps Zod schema explicit per T-05-07-01.
- Both `MutationChipStack` and the `CampaignViewScreen` cache-invalidation `useEffect` listen to `ai:mutations-applied` independently — they have different responsibilities (display vs. data refresh) and `ipcRenderer.on` safely supports multiple listeners for the same channel.
- `MutationChipStack` returns `null` when `chips.length === 0` to produce zero DOM overhead when idle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bug] Vite resolve alias for shadcn absolute import paths**
- **Found during:** Task 3 (`npm run build` verification)
- **Issue:** `ui/tooltip.tsx`, `ui/checkbox.tsx`, `ui/textarea.tsx` use `import { cn } from "src/renderer/src/lib/utils"` — an absolute path that TypeScript resolves via `tsconfig.json` `baseUrl: "."` but Rollup (Vite production build) does not resolve. Build errored: `Rollup failed to resolve import "src/renderer/src/lib/utils"`.
- **Fix:** Added `resolve.alias: { 'src/renderer/src': resolve('src/renderer/src') }` to the renderer block of `electron.vite.config.ts`. This maps the absolute-path import to the physical directory, matching what tsconfig's `baseUrl` does at typecheck time.
- **Files modified:** `electron.vite.config.ts`
- **Commit:** `3e9b640`
- **Verification:** `npm run build` Vite renderer bundle succeeded — 3,205 modules transformed, built in 5.00s.

---

**Total deviations:** 1 auto-fixed (Rule 3 — pre-existing build blocker in shadcn UI files). No architectural changes, no scope creep.

## Known Stubs

None — all chip types are wired to real IPC events from 05-02's mutation pipeline. The chip display is driven by real AI mutations, not mock data.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced beyond the plan's threat model (T-05-07-01 through T-05-07-SC). The `setPermadeath` procedure validates campaignId as UUID and permadeathMode as boolean; the renderer-driven cache invalidation from `ai:mutations-applied` triggers only TanStack Query refetches (no DB writes).

## Self-Check: PASSED

- FOUND: `src/renderer/src/components/MutationChipStack.tsx`
- FOUND: `src/main/db/campaignsRepo.ts` contains `setPermadeath`
- FOUND: `src/main/trpc/routers/campaigns.ts` contains `permadeath`
- FOUND: `src/renderer/src/components/AiSettingsModal.tsx` contains `permadeath`
- FOUND: `src/renderer/src/screens/CampaignViewScreen.tsx` contains `MutationChipStack`
- Commits: 35d23ad, f01be1c, 3e9b640 — all in git log
- `npm run typecheck` exits 0
- `npm run build` Vite bundle succeeded (3,205 modules)
