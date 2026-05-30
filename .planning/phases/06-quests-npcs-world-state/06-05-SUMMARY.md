---
phase: 06-quests-npcs-world-state
plan: 05
subsystem: renderer-ui
tags: [npc-tracker, factions, mutation-chips, read-only-ui]
requires:
  - "trpc.npcs.list (06-02)"
  - "trpc.factions.list (06-02)"
  - "mutationPipeline chip emit values: quest|quest_complete|npc|inspiration (06-02 Wave 2)"
provides:
  - "NpcTrackerTab — read-only NPC list + collapsible Factions section"
  - "MutationChipStack — 4 Phase 6 chip types (quest, quest_complete, npc, inspiration)"
affects:
  - "CampaignViewScreen (future S5 wiring plan mounts <NpcTrackerTab/>)"
tech-stack:
  added: []
  patterns:
    - "Read-only AI-populated tab (TanStack Query, no mutations) — mirrors CombatTrackerTab"
    - "shadcn Collapsible defaultOpen for space-managed section growth"
key-files:
  created:
    - src/renderer/src/components/NpcTrackerTab.tsx
  modified:
    - src/renderer/src/components/MutationChipStack.tsx
decisions:
  - "Used npx tsc --noEmit (single tsconfig.json) — plan's tsconfig.web.json does not exist in this repo"
  - "S5 CampaignViewScreen wiring intentionally out of scope (separate plan); files_modified lists only the 2 component files"
metrics:
  duration: 4min
  completed: 2026-05-30
---

# Phase 6 Plan 05: NpcTrackerTab + MutationChipStack Extension Summary

Built the read-only `NpcTrackerTab` (chronological NPC list with relationship tags plus a collapsible Factions section with tier badges and a "No NPCs yet" empty state) and extended `MutationChipStack` with the four Phase 6 chip types (`quest`, `quest_complete`, `npc`, `inspiration`) — the player-facing surfaces for STATE-02, STATE-03, and PARTY-03.

## What Was Built

### Task 1 — NpcTrackerTab (`feat`, bf7f9c8)
New `src/renderer/src/components/NpcTrackerTab.tsx` exporting `NpcTrackerTab({ campaignId })`:
- Two `useQuery` calls with keys `['npcs','list',campaignId]` and `['factions','list',campaignId]`, wired to `trpc.npcs.list` / `trpc.factions.list` (read-only, D-09 — no mutation/edit controls).
- Container `h-full flex flex-col overflow-hidden` > `ScrollArea flex-1` > `flex flex-col gap-2 p-3`.
- `NpcRow` per UI-SPEC §S3: `bg-card border rounded-lg px-3 py-2 flex items-start gap-3`, semibold truncated name, outline relationship Badge, optional `text-xs text-muted-foreground` description.
- Collapsible Factions section (§S3b) with `defaultOpen={true}`, `ChevronDown` trigger + "Factions" label + `({count})`, and tier-badged faction rows; rendered only when `factions.length > 0`.
- Empty state (§S3a) — `Users` icon + "No NPCs yet" + "Characters you meet will be tracked here as the DM introduces them." — shown only when both lists are empty.
- `npcRelationshipColor` (Friendly→green, Hostile→red, Neutral/Unknown→muted) and `factionTierColor` (Hostile→red, Unfriendly→orange, Neutral→muted, Friendly→green, Allied→sky) helpers, verbatim from UI-SPEC.

### Task 2 — MutationChipStack extension (`feat`, 324bda1)
Extended `src/renderer/src/components/MutationChipStack.tsx`:
- `ChipType` union gains `'quest' | 'quest_complete' | 'npc' | 'inspiration'`.
- Added `ScrollText` and `Check` lucide imports; reused already-present `UserPlus` and `Star` (no duplicate import).
- Four new `iconFor` cases: `quest`=ScrollText green, `quest_complete`=Check muted, `npc`=UserPlus muted, `inspiration`=Star amber.
- All existing chip behavior (4-chip max, 4000ms auto-dismiss, FIFO, slide-in animation, `role="status" aria-live="polite"`) unchanged.

## Verification

- `npx tsc --noEmit` — both plan files compile with **zero** errors (the 7 reported errors are pre-existing, in untouched files `llmProvider.ts` and `CampaignViewScreen.tsx`; already logged in `deferred-items.md` from 06-01 and confirmed present on the wave base commit f93f364).
- No `dangerouslySetInnerHTML` in `NpcTrackerTab.tsx` (T-06-05-01 mitigated — all AI text rendered as React text nodes).
- Chip type strings verified against `src/main/ai/mutationPipeline.ts`: emits `type: 'quest'` (L415), `'quest_complete'` (L429), `'npc'` (L451), `'inspiration'` (L540) — exact match (T-06-05-03 mitigated).

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Corrected `tsconfig.web.json` → `tsconfig.json` verification command**
- **Found during:** Task 1 verify step.
- **Issue:** The plan's `<verify>` uses `npx tsc --noEmit -p tsconfig.web.json`, but this repo has no `tsconfig.web.json`. It type-checks via a single `tsconfig.json` (`npm run typecheck` → `tsc --noEmit`, which includes `./src`).
- **Fix:** Ran `npx tsc --noEmit` instead. Both plan files compile cleanly. No code change required.
- **Files modified:** None (verification-only adjustment).
- **Commit:** n/a.

No other deviations. The two component files were implemented verbatim against UI-SPEC §S3 and §S4.

## Scope Notes

- UI-SPEC §S5 (mounting `<NpcTrackerTab/>` into `CampaignViewScreen`, adding the Quests tab/content, cache-invalidation wiring) is **out of scope** for 06-05 — `files_modified` lists only the two component files, and §S5 is owned by a separate plan. NpcTrackerTab is therefore not yet rendered anywhere; it compiles and is ready for that wiring plan to import.

## Threat Surface

No new security-relevant surface introduced beyond the plan's threat model. The components are read-only consumers of existing tRPC read procedures; all AI-originated text is rendered as React text nodes with static classNames.

## Known Stubs

None. Both components are fully wired to live tRPC queries (NpcTrackerTab) and the live IPC mutation-chip stream (MutationChipStack). No hardcoded/placeholder data.

## Self-Check: PASSED

- FOUND: src/renderer/src/components/NpcTrackerTab.tsx
- FOUND: src/renderer/src/components/MutationChipStack.tsx
- FOUND: .planning/phases/06-quests-npcs-world-state/06-05-SUMMARY.md
- FOUND commit: bf7f9c8 (Task 1)
- FOUND commit: 324bda1 (Task 2)
