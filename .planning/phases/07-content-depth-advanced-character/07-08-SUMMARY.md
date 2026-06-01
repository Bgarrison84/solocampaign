---
phase: 07-content-depth-advanced-character
plan: "08"
subsystem: party-ui
tags: [party-mode, companions, multiclass, encumbrance, combat-tracker, ui]
dependency_graph:
  requires: ["07-01", "07-03", "07-05", "07-06"]
  provides:
    - campaignViewStore-activeCharacterId
    - CharacterSheetTab-partySwitcher
    - CompanionsSection
    - SheetHeader-multiclass
    - InventoryTab-encumbrance
    - startCombat-partyAware
  affects:
    - src/renderer/src/stores/campaignViewStore.ts (new)
    - src/renderer/src/components/CharacterSheetTab.tsx
    - src/renderer/src/components/CompanionsSection.tsx (new, full impl)
    - src/renderer/src/components/sheet/SheetHeader.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - src/main/db/charactersRepo.ts (listByCampaign)
    - src/main/trpc/routers/characters.ts (list, addCompanion, deleteCompanion)
tech_stack:
  added: []
  patterns:
    - "Zustand activeCharacterId reset on campaign change (Pitfall 6)"
    - "role=tablist/tab/aria-selected switcher chips pattern"
    - "Collapsible companions row with inline remove confirm"
    - "Type badge color-coded pill (purple/green/blue)"
    - "Multiclass JSON parse + null-safe fallback in SheetHeader"
    - "IIFE in JSX for conditional encumbrance banner"
    - "Async handleStartCombat with duplicate-guard via existingPlayerNames Set"
key_files:
  created:
    - src/renderer/src/stores/campaignViewStore.ts
    - src/renderer/src/components/CompanionsSection.tsx
  modified:
    - src/renderer/src/components/CharacterSheetTab.tsx
    - src/renderer/src/components/sheet/SheetHeader.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - src/main/db/charactersRepo.ts
    - src/main/trpc/routers/characters.ts
decisions:
  - "Solo mode Start Combat unchanged — auto-add only fires when partySize > 1"
  - "Duplicate-guard uses existingPlayerNames Set (name-based) — sufficient for party mode where names are unique"
  - "CompanionsSection shown when partySize > 1 OR companions exist (always visible for party campaigns)"
  - "Inventory encumbrance uses IIFE in JSX to keep calculation inline without separate component"
  - "handleStartCombat made async — React ignores returned Promise from event handlers (no type error)"
  - "addCombatant uses hpMax for both hpMax (missing hpCurrent not in input schema) — server defaults hpCurrent to hpMax"
metrics:
  duration: "~9 minutes"
  completed: "2026-06-01T00:21:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 5
---

# Phase 7 Plan 08: Party/Companion UI, Multiclass Header, Encumbrance, Party-Aware Combat Summary

**One-liner:** Party switcher chips (activeCharacterId Zustand store, reset on campaign change), CompanionsSection with HP stepper/type badge/remove confirm/Add dialog, multiclass SheetHeader breakdown, Inventory encumbrance banner with 5x/10x STR badges, and party-aware Start Combat that auto-adds all non-companion members with duplicate-guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | activeCharacterId store + party switcher chips + Add Character chip | 8034c8d | campaignViewStore.ts, CharacterSheetTab.tsx, CampaignViewScreen.tsx, charactersRepo.ts, characters.ts, CompanionsSection.tsx (stub) |
| 2 | CompanionsSection + SheetHeader multiclass + Inventory encumbrance | 14ae8af | CompanionsSection.tsx (full), SheetHeader.tsx, CampaignViewScreen.tsx |
| 3 | Party-aware Start Combat (Open Question 2 / PARTY-01) | 3dd8351 | CampaignViewScreen.tsx |
| 4 | checkpoint:human-verify | auto-approved | — |

## What Was Built

### campaignViewStore.ts (new)

Zustand store with:
- `activeCharacterId: string | null` — driven by switcher chips; null defaults to first party member
- `setActiveCharacterId(id)` — called by chip click
- `resetActiveCharacterId()` — called in `CampaignViewScreen` `useEffect([id])` (Pitfall 6)

### CharacterSheetTab.tsx (party switcher + characters.list)

Switched from `trpc.characters.getByCampaignId` to `trpc.characters.list` to get all characters for the campaign. Split into `partyMembers` (isCompanion=false) and `companions` (isCompanion=true).

**Party switcher (partySize > 1 only):**
- `role="tablist"` wrapper div
- Each chip: `role="tab"`, `aria-selected`, accent-gold active / secondary inactive styling
- `+ Add Character` dashed chip when `partyMembers.length < partySize` — opens `CreateCharacterWizard` with `onComplete` prop (from 07-06) to return to the tab after creation

**Companion handlers wired:** `handleUpdateCompanionHp` calls `trpc.characters.updateHp`; `handleRemoveCompanion` calls `trpc.characters.deleteCompanion`.

### charactersRepo.ts + characters.ts tRPC procedures

Three new procedures added:
- `characters.list({ campaignId })` → `listByCampaign()` — returns all characters for a campaign (ordered by createdAt)
- `characters.addCompanion({ campaignId, name, type, hpMax, ac })` — Zod-validated server-side (T-07-08-01); calls `createCompanion()`
- `characters.deleteCompanion({ companionId, campaignId })` — scoped delete calls `deleteCompanion()` (T-07-08-02)

`listByCampaign()` added to `charactersRepo` — maps over character IDs via existing `getWithResources()`.

### CompanionsSection.tsx (new — full implementation)

Collapsible section with:
- Toggle row (ChevronDown/Right + "Companions (N)", 40px min-height)
- Per-companion row: name (semibold), type badge (purple/green/blue pill), `Stepper size="sm"` HP with `N / max` display, "AC: N" muted, condition pills (amber), ghost X remove button with inline "Remove [name]? / Remove / Keep" confirm
- Empty state: "No companions yet…" (per §Copywriting)
- "Add Companion" outline button opens `AddCompanionDialog`
- `AddCompanionDialog`: Name Input, Type Select (3 options), HP Max number Input, AC number Input (min=1 max=30), validation: "Name, HP, and AC are required.", Cancel + Add Companion footer

### SheetHeader.tsx (multiclass)

Added multiclass detection: JSON-parses `character.classes` (guarded in try/catch). If parsed array has length > 1, renders:
- Line 1: `{race}` only
- Line 2: `"Fighter 5 / Wizard 3 — Level 8"` (`.map(c => \`${c.className} ${c.level}\`).join(' / ') + ' — Level ' + totalLevel`)

Null-safe: single-class characters render exactly as before (`{race} {class} · Level {level}`).

### Inventory encumbrance (CampaignViewScreen.tsx)

When `campaign.encumbranceEnabled && characterQuery.data`: renders a top banner in the Inventory tab:
- "Carrying Capacity" label (semibold) + `"X / Y lbs"` (font-mono) where X = sum of `item.weight × item.quantity`, Y = 15× STR
- "Encumbered" amber badge when X ≥ 5× STR
- "Heavily Encumbered" red badge when X ≥ 10× STR (exclusive: only the higher badge shown)

### Start Combat — party-aware (Open Question 2 resolved)

`handleStartCombat` in `CampaignViewScreen` is now `async`:
1. Sets combatStore active + calls `startCombat` tRPC mutation (unchanged from Phase 5)
2. **Party mode only (partySize > 1):** queries `characters.list`, filters companions out, queries `combat.listActive` to build `existingPlayerNames` Set (duplicate-guard), then calls `trpc.combat.addCombatant` for each non-duplicate member with `isPlayer: true`
3. Invalidates `combat.listActive` query
4. Solo mode (partySize === 1): path above is skipped — unchanged from Phase 5

**This resolves RESEARCH Open Question 2** (how to handle multi-character combat tracking for party mode).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] CompanionsSection stub needed for Task 1 tsc**
- **Found during:** Task 1 implementation
- `CharacterSheetTab.tsx` imports `CompanionsSection` but Task 2 creates it. A stub was created in Task 1 commit to keep tsc clean.
- **Fix:** Created minimal typed stub; replaced with full implementation in Task 2.
- **Files modified:** `src/renderer/src/components/CompanionsSection.tsx`
- **Commit:** 8034c8d (stub), 14ae8af (full)

### Design Notes

**addCombatant hpMax vs hpCurrent:** The `combat.addCombatant` input schema takes `hpMax` but not `hpCurrent` (server defaults hpCurrent to hpMax on insert via the combatants repo). Party members are added at full HP — the tracker's HP stepper lets the player adjust down immediately after.

**Campaign prop passed to CharacterSheetTab:** `CampaignViewScreen` now passes `campaignQuery.data` as `campaign` prop to `CharacterSheetTab` (to drive partySize guard and encumbranceEnabled) via `campaign={campaignQuery.data}`. No extra query needed.

**Checkpoint auto-approved:** Task 4 checkpoint:human-verify auto-approved per `auto_advance=true` configuration.

## Known Stubs

None — all data flows are fully wired:
- Party switcher: `characters.list` → `partyMembers` → chips driven by `activeCharacterId`
- Companions: `characters.list` → `companions` → `CompanionsSection` with live HP mutations
- Multiclass header: `character.classes` JSON → SheetHeader display
- Encumbrance: `character.items[].weight × quantity` vs `STR` thresholds → banner
- Party combat: `characters.list` → `combat.addCombatant` loop

## Threat Surface Scan

No new network endpoints. New tRPC procedures validate inputs server-side (Zod). `listByCampaign` is a read-only campaign-scoped query (T-07-08-02 mitigated by campaignId scope). `addCombatant` auto-add reads from campaign-scoped characters query (T-07-08-03).

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validated | characters.ts (addCompanion) | T-07-08-01: name/type/hpMax/ac Zod-bounded server-side |
| threat_flag: campaign-scoped | characters.ts (deleteCompanion) | T-07-08-02: deleteCompanion requires matching campaignId + isCompanion=true |
| threat_flag: input-validated | combat.ts (addCombatant auto-add) | T-07-08-03: hp/ac/name validated by existing Zod schema on addCombatant |

## Self-Check: PASSED

Files confirmed to exist:
- `src/renderer/src/stores/campaignViewStore.ts` — FOUND (contains `activeCharacterId`, `resetActiveCharacterId`)
- `src/renderer/src/components/CompanionsSection.tsx` — FOUND (contains `Collapsible`, `Stepper`, `typeBadgeClass`, `AddCompanionDialog`)
- `src/renderer/src/components/CharacterSheetTab.tsx` — FOUND (contains `partySize > 1` guard, `role="tablist"`, `aria-selected`, `Add Character`)
- `src/renderer/src/components/sheet/SheetHeader.tsx` — FOUND (contains `multiclassBreakdown`, `— Level`)
- `src/renderer/src/screens/CampaignViewScreen.tsx` — FOUND (contains `resetActiveCharacterId`, `encumbranceEnabled`, `handleStartCombat async`, `existingPlayerNames`)
- `src/main/db/charactersRepo.ts` — FOUND (contains `listByCampaign`)
- `src/main/trpc/routers/characters.ts` — FOUND (contains `list:`, `addCompanion:`, `deleteCompanion:`)

Commits confirmed:
- `8034c8d` — Task 1: activeCharacterId store + party switcher
- `14ae8af` — Task 2: CompanionsSection + SheetHeader multiclass + Inventory encumbrance
- `3dd8351` — Task 3: party-aware Start Combat

tsc --noEmit: clean (0 errors) on all touched files.
