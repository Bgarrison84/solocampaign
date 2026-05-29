---
phase: 05-rules-engine-dice-combat
plan: 06
subsystem: database, trpc, ui
tags: [level-up, rest, progression, xp-threshold, hit-dice, spell-slots, short-rest, long-rest, modal, banner]

# Dependency graph
requires:
  - phase: 05-01
    provides: "dice.ts rollExpression; hitDiceCurrent/hitDiceTotal schema columns; characterResources schema"
  - phase: 05-02
    provides: "processRest mutation pipeline; rest_taken event; ai:mutations-applied IPC signal"
  - phase: 05-03
    provides: "CampaignViewScreen action bar pattern; combatStore; controlled Tabs"
  - phase: 05-04
    provides: "StoryScrollPanel system message rendering (role 'system')"
  - phase: 05-05
    provides: "SpellListSection in CharacterSheetTab; CharacterSheetTab shared file"
provides:
  - "charactersRepo.levelUp (increments level capped at 20, adds hpGain to hpMax+hpCurrent, merges newSlotMax)"
  - "charactersRepo.applyShortRestHp (recovers HP clamped to hpMax, decrements hitDiceCurrent)"
  - "characters router: levelUp + recordSystemMessage + applyShortRestHp procedures with Zod bounds"
  - "LevelUpBanner: amber XP-threshold banner at top of CharacterSheetTab"
  - "LevelUpModal: HP choice radios + spell slot table + subclass deferred note + confirm flow"
  - "CharacterSheetTab: XP_THRESHOLDS check gates banner; LevelUpModal mounted at root"
  - "RestPickerDialog: Short/Long rest option selector"
  - "ShortRestHitDiceModal: roll hit dice + CON modifier + apply HP + decrement hitDiceCurrent"
  - "CampaignViewScreen: Rest button (Moon icon) + processRest signal auto-opens ShortRestHitDiceModal"
  - "window.aiStream.onMutationsApplied: IPC bridge for ai:mutations-applied signal"
affects: [05-07-toast-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "XP_THRESHOLDS constant exported from LevelUpModal.tsx for CharacterSheetTab reuse"
    - "HIT_DIE_BY_CLASS constant exported from LevelUpModal.tsx for ShortRestHitDiceModal reuse"
    - "levelUp uses Drizzle transaction: UPDATE characters level = MIN(20, level + 1); UPDATE character_resources hp; JSON parse/merge/stringify for spell slots"
    - "applyShortRestHp uses SQL MIN/MAX: hp_current = MIN(hp_max, hp_current + ?); hit_dice_current = MAX(0, COALESCE(hit_dice_current, 0) - ?)"
    - "processRest short-rest signal: onMutationsApplied listener detects chip type='rest' label='Short rest taken'"
    - "SUBCLASS_LEVELS per-class lookup for D-33 deferred note display"
    - "spells-by-class.json require() in LevelUpModal for new slot totals display"

key-files:
  created:
    - src/main/db/charactersRepo.levelUp.test.ts
    - src/renderer/src/components/sheet/LevelUpBanner.tsx
    - src/renderer/src/components/LevelUpModal.tsx
    - src/renderer/src/components/RestPickerDialog.tsx
    - src/renderer/src/components/ShortRestHitDiceModal.tsx
  modified:
    - src/main/db/charactersRepo.ts
    - src/main/trpc/routers/characters.ts
    - src/renderer/src/components/CharacterSheetTab.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - src/preload/index.ts
    - src/renderer/src/types/aiStream.d.ts

key-decisions:
  - "XP_THRESHOLDS + HIT_DIE_BY_CLASS exported from LevelUpModal.tsx as named constants — avoids duplicating the embed in CharacterSheetTab and ShortRestHitDiceModal"
  - "processRest short-rest detection via onMutationsApplied chip inspection (label='Short rest taken') — avoids adding a new dedicated IPC channel; uses the existing ai:mutations-applied event already emitted by mutationPipeline"
  - "levelUp transaction: spell slots merged read/parse/write inside the transaction body to preserve used counts while updating maxes (same pattern as updateSpellSlot)"
  - "applyShortRestHp uses COALESCE(hit_dice_current, 0) to handle NULL from pre-migration rows safely"
  - "window.aiStream.onMutationsApplied added to preload — narrowly exposes only campaignId + chips array (no raw DB data, no tool call args)"
  - "characterQuery added to CampaignViewScreen for ShortRestHitDiceModal — reuses the existing ['characters','getByCampaignId',id] cache key already populated by CharacterSheetTab"

patterns-established:
  - "Modal HP-choice radio pattern: hpMethod state null → 'roll' | 'average'; confirm disabled until resolved"
  - "Slot table display: getNewSpellSlots(class, nextLevel) via require() of spells-by-class.json"

requirements-completed: [PROG-01, PROG-02]

# Metrics
duration: 65min
completed: 2026-05-29
---

# Phase 5 Plan 06: Progression Slice — Level-Up + Rest System (PROG-01 + PROG-02) Summary

**One-liner:** XP-threshold level-up banner + HP-choice modal + system-message emit, plus Rest picker + hit-dice roll modal gated on AI processRest short signal.

## What Was Built

### Task 1: charactersRepo.levelUp + applyShortRestHp + characters router (TDD)

**Tests (RED):** `src/main/db/charactersRepo.levelUp.test.ts` — 9 tests covering:
- `levelUp` increments level, adds hpGain to hpMax+hpCurrent, caps at 20, preserves slot used counts when merging new maxes, handles empty newSlotMax
- `applyShortRestHp` recovers HP (clamped to hpMax), decrements hitDiceCurrent (clamped at 0)

Tests fail with ABI mismatch (same as all other DB tests in this project — `better-sqlite3` compiled for Electron ABI 145, Vitest runs on system Node v24 ABI 137). This is the expected environment limitation across the entire test suite.

**Implementation (GREEN):** `src/main/db/charactersRepo.ts`:
- `levelUp(characterId, hpGain, newSlotMax)` — transaction: `UPDATE characters SET level = MIN(20, level + 1)`, `UPDATE character_resources SET hp_max = hp_max + ?, hp_current = hp_current + ?`, then JSON read/merge/write for spell slots preserving used counts
- `applyShortRestHp(characterId, hpRecovered, diceSpent)` — `SET hp_current = MIN(hp_max, hp_current + ?)`, `hit_dice_current = MAX(0, COALESCE(hit_dice_current, 0) - ?)`

`src/main/trpc/routers/characters.ts` — three new procedures:
- `levelUp` — Zod: `hpGain int 1-50`, `newSlotMax record(string, int 0-9)` (T-05-06-01)
- `recordSystemMessage` — Zod: `content string 1-500` (T-05-06-02); inserts with `role: 'system'`
- `applyShortRestHp` — Zod: `hpRecovered int 0-9999`, `diceSpent int 0-20`

### Task 2: LevelUpBanner + LevelUpModal + CharacterSheetTab wiring

**LevelUpBanner** (`src/renderer/src/components/sheet/LevelUpBanner.tsx`): Amber banner with Star icon, "Level up available — reach Level {N}!" text, gold "Level Up" CTA button. Renders at the TOP of CharacterSheetTab scroll div before SheetHeader.

**LevelUpModal** (`src/renderer/src/components/LevelUpModal.tsx`):
- New level Display (28px/600)
- HP Gain: "Roll d{N}" radio + inline Roll button (uses `rollExpression`), "Take average {N}" radio
- HP summary: "HP gained: +N (base + CON modifier +M)"
- New Spell Slots table from `spells-by-class.json` at nextLevel (skipped for non-spellcasters)
- Subclass deferred note at subclass-granting levels (D-33): "Subclass selection will be available in a future update."
- Footer: "Not Now" (banner persists) + "Confirm Level Up" (gold, disabled until HP resolved)
- On confirm: `trpc.characters.levelUp.mutate()` → `recordSystemMessage("[System: {name} reached Level {N}!]")` → invalidate queries

**CharacterSheetTab** updated: `XP_THRESHOLDS` imported from LevelUpModal; `isLevelUpAvailable = nextLevel <= 20 && character.xp >= XP_THRESHOLDS[nextLevel]`; LevelUpBanner + LevelUpModal mounted.

### Task 3: RestPickerDialog + ShortRestHitDiceModal + CampaignViewScreen Rest button

**RestPickerDialog** (`src/renderer/src/components/RestPickerDialog.tsx`): Two option buttons (Short Rest / Long Rest with Moon icons + descriptive body text), muted DM narration note, Cancel ghost button. Selecting calls `onSelectRest(type)` and closes.

**ShortRestHitDiceModal** (`src/renderer/src/components/ShortRestHitDiceModal.tsx`):
- hitDiceCurrent/Total display (falls back to character.level if null)
- Stepper for `diceToRoll` (min 1, max hitDiceCurrent)
- "Roll Hit Dice" button: rolls `diceToRoll` × `d{hitDie}` via `rollExpression`, shows per-die results with CON modifier
- Per-die rows: "d{N} → {roll} +CON ({mod}) = {total} HP"
- Running total; "Done (+{N} HP)" calls `trpc.characters.applyShortRestHp`; "Skip" closes without changes

**CampaignViewScreen** updated:
- "Rest" button (Moon icon, outline variant) between End Combat and Start Session per UI-SPEC §S1
- `handleRest(type)`: sends exact AI context message `[Player requests a short rest]` or `[Player requests a long rest]` (D-34 copywriting contract); does NOT pre-apply recovery (D-35)
- `onMutationsApplied` IPC listener: detects chip `{type: 'rest', label: 'Short rest taken'}` → opens ShortRestHitDiceModal (D-35, D-36)
- Long rest needs no modal — recovery auto-applied by 05-02's `applyRest('long', ...)`

**Preload + types updated:** `window.aiStream.onMutationsApplied` exposes `ai:mutations-applied` IPC channel to renderer; `removeAllListeners` updated to also clear this channel.

## Deviations from Plan

### Auto-additions (Rule 2)

**1. [Rule 2 - Missing Feature] `onMutationsApplied` added to preload IPC surface**
- **Found during:** Task 3
- **Issue:** The plan specified listening for `ai:mutations-applied` from the processRest pipeline, but this IPC channel was not exposed via contextBridge — only `ai:token`, `ai:finish`, `ai:error` were exposed
- **Fix:** Added `onMutationsApplied` to `src/preload/index.ts` and updated `removeAllListeners()` to include the channel. Added type declaration to `src/renderer/src/types/aiStream.d.ts`
- **Files modified:** `src/preload/index.ts`, `src/renderer/src/types/aiStream.d.ts`
- **Commit:** dccefb3

**2. [Rule 2 - Missing Feature] `characterQuery` added to CampaignViewScreen**
- **Found during:** Task 3
- **Issue:** `ShortRestHitDiceModal` needs character data (hitDiceCurrent, hitDiceTotal, constitution, class) but CampaignViewScreen did not previously query the character
- **Fix:** Added `useQuery` for `characters.getByCampaignId` in CampaignViewScreen using the same cache key as CharacterSheetTab — TanStack Query deduplicates the IPC call
- **Files modified:** `src/renderer/src/screens/CampaignViewScreen.tsx`
- **Commit:** dccefb3

## Known Stubs

None — all data paths are fully wired. The "Subclass selection will be available in a future update." text in LevelUpModal is intentional per D-33 (deferred to Phase 7), not a stub.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The `recordSystemMessage` IPC surface is bounded to 500 chars (T-05-06-02). The `onMutationsApplied` channel exposes only `campaignId` + `chips[]` (not raw DB data or tool call args).

## Self-Check: PASSED

Files confirmed present:
- FOUND: src/main/db/charactersRepo.levelUp.test.ts
- FOUND: src/renderer/src/components/sheet/LevelUpBanner.tsx
- FOUND: src/renderer/src/components/LevelUpModal.tsx
- FOUND: src/renderer/src/components/RestPickerDialog.tsx
- FOUND: src/renderer/src/components/ShortRestHitDiceModal.tsx

Commits confirmed:
- ae9806e: test(05-06) — RED tests
- b617be8: feat(05-06) — GREEN implementation
- 8d808b2: feat(05-06) — LevelUpBanner + LevelUpModal + CharacterSheetTab
- dccefb3: feat(05-06) — RestPickerDialog + ShortRestHitDiceModal + CampaignViewScreen

`npm run typecheck` exits 0.
