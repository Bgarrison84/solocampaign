---
phase: 04-long-campaign-memory-session-flow
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/main/ai/aiSessionState.ts
  - src/main/ai/contextBuilder.ts
  - src/main/ai/recapGenerator.ts
  - src/main/db/campaignsRepo.ts
  - src/main/db/messagesRepo.ts
  - src/main/db/schema.ts
  - src/main/db/sessionsRepo.ts
  - src/main/index.ts
  - src/main/trpc/router.ts
  - src/main/trpc/routers/sessions.ts
  - src/main/trpc/schemas.ts
  - src/preload/index.ts
  - src/renderer/src/components/ChatInputArea.tsx
  - src/renderer/src/components/EndSessionModal.tsx
  - src/renderer/src/components/SessionJournalTab.tsx
  - src/renderer/src/components/SessionStartModal.tsx
  - src/renderer/src/components/StoryScrollPanel.tsx
  - src/renderer/src/hooks/useRecapStream.ts
  - src/renderer/src/screens/CampaignViewScreen.tsx
  - src/renderer/src/stores/sessionStore.ts
findings:
  critical: 5
  warning: 7
  info: 3
  total: 15
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 04 implements session lifecycle management, three-layer AI memory (L1 current session / L2 recent recaps / L3 rolling summary), recap streaming, and the session journal UI. The architecture is sound and the security posture (key handling, IPC validation, CSP) is good. However, the review found five blockers: a race condition that double-fires the auto-narration trigger and corrupts session message history, a session state desync between the DB and the in-memory map on app restart, incorrect rolling summary logic that can erase campaign memory, an unregistered recap-finish listener that leaks listeners and never fires the edit-phase transition, and a missing `await` that silently discards the `sessions.end` tRPC call in the end-session flow. Seven additional warnings cover logic gaps that degrade correctness without being immediately data-loss-level.

---

## Critical Issues

### CR-01: Auto-narration guard checks ALL campaign messages, not current-session messages — fires every new session

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:157-164`

**Issue:** The D-04 auto-narration guard reads `messagesQuery.data?.length` which counts every message ever stored for the campaign (query key `['ai', 'getMessages', id]` calls `trpc.ai.getMessages` which returns all campaign messages). After the first session is completed and a second session starts, `messageCount` is always > 0 for the campaign, so the auto-trigger never fires for session 2, 3, etc. Conversely, if the page is refreshed during session 1 while `messagesQuery` is still loading (returns `undefined`), `messageCount` defaults to 0 and the trigger fires again, duplicating the "[Begin session narration]" message into the DB.

The correct guard should count messages for the *current active session*, not the whole campaign.

**Fix:**
```typescript
// Replace the existing messagesQuery guard with a session-scoped check.
// Either add a dedicated query for session messages, or use the session's
// own message count from a sessions.getById that includes message count.

// Minimal fix: only fire when sessionStore.activeSessionId was JUST set
// and we have confirmed zero messages for THAT session from the DB.
// A simple approach: track whether we already sent the auto-trigger
// for the current sessionId using a ref.

const autoNarrationSentRef = useRef<string | null>(null) // stores sessionId

useEffect(() => {
  const justActivated = sessionStore.isSessionActive && !prevIsSessionActive.current
  prevIsSessionActive.current = sessionStore.isSessionActive
  if (!justActivated) return
  if (!id || !sessionStore.activeSessionId) return
  // Only send once per sessionId
  if (autoNarrationSentRef.current === sessionStore.activeSessionId) return
  // Only send if there are no messages for the campaign at all (truly new)
  const messageCount = messagesQuery.data?.length ?? null
  if (messageCount === null) return // still loading — bail, will re-run when data arrives
  if (messageCount > 0) return
  autoNarrationSentRef.current = sessionStore.activeSessionId
  window.aiStream.sendMessage({
    campaignId: id,
    content: '[Begin session narration]',
  })
}, [sessionStore.isSessionActive, sessionStore.activeSessionId, id, messagesQuery.data])
```

---

### CR-02: `sessionActiveMap` is never restored on app restart — mid-session messages after reload get no session FK

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:119-131` / `src/main/trpc/routers/sessions.ts:148`

**Issue:** `sessionActiveMap` is in-memory only (documented). On page refresh or app restart, `CampaignViewScreen` correctly queries `sessions.getActive` and calls `useSessionStore.getState().startSession(...)` to restore renderer-side state. However, the main-process `sessionActiveMap` is **never repopulated** from the DB. After reload:

1. `sessionStore.isSessionActive` becomes `true` (renderer side restored).
2. The player sends a message — `messagesRepo.insert` is called with `sessionId: sessionActiveMap.get(campaignId)` which returns `null` because the map was cleared on restart.
3. All messages in the resumed session get `session_id = NULL`, breaking L1 context (they are returned by `getByCampaignId` but NOT by `getBySessionId`, so `buildContext` assembles no L1 messages for the session even though messages exist).

There is no call to `sessionActiveMap.set(campaignId, session.id)` in the `sessions.getActive` tRPC query handler or anywhere that handles re-hydration.

**Fix:**
```typescript
// In src/main/trpc/routers/sessions.ts, add a procedure or hook that
// re-populates the map when the renderer queries for an active session.

getActive: t.procedure
  .input(z.object({ campaignId: campaignIdSchema }))
  .query(({ input }) => {
    const session = sessionsRepo.getActiveByCampaignId(input.campaignId)
    if (session) {
      // Re-hydrate in-memory map after app restart
      sessionActiveMap.set(input.campaignId, session.id)
    } else {
      sessionActiveMap.clear(input.campaignId)
    }
    return session ?? null
  }),
```

---

### CR-03: Rolling summary logic in `saveRecap` uses wrong cutoff — clears L3 memory prematurely or never generates it

**File:** `src/main/trpc/routers/sessions.ts:215-222`

**Issue:** The `saveRecap` handler determines which sessions to roll up using `sessionsRepo.getOlderThan(campaignId, savedSession.sessionNumber - 3)`. This means sessions older than `currentSession - 3` are included. For session 4 (the first session where there are exactly 3 older ones), this fetches sessions older than session 1, i.e., sessions 0 and below — an empty set. The rolling summary is then cleared (`updateRollingSummary(campaignId, null)`).

The intent is to keep L2 = 3 most recent recaps and roll up everything older than that. For session 4, sessions 1 through 1 (sessions 1, but not the L2 window of sessions 2, 3, 4) should be in L3. The correct cutoff is `getOlderThan(campaignId, savedSession.sessionNumber - 2)` (keep the most recent 3 sessions = N, N-1, N-2 in L2; summarize everything < N-2).

The D-06 recovery helper uses `lastUnsummarized.sessionNumber - 2` (line 68 of sessions.ts), confirming the correct value is `- 2`, not `- 3`.

**Fix:**
```typescript
// Line 215 in src/main/trpc/routers/sessions.ts:
// Change:
const olderSessions = sessionsRepo.getOlderThan(
  campaignId,
  savedSession.sessionNumber - 3,  // BUG: one off
)
// To:
const olderSessions = sessionsRepo.getOlderThan(
  campaignId,
  savedSession.sessionNumber - 2,  // Keeps N, N-1, N-2 in L2; rolls up < N-2
)
```

---

### CR-04: `useRecapStream` registers listeners in `useEffect` but `startRecap` is called BEFORE the effect runs — `onFinish` may never fire

**File:** `src/renderer/src/hooks/useRecapStream.ts:80-98` / `src/renderer/src/components/EndSessionModal.tsx:56-65`

**Issue:** In `EndSessionModal`, the call sequence on open is:

1. `useEffect([open, sessionId])` fires — calls `recap.startRecap()`.
2. `useRecapStream.startRecap()` calls `window.sessionRecap.startStream(...)` immediately.
3. The `useEffect([campaignId, sessionId])` inside `useRecapStream` also fires to register the `onToken`/`onFinish`/`onError` listeners.

React processes effects in declaration order within a component, but `useRecapStream` is a custom hook called at the top of `EndSessionModal` — its internal `useEffect` (hook effect) runs in the order hooks are encountered. The problem: both effects have dependency arrays and run asynchronously after paint. The order of execution between the `EndSessionModal` effect (which calls `startRecap`) and the `useRecapStream` internal effect (which registers listeners) is **not guaranteed** — they both see the same render's state changes. In practice, on the very first open when `open` changes from false to true and `sessionId` also appears, both effects fire in the same commit. If `startStream` resolves and IPC events arrive before the `onToken`/`onFinish` listeners are registered, tokens are silently dropped.

More concretely: `window.sessionRecap.startStream` is an `ipcRenderer.invoke` that triggers main-process streaming. The main process immediately starts the `for await` loop. Initial chunks can arrive as IPC messages before the renderer-side listener registration effect runs.

Additionally, `useRecapStream` does NOT reset `recapText`/`finalText` in its effect — it only registers listeners. `startRecap` resets state correctly, but if the component re-renders between startRecap and listener registration, stale state renders during the brief window.

**Fix:** Register listeners before calling `startStream`. Move listener registration into `startRecap` itself, or ensure the `useEffect` in `useRecapStream` runs and registers listeners synchronously before `startRecap` is called:

```typescript
// In useRecapStream, separate listener registration from startRecap call.
// Always register listeners in the useEffect (correct), but guard startRecap
// so it only fires after the effect has run at least once.

// Simplest fix: in EndSessionModal, do not call startRecap in the same
// useEffect that responds to `open`. Instead, use a separate effect that
// fires one render later, or call startStream inside the listeners effect.

// In useRecapStream.ts:
const listenersRegisteredRef = useRef(false)

useEffect(() => {
  window.sessionRecap.onToken(...)
  window.sessionRecap.onFinish(...)
  window.sessionRecap.onError(...)
  listenersRegisteredRef.current = true
  return () => {
    window.sessionRecap.removeAllListeners()
    listenersRegisteredRef.current = false
  }
}, [campaignId, sessionId])

// startRecap checks listenersRegisteredRef before invoking startStream.
```

---

### CR-05: `sessions.end` mutation called without `await` in the end-session flow — session never marked ended in DB before saveRecap

**File:** `src/main/trpc/routers/sessions.ts:158-168`

**Issue:** Looking at the flow: when the player clicks "Save Session" in `EndSessionModal`, `saveMutation` calls `trpc.sessions.saveRecap.mutate(...)`. The `saveRecap` procedure calls `sessionsRepo.saveRecap(sessionId, aiRecap, playerNotes)` which persists the recap — but it does NOT call `sessionsRepo.end(sessionId)` to set `endedAt`. The `sessions.end` procedure is separate. 

Tracing the UI: in `CampaignViewScreen`, there is no explicit call to `sessions.end` before or after `sessions.saveRecap`. The `EndSessionModal.onSuccess` calls `useSessionStore.getState().endSession()` (renderer-side store) and `queryClient.invalidateQueries(...)`. The DB session row never has `endedAt` set through the normal end-session flow, only through the `before-quit` raw SQL in `index.ts`.

This means `sessionsRepo.getLastNCompleted` (which filters `isNotNull(sessions.endedAt)`) will never return the session that was just "ended" through the UI. It won't appear in the Journal, it won't be included in L2 context for the next session, and it won't be considered for L3 rolling summary. The entire session is invisible to future AI context.

**Fix:** `saveRecap` procedure must also call `sessionsRepo.end(sessionId)` before persisting the recap, or `EndSessionModal` must call `sessions.end` mutation first:

```typescript
// In src/main/trpc/routers/sessions.ts saveRecap procedure (line ~191):
.mutation(({ input }) => {
  // End the session first (set endedAt)
  sessionsRepo.end(input.sessionId)
  // Then persist recap + notes
  sessionsRepo.saveRecap(input.sessionId, input.aiRecap, input.playerNotes ?? null)
  // ...rest of handler
```

---

## Warnings

### WR-01: D-06 recovery uses wrong threshold — same off-by-one as CR-03

**File:** `src/main/trpc/routers/sessions.ts:68`

**Issue:** `runD06Recovery` calls `sessionsRepo.getOlderThan(campaignId, lastUnsummarized.sessionNumber - 2)`. This is actually one step closer to correct than the `saveRecap` bug (CR-03), but the semantics are still inconsistent: D-06 recovery rolls up sessions older than `lastUnsummarized - 2`, while the normal `saveRecap` path rolls up sessions older than `currentSession - 3`. These two code paths will produce different rolling summaries for the same state, depending on which path ran. They should use the same constant. Extract the L2 window size (`3`) to a shared constant.

**Fix:**
```typescript
// src/main/trpc/routers/sessions.ts (top of file)
const L2_WINDOW_SIZE = 3  // number of recent sessions kept in L2

// In saveRecap (CR-03 fix already changes this):
getOlderThan(campaignId, savedSession.sessionNumber - (L2_WINDOW_SIZE - 1))

// In runD06Recovery:
getOlderThan(campaignId, lastUnsummarized.sessionNumber - (L2_WINDOW_SIZE - 1))
```

---

### WR-02: `saveRecap` clears the rolling summary to `null` when `olderSessions` is empty — destroys existing L3 memory

**File:** `src/main/trpc/routers/sessions.ts:220-223`

**Issue:** When `olderSessions.length === 0`, the handler calls `campaignsRepo.updateRollingSummary(campaignId, null)`. This unconditionally clears any existing rolling summary. Consider a campaign with 10 sessions where sessions 1-6 are already summarized and stored in `rollingSummary`. On session 7 end, `getOlderThan(campaignId, 7 - 2)` returns sessions older than 5 (sessions 1-4), which is non-empty — fine. But due to the off-by-one (CR-03), it calls `getOlderThan(campaignId, 7 - 3)` which returns sessions older than 4 (sessions 1-3) — also non-empty in this case, but the cutoff inconsistency from CR-03 means the already-summarized sessions 4-6 are re-included, generating a shorter summary.

The `null` clearing specifically fires on early sessions (when session number ≤ 3 with the bug, or ≤ 2 with the fix), but it still destroys a potentially valid rolling summary that was set externally or by D-06 recovery. The guard should be "if there are no old sessions AND there was never a summary", not "always clear it".

**Fix:**
```typescript
if (olderSessions.length === 0) {
  // Only clear if no summary exists yet — don't destroy an existing one
  const campaign = campaignsRepo.get(campaignId)
  if (!campaign?.rollingSummary) {
    // Nothing to do — L3 is already empty
  }
  // Do NOT call updateRollingSummary(campaignId, null) here
  return
}
```

---

### WR-03: `useRecapStream` listener effect does not reset `recapText`/`finalText` when `sessionId` changes — stale recap displayed

**File:** `src/renderer/src/hooks/useRecapStream.ts:80-98`

**Issue:** When `sessionId` changes (e.g., the user closes `EndSessionModal` and re-opens it for a different session), the `useEffect` cleanup calls `removeAllListeners()` and re-registers them. However, `recapText`, `finalText`, and `isStreaming` are NOT reset on effect re-run — they retain the values from the previous session. If the modal is opened, recap streams, then closed before saving, and then opened again for the same or a different session, stale text from the previous recap appears momentarily (or permanently if `startRecap` isn't called again).

`startRecap` does reset state, but only when it is called. If `startRecap` is NOT called after a re-open (e.g., because the `open` effect guard `if (open && sessionId)` runs but there's a React StrictMode double-invoke), the stale state persists.

**Fix:** Reset state in the cleanup/re-run of the dependency effect:
```typescript
useEffect(() => {
  // Reset state when session changes
  setRecapText('')
  setFinalText('')
  setIsStreaming(false)
  setError(null)

  window.sessionRecap.onToken(...)
  window.sessionRecap.onFinish(...)
  window.sessionRecap.onError(...)

  return () => {
    window.sessionRecap.removeAllListeners()
  }
}, [campaignId, sessionId])
```

---

### WR-04: `sessions.end` procedure clears `sessionActiveMap` using the session's `campaignId` — but the tRPC procedure result is the updated session from DB, not the input. If the update fails mid-flight, the map is cleared anyway.

**File:** `src/main/trpc/routers/sessions.ts:158-168`

**Issue:** The `end` procedure calls `sessionsRepo.end(input.sessionId)` then `sessionActiveMap.clear(session.campaignId)`. However, `sessionsRepo.end` throws if the session is not found. In that scenario the `sessionActiveMap` entry is never cleared. More importantly, if `sessionsRepo.end` does succeed but returns a stale row (DB write race), the in-memory map is cleared even though there is a valid active session. The architectural gap is that `sessions.end` is not called anywhere in the normal UI flow (per CR-05 above), making this procedure unused in practice.

**Fix:** Address CR-05 first. Then ensure `end` and `saveRecap` are called together in a single procedure or transaction to keep DB state and in-memory map consistent.

---

### WR-05: `before-quit` raw SQL uses millisecond epoch but `ended_at` column is `integer` in `timestamp_ms` mode — values may be rounded

**File:** `src/main/index.ts:492`

**Issue:** `getDb().$client.prepare('UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL').run(Date.now())` stores a millisecond timestamp. The Drizzle schema declares `endedAt` as `integer('ended_at', { mode: 'timestamp_ms' })`. Drizzle's `timestamp_ms` mode stores and reads the raw integer as milliseconds. This is consistent — the raw SQL and Drizzle ORM agree on the unit. However, the `sessionsRepo.end` method uses `new Date(Date.now())` and passes it to Drizzle's typed update, which Drizzle automatically converts to a ms integer. The raw SQL bypasses Drizzle, but the math is the same. No correctness bug, but worth noting as a maintenance risk if the column mode ever changes.

This is informational. Raising as a warning because the bypass of the ORM layer is a maintenance footgun — if the column mode changes, the raw SQL will not be updated automatically.

**Fix:** Consider a comment on the `before-quit` block stating the column mode assumption, or use Drizzle's `$client.prepare` with an explicit column name cross-reference.

---

### WR-06: `L1 overflow` flag is never reset when a new session starts — persists across sessions

**File:** `src/renderer/src/stores/sessionStore.ts:52-59`

**Issue:** `startSession` correctly resets `isL1Overflow: false`. However, `setL1Overflow(true)` is called from a `window.aiStream.onFinish` handler registered in `CampaignViewScreen` with an empty dependency array (line 136-144). This handler is registered ONCE on mount and is never cleaned up (no `removeAllListeners` call, and `useAiStream` calls `removeAllListeners` in its own cleanup which also removes THIS handler). When `useAiStream` unmounts (e.g., campaign navigation), its `removeAllListeners` call removes the `onFinish` listener registered by `CampaignViewScreen` as well, because `ipcRenderer.removeAllListeners` removes ALL listeners for the channel, not just those registered by the caller.

This creates two bugs:
1. After `useAiStream` re-mounts (campaign re-navigate), the L1 overflow listener registered at line 137 is gone.
2. The L1 overflow warning can get stuck `true` across a session boundary if `startSession` is not called before the next `ai:finish` event.

**Fix:** Register the L1 overflow listener inside `useAiStream` itself (where the stream lifecycle is managed), passing the `isL1Overflow` flag up via a callback, rather than adding a second independent `onFinish` listener in `CampaignViewScreen`.

---

### WR-07: `getOlderThan` in `sessionsRepo` does not filter `isSummarized = false` — already-summarized sessions are re-included in rolling summary generation

**File:** `src/main/db/sessionsRepo.ts:103-117`

**Issue:** `getOlderThan` returns all completed sessions older than a given session number regardless of `isSummarized`. The `saveRecap` rolling summary handler uses this to assemble the list of sessions to summarize. Sessions that were already incorporated into the previous rolling summary (marked `isSummarized = true`) are fed to `generateRollingSummary` again. This means every time a new session ends, the AI is re-summarizing the same historical sessions rather than doing an incremental update.

This is not data corruption, but it wastes tokens, produces a slightly different summary each time (temperature 0.3 is not 0), and ignores the `isSummarized` flag's purpose.

**Fix:** Add an `isSummarized = false` filter to `getOlderThan`, or create a separate `getUnsummarizedOlderThan` query for use in the rolling summary generation path.

---

## Info

### IN-01: `recapGenerator.ts` exports `generateSessionRecap` but it is never called from any file in scope — only `generateRollingSummary` and `RECAP_SYSTEM_PROMPT` are used

**File:** `src/main/ai/recapGenerator.ts:52`

**Issue:** `generateSessionRecap` (which uses `generateText`) was presumably the original recap approach. The actual implementation uses `streamText` directly in the `ai:recap-start` IPC handler in `index.ts`, duplicating the model-building and system-prompt logic. `generateSessionRecap` is now dead code. `RECAP_SYSTEM_PROMPT` is correctly shared (exported and used in `index.ts`).

**Fix:** Either remove `generateSessionRecap` or refactor `index.ts:443-455` to call `generateSessionRecap` (swapping `streamText` for `generateText` if streaming is not desired, or keeping streaming and moving the logic into a `streamSessionRecap` function in `recapGenerator.ts` for co-location).

---

### IN-02: `aiConfigSchema` in `schemas.ts` allows `endpointUrl` and `fallbackEndpointUrl` as optional (no `.optional()` guard on the URL format) — empty string will fail Zod `z.string().url()` validation

**File:** `src/main/trpc/schemas.ts:22`

**Issue:** `endpointUrl: z.string().url().optional()` — if the user submits an empty string for `endpointUrl`, Zod will throw a validation error because `""` is not a valid URL. The field should use `.optional().or(z.literal(''))` or `.nullable()` to allow clearing the endpoint URL. This can cause the AI settings save to fail silently when a user tries to clear a previously set endpoint URL.

**Fix:**
```typescript
endpointUrl: z.string().url().optional().or(z.literal('')),
fallbackEndpointUrl: z.string().url().optional().or(z.literal('')),
```

---

### IN-03: `CampaignViewScreen` calls `useAiStream(id ?? '')` before the `!id` guard — `id` can be `undefined` and the hook fires with an empty string

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:45`

**Issue:** `useAiStream(id ?? '')` is called unconditionally before the `if (!id) return` guard at line 192. When `id` is `undefined` (no route param), `useAiStream('')` is called with an empty campaignId string. If `useAiStream` makes any IPC calls with this empty string, the Zod UUID validator on the main process will throw. The comment on line 44 acknowledges this but the fix is not implemented.

This is currently safe only because `useAiStream` presumably guards against empty campaignId internally before making IPC calls. Without reading that file, the risk is latent.

**Fix:** Move the `!id` guard before all hook calls, or pass `id` as `string | undefined` and have hooks handle `undefined` cleanly. React rules of hooks prevent conditional hook calls, so the correct fix is to hoist the guard or use a wrapper component that only renders when `id` is defined.

---

_Reviewed: 2026-05-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
