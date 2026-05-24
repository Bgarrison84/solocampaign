---
status: partial
phase: 01-foundation-secure-shell
source: [01-VERIFICATION.md]
started: 2026-05-24T00:00:00Z
updated: 2026-05-24T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Packaged build smoke test
expected: Run `npm run build` then `pwsh -File scripts/smoke/smoke.win.ps1`. All 7 checks pass: NSIS installer exists, win-unpacked exe exists, better-sqlite3 ASAR-unpacked .node file present, Drizzle migration SQL at resourcesPath/migrations/, app launches without crash (running after 6s), second instance exits (single-instance lock), solocampaign.db created in %APPDATA%\SoloCampaign\.
result: [pending]

### 2. Campaign persistence across restart
expected: Create a new campaign ("Test Campaign"), close the app, reopen it, verify the campaign card appears on the home screen. The campaign name and creation date should be intact.
result: [pending]

### 3. Split-panel layout visual + resize interaction
expected: Navigate to a campaign. Verify: (1) left panel shows "AI narration appears here." centered, (2) right panel shows Character Sheet tab active by default, (3) all 5 tab labels match exactly: "Character Sheet", "Combat Tracker", "NPC Tracker", "Session Journal", "Inventory", (4) dragging the resize handle works and respects minSize constraints.
result: [pending]

### 4. Title bar: drag region, window controls, and campaign name
expected: (1) Dragging the title bar gutter moves the window, (2) Minus/Square/X buttons minimize/maximize/close via tRPC, (3) on the home screen title shows "SoloCampaign", (4) after navigating to a campaign it shows "SoloCampaign — {name}", (5) navigating back to / clears the campaign name.
result: [pending]

### 5. Window bounds persistence
expected: Resize and move the window to a non-default position, close the app, reopen it. The window should restore to the saved size and position (not reset to 1280×800 default).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
