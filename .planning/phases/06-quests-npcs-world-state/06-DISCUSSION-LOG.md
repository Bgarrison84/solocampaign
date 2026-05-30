# Phase 6: Quests, NPCs & World State - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 06-quests-npcs-world-state
**Areas discussed:** Quest log + faction tab placement, NPC tracker layout, Calendar + location breadcrumb placement, Phase 6 AI tool schema

---

## Quest log + faction tab placement

| Option | Description | Selected |
|--------|-------------|----------|
| New 6th tab — Quests (standalone) | Dedicated Quests tab added to the right panel | ✓ |
| Expand NPC tab into World | Merge quests into a broader NPC/World tab | |
| Quests sub-section inside NPC Tracker | Quests nested inside the existing NPC tab | |

**Follow-up — Faction Reputation placement:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the NPC Tracker tab | Faction section lives in the NPC tab | ✓ |
| Inside the Quests tab | Factions grouped with quest world state | |
| Separate 7th tab — World | New dedicated World tab for factions | |

**Follow-up — Faction display style:**

| Option | Description | Selected |
|--------|-------------|----------|
| Tier labels (Hostile / Unfriendly / Neutral / Friendly / Allied) | Text labels only | ✓ |
| Progress bar + tier label | Visual progress bar with label | |
| You decide | Claude picks | |

**Follow-up — Quest organization:**

| Option | Description | Selected |
|--------|-------------|----------|
| Two sections: Active and Completed | Separate list sections | |
| Single chronological list with status badges | One list, badges indicate status | ✓ |
| You decide | Claude picks | |

**Follow-up — Quest entry info:**

| Option | Description | Selected |
|--------|-------------|----------|
| Name + status badge + one-line description | All inline | ✓ |
| Name + status badge expandable for notes | Expandable card | |
| You decide | Claude picks | |

**Follow-up — Player editing of quests:**

| Option | Description | Selected |
|--------|-------------|----------|
| AI-only (read-only) | Player cannot edit | ✓ |
| Player can mark complete / add notes | Limited editing | |
| Fully editable | Full player control | |

**Follow-up — Chip notifications:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — chip notifications (quest_added, quest_complete) | MutationChipStack pattern | ✓ |
| No — silent mutation | No chips | |
| You decide | Claude picks | |

**Notes:** All quest decisions carried over from previous session checkpoint.

---

## NPC tracker layout

| Option | Description | Selected |
|--------|-------------|----------|
| Chronological (encounter order) | NPCs appear in order introduced | ✓ |
| Grouped by faction | Clustered under faction headings | |
| Alphabetical | A-Z sort | |
| You decide | Claude picks | |

**Follow-up — NPC row info:**

| Option | Description | Selected |
|--------|-------------|----------|
| Name + one-line description (AI-written) | Matches Quest tab pattern | |
| Name + relationship status + one-line description | Adds relationship tag per NPC | ✓ |
| Name only (click to expand full notes) | Compact, expandable | |

**Follow-up — Factions section placement within tab:**

| Option | Description | Selected |
|--------|-------------|----------|
| Separate section below NPCs (collapsible) | NPC list top, factions below | ✓ |
| Factions above NPCs | Factions lead, NPCs follow | |
| Side-by-side columns | Two-column layout | |

**Follow-up — Player editing of NPC data:**

| Option | Description | Selected |
|--------|-------------|----------|
| AI-only (read-only for player) | Consistent with Quest tab | ✓ |
| Player can add personal notes per NPC | Player-editable notes field | |
| Fully editable | Full control | |

**Notes:** Relationship status (Friendly/Neutral/Hostile/Unknown) is per-NPC, distinct from faction-level tier labels.

---

## Calendar + location breadcrumb placement

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign header bar (above chat) | Persistent strip always visible | ✓ |
| Inside the Quests tab | Hidden when Quests isn't active | |
| Floating widget / HUD overlay on chat panel | Corner overlay | |

**Follow-up — Calendar display format:**

| Option | Description | Selected |
|--------|-------------|----------|
| Time of day + Day N + Season (compact) | "Evening • Day 14 • Autumn" | ✓ |
| Full date (in-world calendar name) + time of day + season | "14th of Harvestmoon • Dusk • Autumn" | |
| You decide | Researcher picks | |

**Follow-up — Location breadcrumb placement:**

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign header bar alongside the calendar | Both in same header strip | ✓ |
| Below the campaign header (its own slim bar) | Second row beneath calendar | |
| Top of the chat panel (above messages) | Pinned above story scroll | |

**Notes:** Calendar left-aligned, breadcrumb right-aligned in the same header strip. No named in-world calendar system in Phase 6 — day number + season is sufficient.

---

## Phase 6 AI tool schema

**Tool pattern:**

| Option | Description | Selected |
|--------|-------------|----------|
| Fine-grained per-mutation tools (like Phase 5) | One tool per mutation type | ✓ |
| Coarse 'world snapshot' tool (one big update) | setWorldState({...}) | |
| You decide | Researcher picks | |

**NPC CRUD scope:**

| Option | Description | Selected |
|--------|-------------|----------|
| Both add and update (full CRUD minus delete) | addNpc + updateNpc with patches | ✓ |
| Add only (append-only NPCs) | No updates, only new entries | |
| Add + update relationship only | Description immutable after add | |

**World time update style:**

| Option | Description | Selected |
|--------|-------------|----------|
| updateWorldTime({timeOfDay, dayNumber, season}) — absolute | AI sets full state each call | ✓ |
| advanceTime({hoursElapsed}) — relative | AI reports elapsed time, app calculates | |
| You decide | Researcher picks | |

**Chip notifications scope:**

| Option | Description | Selected |
|--------|-------------|----------|
| Selective chips (quest + NPC + inspiration only) | Faction/time/location silent | ✓ |
| All Phase 6 mutations get chips | Maximum feedback | |
| No chips — world state updates are silent | Minimal interruption | |

**addNpc / updateNpc field set:**

| Option | Description | Selected |
|--------|-------------|----------|
| name + description + relationship + factionName (optional) | Full per-NPC info | ✓ |
| name + description + faction only (no relationship) | Simpler schema | |
| You decide | Researcher picks minimal set | |

**updateFaction style:**

| Option | Description | Selected |
|--------|-------------|----------|
| factionName + newTier (absolute) | AI sets current standing directly | ✓ |
| factionName + delta (relative step) | App maps steps to tiers | |
| You decide | Researcher picks | |

**awardInspiration args:**

| Option | Description | Selected |
|--------|-------------|----------|
| awardInspiration({ characterId }) — future-proof | Works for Phase 7 party mode | ✓ |
| awardInspiration (no args) — solo only | Simpler, breaking change later | |
| You decide | Researcher picks | |

**updateLocation format:**

| Option | Description | Selected |
|--------|-------------|----------|
| Array of strings: ['Forest', 'Ancient Ruins', 'Crypt Level 2'] | Clean, parseable segments | ✓ |
| Single string: 'Forest > Ancient Ruins > Crypt Level 2' | AI formats separator | |
| You decide | Researcher picks | |

**Notes:** Phase 6 adds 8 new tools alongside all Phase 5 tools. JSON-tail fallback from Phase 5 (D-02 in 05-CONTEXT.md) extends to cover Phase 6 tools without a separate fallback path.

---

## Claude's Discretion

- Exact Zod schemas for all 8 tool calls (field types, string enum values, optional/required)
- DB schema for new tables: quests, npcs, factions, world_state (or columns on campaigns)
- Migration number
- Chip icon choices for quest/NPC/inspiration chip types
- Header bar layout details (spacing, icon, divider style)
- npcId / questId as UUID or integer (follow existing schema pattern)
- World state context-injection position within ContextBuilder
- updateFaction upsert behavior (create if name not found)

## Deferred Ideas

- Named in-world calendar system (month names) — Phase 7 or Phase 8
- Player-added NPC notes — Phase 8 polish
- Expandable quest detail cards — Phase 8
- Quest failure chip — revisit in Phase 8 based on user feedback
- NPC update chips — Phase 8 polish
