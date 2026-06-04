# Phase 10: Gameplay Feel Sprint — Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver three micro-animation features that make gameplay feel alive:
1. **Dice roll feedback** — result chip animates in with scale + fade; nat 20 / nat 1 get enhanced visual treatment
2. **HP change feedback** — bar flashes red/green + floating delta number (+5 / -8) rises and fades; killing blow flashes the whole row
3. **Combat turn transitions** — new active row pulse-in glow + smooth auto-scroll into view

**In scope:** CSS keyframe additions to `globals.css`, animation classes on existing components (`StoryScrollPanel.tsx`, `CombatTrackerTab.tsx`, `ResourcesSection.tsx`), floating delta number component, turn-change detection logic.

**Out of scope:** Sound effects (no audio infrastructure exists — separate sprint), typewriter/markdown-during-streaming changes, new screens, new game mechanics, level-up confetti (separate).
</domain>

<decisions>
## Implementation Decisions

### Animation Tone (Cross-Cutting)

- **D-01: Subtle register — 150-250ms baseline, nothing longer than 350ms.**
  Animations should add responsiveness without ever feeling like a game cutscene.
  Fits the existing Phase 8 polish direction. No dramatic slow-motion effects.

### Dice Roll Animation

- **D-02: Animate the result chip only — no button shake.**
  The chip in the story panel is where the result lives; that is where the eye should go.
  The roll button is not animated on click.

- **D-03: Chip entrance — scale + fade pop-in (~200ms).**
  Chip starts at ~80% scale and 0 opacity, eases to full size and full opacity.
  Use Tailwind `animate-in zoom-in-95 fade-in duration-200` (or equivalent keyframe if needed).

- **D-04: Nat 20 gets a stronger pop-in + brief gold glow; nat 1 gets a red-tinted flash.**
  Same chip element, different entrance class: nat 20 scales to 1.15 → 1.0 with a gold `box-shadow`
  pulse; nat 1 gets a red tinted background flash. Both resolve back to the normal amber chip style.
  Detection: check if `expression` is a single `d20` roll (e.g., `d20`, `1d20`) AND `result === 20` or `result === 1`.

### HP Change Feedback

- **D-05: Flash + floating delta on every HP change.**
  Bar briefly flashes red (damage) or green (heal) for ~200ms.
  A small delta number (`+5` green / `-8` red) floats up from the top edge of the HP bar and fades out.
  Total delta lifecycle: ~650ms (float up ~300ms, fade out ~350ms).

- **D-06: Applies to BOTH `CombatTrackerTab` and `ResourcesSection`.**
  HP is HP — consistent feedback everywhere it appears in the UI.
  Extract shared animation logic into a reusable hook or utility if the two components share enough structure.

- **D-07: Killing blow (HP → 0) flashes the entire combatant row red.**
  The whole row gets a stronger red flash (~250ms) instead of just the bar, making death
  unambiguous in a busy combat list. Triggered when new HP value reaches 0.

- **D-08: Delta number appears above the HP bar.**
  Positioned absolutely relative to the bar container, floats upward and fades out.
  Font: small (text-xs or text-sm), bold, colored (`text-green-400` / `text-red-400`).

### Combat Turn Transitions

- **D-09: New active row gets a single pulse-in glow (~300ms) on turn advance.**
  One brief flash of the primary border/background color that resolves to the existing
  `bg-primary/10 border border-primary/40` resting state. Not a continuous pulse — a single
  entrance animation triggered when `currentTurnOrder` changes.

- **D-10: Combat tracker auto-scrolls smoothly to the new active row.**
  When `currentTurnOrder` changes, call `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`
  on the newly active combatant row ref. Activates only when combat is active (`isCombatActive` = true).

### Implementation Notes (for planner/researcher)

- All animations should be pure CSS / Tailwind where possible. Custom keyframes go in `globals.css`
  (the blink cursor is already there as a reference pattern).
- The floating delta number will need `position: relative` on the HP bar wrapper and
  `position: absolute` on the delta element to float without layout shift.
- Nat 20/1 detection only applies to bare d20 rolls — NOT advantage/disadvantage expressions
  or compound expressions like `1d20+5`. Check `breakdown` array from `RollResult` if needed,
  but a simple check on `expression.match(/^[1]?d20$/i) && result === 20/1` is sufficient.
- Combat tracker row refs: use `useRef` map keyed by combatant ID for the scroll target.
- Consider whether the delta number should be rendered in the DOM at all times (hidden) vs
  dynamically mounted — dynamic mount is simpler for one-shot animations (mount → animate → unmount).
</decisions>

<canonical_refs>
## Files Downstream Agents Must Read

- `src/renderer/src/components/StoryScrollPanel.tsx` — dice chip rendering at L269-310
- `src/renderer/src/components/CombatTrackerTab.tsx` — HP bar, active turn indicator (L287-291), combatant rows
- `src/renderer/src/components/ResourcesSection.tsx` — character sheet HP bar and stepper
- `src/renderer/src/stores/combatStore.ts` — `currentTurnOrder`, `isCombatActive` state
- `src/renderer/src/lib/dice.ts` — `RollResult` type with `expression`, `result`, `breakdown`
- `src/renderer/src/styles/globals.css` — existing keyframes (blink cursor at L83-86), CSS var patterns
- `.planning/phases/08-polish-export-accessibility/08-CONTEXT.md` — Phase 8 visual polish decisions
</canonical_refs>

<code_context>
## Reusable Assets

- **Existing keyframe pattern:** `globals.css` L83-86 (`@keyframes blink`) — reference for adding new keyframes
- **Tailwind animate-in utilities:** `zoom-in-95 fade-in` are already available via `tailwindcss-animate` (used by shadcn components)
- **MutationChipStack:** `slide-in-from-top-2 duration-200 animate-in` — existing slide-in pattern to follow
- **Active turn indicator:** `animate-pulse` on dot in `CombatTrackerTab.tsx:288` — replace/supplement with entrance animation
- **Amber chip rendering:** `StoryScrollPanel.tsx:269-310` — wrap in animation class on mount
</code_context>

<deferred_ideas>
## Noted for Later (out of scope for this sprint)

- Sound effects (dice click, combat hit, level-up fanfare) — needs Web Audio API infrastructure
- Typewriter / markdown-during-streaming — separate concern, non-trivial partial-parse handling
- Level-up confetti / particle celebration
- Spell casting visual effects
</deferred_ideas>
