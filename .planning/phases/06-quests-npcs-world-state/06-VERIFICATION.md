---
phase: 06-quests-npcs-world-state
verified: 2026-05-30T00:00:00Z
status: verified
requirements:
  STATE-01: verified
  STATE-02: verified
  STATE-03: verified
  STATE-04: verified
  WORLD-03: verified
  PARTY-03: verified
---

# Phase 06: Quests, NPCs, World State — Verification Report

**Phase Goal:** AI auto-populates quest log, NPC tracker, faction reputations, world time, location breadcrumb, and awards Inspiration — all via 8 new structured AI tool calls extending the Phase 5 mutation pipeline.

**Verified:** 2026-05-30
**Status:** VERIFIED — all six requirements satisfied; 0 type errors; no stubs or blockers found.

---

## Requirement Verification

### STATE-01 — Quest log: AI can add quests and update their status (Active/Completed/Failed)

**VERIFIED.** The full end-to-end pipeline is in place:

- **Schema:** `quests` table defined in `src/main/db/schema.ts` (lines 265–279) with `id`, `campaignId`, `name`, `description`, `status` (default `'Active'`), `createdAt`. Migration `resources/migrations/0006_phase6_world_state.sql` creates the table with a `campaign_id` FK cascade.
- **Repo:** `src/main/db/questsRepo.ts` implements `create()` and `updateStatus(questId, campaignId, status)`. The `updateStatus` signature is narrowed to `'Active' | 'Completed' | 'Failed'` (WR-01 fix). A `result.changes === 0` warning is emitted when no row matches (WR-02 fix). The `campaignId` is included in the WHERE clause preventing cross-campaign writes (CR-03 fix).
- **Tool schema:** `addQuestSchema` and `updateQuestStatusSchema` defined in `src/main/ai/toolSchemas.ts` (lines 216–225). Both tools are in `PHASE6_TOOLS` and therefore in `ALL_TOOLS` (line 341).
- **Mutation pipeline:** `src/main/ai/mutationPipeline.ts` handles `case 'addQuest'` (lines 404–418) and `case 'updateQuestStatus'` (lines 420–436). `addQuest` calls `questsRepo.create()` and emits a `quest` chip. `updateQuestStatus` calls `questsRepo.updateStatus()` with `campaignId` and emits `quest_complete` only when status is `'Completed'` (silent for `'Failed'` and `'Active'`).
- **tRPC router:** `src/main/trpc/routers/quests.ts` exposes `list` — Zod-validated query returning `questsRepo.list(campaignId)`. Registered as `quests` in `src/main/trpc/router.ts`.
- **UI:** `src/renderer/src/components/QuestsTab.tsx` queries `trpc.quests.list` via TanStack Query (`queryKey: ['quests', 'list', campaignId]`), renders each quest as a name + status badge + description row. Status badges use semantic colors (green=Active, muted=Completed, red=Failed). Empty state shown when no quests.
- **Cache invalidation:** `CampaignViewScreen` single `onMutationsApplied` handler (CR-01 fix, lines 250–272) calls `queryClient.invalidateQueries({ queryKey: ['quests', 'list', id] })` on every mutation batch.
- **Context injection:** `formatWorldStateSummary` in `contextBuilder.ts` (lines 208–215) injects active quests with their IDs into the system prompt so the AI can call `updateQuestStatus` by id.

No gaps found.

---

### STATE-02 — NPC tracker: AI tracks named NPCs with relationship and faction metadata

**VERIFIED.** Full pipeline present:

- **Schema:** `npcs` table in `schema.ts` (lines 282–294) with `id`, `campaignId`, `name`, `description`, `relationship` (default `'Unknown'`), `factionName` (nullable), `createdAt`. Created by `0006_phase6_world_state.sql`.
- **Repo:** `src/main/db/npcsRepo.ts` implements `create()` and `patch(npcId, campaignId, fields)`. The `patch` method includes `campaignId` in the WHERE clause (CR-03 fix). A `result.changes === 0` warning is emitted (WR-02 fix). Only provided fields are written.
- **Tool schemas:** `addNpcSchema` (name, description, relationship enum, optional factionName) and `updateNpcSchema` (npcId, optional fields). Both tools in `ALL_TOOLS`.
- **Mutation pipeline:** `case 'addNpc'` (lines 438–454) calls `npcsRepo.create()` with faction metadata, emits an `npc` chip. `case 'updateNpc'` (lines 456–469) calls `npcsRepo.patch()` with the campaignId guard; silent (no chip) per spec.
- **tRPC router:** `src/main/trpc/routers/npcs.ts` exposes `list` (Zod-validated). Registered as `npcs` in `router.ts`.
- **UI:** `NpcTrackerTab.tsx` queries `trpc.npcs.list` and renders each NPC with name, relationship badge (color-coded), and description. Also renders the Factions collapsible section (see STATE-03).
- **Cache invalidation:** `queryClient.invalidateQueries({ queryKey: ['npcs', 'list', id] })` in the unified `onMutationsApplied` handler.
- **Context injection:** `formatWorldStateSummary` injects known NPCs with IDs (capped at 20) into the system prompt (lines 217–222).

No gaps found.

---

### STATE-03 — Faction reputations: upsert-based faction tier tracking per campaign

**VERIFIED.** Full pipeline present:

- **Schema:** `factions` table in `schema.ts` (lines 300–317) with a `unique('factions_campaign_name_unique')` index on `(campaignId, name)` preventing duplicate rows (Pitfall 5). Created by `0006_phase6_world_state.sql` (line 31: `CREATE UNIQUE INDEX`).
- **Repo:** `src/main/db/factionsRepo.ts` implements `upsert()` using Drizzle's `onConflictDoUpdate` targeting `[factions.campaignId, factions.name]`. This is a genuine upsert: insert or update tier on conflict. Returns the post-upsert row. Also implements `list(campaignId)`.
- **Tool schema:** `updateFactionSchema` (factionName, tier enum Hostile/Unfriendly/Neutral/Friendly/Allied). In `ALL_TOOLS`.
- **Mutation pipeline:** `case 'updateFaction'` (lines 472–485) calls `factionsRepo.upsert()` with `campaignId`. Silent (no chip).
- **tRPC:** `factionsRouter` in `worldState.ts` exposes `list`. Standalone `factionsRouter` export registered as top-level `factions` key in `router.ts`. `NpcTrackerTab` calls `trpc.factions.list.query` — the expected path.
- **UI:** `NpcTrackerTab.tsx` renders a collapsible `FactionSection` with name + tier badge (color-coded: Hostile=red, Unfriendly=orange, Neutral=muted, Friendly=green, Allied=sky).
- **Cache invalidation:** `queryClient.invalidateQueries({ queryKey: ['factions', 'list', id] })` in the `onMutationsApplied` handler.
- **Context injection:** Factions are listed in `formatWorldStateSummary` (lines 225–229).

No gaps found.

---

### STATE-04 — World time: AI sets time-of-day, day number, season

**VERIFIED.** Full pipeline present:

- **Schema:** `worldTimeOfDay`, `worldDayNumber`, `worldSeason` columns added to `campaigns` table in `schema.ts` (lines 25–28). Added by `ALTER TABLE` statements in `0006_phase6_world_state.sql`.
- **Repo:** `campaignsRepo.updateWorldTime()` (`src/main/db/campaignsRepo.ts` lines 114–125) writes only provided fields (WR-04 fix). `getWorldState()` reads all four world-state columns.
- **Tool schema:** `updateWorldTimeSchema` (WR-04 fix: all fields individually optional via `.object({...}).refine(at least one present)`). In `ALL_TOOLS`.
- **Mutation pipeline:** `case 'updateWorldTime'` (lines 487–505) calls `campaignsRepo.updateWorldTime()`. Silent.
- **UI — WorldStateBar:** `CampaignViewScreen` renders the WorldStateBar (lines 466–498) directly from `campaignQuery.data` when `worldTimeOfDay` or `worldLocationPath` is set. Displays time-of-day glyph, time string, day number, season. Cache invalidated via `queryClient.invalidateQueries({ queryKey: ['campaigns', 'get', id] })` in the `onMutationsApplied` handler.
- **Context injection:** `formatWorldStateSummary` (lines 186–190) injects the time block when either `worldTimeOfDay` or `worldDayNumber` is present.

No gaps found.

---

### WORLD-03 — Location breadcrumb: AI maintains a path array

**VERIFIED.** Full pipeline present:

- **Schema:** `worldLocationPath text` column on `campaigns` added by migration. Stores a JSON array string.
- **Repo:** `campaignsRepo.updateLocation(campaignId, path)` (lines 131–137) serializes the string array as `JSON.stringify(path)`.
- **Tool schema:** `updateLocationSchema` (path array, min 1, max 10 segments, each max 100 chars). In `ALL_TOOLS`.
- **Mutation pipeline:** `case 'updateLocation'` (lines 507–517) calls `campaignsRepo.updateLocation()`. Silent.
- **UI — WorldStateBar:** `formatLocationPath()` in `CampaignViewScreen` (lines 64–72) parses `worldLocationPath` JSON with a `try/catch` fallback. Renders as a ` > `-joined breadcrumb with a pin icon. Truncates at 280px with `title` tooltip for overflow. Shown when `worldLocationPath` is non-null.
- **Context injection:** `formatWorldStateSummary` (lines 193–206) parses the JSON path (guarded try/catch, T-06-03-03), strips newlines from each segment (T-06-03-01), and renders as `Location: A > B > C`.

No gaps found.

---

### PARTY-03 — Inspiration: AI awards inspiration to the player character

**VERIFIED.** Full pipeline present:

- **Schema:** `hasInspiration boolean` column on `character_resources` table (pre-existing, line 171 of `schema.ts`).
- **Tool schema:** `awardInspirationSchema` (characterId string). In `ALL_TOOLS`.
- **Mutation pipeline:** `case 'awardInspiration'` (lines 519–543) verifies the characterId maps to a `character_resources` row, falls back to `resolvePlayerCharacterId(campaignId)` if not (Pitfall 7 guard). Sets `hasInspiration: true` with a direct `db.update`. Emits an `inspiration` chip.
- **Chip display:** `MutationChipStack.tsx` handles `'inspiration'` chip type (line 51, 117), renders a Star icon (amber-400).
- **CR-02 fix:** `MutationChipStack` uses `VALID_CHIP_TYPES.has(c.type as ChipType)` filter (lines 62–65, 133–134) rather than an unsafe cast, so unknown chip types are silently discarded.
- **Context injection:** `formatWorldStateSummary` injects `- Player character ID: {charId}` (lines 182–184), giving the AI the correct id to pass to `awardInspiration`.
- **Character sheet display:** `contextBuilder.ts` injects `Inspiration: Yes/No` into the character summary (line 132), keeping the AI aware of the current state.

No gaps found.

---

## Code Review Fixes — Status

| Fix | Description | Status |
|-----|-------------|--------|
| CR-01 | Two `onMutationsApplied` useEffects merged into one | VERIFIED — `CampaignViewScreen.tsx` has a single `useEffect` at line 250 handling both short-rest detection and all cache invalidations |
| CR-02 | `payload.chips` validated with `VALID_CHIP_TYPES.has()` filter | VERIFIED — `MutationChipStack.tsx` lines 62–65 define the Set; line 134 applies the filter |
| CR-03 | `questsRepo.updateStatus` and `npcsRepo.patch` require `campaignId` in WHERE | VERIFIED — `questsRepo.ts` line 59 uses `and(eq(quests.id, ...), eq(quests.campaignId, ...))`, `npcsRepo.ts` line 76 mirrors this |
| WR-01 | `updateStatus` status param narrowed to literal union | VERIFIED — signature on line 55 of `questsRepo.ts`: `status: 'Active' | 'Completed' | 'Failed'` |
| WR-02 | Both repos warn when `result.changes === 0` | VERIFIED — `questsRepo.ts` line 62, `npcsRepo.ts` line 80 |
| WR-03 | `formatWorldStateSummary` accepts optional `playerCharacterId` | VERIFIED — function signature line 171 of `contextBuilder.ts`; caller on line 377 passes `character?.id` |
| WR-04 | `updateWorldTimeSchema` fields individually optional; repo writes only provided fields | VERIFIED — `toolSchemas.ts` lines 250–259 (Zod `.refine`); `campaignsRepo.ts` lines 119–123 |
| WR-05 | `MutationChipStack` cleanup uses `active` flag instead of `removeOnMutationsApplied()` | VERIFIED — `MutationChipStack.tsx` lines 127, 152–157; cleanup sets `active = false` and resets chips without removing shared listeners |

---

## Type-Check Result

`npx tsc --noEmit` completed with no output — **0 type errors**.

---

## Anti-Pattern Scan

No `TBD`, `FIXME`, or `XXX` markers found in Phase 6 files. No stub return patterns (`return null`, `return []`, empty handlers) observed in QuestsTab, NpcTrackerTab, the repos, or the pipeline handlers. All handlers write real data to the DB and all UI components query and render live data.

---

## Overall Verdict

Phase 06 goal is **fully achieved**. All six requirements are satisfied end-to-end: schema migrations exist and match the Drizzle schema; three repos implement correct CRUD with campaignId guards; eight tool schemas are registered in `ALL_TOOLS`; eight mutation pipeline cases handle every tool and write to the DB; three tRPC routers are registered in the root router; two UI tabs render live AI-populated data via TanStack Query; the WorldStateBar displays time and location from the campaign row; `formatWorldStateSummary` injects quests, NPCs, factions, time, location, and player character ID into the AI system prompt; all code-review fixes (CR-01 through WR-05) are confirmed present; and the TypeScript compiler reports zero errors.

There are no open items requiring remediation before proceeding to Phase 07.

---

_Verified: 2026-05-30_
_Verifier: Claude (gsd-verifier)_
