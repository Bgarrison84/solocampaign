# Session Handoff — Phase 10: Gameplay Feel Sprint

**Status:** Discussion complete — ready to plan and execute
**Context file:** `.planning/phases/10-gameplay-feel-sprint/10-CONTEXT.md`

## What was decided

All decisions are locked in the CONTEXT.md. Short version:

| Feature | Decision |
|---------|----------|
| **Tone** | Subtle — 150-250ms baseline, nothing over 350ms |
| **Dice chip** | Scale + fade pop-in on appear (~200ms); nat 20 = gold glow bounce, nat 1 = red flash |
| **HP change** | Bar flashes red/green + delta number floats above bar for ~650ms; HP→0 flashes whole row |
| **HP scope** | Both `CombatTrackerTab` AND `ResourcesSection` |
| **Turn transition** | Single pulse-in glow on new active row + smooth auto-scroll into view |

## Next steps

1. `/gsd-plan-phase 10` — creates the PLAN.md with task breakdown
2. `/gsd-execute-phase 10` — builds all three features
3. Test in dev: `npm run dev`

## Key files to touch

- `src/renderer/src/styles/globals.css` — new keyframes
- `src/renderer/src/components/StoryScrollPanel.tsx` — dice chip animation
- `src/renderer/src/components/CombatTrackerTab.tsx` — HP flash + delta + turn transition
- `src/renderer/src/components/ResourcesSection.tsx` — HP flash + delta (same logic as combat tracker)
