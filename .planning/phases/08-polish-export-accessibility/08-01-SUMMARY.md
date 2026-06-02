---
phase: 08-polish-export-accessibility
plan: "01"
subsystem: settings-foundation
tags: [appPrefs, electron-store, tRPC, IPC, settings, accessibility]
dependency_graph:
  requires: []
  provides:
    - appPrefsRouter (get, setFontSize, setHighContrast)
    - appPrefsStore (named export for plan 08-06 reuse)
    - window.appPrefsSync.getInitialPrefs() IPC bridge
    - initDatabase(customPath?) signature
    - /settings route + SettingsScreen scaffold
    - TitleBar gear icon navigating to /settings
  affects:
    - src/main/index.ts (startup wiring, IPC handler)
    - src/main/db/index.ts (initDatabase signature)
    - src/preload/index.ts (contextBridge surface)
    - src/main/trpc/router.ts (appPrefs registered)
tech_stack:
  added: []
  patterns:
    - electron-store + tRPC router pattern (mirroring prefs.ts)
    - ipcMain.handle registered before new BrowserWindow (Landmine 3)
    - contextBridge narrow read-only surface for pre-mount prefs read
key_files:
  created:
    - src/main/trpc/routers/appPrefs.ts
    - src/main/trpc/routers/appPrefs.test.ts
    - src/renderer/src/screens/SettingsScreen.tsx
  modified:
    - src/main/trpc/router.ts (appPrefs registered alphabetically)
    - src/main/index.ts (appPrefs store, IPC handler, initDatabase call)
    - src/main/db/index.ts (customPath parameter)
    - src/preload/index.ts (appPrefsSync bridge)
    - src/renderer/src/App.tsx (/settings route)
    - src/renderer/src/components/TitleBar.tsx (gear icon)
decisions:
  - "appPrefs store is instantiated twice: once in appPrefs.ts (for tRPC) and once in main/index.ts (for the pre-mount IPC handler). This intentional duplication avoids circular imports between the tRPC layer and the startup sequence. Both stores read/write the same appPrefs.json file via electron-store."
  - "TDD RED/GREEN pattern used for Task 1 — failing test committed first, implementation second."
metrics:
  duration: "~20min"
  completed_date: "2026-06-02"
---

# Phase 8 Plan 01: Settings Foundation Summary

appPrefs electron-store + tRPC router with pre-mount IPC bridge, initDatabase custom-path parameter, /settings route scaffold, and TitleBar gear icon navigation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | appPrefs tests (failing) | 21cba51 | appPrefs.test.ts |
| 1 (GREEN) | appPrefs router + router.ts | e3fc669 | appPrefs.ts, router.ts |
| 2 | IPC bridge + initDatabase + preload | 0d8eb5f | index.ts, db/index.ts, preload/index.ts |
| 3 | /settings route + gear icon + scaffold | 3266729 | SettingsScreen.tsx, App.tsx, TitleBar.tsx |

## Verification

- `npm run test -- --run appPrefs`: 3/3 tests pass
- `npm run typecheck`: exits 0 (all tasks)
- Full test suite: pre-existing better-sqlite3 native binding failures unrelated to plan changes; appPrefs tests pass

## Deviations from Plan

None — plan executed exactly as written.

The appPrefs store is instantiated in both `appPrefs.ts` (for tRPC procedures) and `main/index.ts` (for the pre-mount IPC handler). Both instances use `{ name: 'appPrefs' }` and read/write the same underlying `appPrefs.json` file via electron-store's file-based persistence. This is intentional to avoid circular imports between the startup sequence and the tRPC layer.

## Known Stubs

- `SettingsScreen.tsx`: Appearance section contains comment placeholders for font size picker and high contrast toggle (filled by plan 08-02)
- `SettingsScreen.tsx`: Data section contains comment placeholder for data folder UI (filled by plan 08-06)

These stubs are intentional scaffold — the screen renders the correct section headers but has no interactive controls yet. Plans 08-02 and 08-06 are explicitly designated to fill them.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's `<threat_model>`:
- `appPrefs:getInitial` IPC returns only fontSize/highContrast/dataFolder (no secrets — T-08-02 accepted)
- setFontSize/setHighContrast validated by Zod enum/boolean at tRPC boundary (T-08-01 mitigated)
- dataFolder is read-only at startup in this plan; write path (OS folder picker) is in plan 08-06 (T-08-03 deferred)

## Self-Check: PASSED

Files exist:
- src/main/trpc/routers/appPrefs.ts: FOUND
- src/main/trpc/routers/appPrefs.test.ts: FOUND
- src/renderer/src/screens/SettingsScreen.tsx: FOUND

Commits exist:
- 21cba51: FOUND (test RED)
- e3fc669: FOUND (feat GREEN)
- 0d8eb5f: FOUND (feat Task 2)
- 3266729: FOUND (feat Task 3)
