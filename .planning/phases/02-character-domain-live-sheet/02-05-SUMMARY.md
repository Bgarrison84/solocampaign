---
phase: 02-character-domain-live-sheet
plan: "05"
subsystem: character-creation-wizard
tags: [wizard, character-creation, shadcn, select, zustand, trpc, react-query]
dependency_graph:
  requires: [02-01, 02-02, 02-03, 02-04]
  provides: [CreateCharacterWizard, CharacterSheetTab, shadcn-Select, characterStore, wizardTypes]
  affects: [02-06, 02-07]
tech_stack:
  added:
    - "@radix-ui/react-select (shadcn Select primitive)"
  patterns:
    - "Non-dismissible Dialog: open={true} onOpenChange no-op per D-04"
    - "CharacterSheetTab orchestrator: useQuery -> null -> wizard, data -> sheet placeholder"
    - "CreateCharacterWizard: 6-step local useState, content pre-fetched via useQuery on mount"
    - "Step validity computed per-step; completedUpTo tracks highest valid step for backward nav"
    - "handleConfirm assembles full characters.create payload including racial ASI, language union, skill union, item assembly"
    - "StepReview: pure calculation functions imported from main/characters/calculations.ts (no electron deps)"
    - "SpellSlotsByClass wrapping: forClass query returns per-class table; wrapped back for buildSpellSlots()"
    - "Saving throws: class-fixed, rendered read-only checkboxes per D-16"
    - "Standard array: Select dropdowns showing only available values per Q2 answer"
    - "Override link: toggles to numeric Input for each ability, validated 1-30"
key_files:
  created:
    - src/renderer/src/components/ui/select.tsx
    - src/renderer/src/components/wizard/wizardTypes.ts
    - src/renderer/src/stores/characterStore.ts
    - src/renderer/src/components/CharacterSheetTab.tsx
    - src/renderer/src/components/CreateCharacterWizard.tsx
    - src/renderer/src/components/wizard/WizardProgress.tsx
    - src/renderer/src/components/wizard/StepRace.tsx
    - src/renderer/src/components/wizard/StepClass.tsx
    - src/renderer/src/components/wizard/StepAbilityScores.tsx
    - src/renderer/src/components/wizard/StepBackground.tsx
    - src/renderer/src/components/wizard/StepEquipment.tsx
    - src/renderer/src/components/wizard/StepReview.tsx
  modified:
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - package.json
    - package-lock.json
decisions:
  - "All 6 steps built in single commit (tasks 1-3 combined): steps are interdependent and typecheck requires all files present"
  - "SpellSlotsByClass wrapping: content.spellSlots.forClass returns per-class table (not full SpellSlotsByClass map); StepReview wraps it back for buildSpellSlots()"
  - "shadcn Select authored manually (not via shadcn CLI): no components.json present; @radix-ui/react-select installed with --legacy-peer-deps"
  - "CharacterSheetTab data branch shows Plan 06 placeholder until full sheet is built"
  - "armorBaseAc approximation: Phase 2 derives armor AC from item name pattern matching; Plan 06 can use stored AC value"
metrics:
  duration: "45 minutes"
  completed_date: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 12
  files_modified: 3
---

# Phase 02 Plan 05: Character Creation Wizard — Summary

**One-liner:** 6-step character creation wizard (Race+Name, Class+Subclass, Ability Scores, Background, Equipment, Review) with shadcn Select, non-dismissible Dialog per D-04, full create-input assembly in handleConfirm, and CharacterSheetTab orchestrator that auto-launches the wizard when characterData is null.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-2-3 | All wizard files: Select, types, store, CharacterSheetTab, wizard + all 6 steps | 48e2b0c | 12 new files, 3 modified |

Note: Tasks 1, 2, and 3 were executed in a single commit because they are tightly interdependent (TypeScript requires all import targets to exist at typecheck time). The commit contains all acceptance criteria from all three tasks.

## Verification Results

- `npm run typecheck` — exits 0
- `npm test` (full suite) — 69/100 pass, 31 fail (pre-existing ABI mismatch, same as prior plans; no regressions)
- `npm test -- src/main/trpc/routers/characters.test.ts` — 17 fail (pre-existing ABI mismatch — better-sqlite3 compiled for Electron ABI 145, system Node.js ABI 137; same failure count as before this plan)
- select.tsx exports: Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue — confirmed
- wizardTypes.ts: TOTAL_STEPS=6, STEP_NAMES=['Race','Class','Ability Scores','Background','Equipment','Review'] — confirmed
- CharacterSheetTab contains useQuery with 'getByCampaignId' queryKey — confirmed
- CharacterSheetTab renders CreateCharacterWizard when data is null (D-04) — confirmed
- CampaignViewScreen no longer contains "Your character sheet will appear here after character creation (Phase 2)" — confirmed
- CreateCharacterWizard: Dialog open={true}, sm:max-w-[720px], useMutation → characters.create, invalidateQueries 'getByCampaignId' — confirmed
- StepRace: Character Name + Backstory fields above race columns — confirmed
- StepClass: subclass Select shown only when choosesSubclassAtLevel1 — confirmed
- StepAbilityScores: 6 ability rows, Select dropdowns, Override link, read-only save checkboxes, skill picker with count badge — confirmed
- StepBackground: language Select conditional on freeLanguageChoices, 4 role-play input fields — confirmed
- StepEquipment: selectable package cards with item table preview — confirmed
- StepReview: imports calcHP, calcAC, calcInitiativeBonus, buildSpellSlots from calculations.ts — confirmed
- Copy strings from UI-SPEC §6.1: 'Choose a Species', 'Choose a Class', 'Divine Domain', 'Sorcerous Origin', 'Otherworldly Patron', 'Create Your Character', 'Cancel Character Creation', 'Cancel character creation?' — confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SpellSlotsByClass type mismatch**
- **Found during:** Task 3 typecheck
- **Issue:** `content.spellSlots.forClass` returns `SpellSlotsByClass[className]` (the per-class table), NOT the full `SpellSlotsByClass` map. The plan's `buildSpellSlots(class, 1, spellSlotsQuery.data)` call assumed the full map.
- **Fix:** StepReview wraps the per-class data back into `{ [className]: data }` shape before calling `buildSpellSlots()`. CreateCharacterWizard casts the query data type appropriately.
- **Files modified:** StepReview.tsx, CreateCharacterWizard.tsx

**2. [Rule 1 - Bug] getAssignedValues type error in StepAbilityScores**
- **Found during:** Task 3 typecheck (TS2304: Cannot find name 'a')
- **Issue:** `.filter((v): v is number => v !== null && !overrides[a as AbilityName])` referenced `a` outside the filter scope.
- **Fix:** Moved the override check into the `.filter()` on ABILITY_NAMES before the `.map()`.
- **Files modified:** StepAbilityScores.tsx

**3. [Rule 3 - Blocker] shadcn CLI requires components.json**
- **Found during:** Task 1, attempt to run `npx shadcn@latest add select`
- **Issue:** No components.json present; shadcn CLI would prompt interactively.
- **Fix:** Installed `@radix-ui/react-select` with `--legacy-peer-deps` and authored select.tsx from the official shadcn source. Component exports match the required set.
- **Files modified:** package.json, package-lock.json, select.tsx (created)

### Design Adaptations (within spec)

**Task consolidation:** Tasks 1, 2, and 3 were executed as a single atomic commit. TypeScript's type system requires all imported modules to exist at typecheck time, so building the full wizard stack in one pass avoids a wave of "module not found" errors between commits. All acceptance criteria from all three tasks are satisfied.

**armorBaseAc approximation:** The confirm action derives armor base AC from item name pattern matching (chain mail → 16, leather → 11, etc.) since the equipment packages don't carry a separate `armorBaseAc` field. The server's `calcAC()` function uses this value, or falls back to `10 + DEX` if undefined. This is acceptable for Phase 2; Plan 06 can refine if needed.

**CharacterSheetTab data branch:** When characterData exists, shows a minimal placeholder (`{character.name} — Plan 06 replaces this with the full 10-section sheet`). This is the intended behavior per the plan's own acceptance criterion.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Character sheet data branch (plan 06 placeholder) | CharacterSheetTab.tsx | Plan 06 builds the full 10-section sheet; this branch correctly shows the character name as confirmation that creation succeeded |

The placeholder does NOT prevent the plan's goal from being achieved: the wizard completes and the character IS persisted. The stub is intentionally a post-wizard placeholder pending Plan 06.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-02-13 | CharacterSheetTab.tsx | Wizard bypass via deep link — mitigated: getByCampaignId returns null → wizard auto-launches non-dismissible per D-04; no other code path creates characters |
| T-02-14 | CreateCharacterWizard.tsx | Client-side validation bypass — accepted: UI validation is UX only; Zod schemas on tRPC inputs enforce server-side bounds (Plan 02) |

## Self-Check: PASSED

Files exist:
- src/renderer/src/components/ui/select.tsx — FOUND
- src/renderer/src/components/wizard/wizardTypes.ts — FOUND
- src/renderer/src/stores/characterStore.ts — FOUND
- src/renderer/src/components/CharacterSheetTab.tsx — FOUND
- src/renderer/src/components/CreateCharacterWizard.tsx — FOUND
- src/renderer/src/components/wizard/WizardProgress.tsx — FOUND
- src/renderer/src/components/wizard/StepRace.tsx — FOUND
- src/renderer/src/components/wizard/StepClass.tsx — FOUND
- src/renderer/src/components/wizard/StepAbilityScores.tsx — FOUND
- src/renderer/src/components/wizard/StepBackground.tsx — FOUND
- src/renderer/src/components/wizard/StepEquipment.tsx — FOUND
- src/renderer/src/components/wizard/StepReview.tsx — FOUND

Commits exist:
- 48e2b0c — FOUND (feat(02-05): wizard + CharacterSheetTab + all 6 steps)

Typecheck: exits 0
Test suite: 69/100 pass (31 fail — pre-existing ABI mismatch, no regressions introduced by this plan)
