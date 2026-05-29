---
status: partial
phase: 05-rules-engine-dice-combat
source: [05-VERIFICATION.md]
started: 2026-05-29T21:00:00Z
updated: 2026-05-29T21:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Dice Roller Popover (COMB-01)
expected: Die click inserts prefix, expression roll inserts prefix, invalid expression disables Roll button and shows 'Invalid expression'.
result: [pending]

### 2. Combat Tracker Visual + AI Enemy Management (COMB-02, COMB-03)
expected: Combat tab auto-switches on Start Combat, HP bars use color thresholds (green >50%, amber 25-50%, red <25%), expanded rows show stepper+conditions, AI dice rolls render as amber chips.
result: [pending]

### 3. Spell Casting + Concentration Warning (CHAR-08)
expected: Slot deducts visually on cast; concentration warning dialog appears with 'Drop Concentration?' title and correct spell names.
result: [pending]

### 4. Level-Up Banner and Modal (PROG-01)
expected: Banner appears at top of character sheet, modal shows HP choice and spell slot table, [System: Name reached Level N!] appears in story as italic amber text.
result: [pending]

### 5. Rest System + Hit Dice Modal (PROG-02)
expected: Rest picker sends correct message to AI; AI processRest triggers ShortRestHitDiceModal via ai:mutations-applied; modal rolls dice and applies HP.
result: [pending]

### 6. Currency Mutation Chips + Cache Invalidation (STATE-05)
expected: Currency chip appears with Coins icon and amber color, fades after 4s, character sheet GP value updates without manual refresh.
result: [pending]

### 7. Permadeath Toggle Persistence (PROG-04)
expected: Permadeath toggle persists across AI Settings modal close/reopen and across app restart.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
