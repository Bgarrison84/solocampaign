---
phase: 06-quests-npcs-world-state
plan: 02
subsystem: ai-mutation-contract
tags: [ai-tools, zod, mutation-pipeline, trpc, world-state, quests, npcs, factions, inspiration]
requires:
  - "06-01: quests/npcs/factions tables + Quest/Npc/Faction types + world-state columns on campaigns + questsRepo/npcsRepo/factionsRepo"
  - "Phase 5: PHASE5_TOOLS, applyOneTool switch, MutationChip type, streamText tools option in index.ts"
provides:
  - "8 Phase 6 Zod schemas + PHASE6_TOOLS (8) + ALL_TOOLS (20) in toolSchemas.ts"
  - "8 mutationPipeline applyOneTool cases (addQuest/updateQuestStatus/addNpc/updateNpc/updateFaction/updateWorldTime/updateLocation/awardInspiration)"
  - "campaignsRepo.updateWorldTime / updateLocation / getWorldState"
  - "quests/npcs/worldState/factions tRPC routers registered in router.ts"
  - "streamText now receives ALL_TOOLS (Pitfall 2 closed)"
affects:
  - "Wave 2 contextBuilder: reads campaignsRepo.getWorldState for world-state injection"
  - "Wave 3 UI: QuestsTab (trpc.quests.list), NpcTrackerTab (trpc.npcs.list + trpc.factions.list), header (trpc.worldState.get); MutationChipStack consumes quest/quest_complete/npc/inspiration chip types"
tech-stack:
  added: []
  patterns:
    - "Extend (never replace) PHASE5_TOOLS; ALL_TOOLS = { ...PHASE5_TOOLS, ...PHASE6_TOOLS }"
    - "safeParse -> silent guard -> repo call -> conditional chip -> logEvent per pipeline case (D-06 silent isolation)"
    - "D-16 chip-vs-silent matrix: addQuest/addNpc/awardInspiration chip; quest_complete only on Completed; updateNpc/updateFaction/updateWorldTime/updateLocation silent"
    - "Pitfall 7 fallback: awardInspiration verifies characterId has a characterResources row, else resolvePlayerCharacterId(campaignId)"
    - "Tool-arg IDs as z.string() (not .uuid()) to avoid silent drops on AI-echoed IDs"
key-files:
  created:
    - src/main/trpc/routers/quests.ts
    - src/main/trpc/routers/npcs.ts
    - src/main/trpc/routers/worldState.ts
  modified:
    - src/main/ai/toolSchemas.ts
    - src/main/ai/toolSchemas.test.ts
    - src/main/ai/mutationPipeline.ts
    - src/main/ai/mutationPipeline.test.ts
    - src/main/db/campaignsRepo.ts
    - src/main/index.ts
    - src/main/trpc/router.ts
decisions:
  - "World-state writes live on campaignsRepo (updateWorldTime/updateLocation/getWorldState) — campaigns already owns those columns (RESEARCH Open Question 1)"
  - "Standalone factionsRouter registered as top-level `factions` key (in addition to worldState.factions) so trpc.factions.list resolves for the UI-SPEC NpcTrackerTab"
  - "Tool-arg IDs are z.string() not z.string().uuid() — repos store randomUUID text but the AI echoes IDs from the world-state summary; a uuid guard would silently drop valid references (safeParse failure is silent, D-06). Matches Phase 5 characterId convention"
metrics:
  duration: ~40min
  tasks: 3
  files: 10
  completed: 2026-05-30
---

# Phase 6 Plan 02: AI Mutation Contract Extension Summary

Wave-2 end-to-end wiring of the 8 Phase 6 world-state tools: bounded Zod schemas + `tool()` registrations combined into `ALL_TOOLS` (20 tools), 8 new `mutationPipeline` switch cases with the D-16 chip/silent matrix, world-state write methods on `campaignsRepo`, and three new tRPC routers (quests/npcs/worldState/factions) registered in `router.ts`. The critical `streamText` swap from `PHASE5_TOOLS` to `ALL_TOOLS` closes Pitfall 2 — the AI is now actually offered the Phase 6 tools.

## What Was Built

**Task 1 — 8 Phase 6 Zod schemas + PHASE6_TOOLS + ALL_TOOLS** (commit `92e8016`)
- Appended to `toolSchemas.ts` (PHASE5_TOOLS untouched): `addQuestSchema`, `updateQuestStatusSchema`, `addNpcSchema`, `updateNpcSchema`, `updateFactionSchema`, `updateWorldTimeSchema`, `updateLocationSchema`, `awardInspirationSchema` with T-06-02-01 bounds (name max 200, description max 500/300, path 1-10 segments × max 100, dayNumber int 1-99999, closed enums for status/relationship/tier/timeOfDay/season). IDs are `z.string()` per the plan (avoids silent drops).
- 8 `tool({ description, inputSchema })` registrations — NO execute property (D-04). Descriptions follow D-14 semantics.
- `PHASE6_TOOLS` (8 keys) and `ALL_TOOLS = { ...PHASE5_TOOLS, ...PHASE6_TOOLS }` (20 keys), both `as const satisfies ToolSet`.
- Extended `toolSchemas.test.ts`: per-schema valid + invalid case (empty quest name, dayNumber 0, bad status/tier/relationship enum, empty path), `PHASE6_TOOLS` length 8, `ALL_TOOLS` length 20, every Phase 5/6 key present, and no value has an `execute` property. **28 tests green** (8 original + 20 new).

**Task 2 — pipeline cases + world-state writes + ALL_TOOLS in streamText** (commit `555139d`)
- `campaignsRepo`: `updateWorldTime(campaignId, {timeOfDay,dayNumber,season})`, `updateLocation(campaignId, path[])` (JSON.stringify), `getWorldState(campaignId)` returning the four world columns.
- `mutationPipeline.ts`: extended `MutationChip` union with `'quest' | 'quest_complete' | 'npc' | 'inspiration'`; imported the 8 schemas + questsRepo/npcsRepo/factionsRepo/campaignsRepo; added 8 `applyOneTool` cases following the safeParse→guard→repo→chip→logEvent pattern. Chip rules per D-16: addQuest → `quest`; updateQuestStatus → `quest_complete` ONLY on `Completed` (Failed/Active silent, D-05); addNpc → `npc`; updateNpc/updateFaction/updateWorldTime/updateLocation → silent. awardInspiration verifies the supplied `characterId` has a `characterResources` row and falls back to `resolvePlayerCharacterId(campaignId)` if not (Pitfall 7), then flips `hasInspiration=true` + `inspiration` chip. All cases call `logEvent` (quest_added, quest_status_changed, npc_added, npc_updated, faction_updated, world_time_updated, location_updated, inspiration_awarded). All callees remain synchronous (WR-07).
- `index.ts`: import + streamText option swapped `PHASE5_TOOLS` → `ALL_TOOLS`. `grep "tools: PHASE5_TOOLS" src/main/` → **no production matches** (Pitfall 2 closed).
- Extended `mutationPipeline.test.ts` with all 8 behaviors (quest create/status, npc create+silent patch with field preservation, faction upsert idempotency, world-time columns, location JSON, inspiration flip + unknown-id fallback).

**Task 3 — quests/npcs/worldState/factions tRPC routers** (commit `4591e14`)
- `quests.ts` (`list`), `npcs.ts` (`list`), `worldState.ts` (`get` + `factions`, plus a standalone `factionsRouter` with `list`). All inputs validated with `campaignIdSchema` (V5, T-06-02-05).
- `router.ts`: imported and registered `quests`, `npcs`, `worldState`, and top-level `factions` keys (Pitfall 1 closed). The top-level `factions` key keeps `trpc.factions.list.query({ campaignId })` resolving for the UI-SPEC NpcTrackerTab.

## Verification

- `npx vitest run src/main/ai/toolSchemas.test.ts` → **28 passed, exit 0** (no SQLite dependency).
- `npx tsc --noEmit -p tsconfig.json` → **0 errors in all plan files** (toolSchemas, mutationPipeline, campaignsRepo, index.ts, quests/npcs/worldState routers, router.ts). The only project-wide errors are in `src/main/ai/llmProvider.ts` and `src/renderer/src/screens/CampaignViewScreen.tsx` — both pre-existing and out-of-scope (logged by Wave 1's `deferred-items.md`, untouched here).
- `grep -rn "tools: PHASE5_TOOLS" src/main/` → **no production matches** (only the export definition and test file reference the name).
- The 6 DB-write behaviors the `mutationPipeline.test.ts` Phase 6 tests assert (addQuest Active status, updateQuestStatus, updateNpc partial patch with field preservation, updateFaction upsert idempotency, updateWorldTime columns, updateLocation JSON path) were verified ABI-independently via Node's built-in `node:sqlite` against the real migrations — **6/6 PASS**. The `has_inspiration` column was confirmed present (INTEGER) for the awardInspiration target.

NOTE: the plan's Task 3 `<automated>` verify referenced `tsconfig.node.json`, which does not exist in this project (single unified `tsconfig.json`). Used `tsconfig.json` — same Rule 3 deviation Wave 1 (06-01) recorded.

## Deviations from Plan

### Auto-fixed / Adjusted

**1. [Rule 3 — Blocking config] Plan verify command referenced a non-existent `tsconfig.node.json`**
- **Found during:** Task 3 verification.
- **Issue:** The plan's Task 3 `<automated>` verify was `npx tsc --noEmit -p tsconfig.node.json`. This project ships a single unified `tsconfig.json`; `tsconfig.node.json` is absent (errors TS5058).
- **Fix:** Ran `npx tsc --noEmit -p tsconfig.json` (the `npm run typecheck` target) — covers all main-process source and the routers. Confirmed 0 errors in plan files. Consistent with the 06-01 summary.
- **Files modified:** none (tooling adjustment).
- **Commit:** n/a.

## Deferred Issues

**better-sqlite3 ABI mismatch blocks SQLite-backed vitest execution (pre-existing, environment-level).**
- The shared `node_modules/better-sqlite3` (resolved from the main repo) is compiled for Electron's ABI (NODE_MODULE_VERSION 145), while the worktree's vitest runs under system Node (ABI 137). Every SQLite-backed test in the repo fails with the `NODE_MODULE_VERSION 145 ... requires 137` error — including pre-existing Phase 5 tests. This is NOT introduced by this plan; it is the same issue 06-01 logged.
- Not fixed here: rebuilding the shared native module for Node would break the main repo's Electron runtime and is out of scope (also not a permitted package operation).
- **Mitigation applied:** verified all 6 DB-write behaviors via Node's built-in `node:sqlite` (ABI-independent) against the real migration SQL — addQuest/updateQuestStatus/updateNpc-patch/updateFaction-upsert/updateWorldTime/updateLocation all PASS; `has_inspiration` column confirmed. The `toolSchemas.test.ts` suite (no SQLite) runs green in vitest.
- **Action for orchestrator/verifier:** re-run `npm run test -- --run src/main/ai/mutationPipeline.test.ts` after `npm run rebuild:sqlite` (electron-rebuild against the test runtime) to capture the formal green run. The Phase 6 pipeline tests are real PASS-on-implementation assertions.

## Known Stubs

None. All 8 pipeline cases, the three world-state repo methods, and the four tRPC routers are fully implemented and exercise real DB paths. World-state context injection (contextBuilder) and the UI tabs/chips that consume these routers/chip types are Wave 2/3 boundaries, not stubs.

## Threat Flags

None. All new surface is covered by the plan's `<threat_model>`: tool args bounded by Zod (T-06-02-01), fake-UUID updates silently affect 0 rows (T-06-02-02), awardInspiration fallback (T-06-02-03), location JSON stored via JSON.stringify (T-06-02-04), tRPC inputs validated with campaignIdSchema (T-06-02-05). No new packages (T-06-02-SC).

## Self-Check: PASSED

- src/main/ai/toolSchemas.ts (PHASE6_TOOLS + ALL_TOOLS) — FOUND
- src/main/ai/toolSchemas.test.ts (28 tests) — FOUND
- src/main/ai/mutationPipeline.ts (8 cases + extended MutationChip) — FOUND
- src/main/ai/mutationPipeline.test.ts (8 Phase 6 behaviors) — FOUND
- src/main/db/campaignsRepo.ts (updateWorldTime/updateLocation/getWorldState) — FOUND
- src/main/index.ts (tools: ALL_TOOLS) — FOUND
- src/main/trpc/routers/quests.ts — FOUND
- src/main/trpc/routers/npcs.ts — FOUND
- src/main/trpc/routers/worldState.ts — FOUND
- src/main/trpc/router.ts (quests/npcs/worldState/factions registered) — FOUND
- Commit 92e8016 (Task 1) — FOUND
- Commit 555139d (Task 2) — FOUND
- Commit 4591e14 (Task 3) — FOUND
