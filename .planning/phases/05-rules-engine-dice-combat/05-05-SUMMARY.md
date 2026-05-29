---
phase: 05-rules-engine-dice-combat
plan: 05
subsystem: ui, database, trpc
tags: [spells, trpc, react, shadcn, collapsible, dialog, optimistic-update, concentration, tanstack-query]

# Dependency graph
requires:
  - phase: 05-01
    provides: "character_spells table + characterSpellsRepo + resources/spells.json + concentratingOn column"
  - phase: 05-02
    provides: "deductSpellSlot/restoreSpellSlots tools; concentratingOn in character summary"
  - phase: 05-03
    provides: "router.ts registration pattern (combat router already present)"
  - phase: 05-04
    provides: "ChatInputArea handleRoll prefix-prepend pattern; window event mechanism"
provides:
  - "spells tRPC router (listAllSpells, listByCharacter, seedFromJson, castSpell, undoCast, updateConcentration)"
  - "SpellListSection: grouped spell list, expandable cards, cantrip/leveled cast, optimistic deduction, concentration warning"
  - "CharacterSheetTab: SpellListSection mounted after ResourcesSection"
  - "ChatInputArea: campaign:chat-prefix window listener for cast prefix delivery"
affects: [05-06-levelup-rest, 05-07-toast-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level getSpells() cache mirrors contentLoader.ts singleton pattern"
    - "setConcentration helper augments charactersRepo for concentratingOn writes"
    - "campaign:chat-prefix CustomEvent shared between SpellListSection and ChatInputArea"
    - "Optimistic castSpell mutation triple (onMutate/onError/onSettled) mirrors ResourcesSection spellSlotMutation"

key-files:
  created:
    - src/main/trpc/routers/spells.ts
    - src/renderer/src/components/sheet/SpellListSection.tsx
  modified:
    - src/main/trpc/router.ts
    - src/renderer/src/components/CharacterSheetTab.tsx
    - src/renderer/src/components/ChatInputArea.tsx

key-decisions:
  - "setConcentration implemented inline in spells.ts (not added to charactersRepo) — concentratingOn write is specific to spell casting, keeping repo boundary clean"
  - "SpellListSection dispatches window CustomEvent('campaign:chat-prefix') as fallback when onCastPrefix prop is absent — decouples SpellListSection from CharacterSheetTab's prop chain"
  - "campaign:chat-prefix listener placed after handleRoll declaration in ChatInputArea to satisfy TypeScript block-scoped variable rules (auto-fix Rule 1)"
  - "seededRef used to prevent double-seed on re-renders — guards seedMutation.mutate() so seed fires exactly once per mount"

patterns-established:
  - "Spell prefix events use window CustomEvent('campaign:chat-prefix') — same pattern as dice prefix"
  - "Collapsible with chevron toggle uses group-data-[state=closed] to swap icons"

requirements-completed: [CHAR-08]

# Metrics
duration: 4min
completed: 2026-05-29
---

# Phase 5 Plan 05: Spell List Section (CHAR-08) Summary

**Full spellcasting UI: spells tRPC router with 6 procedures, SpellListSection with grouped levels, expandable spell cards from spells.json, optimistic slot deduction, upcast picker, and concentration warning dialog — cast prefix wired to chat input via shared CustomEvent.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-29T14:05:09Z
- **Completed:** 2026-05-29T14:10:04Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Built `spells.ts` tRPC router with `listAllSpells`, `listByCharacter`, `seedFromJson`, `castSpell`, `undoCast`, `updateConcentration` — registered in `router.ts` alphabetically (after sessions, before window)
- `spells.json` loaded via `getResourcesPath()` mirroring `contentLoader.ts` — no hardcoded paths, packaged-ASAR safe
- `SpellListSection` (513 lines) renders grouped spell list for spellcasters only; expandable cards show full SRD metadata; cast flow with optimistic deduction; upcast picker shows only available slots; concentration warning dialog
- `ConcentrationWarningDialog` inline: "Drop Concentration?" with exact copywriting from plan
- `CharacterSheetTab` mounts `SpellListSection` between `ResourcesSection` and `CurrencySection`
- `ChatInputArea` gains a `window 'campaign:chat-prefix'` listener that reuses `handleRoll` for prefix delivery

## Task Commits

Each task was committed atomically:

1. **Task 1: spells tRPC router + register** - `5baa314` (feat)
2. **Task 2: SpellListSection + ConcentrationWarningDialog** - `ffdc356` (feat)
3. **Task 3: CharacterSheetTab mount + ChatInputArea prefix listener** - `b08ba2e` (feat)

_Plan metadata commit (this SUMMARY) follows separately._

## Files Created/Modified
- `src/main/trpc/routers/spells.ts` — spells tRPC router (211 lines)
- `src/main/trpc/router.ts` — registered spells: spellsRouter
- `src/renderer/src/components/sheet/SpellListSection.tsx` — full spell list UI (513 lines)
- `src/renderer/src/components/CharacterSheetTab.tsx` — SpellListSection mounted after ResourcesSection
- `src/renderer/src/components/ChatInputArea.tsx` — campaign:chat-prefix listener added

## Decisions Made
- `setConcentration` written inline in `spells.ts` rather than added to `charactersRepo` — the write is specific to spell casting and does not need to be part of the general characters repo surface.
- `campaign:chat-prefix` CustomEvent is the shared channel for both dice roller prefixes (05-04) and spell cast prefixes (05-05). `ChatInputArea.handleRoll` is the single sink — no logic duplication.
- `seededRef` (a `useRef`) guards the one-time seed call instead of a query `enabled` flag, because the effect is positional (first render with empty list) rather than dependent on a query state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript block-scoped variable used before declaration**
- **Found during:** Task 3 (typecheck verification after adding campaign:chat-prefix listener)
- **Issue:** The `useEffect` for the cast prefix listener was initially placed before `handleRoll` was declared with `useCallback`. TypeScript rejected it with TS2448 (block-scoped variable used before declaration).
- **Fix:** Moved the `useEffect` to after the `handleRoll` declaration (after `handleInput`), before `sendDisabled`.
- **Files modified:** `src/renderer/src/components/ChatInputArea.tsx`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `b08ba2e`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — variable ordering). No architectural changes, no scope creep.

## Known Stubs
None — spell metadata lookup falls back gracefully ("Spell metadata not available." message) when a spell name from `character_spells` has no matching entry in `spells.json`, which is an edge case only, not a stub blocking the plan's goal.

## Threat Flags

No new security surface introduced beyond what the plan's threat model already covers (T-05-05-01 through T-05-05-SC).

## User Setup Required
None.

## Next Phase Readiness
- CHAR-08 is satisfied: spells tRPC router registered, SpellListSection renders in Character Sheet, cast prefix reaches the chat input.
- 05-06 (Level-Up + Rest) can build on the existing `concentratingOn` and `hitDiceCurrent`/`hitDiceTotal` columns without further schema changes.
- The `campaign:chat-prefix` window event pattern is now established for any future wave that needs to prepend content to the chat input from a non-chat component.

---
*Phase: 05-rules-engine-dice-combat*
*Completed: 2026-05-29*

## Self-Check: PASSED

- `src/main/trpc/routers/spells.ts` — FOUND
- `src/renderer/src/components/sheet/SpellListSection.tsx` — FOUND
- `src/main/trpc/router.ts` contains `spells: spellsRouter` — FOUND
- `src/renderer/src/components/CharacterSheetTab.tsx` contains `SpellListSection` — FOUND
- `src/renderer/src/components/ChatInputArea.tsx` contains `campaign:chat-prefix` — FOUND
- Commits: 5baa314, ffdc356, b08ba2e — all in git log
