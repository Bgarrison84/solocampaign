---
phase: 02-character-domain-live-sheet
plan: "06"
subsystem: character-sheet-ui
tags: [character-sheet, live-play, optimistic-mutations, react, trpc, tanstack-query]
dependency_graph:
  requires: [02-01, 02-02, 02-04, 02-05]
  provides: [CharacterSheetTab-full, ResourcesSection, Stepper, ProficiencyDot, ConditionBadge, SpellSlotPips, PortraitSlot, sheetHelpers, 9-sheet-sections]
  affects: [02-07]
tech_stack:
  added: []
  patterns:
    - "Zero-debounce optimistic mutation: onMutate cancelQueries + setQueryData, onError rollback, onSettled invalidateQueries (RESEARCH.md Pattern 5)"
    - "Delta-based mutations for HP/currency/spell slots — no absolute-value race conditions"
    - "Ability score edits persist on blur via local useState + useEffect sync"
    - "ConditionName typed union flows through ALL_CONDITIONS to ConditionBadge and condition mutation"
    - "Portrait import fires characters.importPortrait mutation then invalidates getPortraitDataUrl query"
    - "TraitsSection: local useState(true) for collapsed, max-height transition animation"
key_files:
  created:
    - src/renderer/src/components/sheet/sheetHelpers.ts
    - src/renderer/src/components/sheet/Stepper.tsx
    - src/renderer/src/components/sheet/ProficiencyDot.tsx
    - src/renderer/src/components/sheet/ConditionBadge.tsx
    - src/renderer/src/components/sheet/SpellSlotPips.tsx
    - src/renderer/src/components/sheet/PortraitSlot.tsx
    - src/renderer/src/components/sheet/SheetHeader.tsx
    - src/renderer/src/components/sheet/AbilityScoresSection.tsx
    - src/renderer/src/components/sheet/SavingThrowsSection.tsx
    - src/renderer/src/components/sheet/SkillsSection.tsx
    - src/renderer/src/components/sheet/CombatStatsSection.tsx
    - src/renderer/src/components/sheet/CurrencySection.tsx
    - src/renderer/src/components/sheet/EquipmentSection.tsx
    - src/renderer/src/components/sheet/ProficienciesSection.tsx
    - src/renderer/src/components/sheet/TraitsSection.tsx
    - src/renderer/src/components/sheet/ResourcesSection.tsx
  modified:
    - src/renderer/src/components/CharacterSheetTab.tsx
decisions:
  - "ConditionName type flows from sheetHelpers through ConditionBadge props to conditionMutation.mutate() — eliminates string cast, satisfies Zod enum constraint on tRPC layer"
  - "SpellSlotPips pip ordering: available pips are leftmost (indices 0..available-1), expended pips are rightmost — consistent with UI-SPEC §2.5"
  - "AbilityScoresSection uses local useState per-ability-cell rather than a single controlled input to prevent stale-value issues during rapid typing"
  - "TraitsSection defaults to collapsed, uses max-height CSS transition with duration-200"
  - "sheetHelpers exports ALL_CONDITIONS const array and ConditionName type (union of 14 names) so ResourcesSection and ConditionBadge share the same source of truth"
metrics:
  duration: "35 minutes"
  completed_date: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 16
  files_modified: 1
---

# Phase 02 Plan 06: Full Character Sheet UI — Summary

**One-liner:** 16 new files build the complete 10-section character sheet (5 reusable primitives + 10 sections) with zero-debounce optimistic mutations for all live-play resources (HP, spell slots, currency, conditions, death saves, inspiration, attunement) per UI-SPEC §4 and RESEARCH.md Pattern 5.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sheet primitives (Stepper, ProficiencyDot, ConditionBadge, SpellSlotPips, PortraitSlot, sheetHelpers) | 4d5320a | 6 created |
| 2 | 9 section components (SheetHeader, AbilityScoresSection, SavingThrowsSection, SkillsSection, CombatStatsSection, CurrencySection, EquipmentSection, ProficienciesSection, TraitsSection) | cda84bf | 9 created |
| 3 | ResourcesSection (HP/temp HP/inspiration/death saves/spell slots/conditions) + CharacterSheetTab wired | 65349eb | 1 created, 1 modified |

## Verification Results

- `npm run typecheck` — exits 0 (all 3 commits)
- `npm test` — 69/100 pass, 31 fail (pre-existing ABI mismatch — better-sqlite3 compiled for Electron ABI 145, system Node.js ABI 137; same failure count as prior plans, no regressions)

### Acceptance Criteria Check

- Stepper exports with value/min/max/onChange(delta)/size props — CONFIRMED
- ConditionBadge differentiates amber- (warning) vs red- (severe) active styling — CONFIRMED
- SpellSlotPips renders max pips, rightmost expended — CONFIRMED (available = left, expended = right via `i < available` index logic)
- PortraitSlot has img branch and fallback User icon branch — CONFIRMED
- sheetHelpers exports SKILLS (18 entries), XP_THRESHOLDS (20 entries), WARNING_CONDITIONS, SEVERE_CONDITIONS — CONFIRMED
- SheetHeader uses useQuery(getPortraitDataUrl), useMutation(importPortrait), useMutation(updateXp) — CONFIRMED
- SheetHeader contains `characters.updateXp` wired to Stepper — CONFIRMED
- AbilityScoresSection has editable Input calling updateAbilityScore on blur — CONFIRMED
- SkillsSection iterates SKILLS (18 rows) — CONFIRMED
- CurrencySection renders 5 columns CP/SP/EP/GP/PP each with Stepper — CONFIRMED
- EquipmentSection attunement count text contains `/ 3 Attuned` — CONFIRMED
- ProficienciesSection renders Armor/Weapons/Tools/Languages rows — CONFIRMED
- TraitsSection has collapse useState — CONFIRMED
- ResourcesSection sub-sections: Hit Points, Inspiration, Death Saves, Spell Slots, Conditions — CONFIRMED
- ResourcesSection contains cancelQueries, setQueryData, invalidateQueries — CONFIRMED (all 3 present in every mutation)
- ResourcesSection wires all 6 resource mutations — CONFIRMED
- ResourcesSection renders 14 ConditionBadge via ALL_CONDITIONS.map() — CONFIRMED
- ResourcesSection contains literal string "Not a spellcaster — spell slots are tracked here when available." — CONFIRMED
- CharacterSheetTab imports and renders all 10 sections in spec order — CONFIRMED
- CharacterSheetTab no longer contains "Character sheet TODO" — CONFIRMED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ConditionName type mismatch in conditionMutation**
- **Found during:** Task 3 typecheck
- **Issue:** `conditionMutation.mutationFn` typed as `(condition: string)` but tRPC `toggleCondition` input uses `conditionNameSchema` (Zod enum). TypeScript error TS2322 on line 175.
- **Fix:** Imported `ConditionName` type from sheetHelpers, typed mutationFn param as `ConditionName`. ConditionName union is exactly the Zod enum members, so the types align.
- **Files modified:** ResourcesSection.tsx
- **Commit:** 65349eb

## Known Stubs

None. All 10 sections render real data from CharacterWithResources. No hardcoded empty values, no placeholder text that would prevent the plan's goals. Portrait shows empty state (User icon) until a portrait is imported — this is the correct designed behavior, not a stub.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-02-15 | ResourcesSection.tsx | Optimistic mutation race condition during rapid presses — mitigated per RESEARCH.md Pattern 5: cancelQueries before setQueryData; delta-based mutations serialize at DB layer |

## Self-Check: PASSED

Files exist:
- src/renderer/src/components/sheet/sheetHelpers.ts — FOUND
- src/renderer/src/components/sheet/Stepper.tsx — FOUND
- src/renderer/src/components/sheet/ProficiencyDot.tsx — FOUND
- src/renderer/src/components/sheet/ConditionBadge.tsx — FOUND
- src/renderer/src/components/sheet/SpellSlotPips.tsx — FOUND
- src/renderer/src/components/sheet/PortraitSlot.tsx — FOUND
- src/renderer/src/components/sheet/SheetHeader.tsx — FOUND
- src/renderer/src/components/sheet/AbilityScoresSection.tsx — FOUND
- src/renderer/src/components/sheet/SavingThrowsSection.tsx — FOUND
- src/renderer/src/components/sheet/SkillsSection.tsx — FOUND
- src/renderer/src/components/sheet/CombatStatsSection.tsx — FOUND
- src/renderer/src/components/sheet/CurrencySection.tsx — FOUND
- src/renderer/src/components/sheet/EquipmentSection.tsx — FOUND
- src/renderer/src/components/sheet/ProficienciesSection.tsx — FOUND
- src/renderer/src/components/sheet/TraitsSection.tsx — FOUND
- src/renderer/src/components/sheet/ResourcesSection.tsx — FOUND
- src/renderer/src/components/CharacterSheetTab.tsx — FOUND (modified)

Commits exist:
- 4d5320a — FOUND (feat(02-06): build sheet primitives)
- cda84bf — FOUND (feat(02-06): build all 9 display/read-only sheet section components)
- 65349eb — FOUND (feat(02-06): build ResourcesSection with zero-debounce optimistic mutations)

Typecheck: exits 0
Test suite: 69/100 pass (31 fail — pre-existing ABI mismatch, same count as all prior plans)
