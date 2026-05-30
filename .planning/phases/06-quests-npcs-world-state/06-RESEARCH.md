# Phase 6: Quests, NPCs & World State - Research

**Researched:** 2026-05-29
**Domain:** World-state tracking layer — DB schema extension, AI tool pipeline, ContextBuilder injection, tabbed UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Quest Log (Quests Tab — new 6th tab)**
- D-01: New 6th tab "Quests" — standalone tab added to the right panel tab list. Tab order: Character Sheet → Combat Tracker → NPC Tracker → Session Journal → Inventory → **Quests**.
- D-02: Single chronological list with status badges. No grouping. Badges: `Active` (green), `Completed` (muted), `Failed` (red).
- D-03: Quest entry layout — name + status badge + one-line description, inline. No expandable card in Phase 6.
- D-04: AI-only (read-only for player). AI owns quest state via `updateQuestStatus`.
- D-05: Chip notifications — `quest_added` and `quest_complete` chips. Quest failure is silent.

**NPC Tracker (Existing Tab → Full Implementation)**
- D-06: Chronological order (encounter order). `created_at` or `encounter_order` integer drives sort.
- D-07: Each NPC row shows: name + relationship status + one-line description. Relationship: Friendly / Neutral / Hostile / Unknown.
- D-08: Factions section = separate collapsible section BELOW the NPC list. Shows faction name + tier label.
- D-09: NPC Tracker is AI-only (read-only for player).
- D-10: `npc_added` chip fires when AI calls `addNpc`. NPC updates are silent.

**Calendar + Location Breadcrumb**
- D-11: Both live in the campaign header bar.
- D-12: Calendar display = compact format — `Evening • Day 14 • Autumn`. Fields: timeOfDay / dayNumber / season.
- D-13: Location breadcrumb = path array joined with ' > '. Path: `['Forest', 'Ancient Ruins', 'Crypt Level 2']`.

**Phase 6 AI Tool Schema**
- D-14: 8 new fine-grained per-mutation tools: addQuest, updateQuestStatus, addNpc, updateNpc, updateFaction, updateWorldTime, updateLocation, awardInspiration.
- D-15: Full CRUD minus delete for NPCs — `addNpc` creates; `updateNpc` patches.
- D-16: Selective chip notifications: `quest_added` (green, scroll icon), `quest_complete` (muted, checkmark), `npc_added` (muted, user+ icon), `inspiration_awarded` (amber, star icon). updateFaction, updateWorldTime, updateLocation are silent.
- D-17: JSON-tail fallback same as Phase 5. Phase 6 tools added to JSON-tail schema alongside Phase 5 tools.
- D-18: Context injection — AI system prompt includes current world state so it can reference quest IDs and NPC IDs.

### Claude's Discretion
- Exact Zod schemas for all 8 tool calls (string enums, optional fields, ID formats)
- DB schema for new tables: `quests`, `npcs`, `factions`, and world-state storage (new columns on `campaigns` vs. a `world_state` table)
- Migration number (migration 0005 or 0006 depending on what Phase 5 used)
- Chip icon choices for quest/NPC/inspiration types
- Exact header bar layout: spacing, icon, separator style between calendar and breadcrumb
- Whether `npcId` and `questId` are UUIDs or integer PKs (follow existing schema pattern)
- World state context-injection position within ContextBuilder (after character summary, before tool definitions)
- `updateFaction` upsert behavior: create faction if name not found, else update tier

### Deferred Ideas (OUT OF SCOPE)
- Player-added NPC notes (Phase 8 polish)
- Named in-world calendar (month/day names — Phase 7 or 8)
- Quest details/notes (expandable quest cards — Phase 8)
- Quest failure chip (silent in Phase 6)
- NPC updates chip (silent in Phase 6)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-01 | AI maintains a quest log — adds quests as they emerge; marks them complete when resolved; player can view all quests in the right panel | `addQuest` + `updateQuestStatus` tools + `quests` table + QuestsTab component |
| STATE-02 | AI populates and updates an NPC tracker with characters encountered, including relationship notes and key information | `addNpc` + `updateNpc` tools + `npcs` table + NpcTrackerTab full implementation |
| STATE-03 | AI tracks faction relationships and adjusts player's reputation with factions based on in-game actions | `updateFaction` tool + `factions` table + collapsible Factions section in NPC Tracker tab |
| STATE-04 | AI manages in-world time (time of day, days elapsed, season) shown in the UI | `updateWorldTime` tool + `worldTime` columns on `campaigns` or `world_state` table + campaign header bar |
| WORLD-03 | UI displays a location breadcrumb showing the current location hierarchy (e.g., Forest > Ancient Ruins > Crypt Level 2) | `updateLocation` tool + `location` path storage + header bar breadcrumb component |
| PARTY-03 | AI awards Inspiration to the player's character when it detects exceptional roleplay | `awardInspiration` tool + `hasInspiration` already exists on `character_resources` + inspiration chip |
</phase_requirements>

---

## Summary

Phase 6 is a pure extension phase — it adds 8 new AI tool calls, 3 new DB tables, world-state columns, 3 new tRPC routers, 2 new tab components, and header bar additions on top of the Phase 5 mutation pipeline. No existing code is deleted or rearchitected. The pattern language is already established by Phase 5, so every new piece has an exact counterpart to follow: `combatantsRepo.ts` → `questsRepo.ts` / `npcsRepo.ts` / `factionsRepo.ts`; `combat.ts` router → `quests.ts` / `npcs.ts` / `worldState.ts` routers; `PHASE5_TOOLS` → `PHASE6_TOOLS`; `CombatTrackerTab.tsx` → `NpcTrackerTab.tsx` / `QuestsTab.tsx`.

The next migration number is **0006** (migrations 0000–0005 already exist). Migration 0006 creates three new tables (`quests`, `npcs`, `factions`) and adds five world-state columns to `campaigns` (`world_time_of_day`, `world_day_number`, `world_season`, `world_location_path`, and a `world_location_label` convenience column — or alternatively a separate `world_state` table). `hasInspiration` already exists on `character_resources` so `awardInspiration` is a simple boolean flip with no schema addition needed.

The single most important architectural decision is that new Phase 6 tools MUST coexist alongside Phase 5 tools in a single combined `ALL_TOOLS` set passed to `streamText({ tools })`. The export `PHASE5_TOOLS` in `toolSchemas.ts` must be extended (not replaced) — the planner should create `PHASE6_TOOLS` and export `ALL_TOOLS = { ...PHASE5_TOOLS, ...PHASE6_TOOLS }`. The `mutationPipeline.ts` switch statement is extended with 8 new cases. The `contextBuilder.ts` `toolDescriptionsBlock` string is extended with natural-language descriptions of the 8 new tools, and a new `formatWorldStateSummary()` function is appended to the system prompt after the tool block.

**Primary recommendation:** Follow the Phase 5 pipeline pattern exactly. Each wave is: schema/migration → repos → tRPC routers → mutation pipeline extension → ContextBuilder extension → UI components. Do not combine waves; each is a clean dependency boundary.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quest CRUD (add, status update) | API / Main process | — | All write mutations via mutationPipeline in main; read via tRPC |
| NPC CRUD (add, patch) | API / Main process | — | Same as quest CRUD — AI tool calls go through main-process pipeline |
| Faction upsert (create or update tier) | API / Main process | — | `updateFaction` is an upsert — repo handles create-or-update atomically |
| World time + location storage | API / Main process | — | `updateWorldTime` / `updateLocation` write to campaigns table (or world_state); read via tRPC |
| Inspiration award | API / Main process | — | Flip `hasInspiration` on `character_resources`; repo method already used by Phase 5 |
| AI context injection (world state) | API / Main process | — | `buildContext()` in `contextBuilder.ts`; renderer never sees system prompt |
| Quest log display (QuestsTab) | Browser / Renderer | — | Read-only TanStack Query consumer of `quests.list` tRPC call |
| NPC tracker display (NpcTrackerTab) | Browser / Renderer | — | Read-only TanStack Query consumer of `npcs.list` + `factions.list` tRPC calls |
| Campaign header (time + location) | Browser / Renderer | — | Reads `worldState` from campaign query; pure display component |
| Chip notifications | Browser / Renderer | — | MutationChipStack subscribes to `ai:mutations-applied` IPC event |
| Cache invalidation on mutation | Browser / Renderer | — | CampaignViewScreen `onMutationsApplied` handler invalidates quests/npcs/worldState query keys |

---

## Standard Stack

### Core (all already installed — no new packages required for Phase 6)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.36+ | New tables + migration 0006 | Already in project; same `sqliteTable` pattern |
| better-sqlite3 | 11.x | Synchronous DB driver | Already in project; all repos use it |
| Zod | 3.x | 8 new tool schemas + tRPC input validation | Already in project; same `z.object` pattern as Phase 5 |
| Vercel AI SDK `ai` | 4.x | `tool()` registrations for 8 new tools | Already in project; same `tool({ description, inputSchema })` pattern |
| TanStack Query | 5.x | Async state for new tRPC calls (quests, npcs, worldState) | Already in project; same `useQuery` pattern as combatantsQuery |
| Zustand | 5.x | No new stores needed — `combatStore` already owns `activeTab` | Already in project |
| lucide-react | latest | New icons: `ScrollText` (quest), `UserPlus` (npc), `Star` (inspiration) | Already in project |

**No new npm packages needed.** Phase 6 is pure extension using the existing stack. [VERIFIED: codebase grep]

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn Collapsible | (copy-in) | Factions collapsible section in NPC Tracker | Already added in Phase 5 (used in CombatTrackerTab) |
| shadcn Badge | (copy-in) | Quest status badges + NPC relationship tags + faction tier labels | Already in project |
| shadcn ScrollArea | (copy-in) | NpcTrackerTab and QuestsTab scrollable lists | Already in project (CombatTrackerTab uses it) |

---

## Package Legitimacy Audit

> No new packages are installed in Phase 6. All required libraries are already present in the project.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
AI LLM (via Vercel AI SDK streamText)
        |
        | tool calls: addQuest / updateQuestStatus /
        |   addNpc / updateNpc / updateFaction /
        |   updateWorldTime / updateLocation / awardInspiration
        v
src/main/index.ts  (onFinish handler)
        |
        v
mutationPipeline.ts  applyMutationBatch()
   switch(toolName):
   ├─ [Phase 5 cases unchanged] ──────────────────────────>  existing repos
   ├─ addQuest/updateQuestStatus ──────────────────────────> questsRepo
   ├─ addNpc/updateNpc ────────────────────────────────────> npcsRepo
   ├─ updateFaction (upsert) ──────────────────────────────> factionsRepo
   ├─ updateWorldTime/updateLocation ──────────────────────> campaignsRepo (new columns)
   └─ awardInspiration ────────────────────────────────────> charactersRepo.setInspiration()
        |
        | chips: quest_added, quest_complete, npc_added, inspiration_awarded
        | (updateFaction/updateWorldTime/updateLocation → no chip)
        v
IPC  ai:mutations-applied  { campaignId, chips }
        |
        ├─────────────────────────────────────────────────> MutationChipStack (display)
        └─────────────────────────────────────────────────> CampaignViewScreen cache invalidation
                                                              invalidate: quests.list
                                                              invalidate: npcs.list
                                                              invalidate: factions.list
                                                              invalidate: campaigns.get (world state)
                                                              invalidate: characters.getByCampaignId

Renderer read path (TanStack Query):
  QuestsTab       <── trpc.quests.list.query({ campaignId })
  NpcTrackerTab   <── trpc.npcs.list.query({ campaignId })
                      trpc.factions.list.query({ campaignId })
  CampaignHeader  <── trpc.campaigns.get.query({ id }) [already called — adds worldTime + location]

buildContext() (before each AI call):
  + formatWorldStateSummary() → injects into system prompt:
      [active quests with IDs, NPCs with IDs+relationship, factions+tier, time, location]
```

### Recommended Project Structure (new files only)

```
src/main/db/
├── questsRepo.ts          # create, list, updateStatus
├── npcsRepo.ts            # create, list, patch
├── factionsRepo.ts        # upsert, list
src/main/trpc/routers/
├── quests.ts              # list, [getById optional]
├── npcs.ts                # list
├── worldState.ts          # getWorldState — returns { time, location, factions }
src/main/ai/
├── toolSchemas.ts         # ADD: 8 new schemas + PHASE6_TOOLS + ALL_TOOLS export
├── mutationPipeline.ts    # ADD: 8 new switch cases
├── contextBuilder.ts      # ADD: formatWorldStateSummary(), extend toolDescriptionsBlock
src/renderer/src/components/
├── QuestsTab.tsx          # new 6th tab
├── NpcTrackerTab.tsx      # replaces placeholder in CampaignViewScreen
src/renderer/src/screens/
└── CampaignViewScreen.tsx # ADD: 6th tab trigger+content, NpcTrackerTab import,
                           #      header bar world-state strip, cache invalidation,
                           #      worldState query
resources/migrations/
└── 0006_phase6_world_state.sql   # quests + npcs + factions tables + campaigns world cols
```

### Pattern 1: Adding a new tRPC router (follow combat.ts exactly)

**What:** Each domain (quests, npcs, worldState) gets its own router file with Zod-validated procedures, a campaignIdSchema input, and repo delegation.
**When to use:** Any new DB domain that the renderer needs to query.

```typescript
// Source: src/main/trpc/routers/combat.ts (verbatim pattern)
import { z } from 'zod'
import { t } from '../_base'
import { questsRepo } from '../../db/questsRepo'
import { campaignIdSchema } from '../schemas'

export const questsRouter = t.router({
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => questsRepo.list(input.campaignId)),
})
```

Then register in `src/main/trpc/router.ts`:
```typescript
import { questsRouter } from './routers/quests'
// ...
export const router = t.router({
  // ... existing routers ...
  quests: questsRouter,
  npcs: npcsRouter,
  worldState: worldStateRouter,
})
```

### Pattern 2: Adding new tool schemas (follow toolSchemas.ts exactly)

**What:** New Phase 6 Zod schemas + `tool()` registrations. Export `PHASE6_TOOLS` and `ALL_TOOLS`.
**When to use:** Any new AI tool call in Phase 6.

```typescript
// Source: src/main/ai/toolSchemas.ts (verbatim pattern)
import { tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'

export const addQuestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500),
})

export const updateQuestStatusSchema = z.object({
  questId: z.string().uuid(),
  status: z.enum(['Active', 'Completed', 'Failed']),
})

export const addNpcSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300),
  relationship: z.enum(['Friendly', 'Neutral', 'Hostile', 'Unknown']),
  factionName: z.string().max(100).optional(),
})

export const updateNpcSchema = z.object({
  npcId: z.string().uuid(),
  description: z.string().max(300).optional(),
  relationship: z.enum(['Friendly', 'Neutral', 'Hostile', 'Unknown']).optional(),
  factionName: z.string().max(100).optional(),
})

export const updateFactionSchema = z.object({
  factionName: z.string().min(1).max(100),
  tier: z.enum(['Hostile', 'Unfriendly', 'Neutral', 'Friendly', 'Allied']),
})

export const updateWorldTimeSchema = z.object({
  timeOfDay: z.enum(['Morning', 'Afternoon', 'Evening', 'Night']),
  dayNumber: z.number().int().min(1).max(99999),
  season: z.enum(['Spring', 'Summer', 'Autumn', 'Winter']),
})

export const updateLocationSchema = z.object({
  path: z.array(z.string().max(100)).min(1).max(10),
})

export const awardInspirationSchema = z.object({
  characterId: z.string().uuid(),
})

// tool() registrations — NO execute property (D-04, Pitfall 1)
export const addQuestTool = tool({ description: '...', inputSchema: addQuestSchema })
// ... etc.

export const PHASE6_TOOLS = {
  addQuest: addQuestTool,
  updateQuestStatus: updateQuestStatusTool,
  addNpc: addNpcTool,
  updateNpc: updateNpcTool,
  updateFaction: updateFactionTool,
  updateWorldTime: updateWorldTimeTool,
  updateLocation: updateLocationTool,
  awardInspiration: awardInspirationTool,
} as const satisfies ToolSet

export const ALL_TOOLS = { ...PHASE5_TOOLS, ...PHASE6_TOOLS } as const satisfies ToolSet
```

### Pattern 3: Adding new mutation pipeline cases (follow applyOneTool switch exactly)

**What:** 8 new `case` blocks in `applyOneTool()`. Follow the exact: safeParse → guard on !r.success → repo call → chip push → logEvent pattern.
**When to use:** Every new AI tool in Phase 6.

```typescript
// Source: src/main/ai/mutationPipeline.ts — applyOneTool() switch
case 'addQuest': {
  const r = addQuestSchema.safeParse(args)
  if (!r.success) {
    log.warn('[mutationPipeline] invalid addQuest args')
    return
  }
  const quest = questsRepo.create({ campaignId, name: r.data.name, description: r.data.description })
  acc.chips.push({ id: chipId(), label: `Quest: ${r.data.name}`, type: 'quest' })
  logEvent(campaignId, sessionId, 'quest_added', { questId: quest.id, name: r.data.name })
  return
}

case 'updateQuestStatus': {
  const r = updateQuestStatusSchema.safeParse(args)
  if (!r.success) {
    log.warn('[mutationPipeline] invalid updateQuestStatus args')
    return
  }
  questsRepo.updateStatus(r.data.questId, r.data.status)
  if (r.data.status === 'Completed') {
    acc.chips.push({ id: chipId(), label: `Quest complete!`, type: 'quest_complete' })
  }
  // Failed = silent (D-05)
  logEvent(campaignId, sessionId, 'quest_status_changed', r.data)
  return
}

case 'awardInspiration': {
  const r = awardInspirationSchema.safeParse(args)
  if (!r.success) {
    log.warn('[mutationPipeline] invalid awardInspiration args')
    return
  }
  const db = getDb()
  db.update(characterResources)
    .set({ hasInspiration: true })
    .where(eq(characterResources.characterId, r.data.characterId))
    .run()
  acc.chips.push({ id: chipId(), label: 'Inspiration awarded!', type: 'inspiration' })
  logEvent(campaignId, sessionId, 'inspiration_awarded', { characterId: r.data.characterId })
  return
}
```

**Critical:** `MutationChip` type union in `mutationPipeline.ts` must be extended:
```typescript
export interface MutationChip {
  id: string
  label: string
  type: 'hp' | 'xp' | 'condition' | 'slot' | 'currency' | 'combat' | 'rest'
       | 'quest' | 'quest_complete' | 'npc' | 'inspiration'  // Phase 6 additions
}
```

### Pattern 4: ContextBuilder world-state injection

**What:** New `formatWorldStateSummary()` function reads quests, NPCs, factions, and world time/location and formats a compact text block. Appended to system prompt after the tool descriptions block (D-18).
**When to use:** Called inside `buildContext()` immediately after `toolDescriptionsBlock`.

```typescript
// Source: src/main/ai/contextBuilder.ts (new function, same pattern as formatCharacterSummary)
function formatWorldStateSummary(campaignId: string): string {
  const quests = questsRepo.list(campaignId)
  const npcs = npcsRepo.list(campaignId)
  const factions = factionsRepo.list(campaignId)
  const worldState = campaignsRepo.getWorldState(campaignId)

  const lines: string[] = ['Current world state:']

  if (worldState?.worldTimeOfDay || worldState?.worldDayNumber) {
    lines.push(`- Time: ${worldState.worldTimeOfDay ?? '?'}, Day ${worldState.worldDayNumber ?? '?'}, ${worldState.worldSeason ?? '?'}`)
  }
  if (worldState?.worldLocationPath) {
    const path = JSON.parse(worldState.worldLocationPath) as string[]
    lines.push(`- Location: ${path.join(' > ')}`)
  }

  const activeQuests = quests.filter((q) => q.status === 'Active')
  if (activeQuests.length > 0) {
    lines.push('- Active quests:')
    for (const q of activeQuests) {
      lines.push(`  * [ID: ${q.id}] ${q.name}`)
    }
  }

  if (npcs.length > 0) {
    lines.push('- Known NPCs:')
    for (const n of npcs.slice(0, 20)) {  // cap at 20 to avoid token bloat
      lines.push(`  * [ID: ${n.id}] ${n.name} (${n.relationship})`)
    }
  }

  if (factions.length > 0) {
    lines.push('- Factions:')
    for (const f of factions) {
      lines.push(`  * ${f.name}: ${f.tier}`)
    }
  }

  return lines.length > 1 ? lines.join('\n') : ''
}
```

Then in `buildContext()`, extend `toolDescriptionsBlock` string with Phase 6 tool descriptions and append world-state after it:
```typescript
const worldStateSummary = formatWorldStateSummary(campaignId)
const systemPrompt =
  [preamble, strictnessDirective, personality, characterSummaryBlock]
    .filter((part) => part.length > 0)
    .join('\n\n')
  + '\n\n' + toolDescriptionsBlock          // extended with Phase 6 descriptions
  + (worldStateSummary ? '\n\n' + worldStateSummary : '')   // NEW Phase 6 block
  + referenceDocBlock
  + l3Block
  + l2Block
  + sessionContextBlock
```

### Pattern 5: Extending MutationChipStack

**What:** Add 4 new `ChipType` values and their `iconFor` switch cases. Import new Lucide icons.
**When to use:** Required for quest_added, quest_complete, npc_added, inspiration_awarded chips.

```typescript
// Source: src/renderer/src/components/MutationChipStack.tsx

// New imports needed:
import { ScrollText, Check, UserPlus, Star } from 'lucide-react'
// (UserPlus and Star are already imported — check before re-importing)

// Extend ChipType union:
type ChipType = 'hp' | 'xp' | 'condition' | 'slot' | 'currency' | 'combat' | 'rest'
              | 'quest' | 'quest_complete' | 'npc' | 'inspiration'

// Add to iconFor() switch:
case 'quest':
  return <ScrollText className={`${cls} text-green-400`} />
case 'quest_complete':
  return <Check className={`${cls} text-muted-foreground`} />
case 'npc':
  return <UserPlus className={`${cls} text-muted-foreground`} />
case 'inspiration':
  return <Star className={`${cls} text-amber-400`} />
```

### Pattern 6: Campaign header bar extension

**What:** The existing action bar in `CampaignViewScreen.tsx` (the `div.flex.items-center.gap-2` at line 333) has a `<span className="flex-1" />` spacer. Phase 6 adds a second row or extends this row with world-state display.
**When to use:** The compact calendar+location strip (D-11 to D-13).

The current header structure:
```
[← Campaigns] [flex-1 spacer] [AI Settings] [Start/End Combat] [Rest] [Start/End Session] [Delete Campaign]
```

Phase 6 adds a second `<div>` row directly beneath the action bar (before `<PanelGroup>`), rendering as a slim sub-bar:
```
[🌙 Evening • Day 14 • Autumn]  [flex-1 spacer]  [📍 Forest > Ancient Ruins > Crypt Level 2]
```

This sub-bar is only rendered when `worldState` has data (both are nullable — show nothing if AI hasn't called updateWorldTime / updateLocation yet).

The world-state data comes from the existing `campaignQuery` — either via new columns on the `campaigns` row or via a separate `trpc.worldState.get.query({ campaignId })` call. Adding columns to `campaigns` is simpler (one query, already running) vs a separate `worldState` query.

### Anti-Patterns to Avoid

- **Replacing PHASE5_TOOLS:** Never remove existing tools from the tool set passed to `streamText`. Extend only. The AI has been trained on both Phase 5 and Phase 6 tools.
- **Adding `execute` to tool registrations:** The pipeline calls `applyMutationBatch` in the `onFinish` callback. Adding `execute` would double-apply every mutation (D-04 / Pitfall 1 from Phase 5 context).
- **Async inside `db.transaction()` callback:** `better-sqlite3` transactions must remain synchronous. Do not add `await` inside any transaction callback (WR-07 from mutationPipeline.ts line 506).
- **Storing world state in a separate world_state table when columns on campaigns are sufficient:** The `campaigns` table already has a `rollingSummary` column and a `permadeathMode` column added in migrations. Five nullable world-state columns (timeOfDay, dayNumber, season, locationPath as JSON text, locationLabel as text) are a clean fit on `campaigns`. A separate table adds complexity for no gain at single-character, single-campaign scope.
- **Token budget overflow in world-state context injection:** Capping the NPC list at 20 and the quest/faction lists at reasonable limits is essential. An uncapped NPC list in a long campaign could push the system prompt past the model's context window.
- **Using integer PKs for quest/npc IDs:** All existing tables use `text('id').primaryKey()` with `randomUUID()`. Use the same pattern for quests, npcs, factions so the AI can reference UUIDs in `updateQuestStatus`/`updateNpc` calls. Integer PKs would require the AI to track sequential numbers, which is more fragile.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Faction upsert (create-or-update) | Custom SELECT-then-INSERT/UPDATE logic | Drizzle `.insert().onConflictDoUpdate()` with `target: factions.campaignId_name_unique` | Single atomic operation; avoids race condition on name lookup |
| Quest/NPC/Faction list with TanStack Query | Manual useState + useEffect + fetch | `useQuery({ queryKey: ['quests', 'list', campaignId], queryFn: () => trpc.quests.list.query(...) })` | Automatic loading/error states, cache invalidation via `queryClient.invalidateQueries` |
| Repo `create()` returning the new row | Separate SELECT after INSERT | Pattern from combatantsRepo: `db.insert().values({...}).run()` then `db.select().where(eq(...id...)).get()` | Consistent with existing repos; SQLite `.get()` is synchronous |

**Key insight:** The entire phase is about pattern reuse. The codebase already has every primitive needed. Follow existing file structures line-for-line; do not invent new patterns.

---

## Common Pitfalls

### Pitfall 1: Forgetting to register new routers in router.ts
**What goes wrong:** `trpc.quests` / `trpc.npcs` / `trpc.worldState` are undefined at runtime; TypeScript may not catch this if the import is missing.
**Why it happens:** `src/main/trpc/router.ts` must be updated to include each new router. It is easy to create the router file and forget the registration.
**How to avoid:** The plan should include router registration as a step in the same task that creates each router file.
**Warning signs:** `trpc.quests is not a function` runtime error; TypeScript type error on `trpc.quests`.

### Pitfall 2: ALL_TOOLS not passed to streamText
**What goes wrong:** Phase 6 tools are never called by the AI because the tool set passed to `streamText({ tools: PHASE5_TOOLS })` still references the old export.
**Why it happens:** `src/main/index.ts` (or wherever `streamText` is called) references the exported tool set by name. After adding Phase 6 tools, the import must be updated to `ALL_TOOLS`.
**How to avoid:** Grep for `PHASE5_TOOLS` in `src/main/` and update every reference to `ALL_TOOLS`.
**Warning signs:** AI never calls addQuest, addNpc etc.; world state never populates.

### Pitfall 3: Cache invalidation missing for new query keys
**What goes wrong:** After AI calls addQuest/addNpc, the QuestsTab or NpcTrackerTab does not refresh — shows stale data.
**Why it happens:** The `cacheInvalidationHandler` in `CampaignViewScreen.tsx` (around line 242) only invalidates combat, characters, and messages query keys. New Phase 6 query keys (`quests.list`, `npcs.list`, `factions.list`, `campaigns.get`) must be added.
**How to avoid:** Add all new query keys to the `cacheInvalidationHandler` in the same task that wires the new tRPC queries.
**Warning signs:** QuestsTab shows empty list immediately after combat/session; manual refresh shows data.

### Pitfall 4: JSON storage for `locationPath` vs separate columns
**What goes wrong:** Storing the location path as a JSON array text column (e.g., `'["Forest","Ancient Ruins"]'`) works but requires `JSON.parse` in every consumer. If a migration changes the format, all existing stored values break.
**Why it happens:** The `updateLocation` tool sends a `string[]` — natural to JSON.stringify it.
**How to avoid:** Store as `text` (JSON array) but always guard `JSON.parse` with a try/catch and a fallback to `[]`. This matches the pattern already used for `conditions`, `spellSlots`, `referenceDocs` throughout the schema.
**Warning signs:** Render crash when `JSON.parse` encounters a non-JSON value (edge case on first migration).

### Pitfall 5: `updateFaction` upsert must use campaign-scoped unique constraint
**What goes wrong:** Two campaigns can have a faction named "The City Watch" — the upsert must be scoped to `campaignId + factionName`. Without a `UNIQUE` constraint on `(campaign_id, faction_name)`, the upsert will not work correctly.
**Why it happens:** `onConflictDoUpdate` requires a unique index to target.
**How to avoid:** Add `UNIQUE` constraint on `(campaign_id, name)` in the `factions` table migration. Follow the same pattern as `sessions_campaign_session_number_unique` index.
**Warning signs:** Duplicate faction rows with the same name in the same campaign.

### Pitfall 6: toolDescriptionsBlock — both Phase 5 and Phase 6 tools described
**What goes wrong:** JSON-tail fallback providers (local LLMs that don't support native tool calls) only see the `toolDescriptionsBlock` string in the system prompt. If Phase 6 tools aren't described there, those providers can't call them.
**Why it happens:** The `toolDescriptionsBlock` constant in `contextBuilder.ts` is a hardcoded string listing Phase 5 tools. Phase 6 tools need to be appended to it.
**How to avoid:** Extend the `toolDescriptionsBlock` string with all 8 Phase 6 tool descriptions. The format already shows: `- Use \`addQuest\` to...`.
**Warning signs:** Local LLM providers never populate quests/NPCs; cloud providers work fine (they use native tool calls).

### Pitfall 7: `awardInspiration` targeting wrong character
**What goes wrong:** The AI sends `{ characterId: "some-uuid" }` but that UUID doesn't match the `character_resources.character_id`. The update silently updates 0 rows.
**Why it happens:** The AI may hallucinate a `characterId` if the system prompt doesn't clearly supply it.
**How to avoid:** In `formatCharacterSummary()`, the character ID is not currently included. The Phase 6 `formatWorldStateSummary()` should include the player characterId explicitly so the AI can reference it. Alternatively, `awardInspiration` in the pipeline can fall back to `resolvePlayerCharacterId(campaignId)` if `characterId` is provided but doesn't match.
**Warning signs:** `hasInspiration` never flips to true after `awardInspiration` tool call; `campaign_events` shows `inspiration_awarded` event but character sheet still shows No.

---

## Code Examples

### Drizzle schema for quests table
```typescript
// Source: src/main/db/schema.ts (new addition — follow campaigns/sessions/combatants pattern)
export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('Active'), // 'Active' | 'Completed' | 'Failed'
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})
```

### Drizzle schema for npcs table
```typescript
export const npcs = sqliteTable('npcs', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  relationship: text('relationship').notNull().default('Unknown'), // 'Friendly'|'Neutral'|'Hostile'|'Unknown'
  factionName: text('faction_name'),  // nullable FK by name (not by ID — AI uses names)
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})
```

### Drizzle schema for factions table (with upsert-targeted unique index)
```typescript
export const factions = sqliteTable(
  'factions',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tier: text('tier').notNull().default('Neutral'), // 'Hostile'|'Unfriendly'|'Neutral'|'Friendly'|'Allied'
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    uniqueCampaignFaction: unique().on(table.campaignId, table.name),
  }),
)
```

### World-state columns on campaigns table (migration 0006 ALTER TABLE)
```sql
-- Migration 0006 adds these to campaigns:
ALTER TABLE `campaigns` ADD `world_time_of_day` text;
ALTER TABLE `campaigns` ADD `world_day_number` integer;
ALTER TABLE `campaigns` ADD `world_season` text;
ALTER TABLE `campaigns` ADD `world_location_path` text;
-- world_location_path stores JSON array: '["Forest","Ancient Ruins","Crypt Level 2"]'
```

And in schema.ts, add these columns to the `campaigns` table definition:
```typescript
// Phase 6 world state — all nullable (null = not yet set by AI)
worldTimeOfDay: text('world_time_of_day'),     // 'Morning'|'Afternoon'|'Evening'|'Night'
worldDayNumber: integer('world_day_number'),
worldSeason: text('world_season'),             // 'Spring'|'Summer'|'Autumn'|'Winter'
worldLocationPath: text('world_location_path'),// JSON: '["Forest","Ancient Ruins"]'
```

### factionsRepo upsert (create or update tier)
```typescript
// Source: pattern from Drizzle docs — onConflictDoUpdate
upsert(input: { campaignId: string; name: string; tier: string }): Faction {
  const db = getDb()
  const id = randomUUID()
  db.insert(factions)
    .values({ id, campaignId: input.campaignId, name: input.name, tier: input.tier })
    .onConflictDoUpdate({
      target: [factions.campaignId, factions.name],
      set: { tier: input.tier },
    })
    .run()
  // Fetch the row (id may differ if it was an update not an insert)
  const row = db
    .select()
    .from(factions)
    .where(and(eq(factions.campaignId, input.campaignId), eq(factions.name, input.name)))
    .get()
  if (!row) throw new Error('[factions] upsert failed')
  return row
}
```

### NpcTrackerTab structure (collapsible Factions section)
```typescript
// Source: CombatTrackerTab.tsx uses Collapsible — exact same import pattern
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { ChevronDown } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { useQuery } from '@tanstack/react-query'

// NPC list (top, chronological order by createdAt)
// ...

// Factions section (below NPCs, collapsible, D-08)
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 ...">
    <ChevronDown className="h-4 w-4" />
    Factions
  </CollapsibleTrigger>
  <CollapsibleContent>
    {factions.map(f => (
      <div key={f.id} className="flex items-center gap-2 py-1">
        <span>{f.name}</span>
        <Badge variant="outline" className={factionTierColor(f.tier)}>{f.tier}</Badge>
      </div>
    ))}
  </CollapsibleContent>
</Collapsible>
```

### Faction tier color helper
```typescript
// Decision from CONTEXT.md specifics section
function factionTierColor(tier: string): string {
  switch (tier) {
    case 'Hostile':    return 'text-red-400 border-red-400'
    case 'Unfriendly': return 'text-orange-400 border-orange-400'
    case 'Neutral':    return 'text-muted-foreground'
    case 'Friendly':   return 'text-green-400 border-green-400'
    case 'Allied':     return 'text-sky-400 border-sky-400'
    default:           return 'text-muted-foreground'
  }
}
```

---

## Schema Design Decision (Claude's Discretion)

**Migration number:** Next migration is **0006**. Existing: 0000–0005. [VERIFIED: codebase grep — resources/migrations/0005_sessions_unique_session_number.sql is the latest]

**hasInspiration already exists:** `character_resources.has_inspiration` is already a column (schema.ts line 166). The `awardInspiration` tool only needs to flip it to `true` — no schema change needed for this specific field. [VERIFIED: src/main/db/schema.ts]

**World state storage:** Store as nullable columns on the `campaigns` table (not a separate `world_state` table). Rationale: the `campaigns` row is already fetched by `CampaignViewScreen` via `trpc.campaigns.get` — adding columns avoids a second query for header display. The 5 nullable columns add minimal overhead and match the pattern of `permadeathMode` and `rollingSummary` added in previous migrations.

**ID format for quests, npcs, factions:** Use `text('id').primaryKey()` with `randomUUID()` — same as all existing tables. Integer PKs would make AI references less reliable (sequential numbers are harder for LLMs to track than UUIDs). [VERIFIED: src/main/db/schema.ts — every table uses text UUID PK]

**Faction FK in npcs table:** Use `factionName` text (not a FK to factions.id). Rationale: the AI calls `addNpc` and `updateFaction` independently; a faction named in `addNpc.factionName` may not yet have a factions row. Text name avoids FK constraint failures. This matches how the AI references faction names (by string, not by ID).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `parameters` in Vercel AI SDK tool() | `inputSchema` (renamed in AI SDK v6) | AI SDK v6 | All Phase 6 tool registrations must use `inputSchema`, not `parameters` |
| Separate table for every world-state datum | Nullable columns on parent entity | N/A — Phase 6 decides | Simpler for single-character campaigns; revisit if multi-character in Phase 7 requires separate world-state scoping |

**Already-established pattern (confirmed by Phase 5):**
- `tool()` uses `inputSchema` field (not `parameters`) — confirmed in `src/main/ai/toolSchemas.ts`
- `ToolSet` type from `'ai'` package is used for the exported constant type
- `safeParse` + silent log on failure for all pipeline cases

---

## Wave Planning Recommendation

The phase naturally decomposes into 5 waves with clean dependency boundaries:

**Wave 0 — Foundation (schema + repos + test stubs)**
- Migration 0006 SQL file
- Schema additions (quests, npcs, factions tables; world-state columns on campaigns)
- `questsRepo.ts`, `npcsRepo.ts`, `factionsRepo.ts`
- Test stubs: `questsRepo.test.ts`, `npcsRepo.test.ts`, `factionsRepo.test.ts`

**Wave 1 — tRPC + pipeline (main process)**
- `quests.ts`, `npcs.ts`, `worldState.ts` tRPC routers
- Register in `router.ts`
- 8 new Zod schemas + `PHASE6_TOOLS` + `ALL_TOOLS` in `toolSchemas.ts`
- 8 new switch cases in `mutationPipeline.ts`
- `MutationChip` type extension
- Update `streamText` call to pass `ALL_TOOLS`
- `toolSchemas.test.ts` additions, `mutationPipeline.test.ts` additions

**Wave 2 — ContextBuilder extension**
- `formatWorldStateSummary()` in `contextBuilder.ts`
- Extend `toolDescriptionsBlock` with Phase 6 tool descriptions
- `contextBuilder.test.ts` additions

**Wave 3 — UI components**
- `MutationChipStack.tsx` extension (4 new chip types + icons)
- `QuestsTab.tsx` (new component)
- `NpcTrackerTab.tsx` (replaces placeholder)
- `CampaignViewScreen.tsx`: add 6th tab trigger+content, import NpcTrackerTab, add world-state sub-bar, add cache invalidation for new query keys, add worldState query if using separate router (or extend campaignQuery if using campaigns columns)

Wave 3 UI components can be parallelized: `QuestsTab.tsx` and `NpcTrackerTab.tsx` are independent; `CampaignViewScreen.tsx` edits must happen after both are ready.

**Wave 4 — Code review / bug fixes** (standard phase pattern)

**Wave 5 — Verification** (standard phase pattern)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-01 | `questsRepo.create` + `updateStatus` writes to DB | unit | `npx vitest run src/main/db/questsRepo.test.ts` | ❌ Wave 0 |
| STATE-01 | `addQuest` tool schema validates input | unit | `npx vitest run src/main/ai/toolSchemas.test.ts` | ✅ (extend) |
| STATE-01 | `applyMutationBatch` with addQuest creates quest row | unit | `npx vitest run src/main/ai/mutationPipeline.test.ts` | ✅ (extend) |
| STATE-02 | `npcsRepo.create` + `patch` writes to DB | unit | `npx vitest run src/main/db/npcsRepo.test.ts` | ❌ Wave 0 |
| STATE-03 | `factionsRepo.upsert` creates + updates faction | unit | `npx vitest run src/main/db/factionsRepo.test.ts` | ❌ Wave 0 |
| STATE-04 | `updateWorldTime` writes to campaigns world columns | unit | `npx vitest run src/main/ai/mutationPipeline.test.ts` | ✅ (extend) |
| WORLD-03 | `updateLocation` stores path JSON in campaigns | unit | `npx vitest run src/main/ai/mutationPipeline.test.ts` | ✅ (extend) |
| PARTY-03 | `awardInspiration` flips `hasInspiration=true` | unit | `npx vitest run src/main/ai/mutationPipeline.test.ts` | ✅ (extend) |
| STATE-01 | `formatWorldStateSummary` includes active quests with IDs | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/db/questsRepo.test.ts` — covers STATE-01 repo layer
- [ ] `src/main/db/npcsRepo.test.ts` — covers STATE-02 repo layer
- [ ] `src/main/db/factionsRepo.test.ts` — covers STATE-03 repo layer with upsert verification

*(Existing test infrastructure: vitest + in-memory SQLite with `migrate()` using `MIGRATIONS_FOLDER` — see mutationPipeline.test.ts lines 29-39 for the exact harness to copy)*

---

## Environment Availability

> Phase 6 is code/config-only — no new external tools, runtimes, or services required.

Step 2.6: SKIPPED (no external dependencies beyond existing project stack; no new npm packages; migration file is a static SQL file run by the existing Drizzle `migrate()` call at startup).

---

## Security Domain

> `security_enforcement` is absent from config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth layer in this phase |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | Single-user desktop app; no multi-user ACL |
| V5 Input Validation | yes | Zod schemas on all 8 new tool args (bounded string lengths, enum validation); `campaignIdSchema` on all tRPC inputs |
| V6 Cryptography | no | No new crypto; hasInspiration is a boolean, not sensitive data |

### Known Threat Patterns for Phase 6 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| AI-generated quest/NPC names with XSS payload | Tampering | React renders text as text nodes (not innerHTML); Tailwind className is static; no dangerouslySetInnerHTML used in tab components |
| Oversized AI text fields (description/name) | Tampering / DoS | Zod `.max()` bounds on all string fields: name max 200, description max 500, path segments max 100 each, max 10 segments |
| AI sends fake UUID in `updateQuestStatus` / `updateNpc` | Spoofing | Drizzle UPDATE silently updates 0 rows; pipeline continues; logEvent records the attempted mutation; no crash or state corruption |
| Injected newlines in location path segments breaking system prompt | Tampering | Path segments validated as `z.string().max(100)` — strip newlines in formatWorldStateSummary display |
| `updateFaction` creating hundreds of factions in one session | DoS | Faction list capped at reasonable render limit in UI; world-state context summary caps NPC list at 20 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | World-state columns on `campaigns` table (not separate table) preferred for simplicity | Schema Design Decision | Low — adding a separate table later is a non-breaking migration; columns on campaigns is strictly simpler |
| A2 | `npcId` / `questId` are text UUIDs (not integer PKs) | Schema Design Decision | Low — consistent with all existing tables; verified pattern |
| A3 | `ALL_TOOLS` should be the combined tool set export name | Pattern 2 | Low — naming is arbitrary; planner may choose differently |
| A4 | Token budget: cap NPC context injection at 20 NPCs | Pattern 4 | Medium — correct cap depends on model context window; 20 is conservative |
| A5 | `formatWorldStateSummary` injected after toolDescriptionsBlock (before referenceDocBlock) | Pattern 4 | Low — position within system prompt is Claude's discretion per D-18; this position ensures AI sees world state before reference docs and memory layers |

**If this table is empty:** All claims were verified against the codebase. A1–A5 are discretionary design choices, not factual claims.

---

## Open Questions

1. **`updateLocation` and `updateWorldTime` — should updating campaigns use a dedicated repo method or inline Drizzle in the pipeline?**
   - What we know: All Phase 5 mutations use dedicated repo methods (e.g., `charactersRepo.updateHp`). However, `campaignsRepo.ts` currently handles campaign CRUD, not world-state updates.
   - What's unclear: Whether to add `updateWorldState()` to `campaignsRepo.ts` or create a minimal `worldStateRepo.ts`.
   - Recommendation: Add `updateWorldState()` to `campaignsRepo.ts` — it already owns the `campaigns` table. No new file needed.

2. **Cache invalidation for world state — invalidate `campaigns.get` or a separate query key?**
   - What we know: `CampaignViewScreen` already has `useQuery({ queryKey: ['campaigns', 'get', id] })`. If world-state is on `campaigns`, invalidating this key refreshes the header automatically.
   - What's unclear: Will invalidating `campaigns.get` after every AI mutation (it fires frequently) cause performance issues?
   - Recommendation: Invalidate `campaigns.get` only in the `cacheInvalidationHandler` when the payload chips include a world-state change. Chip types `updateWorldTime` / `updateLocation` are silent (no chip per D-16), so a different signal is needed. Simplest: always invalidate `campaigns.get` in `cacheInvalidationHandler` (it's a fast SQLite read). The existing handler already invalidates 3 query keys on every mutation — one more is negligible.

---

## Sources

### Primary (HIGH confidence)
- `src/main/db/schema.ts` — confirmed `hasInspiration` exists on `character_resources`; confirmed no `location` column on `campaigns` (the `location` column in schema.ts is on `sessions`, not `campaigns`); confirmed UUID text PKs throughout [VERIFIED: codebase read]
- `src/main/ai/toolSchemas.ts` — confirmed `inputSchema` API, `PHASE5_TOOLS` export, `ToolSet` type, no-execute pattern [VERIFIED: codebase read]
- `src/main/ai/mutationPipeline.ts` — confirmed `applyOneTool` switch pattern, `MutationChip` type, `logEvent` helper, `db.transaction()` sync constraint [VERIFIED: codebase read]
- `src/main/ai/contextBuilder.ts` — confirmed system prompt assembly order; `toolDescriptionsBlock` constant; injection position [VERIFIED: codebase read]
- `src/renderer/src/screens/CampaignViewScreen.tsx` — confirmed 5 existing tabs; NPC Tracker placeholder at line 569; `cacheInvalidationHandler` at line 242; header bar structure [VERIFIED: codebase read]
- `src/renderer/src/components/MutationChipStack.tsx` — confirmed `ChipType` union (7 types); `iconFor()` switch; import list [VERIFIED: codebase read]
- `resources/migrations/` — confirmed 6 migrations exist (0000–0005); next is **0006** [VERIFIED: filesystem glob]
- `src/main/db/sessionsRepo.ts` — confirmed repo pattern: create/get/list/update all synchronous, Drizzle `.run()` / `.get()` / `.all()` [VERIFIED: codebase read]
- `src/main/trpc/routers/combat.ts` — confirmed tRPC router pattern with `t.procedure`, `campaignIdSchema`, `.query()` / `.mutation()` [VERIFIED: codebase read]
- `src/main/trpc/router.ts` — confirmed router registration pattern [VERIFIED: codebase read]
- `vitest.config.ts` — confirmed test framework: Vitest 2.x, `environment: 'node'`, glob `src/**/*.test.ts` [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)
- Drizzle `onConflictDoUpdate` for faction upsert — confirmed API exists in Drizzle ORM SQLite docs [ASSUMED: training knowledge; standard Drizzle pattern, not verified against current Context7 docs in this session]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed; verified in package.json implicitly via existing import patterns
- Schema design: HIGH — migration count verified by glob; hasInspiration existence verified by schema.ts read; UUID PK pattern verified
- Architecture/patterns: HIGH — every pattern derived directly from existing Phase 5 code, not from training data
- Pitfalls: HIGH — derived from actual code read (the `PHASE5_TOOLS` reference in index.ts, the transaction sync constraint in mutationPipeline.ts WR-07, etc.)

**Research date:** 2026-05-29
**Valid until:** 2026-06-29 (stable stack — no fast-moving dependencies)
