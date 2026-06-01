---
phase: 07-content-depth-advanced-character
plan: "06"
subsystem: character-creation-wizard
tags: [character-creation, feats, negative-traits, party-mode, ui]
dependency_graph:
  requires: ["07-01", "07-03", "07-04", "07-05"]
  provides: ["CHAR-05 (creation-side)", "PARTY-01 (re-trigger)"]
  affects:
    - src/renderer/src/components/CreateCharacterWizard.tsx
    - src/renderer/src/components/wizard/wizardTypes.ts
    - src/renderer/src/components/wizard/StepStartingFeat.tsx
    - src/main/db/charactersRepo.ts
    - src/main/trpc/routers/characters.ts
tech_stack:
  added: []
  patterns:
    - "Optional wizard step pattern: step is always valid (skippable), FeatPicker embedded"
    - "Post-create side-effect: trpc.feats.add called after successful character create"
    - "onComplete prop pattern for re-triggerable wizard (no navigation assumption)"
    - "negativeTraits persisted as JSON via extended create input"
key_files:
  created:
    - src/renderer/src/components/wizard/StepStartingFeat.tsx
  modified:
    - src/renderer/src/components/CreateCharacterWizard.tsx
    - src/renderer/src/components/wizard/wizardTypes.ts
    - src/main/db/charactersRepo.ts
    - src/main/trpc/routers/characters.ts
decisions:
  - "Starting Feat step is a dedicated step 5 (before Review at step 6) rather than a review section — least disruption to existing wizard model"
  - "Step is always valid (isCurrentStepValid returns true for step 5) so Next/Skip are equivalent — Skip button added as explicit affordance"
  - "negativeTraits only included in create payload when any traits are non-empty (point buy only) — null for standard array / 4d6 / manual characters"
  - "feats.add error is caught but non-blocking — character creation succeeded; feat failure is logged"
  - "Party-full TRPCError surfaced from router catch block; wizard shows 'This campaign's party is full.' inline"
  - "onComplete prop (optional) replaces navigate('/campaign/...') for re-triggered party member creation"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-01T00:01:05Z"
  tasks_completed: 1
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 7 Plan 06: Character Wizard Starting Feat + Negative Traits + Re-trigger Summary

**One-liner:** CreateCharacterWizard extended to 7 steps with an optional FeatPicker-based Starting Feat step, negativeTraits persistence via create mutation, and onComplete prop for re-triggerable party-member creation.

## What Was Built

### Step 5: Starting Feat (new, optional)

New `StepStartingFeat.tsx` component:
- Mounts `<FeatPicker campaignId selectedFeatName onSelect />` (reused from 07-05)
- Stores `FeatSelection | null` as `wizardState.startingFeat`
- Shows a selected-feat banner when a feat is chosen (feat name + source label + "Remove" button)
- Explicit "No starting feat — skip this step" button (`onSkip` prop) in addition to the standard Next button
- Step is always valid (`isCurrentStepValid` returns `true` for step 5) — player can advance with or without choosing a feat

### wizardTypes.ts extensions

- `TOTAL_STEPS`: 6 → 7
- `STEP_NAMES`: added `'Starting Feat'` before `'Review'`
- `WizardState`: added `startingFeat: FeatSelection | null`
- `initialWizardState`: `startingFeat: null`

### CreateCharacterWizard.tsx extensions

**Starting feat post-create call:**
After `createMutation.onSuccess`, if `wizardState.startingFeat` is set, calls `trpc.feats.add.mutate({ characterId, featName, featSource, customFeatId })`. On failure, logs the error but does not block — character creation succeeded. The characters list and feats list queries are both invalidated on success.

**negativeTraits persistence:**
The create mutation payload includes `negativeTraits` when any point-buy flaws were chosen (presetFlaws non-empty OR any freeFormFlaw has content). Null for standard array / 4d6 / manual characters.

**onComplete prop for re-trigger (PARTY-01):**
Optional `onComplete?: () => void` prop. When provided, the wizard calls `onComplete()` instead of `navigate('/campaign/...')` after successful creation (and also on cancel). Callers in 07-08 (`CharacterSheetTab`) will pass `onComplete` to refresh the party switcher without navigation.

**Party-full error:**
`onError` checks for `'Party is full'` or `'partySize'` in the error message and surfaces `"This campaign's party is full."` as an inline error below the step body.

### characters tRPC router extensions

- `create` Zod schema: added optional `negativeTraits` object `{ presetFlaws: string[].max(12), freeFormFlaws: string[].max(2) }` (bounded)
- Catch block: party-full error now throws `TRPCError({ code: 'CONFLICT', message: "This campaign's party is full." })` before the SQLite UNIQUE constraint check

### charactersRepo extensions

- `CreateCharacterInput`: added `negativeTraits?: { presetFlaws: string[]; freeFormFlaws: string[] } | null`
- `createWithResources`: JSON-serializes and persists `negativeTraits` to the `characters.negative_traits` column (already added in 07-01 migration)

## Commits

| Hash | Description |
|------|-------------|
| `dfa8055` | feat(07-06): add Starting Feat step + persist negativeTraits + re-triggerable wizard |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Design Notes

**handleSkipFeat vs handleNext:** Both advance the step. `handleSkipFeat` is called from the "Skip" button inside `StepStartingFeat`; `handleNext` is called from the footer Next button. Both call `setCompletedUpTo` and advance `step`. The `onSkip` prop is passed from the wizard to the step component so the skip button has identical semantics.

### Checkpoint Status

The `checkpoint:human-verify` task (Task 2) was auto-approved per `auto_advance=true` configuration. The visual verification steps (Starting Feat step appears in wizard, FeatPicker renders, skip path works, feat saved after character creation) can be confirmed at next dev run.

## Known Stubs

None — all data flows are wired:
- Starting feat: selected via FeatPicker, stored in WizardState, persisted via `feats.add` after character creation
- negativeTraits: saved from point-buy step, persisted to `characters.negative_traits` column
- onComplete: prop accepted and called on finish/cancel; 07-08 will wire the `+ Add Character` button with this prop

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. Negative traits are Zod-bounded at the tRPC boundary (presetFlaws ≤ 100 chars each, max 12; freeFormFlaws ≤ 280 chars each, max 2). Starting feat name bounded to 200 chars by `feats.add` Zod schema (07-03). Both mitigate T-07-06-01.

## Self-Check: PASSED

- `src/renderer/src/components/wizard/StepStartingFeat.tsx` — FOUND
- `src/renderer/src/components/CreateCharacterWizard.tsx` — FOUND (contains `FeatPicker`, `startingFeat`, `negativeTraits`, `onComplete`, party-full error)
- `src/renderer/src/components/wizard/wizardTypes.ts` — FOUND (TOTAL_STEPS=7, startingFeat field)
- `src/main/db/charactersRepo.ts` — FOUND (negativeTraits in CreateCharacterInput and insert values)
- `src/main/trpc/routers/characters.ts` — FOUND (negativeTraits Zod schema, party-full TRPCError)
- Commit `dfa8055` — FOUND
- tsc --noEmit: clean (exit 0)
