# Phase 6: Quests, NPCs & World State - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

A user playing a session sees the AI auto-populate a quest log and NPC tracker, watches faction reputations shift based on in-game actions, sees the in-world calendar advance and a location breadcrumb update in the campaign header, and receives Inspiration for great roleplay — all via 8 new structured AI tool calls that extend the Phase 5 mutation contract.

**In scope:** Quest log (new Quests tab), NPC tracker (existing placeholder → full implementation), Faction reputation section inside NPC Tracker tab, world time + season display in campaign header, location breadcrumb in campaign header, Inspiration tool (flip hasInspiration on character), 8 new Phase 6 AI tool calls, new DB tables (quests, npcs, factions, world_state or world_state columns on campaigns), MutationChipStack extension for quest/NPC/inspiration chips.

**Out of scope:** Player-editable quests or NPC notes (AI-only), subclass/feat/party changes (Phase 7), quest search/filter (Phase 8), SRD reference tab (Phase 7), any world-setup modes (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Quest Log (Quests Tab — new 6th tab)

- **D-01:** **New 6th tab "Quests"** — standalone tab added to the right panel tab list in CampaignViewScreen. Does NOT expand the existing NPC Tracker tab. Tab order: Character Sheet → Combat Tracker → NPC Tracker → Session Journal → Inventory → **Quests**.

- **D-02:** **Single chronological list with status badges** — quests appear in the order they were added by the AI. No grouping into Active/Completed sections. Each entry shows a badge: `Active` (green), `Completed` (muted), `Failed` (red).

- **D-03:** **Quest entry layout** — name + status badge + one-line description, all inline. No expandable card in Phase 6. Description is the AI's summary of the quest as introduced.

- **D-04:** **AI-only (read-only for player)** — the Quests tab is a read-only view of what the AI has written. No "mark complete" or notes field for the player. The AI owns quest state via `updateQuestStatus`.

- **D-05:** **Chip notifications** — `quest_added` and `quest_complete` chips use the existing MutationChipStack pattern from Phase 5. These two events get chips; quest failure is silent (no chip).

### NPC Tracker (Existing Tab → Full Implementation)

- **D-06:** **Chronological order (encounter order)** — NPCs appear in the order the AI introduced them. No grouping by faction or alphabetical sort. `created_at` or an `encounter_order` integer on the npcs table drives sort.

- **D-07:** **Each NPC row shows: name + relationship status + one-line description** — the relationship status is a distinct tag per NPC (Friendly / Neutral / Hostile / Unknown), separate from faction-level reputation. Description is the AI's one-line characterization (e.g., "The blacksmith of Redpine, gruff but fair").

- **D-08:** **Factions section = separate collapsible section BELOW the NPC list** — NPC list at top of the tab, then a collapsible "Factions" section beneath it. Both scroll within the same tab column. Factions section shows faction name + tier label (Hostile / Unfriendly / Neutral / Friendly / Allied).

- **D-09:** **NPC Tracker is AI-only (read-only for player)** — no player editing of NPC names, descriptions, or relationship status. AI owns all NPC state via `addNpc` / `updateNpc`.

- **D-10:** **NPC chip notification** — `npc_added` chip fires when the AI calls `addNpc`. NPC updates (`updateNpc`) are silent.

### Calendar + Location Breadcrumb

- **D-11:** **Both live in the campaign header bar** — the same header strip that currently shows the campaign name / active controls. Calendar info on the left side, location breadcrumb on the right side (or separated by a divider). This is a single compact row above the chat panel — always visible during play.

- **D-12:** **Calendar display = compact format** — `Evening • Day 14 • Autumn`. Three fields: time of day (text: Morning / Afternoon / Evening / Night), day number (integer), season (Spring / Summer / Autumn / Winter). Uses a small icon (🌙/☀️) for time of day. No in-world calendar name in Phase 6 (no month/day names needed — the AI doesn't need to track a named calendar system).

- **D-13:** **Location breadcrumb = path array joined with ' > '** — e.g., `Forest > Ancient Ruins > Crypt Level 2`. The AI sends a string array via `updateLocation`; the app renders the segments with ' > ' separators. May truncate with ellipsis if path is very long.

### Phase 6 AI Tool Schema

- **D-14:** **Fine-grained per-mutation tools** — same pattern as Phase 5. One tool per mutation type. 8 new tools in Phase 6:
  1. `addQuest` — `{ name: string, description: string }` → creates with status 'Active'
  2. `updateQuestStatus` — `{ questId: string, status: 'Active'|'Completed'|'Failed' }`
  3. `addNpc` — `{ name: string, description: string, relationship: 'Friendly'|'Neutral'|'Hostile'|'Unknown', factionName?: string }`
  4. `updateNpc` — `{ npcId: string, description?: string, relationship?: 'Friendly'|'Neutral'|'Hostile'|'Unknown', factionName?: string }` — patches only provided fields
  5. `updateFaction` — `{ factionName: string, tier: 'Hostile'|'Unfriendly'|'Neutral'|'Friendly'|'Allied' }` — absolute value (not delta); creates faction if it doesn't exist yet
  6. `updateWorldTime` — `{ timeOfDay: 'Morning'|'Afternoon'|'Evening'|'Night', dayNumber: number, season: 'Spring'|'Summer'|'Autumn'|'Winter' }` — absolute values each call
  7. `updateLocation` — `{ path: string[] }` — e.g., `['Forest', 'Ancient Ruins', 'Crypt Level 2']`
  8. `awardInspiration` — `{ characterId: string }` — flips `hasInspiration = true` on that character's resources row (future-proof for Phase 7 party mode)

- **D-15:** **Full CRUD minus delete for NPCs** — `addNpc` creates; `updateNpc` patches. The AI tracks `npcId` for updates; the system prompt includes current NPC list with IDs so the AI can reference them.

- **D-16:** **Selective chip notifications** — Phase 6 chips extend MutationChipStack:
  - `quest_added` → chip (green, scroll icon)
  - `quest_complete` → chip (muted, checkmark icon)
  - `npc_added` → chip (muted, user+ icon)
  - `inspiration_awarded` → chip (amber, star icon)
  - `updateFaction`, `updateWorldTime`, `updateLocation` → silent (no chip)

- **D-17:** **JSON-tail fallback** — same as Phase 5 (D-02 in 05-CONTEXT.md). The Phase 6 tools are added to the JSON-tail mutation schema alongside Phase 5 tools. No separate fallback path.

- **D-18:** **Context injection** — AI system prompt includes current world state so it can reference quest IDs and NPC IDs in subsequent tool calls: active quest list (id + name + status), NPC list (id + name + relationship), faction list (name + tier), current time + location. This is a new section in ContextBuilder's character summary injection.

### Claude's Discretion

- Exact Zod schemas for all 8 tool calls (string enums, optional fields, ID formats)
- DB schema for new tables: `quests`, `npcs`, `factions`, and world-state storage (new columns on `campaigns` vs. a `world_state` table)
- Migration number (migration 0005 or 0006 depending on what Phase 5 used)
- Chip icon choices for quest/NPC/inspiration types
- Exact header bar layout: spacing, icon, separator style between calendar and breadcrumb
- Whether `npcId` and `questId` are UUIDs or integer PKs (follow existing schema pattern)
- World state context-injection position within ContextBuilder (after character summary, before tool definitions)
- `updateFaction` upsert behavior: create faction if name not found, else update tier

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` § "Phase 6: Quests, NPCs & World State" — Goal, 6 success criteria, requirements list
- `.planning/REQUIREMENTS.md` — STATE-01, STATE-02, STATE-03, STATE-04, WORLD-03, PARTY-03

### Prior Phase Context (critical integration)
- `.planning/phases/05-rules-engine-dice-combat/05-CONTEXT.md` — D-01 through D-10 (tool-call schema, JSON-tail fallback, MutationChipStack, campaign_events table), D-48 (Vercel AI SDK `tools` parameter pattern). Phase 6 MUST extend, not replace, all Phase 5 tool definitions.
- `.planning/phases/04-long-campaign-memory-session-flow/04-CONTEXT.md` — ContextBuilder v2 injection order; D-17 system prompt structure that Phase 6 extends with world-state section
- `.planning/phases/03-ai-engine-provider-abstraction/03-CONTEXT.md` — LLMProvider interface (`streamText` with `tools`)
- `.planning/phases/01-foundation-secure-shell/01-CONTEXT.md` — Drizzle migration pattern (SQL files in `resources/migrations/`)

### Existing Code — Critical Integration Points
- `src/main/db/schema.ts` — Current schema. Existing: `hasInspiration` bool on `character_resources`, `location` text on `campaigns`. Phase 6 adds: `quests`, `npcs`, `factions` tables + world_state fields (or new columns on campaigns). New migration required.
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Tab list (5 tabs currently), NPC Tracker placeholder at `value="npc-tracker"` (line ~569). Phase 6 fills in NPC Tracker and adds the Quests tab.
- `src/renderer/src/components/MutationChipStack.tsx` — Chip notification system. Phase 6 extends `ChipType` union with `'quest' | 'npc' | 'inspiration'` types.
- `src/main/ai/contextBuilder.ts` — Phase 6 adds world-state section to the system prompt (NPC list with IDs, quest list with IDs, factions, current time + location).

### Technology Stack
- `CLAUDE.md` § "AI Provider Abstraction" — Vercel AI SDK `tools` parameter (same as Phase 5)
- `CLAUDE.md` § "State Management" — Zustand for active tab state (`activeTab`), TanStack Query for IPC calls to new repos

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/src/components/MutationChipStack.tsx` — Extend with quest/NPC/inspiration chip types. Follow existing `ChipType` union + `iconFor()` pattern.
- `src/renderer/src/components/CombatTrackerTab.tsx` — Pattern for a full tab implementation that was previously a placeholder. Phase 6 does the same for NPC Tracker.
- `src/renderer/src/components/ui/tabs.tsx` (shadcn Tabs) — Adding Quests as the 6th tab trigger in the TabsList.
- `src/main/db/sessionsRepo.ts` — Pattern for new `questsRepo.ts`, `npcsRepo.ts`, `factionsRepo.ts` (Drizzle query + mutation methods).
- `src/renderer/src/components/sheet/ConditionBadge.tsx` — Pill badge pattern; reuse for quest status badges (Active/Completed/Failed) and NPC relationship tags.

### Established Patterns
- **Drizzle migration:** New SQL migration file in `resources/migrations/`. Phase 6 = likely migration 0005 (Phase 5 was 0004).
- **tRPC router:** New `quests.ts`, `npcs.ts`, `worldState.ts` routers following `combat.ts` / `sessions.ts` patterns. Register in `src/main/trpc/router.ts`.
- **TanStack Query:** Wrap all new tRPC calls following `combatantsQuery` pattern from Phase 5.
- **Tool-call pipeline:** Extend `mutationPipeline.ts` (Phase 5) to handle 8 new Phase 6 tools alongside existing Phase 5 tools.

### Integration Points
- **Campaign header bar** → add calendar strip (timeOfDay + dayNumber + season) and location breadcrumb (path joined with ' > ') to the existing header component
- **NPC Tracker tab content** → replace placeholder `<p>NPCs you meet…</p>` with full NPC list + collapsible Factions section
- **CampaignViewScreen tab list** → add `<TabsTrigger value="quests">Quests</TabsTrigger>` and `<TabsContent value="quests">` for the new 6th tab
- **ContextBuilder** → new `formatWorldStateSummary()` function that emits NPC list (id + name + relationship), quest list (id + name + status), factions (name + tier), time, and location — injected into system prompt so AI can reference IDs

</code_context>

<specifics>
## Specific Ideas

- **Campaign header layout:** Calendar left-aligned (🌙 Evening • Day 14 • Autumn), location breadcrumb right-aligned (📍 Forest > Ancient Ruins > Crypt Level 2), separated by a flex spacer. Both in a slim sub-bar beneath the campaign title row or integrated into it.
- **Inspiration chip:** Amber/gold color to match the existing inspiration indicator on the character sheet. Label: "Inspiration awarded!" — distinct from XP/HP chips.
- **Faction tier colors:** Hostile = red-400, Unfriendly = orange-400, Neutral = muted, Friendly = green-400, Allied = sky-400 — maps to existing Tailwind palette.
- **NPC relationship tag colors:** Hostile = red-400, Unfriendly = orange-400 (if added later), Neutral = muted, Friendly = green-400, Unknown = muted/italic.
- **World state context injection:** Include a compact summary block at the end of the system prompt: "Current world state:\n- Time: Evening, Day 14, Autumn\n- Location: Forest > Ancient Ruins > Crypt Level 2\n- Active quests: [list with IDs]\n- Known NPCs: [list with IDs]\n- Factions: [list]". Researcher determines exact token budget.

</specifics>

<deferred>
## Deferred Ideas

- **Player-added NPC notes** — considered and rejected for Phase 6; player-editable NPC annotation is Phase 8 polish
- **Named in-world calendar** (month/day names like "14th of Harvestmoon") — deferred to Phase 7 or Phase 8; requires AI to track a calendar system consistently; too brittle for Phase 6
- **Quest details/notes** — expandable quest cards with full AI notes deferred to Phase 8 (Phase 6 is one-line inline only)
- **Quest failure chip** — deferred (silent in Phase 6; can add later if user feedback shows it matters)
- **NPC updates chip** — `updateNpc` calls are silent in Phase 6; chip could be added in Phase 8 polish

</deferred>

---

*Phase: 6-Quests, NPCs & World State*
*Context gathered: 2026-05-29*
