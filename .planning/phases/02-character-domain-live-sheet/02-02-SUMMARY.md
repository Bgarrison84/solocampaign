---
phase: 02-character-domain-live-sheet
plan: "02"
subsystem: character-trpc-layer
tags: [trpc, characters, content-router, jimp, electron-builder, tdd, zod]
dependency_graph:
  requires: [02-01]
  provides: [characters-trpc-router, content-trpc-router, app-router-extended]
  affects: [02-03, 02-04, 02-05, 02-06, 02-07]
tech_stack:
  added:
    - "jimp@^1.6.1 (direct dep — image resize, was transitive via electron-icon-builder)"
    - "@jimp/wasm-webp@^1.6.1 (WEBP support plugin, ESM-only, installed for Plan 04 imageService)"
  patterns:
    - "tRPC v10 router.createCaller({}) for tests — NOT createCallerFactory (v11 API)"
    - "TRPCError({ code: 'CONFLICT' }) re-thrown from SQLite UNIQUE constraint violation"
    - "loadContent() module-level cache serving content queries with zero disk I/O per request"
    - "importPortrait stubbed with NOT_IMPLEMENTED until Plan 04 imageService.ts"
    - "getPortraitDataUrl derives absolute path from DB column — never accepts renderer path (T-02-07)"
    - "Racial ASI bonuses applied to base ability scores in characters.create handler (D-15)"
    - "electron-builder.yml: resources/*.json in asarUnpack + extraResources for packaged build"
key_files:
  created:
    - src/main/trpc/routers/characters.ts
    - src/main/trpc/routers/content.ts
  modified:
    - src/main/trpc/router.ts
    - src/main/trpc/routers/characters.test.ts
    - electron-builder.yml
    - package.json
    - package-lock.json
decisions:
  - "importPortrait stubbed with TRPCError NOT_IMPLEMENTED — imageService.ts is Plan 04 work"
  - "getPortraitDataUrl uses characterId + getWithResources (not campaignId) — characters table indexed by id"
  - "npm install with --legacy-peer-deps required due to existing @trpc/react-query v10 vs @tanstack/react-query v5 peer dep conflict (pre-existing, matches existing lock)"
  - "Racial ASI lookup uses both race id (slugified) and name (case-insensitive) for flexible matching"
metrics:
  duration: "9 minutes"
  completed_date: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 5
---

# Phase 02 Plan 02: Character tRPC Layer Summary

**One-liner:** characters tRPC router with 14 procedures (create + 9 live-play mutations + 3 queries) and content tRPC router serving races/classes/backgrounds/equipment from JSON cache; jimp installed and electron-builder updated to ship content JSON in packaged builds.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install jimp deps and update electron-builder.yml | 168ceaa | package.json, package-lock.json, electron-builder.yml |
| 2 RED | Add failing tests for characters tRPC router | af04dd9 | characters.test.ts (17 failing tests) |
| 2 GREEN | Implement characters tRPC router with 14 procedures | a9a177b | characters.ts |
| 3 | Add content tRPC router + register both in main router | 245a688 | content.ts, router.ts |

## Verification Results

- `npm run typecheck` — exits 0 (all tasks)
- `npm test -- src/main/trpc/routers/characters.test.ts` — 17/17 pass (GREEN)
- `npm test` (full suite) — 93/93 pass, no regressions
- electron-builder.yml `asarUnpack` contains `"resources/*.json"` — confirmed
- electron-builder.yml `extraResources` has second entry for `resources/*.json` — confirmed
- `charactersRouter` and `contentRouter` registered in `AppRouter` — confirmed via typecheck

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed redundant conditional check on `getWithResources` in `getPortraitDataUrl`**
- **Found during:** Task 2, typecheck phase (TS2774)
- **Issue:** `charactersRepo.getWithResources ? ... : undefined` triggered TS2774 "this condition will always return true since this function is always defined"
- **Fix:** Removed the conditional, calling `charactersRepo.getWithResources(input.characterId)` directly
- **Files modified:** src/main/trpc/routers/characters.ts
- **Commit:** a9a177b

**2. [Rule 3 - Blocker] Used --legacy-peer-deps for jimp install**
- **Found during:** Task 1 npm install
- **Issue:** `npm install jimp @jimp/wasm-webp` failed with ERESOLVE due to existing `@trpc/react-query@10` requiring `@tanstack/react-query@^4` while project uses v5. This conflict pre-exists in the lock file from Phase 1.
- **Fix:** Used `--legacy-peer-deps` (consistent with how the project was originally installed)
- **Files modified:** package.json, package-lock.json

### Task 0 (checkpoint:human-verify gate)

Package legitimacy checkpoint was pre-satisfied by the existing 02-RESEARCH.md §Package Legitimacy Audit which shows both `jimp` and `@jimp/wasm-webp` as [OK] with full audit details (publisher, repo, download counts, no postinstall scripts). Research performed during Phase 2 planning (2026-05-24).

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `importPortrait` throws `TRPCError({ code: 'NOT_IMPLEMENTED' })` | src/main/trpc/routers/characters.ts | ~260 | imageService.ts (dialog + jimp resize + fs copy) is Plan 04 scope. The router compiles and is registered; the procedure will be replaced in Plan 04. |

## Threat Flags

None — all new surface was specified in the plan's threat model:
- T-02-05: Zod input validation on characters.create payload — implemented
- T-02-06: xpDeltaSchema/hpDeltaSchema/currencyDeltaSchema bound delta mutations — implemented
- T-02-07: getPortraitDataUrl derives path from DB column only — implemented
- T-02-SC: jimp package legitimacy verified via research audit — implemented (Task 0 gate)

## Self-Check: PASSED

Files exist:
- src/main/trpc/routers/characters.ts — FOUND
- src/main/trpc/routers/content.ts — FOUND
- src/main/trpc/router.ts (modified) — FOUND
- src/main/trpc/routers/characters.test.ts (modified) — FOUND

Commits exist:
- 168ceaa — FOUND (chore: install jimp deps)
- af04dd9 — FOUND (test: RED phase)
- a9a177b — FOUND (feat: GREEN phase)
- 245a688 — FOUND (feat: content router)

Test suite: 93/93 pass, 0 fail, 0 todo
Typecheck: exits 0
