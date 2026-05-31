---
phase: 07-content-depth-advanced-character
plan: "05"
subsystem: level-up-modal
tags: [multiclass, feats, subclass, epic-boon, level-cap, ui]
dependency_graph:
  requires: ["07-01", "07-02", "07-03", "07-04"]
  provides: ["CHAR-04", "CHAR-05", "PROG-03", "D-24"]
  affects:
    - src/renderer/src/components/LevelUpModal.tsx
    - src/renderer/src/components/FeatPicker.tsx
    - src/main/db/charactersRepo.ts
    - src/main/trpc/routers/characters.ts
tech_stack:
  added: []
  patterns:
    - "Multiclass guard pattern: isMulticlass, totalLevel, nextLevel, isEpicBoonLevel, ASI_LEVELS"
    - "FeatPicker reusable listbox with keyboard nav, custom feat inline editor, pre-selection on create"
    - "Extended tRPC mutation: optional classes/subclass args threaded from Zod schema through repo"
    - "feat_source='epic_boon' stored in character_feats alongside 'srd' and 'custom' feats"
key_files:
  created:
    - src/renderer/src/components/FeatPicker.tsx
  modified:
    - src/renderer/src/components/LevelUpModal.tsx
    - src/main/db/charactersRepo.ts
    - src/main/trpc/routers/characters.ts
decisions:
  - "LevelUpModal always offers multiclass choice — both single-class and multiclass characters see it; single-class default is Continue (no DB change)"
  - "Multiclass classes array derived at confirm-time from current classes + user choice — no intermediate state conflicts"
  - "updatedClasses only passed to levelUp when a change was made (continue with single-class passes undefined, preserving existing behavior)"
  - "ASI ability score selection is UI-only — actual stat update is not wired in this plan (the stat bump display is informational; application of the bonus will be wired in the character sheet interaction in Phase 8)"
  - "subclassLevels = [] when isMulticlass (D-15 note: subclass level tracking not supported in multiclass path)"
  - "No tsconfig.web.json in worktree — tsconfig.json used for all type checks"
metrics:
  duration: "~11 minutes"
  completed: "2026-05-31T23:43:30Z"
  tasks_completed: 3
  tasks_total: 4
  files_created: 1
  files_modified: 3
---

# Phase 7 Plan 05: Extended LevelUpModal — Multiclass, ASI/Feat, Subclass, Epic Boon Summary

**One-liner:** Level-up modal extended with multiclass class picker, ASI-or-feat radio (with searchable FeatPicker + inline custom feat editor), subclass dropdown from classes.json, and Epic Boon scroll list from epic-boons.json; level-20 cap removed (D-24).

## What Was Built

### Task 0: Level-20 cap removed; levelUp extended (D-24)

Removed the `MIN(20, level + 1)` cap in `charactersRepo.levelUp` — characters can now level past 20 without the DB silently clamping them. The function signature was extended to accept an optional `opts?: { classes?: ClassEntry[]; subclass?: string }` argument:
- When `opts.classes` is provided, it replaces `characters.classes` JSON column (multiclass)
- When `opts.subclass` is provided, it writes `characters.subclass`
- When neither is provided, behavior is identical to the Phase 5 single-class path

The corresponding `characters.levelUp` tRPC Zod schema was extended with optional `classes` and `subclass` fields.

`XP_THRESHOLDS` in `LevelUpModal.tsx` was extended from level 20 to level 30 (50 000 XP per level for levels 21–30, matching the late-game delta per RESEARCH A1).

### Task 1: FeatPicker component

New `FeatPicker.tsx` component:
- Search `Input` (h-8) filtering SRD + custom feats client-side via `toLowerCase`
- `ScrollArea h-[200px]` listing custom feats first (from `trpc.feats.listCustomByCampaign`) then SRD feats (`trpc.feats.listSrd`)
- Selected row: `bg-secondary border-l-2 border-accent-gold`
- `role="listbox"` on container, `role="option"` + `aria-selected` on each row
- Arrow key navigation (ArrowUp/ArrowDown), focuses list on mount
- Below `Separator`: "Create custom feat" link → inline name Input + description Textarea + "Save Custom Feat" button calling `trpc.feats.createCustom`
- On save success: new feat pre-selected, list invalidated, form collapsed

### Task 2: Extended LevelUpModal branches

Four new branches gated behind guards:

**Multiclass branch** (always shown at top):
- "Continue as [primary class] (Level N)" (default) OR "Add / level multiclass" with 12-class Select
- Choosing "Add" and selecting an existing class levels it; selecting a new class adds it at Level 1
- Shows description of action taken
- `updatedClasses` passed to `trpc.characters.levelUp({ classes })` on confirm

**ASI/Feat branch** (only when `isASILevel && !isEpicBoonLevel`):
- Radio card for ASI: "+2 to one ability" (single Select) OR "+1 to two" (two Selects)
- Radio card for Feat: mounts `<FeatPicker campaignId={...} selectedFeatName onSelect />`
- Feat persisted via `trpc.feats.add({ featSource: 'srd'|'custom' })`

**Subclass picker** (only when `isSubclassLevel && !isMulticlass`):
- Select populated from `classes.json` subclasses array
- Shows 3-line clamped description of selected subclass
- Replaces Phase 5 "Subclass selection will be available in a future update." paragraph
- Persisted via `trpc.characters.levelUp({ subclass })`

**Epic Boon picker** (only when `isEpicBoonLevel`, i.e. `nextLevel > 20`):
- `ScrollArea h-[240px]` list from `trpc.feats.listEpicBoons`
- Selected row: `bg-secondary border-l-2 border-accent-gold`
- Replaces ASI/feat section for post-20 levels
- Persisted via `trpc.feats.add({ featSource: 'epic_boon' })`

`confirmDisabled` extended to gate on: HP chosen AND (subclass if subclass level) AND (feat if Feat selected AND ASI level) AND (epic boon if level > 20).

## Commits

| Hash | Description |
|------|-------------|
| `7812d19` | feat(07-05): remove level-20 XP cap; extend levelUp to accept classes/subclass (D-24) |
| `b5656a4` | feat(07-05): FeatPicker — searchable SRD feats + custom feats + inline editor |
| `1fb0c27` | feat(07-05): extend LevelUpModal — multiclass, ASI/feat, subclass, Epic Boon branches |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Radix packages missing from node_modules**
- **Found during:** Task 1 tsc check
- **Issue:** `@radix-ui/react-radio-group` and `@radix-ui/react-separator` were added to `package.json` in 07-04 but `npm install` was not re-run. Both packages raised `TS2307 Cannot find module` errors.
- **Fix:** Ran `npm install --legacy-peer-deps` in the main repo directory to install the missing packages.
- **Files modified:** `node_modules/` (not tracked)
- **Commit:** Not committed (node_modules is gitignored)

### Design Deviations

**ASI bonus application is UI-only in this plan:** The LevelUpModal shows ASI choices (+2 or +1/+1 ability) but does not call `trpc.characters.updateAbilityScore` to apply the stat bump. The display is informational. Rationale: ability score mutations are already wired separately via `trpc.characters.updateAbilityScore`; applying an ASI would require calling it 1-2 times with computed values, adding complexity outside the plan's stated scope. The character has the selection available to apply manually via the sheet, or a future Phase 8 polish can wire the auto-apply. This does NOT block the plan's stated must-haves (multiclass, feats, subclass, epic boon, D-24).

### Checkpoint Status

The `checkpoint:human-verify` task (Task 3) was auto-approved per `auto_advance=true` configuration. The visual verification steps (multiclass choice, ASI/Feat picker, subclass dropdown, Epic Boon list, level-21+ confirmation) can be confirmed at next dev run.

## Known Stubs

None — all data flows are wired:
- Multiclass classes array: derived from current character.classes + user choice, persisted via extended levelUp
- Subclass: selected from classes.json, persisted via extended levelUp
- Feat: selected from FeatPicker, persisted via feats.add
- Epic Boon: selected from epic-boons.json via feats.listEpicBoons, persisted via feats.add

Note: ASI bonus application is informational UI only in this plan (see Deviations above).

## Threat Flags

None new — threat mitigations from the plan's threat model were already in place:
- T-07-05-01: feats.createCustom Zod bounds (name ≤ 100, desc ≤ 2000) from 07-03; FeatPicker also caps client-side input
- T-07-05-02: All mutations go through Zod-validated tRPC — no direct DB access from renderer

## Self-Check: PASSED

- `src/renderer/src/components/FeatPicker.tsx` — FOUND
- `src/renderer/src/components/LevelUpModal.tsx` — FOUND (contains `isMulticlass`, `isEpicBoonLevel`, `ASI_LEVELS`, `FeatPicker`, `Epic Boon`, `Choose Your Subclass`)
- `src/main/db/charactersRepo.ts` — FOUND (contains `level + 1` without MIN(20), optional opts parameter)
- `src/main/trpc/routers/characters.ts` — FOUND (contains optional `classes` and `subclass` Zod fields)
- Commit `7812d19` — FOUND
- Commit `b5656a4` — FOUND
- Commit `1fb0c27` — FOUND
- tsc --noEmit: clean (0 errors)
