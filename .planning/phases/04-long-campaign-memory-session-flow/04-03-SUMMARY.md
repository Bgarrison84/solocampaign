---
phase: 04-long-campaign-memory-session-flow
plan: "03"
subsystem: session-lifecycle-ipc
tags:
  - sessions-trpc-router
  - recap-generator
  - ipc-streaming
  - before-quit
  - session-active-map
  - wave-3
dependency_graph:
  requires:
    - "04-01 (sessionsRepo, messagesRepo.getBySessionId, DB schema)"
    - "04-02 (sessionActiveMap, ContextBuilder v2)"
  provides:
    - "generateSessionRecap + generateRollingSummary (recapGenerator.ts)"
    - "sessionsRouter tRPC router (7 procedures)"
    - "window.sessionRecap contextBridge IPC surface"
    - "ai:recap-start IPC streaming handler"
    - "app.before-quit synchronous session auto-end (D-06)"
    - "sessionActiveMap wired into ai:send-message (D-20)"
  affects:
    - "src/main/ai/recapGenerator.ts (created)"
    - "src/main/trpc/routers/sessions.ts (created)"
    - "src/main/trpc/router.ts (sessions: sessionsRouter added)"
    - "src/main/trpc/schemas.ts (session schemas added)"
    - "src/main/db/campaignsRepo.ts (updateRollingSummary added)"
    - "src/preload/index.ts (window.sessionRecap + onFinish meta update)"
    - "src/main/index.ts (ai:recap-start handler, before-quit, sessionActiveMap wire-up)"
tech_stack:
  added: []
  patterns:
    - "generateText wrapper pattern: RECAP_SYSTEM_PROMPT, temperature=0.3, maxOutputTokens=1000 for rolling summary"
    - "tRPC mutation returns plain { saved: true } / { ended: true } / { updated: true } sentinel objects"
    - "Background rolling summary: Promise.resolve().then() + try/catch, non-fatal (T-04-03-05)"
    - "before-quit: getDb().$client.prepare(...).run() for synchronous raw SQL (D-06)"
    - "sessionActiveMap wired into ai:send-message — userSessionId resolved before buildContext"
    - "sessionMessages mapped from Message[] to ModelMessage[] for streamText compatibility"
    - "IPC test pattern: vi.mock all repos, use UUID constants as test IDs"
key_files:
  created:
    - "src/main/ai/recapGenerator.ts"
    - "src/main/trpc/routers/sessions.ts"
  modified:
    - "src/main/ai/recapGenerator.test.ts"
    - "src/main/trpc/routers/sessions.test.ts"
    - "src/main/trpc/schemas.ts"
    - "src/main/trpc/router.ts"
    - "src/main/db/campaignsRepo.ts"
    - "src/preload/index.ts"
    - "src/main/index.ts"
decisions:
  - "Used maxOutputTokens (not maxTokens) — Vercel AI SDK v4 renamed the field"
  - "sessionMessages mapped to ModelMessage[] before passing to streamText — Message[] has extra fields (campaignId, createdAt, sessionId) not in ModelMessage shape"
  - "getDb().$client.prepare() for before-quit raw SQL — Drizzle's getDb() returns BetterSQLite3Database, not the raw Database; $client exposes the underlying connection"
  - "Test IDs must be valid UUIDs — tRPC campaignIdSchema validates z.string().uuid(); short IDs like 'campaign-001' are rejected"
  - "IPC tests mock repos entirely instead of using in-memory better-sqlite3 — ABI mismatch: better-sqlite3 compiled for Electron 41 (ABI 145) cannot run under system Node.js (ABI 137)"
  - "ai:recap-start uses dynamic import for zod validation + buildModel + streamText — avoids circular import at module load time; follows established Electron handler pattern"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 9
---

# Phase 4 Plan 3: Session Lifecycle & IPC Recap Streaming Summary

**One-liner:** Session tRPC router (7 procedures) with generateText-based recap generation, streaming ai:recap-start IPC handler, window.sessionRecap contextBridge surface, and synchronous before-quit auto-end handler for D-06 compliance.

## What Was Built

### Task 1: recapGenerator.ts + test stubs filled

Created `src/main/ai/recapGenerator.ts` with:

- `RECAP_SYSTEM_PROMPT`: Fixed hardcoded system prompt for concise DM-record session summaries (D-12). 3-6 paragraphs, factual prose, key events/NPCs/decisions/combat/session end.
- `ROLLING_SUMMARY_SYSTEM_PROMPT`: Fixed hardcoded system prompt for synthesizing older sessions into Layer 3 rolling summary (D-16). Max 800 words, past tense, information-dense.
- `generateSessionRecap(config, sessionMessages)`: calls `generateText` with `RECAP_SYSTEM_PROMPT`, `temperature=0.3`. Logs message count + provider type (never apiKey — T-04-03-03). Propagates errors after logging.
- `generateRollingSummary(config, olderSessions)`: builds `historyText = sessions.map(s => "Session N: recap").join('\n\n')`, calls `generateText` with `ROLLING_SUMMARY_SYSTEM_PROMPT`, `temperature=0.3`, `maxOutputTokens=1000` (D-16 L3 cap).

**TDD deviation (Rule 1 — Bug):** Plan spec said `maxTokens=1000` but Vercel AI SDK v4 uses `maxOutputTokens`. Updated both implementation and test.

9 tests pass covering: RECAP_SYSTEM_PROMPT usage, message passing, text return, temperature, ROLLING_SUMMARY_SYSTEM_PROMPT usage, session concatenation, return value, maxOutputTokens=1000, empty session handling.

### Task 2: sessions tRPC router + all wire-ups

**schemas.ts** — Added session schemas:
- `sessionIdSchema`: `z.string().uuid()`
- `sessionLocationSchema`: `z.string().max(200)`
- `sessionGoalSchema`: `z.string().max(1000)`
- `sessionContextNotesSchema`: `z.string().max(1000)`
- `sessionRecapSchema`: `z.string().max(50000)` (T-04-03-02)
- `playerNotesSchema`: `z.string().max(10000)`

**campaignsRepo.ts** — Added `updateRollingSummary(campaignId, value)` method for D-21 Layer 3 storage.

**sessions.ts** — 7 tRPC procedures:

| Procedure | Side effects |
|-----------|-------------|
| `start` | `sessionsRepo.create()` + `sessionActiveMap.set(campaignId, session.id)` → `{ id, sessionNumber }` |
| `end` | `sessionsRepo.end()` + `sessionActiveMap.clear(campaignId)` → `{ ended: true }` |
| `saveRecap` | `sessionsRepo.saveRecap()` + `sessionActiveMap.clear()` + background rolling summary → `{ saved: true }` |
| `updatePlayerNotes` | `sessionsRepo.updatePlayerNotes()` → `{ updated: true }` |
| `list` | `sessionsRepo.list(campaignId)` → `Session[]` newest-first |
| `getActive` | `sessionsRepo.getActiveByCampaignId(campaignId) ?? null` |
| `getLastLocation` | `sessionsRepo.getLastLocation(campaignId)` → `string | null` (D-07 pre-fill) |

**Background rolling summary** (inside `saveRecap`):
- `Promise.resolve().then(async () => { ... })` — non-blocking, non-fatal (T-04-03-05)
- `getOlderThan(campaignId, sessionNumber - 3)` for sessions outside L2 window
- If empty: `updateRollingSummary(campaignId, null)` and return
- Otherwise: decrypt primary API key → build `LLMProviderConfig` → `generateRollingSummary()` → truncate to 4000 chars → `updateRollingSummary()` + `markSummarized()`
- `catch (err)`: logs error, does NOT rethrow

**router.ts** — Added `sessions: sessionsRouter` import and registration.

**preload/index.ts** — Two changes:
1. `window.aiStream.onFinish` updated to accept optional `meta?: { isL1Overflow?: boolean }` — passes overflow flag from `ai:finish` event to renderer (D-14 context overflow warning)
2. `window.sessionRecap` contextBridge surface added: `startStream`, `onToken`, `onFinish`, `onError`, `removeAllListeners` for `ai:recap-*` channels

**index.ts** — Three additions:
1. **ai:recap-start IPC handler**: senderFrame validation (verbatim from ai:send-message — T-04-03-01) → Zod validation → load campaign (primary provider only — Pitfall 4) → `messagesRepo.getBySessionId()` → map `Message[]` → `ModelMessage[]` → `streamText()` with `RECAP_SYSTEM_PROMPT` → stream tokens via `ai:recap-token` → finish with `ai:recap-finish fullText` → error via `ai:recap-error`
2. **app.before-quit handler**: `getDb().$client.prepare('UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL').run(Date.now())` — synchronous raw SQL, wrapped in try/catch, no async LLM calls (Pitfall 6 / D-06)
3. **sessionActiveMap wired**: `ai:send-message` now calls `sessionActiveMap.get(campaignId)` and tags user + assistant messages with `sessionId` (D-20). `buildContext` receives actual `activeSessionId` (not hardcoded `null`). `ai:finish` sends `isL1Overflow` meta flag.

**16 sessions tests pass** covering: start/end/saveRecap/updatePlayerNotes/list/getActive/getLastLocation behaviors.

## Verification Results

- `npx vitest run src/main/trpc/routers/sessions.test.ts src/main/ai/recapGenerator.test.ts` — 25 tests, 25 passed
- `npx tsc --noEmit` — exits 0

### Success Criteria Check

- [x] recapGenerator.ts: generateSessionRecap + generateRollingSummary using generateText
- [x] sessions.ts router: 7 procedures (start/end/saveRecap/updatePlayerNotes/list/getActive/getLastLocation)
- [x] router.ts: `sessions: sessionsRouter` registered
- [x] preload: `window.sessionRecap` with startStream/onToken/onFinish/onError/removeAllListeners
- [x] index.ts: `ai:recap-start` IPC handler with senderFrame validation (T-04-03-01)
- [x] index.ts: `app.on('before-quit')` with synchronous SQL UPDATE (D-06)
- [x] index.ts: `sessionActiveMap.get(campaignId)` wired into ai:send-message
- [x] All test files pass; npx tsc --noEmit exits 0
- [x] recapGenerator.ts exports RECAP_SYSTEM_PROMPT and ROLLING_SUMMARY_SYSTEM_PROMPT
- [x] sessions.start calls sessionActiveMap.set inside mutation handler

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `maxTokens` → `maxOutputTokens` in Vercel AI SDK v4**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Plan spec said `maxTokens: 1000` but Vercel AI SDK v4 renamed the field to `maxOutputTokens`. TypeScript error: `Object literal may only specify known properties, and 'maxTokens' does not exist`
- **Fix:** Changed `maxTokens` to `maxOutputTokens` in both `recapGenerator.ts` and the test assertion
- **Files modified:** `src/main/ai/recapGenerator.ts`, `src/main/ai/recapGenerator.test.ts`
- **Commit:** 49c9cf5

**2. [Rule 1 - Bug] `Message[]` → `ModelMessage[]` mapping needed for streamText**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `messagesRepo.getBySessionId()` returns `Message[]` (with `campaignId`, `createdAt`, `sessionId` extra fields) but `streamText(messages:)` expects `ModelMessage[]`. TypeScript error: `Type '{ campaignId: string; ... }' is not assignable to type 'ModelMessage'`
- **Fix:** Added explicit `rawMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))` mapping in `ai:recap-start` handler
- **Files modified:** `src/main/index.ts`
- **Commit:** 7f0d8f1

**3. [Rule 1 - Bug] `getDb().prepare()` → `getDb().$client.prepare()` for raw SQL**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `getDb()` returns `BetterSQLite3Database<...>` (Drizzle ORM wrapper), not the raw `Database` instance. TypeScript error: `Property 'prepare' does not exist on type 'BetterSQLite3Database<...>'`
- **Fix:** Used `getDb().$client.prepare(...)` to access the underlying better-sqlite3 connection. The `$client` property is part of Drizzle's public API for raw access.
- **Files modified:** `src/main/index.ts`
- **Commit:** 7f0d8f1

**4. [Rule 3 - Blocking] Test IDs must be valid UUIDs**
- **Found during:** Task 2 test execution
- **Issue:** Test used non-UUID IDs like `'campaign-001'` and `'session-001'`. tRPC Zod validation rejects these: `{ validation: 'uuid', code: 'invalid_string' }`
- **Fix:** Replaced with valid UUID4 constants `TEST_CAMPAIGN_ID = '00000000-0000-4000-8000-000000000001'` and `TEST_SESSION_ID = '00000000-0000-4000-8000-000000000002'`
- **Files modified:** `src/main/trpc/routers/sessions.test.ts`
- **Commit:** 7f0d8f1

**5. [Rule 3 - Blocking] Test cannot use better-sqlite3 directly (ABI mismatch)**
- **Found during:** Task 2 test execution
- **Issue:** Initial test design used `new Database(':memory:')` but better-sqlite3 was compiled for Electron 41 (ABI 145), not system Node.js (ABI 137). Error: `The module was compiled against a different Node.js version using NODE_MODULE_VERSION 145`
- **Fix:** Rewrote sessions.test.ts to mock all repos (`vi.mock`) instead of using a real in-memory DB. This follows the established pattern in `contextBuilder.test.ts`. The tRPC router logic is fully tested via mock call assertions.
- **Files modified:** `src/main/trpc/routers/sessions.test.ts`
- **Commit:** 7f0d8f1

### Scope Additions (Rule 2 — Missing Critical Functionality)

**1. sessionActiveMap wired into ai:send-message** (was left as `sessionId: null` in 04-02 with note "deferred to 04-03")
- Added `userSessionId = sessionActiveMap.get(campaignId)` for user message insert
- Added `activeSessionId = sessionActiveMap.get(campaignId)` before `buildContext` call
- Messages now tagged with `sessionId` FK (D-20) — critical for L1 memory to work
- `ai:finish` now sends `isL1Overflow` meta flag to renderer (preload updated to match)

## Known Stubs

None — all procedures are wired with real repo calls and real IPC handling. The `ai:recap-start` handler streams from the real `streamText` call (not mocked in production).

The rolling summary background task in `saveRecap` will silently fail if the campaign has no AI provider configured (empty `modelName` or missing `endpointUrl`) — the error is caught and logged, which is the correct behavior per T-04-03-05 (accept disposition).

## Threat Surface Scan

All threats from the plan's threat model were mitigated:

| Threat | Implementation |
|--------|----------------|
| T-04-03-01: ai:recap-start senderFrame | Verbatim senderFrame validation block copied from ai:send-message |
| T-04-03-02: saveRecap aiRecap field | sessionRecapSchema z.string().max(50000) at tRPC boundary |
| T-04-03-03: API key in ai:recap-start | Primary key decrypted in main process only; never in log output |
| T-04-03-04: sessions.start campaignId | campaignIdSchema z.string().uuid() validates at tRPC boundary |
| T-04-03-05: background rolling summary | Promise.resolve().then() + try/catch, non-fatal, logged but not rethrown |
| T-04-03-06: app-close mid-session | before-quit synchronous SQL UPDATE sets ended_at for all active sessions |

No new unplanned threat surfaces introduced.

## Self-Check: PASSED

- `src/main/ai/recapGenerator.ts` FOUND
- `src/main/trpc/routers/sessions.ts` FOUND
- `src/main/trpc/router.ts` contains `sessions: sessionsRouter` FOUND
- `src/preload/index.ts` contains `exposeInMainWorld('sessionRecap'` FOUND
- `src/main/index.ts` contains `ipcMain.handle('ai:recap-start'` FOUND
- `src/main/index.ts` contains `app.on('before-quit'` FOUND
- `src/main/index.ts` contains `getDb().$client.prepare(` FOUND
- Commits 49c9cf5, 7f0d8f1 FOUND
