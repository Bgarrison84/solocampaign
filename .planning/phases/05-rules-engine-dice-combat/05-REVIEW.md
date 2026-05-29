---
phase: 05-rules-engine-dice-combat
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - electron.vite.config.ts
  - src/main/ai/aiMetrics.ts
  - src/main/ai/aiSessionState.ts
  - src/main/ai/contextBuilder.ts
  - src/main/ai/llmProvider.ts
  - src/main/ai/mutationPipeline.ts
  - src/main/ai/toolSchemas.ts
  - src/main/db/campaignEventsRepo.ts
  - src/main/db/campaignsRepo.ts
  - src/main/db/characterSpellsRepo.ts
  - src/main/db/charactersRepo.ts
  - src/main/db/combatantsRepo.ts
  - src/main/db/messagesRepo.ts
  - src/main/db/schema.ts
  - src/main/db/sessionsRepo.ts
  - src/main/index.ts
  - src/main/trpc/router.ts
  - src/main/trpc/routers/ai.ts
  - src/main/trpc/routers/campaigns.ts
  - src/main/trpc/routers/characters.ts
  - src/main/trpc/routers/combat.ts
  - src/main/trpc/routers/sessions.ts
  - src/main/trpc/routers/spells.ts
  - src/main/trpc/schemas.ts
  - src/preload/index.ts
  - src/renderer/src/components/AiSettingsModal.tsx
  - src/renderer/src/components/CharacterSheetTab.tsx
  - src/renderer/src/components/ChatInputArea.tsx
  - src/renderer/src/components/CombatTrackerTab.tsx
  - src/renderer/src/components/DiceRollerPopover.tsx
  - src/renderer/src/components/LevelUpModal.tsx
  - src/renderer/src/components/MutationChipStack.tsx
  - src/renderer/src/components/RestPickerDialog.tsx
  - src/renderer/src/components/ShortRestHitDiceModal.tsx
  - src/renderer/src/components/StoryScrollPanel.tsx
  - src/renderer/src/components/sheet/LevelUpBanner.tsx
  - src/renderer/src/components/sheet/SpellListSection.tsx
  - src/renderer/src/hooks/useRecapStream.ts
  - src/renderer/src/lib/dice.ts
  - src/renderer/src/screens/CampaignViewScreen.tsx
  - src/renderer/src/stores/combatStore.ts
  - src/renderer/src/stores/sessionStore.ts
  - src/renderer/src/types/aiStream.d.ts
findings:
  critical: 6
  warning: 9
  info: 4
  total: 19
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

Phase 05 adds a rules engine, dice/combat infrastructure, mutation pipeline, and the rest/level-up systems on top of the Phase 04 session layer. The architecture is coherent and the security model (contextBridge, Zod validation, key-never-in-renderer) is well-executed. However, several bugs and edge-case gaps exist that can cause data corruption, silent failures, or incorrect game state. Six findings are blockers.

---

## Critical Issues

### CR-01: `onError` callback in `streamChat` re-throws instead of calling the callback — streaming errors are swallowed silently

**File:** `src/main/index.ts:362-366`

**Issue:** The `streamChat` callback object passed in `withRetry` defines `onError` as:
```ts
onError: (err) => {
  throw err
}
```
Inside `streamChat`, `onError` is called inside a `try/catch` block. When `onError` re-throws, the throw is caught by the outer `try/catch` in `streamChat` itself (`catch (err)` at line 189), which then calls `callbacks.onError(error)` — creating a tight recursion path that calls the caller's `onError` again and re-throws, potentially causing unhandled rejection or infinite loop depending on the error origin. More critically, `withRetry` wraps the `streamChat` call and is supposed to catch the thrown error to decide whether to retry; but `streamChat` swallows the thrown error in its own `catch` and calls `onError` instead of propagating the throw. This means `withRetry` never sees the error, never retries, and the error path may produce an `ai:error` IPC event without retrying at all.

**Fix:** Remove `onError` from the callback object passed to `streamChat` and instead structure so that streaming errors propagate as thrown rejections that `withRetry` can observe:
```ts
return streamChat(providerConfig, messages, systemPrompt, {
  onToken: (chunk) => { /* ... */ },
  onFinish: () => { /* ... */ },
  onError: (err) => { throw err }, // must remain — streamChat needs this shape
}, options)
// withRetry catches the re-throw from the callback chain
```
Alternatively, verify the retry implementation actually wraps the returned promise such that a re-thrown `onError` propagates. Trace `withRetry` carefully — if the retry never fires, all stream errors are permanent failures after one attempt.

---

### CR-02: `onToolCallsFinish` accesses `tc.input` but the AI SDK v6 tool-call property is `tc.args` — native tool calls always produce empty args

**File:** `src/main/ai/llmProvider.ts:179-183`

**Issue:**
```ts
const normalized = (toolCalls ?? []).map((tc) => ({
  toolName: tc.toolName as string,
  args: (tc as { input?: unknown }).input,   // ← wrong field name
}))
```
The comment at the top of this file says "AI SDK v6 renamed CoreMessage to ModelMessage." The AI SDK v6 tool-call object shape uses `tc.args` (not `tc.input`, which was the v4 field). Accessing `.input` on a v6 tool call will always yield `undefined`, causing every Zod `safeParse` in `mutationPipeline.ts` to fail with "invalid args" and every native tool call to be silently skipped. Only the JSON-tail fallback will work, degrading providers that do support native tool calling.

**Fix:**
```ts
const normalized = (toolCalls ?? []).map((tc) => ({
  toolName: tc.toolName as string,
  args: tc.args,   // AI SDK v6 field
}))
```
Confirm against the installed version of `ai` that `.args` is the correct field name (check `node_modules/ai/dist/index.d.ts`).

---

### CR-03: `characterSpellsRepo.seed` is not wrapped in a transaction — partial spell list written on failure

**File:** `src/main/db/characterSpellsRepo.ts:21-35`

**Issue:** The `seed` method deletes all existing spells then inserts new ones in a loop, each as a separate `.run()` call outside any transaction:
```ts
db.delete(characterSpells).where(...).run()
for (const spell of spells) {
  db.insert(characterSpells).values({...}).run()
}
```
If the process crashes or an insert fails mid-loop (e.g., duplicate `id` from UUID collision, or a disk error), the character will have a partially seeded spell list or no spells at all. `better-sqlite3` does not auto-wrap multiple statements in a transaction. The character spell list is shown in the spell sheet and used by the cast flow — a half-populated list would silently break the UI.

**Fix:**
```ts
seed(characterId, spells) {
  const db = getDb()
  db.transaction(() => {
    db.delete(characterSpells).where(eq(characterSpells.characterId, characterId)).run()
    for (const spell of spells) {
      db.insert(characterSpells).values({
        id: randomUUID(),
        characterId,
        spellName: spell.spellName,
        spellLevel: spell.spellLevel,
        isPrepared: spell.isPrepared,
      }).run()
    }
  })
},
```

---

### CR-04: `sessions.saveRecap` calls `sessionsRepo.end()` then `sessionsRepo.saveRecap()` — if `saveRecap` fails the session is ended but the recap is lost

**File:** `src/main/trpc/routers/sessions.ts:191-193`

**Issue:**
```ts
sessionsRepo.end(input.sessionId)       // sets endedAt
sessionsRepo.saveRecap(input.sessionId, input.aiRecap, ...)  // writes recap
```
These are two separate DB writes. If `saveRecap` throws (e.g., DB contention), the session is permanently marked ended with `endedAt` set but `aiRecap` is null. The session will appear in the Journal as completed but with no recap. It will also never be re-offered for re-generation because `isSummarized` remains false and the rolling summary code will attempt to use its (empty) `aiRecap`. The two operations should run atomically.

**Fix:** Combine into a single transaction, or expose a `endAndSaveRecap` method on `sessionsRepo` that does both inside `db.transaction()`:
```ts
// In sessionsRepo:
endAndSaveRecap(sessionId, aiRecap, playerNotes?) {
  db.transaction(() => {
    db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, sessionId)).run()
    db.update(sessions).set({ aiRecap, playerNotes }).where(eq(sessions.id, sessionId)).run()
  })
}
```

---

### CR-05: `updateHp` for the player character in `mutationPipeline.ts` uses `charactersRepo.updateHp(charId, delta)` which performs a DB-level clamp, but `combatantsRepo.updateHp` receives a pre-clamped absolute value computed from a stale cache — race condition possible

**File:** `src/main/ai/mutationPipeline.ts:137-148`

**Issue:** The combatant HP update path reads the current combatant HP from `combatantsRepo.listActive()` (a snapshot), computes the clamped new value, then writes it as an absolute value:
```ts
const combatant = combatantsRepo.listActive(campaignId).find((c) => c.id === combatantId)
if (!combatant) return
const next = Math.max(0, Math.min(combatant.hpMax, combatant.hpCurrent + delta))
combatantsRepo.updateHp(combatantId, next)
```
This runs inside `applyMutationBatch`, which is called from `onToolCallsFinish` (async). If the player or another AI tool call modified the combatant's HP between the `listActive` snapshot and the `updateHp` write, the intermediate change is silently overwritten. This is a TOCTOU race: the entire batch runs inside `db.transaction()`, but `listActive` and `updateHp` are separate transactions — the outer `db.transaction()` in `applyMutationBatch` wraps `applyOneTool` calls, but `combatantsRepo.updateHp` is called without being inside that transaction scope because it uses `getDb()` internally and is called from within the outer transaction callback — in `better-sqlite3` this is fine IF the outer transaction uses the same connection. Verify that nested transactions via `getDb()` are safe in better-sqlite3 (they may silently succeed as savepoints, but if the inner call commits independently it breaks atomicity). If the pipeline processes multiple HP updates for the same combatant in one batch, the second read will see the old snapshot value and its delta will be lost.

**Fix:** Use a delta-based SQL update for combatants matching the player character pattern, or lock the combatant row within the transaction before reading. Alternatively ensure that within a batch, the in-memory combatant state is updated after each tool call so subsequent calls in the same batch see the mutated value.

---

### CR-06: `ai:recap-start` IPC handler maps ALL messages including `dice_roll` and `system` roles to the AI SDK `ModelMessage` type with `role: 'user' | 'assistant'` — malformed message causes provider API error

**File:** `src/main/index.ts:463-465`

**Issue:**
```ts
const sessionMessages: import('ai').ModelMessage[] = rawMessages.map((m) => ({
  role: m.role as 'user' | 'assistant',
  content: m.content,
}))
```
`messagesRepo.getBySessionId` returns all messages for the session, including rows with `role = 'dice_roll'` and `role = 'system'`. These are then cast to `'user' | 'assistant'` with `as`, bypassing TypeScript's type check. Sending a message with `role: 'dice_roll'` to an OpenAI-compatible or Gemini API will cause a 400/422 API error, which will be caught and returned to the renderer as a generic recap stream error. The recap will silently fail whenever a session contains AI dice rolls.

**Fix:** Filter to only `user` and `assistant` messages before passing to the AI SDK:
```ts
const sessionMessages: import('ai').ModelMessage[] = rawMessages
  .filter((m) => m.role === 'user' || m.role === 'assistant')
  .map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
```

---

## Warnings

### WR-01: `MutationChipStack` registers `onMutationsApplied` listener but does not remove it on unmount — listener leaks if component unmounts independently of `useAiStream`

**File:** `src/renderer/src/components/MutationChipStack.tsx:120-129`

**Issue:** The comment says "Cleanup: removeAllListeners is called by useAiStream's effect cleanup." However, `MutationChipStack` is rendered inside `CampaignViewScreen` which always renders `useAiStream`. If `MutationChipStack` ever unmounts while `CampaignViewScreen` stays mounted (e.g., tab navigation or future routing changes), the listener leaks and the component accumulates duplicate handlers. The cleanup only sets `chips` to `[]`, not removing the IPC listener:
```ts
return () => {
  setChips([])   // clears state but does NOT remove the IPC listener
}
```
`ipcRenderer.on` appends listeners; each mount adds one more.

**Fix:** Call `ipcRenderer.removeAllListeners` for the specific channel, or expose a `removeOnMutationsApplied` helper from the preload and call it in the effect cleanup.

---

### WR-02: `CampaignViewScreen` registers `onMutationsApplied` in two separate `useEffect` hooks — both accumulate listeners without cleanup

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:215-246`

**Issue:** Lines 215-227 and 237-246 each call `window.aiStream.onMutationsApplied(...)` in separate `useEffect` blocks. Both lack cleanup functions. Each re-render that triggers these effects (when `id` changes) adds another listener. While the comments say "Cleanup via removeAllListeners called by useAiStream", `useAiStream` only runs cleanup on its own unmount — not when `id` changes. If the user navigates between campaigns without unmounting the screen (unlikely with the current router, but fragile), listeners stack. Additionally, these effects do not remove listeners when `id` changes between campaigns.

**Fix:** Add explicit cleanup:
```ts
useEffect(() => {
  const handler = (payload) => { /* short rest logic */ }
  window.aiStream.onMutationsApplied(handler)
  return () => { /* ideally: ipcRenderer.removeListener('ai:mutations-applied', handler) */ }
}, [id])
```
The preload currently only exposes `removeAllListeners`, not per-listener removal. Either expose `removeListener` from the preload or ensure `removeAllListeners` is called on cleanup.

---

### WR-03: `updateCurrency` SQL uses `sql.raw(denomination)` — denomination column name is injected raw into SQL

**File:** `src/main/db/charactersRepo.ts:333`

**Issue:**
```ts
[denomination]: sql`MAX(0, ${sql.raw(denomination)} + ${delta})`,
```
`denomination` comes from the tRPC layer where it is validated by `z.enum(['cp', 'sp', 'ep', 'gp', 'pp'])`, so the input is already locked to five safe values. However, using `sql.raw()` with any variable is a dangerous pattern: if the Zod enum is ever relaxed or the `updateCurrency` function is called from a code path that bypasses the tRPC schema (e.g., the mutation pipeline's direct call at `mutationPipeline.ts:263`), a malicious or unexpected denomination value would be injected as literal SQL. The mutation pipeline calls `charactersRepo.updateCurrency(charId, denom, delta)` where `denom` iterates `['cp', 'sp', 'ep', 'gp', 'pp'] as const` — safe today, but fragile.

**Fix:** Use a lookup table to map denomination to a Drizzle column reference instead of `sql.raw`:
```ts
const DENOM_COL = {
  cp: characterResources.cp,
  sp: characterResources.sp,
  ep: characterResources.ep,
  gp: characterResources.gp,
  pp: characterResources.pp,
} as const
// then use delta-based SQL without sql.raw
```

---

### WR-04: `sessionsRepo.create` computes `sessionNumber` as `MAX(session_number) + 1` outside a transaction — concurrent session starts could produce duplicate session numbers

**File:** `src/main/db/sessionsRepo.ts:30-38`

**Issue:**
```ts
const maxRow = db.select({ max: sql<number>`MAX(session_number)` })...get()
const sessionNumber = (maxRow?.max ?? 0) + 1
db.insert(sessions).values({ ..., sessionNumber, ... }).run()
```
These are two separate statements without a wrapping transaction. In practice, Electron is single-process and `better-sqlite3` is synchronous, so actual concurrent access from two Node.js threads is impossible. However, two rapid tRPC calls (e.g., double-click Start Session) could race since tRPC mutations are async: the second `ipcMain.handle` invocation can be processed while the first is awaiting something else, but since better-sqlite3 is synchronous this is actually safe on the JS thread. The real risk is that the `sessions` table has no UNIQUE constraint on `(campaign_id, session_number)`, so if somehow a duplicate is written, the Journal tab will display duplicate session numbers silently.

**Fix:** Add a UNIQUE constraint on `(campaign_id, session_number)` to the schema so the DB itself enforces monotonicity regardless of how `create` is called.

---

### WR-05: `ShortRestHitDiceModal` allows rolling hit dice when `hitDiceCurrent` is 0 — the "Roll Hit Dice" button is only disabled for `< 1` but the stepper min is 1

**File:** `src/renderer/src/components/ShortRestHitDiceModal.tsx:136-140`

**Issue:**
```tsx
<Button
  ...
  onClick={handleRollHitDice}
  disabled={hitDiceCurrent < 1}   // disabled only when < 1 (i.e., 0 or negative)
>
```
`hitDiceCurrent` can be 0 when a character has spent all hit dice. The `Stepper` min is `1`, but the value is initialized to `diceToRoll = 1`. When `hitDiceCurrent = 0`, the button is disabled correctly, but the `Stepper` still shows `max={hitDiceCurrent}` which is 0, while `min=1`. This means the stepper's min exceeds its max when no hit dice remain. The `onChange` handler clamps to `Math.max(1, Math.min(hitDiceCurrent, prev + delta))`, which when `hitDiceCurrent = 0` means the max is 0, so the clamp yields `Math.max(1, 0)` = 1, keeping `diceToRoll` stuck at 1. If the modal is opened (it opens when the AI grants a short rest), the Stepper is in an inconsistent state: the button is disabled but the stepper shows "Roll how many? 1 (max: 0)".

**Fix:** Guard the modal body: if `hitDiceCurrent <= 0`, show a "No hit dice remaining" message and only render the Skip button. Or set `diceToRoll` to 0 and disable the stepper entirely.

---

### WR-06: `handleRoll` in `ChatInputArea` strips only the first dice-roll prefix via a regex that doesn't handle spell-cast prefixes — layered prefixes silently accumulate

**File:** `src/renderer/src/components/ChatInputArea.tsx:107`

**Issue:**
```ts
const stripped = existing.replace(/^\[[\w\d+\-*/]+: \d+\] /, '')
```
This regex matches dice-roll prefixes like `[d20: 14] `. Spell cast prefixes dispatched from `SpellListSection` look like `[Casting Fireball — 3rd level slot] `. The pattern `[\w\d+\-*/]+` does not match spaces, so a spell prefix is not stripped before prepending a new prefix. A player who first casts a spell (adding `[Casting Fireball — 3rd level slot] `) and then clicks a die button will end up with `[d20: 14] [Casting Fireball — 3rd level slot] their text` — a double prefix in the message. This is a UX bug that produces garbled AI context.

**Fix:** Generalize the stripping regex to handle any `[...] ` prefix at the start of the textarea value, or maintain separate prefix state that is applied on send rather than embedded in the textarea string.

---

### WR-07: `applyMutationBatch` is marked `async` and awaited, but the outer `db.transaction()` callback is synchronous — tool calls that themselves perform async work inside the transaction will silently break

**File:** `src/main/ai/mutationPipeline.ts:497-510`

**Issue:**
```ts
db.transaction(() => {
  for (const call of toolCalls) {
    try {
      applyOneTool(call.toolName, call.args, campaignId, sessionId, acc)
    } catch (err) { ... }
  }
})
```
`better-sqlite3` transactions must be synchronous. The transaction callback is called synchronously and returns immediately. `applyOneTool` is synchronous, so this is actually safe today. However, `applyMutationBatch` is declared `async` and `await`ed in two places in `index.ts`. The outer `db.transaction()` does not return a Promise; it returns the synchronous result of its callback. The `async` declaration creates a false expectation that the transaction itself is awaitable. If any future modification to `applyOneTool` adds an `await` inside (e.g., for an external call), the `db.transaction()` callback would return a Promise that `better-sqlite3` would treat as the synchronous return value — the transaction would commit before any awaited work finishes, causing partial mutations. This is a latent time bomb.

**Fix:** Either remove the `async` from `applyMutationBatch` (it does not need to be async — the only async path is the unused outer `await`) or add a comment warning that all code paths inside `db.transaction()` must remain synchronous forever.

---

### WR-08: `saveRecap` in the sessions tRPC router calls `sessionsRepo.end()` but the `end` procedure already ends the session — double-ending a session sets `endedAt` twice harmlessly, but the `end` tRPC procedure also clears `sessionActiveMap` and calling `saveRecap` without calling `end` first would leave the map dirty

**File:** `src/main/trpc/routers/sessions.ts:158-168` and `191-193`

**Issue:** The `end` tRPC procedure:
1. Calls `sessionsRepo.end(sessionId)` — sets `endedAt`
2. Calls `sessionActiveMap.clear(session.campaignId)` — clears in-memory map

The `saveRecap` tRPC procedure:
1. Calls `sessionsRepo.end(input.sessionId)` — sets `endedAt` again (harmless but wasteful)
2. Calls `sessionsRepo.saveRecap(input.sessionId, ...)` — saves recap
3. Calls `sessionActiveMap.clear(input.campaignId)` — clears in-memory map

If the UI calls `saveRecap` without first calling `end` (a valid code path, per the comment "CR-05: End the session first"), the map is cleared inside `saveRecap`. If the UI calls `end` then `saveRecap`, `sessionsRepo.end` is called twice. The second call updates `endedAt` to a later timestamp, meaning the `endedAt` value recorded in the DB is the time `saveRecap` was called, not the time `end` was called — this could make session durations appear slightly incorrect.

**Fix:** Remove the `sessionsRepo.end()` call from `saveRecap` and instead document that the caller must call `end` first. Or expose a single atomic `endAndSaveRecap` method.

---

### WR-09: `updateHpSchema` in `toolSchemas.ts` has no `min`/`max` bound on `delta` — the AI can send arbitrarily large or negative deltas to one-shot kill or heal any combatant

**File:** `src/main/ai/toolSchemas.ts:27-32`

**Issue:**
```ts
export const updateHpSchema = z.object({
  characterId: z.string().optional(),
  combatantId: z.string().optional(),
  delta: z.number().int(),   // ← no bounds
  source: z.string().max(100).optional(),
})
```
All other schemas with numeric game values are bounded (e.g., `hpMax: z.number().int().min(1).max(9999)`, `amount: z.number().int().min(0).max(1000000)`). `delta` on `updateHp` has no bounds, allowing the AI (or a malicious JSON-tail injection) to pass `delta: -999999` to instant-kill the player or `delta: 999999` to overflow HP. While DB-level clamping (`MAX(0, MIN(hp_max, hp_current + delta))`) prevents the HP from going below 0 or above max for the player, combatant HP is clamped differently (computed in pipeline, then written absolute), so a very negative delta would zero out a combatant correctly. The concern is primarily defensive: a bounded schema makes the security intent explicit.

**Fix:**
```ts
delta: z.number().int().min(-9999).max(9999),
```

---

## Info

### IN-01: `spellsRouter.listByCharacter` does not validate `characterId` as a UUID

**File:** `src/main/trpc/routers/spells.ts:94-98`

**Issue:**
```ts
.input(z.object({ characterId: z.string() }))
```
All other character-targeting procedures use `characterIdSchema = z.string().uuid()`. This procedure accepts any string. While this does not allow SQL injection (Drizzle uses parameterized queries), it is inconsistent with the rest of the codebase's input hygiene.

**Fix:** Use `z.string().uuid()` for `characterId` in `listByCharacter`, `castSpell`, `undoCast`, `updateConcentration`, and `seedFromJson`.

---

### IN-02: `LevelUpModal` uses `require()` for a static JSON asset inside a React render path — can throw synchronously and crash the sheet tab

**File:** `src/renderer/src/components/LevelUpModal.tsx:80-93`

**Issue:**
```ts
const spellsByClass = require('../../../../resources/spells-by-class.json') as Record<...>
```
`require()` inside a function is synchronous module loading. In Vite/Electron, bundled JSON is inlined, so this will not actually do a disk read. However, if the JSON shape is wrong (e.g., a future schema change) or the require path breaks in production packaging, the `catch {}` block silently returns `null`, meaning all level-up flows for spellcasters will show no new spell slots, and the player will level up without the correct slot table — a silent data gap. Additionally, calling `require()` in the renderer process is not standard practice for bundled assets.

**Fix:** Import the JSON statically at the module level: `import spellsByClass from '../../../../resources/spells-by-class.json'` and use it directly. This makes bundler errors visible at build time rather than silently at runtime.

---

### IN-03: `log.initialize()` is called at the bottom of `src/main/index.ts` after `app.whenReady()` — log entries before initialization may be lost

**File:** `src/main/index.ts:554`

**Issue:** `log.initialize()` is called at the very bottom of the file, after all `app.on(...)` registrations and the entire `app.whenReady()` block. Any `log.error()` or `log.info()` call that fires during database or secret storage initialization (lines 49-68) occurs before `log.initialize()` has been called. `electron-log` works without explicit initialization but some transports (file transport in particular) may not be active until after `initialize()`.

**Fix:** Move `log.initialize()` to the very top of the file, before any other code:
```ts
import log from 'electron-log'
log.initialize()
```

---

### IN-04: `L1 overflow warning bar` in `CampaignViewScreen` never resets to `false` when a new session starts

**File:** `src/renderer/src/stores/sessionStore.ts:52-59`

**Issue:** `startSession()` sets `isL1Overflow: false`. However, in `CampaignViewScreen` at line 198-206, the `onFinish` handler only calls `setL1Overflow(true)` and never `setL1Overflow(false)`. Once the overflow warning appears in session N, it persists into session N+1 unless the user triggers another `ai:finish` event where `isL1Overflow` is false. The `sessionStore.startSession` call (triggered by `activeSessionQuery`) does reset the flag, but that query has `staleTime: undefined` (default), so it refetches on focus — the reset would fire on the next window focus after starting a new session, which is not deterministic. In the session store, `endSession()` also resets it. The flow is likely correct in practice but could show a stale warning banner at the start of a new session if the component re-renders before the session start effect runs.

**Fix:** This is low severity, but ensure `useSessionStore.getState().setL1Overflow(false)` is called explicitly when the session starts in the `useEffect` that watches `activeSessionQuery.data`.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
