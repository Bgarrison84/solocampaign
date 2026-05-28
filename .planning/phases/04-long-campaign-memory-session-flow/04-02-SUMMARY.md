---
phase: 04-long-campaign-memory-session-flow
plan: "02"
subsystem: ai-context-memory
tags:
  - context-builder
  - three-layer-memory
  - session-state
  - L1-L2-L3
  - wave-2
dependency_graph:
  requires:
    - "04-01 (sessionsRepo, messagesRepo session-scoped queries, sessions schema)"
  provides:
    - "ContextBuilder v2 with L1/L2/L3 memory assembly"
    - "sessionActiveMap in aiSessionState (set/get/clear)"
    - "isL1Overflow detection and flag on BuiltContext"
  affects:
    - "src/main/ai/contextBuilder.ts (complete rewrite v1→v2)"
    - "src/main/ai/aiSessionState.ts (extended with sessionActiveMap)"
    - "src/main/ai/contextBuilder.test.ts (7 v2 behavior stubs filled in)"
    - "src/main/index.ts (buildContext call updated for v2 signature)"
tech_stack:
  added: []
  patterns:
    - "L1 overflow guard: totalChars > 24000 → getLastNForSession(30) + isL1Overflow=true"
    - "L2 accumulator loop: oldest-first from getLastNCompleted, truncated to 8000 chars"
    - "L3 truncation: rollingSummary.substring(0, 4000)"
    - "D-17 system prompt order: preamble+character > refDocs > L3 > L2 > sessionContext"
    - "sessionActiveMap follows as const accessor bundle pattern from sessionFallbackMap"
key_files:
  created: []
  modified:
    - "src/main/ai/contextBuilder.ts"
    - "src/main/ai/aiSessionState.ts"
    - "src/main/ai/contextBuilder.test.ts"
    - "src/main/index.ts"
decisions:
  - "sessionId required (not optional) in BuildContextArgs v2 to force callers to be explicit; null = no active session"
  - "L2 loop iterates recentSessions in reverse (newest-first within the 3) so most-recent sessions included first when cap is tight"
  - "index.ts buildContext call updated with sessionId:null as placeholder; full wiring deferred to plan 04-03 per PATTERNS.md"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 4
---

# Phase 4 Plan 2: ContextBuilder v2 + sessionActiveMap Summary

**One-liner:** ContextBuilder v2 with three-layer memory (L1 session messages with overflow guard, L2 last-3-session recaps capped at 8000 chars, L3 rolling summary capped at 4000 chars) injected in D-17 order, plus sessionActiveMap accessor in aiSessionState.

## What Was Built

### Task 1: Extend aiSessionState.ts with sessionActiveMap

Added `_activeSessionMap = new Map<string, string>()` (Map<campaignId, sessionId>) and exported:

```typescript
export const sessionActiveMap = {
  set: (campaignId: string, sessionId: string) => _activeSessionMap.set(campaignId, sessionId),
  get: (campaignId: string): string | null => _activeSessionMap.get(campaignId) ?? null,
  clear: (campaignId: string) => _activeSessionMap.delete(campaignId),
} as const
```

Follows the identical `as const` accessor bundle pattern as `sessionFallbackMap` and `sessionAbortMap`. In-memory only; cleared on app restart per D-04.

### Task 2: ContextBuilder v2 + test stubs filled in

**Interface changes:**
- `BuildContextArgs` v2: adds `sessionId: string | null`, optional `sessionContext: { location, goal, contextNotes }`, `rollingSummary` in config
- `BuiltContext` v2: adds `isL1Overflow: boolean`

**Three-layer memory assembly:**

| Layer | Source | Cap | Overflow behavior |
|-------|--------|-----|-------------------|
| L1 | `messagesRepo.getBySessionId(sessionId)` | 24,000 chars | Falls back to `getLastNForSession(30)`, sets `isL1Overflow=true` |
| L2 | `sessionsRepo.getLastNCompleted(campaignId, 3)` | 8,000 chars | Truncates last session that would exceed cap |
| L3 | `config.rollingSummary` | 4,000 chars | `substring(0, CHARS_L3_CAP)` |

**D-17 system prompt injection order:**
```
preamble + strictness + personality + characterSummary
+ referenceDocBlock
+ l3Block ("Campaign History So Far:")
+ l2Block ("Previous Sessions — Session N:")
+ sessionContextBlock ("Current Session:")
```

**L1 as messages array (not in system prompt):** Session messages are returned as the `messages` array for the AI SDK call.

**Preserved verbatim from v1:** `STRICTNESS_DIRECTIVES`, `abilityMod()`, `formatCharacterSummary()`

**Tests:** All 22 contextBuilder.test.ts tests pass:
- 15 existing v1 tests (updated to pass `sessionId: null`)
- 7 new v2 behavior tests covering: L1 assembly, L1 overflow, L2 labels, L3 summary, D-17 injection order, session context block, sessionId=null fallback

## Verification Results

- `npx vitest run src/main/ai/contextBuilder.test.ts` — 22 tests, 22 passed
- `npx tsc --noEmit` — exits 0

### Success Criteria Check

- [x] contextBuilder.test.ts: all 22 tests pass (15 v1 + 7 v2 behavior)
- [x] BuildContextArgs has `sessionId: string | null` and optional `sessionContext`
- [x] BuiltContext has `isL1Overflow: boolean`
- [x] L1/L2/L3 character caps: `CHARS_L1_OVERFLOW = 24000` / `CHARS_L2_CAP = 8000` / `CHARS_L3_CAP = 4000`
- [x] aiSessionState.ts exports `sessionActiveMap` as const with set/get/clear
- [x] npx tsc --noEmit exits 0
- [x] L3 block appears before L2 block before sessionContextBlock in system prompt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] src/main/index.ts buildContext call missing sessionId**
- **Found during:** Task 2 TypeScript verification
- **Issue:** After updating BuildContextArgs to require `sessionId`, the existing `buildContext` call in `src/main/index.ts` line 247 failed TS strict check (`Property 'sessionId' is missing`)
- **Fix:** Added `sessionId: null` with a comment noting full wiring is deferred to plan 04-03
- **Files modified:** `src/main/index.ts`
- **Commit:** 2e17258

## Known Stubs

None — all stubs from plan 04-01 contextBuilder.test.ts v2 describe block have been filled in.

Note: The v1 test `'returns last 20 messages for context window'` was updated to use the v2 session-based approach (`getBySessionId` called with `sessionId: 'session-1'`). The original test called `messagesRepo.getLastN` — this method is no longer used by `buildContext` v2, but remains in `messagesRepo` for other callers.

## Threat Surface Scan

- T-04-02-01 (mitigate): L2 recap content truncated to CHARS_L2_CAP (8000 chars) — implemented
- T-04-02-02 (mitigate): L3 rolling summary truncated to CHARS_L3_CAP (4000 chars) — implemented
- No new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

- `src/main/ai/contextBuilder.ts` FOUND
- `src/main/ai/aiSessionState.ts` exports sessionActiveMap FOUND
- `src/main/ai/contextBuilder.test.ts` FOUND
- Commits d812410, 2e17258 FOUND
