---
phase: 05-rules-engine-dice-combat
plan: 03
subsystem: ui
tags: [combat, zustand, trpc, tanstack-query, react, drizzle, sqlite, initiative]

# Dependency graph
requires:
  - phase: 05-01
    provides: combatants table + combatantsRepo (create/listActive/updateHp/updateConditions/endCombat), campaign_events table + campaignEventsRepo
  - phase: 05-02
    provides: AI addCombatant/updateHp tool + mutation pipeline writing the same combatants rows this UI reads
provides:
  - "combatStore (Zustand): combat lifecycle state + controlled right-panel activeTab driving D-17 auto-switch"
  - "combat tRPC router (registered): listActive, startCombat, endCombat, updateHp, updateConditions, addCombatant — all Zod-validated, all state changes logged to campaign_events"
  - "CombatTrackerTab: empty state + sorted initiative list with HP bars, condition badges, expandable HP stepper + condition picker, Add Combatant form"
  - "CampaignViewScreen controlled Tabs + Start/End Combat header buttons"
  - "shadcn-equivalent Progress + Badge ui primitives (no Radix/npm install)"
affects: [05-04, 05-05, 05-06, 05-07, dice-roller, spells, rest, toast]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled shadcn Tabs driven by a Zustand store value so a header action can switch the active tab cross-component (D-17)"
    - "Optimistic onMutate/onError/onSettled mutation triple operating on a combatants array cache (queryKey ['combat','listActive',campaignId])"
    - "Poll active list via refetchInterval gated on isCombatActive (2s during combat, off otherwise)"
    - "JSON.parse guard on conditions column (default [] on malformed rows) at the render boundary"

key-files:
  created:
    - src/renderer/src/stores/combatStore.ts
    - src/main/trpc/routers/combat.ts
    - src/renderer/src/components/CombatTrackerTab.tsx
    - src/renderer/src/components/ui/progress.tsx
    - src/renderer/src/components/ui/badge.tsx
  modified:
    - src/main/trpc/router.ts
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - src/renderer/src/components/ui/scroll-area.tsx

key-decisions:
  - "Hand-wrote Progress (CSS, no Radix dep) and Badge (cva) instead of running npx shadcn add — avoids a network install in the worktree and keeps to first-party-only per T-05-03-SC; Progress exposes indicatorClassName for semantic HP colors"
  - "Manual Add Combatant rows use the entered initiative value as initiativeOrder so they sort by their roll (no separate ordering input)"
  - "endCombat does NOT reset activeTab — player stays on the Combat tab per UI-SPEC S1"

patterns-established:
  - "Store-controlled Tabs pattern: activeTab + setActiveTab live in combatStore, <Tabs value=/onValueChange=> consumes them"
  - "Combatant-array optimistic cache updates keyed on combatant.id"

requirements-completed: [COMB-02, COMB-04]

# Metrics
duration: 8min
completed: 2026-05-29
---

# Phase 05 Plan 03: Combat Tracker Tab Summary

**Live initiative tracker — Start Combat auto-switches the right panel to a sorted combatant list with semantic HP bars, condition badges, expandable HP stepper + condition picker, and a player Add Combatant form, all backed by a Zod-validated combat tRPC router that logs every state change to campaign_events.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-29T13:49:57Z
- **Completed:** 2026-05-29T13:58:26Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- combatStore drives both combat lifecycle state and the controlled right-panel activeTab (D-17): startCombat sets isCombatActive + activeCampaignId + activeTab='combat-tracker'
- combat tRPC router registered with 6 Zod-validated procedures; combat_started / combat_ended / combatant_added all logged to campaign_events
- CombatTrackerTab renders the empty state and the live initiative list (COMB-02) with expandable HP stepper + condition picker wired to optimistic mutations (COMB-04 manual half) plus a player Add Combatant form
- CampaignViewScreen Tabs converted to controlled; Start/End Combat header buttons added; combat-tracker placeholder replaced with the real tab

## Task Commits

Each task was committed atomically:

1. **Task 1: combatStore + combat tRPC router + registration** - `bd2472c` (feat)
2. **Task 2: CombatTrackerTab component** - `3061a6c` (feat)
3. **Task 3: CampaignViewScreen controlled Tabs + Start/End Combat buttons** - `edbc5c2` (feat)

## Files Created/Modified
- `src/renderer/src/stores/combatStore.ts` (created) - Zustand combat state + controlled activeTab; startCombat/endCombat/setCurrentTurn/setActiveTab
- `src/main/trpc/routers/combat.ts` (created) - combat router: listActive/startCombat/endCombat/updateHp/updateConditions/addCombatant; campaign_events logging
- `src/renderer/src/components/CombatTrackerTab.tsx` (created) - empty state + initiative list, Collapsible rows, HP bar/colors, condition badges, HP stepper + ConditionBadge picker, Add Combatant form, optimistic mutations
- `src/renderer/src/components/ui/progress.tsx` (created) - shadcn-equivalent progress bar with indicatorClassName for semantic HP fill colors
- `src/renderer/src/components/ui/badge.tsx` (created) - shadcn-equivalent cva Badge (used for read-only condition chips)
- `src/main/trpc/router.ts` (modified) - registered `combat: combatRouter` alphabetically
- `src/renderer/src/screens/CampaignViewScreen.tsx` (modified) - controlled Tabs, Start/End Combat buttons, mounted CombatTrackerTab
- `src/renderer/src/components/ui/scroll-area.tsx` (modified) - fixed unresolved `@/lib/utils` import to relative path (see Deviations)

## Decisions Made
- Hand-wrote Progress and Badge as first-party shadcn-equivalents rather than running `npx shadcn@latest add progress badge`. The plan permitted the shadcn add, but `@radix-ui/react-progress` is not installed and a network install inside the parallel worktree is avoidable: Progress is a pure-CSS div (no Radix dependency) and Badge uses the already-present `class-variance-authority`. This satisfies T-05-03-SC (first-party only, no third-party registry) with zero new npm packages.
- Manual combatant rows use the entered initiative as `initiativeOrder` so they sort by their roll.
- `endCombat()` intentionally leaves `activeTab` on the Combat tab (UI-SPEC S1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed unresolved `@/lib/utils` import in scroll-area.tsx**
- **Found during:** Task 1 (typecheck verification)
- **Issue:** `src/renderer/src/components/ui/scroll-area.tsx` (committed in 05-04 prep, commit 8b0a1e5) imports `cn` from `@/lib/utils`, but this worktree's `tsconfig.json` only defines a `~/*` path alias — no `@/*` alias — so `tsc --noEmit` reported `TS2307: Cannot find module '@/lib/utils'`. This blocked the plan's `npm run typecheck` verification gate, and Task 2 (CombatTrackerTab) imports `ScrollArea` from this module.
- **Fix:** Changed the import to the relative `../../lib/utils` path used by every other ui component in the repo (button.tsx, input.tsx, tabs.tsx, etc.). This is the same resolution the main-repo's uncommitted tsconfig edit was working around, applied at the import site. Not a package install (Rule 3 install exclusion does not apply — no package added).
- **Files modified:** src/renderer/src/components/ui/scroll-area.tsx
- **Verification:** `npm run typecheck` exits 0 after the change.
- **Committed in:** bd2472c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to satisfy the typecheck verification gate and to let CombatTrackerTab consume ScrollArea. No scope creep — single-line import correction matching established repo convention.

## Issues Encountered
- Required shadcn `progress` and `badge` components were not present and their Radix dependency (`@radix-ui/react-progress`) was not installed. Resolved by writing first-party equivalents (see Decisions) rather than a network install, keeping the worktree hermetic and compliant with T-05-03-SC.
- Repo-wide biome lint reports pre-existing formatting differences (296 errors across 154 files, including files untouched by this plan and the existing sessionStore.ts/ResourcesSection.tsx). New files match the established neighbor-file style (2-space indent, no semicolons). Lint is not a plan verification gate and no pre-commit hook enforces it; typecheck (the gate) is green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Combat plumbing (combatants + activeTab + controlled Tabs + 2s poll) is in place for downstream Wave plans: dice chips (05-04), spells (05-05), level-up/rest (05-06), toast/integration (05-07) read against the same combatants and activeTab plumbing.
- AI-driven addCombatant/updateHp reliability remains a phase-exit UAT item (live LLM) per the plan's verification note.
- `currentTurnOrder` is wired into the active-turn row highlight but no UI sets it yet (AI controls turn pacing per D-13); future AI turn-advance will set it via combatStore.setCurrentTurn.

## Self-Check: PASSED

All 5 created source files + the SUMMARY exist on disk; all 3 task commits (bd2472c, 3061a6c, edbc5c2) found in git log.

---
*Phase: 05-rules-engine-dice-combat*
*Completed: 2026-05-29*
