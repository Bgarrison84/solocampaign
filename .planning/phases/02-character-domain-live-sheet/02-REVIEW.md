---
phase: 02-character-domain-live-sheet
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 30
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
findings:
  critical: 5
  warning: 9
  info: 5
  total: 19
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed 30 source files covering the character creation wizard, the live character sheet (10 sections), Zustand store, and the campaign view screen. The implementation is structurally sound but carries several correctness bugs — primarily around optimistic update query-key mismatches, armor AC lookup ordering, the error condition for the character name validation display, the unused Zustand store (dead abstraction), and the `handleStepClick` off-by-one in navigation. Secondary concerns include missing debounce protection on concurrent mutations, an attunement limit that is never enforced on the client, and the duplicated armor-lookup block between wizard and review step.

---

## Critical Issues

### CR-01: Optimistic update in `AbilityScoresSection` uses wrong query-key shape — always a cache miss

**File:** `src/renderer/src/components/sheet/AbilityScoresSection.tsx:57-59`

**Issue:** The `onMutate` handler calls `queryClient.getQueryData<CharacterWithResources>(queryKey as string[])` where `queryKey` is typed `readonly unknown[]`. The cast to `string[]` does not change the actual value. More critically, `QUERY_KEY` is built as `['characters', 'getByCampaignId', character.campaignId]` (line 130) — a three-element array with a campaign ID as the third element. TanStack Query's cache key lookup is by-value-equality across the entire array; this is the correct key shape only if `CharacterSheetTab` populates the cache with that exact key. However, if the query key in `CharacterSheetTab` ever diverges (e.g., gains or loses an element), the `getQueryData` call silently returns `undefined`, the `if (prev)` guard is never entered, and the optimistic update is dropped. The cast `as string[]` on line 57 provides a false type safety guarantee on an `unknown[]` that may contain non-string elements. The real risk is that the optimistic-update path is silently skipped whenever the key is a partial mismatch, leaving the UI in a stale "old value" state while the mutation succeeds server-side, until the next `invalidateQueries` fires.

**Fix:** Use a shared constant for the query key, defined once and imported by both `CharacterSheetTab` and all sheet-section components:
```ts
// sheetQueryKeys.ts
export const characterQueryKey = (campaignId: string) =>
  ['characters', 'getByCampaignId', campaignId] as const

// In AbilityScoresSection onMutate:
const prev = queryClient.getQueryData<CharacterWithResources>(queryKey)
// Remove the `as string[]` cast entirely — TanStack accepts readonly unknown[]
```

---

### CR-02: Armor AC lookup order — "plate" matches before "half plate" and "splint", producing wrong AC values

**File:** `src/renderer/src/components/CreateCharacterWizard.tsx:249-257` and `src/renderer/src/components/wizard/StepReview.tsx:71-79`

**Issue:** The if/else-if chain checks `n.includes('plate')` (line 249/73) before `n.includes('half plate')` (line 251/75) and `n.includes('splint')` (line 250/74). The string `"half plate"` contains the substring `"plate"`, so half plate armor is incorrectly assigned AC 18 (plate mail AC) instead of AC 15. Similarly, `"splint"` does not contain `"plate"` so it is fine, but this creates a latent correctness bug now and a maintenance hazard as new armor types are added. The same defective ordering exists independently in both files, meaning the Review step preview and the actual character creation mutation both compute wrong AC for half plate.

**Fix:** Reorder the checks from most-specific to least-specific in both locations:
```ts
if (n.includes('half plate')) armorBaseAc = 15
else if (n.includes('plate armor') || n === 'plate') armorBaseAc = 18
else if (n.includes('splint')) armorBaseAc = 17
else if (n.includes('breastplate')) armorBaseAc = 14
else if (n.includes('scale mail') || n.includes('ring mail')) armorBaseAc = 14
else if (n.includes('chain mail')) armorBaseAc = 16
else if (n.includes('hide')) armorBaseAc = 12
else if (n.includes('studded leather')) armorBaseAc = 12
else if (n.includes('leather')) armorBaseAc = 11
```

---

### CR-03: `handleStepClick` allows navigating to the current step — `completedUpTo` off-by-one produces incorrect gate

**File:** `src/renderer/src/components/CreateCharacterWizard.tsx:147-151`

**Issue:**
```ts
function handleStepClick(targetStep: number) {
  if (targetStep <= completedUpTo && targetStep !== step) {
    setStep(targetStep)
  }
}
```
`completedUpTo` is updated in `handleNext` via `Math.max(completedUpTo, step)` — so after completing step 0, `completedUpTo` is 0. The WizardProgress component marks step 0 as "completed" (line 28: `i <= completedUpTo && i !== currentStep`), but `handleStepClick(0)` evaluates `0 <= 0 && 0 !== 1` = true, so step 0 becomes clickable, which is the intended behavior. However, **step `completedUpTo + 1` (the current active step)** is gated correctly. The real defect is that when the user is on step 1 (`step = 1, completedUpTo = 0`), clicking the completed step 0 circle calls `handleStepClick(0)` which sets `step = 0`. But `completedUpTo` remains 0. Now clicking "Next" from step 0 re-evaluates `handleNext`: it calls `setCompletedUpTo(Math.max(0, 0)) = 0` — step 0 is re-marked complete but step 1's completion state is not preserved. If the user returns to step 0 and then "Next" past it again, steps already completed between 1 and `n` become inaccessible until they pass through them again. The `completedUpTo` model only tracks a watermark, not a set, so backward navigation can "forget" that later steps were already completed.

**Fix:** Track completion as a set (or store the max completed separately before backward jumps):
```ts
const [maxCompletedStep, setMaxCompletedStep] = useState(-1)

function handleNext() {
  if (!isCurrentStepValid()) return
  setMaxCompletedStep(Math.max(maxCompletedStep, step))
  setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
}

// completedUpTo passed to WizardProgress should be maxCompletedStep, not affected by current step
```
Then `handleStepClick` uses `maxCompletedStep` so backward navigation does not erase forward progress.

---

### CR-04: `CharacterSheetTab` treats `characterQuery.isError` as "no character" — silently launches wizard on network error

**File:** `src/renderer/src/components/CharacterSheetTab.tsx:43-46`

**Issue:** The loading branch correctly handles `isLoading`. But the check `if (!characterQuery.data)` catches three distinct states: (a) a genuine null/undefined response (character not yet created), (b) a query error (network/IPC failure), and (c) a successful query that returned null. In state (b), `characterQuery.isError` is true but `characterQuery.data` is `undefined`, so the wizard launches. The user sees "Create Your Character" when the system actually failed to load their existing character. If they proceed through the wizard and submit, a second character is created for the same campaign — or the creation fails with a unique-constraint violation that surfaces as an opaque error.

**Fix:** Explicitly check `isError` before defaulting to the wizard:
```tsx
if (characterQuery.isError) {
  return (
    <div className="flex items-center justify-center h-full bg-background">
      <p className="text-destructive text-sm">Failed to load character. Please try again.</p>
    </div>
  )
}

if (!characterQuery.data) {
  return <CreateCharacterWizard campaignId={campaignId} />
}
```

---

### CR-05: Name validation error condition is logically inverted — error never displays

**File:** `src/renderer/src/components/wizard/StepRace.tsx:39, 57-59`

**Issue:**
```tsx
const showNameError = wizardState.characterName.trim().length === 0

// ...

{showNameError && wizardState.characterName !== '' && (
  <p className="text-sm text-destructive">Character name is required.</p>
)}
```
`showNameError` is `true` when `characterName.trim().length === 0`. The second condition `wizardState.characterName !== ''` is only true when the string is non-empty. Together the compound condition requires both "the trimmed name is empty" AND "the name is non-empty" — which is only satisfied when `characterName` is a string containing only whitespace (e.g., `"   "`). For the common case (name field genuinely blank, `characterName === ''`), `wizardState.characterName !== ''` is false, so the error never displays. Users who leave the name field blank get no validation feedback, even though the Next button is correctly disabled.

**Fix:**
```tsx
{showNameError && wizardState.characterName.length > 0 && (
  // Shows when trimmed = empty but raw is non-empty (whitespace-only)
)}
```
OR, more simply, show the error whenever the name field has been touched and is invalid. Since there is no touched state, a practical fix is to show the error when the field is empty and the user has interacted — but as a minimal fix, remove the redundant second condition so the error shows for any empty name:
```tsx
{wizardState.characterName.trim().length === 0 && (
  <p className="text-sm text-destructive">Character name is required.</p>
)}
```
Note: this will show the error immediately on mount before the user has touched anything. A `touched` flag would be the proper solution.

---

## Warnings

### WR-01: `characterStore` (Zustand) is defined but never used in the wizard — dead abstraction, state lives in two places

**File:** `src/renderer/src/stores/characterStore.ts` (entire file) and `src/renderer/src/components/CreateCharacterWizard.tsx:54`

**Issue:** `characterStore.ts` exports `useCharacterStore` with `wizardDraft` and `updateWizardStep`. The wizard allocates its own `useState<WizardState>(initialWizardState)` at line 54 of `CreateCharacterWizard.tsx` and never reads from or writes to the store. The store's `wizardDraft` is therefore always `null`; `updateWizardStep` is never called. This means:
1. If the wizard is unmounted and remounted (e.g., React Strict Mode double-invoke), draft state is lost because it lives only in local `useState`.
2. The store's comment "Cleared on close or confirm" is aspirational — nothing clears it because nothing writes it.
3. Any future component that tries to read `wizardDraft` from the store will get `null` even mid-wizard.

**Fix:** Either connect `CreateCharacterWizard` to the store (initialize from `wizardDraft`, write on every `updateWizard` call, clear on success/cancel), or delete `characterStore.ts` and remove the import. Leaving the store in place while the wizard ignores it creates false expectations.

---

### WR-02: Concurrent rapid-click mutations on `ResourcesSection` are not debounced or serialized

**File:** `src/renderer/src/components/sheet/ResourcesSection.tsx:22-48, 51-74, 77-100`

**Issue:** Each `Stepper` component for HP, temp HP, XP, and currency emits a mutation on every button click. There is no debounce, no `disabled={mutation.isPending}` flag on the Stepper, and no serialization of concurrent mutations. If a user clicks the HP +/- button rapidly, multiple inflight `updateHp` calls are sent. Each `onMutate` optimistically applies a delta to the cached value; but because the optimistic update reads `prev.resources.hpCurrent` from the cache, and the cache may have already been updated by the first mutation's `onMutate`, the second mutation's context `prev` may capture a value different from what the server will see. If any one of these requests fails, the rollback restores to _that_ mutation's snapshot, potentially clobbering the other mutation's effect. The real server value will only be correct after all mutations settle, but the UI could briefly show incorrect values that are hard to reproduce.

**Fix:** Disable the Stepper while any mutation is pending, or batch rapid clicks with debounce:
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

### WR-03: Attunement limit (max 3) is only visual — the mutation is not guarded client-side

**File:** `src/renderer/src/components/sheet/EquipmentSection.tsx:17, 74-90`

**Issue:** `attunemntCount` is computed (note: also a typo) and displayed as `{attunemntCount} / 3 Attuned`, but `toggleAttunedMutation.mutate(item.id)` is called unconditionally when clicking the attune button, even when `attunemntCount >= 3` and `!item.isAttuned`. There is no guard: the code only checks `item.isMagic` to decide whether to show the button at all. If the server enforces the 3-slot limit, the mutation will fail and the UI will roll back, but the optimistic update (`{ ...item, isAttuned: !item.isAttuned }`) will briefly show the item as attuned before reverting — a confusing flicker. If the server does not enforce the limit, the player can attune more than 3 items.

**Fix:** Disable the attune button when at the limit and the item is not already attuned:
```tsx
<Button
  ...
  disabled={!item.isAttuned && attunemntCount >= 3}
  onClick={() => toggleAttunedMutation.mutate(item.id)}
>
```

---

### WR-04: `XP_THRESHOLDS` index is off-by-one for level 20 characters — shows wrong next-level XP

**File:** `src/renderer/src/components/sheet/SheetHeader.tsx:60`

**Issue:**
```ts
const nextLevelXp = XP_THRESHOLDS[currentLevel] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1]
```
`XP_THRESHOLDS` has 20 entries (indices 0–19), where index `n` is the XP required to reach level `n+1`. For a level 20 character (`currentLevel = 20`), `XP_THRESHOLDS[20]` is `undefined`. The nullish coalescing fallback then resolves to `XP_THRESHOLDS[19]` = 355000, which is the XP required to _reach_ level 20 — displaying it as the target for a character who is already level 20 is incorrect. Level 20 is the max level; the display should indicate "Max Level" rather than a meaningless XP target.

**Fix:**
```tsx
const nextLevelXp = currentLevel >= 20
  ? null
  : XP_THRESHOLDS[currentLevel]

// In JSX:
{nextLevelXp !== null
  ? `XP: ${character.xp} / ${nextLevelXp}`
  : `XP: ${character.xp} (Max Level)`}
```

---

### WR-05: `StepAbilityScores` override `Input` uses `defaultValue` instead of `value` — input becomes uncontrolled after first render

**File:** `src/renderer/src/components/wizard/StepAbilityScores.tsx:193`

**Issue:**
```tsx
<Input
  type="number"
  defaultValue={score ?? ''}
  onChange={(e) => handleOverrideInput(ability, e.target.value)}
  ...
/>
```
`defaultValue` makes this an uncontrolled input in React. When the user toggles the override off and back on for the same ability, the `score` will have been reset to `null` by `toggleOverride`, but because the input is uncontrolled, it will retain whatever value the user last typed — it does not reset to empty. This creates a desync between the displayed value and `wizardState.abilityScores[ability]` (which is `null`). The user sees a number in the field but the wizard state has `null`, and the "Assign all 6 scores" counter shows it as unassigned.

**Fix:** Use `value` with local state to make it a controlled input:
```tsx
const [overrideInputValues, setOverrideInputValues] = useState<Partial<Record<AbilityName, string>>>({})

// In toggleOverride, clear the override input value:
setOverrideInputValues((prev) => ({ ...prev, [ability]: '' }))

// In Input:
<Input
  type="number"
  value={overrideInputValues[ability] ?? ''}
  onChange={(e) => {
    setOverrideInputValues((prev) => ({ ...prev, [ability]: e.target.value }))
    handleOverrideInput(ability, e.target.value)
  }}
/>
```

---

### WR-06: `getAvailableValues` in `StepAbilityScores` allows duplicate standard-array assignment

**File:** `src/renderer/src/components/wizard/StepAbilityScores.tsx:45-50`

**Issue:**
```ts
function getAvailableValues(ability: AbilityName): number[] {
  const assigned = getAssignedValues(ability)
  return STANDARD_ARRAY.filter(
    (v) => !assigned.includes(v) || v === scores[ability],
  )
}
```
`STANDARD_ARRAY` is `[15, 14, 13, 12, 10, 8] as const`. All values are unique, so normally each value can only be assigned once. However, `getAssignedValues` filters out abilities in override mode (`!overrides[a]`). If ability A is in override mode with a value of 15, and the user assigns 15 from the dropdown to ability B, the standard array tracks that assignment. But if ability A is later toggled out of override mode, its dropdown will show 15 as available (since it wasn't in the assigned-values list while overridden). The user can then also select 15 for ability A, resulting in the same value appearing "assigned" to two non-override abilities. The `assignedCount` counter only counts non-null scores, so 6 scores can appear assigned even though two share the same standard-array value.

**Fix:** The filter in `getAvailableValues` should also account for override-mode values when checking uniqueness, or the validation in `isCurrentStepValid` should verify that non-override scores form a permutation of the standard array.

---

### WR-07: `CurrencySection` optimistic update reads from `prev.resources[denomination]` but the server delta may fail silently

**File:** `src/renderer/src/components/sheet/CurrencySection.tsx:32-38`

**Issue:** The optimistic update clamps to `Math.max(0, prev.resources[denomination] + delta)` client-side. However, the Stepper's `min={0}` prop already prevents the user from decrementing below 0 (the `-` button is disabled when `value <= min`). If the server-side handler applies a different clamping rule or errors on underflow, the rollback restores the original value correctly. The issue is that `delta` arrives from `Stepper.onChange` as either `+step` or `-step` (always 1), but nothing prevents calling `currencyMutation.mutate` while a previous mutation for the same denomination is still inflight. If two mutations fire concurrently, the `onMutate` context for the second captures the already-optimistically-updated cache from the first, so both mutations race. The error rollback only restores the snapshot captured at the time of _that_ mutation, potentially clobbering the successful first mutation's result if the second fails.

This is the same pattern as WR-02. Fix is the same: disable the Stepper while any currency mutation is pending, or serialize mutations.

---

### WR-08: `TraitsSection` uses `max-h-[9999px]` for expand animation — causes layout flash on slow renders

**File:** `src/renderer/src/components/sheet/TraitsSection.tsx:38-41`

**Issue:**
```tsx
className={cn(
  'overflow-hidden transition-all duration-200',
  collapsed ? 'max-h-0' : 'max-h-[9999px]',
)}
```
The CSS `transition-all` on `max-height` from `0` to `9999px` means the transition always animates across the full 9999px range, regardless of actual content height. On slow devices, this produces a visible "snap" or flash as the element expands quickly to its true height but the transition calculation is based on the full 9999px. This is a well-known CSS hack that creates jarring UI. It is not a crash, but it degrades perceived quality in a way that is reproducible.

**Fix:** Use a JS-measured height or a `grid-template-rows` approach:
```tsx
// Use grid trick (no JS required):
className={cn(
  'grid transition-all duration-200',
  collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
)}
// Wrap inner content in a div with overflow-hidden
```

---

### WR-09: `SaveDebounceRef` in `CampaignViewScreen` leaks its timeout on unmount

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:16, 54-67`

**Issue:** `saveDebounceRef` holds a `setTimeout` handle set in `handleLayout`. The component does not clear this timeout in a `useEffect` cleanup. If the user navigates away from the campaign view while resizing panels (within the 500ms debounce window), the timeout fires after the component unmounts and calls `store.save(id, ...)`. While this is unlikely to crash (the store persists across renders), it is a memory-safety and correctness issue: the save fires with stale `id` and `sizes`, potentially overwriting valid panel sizes for a different campaign if the user navigated to another campaign quickly.

**Fix:**
```tsx
useEffect(() => {
  return () => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
  }
}, [])
```

---

## Info

### IN-01: Typo in variable name `attunemntCount`

**File:** `src/renderer/src/components/sheet/EquipmentSection.tsx:17`

**Issue:** `const attunemntCount = ...` — should be `attunementCount`. The typo is benign but will confuse future readers.

**Fix:** Rename to `attunementCount`.

---

### IN-02: Duplicated armor AC lookup block — two copies must stay in sync manually

**File:** `src/renderer/src/components/CreateCharacterWizard.tsx:228-257` and `src/renderer/src/components/wizard/StepReview.tsx:54-80`

**Issue:** The armor-item detection and AC lookup logic is copied verbatim between the wizard's `handleConfirm` and `StepReview`. This is the source of CR-02 (the fix must be applied in both places). The duplication means any future armor type addition requires two synchronized changes.

**Fix:** Extract to a shared helper:
```ts
// In sheetHelpers.ts or a new wizardHelpers.ts:
export function getArmorBaseAc(items: { name: string }[]): number | undefined {
  const armorItem = items.find((item) => { ... })
  if (!armorItem) return undefined
  const n = armorItem.name.toLowerCase()
  if (n.includes('half plate')) return 15
  // ... etc
}
```

---

### IN-03: `isStep2Valid` exported from `StepAbilityScores.tsx` is dead code

**File:** `src/renderer/src/components/wizard/StepAbilityScores.tsx:323-328`

**Issue:** `export function isStep2Valid` is defined alongside similar `isStep0Valid`, `isStep1Valid`, `isStep3Valid`, `isStep4Valid` in their respective step files. However, `CreateCharacterWizard` implements its own inline `isCurrentStepValid()` switch and does not import any of these exported helpers. All five `isStepNValid` functions are dead exports.

**Fix:** Either delete these exports, or refactor `CreateCharacterWizard` to import and compose them. The duplication creates a risk of the inline switch diverging from the per-step validators.

---

### IN-04: `WizardState.step` field is never read or updated — dead field in the type

**File:** `src/renderer/src/components/wizard/wizardTypes.ts:8` and `src/renderer/src/components/CreateCharacterWizard.tsx:52-54`

**Issue:** `WizardState` declares `step: number` (line 8) and `initialWizardState` initializes it to `0`. The wizard uses a separate `const [step, setStep] = useState(0)` (line 52 of `CreateCharacterWizard.tsx`) and never reads or writes `wizardState.step`. The field is set in `initialWizardState` but is otherwise dead.

**Fix:** Remove `step` from `WizardState` and `initialWizardState`.

---

### IN-05: `StepReview` defines a local `ordinal` function that duplicates `sheetHelpers.ordinal`

**File:** `src/renderer/src/components/wizard/StepReview.tsx:124-128`

**Issue:**
```ts
function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0])
}
```
`sheetHelpers.ts` already exports an `ordinal` function (lines 7-20). The one in `StepReview` uses a different algorithm (modular suffix table) that also has a subtle bug: for `n = 11`, `v = 11`, `suffixes[11]` is `undefined`, falls through to `suffixes[0]` = `'th'`, giving `'11th'` — correct. For `n = 21`, `v = 21`, `(v - 20) % 10 = 1`, gives `suffixes[1]` = `'st'` → `'21st'` — correct. However for `n = 12`, `v = 12`, `(v - 20) % 10 = -8`, JavaScript `%` is remainder not modulo, so `-8 % 10 = -8` in JS. `suffixes[-8]` is `undefined`, falls to `suffixes[12]` = `undefined`, falls to `suffixes[0]` = `'th'` → `'12th'` — accidentally correct, but the path is fragile.

**Fix:** Import and use `ordinal` from `sheetHelpers`:
```ts
import { ordinal } from '../../../components/sheet/sheetHelpers'
```
Delete the local copy.

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
