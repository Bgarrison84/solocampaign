---
phase: 04-long-campaign-memory-session-flow
plan: "04"
subsystem: ai-send-message-session-wire-up
tags:
  - session-context
  - rolling-summary
  - d06-recovery
  - context-builder-v2
  - build-context
  - wave-4
dependency_graph:
  requires:
    - "04-01 (sessionsRepo, DB schema, messages.session_id FK)"
    - "04-02 (contextBuilder v2, sessionActiveMap, BuildContextArgs interface)"
    - "04-03 (sessions tRPC router, recapGenerator, sessionActiveMap wired into ai:send-message)"
  provides:
    - "buildContext called with full v2 signature: sessionId + sessionContext + rollingSummary"
    - "sessionsRepo.getUnsummarized(campaignId) for D-06 recovery"
    - "D-06 recovery: runD06Recovery() in sessions.start (async pre-check)"
    - "ai:finish always emits { isL1Overflow: boolean } (never undefined)"
  affects:
    - "src/main/index.ts (buildContext call extended with sessionContext + rollingSummary)"
    - "src/main/db/sessionsRepo.ts (getUnsummarized added)"
    - "src/main/trpc/routers/sessions.ts (start mutation made async + D-06 pre-check)"
    - "src/main/trpc/routers/sessions.test.ts (mock updated for getUnsummarized)"
tech_stack:
  added: []
  patterns:
    - "sessionsRepo.getById(activeSessionId) called inline in ai:send-message to load sessionContext for buildContext"
    - "runD06Recovery() is an async function in sessions.ts module scope — called from start mutation before sessionsRepo.create"
    - "D-06 recovery is non-fatal: try/catch logs error and proceeds with session creation anyway"
    - "ai:finish payload always includes isL1Overflow (boolean), never undefined — renderer can destructure reliably"
key_files:
  created: []
  modified:
    - "src/main/index.ts"
    - "src/main/db/sessionsRepo.ts"
    - "src/main/trpc/routers/sessions.ts"
    - "src/main/trpc/routers/sessions.test.ts"
decisions:
  - "sessionContext loaded via sessionsRepo.getById(activeSessionId) inline in ai:send-message rather than storing in sessionActiveMap — keeps activeSessionId as the single source of truth; session data is read from DB on demand"
  - "ai:finish always emits { isL1Overflow } as a boolean — changed from conditional (isL1Overflow ? { isL1Overflow: true } : undefined) to always-present — renderer can destructure without null-check"
  - "runD06Recovery placed as module-level async function in sessions.ts — co-located with the start procedure; non-fatal try/catch ensures session creation proceeds even if LLM call fails during recovery"
  - "getUnsummarized uses isNotNull(sessions.endedAt) + eq(sessions.isSummarized, false) — matches the exact D-06 recovery predicate from the plan"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 4
---

# Phase 4 Plan 4: AI Send-Message Session Wire-Up Summary

**One-liner:** Extended ai:send-message with sessionContext (location/goal/contextNotes) and rollingSummary passed to buildContext v2, always-present isL1Overflow in ai:finish, and D-06 recovery pre-check in sessions.start via getUnsummarized.

## What Was Built

### Task 1: Extend ai:send-message handler with full session context

Modified `src/main/index.ts`:

1. **sessionContext loading**: After resolving `activeSessionId = sessionActiveMap.get(campaignId)`, added:
   ```typescript
   const activeSession = activeSessionId ? sessionsRepo.getById(activeSessionId) : undefined
   const sessionContext = activeSession
     ? { location: activeSession.location ?? null, goal: activeSession.goal ?? null, contextNotes: activeSession.contextNotes ?? null }
     : undefined
   ```

2. **buildContext v2 full signature**: Extended the `buildContext` call to pass:
   - `sessionContext` — the location/goal/contextNotes block that gets injected into the system prompt as "Current Session:" (D-17 item 5)
   - `rollingSummary: campaign.rollingSummary ?? null` — L3 rolling campaign summary (D-16)

3. **ai:finish always includes isL1Overflow**: Changed from `isL1Overflow ? { isL1Overflow: true } : undefined` to always `{ isL1Overflow }` — renderer can destructure without checking for undefined payload.

### Task 2: D-06 pre-check + sessionsRepo.getUnsummarized

**sessionsRepo.ts** — Added `getUnsummarized(campaignId: string): Session[]`:
- Queries sessions WHERE `campaignId` matches, `endedAt IS NOT NULL`, and `isSummarized = false`
- Ordered by `sessionNumber ASC`
- These are sessions ended via before-quit auto-end but never had rolling summary generated

**sessions.ts** — Added `runD06Recovery(campaignId)` async helper and updated `start` mutation:
- `start` mutation is now `async`
- Calls `await runD06Recovery(input.campaignId)` before `sessionsRepo.create` 
- Recovery logic: loads unsummarized sessions → gets `olderSessions` from `getOlderThan` → decrypts API key → calls `generateRollingSummary` → truncates to 4000 chars → updates `campaignsRepo.updateRollingSummary` → marks all recovered sessions as summarized
- Wrapped in try/catch — if the LLM call fails, logs error and proceeds (non-fatal: T-04-04-04)

**sessions.test.ts** — Added `getUnsummarized: vi.fn().mockReturnValue([])` to the sessionsRepo mock (Rule 3 auto-fix — test would fail without it).

## Verification Results

- `npx tsc --noEmit` — exits 0 (no type errors)
- `npx vitest run src/main/trpc/routers/sessions.test.ts src/main/ai/recapGenerator.test.ts` — 25 tests, 25 passed
- Pre-existing failures in `src/main/db/*.test.ts` and `characters.test.ts` are ABI-mismatch issues (better-sqlite3 compiled for Electron 41 ABI 145 vs system Node.js ABI 137) — not introduced by this plan

### Success Criteria Check

- [x] buildContext called with `sessionId: activeSessionId` — was already in 04-03
- [x] buildContext called with `sessionContext` (location/goal/contextNotes from sessionsRepo.getById)
- [x] buildContext called with `rollingSummary: campaign.rollingSummary ?? null` in config
- [x] Both messagesRepo.insert calls include `sessionId: activeSessionId` — was in 04-03
- [x] `safeSend('ai:finish', { isL1Overflow })` always emits boolean (not conditional)
- [x] `sessionsRepo.getUnsummarized` method exists and queries correct predicate
- [x] `sessions.start` is async and calls `runD06Recovery` before `sessionsRepo.create`
- [x] D-06 recovery is non-fatal (try/catch)
- [x] npx tsc --noEmit exits 0
- [x] sessions.test.ts 16 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sessions.test.ts mock missing getUnsummarized**
- **Found during:** Task 2 test run
- **Issue:** The `sessionsRepo` vi.mock in `sessions.test.ts` did not include `getUnsummarized`. The `start` mutation now calls `runD06Recovery` which calls `sessionsRepo.getUnsummarized(campaignId)` — this threw `TypeError: sessionsRepo.getUnsummarized is not a function`
- **Fix:** Added `getUnsummarized: vi.fn().mockReturnValue([])` to the mock object — returns empty array (no unsummarized sessions by default, matching happy-path behavior)
- **Files modified:** `src/main/trpc/routers/sessions.test.ts`
- **Commit:** 1ace437

### Scope Note

The 04-03 SUMMARY reported that `sessionActiveMap` was already wired into `ai:send-message` (with `sessionId: activeSessionId` on both `messagesRepo.insert` calls and `buildContext`). This plan's Task 1 extended that partial wiring with `sessionContext` and `rollingSummary` — the full v2 `BuildContextArgs` signature.

## Known Stubs

None. All three memory layers are now fully wired:
- L1: `messagesRepo.getBySessionId(sessionId)` via `buildContext` when `sessionId` is set
- L2: `sessionsRepo.getLastNCompleted(campaignId, 3)` via `buildContext`
- L3: `config.rollingSummary` now passed from `campaign.rollingSummary` — will be non-null after D-06 recovery or after `saveRecap` background rolling summary runs

## Threat Surface Scan

All threats from the plan's threat model were addressed:

| Threat | Implementation |
|--------|----------------|
| T-04-04-01: sessionId injection | `sessionActiveMap.get(campaignId)` is sole authority — renderer payload does not carry sessionId |
| T-04-04-02: rollingSummary disclosure | Campaign-owned data, no third-party PII — accepted |
| T-04-04-03: isL1Overflow in ai:finish | Read-only boolean for UI display only — accepted |
| T-04-04-04: D-06 pre-check blocking 5s | try/catch non-fatal; isSummarized set true afterward; bounded by model timeout — accepted |
| T-04-04-SC: npm installs | No new installs in this plan |

No new unplanned threat surfaces introduced.

## Self-Check: PASSED

- `src/main/index.ts` contains `sessionContext` block FOUND
- `src/main/index.ts` contains `rollingSummary: campaign.rollingSummary ?? null` FOUND
- `src/main/index.ts` contains `safeSend('ai:finish', { isL1Overflow })` FOUND
- `src/main/db/sessionsRepo.ts` contains `getUnsummarized` method FOUND
- `src/main/trpc/routers/sessions.ts` contains `runD06Recovery` function FOUND
- `src/main/trpc/routers/sessions.ts` contains `await runD06Recovery(input.campaignId)` in start FOUND
- `src/main/trpc/routers/sessions.ts` start mutation is async FOUND
- Commits 866b4a5, 1ace437 FOUND
