---
phase: 06-quests-npcs-world-state
plan: 01
subsystem: data-layer
tags: [drizzle, sqlite, migration, schema, repos, quests, npcs, factions, world-state]
requires:
  - "Phase 5 schema (campaigns table) and Drizzle migration pipeline (resources/migrations + meta/_journal.json)"
provides:
  - "quests/npcs/factions SQLite tables + Quest/Npc/Faction types"
  - "four nullable world-state columns on campaigns (worldTimeOfDay, worldDayNumber, worldSeason, worldLocationPath)"
  - "questsRepo, npcsRepo, factionsRepo (synchronous Drizzle repos)"
affects:
  - "Wave 1+ mutationPipeline tool handlers (addQuest/updateQuest/addNpc/updateFaction/etc.)"
  - "Wave 2/3 tRPC queries + context-injection for quests/NPCs/factions/world state"
tech-stack:
  added: []
  patterns:
    - "Object-literal synchronous repos using getDb() + Drizzle .run()/.get()/.all() (sessionsRepo shape)"
    - "Campaign-scoped unique(campaignId, name) + onConflictDoUpdate for idempotent faction upsert"
    - "In-memory SQLite + migrate() test harness (vi.mock('electron') + vi.doMock('./index') + campaignsRepo seed)"
key-files:
  created:
    - resources/migrations/0006_phase6_world_state.sql
    - src/main/db/questsRepo.ts
    - src/main/db/npcsRepo.ts
    - src/main/db/factionsRepo.ts
    - src/main/db/questsRepo.test.ts
    - src/main/db/npcsRepo.test.ts
    - src/main/db/factionsRepo.test.ts
  modified:
    - src/main/db/schema.ts
    - resources/migrations/meta/_journal.json
decisions:
  - "World-state lives as four nullable columns on campaigns (not a separate table) — single-row-per-campaign, AI-managed, no join needed"
  - "Faction idempotency enforced at DB level via UNIQUE(campaign_id, name) index + Drizzle onConflictDoUpdate (Pitfall 5)"
  - "Migration 0006 registered in meta/_journal.json idx:6 so the Drizzle migrator picks it up at startup and in tests"
metrics:
  duration: ~45min
  tasks: 2
  files: 9
  completed: 2026-05-30
---

# Phase 6 Plan 01: Quests, NPCs & World-State Data Foundation Summary

Wave-0 data foundation for Phase 6: migration 0006 adds three AI-managed tables (quests, npcs, factions) plus four nullable in-world-state columns on campaigns, backed by three synchronous Drizzle repos following the established sessionsRepo pattern, with faction upserts made idempotent by a campaign-scoped unique index.

## What Was Built

**Task 1 — Migration 0006 + schema.ts** (commit `8f6c69c`)
- `resources/migrations/0006_phase6_world_state.sql`: `CREATE TABLE quests`, `CREATE TABLE npcs`, `CREATE TABLE factions`, `CREATE UNIQUE INDEX factions_campaign_name_unique`, and four `ALTER TABLE campaigns ADD` statements (`world_time_of_day`, `world_day_number`, `world_season`, `world_location_path`) — all nullable. SQL formatting mirrors the existing 0004 drizzle-generated style (statement-breakpoints, FK clauses).
- Registered migration 0006 in `resources/migrations/meta/_journal.json` (idx 6, breakpoints true) so the migrator applies it.
- `src/main/db/schema.ts`: added the four world-state columns to `campaigns`; defined `quests`, `npcs`, `factions` sqliteTables (factions with `unique('factions_campaign_name_unique').on(campaignId, name)`); exported `Quest`/`Npc`/`Faction` (and `New*`) types.

**Task 2 — Three repos + tests** (commit `344d2d9`)
- `questsRepo`: `create` (status defaults `Active`, description defaults `''`, insert-then-select-back), `list` (ordered `asc(createdAt)` — D-02), `updateStatus`.
- `npcsRepo`: `create` (relationship defaults `Unknown`, factionName nullable), `list` (ordered `asc(createdAt)` — D-06), `patch` (builds a partial set object from only the defined fields; no-op when empty; leaves untouched fields unchanged).
- `factionsRepo`: `upsert` (insert with `onConflictDoUpdate` on `[campaignId, name]`, then select-back; throws if null), `list` (ordered `asc(createdAt)`).
- Three `.test.ts` files using the exact project harness from `combatantsRepo.test.ts` / `campaignEventsRepo.test.ts` (`vi.mock('electron')` + `vi.doMock('./index')` + dynamic import of `campaignsRepo` to seed a campaign). 15 tests total assert defaults, status update, partial patch (description preserved), ASC ordering, campaign scoping, and faction upsert idempotency (two upserts on same key → exactly one row with latest tier).

## Verification

- `npx tsc --noEmit -p tsconfig.json` → **0 errors in plan files** (`schema.ts`, the three repos, the three tests). Total project errors = 7, all pre-existing and out-of-scope (`llmProvider.ts`, `CampaignViewScreen.tsx`) — logged to `deferred-items.md`. NOTE: the plan's verify command referenced `tsconfig.node.json`, which does not exist in this project; the project uses a single unified `tsconfig.json` (the `npm run typecheck` target). Used that instead (deviation, Rule 3).
- Migration 0006 + all repo DB logic verified ABI-independently via Node's built-in `node:sqlite`: 3 tables + the `factions_campaign_name_unique` index + the four `world_*` campaigns columns created; quest defaults/updateStatus, NPC defaults + partial patch (other fields preserved), faction upsert idempotency (1 row, latest tier wins), and cross-campaign distinctness all PASS.
- The three vitest files collect cleanly (15 tests discovered, no import/syntax/structural errors); execution under vitest is currently blocked by a pre-existing environment issue (see Deferred Issues).

## Deviations from Plan

### Auto-fixed / Adjusted

**1. [Rule 3 — Blocking config] Plan verify command referenced a non-existent `tsconfig.node.json`**
- **Found during:** Task 1 verification.
- **Issue:** The plan's `<automated>` verify was `npx tsc --noEmit -p tsconfig.node.json`. This project ships a single unified `tsconfig.json` (include `./src`), with `tsconfig.node.json` absent. The command errored TS5058 (path does not exist).
- **Fix:** Ran `npx tsc --noEmit -p tsconfig.json` (the actual `npm run typecheck` target), which covers all repo source and the three `.test.ts` files. Confirmed 0 errors in plan files.
- **Files modified:** none (tooling adjustment only).
- **Commit:** n/a.

## Deferred Issues

**better-sqlite3 ABI mismatch blocks vitest execution in this sandbox (pre-existing, environment-level).**
- The shared `node_modules/better-sqlite3` (resolved from the main repo) is compiled for Electron's ABI 145, while the worktree's vitest runs under system Node ABI 137. Every SQLite-backed test in the repo currently fails with `NODE_MODULE_VERSION 145 ... requires 137` — including the pre-existing, known-good `combatantsRepo.test.ts`. This is NOT introduced by this plan.
- Not fixed here: rebuilding the shared native module for Node would break the main repo's Electron runtime and is out of scope (also not a permitted package install). Logged to `deferred-items.md`.
- **Mitigation applied:** Verified the full DB behavior the vitest tests assert via Node's built-in `node:sqlite` (ABI-independent) — migration apply, defaults, updateStatus, partial patch with field preservation, and faction upsert idempotency all PASS. The Drizzle repo code mirrors these SQL operations 1:1.
- **Action for orchestrator/verifier:** Re-run `npm run test -- --run src/main/db/questsRepo.test.ts src/main/db/npcsRepo.test.ts src/main/db/factionsRepo.test.ts` after `npm run rebuild:sqlite` (electron-rebuild against the test runtime) to capture the formal green run. The tests are real PASS-on-implementation assertions.

## Known Stubs

None. All three repos are fully implemented and exercise real DB paths. The four world-state columns are written/read by downstream Phase 6 waves (Wave 1 tool handlers, Wave 2/3 tRPC + context injection), not in this plan — that is the intended Wave-0 boundary, not a stub.

## Self-Check: PASSED

- resources/migrations/0006_phase6_world_state.sql — FOUND
- src/main/db/schema.ts (quests/npcs/factions + world cols) — FOUND
- src/main/db/questsRepo.ts — FOUND
- src/main/db/npcsRepo.ts — FOUND
- src/main/db/factionsRepo.ts — FOUND
- src/main/db/questsRepo.test.ts — FOUND
- src/main/db/npcsRepo.test.ts — FOUND
- src/main/db/factionsRepo.test.ts — FOUND
- Commit 8f6c69c (Task 1) — FOUND
- Commit 344d2d9 (Task 2) — FOUND
