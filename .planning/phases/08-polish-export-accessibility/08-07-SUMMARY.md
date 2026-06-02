---
phase: 08-polish-export-accessibility
plan: "07"
subsystem: accessibility
tags: [aria, a11y, screen-reader, keyboard-nav, aria-live, paragraph-boundary]

requires:
  - phase: 08-02
    provides: .sr-only utility class in globals.css

provides:
  - StoryScrollPanel off-screen ARIA live region (aria-live=polite) with paragraph-boundary detection
  - findParagraphBoundary() function with double-newline (>20 chars) and sentence-end (>60 chars) thresholds
  - TitleBar window-control aria-labels (Minimize/Maximize/Restore/Close window)
  - CombatTrackerTab CombatantRow collapsible trigger aria-label

affects:
  - screen reader users (NVDA/VoiceOver): streamed narration now announces at paragraph boundaries
  - keyboard-only users: all icon-only controls now have descriptive labels

tech-stack:
  added: []
  patterns:
    - Off-screen ARIA live region with double-update pattern (clear → rAF set) for screen reader detection
    - Paragraph boundary detection using useRef buffer (no per-token setState — avoids re-render storms)
    - lastProcessedLenRef tracks cumulative streamingContent delta to avoid reprocessing tokens
    - textContent assignment (not innerHTML) for T-08-20 injection mitigation

key-files:
  created: []
  modified:
    - src/renderer/src/components/StoryScrollPanel.tsx
    - src/renderer/src/components/TitleBar.tsx
    - src/renderer/src/components/CombatTrackerTab.tsx

key-decisions:
  - "Buffer uses useRef (never setState) to avoid per-token re-renders — T-08-21 DoS mitigation"
  - "Off-screen live region is always rendered (not conditional) — Radix Landmine 4: conditionally rendered regions are missed by screen readers on first mount"
  - "textContent used (not innerHTML) for AI-generated announcements — T-08-20 injection mitigation"
  - "lastProcessedLenRef tracks cumulative delta rather than storing previous streamingContent string — lower memory overhead"
  - "CombatTrackerTab collapsible trigger uses aria-label on the div role=button rather than converting to a native button — minimizes change surface while achieving accessible label"
  - "DiceRollerPopover: trigger already has aria-label=Open dice roller in ChatInputArea (from 08-05); no duplicate added"
  - "CharacterSheetTab: PDF Export already labeled, Add Character already labeled, party chips have visible text — no changes needed"
  - "TitleBar: Maximize button aria-label is dynamic (Restore window vs Maximize window) matching the current isMaximized state"

requirements-completed: [A11Y-02, A11Y-03]

duration: ~20min
completed: 2026-06-02
---

# Phase 8 Plan 07: Final Accessibility Pass (A11Y-02, A11Y-03) Summary

Off-screen ARIA live region for paragraph-boundary narration announcements in StoryScrollPanel; aria-label additions to TitleBar window controls and CombatTrackerTab combatant row trigger; human-verify checkpoint for NVDA/VoiceOver + keyboard verification.

## Performance

- **Duration:** ~20 min (Tasks 1-2); Task 3 is human-verify checkpoint
- **Completed:** 2026-06-02
- **Tasks:** 2/3 auto tasks complete; 1 checkpoint awaiting human verification
- **Files modified:** 3

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | StoryScrollPanel off-screen ARIA live region + paragraph-boundary detection | 64c7303 | StoryScrollPanel.tsx |
| 2 | aria-label audit on remaining icon-only buttons | 8afbe01 | TitleBar.tsx, CombatTrackerTab.tsx |

## Checkpoint Status

**Task 3: Screen reader + keyboard navigation verification** — AWAITING HUMAN VERIFICATION

See checkpoint details in execution message for verification steps.

## Verification

- `npm run typecheck`: exits 0 (both tasks)
- `npm run build`: renderer Vite build exits 0 (3226 modules), electron-builder packaging step fails on unrelated "cannot compute electron version" issue (pre-existing environment constraint — not caused by this plan)

## Deviations from Plan

### Scope Adjustments

**1. [Scope clarification] CharacterSheetTab.tsx requires no changes**
- **Found during:** Task 2 audit
- **Issue:** Plan specifies CharacterSheetTab.tsx as a target for "section collapse toggles — add aria-label and aria-expanded". Audit found: PDF button already has aria-label (08-05), Add Character button has aria-label, party member chips use visible text (character names). The collapse toggles are in sub-components (SpellListSection, TraitsSection, CompanionsSection) — all already accessible (visible text labels, aria-expanded via Radix or explicit on TraitsSection).
- **Fix:** No changes needed to CharacterSheetTab.tsx. Acceptance criteria satisfied.

**2. [Scope clarification] DiceRollerPopover.tsx requires no changes**
- **Found during:** Task 2 audit
- **Issue:** Plan mentions "ensure the trigger button has aria-label=Open dice roller". Audit found this label is on the button in ChatInputArea.tsx (line 179), not in DiceRollerPopover.tsx itself. The popover content's die buttons already have aria-label={`Roll ${die}`}, expression input has aria-label="Dice expression", Roll button has visible text.
- **Fix:** No changes needed to DiceRollerPopover.tsx. Acceptance criteria satisfied.

## Known Stubs

None — accessibility changes are pure attribute additions, no stubs.

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`:
- T-08-20 (textContent injection): mitigated — liveRegion.textContent used (not innerHTML)
- T-08-21 (DoS via update spam): mitigated — updates fire only at paragraph/sentence boundaries via useRef buffer; rAF throttles DOM mutations

## Self-Check

Files exist:
- src/renderer/src/components/StoryScrollPanel.tsx: FOUND (contains findParagraphBoundary, liveRegionRef, paragraphBufferRef, aria-live=polite region, sr-only class, scroll div no longer has aria-live)
- src/renderer/src/components/TitleBar.tsx: FOUND (contains aria-label=Minimize window, aria-label=Maximize window/Restore window, aria-label=Close window)
- src/renderer/src/components/CombatTrackerTab.tsx: FOUND (contains aria-label={`${combatant.name} — view details`} on collapsible trigger)
- .planning/phases/08-polish-export-accessibility/08-07-SUMMARY.md: FOUND

Commits exist:
- 64c7303: FOUND (StoryScrollPanel off-screen ARIA live region)
- 8afbe01: FOUND (aria-label audit on icon-only buttons)

## Self-Check: PASSED
