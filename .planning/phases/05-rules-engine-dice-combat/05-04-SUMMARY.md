---
phase: 05-rules-engine-dice-combat
plan: 04
subsystem: ui
tags: [dice, rpg-dice-roller, popover, radix, react, shadcn, story-scroll, combat]

# Dependency graph
requires:
  - phase: 05-01
    provides: "src/renderer/src/lib/dice.ts — rollExpression / isValidExpression / RollResult wrapper around rpg-dice-roller"
  - phase: 05-02
    provides: "dice_roll messages persisted as content = JSON.stringify({ label, expression, result, breakdown })"
provides:
  - "DiceRollerPopover — 7 die buttons (d4-d100) + expression input consuming the 05-01 dice wrapper (COMB-01)"
  - "ChatInputArea dice button between Textarea and Send; prepends/replaces a [die: N] roll prefix and re-focuses"
  - "StoryScrollPanel dice_roll chip rendering (COMB-03) + system event line rendering (D-32)"
  - "ui/popover.tsx shadcn primitive (@radix-ui/react-popover)"
affects: [05-05, 05-06, 05-07]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-popover@1.1.15"]
  patterns:
    - "Caller-supplied trigger via children + PopoverTrigger asChild"
    - "Nested asChild composition (PopoverTrigger + TooltipTrigger onto one Button)"
    - "Defensive JSON.parse in render loop (try/catch → return null on malformed row)"

key-files:
  created:
    - src/renderer/src/components/DiceRollerPopover.tsx
    - src/renderer/src/components/ui/popover.tsx
  modified:
    - src/renderer/src/components/ChatInputArea.tsx
    - src/renderer/src/components/StoryScrollPanel.tsx

key-decisions:
  - "Installed @radix-ui/react-popover directly (first-party shadcn block dep) instead of the interactive shadcn CLI, then authored ui/popover.tsx by hand following the established tooltip primitive — avoids an interactive/network CLI step and keeps the relative import style consistent with input.tsx"
  - "Used --legacy-peer-deps for the install to match the project's existing resolution (pre-existing tRPC v10 ↔ react-query v5 peer conflict)"
  - "Composed PopoverTrigger and TooltipTrigger onto the same dice Button via nested asChild so both behaviors attach to one DOM node"

patterns-established:
  - "Pattern 1: Popover trigger supplied by the caller as children + PopoverTrigger asChild (DiceRollerPopover)"
  - "Pattern 2: Defensive JSON.parse inside the messages.map render loop — malformed rows return null and never crash the panel (T-05-04-01)"

requirements-completed: [COMB-01, COMB-03]

# Metrics
duration: 7min
completed: 2026-05-29
---

# Phase 5 Plan 04: Dice Slice (Roller + Story Chips) Summary

**In-app dice roller popover (7 quick dice + free-form expression) wired into the chat input, plus StoryScrollPanel rendering branches for AI dice_roll chips and level-up system events.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-29T13:49:09Z
- **Completed:** 2026-05-29T13:56:03Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified) + package.json/package-lock.json

## Accomplishments
- `DiceRollerPopover` renders the 7 die buttons (d4/d6/d8/d10/d12/d20/d100) and an expression input, consuming the 05-01 `dice.ts` wrapper; die click or valid expression calls `onRoll` with a `[die: N] ` prefix and closes (COMB-01, D-19).
- Invalid expressions disable the Roll button and surface an inline "Invalid expression" error (UI-SPEC §S3).
- `ChatInputArea` gains a `Dice6` trigger button between the Textarea and Send, with a "Roll dice" tooltip; `handleRoll` prepends the prefix (stripping any prior roll prefix), refreshes textarea height/empty-state, and re-focuses. The button is disabled when `disabled || isStreaming`.
- `StoryScrollPanel` now renders `dice_roll` messages as amber chips (label/expression/result/breakdown) and `system` messages as italic amber event lines (COMB-03, D-32 / UI-SPEC §S4 + §S7b), unblocking 05-06's level-up system message without a later edit.
- Added the official shadcn `popover` primitive (`@radix-ui/react-popover`).

## Task Commits

Each task was committed atomically:

1. **Task 1: DiceRollerPopover component (+ popover primitive)** - `899a38a` (feat)
2. **Task 2: ChatInputArea dice button + popover + prefix prepend** - `ea398ef` (feat)
3. **Task 3: StoryScrollPanel dice_roll chip + system event rendering** - `a588436` (feat)

## Files Created/Modified
- `src/renderer/src/components/ui/popover.tsx` - shadcn Popover primitive (Radix popover, tooltip-pattern styling)
- `src/renderer/src/components/DiceRollerPopover.tsx` - Dice roller popover: 7 die buttons + expression input + Roll, consuming `lib/dice.ts`
- `src/renderer/src/components/ChatInputArea.tsx` - Dice trigger button + DiceRollerPopover integration + `handleRoll` prefix prepend/replace
- `src/renderer/src/components/StoryScrollPanel.tsx` - `dice_roll` chip branch (defensive JSON.parse) + `system` event line branch + `formatBreakdown` helper

## Decisions Made
- **Popover sourcing:** Installed `@radix-ui/react-popover` directly and hand-authored `ui/popover.tsx` from the existing tooltip primitive rather than invoking the interactive shadcn CLI. The package is the first-party dependency of the official shadcn `popover` block (declared in UI-SPEC Registry Safety + plan interfaces), not a substitute — so this satisfies the registry-safety constraint while avoiding an interactive/network CLI step and import-alias drift.
- **Install flag:** Used `--legacy-peer-deps` (the project already carries a pre-existing tRPC-v10 ↔ react-query-v5 peer conflict; a default install errors out for unrelated reasons).
- **Trigger composition:** `PopoverTrigger asChild` (inside DiceRollerPopover) wraps `TooltipTrigger asChild` wraps the `Button`, so both the popover and the "Roll dice" tooltip attach to one DOM node — the canonical Radix nested-asChild pattern. `CampaignViewScreen` already provides the `TooltipProvider` ancestor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @radix-ui/react-popover (popover primitive missing)**
- **Found during:** Task 1 (DiceRollerPopover component)
- **Issue:** `src/renderer/src/components/ui/popover.tsx` did not exist and `@radix-ui/react-popover` was not installed; DiceRollerPopover cannot render without it. The plan interfaces explicitly call for the official shadcn `popover` block ("Install if missing").
- **Fix:** Installed `@radix-ui/react-popover@^1.1.15` (first-party Radix scope, declared in UI-SPEC Registry Safety — NOT a hallucinated/substitute package, so the Rule 3 package-install exclusion's slopsquat concern does not apply) and hand-authored `ui/popover.tsx` matching the existing tooltip primitive. Used `--legacy-peer-deps` to work around the pre-existing tRPC/react-query peer conflict.
- **Files modified:** package.json, package-lock.json, src/renderer/src/components/ui/popover.tsx
- **Verification:** `node -e` confirmed `@radix-ui/react-popover@1.1.15` resolved; `npm run typecheck` clean for the new files.
- **Committed in:** `899a38a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency/primitive)
**Impact on plan:** The popover install was anticipated by the plan ("Install if missing"); no scope creep. All three tasks implemented exactly as specified.

## Issues Encountered
- **Pre-existing typecheck error (out of scope):** `src/renderer/src/components/ui/scroll-area.tsx(4,20): Cannot find module '@/lib/utils'`. Confirmed pre-existing (last touched in phase-04 commit `8b0a1e5`, not by this plan) and already logged in `deferred-items.md` from 05-01. Not fixed here per the SCOPE BOUNDARY rule. All four of this plan's files typecheck clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- COMB-01 (player dice) and COMB-03 (AI visible dice) are satisfied. The `system` message branch is in place, so 05-06's level-up system event has a render target without further StoryScrollPanel edits.
- Manual validation outstanding (per VALIDATION.md): open the dice popover and confirm prefix injection / invalid-expression gating; AI `showDiceRoll` chip rendering verified live with an LLM.
- Note for a future build/tsconfig plan: add the `@/*` path alias (mapping `./src/renderer/src/*`) to clear the pre-existing `scroll-area.tsx` resolution error.

## Self-Check: PASSED
- Files: all 4 found (DiceRollerPopover.tsx, ui/popover.tsx, ChatInputArea.tsx, StoryScrollPanel.tsx)
- Commits: all 3 found (899a38a, ea398ef, a588436)

---
*Phase: 05-rules-engine-dice-combat*
*Completed: 2026-05-29*
