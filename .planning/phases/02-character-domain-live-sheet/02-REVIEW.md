---
phase: 02-character-domain-live-sheet
reviewed: 2026-05-25T18:30:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - src/renderer/src/components/CampaignCard.tsx
  - src/renderer/src/components/CharacterSheetTab.tsx
  - src/renderer/src/components/CreateCharacterWizard.tsx
  - src/renderer/src/components/sheet/AbilityScoresSection.tsx
  - src/renderer/src/components/sheet/CombatStatsSection.tsx
  - src/renderer/src/components/sheet/ConditionBadge.tsx
  - src/renderer/src/components/sheet/CurrencySection.tsx
  - src/renderer/src/components/sheet/EquipmentSection.tsx
  - src/renderer/src/components/sheet/PortraitSlot.tsx
  - src/renderer/src/components/sheet/ProficienciesSection.tsx
  - src/renderer/src/components/sheet/ProficiencyDot.tsx
  - src/renderer/src/components/sheet/ResourcesSection.tsx
  - src/renderer/src/components/sheet/SavingThrowsSection.tsx
  - src/renderer/src/components/sheet/SheetHeader.tsx
  - src/renderer/src/components/sheet/SkillsSection.tsx
  - src/renderer/src/components/sheet/SpellSlotPips.tsx
  - src/renderer/src/components/sheet/Stepper.tsx
  - src/renderer/src/components/sheet/TraitsSection.tsx
  - src/renderer/src/components/sheet/sheetHelpers.ts
  - src/renderer/src/components/ui/select.tsx
  - src/renderer/src/components/wizard/StepAbilityScores.tsx
  - src/renderer/src/components/wizard/StepBackground.tsx
  - src/renderer/src/components/wizard/StepClass.tsx
  - src/renderer/src/components/wizard/StepEquipment.tsx
  - src/renderer/src/components/wizard/StepRace.tsx
  - src/renderer/src/components/wizard/StepReview.tsx
  - src/renderer/src/components/wizard/WizardProgress.tsx
  - src/renderer/src/components/wizard/wizardTypes.ts
  - src/renderer/src/screens/CampaignViewScreen.tsx
  - src/renderer/src/stores/characterStore.ts
  - src/main/db/campaignsRepo.ts
  - src/main/trpc/routers/campaigns.ts
  - src/main/db/charactersRepo.ts
  - src/main/trpc/routers/characters.ts
  - src/main/characters/calculations.ts
findings:
  critical: 6
  warning: 11
  info: 6
  total: 23
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-25T18:30:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Reviewed all 35 source files covering the character creation wizard, live character sheet (10 sections), Zustand store, tRPC routers, DB repository layer, and pure calculation functions. The implementation is structurally sound: all IPC inputs are Zod-validated, the optimistic mutation pattern is applied consistently, and the component architecture is clean.

Six blockers were found: two AC calculation bugs (wrong rule for heavy/medium armor, and a string-matching ordering bug that assigns plate AC to half plate armor), the error-state branch that silently launches the wizard on DB failure, a name validation error message that is logically impossible to display, an uncontrolled input for ability score overrides, and an off-by-one in backward navigation that can lose step completion progress. Nine warnings cover concurrent mutation safety, a SQL injection risk via `sql.raw`, the unused Zustand store, attunement limit enforcement, a timeout leak, and other robustness issues. Six info items note typos, dead code, and duplicated implementations.

---

## Critical Issues

### CR-01: `calcAC` Applies Full DEX Modifier to All Armor Types — Wrong D&D 5e Rules

**File:** `src/main/characters/calculations.ts:29-34`

**Issue:** `calcAC(dexterityScore, armorBase)` unconditionally adds the full DEX modifier to any `armorBase`. D&D 5e rules require: heavy armor (chain mail AC 16, splint AC 17, plate AC 18) = base only, no DEX modifier; medium armor = base + min(DEX mod, +2); light armor (leather AC 11, studded leather AC 12, hide AC 12) = base + full DEX mod. A Fighter in chain mail with DEX 8 gets `16 + (−1) = AC 15` instead of `AC 16`. A Fighter with DEX 20 gets `16 + 5 = AC 21` instead of `AC 16`. The bug affects all armored characters at creation and the miscalculation is stored permanently in the DB.

**Fix:**
```typescript
export type ArmorCategory = 'none' | 'light' | 'medium' | 'heavy'

export function calcAC(
  dexterityScore: number,
  armorBase?: number,
  armorCategory: ArmorCategory = 'none',
): number {
  const dexMod = calcAbilityModifier(dexterityScore)
  if (armorBase === undefined) return 10 + dexMod
  if (armorCategory === 'heavy')  return armorBase
  if (armorCategory === 'medium') return armorBase + Math.min(dexMod, 2)
  return armorBase + dexMod   // light or shield
}
```
The armor lookup tables in `CreateCharacterWizard.tsx` and `StepReview.tsx` must also pass the correct `ArmorCategory` alongside the base AC value.

---

### CR-02: `plate` String Check Shadows `half plate` — Wrong AC Assigned at Creation

**File:** `src/renderer/src/components/CreateCharacterWizard.tsx:248-256` and `src/renderer/src/components/wizard/StepReview.tsx:71-79`

**Issue:** The if/else-if chain checks `n.includes('plate')` (assigned AC 18) before `n.includes('half plate')` (assigned AC 15). Because the string `"half plate"` contains the substring `"plate"`, any item named "half plate" hits the first branch and is permanently assigned AC 18 instead of AC 15. The `half plate` branch on line 251 (Wizard) / line 74 (Review) is dead code. Both `handleConfirm` (which writes to the DB) and `StepReview` (the preview shown to the user) share this defect via independent copies of the same block.

Note: `studded leather` must also precede `leather` in the chain — currently it does, so that specific case is not broken, but the ordering principle is inconsistent.

**Fix:** Reorder from most-specific to least-specific in both files:
```typescript
const n = armorItem.name.toLowerCase()
if (n.includes('half plate'))               armorBaseAc = 15  // before 'plate'
else if (n.includes('plate'))               armorBaseAc = 18
else if (n.includes('splint'))              armorBaseAc = 17
else if (n.includes('breastplate'))         armorBaseAc = 14
else if (n.includes('scale mail') || n.includes('ring mail')) armorBaseAc = 14
else if (n.includes('chain mail'))          armorBaseAc = 16
else if (n.includes('studded leather'))     armorBaseAc = 12  // already before 'leather', keep it
else if (n.includes('hide'))               armorBaseAc = 12
else if (n.includes('leather'))            armorBaseAc = 11
```
Extract to a shared helper to prevent the two-file divergence (see IN-02).

---

### CR-03: `CharacterSheetTab` Treats Query Error as "No Character" — Silently Launches Wizard

**File:** `src/renderer/src/components/CharacterSheetTab.tsx:35-47`

**Issue:** The component checks `characterQuery.isLoading` then `!characterQuery.data`, but never checks `characterQuery.isError`. When the `getByCampaignId` tRPC query fails (DB error, IPC failure, JSON parse error), `isLoading` becomes `false` and `data` is `undefined`. The component falls into the `!characterQuery.data` branch and renders the creation wizard. The user sees "Create Your Character" for a campaign that may already have a character. Completing the wizard triggers the `CONFLICT` unique-constraint error, leaving no recovery path other than restarting the app.

**Fix:**
```tsx
if (characterQuery.isError) {
  return (
    <div className="flex items-center justify-center h-full bg-background">
      <p className="text-sm text-destructive">
        Failed to load character data. Please close and reopen the campaign.
      </p>
    </div>
  )
}

if (!characterQuery.data) {
  return <CreateCharacterWizard campaignId={campaignId} />
}
```

---

### CR-04: Name Validation Error in `StepRace` Is Logically Impossible to Display

**File:** `src/renderer/src/components/wizard/StepRace.tsx:39, 57-59`

**Issue:**
```tsx
const showNameError = wizardState.characterName.trim().length === 0

{showNameError && wizardState.characterName !== '' && (
  <p className="text-sm text-destructive">Character name is required.</p>
)}
```
`showNameError` is `true` when `characterName.trim().length === 0`. The second condition `characterName !== ''` requires the raw string to be non-empty. These two conditions are mutually exclusive for any non-whitespace input: if the user leaves the field blank (`characterName === ''`), `characterName !== ''` is `false` and the error never shows. The error is only theoretically reachable if the name contains only whitespace (e.g., `"   "`), which is an obscure edge case. In practice, users who leave the name blank get no validation feedback, even though the Next button is correctly disabled.

**Fix:** Remove the contradictory second condition. Add a `touched` flag to avoid showing the error on initial render:
```tsx
const [nameTouched, setNameTouched] = useState(false)

<Input
  ...
  onBlur={() => setNameTouched(true)}
/>
{nameTouched && wizardState.characterName.trim().length === 0 && (
  <p className="text-sm text-destructive">Character name is required.</p>
)}
```

---

### CR-05: Override `Input` in `StepAbilityScores` Uses `defaultValue` — Uncontrolled Input Desync

**File:** `src/renderer/src/components/wizard/StepAbilityScores.tsx:229`

**Issue:**
```tsx
<Input
  type="number"
  defaultValue={score ?? ''}
  onChange={(e) => handleOverrideInput(ability, e.target.value)}
/>
```
`defaultValue` makes this an uncontrolled input. When the user toggles override off then back on for the same ability, `toggleOverride` resets `scores[ability]` to `null` in wizard state. However, because the input is uncontrolled, React does not update the DOM value — the field still shows the last typed number. The user sees a non-empty field but `wizardState.abilityScores[ability]` is `null`. The "Assign all 6 scores" counter shows the ability as unassigned, and `isCurrentStepValid()` returns `false`, blocking the Next button even though the field appears filled.

**Fix:** Use a controlled input with local state for the override text:
```tsx
// Add to component state:
const [overrideRaw, setOverrideRaw] = useState<Partial<Record<AbilityName, string>>>({})

// In toggleOverride when clearing:
setOverrideRaw((prev) => ({ ...prev, [ability]: '' }))

// In Input:
<Input
  type="number"
  value={overrideRaw[ability] ?? ''}
  onChange={(e) => {
    setOverrideRaw((prev) => ({ ...prev, [ability]: e.target.value }))
    handleOverrideInput(ability, e.target.value)
  }}
/>
```

---

### CR-06: `handleStepClick` Backward Navigation Resets Forward Completion State

**File:** `src/renderer/src/components/CreateCharacterWizard.tsx:147-151`

**Issue:**
```typescript
function handleStepClick(targetStep: number) {
  if (targetStep <= completedUpTo && targetStep !== step) {
    setStep(targetStep)
  }
}

function handleNext() {
  if (!isCurrentStepValid()) return
  setCompletedUpTo(Math.max(completedUpTo, step))
  setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
}
```
`completedUpTo` is a watermark, not a set. After the user completes steps 0–3 and clicks back to step 1, `completedUpTo` is 3. The user then clicks "Next" from step 1: `handleNext` calls `setCompletedUpTo(Math.max(3, 1))` = 3, then advances to step 2. This step is fine. But if the user then modifies their class choice on step 1 and clicks Next, `setCompletedUpTo(Math.max(3, 1)) = 3` — the old completion state is preserved even though steps 2–3 may no longer be valid given the class change. The wizard allows jumping to steps whose validation assumptions no longer hold. Conversely, on the first pass backward and forward, `completedUpTo` never decreases, so there is no way to invalidate a later step that depended on an earlier choice.

**Fix:** Track a maximum-reached step separately from the current step to ensure backward navigation does not falsely re-validate later steps:
```typescript
const [maxCompletedStep, setMaxCompletedStep] = useState(-1)

function handleNext() {
  if (!isCurrentStepValid()) return
  setMaxCompletedStep((m) => Math.max(m, step))
  setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
}

function handleStepClick(targetStep: number) {
  if (targetStep <= maxCompletedStep && targetStep !== step) {
    setStep(targetStep)
  }
}
```
Additionally, consider invalidating `maxCompletedStep` back to `targetStep - 1` when making a change in a step that is upstream of already-completed steps (e.g., changing the class should reset equipment step completion).

---

## Warnings

### WR-01: `sql.raw(denomination)` in Currency Mutation — Unparameterized Column Name

**File:** `src/main/db/charactersRepo.ts:333`

**Issue:** `sql.raw(denomination)` injects the denomination string directly as raw SQL text for the column name inside the `MAX(0, ${sql.raw(denomination)} + ${delta})` expression. The denomination is validated by Zod in the tRPC router to `z.enum(['cp', 'sp', 'ep', 'gp', 'pp'])` before reaching the repo, so there is no exploitable injection path in the current architecture. However, `sql.raw` bypasses Drizzle's parameterisation entirely, and if the repo method is ever called directly from a test or future code path without that Zod gate, it becomes a SQL injection vector. The Drizzle idiom for dynamic column names is to use the schema column reference.

**Fix:**
```typescript
const colMap = {
  cp: characterResources.cp,
  sp: characterResources.sp,
  ep: characterResources.ep,
  gp: characterResources.gp,
  pp: characterResources.pp,
} as const

// In updateCurrency:
const col = colMap[denomination]
db.update(characterResources)
  .set({ [denomination]: sql`MAX(0, ${col} + ${delta})`, updatedAt: now })
  .where(eq(characterResources.characterId, characterId))
  .run()
```

---

### WR-02: `AbilityInput` Uses `queryKey as string[]` — Incorrect Type Cast

**File:** `src/renderer/src/components/sheet/AbilityScoresSection.tsx:57`

**Issue:** `queryClient.getQueryData<CharacterWithResources>(queryKey as string[])`. The `queryKey` is `readonly unknown[]` and is cast to `string[]`. The cast is wrong on two counts: (1) `QueryClient.getQueryData` natively accepts `readonly unknown[]` — no cast is needed; (2) the key contains a UUID string but the type claim strips the `readonly` invariant. If TanStack Query's key comparison fails on the cast value in a future version, `getQueryData` silently returns `undefined` and the optimistic update is silently dropped.

**Fix:**
```typescript
const prev = queryClient.getQueryData<CharacterWithResources>(queryKey)
```

---

### WR-03: `characterStore` Zustand Store Is Defined but Never Connected — Dead Abstraction

**File:** `src/renderer/src/stores/characterStore.ts` (entire file) and `src/renderer/src/components/CreateCharacterWizard.tsx:54`

**Issue:** `useCharacterStore` exports `wizardDraft` and `updateWizardStep`. The wizard allocates its own `useState<WizardState>(initialWizardState)` at line 54 and never reads from or writes to the store. The store's `wizardDraft` is always `null`; `updateWizardStep` is never called. This means: (a) any future code that reads `wizardDraft` will get `null` even mid-wizard; (b) the store's comment "Cleared on close or confirm" is aspirational — nothing clears it because nothing writes to it; (c) the store provides no persistence benefit over local `useState`.

**Fix:** Either wire `CreateCharacterWizard` to use the store (initialize from `wizardDraft`, update on every `updateWizard` call, clear on success/cancel), or delete `characterStore.ts` and its import.

---

### WR-04: Concurrent Rapid-Click Mutations on Steppers Are Not Serialized

**File:** `src/renderer/src/components/sheet/ResourcesSection.tsx:22-48, 51-74` and `src/renderer/src/components/sheet/CurrencySection.tsx:25-48`

**Issue:** Every Stepper click triggers a new mutation immediately with no debounce and no `disabled={mutation.isPending}` guard. If the user clicks the HP +/− button multiple times before the first mutation settles, each `onMutate` reads `prev.resources.hpCurrent` from the cache, which by that point already reflects the first mutation's optimistic update. If any mutation fails, its rollback restores to the snapshot captured at _that_ mutation's `onMutate` time — which may clobber the optimistic state applied by a concurrent successful mutation. The net result is an incorrect displayed value until the next `invalidateQueries` refetch completes.

**Fix:** Disable the Stepper while any mutation for that resource is pending:
```tsx
<Stepper
  value={character.resources.hpCurrent}
  min={0}
  max={character.resources.hpMax}
  size="lg"
  label="Hit Points"
  disabled={hpMutation.isPending}
  onChange={(delta) => hpMutation.mutate(delta)}
/>
```

---

### WR-05: Attunement Limit Not Enforced Client-Side — Optimistic Update Shows False State

**File:** `src/renderer/src/components/sheet/EquipmentSection.tsx:74-90`

**Issue:** The attunement count badge shows `{attunemntCount} / 3 Attuned` but there is no guard on the attune button when `attunemntCount >= 3` and the item is not already attuned. Clicking the button fires the optimistic mutation which briefly shows the item as attuned (4/3), then either the server rejects it (flash-revert) or it succeeds (silent rule violation). The tRPC `toggleItemAttuned` procedure also has no server-side enforcement of the 3-slot limit.

**Fix:** Disable the attune button at the limit:
```tsx
<Button
  ...
  disabled={!item.isAttuned && attunemntCount >= 3}
  onClick={() => toggleAttunedMutation.mutate(item.id)}
>
```
Enforce the limit server-side in `charactersRepo.toggleItemAttuned` or as a guard in the tRPC procedure.

---

### WR-06: `XP_THRESHOLDS` Index Off-by-One at Level 20 — Incorrect Display for Max-Level Character

**File:** `src/renderer/src/components/sheet/SheetHeader.tsx:60`

**Issue:** `XP_THRESHOLDS[currentLevel]` at level 20 reads index 20, which is `undefined`. The fallback `XP_THRESHOLDS[XP_THRESHOLDS.length - 1]` returns `355000` — the XP required to *reach* level 20, which is now displayed as the "next level" target for a character who is already level 20. This is semantically incorrect; max-level characters have no next level.

**Fix:**
```typescript
const nextLevelXp = currentLevel >= 20 ? null : XP_THRESHOLDS[currentLevel]

// JSX:
{nextLevelXp !== null
  ? `XP: ${character.xp} / ${nextLevelXp}`
  : `XP: ${character.xp} (Max Level)`}
```

---

### WR-07: `getAvailableValues` Allows Duplicate Standard-Array Assignments via Override Toggle

**File:** `src/renderer/src/components/wizard/StepAbilityScores.tsx:74-79`

**Issue:** `getAssignedValues` filters out override-mode abilities (`!overrides[a]`). If ability A has override mode active with a typed value of 15, and the user also selects 15 from the dropdown for ability B (which is valid because A is excluded from the assigned set), then ability A is later toggled out of override mode — its dropdown will show 15 as available (since it wasn't counted as assigned while in override mode). The user can select 15 again, giving two non-override abilities the same standard-array value. The `assignedCount` counter only checks for non-null scores, so all 6 appear assigned while two share the same value.

**Fix:** The validation in `isCurrentStepValid` (or `isStep2Valid`) should verify that the set of non-override scores forms a subset permutation of `STANDARD_ARRAY` with no duplicates.

---

### WR-08: `StepAbilityScores` Override `Input` Missing `aria-label`

**File:** `src/renderer/src/components/wizard/StepAbilityScores.tsx:226-239`

**Issue:** The override `<Input>` for ability score manual entry has no `aria-label`. Screen readers will announce it as a generic "number input" with no context about which ability it controls. The associated `<span>` showing the abbreviation (STR, DEX, etc.) is not programmatically linked.

**Fix:**
```tsx
<Input
  type="number"
  aria-label={`${ABILITY_ABBREVIATIONS[ability]} override value`}
  ...
/>
```

---

### WR-09: `CampaignViewScreen` `saveDebounceRef` Timeout Not Cleared on Unmount

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:24, 71-83`

**Issue:** `saveDebounceRef` holds a `setTimeout` handle assigned in `handleLayout`. There is no `useEffect` cleanup to clear this timer on unmount. If the user navigates away from the campaign view while resizing panels (within the 500ms debounce window), the timeout fires after unmount and calls `store.save(id, sizes[0], sizes[1])` with stale closure values. If the user navigated to a different campaign quickly, this could save sizes for the wrong campaign ID under a race condition.

**Fix:**
```typescript
useEffect(() => {
  return () => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
  }
}, [])
```

---

### WR-10: `CampaignCard` Cover Image Query Error Not Surfaced to User

**File:** `src/renderer/src/components/CampaignCard.tsx:21-24`

**Issue:** `coverQuery` has no error branch. If `getCoverDataUrl` throws (e.g., the image file was deleted after import), `coverQuery.isError` is `true` but the component silently falls back to the gradient placeholder. The user has no indication that their previously set cover image is unavailable. The `coverError` state only covers the import mutation error, not the read failure.

**Fix:**
```tsx
{coverQuery.isError && (
  <p className="text-xs text-destructive mt-1 text-center">Cover unavailable</p>
)}
```

---

### WR-11: `CampaignCard` Outer `role="button"` Missing Accessible Name

**File:** `src/renderer/src/components/CampaignCard.tsx:61-65`

**Issue:** The outer `<div role="button">` has no `aria-label`. Screen readers announce it as "button" with no name, since child elements (the campaign name in the card body) are not automatically associated with the interactive container. WCAG 2.1 Success Criterion 4.1.2 requires all interactive elements to have an accessible name.

**Fix:**
```tsx
<div
  role="button"
  tabIndex={0}
  aria-label={`Open campaign: ${campaign.name}`}
  onClick={handleClick}
  onKeyDown={handleKeyDown}
  ...
>
```

---

## Info

### IN-01: Typo — `attunemntCount` in `EquipmentSection`

**File:** `src/renderer/src/components/sheet/EquipmentSection.tsx:17`

**Issue:** `const attunemntCount` — "attunement" is misspelled as "attunemnt". Harmless at runtime.

**Fix:** Rename to `attunementCount`.

---

### IN-02: Duplicated Armor AC Lookup Block — Two Copies Must Stay Synchronized

**File:** `src/renderer/src/components/CreateCharacterWizard.tsx:228-257` and `src/renderer/src/components/wizard/StepReview.tsx:54-80`

**Issue:** The armor item detection and AC base lookup is copied verbatim between `handleConfirm` and `StepReview`. This is the source of CR-02 (both files had the same ordering bug). Any future armor type addition requires two synchronized changes.

**Fix:** Extract to a shared helper in `wizardHelpers.ts`:
```typescript
export function getArmorBaseAc(items: { name: string }[]): number | undefined {
  const armorItem = items.find((item) => {
    const n = item.name.toLowerCase()
    return n.includes('chain mail') || n.includes('leather armor') /* ... */
  })
  if (!armorItem) return undefined
  const n = armorItem.name.toLowerCase()
  if (n.includes('half plate')) return 15
  // ... corrected ordering
}
```

---

### IN-03: `isStepNValid` Exports Are Dead Code — Wizard Uses Its Own Inline Switch

**File:** `src/renderer/src/components/wizard/StepRace.tsx:203-205`, `StepClass.tsx:210-215`, `StepAbilityScores.tsx:363-368`, `StepBackground.tsx:219-224`, `StepEquipment.tsx:122-124`

**Issue:** Each step file exports `isStepNValid(state)`. `CreateCharacterWizard` never imports any of these — it implements `isCurrentStepValid()` as an inline switch that duplicates the same logic. All five exported helpers are dead code, and the logic exists in two places that can diverge.

**Fix:** Either delete the exported validators and keep the wizard's inline switch, or import them in the wizard to eliminate the duplication.

---

### IN-04: `WizardState.step` Field Is Never Read or Written

**File:** `src/renderer/src/components/wizard/wizardTypes.ts:8` and `src/renderer/src/components/CreateCharacterWizard.tsx:52-54`

**Issue:** `WizardState` declares `step: number` initialized to `0`. The wizard manages step state separately with `const [step, setStep] = useState(0)` and never reads or writes `wizardState.step`. The field occupies space in the type but has no effect.

**Fix:** Remove `step` from `WizardState` and from `initialWizardState`.

---

### IN-05: Equipment Items All Get `sortOrder: 0` — Display Order Is Non-Deterministic

**File:** `src/main/db/charactersRepo.ts:199`

**Issue:** All starting items are inserted with `sortOrder: 0`. The `getWithResources` query sorts by `asc(characterItems.sortOrder)`. With all values equal, SQLite makes no order guarantee, and item display order may vary across queries and restarts.

**Fix:**
```typescript
for (const [idx, item] of (input.startingItems ?? []).entries()) {
  tx.insert(characterItems).values({ ..., sortOrder: idx, ... }).run()
}
```

---

### IN-06: `StepReview` Defines a Local `ordinal` That Duplicates `sheetHelpers.ordinal`

**File:** `src/renderer/src/components/wizard/StepReview.tsx:124-128`

**Issue:** A local `ordinal(n)` function is defined with a different (more fragile) algorithm, despite `sheetHelpers.ts` already exporting `ordinal()`. The local version produces correct output for spell slot levels 1–9 (the only inputs it receives), but its `suffixes[(v - 20) % 10]` path relies on JavaScript's signed remainder behavior and is not obviously correct for arbitrary inputs.

**Fix:** Remove the local definition and import from `sheetHelpers`:
```typescript
import { ordinal } from '../sheet/sheetHelpers'
```

---

_Reviewed: 2026-05-25T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
