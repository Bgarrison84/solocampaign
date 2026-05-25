---
status: partial
phase: 02-character-domain-live-sheet
source: [02-VERIFICATION.md]
started: 2026-05-25T00:00:00.000Z
updated: 2026-05-25T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full 6-step wizard end-to-end flow
expected: Wizard launches automatically for a campaign with no character, all 6 steps navigate correctly (forward/backward), completing Step 6 and clicking "Create Character" persists the character and transitions to the character sheet view
result: [pending]

### 2. Live HP stepper — optimistic update and cross-restart persistence
expected: Clicking HP +/− immediately updates the displayed value (optimistic), the change persists after closing and reopening the app
result: [pending]

### 3. Portrait import via OS dialog and display in PortraitSlot
expected: Clicking the PortraitSlot (or the portrait area in SheetHeader) opens the OS file picker, selecting an image resizes and displays it as base64 dataUrl in the PortraitSlot — persists after restart
result: [pending]

### 4. Campaign cover image import from CampaignCard (campaign list)
expected: Clicking the cover area on a CampaignCard opens the OS file picker, selected image appears on the card immediately and persists after returning to the list
result: [pending]

### 5. Campaign cover image import from CampaignViewScreen header
expected: Clicking the [Change Cover Image] button in the campaign tabs header opens the OS file picker, selected image persists and appears on the CampaignCard when returning to the list
result: [pending]

### 6. Spell slot pip interaction (available → expended → recovered)
expected: For a spellcasting class, each spell slot level shows pip circles — clicking an available pip marks it expended, clicking an expended pip recovers it; state persists after restart
result: [pending]

### 7. Condition badge toggle (active state + persistence)
expected: Clicking a condition badge (e.g. "Poisoned") toggles it to active styling, clicking again deactivates it; active conditions persist after restart
result: [pending]

### 8. Wizard non-dismissibility (Escape + backdrop click behavior)
expected: Pressing Escape or clicking outside the wizard dialog does NOT close it; the Cancel button shows a confirmation dialog before navigating away
result: [pending]

### 9. SRD content accuracy in wizard selectors (real text rendered from JSON)
expected: Step 1 species list shows real SRD races (Human, Elf, Dwarf, etc.); Step 2 class list shows all 12 SRD classes; Step 4 background list shows real backgrounds with accurate feature text
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
