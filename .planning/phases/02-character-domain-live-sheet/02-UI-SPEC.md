---
phase: 2
slug: character-domain-live-sheet
status: draft
shadcn_initialized: true
preset: custom-subtle-fantasy-dark
created: 2026-05-24
revised: 2026-05-25
---

# Phase 2: Character Domain & Live Sheet — UI-SPEC

**Author:** UI Research Agent
**Date:** 2026-05-24
**Revised:** 2026-05-25 (typography collapsed to 4 sizes / 2 weights; ConditionBadge spacing fixed to 4px; color 60/30/10 confirmation added; wizard nav button context note added)
**Depends on:** `02-CONTEXT.md`, `02-RESEARCH.md`, user answers to 4 open questions (recorded below)

---

## Resolved Open Questions

| # | Question | Answer |
|---|----------|--------|
| Q1 | Wizard dialog width | **720px** — two-column: 200px selector list + 460px stat block preview |
| Q2 | Ability score assignment UX | **Dropdown per stat** — each ability has a dropdown showing remaining unassigned values |
| Q3 | Wizard step progress indicator | **Numbered step dots** — row of 6 numbered circles at top, filled/gold when complete, clickable to jump back (not forward) |
| Q4 | Character sheet density | **Comfortable** — 16px (md) gap between sections; section headers at Heading size (20px / font-weight 600) |

---

## 1. Design System

### 1.1 Inherited from Phase 1

Phase 2 extends the "subtle fantasy dark" theme established in Phase 1 without modifying the shared token set. The following are already available and must be used as-is.

**Color split inherited from Phase 1:** 60% `--color-background` (dark base surfaces), 30% `--color-surface` / borders / `--color-muted` (cards, panels, dividers), 10% `--color-accent-gold` (active states, filled dots, gold accents). This split is preserved in Phase 2 — the character sheet and wizard add no new dominant color roles.

| Token / Component | Source | Role in Phase 2 |
|-------------------|--------|-----------------|
| `--color-background` (dark base) | Phase 1 Tailwind theme | Sheet background, wizard backdrop |
| `--color-surface` (card/panel) | Phase 1 | Wizard dialog surface, section card backgrounds |
| `--color-accent-gold` (amber/gold) | Phase 1 | Step dots (filled), active badges, stepper buttons |
| `--color-muted` | Phase 1 | Inactive condition badges, read-only field text |
| `--color-destructive` | Phase 1 | Failure death saves, validation error messages |
| `Button` (shadcn/ui) | Phase 1 `src/renderer/src/components/ui/button.tsx` | Wizard nav, stepper +/- |
| `Dialog` (shadcn/ui) | Phase 1 `src/renderer/src/components/ui/dialog.tsx` | Wizard outer modal |
| `Input` (shadcn/ui) | Phase 1 `src/renderer/src/components/ui/input.tsx` | Name field, backstory textarea, manual score override |
| `Label` (shadcn/ui) | Phase 1 `src/renderer/src/components/ui/label.tsx` | All form labels in wizard |
| `Tabs` (shadcn/ui) | Phase 1 `src/renderer/src/components/ui/tabs.tsx` | Right panel tabs (already wired) |
| `Select` (shadcn/ui) | Phase 1 (if present) or add via shadcn CLI | Ability score dropdown pickers |

If `Select` is not yet in `src/renderer/src/components/ui/`, add it with `npx shadcn@latest add select` before the wizard implementation wave.

### 1.2 New Design Roles Introduced in Phase 2

| Role | Token / Class | Usage |
|------|--------------|-------|
| **Live-play accent** | `--color-accent-gold` (filled dot, gold border) | HP stepper, active conditions, filled spell slot pips |
| **Danger / depleted** | `--color-destructive` | Failure death saves, 0 HP visual cue |
| **Muted / read-only** | `text-muted-foreground` | Static fields (race, class, traits text, proficiency list) |
| **Section separator** | `border border-border` | Between sheet sections (1px rule or `gap-4` spacing) |
| **Warning condition** | amber-600 (inline, not a token — use `text-amber-600 border-amber-600`) | Active non-lethal conditions (Poisoned, Prone, etc.) |
| **Critical condition** | red-600 (inline) | Active deadly conditions (Paralyzed, Petrified, Unconscious-equivalent Incapacitated) |

### 1.3 Typography Scale

> **Revision 2026-05-25:** Scale collapsed from 6 sizes / 3 weights to 4 sizes / 2 weights to comply with the design contract limit. Consolidations: 12px (text-xs) condition badge text merged up to 14px (text-sm); 24px (text-2xl) ability score numerals merged up to the 36px (text-4xl) display tier. Bold (font-weight 700) eliminated; all instances replaced with semibold (font-weight 600). The visual distinction between 600 and 700 at large display sizes is imperceptible and does not justify a third weight tier.

**Permitted sizes (exactly 4):**

| Use | Tailwind class | Size | Note |
|-----|----------------|------|------|
| Section header | `text-xl font-semibold` | 20px / 600 | Phase 1 Heading role |
| Field label / body small | `text-sm font-semibold` or `text-sm` | 14px / 600 or 400 | Phase 1 Label + Body roles; badge text also uses this size |
| Field value / stepper value | `text-base` or `text-base font-semibold` | 16px / 400 or 600 | Readable form values, stepper display |
| Combat / ability display | `text-4xl font-semibold` | 36px / 600 | Prominent AC, Initiative, Speed, and ability score numerals |

**Permitted weights (exactly 2):**

| Weight | Tailwind | Use |
|--------|----------|-----|
| Regular | `font-normal` (or no weight class) | Body text, descriptions, read-only values, muted labels |
| Semibold | `font-semibold` | Section headers, field labels, badge text, stepper values, display numbers |

**Consolidation mapping for executor:**

| Old class in earlier drafts | Replacement |
|-----------------------------|-------------|
| `text-xs font-semibold` (condition badge text) | `text-sm font-semibold` |
| `text-2xl font-bold` (ability score number) | `text-4xl font-semibold` |
| `text-xl font-bold` (HP stepper lg value) | `text-xl font-semibold` |
| `text-4xl font-bold` (AC/Initiative/Speed) | `text-4xl font-semibold` |
| any `font-bold` | `font-semibold` |

**Line heights:**
- Body / label (`text-sm`, `text-base`): `leading-normal` (1.5)
- Display (`text-xl`, `text-4xl`): `leading-tight` (1.2)

### 1.4 Spacing Cadence

All spacing values are multiples of 4px (8-point scale).

| Context | Gap | Tailwind |
|---------|-----|----------|
| Between sheet sections | 16px | `gap-4` or `mb-4` |
| Within a section (field rows) | 8px | `gap-2` |
| Wizard step content padding | 24px | `p-6` |
| Wizard dialog padding (sides) | 24px | built into `DialogContent` |
| Stepper button to value | 4px | `gap-1` |

---

## 2. New Components

All new components live under `src/renderer/src/components/`. Each is described with its props contract, visual design, and states.

### 2.1 `WizardProgress`

**File:** `src/renderer/src/components/wizard/WizardProgress.tsx`

**Purpose:** Numbered step dots displayed at the top of the wizard dialog, indicating current step and allowing backward navigation.

**Props:**
```typescript
interface WizardProgressProps {
  totalSteps: number       // 6
  currentStep: number      // 0-based index
  completedUpTo: number    // highest 0-based step index that is fully valid
  stepLabels: string[]     // ['Race', 'Class', 'Ability Scores', 'Background', 'Equipment', 'Review']
  onStepClick: (step: number) => void  // only fires for step <= completedUpTo
}
```

**Visual Design:**
- Row of 6 circles, centered horizontally, connected by a thin line (`border-t border-border`)
- Circle size: 32px × 32px, `rounded-full`
- States:
  - **Future (step > currentStep and step > completedUpTo):** `bg-surface border border-border text-muted-foreground` — gray outline, number inside, not clickable (`cursor-not-allowed opacity-50`)
  - **Completed (step <= completedUpTo and step !== currentStep):** `bg-accent-gold text-background border border-accent-gold` — filled gold circle, number in dark text, clickable (`cursor-pointer hover:opacity-80`)
  - **Active (step === currentStep):** `bg-accent-gold/20 border-2 border-accent-gold text-accent-gold font-semibold` — gold ring with transparent fill, gold number, not clickable
- Step label appears below each circle in `text-sm text-muted-foreground`; active label uses `text-accent-gold font-semibold`
- Total width: fits within the 720px dialog header

**Behavior:**
- Clicking a completed dot calls `onStepClick(step)` — navigates backward without clearing data
- Clicking the active dot: no-op
- Clicking a future dot: no-op (visually disabled)
- `completedUpTo` increments each time the active step passes validation and the user clicks Next

---

### 2.2 `Stepper`

**File:** `src/renderer/src/components/sheet/Stepper.tsx`

**Purpose:** Reusable +/- control for live-play resources (HP, currency, spell slots). Zero-debounce — fires on every press.

**Props:**
```typescript
interface StepperProps {
  value: number
  min?: number           // default 0
  max?: number           // default Infinity
  onChange: (delta: number) => void   // delta-based: +1 or -1 (or custom step)
  step?: number          // default 1
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'  // sm = HP in tight layout, md = currency, lg = primary HP stepper
  label?: string         // accessible aria-label for the control group
}
```

**Visual Design by size:**

| Size | Button dimensions | Value text | Use |
|------|-------------------|------------|-----|
| `sm` | 20×20px icon button | `text-sm` | Spell slot pips row |
| `md` | 28×28px | `text-base font-semibold` | Currency, temp HP |
| `lg` | 36×36px | `text-xl font-semibold` | Primary HP stepper |

- Buttons: `Button` variant `outline` with a minus (`−`) and plus (`+`) label
- Layout: `[ − ] [ value ] [ + ]` in a row with `gap-1`
- Minus button disabled when `value === min`; Plus button disabled when `value === max`
- Disabled state: `opacity-40 cursor-not-allowed`
- Focus ring: standard shadcn/ui ring on tab-focus
- `aria-label` on the wrapping `<div role="group">` uses the `label` prop

**States:**
- **Normal:** outlined buttons, value centered
- **At min:** minus button `disabled`
- **At max:** plus button `disabled`
- **Disabled:** entire group `opacity-40 pointer-events-none`

---

### 2.3 `ProficiencyDot`

**File:** `src/renderer/src/components/sheet/ProficiencyDot.tsx`

**Purpose:** Visual indicator for skill and saving throw proficiency / expertise.

**Props:**
```typescript
interface ProficiencyDotProps {
  state: 'none' | 'proficient' | 'expertise'
  size?: number   // diameter in px, default 10
}
```

**Visual Design:**
- `none`: empty circle, `border border-muted-foreground rounded-full`
- `proficient`: filled circle, `bg-accent-gold rounded-full` (solid gold)
- `expertise`: filled circle with inner dot, `bg-accent-gold rounded-full ring-1 ring-background` (double ring effect via outline)
- No label text — purely visual; tooltip on hover shows "Proficient" / "Expertise" / "Not proficient"

---

### 2.4 `ConditionBadge`

**File:** `src/renderer/src/components/sheet/ConditionBadge.tsx`

**Purpose:** Toggleable pill badge for each of the 14 standard D&D 5e conditions.

**Props:**
```typescript
interface ConditionBadgeProps {
  condition: ConditionName   // typed union of all 14 condition strings
  active: boolean
  onToggle: () => void
}

type ConditionName =
  | 'blinded' | 'charmed' | 'deafened' | 'exhaustion'
  | 'frightened' | 'grappled' | 'incapacitated' | 'invisible'
  | 'paralyzed' | 'petrified' | 'poisoned' | 'prone'
  | 'restrained' | 'stunned'
```

**Visual Design:**
- Shape: `rounded-full px-2 py-1 text-sm font-semibold border cursor-pointer select-none`
  - Note: `py-1` (4px) — the minimum vertical padding on this pill. `py-0.5` (2px) is not permitted (not a multiple of 4).
- **Inactive:** `bg-surface border-border text-muted-foreground hover:border-muted-foreground`
- **Active (warning conditions** — Blinded, Charmed, Deafened, Frightened, Grappled, Invisible, Prone, Restrained): `bg-amber-950/60 border-amber-600 text-amber-400`
- **Active (severe conditions** — Exhaustion, Incapacitated, Paralyzed, Petrified, Poisoned, Stunned): `bg-red-950/60 border-red-600 text-red-400`
- Label: condition name in Title Case (e.g., "Poisoned")
- Hover on inactive: faint border brightens
- Focus ring on keyboard navigation

**Behavior:**
- Click/press Enter/Space toggles condition
- Each toggle fires `onToggle` which triggers the zero-debounce mutation

---

### 2.5 `SpellSlotPips`

**File:** `src/renderer/src/components/sheet/SpellSlotPips.tsx`

**Purpose:** Visual representation of spell slot used/max for a single slot level. Companion to the `Stepper` for spell slots.

**Props:**
```typescript
interface SpellSlotPipsProps {
  slotLevel: number      // 1–9
  used: number
  max: number
  onUse: () => void      // mark one slot used (increment used)
  onRecover: () => void  // recover one slot (decrement used) — for manual correction
}
```

**Visual Design:**
- Row of `max` pip circles, left to right
- **Available pip:** `bg-accent-gold/80 rounded-full w-4 h-4 border border-accent-gold`
- **Expended pip:** `bg-surface rounded-full w-4 h-4 border border-border`
- Pips are rendered right-to-left as "expended" — the rightmost `used` pips are shown as empty
- Clicking an available pip calls `onUse`; clicking an expended pip calls `onRecover`
- When all pips are expended, the row has `opacity-60`
- Label to left: `text-sm text-muted-foreground` showing slot level ordinal ("1st", "2nd", etc.)

---

### 2.6 `PortraitSlot`

**File:** `src/renderer/src/components/sheet/PortraitSlot.tsx`

**Purpose:** 80×80px portrait thumbnail in the character sheet header. Clickable to import an image.

**Props:**
```typescript
interface PortraitSlotProps {
  dataUrl: string | null    // base64 data URL from tRPC query, or null if no portrait
  characterName: string     // used for alt text
  onImportClick: () => void // triggers portrait import mutation
  isLoading?: boolean       // true while import mutation is in-flight
}
```

**Visual Design:**
- Container: `w-20 h-20 rounded-lg overflow-hidden border-2 border-border relative cursor-pointer group`
- **With portrait:** `<img>` fills container, `object-cover`
- **Without portrait (fallback):** centered SVG silhouette icon (`User` from lucide-react), `text-muted-foreground bg-surface/50`
- **Hover overlay:** semi-transparent dark overlay (`bg-black/50`) + camera icon centered, appears on `group-hover`
- **Loading state:** spinner overlay on top of existing image (or fallback)
- `aria-label="Import character portrait"`
- `role="button"` and `tabIndex={0}` for keyboard access

---

## 3. Character Creation Wizard Spec

### 3.1 Wizard Container

**Component:** `src/renderer/src/components/CreateCharacterWizard.tsx`

**Outer wrapper:** shadcn/ui `Dialog` with `DialogContent`

**Dialog dimensions:** `max-w-[720px] w-full h-auto max-h-[90vh] overflow-hidden flex flex-col`

**Layout structure (top to bottom):**
```
┌─────────────────────────────────────────────────────┐
│  DialogHeader: Title + WizardProgress               │  ~80px
├─────────────────────────────────────────────────────┤
│  Two-column step body:                              │
│  ┌────────────────┬──────────────────────────────┐  │
│  │ Selector list  │  Stat block preview           │  │
│  │ (200px, scroll)│  (460px, scroll)              │  │  flex-1, overflow-y-auto
│  └────────────────┴──────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  DialogFooter: Back / Next / Confirm buttons        │  ~60px
└─────────────────────────────────────────────────────┘
```

The two-column layout applies to steps 1–5 (Race, Class, Ability Scores, Background, Equipment). Step 6 (Review) uses a single full-width column.

**Steps 1–5 layout detail:**
- Left column (200px): scrollable list of options; selected item is highlighted
- Right column (460px): scrollable stat block of the currently hovered or selected option
- `border-r border-border` separates columns
- Both columns scroll independently; their shared height is `flex-1 overflow-hidden`

**Auto-launch behavior (D-04):** When `characterData === null`, the Dialog `open` prop is `true` and `onOpenChange` is a no-op (cannot close by clicking backdrop or pressing Escape). The only exit is "Cancel Character Creation" (see footer below) which navigates back to the campaign list.

---

### 3.2 Step 1 — Race

**Left column:** Scrollable list of all species/races from `races.json`

**List item anatomy:**
```
┌──────────────────────────┐
│  [Icon or color swatch]  │
│  Human                   │  text-base font-semibold
│  Medium · 30ft           │  text-sm text-muted-foreground
└──────────────────────────┘
```
- Selected state: `bg-accent-gold/10 border-l-2 border-accent-gold`
- Hover state: `bg-surface/60`
- Groups with subraces: parent race acts as a non-selectable header (`text-sm uppercase text-muted-foreground font-semibold px-2 pt-3`) with sub-entries indented `pl-3`

**Right column (stat block):** Renders when any list item is hovered or selected
- **Header:** Species name (`text-xl font-semibold`) + source tag (`text-sm text-muted-foreground`)
- **Stat line:** Size · Speed · Vision (darkvision range if any)
- **ASI bonuses:** `+2 STR, +1 CON` format
- **Languages:** auto-granted list + free-choice count if any
- **Traits:** each as `<h4>Trait Name</h4><p>description</p>` blocks, full text

**Name & Backstory fields (collected in Step 1, D-13):**
Rendered ABOVE the two-column area, inside the step body, spanning full width:
```
Character Name *               [____________________________]
Backstory (optional)           [____________________________]
                               [____________________________]  (textarea, 3 rows)
```
- Name: `Input` component, `placeholder="Enter your character's name"`
- Backstory: `Textarea`, `placeholder="Add an optional backstory…"`, `rows={3}`
- Both fields float above the selector columns with a `pb-4 mb-4 border-b border-border` separator

**Validation (blocks Next):**
- `characterName.trim().length >= 1` AND
- `selectedRace !== null`

**Validation messages:**
- Name empty: `"Character name is required."` shown as `text-sm text-destructive` below the name field
- No race selected: Next button tooltip (on hover): `"Select a species to continue."`

---

### 3.3 Step 2 — Class

**Left column:** All classes from `classes.json`, single-level flat list (no groups)

**List item anatomy:**
```
┌────────────────────────┐
│  Fighter               │  text-base font-semibold
│  d10 · STR or DEX     │  text-sm text-muted-foreground
└────────────────────────┘
```

**Right column (stat block):**
- Class name + source
- **Hit Die:** `d{n}` displayed prominently
- **Primary Ability:** comma-separated
- **Saving Throw Proficiencies:** two abilities (auto-applied, read-only info)
- **Armor / Weapon Proficiencies:** comma-separated
- **Skill Choices:** "Choose {n} from: Athletics, Acrobatics, …" (listed)
- **Starting Equipment Packages:** listed as read-only preview (full selection happens in Step 5)
- **Level 1 Features:** each as `<h4>Feature</h4><p>description</p>` blocks

**Subclass picker (D-09 — Cleric, Sorcerer, Warlock only):**
When a class with `choosesSubclassAtLevel1 === true` is selected, a subclass picker appears below the class list in the left column:
```
Subclass
[─────────────────────────]  ← shadcn Select dropdown
```
- Label: "Divine Domain" (Cleric) / "Sorcerous Origin" (Sorcerer) / "Otherworldly Patron" (Warlock)
- Selecting a subclass updates the right column to show the subclass features below the class features
- Subclass selection is required if the class has `choosesSubclassAtLevel1 === true`

**Validation (blocks Next):**
- `selectedClass !== null` AND
- if `selectedClass.choosesSubclassAtLevel1 === true`: `selectedSubclass !== null`

**Validation messages:**
- No class selected: Next tooltip: `"Select a class to continue."`
- Subclass required but not chosen: Next tooltip: `"Select a {subclassLabel} to continue."`

---

### 3.4 Step 3 — Ability Scores

**Layout:** Full two-column area used differently here — no selector/preview split. Instead:
- Left (200px): Static array values display + assignment status summary
- Right (460px): Six ability score rows with dropdowns + proficiency selections

**Left column — Array Display:**
```
Standard Array
──────────────
  15  ← assigned to STR
  14  ← assigned to WIS
  13  unassigned
  12  unassigned
  10  unassigned
   8  unassigned
```
- Values styled as pills: `text-sm font-semibold bg-surface px-2 py-1 rounded`
- Assigned values show a faint check + the stat abbreviation they're assigned to
- Unassigned values are white/normal
- Summary line at bottom: `"3 of 6 assigned"` in `text-sm text-muted-foreground`

**Right column — Assignment & Proficiency:**

Six rows, one per ability (STR / DEX / CON / INT / WIS / CHA):
```
STR  [Dropdown ▾]  Modifier: +2   [Saving Throw checkbox]
DEX  [Dropdown ▾]  Modifier: +1   [Saving Throw checkbox]
CON  [Dropdown ▾]  Modifier: 0    [Saving Throw checkbox]
INT  [Dropdown ▾]  Modifier: -1   [Saving Throw checkbox]
WIS  [Dropdown ▾]  Modifier: +2   [Saving Throw checkbox]
CHA  [Dropdown ▾]  Modifier: 0    [Saving Throw checkbox]
```
- **Dropdown (Q2 answer):** shadcn/ui `Select` showing only the remaining unassigned standard array values + the currently assigned value for this stat. Options are: `["—", 8, 10, 12, 13, 14, 15]` filtered to show only available ones (plus the currently assigned value).
  - Placeholder when nothing selected: `"— Choose —"`
  - Each option shows the value: `"15"`, `"14"`, etc.
- **Modifier:** derived in real-time: `Math.floor((score - 10) / 2)`, shown as `+2` or `-1`; updates as dropdown changes
- **Manual override:** Below the dropdown row, a small `[Override]` button opens an `Input` in place of the dropdown for that stat. Placeholder: `"Enter score 1–30"`. Override clears the standard array assignment for that stat and shows the manual value. The override is validated as `z.number().int().min(1).max(30)`.
  - Override label: `"Override"` link-style button (`text-sm text-muted-foreground underline cursor-pointer`)
  - Cancelling override: `[Clear override]` link restores the dropdown

**Saving throw proficiency checkboxes:**
- Header label (right column top): `"Saving Throw Proficiencies"` in `text-base font-semibold`
- Pre-checked based on class (auto-check the class's fixed saves, visually distinguish): class-granted saves show as `checked + bg-accent-gold/20` and are read-only — player cannot uncheck class saves
- For classes that grant saving throw choices (if any — rare in PHB 2024), unchecked checkboxes are interactive

**Skill proficiency picker:**
Below the ability score rows (still in right column), a separate section:
```
Skill Proficiencies                    Choose 2 of 6
──────────────────────────────────────────────────
[ ] Athletics                         (STR)
[ ] Acrobatics                        (DEX)
[ ] Sleight of Hand                   (DEX)
[ ] Intimidation                      (CHA)
[ ] Perception                        (WIS)
[ ] Survival                          (WIS)
```
- Shows only the class-eligible skill pool
- Count badge: `"0 / 2 selected"` — updates as player checks boxes
- Checked when at limit: remaining unchecked options become `opacity-40 pointer-events-none`
- Background-granted skills are listed separately as `"Auto-granted: Insight, Perception"` in `text-sm text-muted-foreground` below the picker

**Validation (blocks Next):**
- All 6 ability scores must be assigned (either from array or manual override)
- Skill proficiency selections == class required count

**Validation messages:**
- Unassigned scores: `"Assign all 6 ability scores to continue."`
- Insufficient skills: `"Select {remaining} more skill proficiency to continue."` (pluralized)

---

### 3.5 Step 4 — Background

**Left column:** Scrollable list of all backgrounds from `backgrounds.json`

**List item anatomy:**
```
Acolyte          text-base font-semibold
Insight, Religion  text-sm text-muted-foreground (skill grants)
```

**Right column (stat block):**
- Background name + source
- **Skill Proficiencies:** `Auto-granted: Insight, Religion`
- **Tool Proficiencies:** `Auto-granted: Calligrapher's Supplies` (or "None")
- **Languages:** auto-granted + free-choice count
- **Background Feature:** `<h4>Feature Name</h4><p>full description</p>`
- **Suggested Personality Traits / Ideals / Bonds / Flaws:** shown as read-only example text in muted style

**Language picker (appears when `freeLanguageChoices > 0`):**
Below the stat block in the right column:
```
Choose 1 Language
[─────────────────────────]  ← shadcn Select, options from a fixed language list
```
- Options: Common, Dwarvish, Elvish, Giant, Gnomish, Goblin, Halfling, Orc, Abyssal, Celestial, Deep Speech, Draconic, Infernal, Primordial, Sylvan, Undercommon
- Required if `freeLanguageChoices > 0`

**Optional role-play fields (below the two-column area, spanning full width):**
```
Personality Trait (optional)   [____________________________]
Ideal (optional)               [____________________________]
Bond (optional)                [____________________________]
Flaw (optional)                [____________________________]
```
- All `Input` components, `placeholder="Write your own or use the suggestion above…"`
- These are stored in `characters.backstory` as a structured note; no mechanical effect in Phase 2

**Validation (blocks Next):**
- `selectedBackground !== null` AND
- if `freeLanguageChoices > 0`: `selectedLanguage !== null`

**Validation messages:**
- No background: Next tooltip: `"Select a background to continue."`
- Language required: `"Choose a language to continue."`

---

### 3.6 Step 5 — Equipment

**Layout:** Two-column (200px / 460px) like steps 1–4

**Left column:** 2–3 package options for the selected class
```
Option A
Chain mail, shield, martial weapon
────────────────────────────────
Option B
Leather armor, longbow, quiver
```
- Each option is a selectable card: `border rounded-lg p-4 cursor-pointer`
- Selected: `border-accent-gold bg-accent-gold/10`
- Unselected: `border-border hover:border-muted-foreground`

**Right column:** Full item list for the highlighted/selected package
```
Package A: Chain Mail & Shield
──────────────────────────────
Chain Mail          1    55 lb
Shield              1    6 lb
Longsword           1    3 lb
5 Javelins          5    2 lb ea.

Starting Gold: 0 gp
```
- Table layout: `Name | Qty | Weight`
- Items listed as `text-sm`, header as `text-base font-semibold`
- Starting gold row if `> 0 gp`

**Validation (blocks Next):**
- `selectedEquipmentPackage !== null`

**Validation message:**
- Next tooltip: `"Choose an equipment package to continue."`

---

### 3.7 Step 6 — Review / Summary

**Layout:** Single full-width column (no two-column split). Scrollable.

**Content blocks:**

```
Character Name: Thalion Brightwood          [edit name inline?  no — go back to Step 1]

IDENTITY
────────────────────────────────────────────
Race         High Elf
Class        Fighter
Background   Soldier
Level        1

ABILITY SCORES
────────────────────────────────────────────
STR 13 (+1)   DEX 15 (+2)   CON 14 (+2)
INT 12 (+1)   WIS 10 (+0)   CHA 8 (-1)

Saving Throws  STR, CON (class)
Skills         Athletics, Perception

COMBAT
────────────────────────────────────────────
HP      13         (d10 + CON +2 + 1 racial)
AC      14         (Chain mail 13 + DEX cap 1)
Speed   35 ft
Prof.   +2

SPELL SLOTS
────────────────────────────────────────────
(None — Fighter is not a spellcaster.)

EQUIPMENT
────────────────────────────────────────────
Package A: Chain mail, shield, longsword, 5 javelins

LANGUAGES & PROFICIENCIES
────────────────────────────────────────────
Languages      Common, Elvish, Celestial
Armor          Light, Medium, Heavy, Shields
Weapons        Simple, Martial
Tools          None
```

**Visual treatment:**
- Block headers: `text-sm uppercase tracking-widest font-semibold text-muted-foreground mb-1`
- Values: `text-sm`
- Each block separated by `mb-6`
- The entire section is read-only — no editable fields on the Review step

**Auto-calculated preview:**
- HP, AC, spell slots are computed from the wizard state using the same `calcHP` / `calcAC` / `buildSpellSlots` logic as the main process, displayed here so the player sees them before committing

**Footer for Step 6:**
- Back button: `"Back"` (standard)
- Confirm button: `"Create Character"` — variant `default` with gold accent
- Confirmation note below button: `"This creates your character. You can edit stats on the sheet after creation."`
- Loading state while mutation is in-flight: Confirm button shows spinner + `"Creating…"` text, disabled

---

### 3.8 Wizard Footer

**Layout:** `DialogFooter` with left-aligned cancel and right-aligned nav buttons

```
[Cancel Character Creation]          [Back]  [Next →]
                                     (step 1: Back is absent)
                                     (step 6: Next becomes [Create Character])
```

- **Cancel button:** `Button variant="ghost"` — `"Cancel Character Creation"`. On click, a confirmation dialog appears: `"Are you sure? This will return you to the campaign list."` with `[Yes, cancel]` and `[Keep building]` options. Confirms navigate to campaign list (since wizard cannot be dismissed otherwise per D-04).
- **Back button:** `Button variant="outline"` — hidden on Step 1. On click, navigates to previous step without clearing that step's data.
- **Next button:** `Button variant="default"` — disabled when current step is invalid. Shows tooltip on hover when disabled explaining what is needed.
- **Create Character (Step 6 only):** `Button variant="default"` with loading state.

---

## 4. Character Sheet Spec

### 4.1 Sheet Container

**Component:** `src/renderer/src/components/CharacterSheetTab.tsx`

**Layout:** Single scrollable column inside the `TabsContent value="character-sheet"` in `CampaignViewScreen.tsx`. Width fills the right panel. No horizontal scrolling.

```
<div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
  <SheetHeader />
  <AbilityScoresSection />
  <SavingThrowsSection />
  <SkillsSection />
  <CombatStatsSection />
  <ResourcesSection />
  <CurrencySection />
  <EquipmentSection />
  <ProficienciesSection />
  <TraitsSection />
</div>
```

Gap between all sections: `gap-4` (16px). Each section rendered as a `<section>` with a `<h2>` header.

---

### 4.2 Section 1 — Header (`SheetHeader`)

**File:** `src/renderer/src/components/sheet/SheetHeader.tsx`

```
┌───────────────────────────────────────────────────────┐
│  [Portrait 80×80]   Thalion Brightwood               │
│                     High Elf Fighter · Level 1        │
│                     XP: 0 / 300                       │
└───────────────────────────────────────────────────────┘
```

- **Portrait:** `PortraitSlot` component (see §2.6)
- **Name:** `text-4xl font-semibold`
- **Race/Class/Level line:** `text-sm text-muted-foreground`
- **XP:** `text-sm text-muted-foreground` — `"XP: {current} / {nextLevel}"`. Static display only in Phase 2 (not editable; XP-driven level-up is Phase 5)
- Layout: `flex flex-row gap-4 items-start`
- The header section has no section title `<h2>` — it is the visual anchor of the sheet

---

### 4.3 Section 2 — Ability Scores (`AbilityScoresSection`)

**File:** `src/renderer/src/components/sheet/AbilityScoresSection.tsx`

**Section header:** `"Ability Scores"` in `text-xl font-semibold`

**Layout:** 6-cell grid, 3 columns × 2 rows

```
┌───────┐  ┌───────┐  ┌───────┐
│  STR  │  │  DEX  │  │  CON  │
│  13   │  │  15   │  │  14   │
│  +1   │  │  +2   │  │  +2   │
└───────┘  └───────┘  └───────┘
┌───────┐  ┌───────┐  ┌───────┐
│  INT  │  │  WIS  │  │  CHA  │
│  12   │  │  10   │  │   8   │
│  +1   │  │  +0   │  │  -1   │
└───────┘  └───────┘  └───────┘
```

Each cell:
- `border border-border rounded-lg p-2 text-center flex flex-col items-center gap-1`
- Abbreviation: `text-sm font-semibold text-muted-foreground uppercase tracking-wide`
- Score: `text-4xl font-semibold` — **editable** (`Input` component, `type="number"`, `min="1"`, `max="30"`, text-center styled; persists on `onBlur`)
- Modifier: `text-sm text-muted-foreground` — derived, updates reactively

**Editable field interaction:**
- Click on the score number to edit (no separate edit button — the number IS the input, always editable)
- Input styled to blend in: `border-0 bg-transparent text-center text-4xl font-semibold w-full p-0 focus:ring-1 focus:ring-accent-gold`
- Blur triggers the `characters.updateAbilityScore` mutation
- Invalid input (non-integer, out of range): red ring + tooltip `"Enter a number between 1 and 30."`

---

### 4.4 Section 3 — Saving Throws (`SavingThrowsSection`)

**Section header:** `"Saving Throws"`

**Layout:** Compact list, 6 rows

```
● STR  +3  (proficient)
○ DEX  +2  (not proficient)
● CON  +4  (proficient)
○ INT  +1
○ WIS  +0
○ CHA  -1
```

Each row (all read-only display, no editing on this section):
- `ProficiencyDot` (●/○) — 10px
- Ability abbreviation: `text-sm font-semibold w-10`
- Modifier value: `text-sm font-semibold` — calculated from ability score + (proficiency bonus if proficient)
- All fields are **read-only** (static derived values; proficiency set at creation)
- Layout: `flex flex-col gap-2`
- Row: `flex flex-row items-center gap-2`

---

### 4.5 Section 4 — Skills (`SkillsSection`)

**Section header:** `"Skills"`

**Layout:** Compact list, 18 rows + Passive Perception footer

```
● Athletics       STR  +5  (prof)
○ Acrobatics      DEX  +2
○ Sleight of Hand DEX  +2
● Stealth         DEX  +4  (expertise — double dot)
...
──────────────────────────────
  Passive Perception: 12
```

Each row:
- `ProficiencyDot` (10px, supports `expertise` state)
- Skill name: `text-sm w-32`
- Governing ability abbreviation: `text-sm text-muted-foreground w-8`
- Modifier: `text-sm font-semibold`
- All read-only

**Passive Perception:**
- Below the 18 rows with a `border-t border-border mt-2 pt-2`
- Format: `"Passive Perception: {10 + Perception modifier}"`
- `text-sm text-muted-foreground`

---

### 4.6 Section 5 — Combat Stats (`CombatStatsSection`)

**Section header:** `"Combat"`

**Layout:** Three large stat blocks in a row

```
┌──────────────────────────────────────────────────┐
│    AC          Initiative      Speed              │
│    14             +2           35 ft             │
│  Armor Class    DEX mod      Walking             │
└──────────────────────────────────────────────────┘
```

- Layout: `flex flex-row justify-around items-center`
- Each stat: `flex flex-col items-center gap-0`
- Label above number: `text-sm uppercase tracking-widest text-muted-foreground font-semibold`
- **Number:** `text-4xl font-semibold` (36px) — AC and Speed are read-only; displayed as large numerals
- Sub-label below: `text-sm text-muted-foreground` ("Armor Class", "DEX mod", "Walking")
- All three values are **read-only** in Phase 2 (derived from ability scores + equipment)

---

### 4.7 Section 6 — Resources (`ResourcesSection`)

**Section header:** `"Resources"`

**Layout:** Stacked sub-sections

#### HP (Primary — most prominent)

```
Hit Points
──────────
Current HP        Max HP
[ − ]  [ 13 ]  [ + ]     / 21  (stepper, lg size)
[Temp HP: [ − ] [ 0 ] [ + ] sm]
```

- `Stepper` size `lg` for current HP, `min=0`, `max=hpMax`
- Max HP displayed to the right as `text-muted-foreground`: `"/ 21"`
- Temp HP: separate `Stepper` size `sm` below, label `"Temp HP"`, `min=0`
- When `hpCurrent === 0`: current HP number turns `text-destructive font-semibold`
- Persist: immediate on every `+` or `−` press (zero-debounce)

#### Inspiration

```
[★] Inspiration
```
- Single toggle button: `Button variant="outline"` with star icon
- Active state: `bg-accent-gold/20 border-accent-gold text-accent-gold`
- Inactive: standard outline
- Toggle persists immediately

#### Death Saves

```
Death Saves
──────────────────────────────────────
Successes  ☐ ☐ ☐
Failures   ☐ ☐ ☐
```
- Always visible (D-22)
- Three checkboxes each, rendered as `w-5 h-5 rounded border border-border` toggles
- **Success checkboxes:** when checked → `bg-accent-gold border-accent-gold`
- **Failure checkboxes:** when checked → `bg-destructive border-destructive`
- All three in a row with `gap-2`; row label in `text-base font-semibold w-20`
- Each checkbox click fires `characters.updateDeathSaves` mutation (zero-debounce)

#### Spell Slots

```
Spell Slots
──────────────────────────────────────────────────
1st  ○ ○ ●  (2 used of 3 max — rightmost 2 filled, 1 empty)
2nd  ○ ○    (0 used of 2 max — both filled)
```
- Shows only slot levels the character's class has (D-23)
- `SpellSlotPips` component per level
- Label format: ordinal ("1st", "2nd", "3rd", "4th"–"9th")
- If class has no spell slots (Fighter, Rogue, Barbarian, etc.): section displays `"Not a spellcaster — spell slots are tracked here when available."` in `text-sm text-muted-foreground italic`

#### Conditions

```
Conditions
──────────────────────────────────────────────────
[Blinded] [Charmed] [Deafened] [Exhaustion] [Frightened]
[Grappled] [Incapacitated] [Invisible] [Paralyzed] [Petrified]
[Poisoned] [Prone] [Restrained] [Stunned]
```
- 14 `ConditionBadge` components in a `flex flex-wrap gap-1` row
- Active badges styled per §2.4 severity colors
- Each toggle fires `characters.toggleCondition` mutation (zero-debounce)

---

### 4.8 Section 7 — Currency (`CurrencySection`)

**Section header:** `"Currency"`

**Layout:** 5 columns, one per denomination

```
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│  CP  │  │  SP  │  │  EP  │  │  GP  │  │  PP  │
│ [ −] │  │ [ −] │  │ [ −] │  │ [ −] │  │ [ −] │
│   0  │  │   0  │  │   0  │  │  10  │  │   0  │
│ [ +] │  │ [ +] │  │ [ +] │  │ [ +] │  │ [ +] │
└──────┘  └──────┘  └──────┘  └──────┘  └──────┘
Copper  Silver  Electrum  Gold  Platinum
```

Each denomination cell:
- `flex flex-col items-center gap-1`
- Abbreviation: `text-sm font-semibold uppercase text-muted-foreground`
- `Stepper` size `md`, `min=0`
- Full name below: `text-sm text-muted-foreground` (Copper, Silver, Electrum, Gold, Platinum)
- Grid layout: `grid grid-cols-5 gap-2`
- Persist: immediate on every press

---

### 4.9 Section 8 — Equipment (`EquipmentSection`)

**Section header:** `"Equipment"` + attunement count badge: `"1 / 3 Attuned"` in `text-sm text-muted-foreground` to the right of the header

**Layout:** Table with columns: Name · Qty · Weight · Attunement

```
Name               Qty   Weight   Attune
Chain Mail          1    55 lb    —
Shield              1     6 lb    —
+1 Longsword        1     3 lb    [★ Attuned]
Javelin             5     2 lb    —
```

- Table rows: `text-sm`
- **Attunement toggle:** Only shown for items where `isMagic === true`. `Button variant="ghost" size="sm"` with star icon:
  - Attuned: `text-accent-gold` + star-filled icon
  - Not attuned: `text-muted-foreground` + star-outline icon
  - Clicking toggles `characters.toggleItemAttuned` mutation (zero-debounce)
- Attunement count `"1 / 3 Attuned"` updates reactively; no enforcement (D-09 — tracked but not blocked)
- **Quantity column:** display only in Phase 2 (no +/- editing on equipment quantity in Phase 2)
- **Weight column:** display only; `{weight} lb`, `—` if weight is 0
- Non-magic items show `—` in the Attune column (no button)

---

### 4.10 Section 9 — Proficiencies (`ProficienciesSection`)

**Section header:** `"Proficiencies & Languages"`

**Layout:** Compact key-value block

```
Armor        Light armor, Medium armor, Heavy armor, Shields
Weapons      Simple weapons, Martial weapons
Tools        None
Languages    Common, Elvish, Celestial
```

- Key: `text-base font-semibold w-24`
- Value: `text-sm text-muted-foreground`
- Layout: `flex flex-col gap-2`
- Row: `flex flex-row gap-4`
- All read-only (derived from class + background at character creation)

---

### 4.11 Section 10 — Traits (`TraitsSection`)

**Section header:** `"Traits & Features"` + `[▼ Collapse]` button at right

**Layout:** Collapsible section. Collapsed by default if the section is long (> 300px height estimated). Expanded by default if short.

```
▼ Traits & Features                      [▲ Collapse]
──────────────────────────────────────────────────────
Racial Traits
  Darkvision: You can see in dim light within 60 feet…
  Fey Ancestry: You have advantage on saving throws…
  Trance: Elves don't need to sleep…

Class Features (Level 1)
  Fighting Style: Choose a Fighting Style specialty…
  Second Wind: You have a limited well of stamina…

Background Feature
  Military Rank: You have a military rank from your career…
```

- Section group headers: `text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1`
- Trait name: `text-sm font-semibold`
- Trait description: `text-sm text-muted-foreground`
- All read-only
- Collapse animation: `transition-all duration-200` on height
- Collapsed state shows only the section header + `[▼ Expand]` button

---

## 5. Image Import UX

### 5.1 Portrait Import Flow

**Trigger:** Click on `PortraitSlot` in `SheetHeader`

**Sequence:**
1. Click fires `characters.importPortrait` tRPC mutation
2. Main process: `dialog.showOpenDialog` opens native OS file picker
   - Title: `"Select Character Portrait"`
   - Filters: `[{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]`
3. User selects or cancels:
   - **Cancel:** mutation resolves with `null`, no state change, `PortraitSlot` stays as-is
   - **Select:** mutation shows loading state on `PortraitSlot` (spinner overlay)
4. Main process: jimp resize → copy to `{userData}/images/{campaignId}/` → DB update
5. Mutation resolves → TanStack Query invalidates character query → `PortraitSlot` re-renders with new `dataUrl`

**Loading state:** During step 3→5, `PortraitSlot` shows a centered spinner on a semi-transparent overlay over the existing portrait (or fallback). No flash of empty state.

**Error state:** If the file cannot be read (corrupted, permissions), mutation `onError` fires. An error toast appears: `"Could not import image. Please try a different file."` (3s auto-dismiss). The portrait slot remains unchanged.

**Portrait fallback (no portrait imported):**
- Shows a `User` icon from lucide-react, 32px, `text-muted-foreground`
- Background: `bg-surface/50`
- Hover: camera icon overlay with `"Add portrait"` tooltip

### 5.2 Cover Image Import Flow

**Trigger:** Click on cover image area in `CampaignCard` (on the campaign list screen) or on a `[Change Cover Image]` button in the campaign view header.

**Sequence:** Identical to portrait flow, using `campaigns.importCoverImage` mutation. The cover image path is stored on the `campaigns` table (`coverImagePath` column — added in Phase 2 migration).

**CampaignCard cover slot states:**
- **No cover image:** gradient placeholder (`bg-gradient-to-br from-surface to-muted`) with a `Camera` icon centered + `"Add cover image"` tooltip on hover
- **With cover image:** `<img>` fills the card header area, `object-cover`
- **Hover overlay:** `"Change cover image"` text on semi-transparent overlay, appears on card hover only when a cover exists

**Loading state:** During import, spinner overlay on the card header area.

**Error:** Same error toast pattern as portrait.

---

## 6. Copywriting Contract

All user-visible strings in Phase 2. Executor must use these exact strings.

### 6.1 Wizard Labels & Placeholders

| Location | String |
|----------|--------|
| Dialog title | `"Create Your Character"` |
| Step 1 name field label | `"Character Name"` |
| Step 1 name placeholder | `"Enter your character's name"` |
| Step 1 backstory label | `"Backstory (optional)"` |
| Step 1 backstory placeholder | `"Add an optional backstory…"` |
| Step 1 left column heading | `"Choose a Species"` |
| Step 1 right column heading | (species name, dynamic) |
| Step 2 left column heading | `"Choose a Class"` |
| Step 2 subclass label (Cleric) | `"Divine Domain"` |
| Step 2 subclass label (Sorcerer) | `"Sorcerous Origin"` |
| Step 2 subclass label (Warlock) | `"Otherworldly Patron"` |
| Step 3 left column heading | `"Standard Array"` |
| Step 3 dropdown placeholder | `"— Choose —"` |
| Step 3 override link | `"Override"` |
| Step 3 clear override link | `"Clear override"` |
| Step 3 skills section heading | `"Skill Proficiencies"` |
| Step 3 skills auto-granted prefix | `"Auto-granted: "` |
| Step 4 left column heading | `"Choose a Background"` |
| Step 4 language label | `"Choose a Language"` |
| Step 4 personality label | `"Personality Trait (optional)"` |
| Step 4 personality placeholder | `"Write your own or use the suggestion above…"` |
| Step 4 ideal label | `"Ideal (optional)"` |
| Step 4 bond label | `"Bond (optional)"` |
| Step 4 flaw label | `"Flaw (optional)"` |
| Step 5 left column heading | `"Choose Starting Equipment"` |
| Step 5 package gold row | `"Starting Gold: {n} gp"` |
| Step 6 heading | `"Review Your Character"` |
| Step 6 confirm note | `"This creates your character. You can edit stats on the sheet after creation."` |
| Footer: cancel button | `"Cancel Character Creation"` |
| Footer: back button | `"Back"` — always unambiguous because the `WizardProgress` step label row is persistently visible above, showing the current step name and all completed step names. Context is never lost. |
| Footer: next button | `"Next"` — unambiguous for the same reason; the visible step label row (e.g. "Race", "Class", "Ability Scores") tells the player exactly what step they are on. |
| Footer: confirm button | `"Create Character"` |
| Footer: confirm loading | `"Creating…"` |
| Cancel confirmation heading | `"Cancel character creation?"` |
| Cancel confirmation body | `"Your progress will be lost. You'll return to the campaign list."` |
| Cancel confirmation yes | `"Yes, cancel"` |
| Cancel confirmation no | `"Keep building"` |

### 6.2 Wizard Validation Messages

| Trigger | Message | Placement |
|---------|---------|-----------|
| Name field empty, Next clicked | `"Character name is required."` | Below name input, `text-destructive text-sm` |
| No race selected, Next hovered | `"Select a species to continue."` | Next button tooltip |
| No class selected, Next hovered | `"Select a class to continue."` | Next button tooltip |
| Subclass required, Next hovered | `"Select a {domainLabel} to continue."` | Next button tooltip |
| Not all scores assigned | `"Assign all 6 ability scores to continue."` | Below score grid, `text-destructive text-sm` |
| Insufficient skills chosen | `"Select {n} more skill proficiency to continue."` (`"proficiencies"` if n > 1) | Below skill picker |
| Background required | `"Select a background to continue."` | Next button tooltip |
| Language required | `"Choose a language to continue."` | Next button tooltip |
| Equipment required | `"Choose an equipment package to continue."` | Next button tooltip |
| Manual score invalid | `"Enter a number between 1 and 30."` | Below that score's input field |

### 6.3 Character Sheet Labels

| Location | String |
|----------|--------|
| Section: ability scores | `"Ability Scores"` |
| Section: saving throws | `"Saving Throws"` |
| Section: skills | `"Skills"` |
| Section: combat | `"Combat"` |
| Combat stat: AC label | `"Armor Class"` |
| Combat stat: AC sub-label | `"AC"` |
| Combat stat: Initiative sub-label | `"Initiative"` |
| Combat stat: Speed label | `"Speed"` |
| Combat stat: Speed sub-label | `"Walking"` |
| Section: resources | `"Resources"` |
| HP label | `"Hit Points"` |
| HP max display | `"/ {max}"` |
| Temp HP label | `"Temp HP"` |
| Inspiration toggle | `"Inspiration"` |
| Death saves section | `"Death Saves"` |
| Death saves successes | `"Successes"` |
| Death saves failures | `"Failures"` |
| Spell slots section | `"Spell Slots"` |
| No spells message | `"Not a spellcaster — spell slots are tracked here when available."` |
| Conditions section | `"Conditions"` |
| Section: currency | `"Currency"` |
| Currency denominations | `"CP"`, `"SP"`, `"EP"`, `"GP"`, `"PP"` |
| Currency full names | `"Copper"`, `"Silver"`, `"Electrum"`, `"Gold"`, `"Platinum"` |
| Section: equipment | `"Equipment"` |
| Equipment table header: name | `"Name"` |
| Equipment table header: qty | `"Qty"` |
| Equipment table header: weight | `"Weight"` |
| Equipment table header: attune | `"Attune"` |
| Attunement count badge | `"{n} / 3 Attuned"` |
| Attunement button: attuned | `"Attuned"` (aria-label) |
| Attunement button: not attuned | `"Attune"` (aria-label) |
| Section: proficiencies | `"Proficiencies & Languages"` |
| Proficiency row: armor | `"Armor"` |
| Proficiency row: weapons | `"Weapons"` |
| Proficiency row: tools | `"Tools"` |
| Proficiency row: languages | `"Languages"` |
| Proficiency empty value | `"None"` |
| Section: traits | `"Traits & Features"` |
| Traits: racial group | `"Racial Traits"` |
| Traits: class group | `"Class Features (Level 1)"` |
| Traits: background group | `"Background Feature"` |
| Traits: collapse button | `"Collapse"` |
| Traits: expand button | `"Expand"` |

### 6.4 Image Import Strings

| Location | String |
|----------|--------|
| Portrait slot: no portrait tooltip | `"Add portrait"` |
| Portrait slot: has portrait tooltip | `"Change portrait"` |
| Portrait import dialog title | `"Select Character Portrait"` |
| Portrait error toast | `"Could not import image. Please try a different file."` |
| Cover slot: no cover tooltip | `"Add cover image"` |
| Cover slot: has cover hover label | `"Change cover image"` |
| Cover import dialog title | `"Select Campaign Cover Image"` |
| Cover error toast | `"Could not import image. Please try a different file."` |

### 6.5 Empty States

| Scenario | Empty State Text |
|----------|-----------------|
| Character Sheet tab, no character yet (wizard not yet shown) | `"Building your character…"` (transient, shown for < 1s while wizard auto-launches) |
| Equipment section: no items | `"No equipment — add items from the starting packages or edit your sheet."` |
| Spell slots: class has no spells | `"Not a spellcaster — spell slots are tracked here when available."` |
| Conditions: no active conditions | (no empty state text — the inactive badge row is always shown, acting as its own empty state) |

---

## 7. Interaction Contract

### 7.1 Wizard Keyboard

| Key | Context | Action |
|-----|---------|--------|
| `Tab` | Any wizard step | Move focus forward through interactive elements |
| `Shift+Tab` | Any wizard step | Move focus backward |
| `Enter` | Next button focused | Advance step (if valid) |
| `Enter` | Back button focused | Go back one step |
| `Enter` / `Space` | List item in selector column focused | Select that item (same as click) |
| `Arrow Up / Down` | Selector list focused | Move highlight up/down within the list |
| `Escape` | Wizard open | No-op (wizard is not dismissible by Escape — D-04) |
| `Enter` | "Create Character" button focused | Submit wizard |
| `Enter` | Cancel confirmation dialog | Confirm cancel (focus must be on "Yes, cancel" button) |
| `Escape` | Cancel confirmation dialog | Close confirmation, return to wizard |

### 7.2 Wizard Focus Order

Step 1 (Race):
1. Character Name input
2. Backstory textarea
3. First race in selector list
4. (remaining list items via arrow keys)
5. Next button

Step 3 (Ability Scores):
1. STR dropdown
2. STR override link
3. DEX dropdown
4. DEX override link
5. (repeat for CON, INT, WIS, CHA)
6. Saving throw checkboxes (STR through CHA, each)
7. Skill proficiency checkboxes (in list order)
8. Next button

### 7.3 Character Sheet Keyboard

| Key | Context | Action |
|-----|---------|--------|
| `Tab` | Sheet | Standard focus traversal through all interactive elements |
| `Shift+Tab` | Sheet | Reverse traversal |
| `Enter` / `Space` | `+` or `−` stepper button | Fire the stepper action |
| `Enter` / `Space` | Condition badge | Toggle condition |
| `Enter` / `Space` | Inspiration toggle | Toggle inspiration |
| `Enter` / `Space` | Death save checkbox | Toggle save |
| `Enter` / `Space` | Attunement toggle | Toggle attunement |
| `Enter` / `Space` | Traits Expand/Collapse | Toggle traits section |
| `Enter` / `Space` | `PortraitSlot` | Open portrait file picker |
| `F2` or direct type | Ability score input | Enter edit mode (already always editable) |
| `Enter` | Ability score input focused | Confirm value, blur field |
| `Escape` | Ability score input | Restore previous value, blur field |

### 7.4 Pointer Interactions

| Element | Hover | Click | Drag |
|---------|-------|-------|------|
| Selector list item (wizard) | Background brightens | Selects item, updates preview | — |
| WizardProgress dot (completed) | `opacity-80` | Navigate to that step | — |
| WizardProgress dot (future/active) | Cursor `not-allowed` / default | No-op | — |
| Stepper `+`/`−` button | Standard hover state | Fire delta mutation | — |
| SpellSlotPip (available) | `opacity-80` | `onUse` | — |
| SpellSlotPip (expended) | `opacity-80` | `onRecover` | — |
| ConditionBadge | Border brightens | Toggle condition | — |
| PortraitSlot | Camera icon overlay | Open file picker | — |
| Traits section header | — | Expand/collapse | — |
| Equipment attunement toggle | Standard | Toggle attuned | — |
| Ability score value | Cursor text | Select, type new value | — |

### 7.5 Rapid Press Behavior (Steppers)

- Multiple rapid presses on HP `+`/`−` fire multiple delta mutations
- Each mutation: `cancelQueries` → optimistic update → IPC call
- Net DB result equals sum of all deltas (delta-based mutation design per RESEARCH.md Pattern 5)
- No visual debouncing — every press must produce an immediate visible increment/decrement in the displayed value
- Rate limiting: none in Phase 2 (better-sqlite3 synchronous writes handle the load)

---

## 8. Out of Scope

The following are deferred and must not be partially implemented in Phase 2. Any placeholder UI for deferred features should not be added — the absence is the correct state.

| Feature | Deferred to |
|---------|-------------|
| Spell list selection and spell management UI | Phase 5 |
| "Cast spell" button or spell card display | Phase 5 |
| Short rest / long rest spell slot recovery buttons | Phase 5 |
| XP gain controls and level-up flow | Phase 5 |
| Feat selection during character creation or level-up | Phase 7 |
| Multiclassing — second class picker | Phase 7 |
| Advanced ability score methods (4d6-drop-lowest, negative-trait point buy) | Phase 7 |
| Rolling dice for ability scores (dice roller UI) | Phase 7 |
| Party support — second character tab or multi-character list | Phase 7 |
| PDF/text rules import by the user | Phase 7 |
| Equipment weight tracking / encumbrance enforcement | Phase 7 |
| Custom background creation | Phase 7 |
| Homebrew race / class / background import | Phase 7 |
| Equipment quantity editing on the sheet (add/remove items) | Phase 5+ |
| Attunement item limit enforcement (warning or blocking at 3+) | Phase 7 (tracking only in Phase 2) |
| XP display editing | Phase 5 |

---

## 9. Checker Sign-Off

> Revised 2026-05-25 — awaiting re-check

- [ ] **Completeness** — (from prior run: PASS — all 6 wizard steps, 10 sheet sections, image import UX, and interaction contract fully specified)
- [ ] **Visual Consistency** — (from prior run: PASS)
- [ ] **Color Compliance** — 60/30/10 split confirmation added to §1.1; amber/red inline condition colors confirmed distinct from `--color-destructive`
- [ ] **Typography** — Scale collapsed to 4 sizes (14px, 16px, 20px, 36px) and 2 weights (400 regular, 600 semibold); `font-bold` eliminated throughout; consolidation mapping provided in §1.3
- [ ] **Spacing** — `py-0.5` (2px) replaced with `py-1` (4px) on `ConditionBadge` in §2.4; all padding/gap values are multiples of 4
- [ ] **Registry Safety** — (from prior run: PASS — shadcn official registry only)

---

*Phase: 2 — Character Domain & Live Sheet*
*UI-SPEC authored: 2026-05-24*
*UI-SPEC revised: 2026-05-25*
*Source decisions: 02-CONTEXT.md (D-01 through D-30), 02-RESEARCH.md, user Q&A (Q1–Q4)*
