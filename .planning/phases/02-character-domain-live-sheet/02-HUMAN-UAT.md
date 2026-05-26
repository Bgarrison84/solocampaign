---
status: complete
phase: 02-character-domain-live-sheet
source: [02-VERIFICATION.md]
started: 2026-05-25T00:00:00.000Z
updated: 2026-05-25T21:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Full 6-step wizard end-to-end flow
expected: Wizard launches automatically for a campaign with no character, all 6 steps navigate correctly (forward/backward), completing Step 6 and clicking "Create Character" persists the character and transitions to the character sheet view
result: pass

### 2. Live HP stepper — optimistic update and cross-restart persistence
expected: Clicking HP +/− immediately updates the displayed value (optimistic), the change persists after closing and reopening the app
result: pass

### 3. Portrait import via OS dialog and display in PortraitSlot
expected: Clicking the PortraitSlot (or the portrait area in SheetHeader) opens the OS file picker, selecting an image resizes and displays it as base64 dataUrl in the PortraitSlot — persists after restart
result: pass

### 4. Campaign cover image import from CampaignCard (campaign list)
expected: Clicking the cover area on a CampaignCard opens the OS file picker, selected image appears on the card immediately and persists after returning to the list
result: pass

### 5. Campaign cover image import from CampaignViewScreen header
expected: Clicking the [Change Cover Image] button in the campaign tabs header opens the OS file picker, selected image persists and appears on the CampaignCard when returning to the list
result: pass

### 6. Spell slot pip interaction (available → expended → recovered)
expected: For a spellcasting class, each spell slot level shows pip circles — clicking an available pip marks it expended, clicking an expended pip recovers it; state persists after restart
result: issue
reported: "Pips start hollow/empty, unable to click and show it gold/filled"
severity: major

### 7. Condition badge toggle (active state + persistence)
expected: Clicking a condition badge (e.g. "Poisoned") toggles it to active styling, clicking again deactivates it; active conditions persist after restart
result: pass

### 8. Wizard non-dismissibility (Escape + backdrop click behavior)
expected: Pressing Escape or clicking outside the wizard dialog does NOT close it; the Cancel button shows a confirmation dialog before navigating away
result: pass

### 9. SRD content accuracy in wizard selectors (real text rendered from JSON)
expected: Step 1 species list shows real SRD races (Human, Elf, Dwarf, etc.); Step 2 class list shows all 12 SRD classes; Step 4 background list shows real backgrounds with accurate feature text
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "For a spellcasting class, spell slot pips start gold/filled (available) and become hollow when clicked (expended); clicking again recovers them"
  status: failed
  reason: "User reported: Pips start hollow/empty, unable to click and show it gold/filled"
  severity: major
  test: 6
  artifacts:
    - src/main/trpc/routers/characters.ts (buildSpellSlots call)
    - src/main/db/charactersRepo.ts (createWithResources, spellSlots storage)
    - resources/spells-by-class.json (content data)
  root_cause: |
    Characters created before the content.ts .toLowerCase() fix have spellSlots='{}' in the DB
    because the class name lookup in buildSpellSlots failed (e.g. 'Wizard' vs 'wizard').
    The component shows 'Not a spellcaster' / no pips rather than gold pips.
    New characters created after the fix work correctly.
    Existing characters need a backfill: recompute spell slots from content data and update the DB.
  missing:
    - A backfill/repair tRPC procedure that recomputes spell slots for characters with spellSlots='{}'
    - Or a one-time migration that patches existing character_resources rows
