---
phase: 07-content-depth-advanced-character
plan: "04"
subsystem: ability-score-wizard
tags: [character-creation, point-buy, negative-traits, dice-mechanics, ui]
dependency_graph:
  requires: ["07-01"]
  provides: ["CHAR-02", "CHAR-03"]
  affects:
    - src/renderer/src/components/wizard/StepAbilityScores.tsx
    - src/renderer/src/components/wizard/wizardTypes.ts
    - src/renderer/src/lib/pointBuy.ts
tech_stack:
  added:
    - "@radix-ui/react-radio-group ^1.3.8"
    - "@radix-ui/react-separator ^1.1.8"
  patterns:
    - "shadcn copy-in component model for radio-group and separator"
    - "renderer-side pure function mirror of main-process calculations"
    - "per-stat reroll with conditional unmount (D-06)"
    - "live budget counter with destructive/gold/muted color states"
key_files:
  created:
    - src/renderer/src/components/ui/radio-group.tsx
    - src/renderer/src/components/ui/separator.tsx
    - src/renderer/src/lib/pointBuy.ts
  modified:
    - src/renderer/src/components/wizard/StepAbilityScores.tsx
    - src/renderer/src/components/wizard/wizardTypes.ts
decisions:
  - "POINT_BUY_COST and PRESET_FLAWS duplicated in renderer (pointBuy.ts) — renderer cannot import main-process code directly"
  - "Free-form flaw fields length-capped at 280 chars and newlines stripped at wizard level (threat T-07-04-01 partial mitigation; contextBuilder handles further sanitization)"
  - "Method-switch confirmation banner shown inline above tabs (no modal) to minimize disruption"
  - "Per-stat reroll button conditionally renders to null once used — fully unmounted per D-06"
  - "Point Buy default initializes all scores to 8 (zero spend, user builds up)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-31T18:46:09Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 7 Plan 04: Ability Score Method Selector UI Summary

**One-liner:** Four-method ability score wizard with 27pt point buy + 10 preset flaw budget bonuses + per-stat 4d6 reroll that unmounts on use.

## What Was Built

Extended the character creation wizard's ability score step (Step 3) with a full four-method selector:

**Standard Array** — existing dropdown assignment behavior, unchanged.

**4d6 Roll** — existing roll-all button; now each stat gets a per-stat reroll button after initial roll. Clicking rerolls 4d6 drop lowest, keeps `Math.max(old, new)`, applies a 600ms green flash (`bg-green-950/40 text-green-400`), then the button is fully unmounted (conditionally renders to `null`) per D-06 decision. A muted "checkmark used" text indicator occupies the slot.

**Point Buy** — stepper UI (8–15 range per RAW SRD), live `X / Y pts` budget bar that turns muted when under budget, `text-accent-gold` when exactly spent, `text-destructive` when over. Below a Separator, a Negative Traits panel with 10 preset flaws (checkboxes, each showing name + penalty + badge `+N pts`) and 2 free-form Textarea fields (each `+2 pts` when non-empty). `isStep2Valid` blocks wizard advance when over budget.

**Manual** — per-stat number inputs (1–30), unchanged behavior from prior implementation.

**Shared:** Skill proficiency picker appears in all four tabs. Method-switch confirmation banner clears scores on confirm. `negativeTraits` (presetFlaws + freeFormFlaws) persisted into WizardState via `onChange`.

## New Files

- `src/renderer/src/lib/pointBuy.ts` — `POINT_BUY_COST`, `BASE_POINT_BUY_BUDGET`, `PRESET_FLAWS` (10 entries), `calcPointBuyCost`, `calcPointBuyBudget`, `NegativeTraits` interface
- `src/renderer/src/components/ui/radio-group.tsx` — shadcn RadioGroup + RadioGroupItem
- `src/renderer/src/components/ui/separator.tsx` — shadcn Separator

## Modified Files

- `src/renderer/src/components/wizard/wizardTypes.ts` — added `AbilityScoreMethod` type, `abilityScoreMethod` and `negativeTraits` fields to `WizardState`, `initialWizardState` defaults
- `src/renderer/src/components/wizard/StepAbilityScores.tsx` — full rewrite with all four method tabs

## Commits

| Hash | Description |
|------|-------------|
| `9941d9c` | feat(07-04): install shadcn radio-group + separator; create pointBuy helper |
| `04f98d7` | feat(07-04): 4-method ability score selector, Point Buy + Negative Traits, per-stat reroll |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Checkpoint Status

The `checkpoint:human-verify` task (Task 3) was auto-approved per `auto_advance=true` configuration. The visual verification steps (method tabs, budget counter reactivity, flaw budget additions, per-stat reroll disappear behavior) can be confirmed at next dev run.

## Known Stubs

None — all data flows are wired. Point buy scores default to 8 (not null) when switching to Point Buy mode so the budget counter starts at 0/27 rather than showing "—". Free-form flaw fields start empty.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-injection | src/renderer/src/components/wizard/StepAbilityScores.tsx | Free-form flaw text newline-stripped and length-capped at wizard level (280 chars). Full injection sanitization at contextBuilder (07-03) per threat T-07-04-01. |

## Self-Check: PASSED

- `src/renderer/src/components/ui/radio-group.tsx` — FOUND
- `src/renderer/src/components/ui/separator.tsx` — FOUND
- `src/renderer/src/lib/pointBuy.ts` — FOUND
- `src/renderer/src/components/wizard/StepAbilityScores.tsx` — FOUND (modified)
- `src/renderer/src/components/wizard/wizardTypes.ts` — FOUND (modified)
- Commit `9941d9c` — FOUND
- Commit `04f98d7` — FOUND
- tsc --noEmit: clean (0 errors)
