---
phase: 06-quests-npcs-world-state
plan: 07
subsystem: phase-closeout
tags: [integration, verification, typecheck, pitfall-sweep, chip-reconciliation, human-uat]
requires:
  - "06-01: quests/npcs/factions tables + world-state columns + repos"
  - "06-02: 8 Phase 6 tools (ALL_TOOLS) + mutationPipeline cases + tRPC routers"
  - "06-03: contextBuilder world-state injection + toolDescriptionsBlock"
  - "06-04: QuestsTab"
  - "06-05: NpcTrackerTab + MutationChipStack chip types"
  - "06-06: CampaignViewScreen wiring (Quests tab, NpcTrackerTab mount, WorldStateBar, cache invalidation)"
provides:
  - "Full Phase 6 integration sweep: all 7 RESEARCH pitfalls verified closed"
  - "Green project typecheck (npx tsc --noEmit exits 0) — 7 pre-existing errors resolved"
  - "main↔renderer chip-type string reconciliation (quest/quest_complete/npc/inspiration)"
  - "Blocking human-verify checkpoint for the live end-to-end Phase 6 flow"
affects:
  - "Phase 6 close-out — gates the phase on automated green + human UAT sign-off"
tech-stack:
  added: []
  patterns:
    - "Named global payload type (MutationsAppliedPayload) instead of Parameters<typeof cb>[0] unwrap"
    - "AI SDK toolCalls union narrowing with 'args' in tc guard (TypedToolCall vs DynamicToolCall)"
key-files:
  created:
    - .planning/phases/06-quests-npcs-world-state/06-07-SUMMARY.md
  modified:
    - src/renderer/src/types/aiStream.d.ts
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - src/main/ai/llmProvider.ts
decisions:
  - "Typecheck run via `npx tsc --noEmit` (single unified tsconfig.json) — the plan's tsconfig.node.json / tsconfig.web.json do not exist (same Rule 3 tooling deviation recorded by all six prior waves 01–06)"
  - "Did NOT rebuild better-sqlite3 to ABI 137 to green the SQLite-backed tests: that would recompile the SHARED node_modules binary away from Electron's ABI 145 and break `npm run dev` — the exact runtime the immediately-following human-verify checkpoint requires"
  - "Fixed the 7 pre-existing typecheck errors (2 of them in the Phase 6 seam file CampaignViewScreen.tsx) as Rule 1/3 — they blocked the plan's green-typecheck acceptance criterion and the onMutationsApplied bug sat directly in the Phase 6 cache-invalidation handler (Pitfall 3)"
metrics:
  duration: ~25min
  tasks: 2
  files: 3
  completed: 2026-05-30
---

# Phase 6 Plan 07: Integration Sweep + End-to-End Verification Summary

Phase 6 close-out. Ran the full automated gate (typecheck + test suite), swept the diffs from
plans 01–06 against the 7 RESEARCH "Common Pitfalls" (all verified closed), reconciled the four
Phase 6 mutation-chip type strings across the main↔renderer boundary, fixed the project typecheck
to fully green (resolving 7 pre-existing errors, 2 of them sitting inside the Phase 6 integration
seam), and reached the single blocking human-verify checkpoint for the live UI/AI flow that cannot
be automated.

## What Was Built / Verified

**Task 1 — Full-suite run + integration bug sweep** (commit `8c22be1`)

### Automated gate
- **`npx tsc --noEmit` (single unified tsconfig.json)** → **exits 0** after the fixes below. The plan's
  acceptance criteria reference `tsconfig.node.json` and `tsconfig.web.json`; neither exists in this
  repo (it ships one unified `tsconfig.json`, the `npm run typecheck` target). This is the identical
  Rule 3 tooling deviation that waves 01–06 each recorded.
- **`npx vitest run`** → 191 passed / 94 failed / 29 todo. **All 94 failures are the single pre-existing,
  environment-level `better-sqlite3` ABI mismatch** (`NODE_MODULE_VERSION 145` [Electron] vs `137`
  [system Node v24.15.0 that vitest runs under]). Every failure dies at `new Database(':memory:')`;
  106 occurrences of each side of the error message confirm a single root cause. The non-SQLite suites
  are green — verified directly: `toolSchemas.test.ts` (28) + `contextBuilder.test.ts` (33) = **61 passed**.
  This is the same blocker documented in 06-01, 06-02, and 06-06; it is the `@electron/rebuild` step
  noted in CLAUDE.md, not a logic regression.

### 7 RESEARCH pitfalls — all verified CLOSED
1. **Routers registered** (`router.ts`): `factions`, `npcs`, `quests`, `worldState` all imported and
   registered. ✓
2. **`tools: ALL_TOOLS` in streamText** (`index.ts:368`): zero production `PHASE5_TOOLS` references —
   `PHASE5_TOOLS` appears only as the export definition (`toolSchemas.ts:190`) and in `toolSchemas.test.ts`.
   `grep "tools: PHASE5_TOOLS" src/main/` → no matches. ✓
3. **Cache invalidation** (`CampaignViewScreen.tsx` cacheInvalidationHandler): invalidates
   `['quests','list',id]`, `['npcs','list',id]`, `['factions','list',id]`, `['campaigns','get',id]`
   (world-state), alongside the retained combat/characters/messages keys. ✓
4. **`worldLocationPath` JSON.parse guarded** at both read sites: `contextBuilder.ts:196`
   (try/catch + `Array.isArray` + `[]` fallback) and `CampaignViewScreen` `formatLocationPath`
   (try/catch + raw-string fallback). ✓
5. **Factions UNIQUE(campaign_id, name) + onConflictDoUpdate** (`factionsRepo.ts:26`). ✓
6. **toolDescriptionsBlock describes all 8 Phase 6 tools** (`contextBuilder.ts`): addQuest,
   updateQuestStatus, addNpc, updateNpc, updateFaction, updateWorldTime, updateLocation,
   awardInspiration — all named, plus the JSON-tail "Valid `toolName` values" line enumerates all 18. ✓
7. **awardInspiration `resolvePlayerCharacterId` fallback** (`mutationPipeline.ts:534`). ✓

### Chip-type string reconciliation (main ↔ renderer)
`mutationPipeline.ts` emits `type: 'quest'` (L415), `'quest_complete'` (L429), `'npc'` (L451),
`'inspiration'` (L540). The renderer `MutationChipStack` `ChipType` union (L48–51) declares exactly
`'quest' | 'quest_complete' | 'npc' | 'inspiration'`, each with a matching `iconFor` case. **Exact
match — no drift** (T-06-02-01 / T-06-05-03 closed).

## Task 2 — End-to-end human verification (BLOCKING CHECKPOINT — pending human UAT)

This is a verification-only `checkpoint:human-verify` (`gate="blocking"`). It cannot be executed by the
automated executor: it requires a human to run the Electron app (`npm run dev`) with a configured AI
provider and a live session, then drive a narration that introduces a quest, NPC, faction, advances
time, moves location, and rewards roleplay — visually confirming each of the five behaviors in
06-VALIDATION.md § Manual-Only Verifications. **The orchestrator/user must perform this UAT and record
the result.** See "Human Verification Checkpoint" below for the exact script.

## Deviations from Plan

### Auto-fixed (Rule 1 / Rule 3)

**1. [Rule 1 — Bug, in Phase 6 seam] `onMutationsApplied` payload type was the callback type, not the payload**
- **Found during:** Task 1 typecheck.
- **Issue:** `CampaignViewScreen.tsx` annotated both `shortRestHandler` and the Phase 6
  `cacheInvalidationHandler` with `Parameters<typeof window.aiStream.onMutationsApplied>[0]`. Since
  `onMutationsApplied(cb: (payload: P) => void)`, that expression resolves to the *callback type*
  `(payload: P) => void`, not `P` — producing 6 TS errors (TS2339 ×3, TS7006, TS2345 ×2) and meaning
  `payload.campaignId` / `payload.chips` were never actually typed. The `cacheInvalidationHandler` is
  the Phase 6 Pitfall-3 surface, so this sat squarely in the seam this plan owns.
- **Fix:** Added a named global `MutationsAppliedPayload` type in `aiStream.d.ts`; `onMutationsApplied`
  now references it, and both handlers annotate `payload: MutationsAppliedPayload` directly.
- **Files modified:** `src/renderer/src/types/aiStream.d.ts`, `src/renderer/src/screens/CampaignViewScreen.tsx`.
- **Commit:** `8c22be1`.

**2. [Rule 3 — Blocking the green-typecheck acceptance criterion] AI SDK toolCalls union narrowing in llmProvider.ts**
- **Found during:** Task 1 typecheck.
- **Issue:** `llmProvider.ts:181` read `tc.args` over the AI SDK `TypedToolCall | DynamicToolCall` union;
  `DynamicToolCall` has no `.args` (TS2339). Pre-existing Phase 5 error, but it was the last barrier to
  the plan's `tsc exits 0` criterion.
- **Fix:** Narrowed with `'args' in tc ? tc.args : (tc as { input?: unknown }).input`. Our `ALL_TOOLS`
  registers no `dynamicTool`, so the runtime value is always a static `TypedToolCall` exposing `.args`
  under AI SDK v4 — runtime behavior is unchanged; only the union is now type-safe.
- **Files modified:** `src/main/ai/llmProvider.ts`.
- **Commit:** `8c22be1`.

**3. [Rule 3 — Tooling] Plan acceptance criteria reference non-existent tsconfig projects**
- **Issue:** Criteria list `tsc -p tsconfig.node.json` and `tsc -p tsconfig.web.json`; this repo has one
  unified `tsconfig.json`.
- **Fix:** Ran `npx tsc --noEmit` (covers all of `./src`). Identical Rule 3 deviation recorded by all six
  prior waves.
- **Files modified:** none.

## Deferred Issues

**better-sqlite3 ABI mismatch blocks SQLite-backed vitest execution (pre-existing, environment-level).**
The shared `node_modules/better-sqlite3` is compiled for Electron's ABI (`NODE_MODULE_VERSION 145`);
vitest runs under system Node v24.15.0 (ABI 137). All 94 SQLite-backed test failures stem from this and
nothing else. **Deliberately NOT fixed here:** `npm run rebuild:sqlite` would recompile the shared binary
to ABI 137 and break `npm run dev` — the exact Electron runtime the very next task (the blocking
human-verify checkpoint) depends on. The DB behaviors these tests assert were verified ABI-independently
via Node's built-in `node:sqlite` in waves 01/02. **Action for orchestrator/verifier:** to capture a
formal green DB-test run, execute the suite in an environment whose Node ABI matches the installed
`better-sqlite3` (or rebuild against the test runtime in isolation), separately from the app-runtime
binary the UAT checkpoint needs.

## Known Stubs

None. This plan adds no product surface — it is a verification/close-out plan. The three edits are
type-correctness fixes with no runtime behavior change.

## Threat Flags

None. No new security-relevant surface. The fixes are type annotations + a union narrowing; the
`'args' in tc` guard reads the same runtime value as before. Threat register T-06-07-01 (cross-plan
seam tampering) is mitigated by the completed pitfall checklist; T-06-07-02 (chip-string drift) is
mitigated by the explicit reconciliation above; T-06-07-SC (no new packages) holds — zero dependencies
added across Phase 6.

## Human Verification Checkpoint (BLOCKING — awaiting sign-off)

**Type:** human-verify · **Gate:** blocking · **Status:** awaiting human UAT

Run the app (`npm run dev`), open/create a campaign with a configured AI provider and an active
session, then drive a short narration that introduces a quest, an NPC, a faction, advances time, moves
location, and rewards roleplay. Confirm each (06-VALIDATION.md § Manual-Only Verifications):

1. **Quests tab** is the 6th tab (after Journal/Inventory) and lists the new quest with an Active badge;
   completing it in narration flips the badge and fires a "Quest complete!" chip.
2. **NPC Tracker tab** shows the new NPC (name + relationship tag + description); the collapsible
   Factions section shows the faction with its tier badge; an `npc_added` chip fired.
3. **WorldStateBar** appears below the action bar — e.g. "🌙 Evening • Day 14 • Autumn" on the left and
   "📍 Forest > Ancient Ruins > …" on the right — updating as the AI narrates time/location changes.
4. An amber **"Inspiration awarded!"** chip appears when the AI awards inspiration, and the Character
   Sheet inspiration indicator flips on.
5. After each AI turn, the tabs refresh **without a manual reload** (cache invalidation works).

**Resume signal:** Type "approved", or describe any issues (each becomes a gap-closure task).

## Self-Check: PASSED

- src/renderer/src/types/aiStream.d.ts (MutationsAppliedPayload) — FOUND
- src/renderer/src/screens/CampaignViewScreen.tsx (both handlers annotated) — FOUND
- src/main/ai/llmProvider.ts (union narrowing) — FOUND
- .planning/phases/06-quests-npcs-world-state/06-07-SUMMARY.md — FOUND
- Commit 8c22be1 (Task 1) — FOUND
- `npx tsc --noEmit` exits 0 — VERIFIED
- 7 RESEARCH pitfalls verified closed — VERIFIED
- Chip-type strings reconciled main↔renderer — VERIFIED
