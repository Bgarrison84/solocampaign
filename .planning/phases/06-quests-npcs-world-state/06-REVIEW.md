---
phase: 06-quests-npcs-world-state
reviewed: 2026-05-30T19:15:14Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - resources/migrations/0006_phase6_world_state.sql
  - src/main/ai/contextBuilder.test.ts
  - src/main/ai/contextBuilder.ts
  - src/main/ai/llmProvider.ts
  - src/main/ai/mutationPipeline.test.ts
  - src/main/ai/mutationPipeline.ts
  - src/main/ai/toolSchemas.test.ts
  - src/main/ai/toolSchemas.ts
  - src/main/db/campaignsRepo.ts
  - src/main/db/factionsRepo.test.ts
  - src/main/db/factionsRepo.ts
  - src/main/db/npcsRepo.test.ts
  - src/main/db/npcsRepo.ts
  - src/main/db/questsRepo.test.ts
  - src/main/db/questsRepo.ts
  - src/main/db/schema.ts
  - src/main/index.ts
  - src/main/trpc/router.ts
  - src/main/trpc/routers/npcs.ts
  - src/main/trpc/routers/quests.ts
  - src/main/trpc/routers/worldState.ts
  - src/renderer/src/components/MutationChipStack.tsx
  - src/renderer/src/components/NpcTrackerTab.tsx
  - src/renderer/src/components/QuestsTab.tsx
  - src/renderer/src/screens/CampaignViewScreen.tsx
  - src/renderer/src/styles/globals.css
  - src/renderer/src/types/aiStream.d.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: fixed
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-30T19:15:14Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 06 adds quest/NPC/faction tracking, world-state columns on campaigns, 8 new AI tool schemas, 3 tRPC routers, and UI components for quests and NPCs. The data model, schema, and repos are sound. The tool schemas have correct Zod bounds and all 20 tools are properly registered without `execute` properties. The system-prompt injection order matches the spec.

Three critical issues were found: a listener-accumulation bug in `CampaignViewScreen` that causes multiple short-rest modals to open per mutation event, an unsafe type assertion in `MutationChipStack` that bypasses the discriminated union and allows unknown chip types to reach `iconFor`, and a missing campaign-ownership check in `updateQuestStatus`/`updateNpc` that lets the AI update rows from other campaigns by guessing a UUID.

---

## Critical Issues

### CR-01: `removeOnMutationsApplied` removes ALL listeners — both `useEffect` registrations in CampaignViewScreen clobber each other

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:260-294`

**Issue:** Two independent `useEffect` hooks both call `window.aiStream.onMutationsApplied(handler)` and both call `window.aiStream.removeOnMutationsApplied()` in their cleanup. The preload's `removeOnMutationsApplied` removes **all** listeners for the channel, not just the one registered by that particular effect.

Execution sequence on mount:
1. Effect A (short-rest detector, line 260) registers `shortRestHandler`.
2. Effect B (cache-invalidation, line 276) registers `cacheInvalidationHandler`.
3. When Effect A's cleanup runs (e.g. `id` changes), it calls `removeOnMutationsApplied()`, silently removing Effect B's `cacheInvalidationHandler` as well.
4. Conversely, Effect B cleanup removes Effect A's handler.

After the first `id` change, cache invalidation stops working silently. Additionally, when Effect A re-registers its handler after cleanup, `MutationChipStack`'s own listener is also removed (the component's cleanup comment at line 146 explicitly warns about this, but the cross-component removal happens here, not there).

The identical bug was noted as "WR-02" in the comments but the fix was never applied — both effects share a single removal primitive that is not scoped to individual callbacks.

**Fix:** The preload must accept a specific callback for removal, or each effect must use a token/ID returned at registration time. Minimal fix without changing the preload API: consolidate both handlers into one `useEffect` that registers a single `onMutationsApplied` listener dispatching to both concerns, so a single `removeOnMutationsApplied` call is correct:

```typescript
useEffect(() => {
  const handler = (payload: MutationsAppliedPayload) => {
    // --- short-rest detection ---
    if (id && payload.campaignId === id) {
      const hasShortRest = payload.chips.some(
        (c) => c.type === 'rest' && c.label === 'Short rest taken',
      )
      if (hasShortRest) setShowShortRest(true)
    }
    // --- cache invalidation ---
    if (id && payload.campaignId === id) {
      queryClient.invalidateQueries({ queryKey: ['combat', 'listActive', id] })
      queryClient.invalidateQueries({ queryKey: ['characters', 'getByCampaignId', id] })
      queryClient.invalidateQueries({ queryKey: ['ai', 'getMessages', id] })
      queryClient.invalidateQueries({ queryKey: ['quests', 'list', id] })
      queryClient.invalidateQueries({ queryKey: ['npcs', 'list', id] })
      queryClient.invalidateQueries({ queryKey: ['factions', 'list', id] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'get', id] })
    }
  }
  window.aiStream.onMutationsApplied(handler)
  return () => { window.aiStream.removeOnMutationsApplied() }
}, [id, queryClient])
```

---

### CR-02: Unsafe `as DisplayChip[]` cast in `MutationChipStack` — unknown `type` values bypass the discriminated union guard

**File:** `src/renderer/src/components/MutationChipStack.tsx:126`

**Issue:** The incoming payload chips are cast directly to `DisplayChip[]` with `payload.chips as DisplayChip[]`. The `MutationsAppliedPayload` type (declared in `aiStream.d.ts`) defines `type` as `string`, not as the `ChipType` union. The pipeline could emit a chip type not listed in `ChipType` (e.g. from a future tool or a JSON-tail mutation with a typo), and the cast would silently pass the value through to `iconFor`. The `default` branch in `iconFor` renders a `<Star>` icon, so there is no crash, but the UX is wrong and any future exhaustiveness check on the `switch` would not catch the gap.

More critically, the cast suppresses TypeScript's ability to catch mismatches between the pipeline's `MutationChip.type` union and the renderer's `ChipType` union. They are currently in sync, but they live in two separate files with no shared source of truth — the cast makes them silently diverge.

**Fix:** Validate at runtime before rendering rather than casting:

```typescript
const VALID_CHIP_TYPES = new Set<ChipType>([
  'hp','xp','condition','slot','currency','combat','rest',
  'quest','quest_complete','npc','inspiration',
])

const handler = (payload: MutationsAppliedPayload) => {
  const incoming: DisplayChip[] = payload.chips
    .filter((c): c is DisplayChip => VALID_CHIP_TYPES.has(c.type as ChipType))
  // ...
}
```

---

### CR-03: No campaign-ownership check on `updateQuestStatus` and `updateNpc` — AI can update rows from other campaigns

**File:** `src/main/db/questsRepo.ts:54`, `src/main/db/npcsRepo.ts:63`

**Issue:** `questsRepo.updateStatus(questId, status)` and `npcsRepo.patch(npcId, fields)` update by primary key alone. They do not verify that the target row belongs to the `campaignId` currently being processed.

In the mutation pipeline (`mutationPipeline.ts` line 426, 462), `campaignId` is available, but it is never threaded into the repo calls. An AI (or a JSON-tail forgery) that injects a valid quest/NPC UUID from a different campaign — which is possible once the UUID is visible in any log or event record — can silently overwrite state from that other campaign.

The `updateWorldTime` and `updateLocation` calls on `campaignsRepo` are scoped by `campaignId` already, so those are safe.

**Fix:** Add a `campaignId` parameter to `updateStatus` and `patch`, and include it as a WHERE condition:

```typescript
// questsRepo.ts
updateStatus(questId: string, campaignId: string, status: string): void {
  const db = getDb()
  db.update(quests)
    .set({ status })
    .where(and(eq(quests.id, questId), eq(quests.campaignId, campaignId)))
    .run()
},

// npcsRepo.ts
patch(
  npcId: string,
  campaignId: string,
  fields: { description?: string; relationship?: string; factionName?: string | null },
): void {
  // ...
  db.update(npcs).set(set)
    .where(and(eq(npcs.id, npcId), eq(npcs.campaignId, campaignId)))
    .run()
},
```

Update the call sites in `mutationPipeline.ts` accordingly (lines 426 and 463).

---

## Warnings

### WR-01: `questsRepo.updateStatus` accepts any string status — schema validation in pipeline can be bypassed by JSON-tail

**File:** `src/main/db/questsRepo.ts:54`

**Issue:** `updateStatus(questId, status: string)` writes whatever string the caller provides. The mutation pipeline validates the `status` field with `updateQuestStatusSchema` (which constrains it to `'Active' | 'Completed' | 'Failed'`) before calling the repo, but the repo itself has no guard. Any caller that bypasses the pipeline (tests, future tRPC mutations, manual imports) can write arbitrary status values. The schema's `status` column in the DB has no CHECK constraint either — the migration stores raw text.

**Fix:** Either add a type guard in the repo or constrain the parameter type:

```typescript
updateStatus(questId: string, status: 'Active' | 'Completed' | 'Failed'): void {
```

---

### WR-02: `npcsRepo.patch` silently no-ops when `npcId` does not exist — no error surfaced

**File:** `src/main/db/npcsRepo.ts:63-74`

**Issue:** When `db.update(...).where(eq(npcs.id, npcId)).run()` matches zero rows (the AI supplied a stale or hallucinated NPC ID), `better-sqlite3` returns silently with `changes = 0`. The function returns `void` and the pipeline logs nothing. The `logEvent` call in the pipeline (line 468) still fires, creating a misleading audit trail entry that says `npc_updated` when no row was actually changed.

The same issue exists for `questsRepo.updateStatus`.

**Fix:** Check the `changes` count and log a warning:

```typescript
const result = db.update(npcs).set(set).where(eq(npcs.id, npcId)).run()
if (result.changes === 0) {
  log.warn('[npcsRepo] patch: no NPC row matched id', npcId)
  return  // caller should skip logEvent in this case
}
```

Alternatively, return a boolean from `patch`/`updateStatus` so the pipeline can conditionally fire `logEvent`.

---

### WR-03: `formatWorldStateSummary` calls `charactersRepo.getByCampaignId` inside `buildContext` — double DB call per AI message

**File:** `src/main/ai/contextBuilder.ts:180`, `src/main/ai/contextBuilder.ts:359`

**Issue:** `buildContext` calls `charactersRepo.getByCampaignId(campaignId)` at line 359 to build the character summary block. It then calls `formatWorldStateSummary(campaignId)` at line 377, which internally calls `charactersRepo.getByCampaignId(campaignId)` again at line 180 (to get `playerCharacterId` for the world-state summary). This is two round-trips to the DB for the same row on every AI message.

This is a correctness-adjacent quality issue because the two calls execute outside a transaction, so in theory they could return different data if a character update races between them (unlikely in single-user desktop app, but structurally wrong).

**Fix:** Pass the already-fetched `character` object into `formatWorldStateSummary` or extract `playerCharacterId` before calling the function:

```typescript
const character = charactersRepo.getByCampaignId(campaignId)
const worldStateSummary = formatWorldStateSummary(campaignId, character?.id)
```

---

### WR-04: `updateWorldTimeSchema` — all three fields (`timeOfDay`, `dayNumber`, `season`) are required; partial time updates are impossible

**File:** `src/main/ai/toolSchemas.ts:250-254`

**Issue:** The `updateWorldTimeSchema` has all three fields as required (no `.optional()`). This means the AI must know and re-emit the current day number even if it only wants to advance the time of day. If the AI is uncertain about `dayNumber` or `season` after a provider switch or context overflow, it will either fail validation entirely or hallucinate values for the other fields.

The tool description says "Provide the absolute time of day, day number, and season each time it changes", which is intentional, but the world-state summary only emits time when `worldTimeOfDay || worldDayNumber` is set — if only `worldSeason` is set with no time, neither the summary nor the AI sees it. More practically, a partial time update (e.g. time-of-day only) is a common use case that currently forces the AI to provide values it may not know.

**Fix:** Make all three fields optional and use partial updates in `campaignsRepo.updateWorldTime`:

```typescript
export const updateWorldTimeSchema = z.object({
  timeOfDay: z.enum(['Morning', 'Afternoon', 'Evening', 'Night']).optional(),
  dayNumber: z.number().int().min(1).max(99999).optional(),
  season: z.enum(['Spring', 'Summer', 'Autumn', 'Winter']).optional(),
}).refine(
  (d) => d.timeOfDay !== undefined || d.dayNumber !== undefined || d.season !== undefined,
  { message: 'At least one time field must be provided' }
)
```

---

### WR-05: `onMutationsApplied` in `MutationChipStack` is not removed on `MutationChipStack` cleanup when `CampaignViewScreen` also calls `removeOnMutationsApplied`

**File:** `src/renderer/src/components/MutationChipStack.tsx:143-149`

**Issue:** `MutationChipStack.useEffect` cleanup calls `window.aiStream.removeOnMutationsApplied()` to remove its own listener. However, `CampaignViewScreen` registers two additional `onMutationsApplied` listeners (CR-01 above), and because `removeOnMutationsApplied` removes **all** channel listeners, `MutationChipStack`'s cleanup also silently removes `CampaignViewScreen`'s handlers (the cache invalidation and short-rest detection).

Because `MutationChipStack` is rendered inside `CampaignViewScreen`'s tab panel, its cleanup fires when the component unmounts (e.g. tab panel switches, campaign changes). The result is that after any re-mount cycle, cache invalidation and short-rest detection stop working until `CampaignViewScreen` also remounts.

This is a compound of CR-01: the root cause is that `removeOnMutationsApplied` removes all listeners rather than a specific one. Fix CR-01 first (consolidate to one listener in `CampaignViewScreen`), which reduces the collision surface, but the fundamental issue requires scoped removal in the preload.

**Fix:** As a minimal patch, change `MutationChipStack`'s cleanup to avoid calling `removeOnMutationsApplied` when a per-callback removal API is not available. Instead, track a flag and early-return in the handler:

```typescript
useEffect(() => {
  let active = true
  const handler = (payload: MutationsAppliedPayload) => {
    if (!active) return
    // ... existing handler body
  }
  window.aiStream.onMutationsApplied(handler)
  return () => {
    active = false
    setChips([])
    // Do NOT call removeOnMutationsApplied() — it removes unrelated handlers
  }
}, [])
```

This leaves a stale handler registered but makes it harmless via the `active` flag, avoiding cross-component removal. The proper fix is a scoped remove API in the preload.

---

## Info

### IN-01: `updateCurrencySchema` has no lower-bound guard on per-denomination deltas — AI can spend more than the character holds

**File:** `src/main/ai/toolSchemas.ts:70-77`

**Issue:** Currency deltas have no minimum bound (only `z.number().int()`, no `.min()`). The mutation pipeline calls `charactersRepo.updateCurrency(charId, denom, delta)` which presumably applies the delta additively. If the AI sends `{ gp: -99999 }` and the character has 10 GP, the resulting balance would be negative. D&D 5e has no concept of negative currency.

Whether `updateCurrency` clamps at zero depends on `charactersRepo` (not reviewed in this phase), but the schema itself does not prevent wildly negative deltas from passing validation.

**Fix:** Either add `.min(-99999)` and rely on the repo to clamp, or add a semantic minimum of `-9999` matching the HP bound convention already present in the codebase. The larger fix (clamp in repo) is preferred.

---

### IN-02: Duplicated factions endpoint — `worldState.factions` and top-level `factions.list` return identical data from identical queries

**File:** `src/main/trpc/routers/worldState.ts:34-47`

**Issue:** `worldStateRouter` exposes a `factions` procedure and a standalone `factionsRouter` is also exported and mounted at the top-level `factions` key in `router.ts`. Both call `factionsRepo.list(input.campaignId)`. `NpcTrackerTab` uses `trpc.factions.list`, while `worldState.factions` appears unused by any renderer code. The duplication is low risk but increases the API surface and creates maintenance confusion about which path is canonical.

**Fix:** Remove `worldState.factions` from `worldStateRouter` and keep only the top-level `factionsRouter`. Update any callers of `trpc.worldState.factions` if any exist.

---

### IN-03: `globals.css` `.dark` block is a verbatim copy of `:root` — dark mode produces an identical theme to light mode

**File:** `src/renderer/src/styles/globals.css:31-53`

**Issue:** Every CSS variable in the `.dark` class block has the exact same OKLCH value as the corresponding `:root` variable. The app therefore has no functional dark mode — toggling the `.dark` class on `<html>` produces no visual change. Given the project's dark fantasy aesthetic this is likely intentional (the design is dark-only), but `@custom-variant dark (&:is(.dark *))` is still declared, suggesting dark-mode toggling is planned. If a user's OS dark-mode preference ever drives a class swap, the result would be visually identical — making the feature appear broken.

**Fix:** If the app is intentionally dark-only with no light mode, remove the `.dark` block and the `@custom-variant dark` declaration to avoid the dead code. If light mode is planned, populate the `:root` block with light-mode values and keep `.dark` for the current dark values.

---

_Reviewed: 2026-05-30T19:15:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
