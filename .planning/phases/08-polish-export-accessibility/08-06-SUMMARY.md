---
phase: 08-polish-export-accessibility
plan: "06"
subsystem: data-folder-migration
tags: [appPrefs, sqlite-backup, WAL, integrity-check, DIST-04, settings, tRPC]
dependency_graph:
  requires: ["08-01", "08-02"]
  provides:
    - appPrefsRouter.getCurrentDataFolder (query)
    - appPrefsRouter.pickDataFolder (mutation)
    - appPrefsRouter.changeDataFolder (WAL-safe backup + PRAGMA integrity_check)
    - SettingsScreen Data section (path display + Change Folder + restart banner)
    - Alert UI component (alert.tsx)
  affects:
    - src/main/trpc/routers/appPrefs.ts (three new procedures added)
    - src/main/trpc/routers/appPrefs.test.ts (8 new tests for migration procedures)
    - src/renderer/src/screens/SettingsScreen.tsx (Data section filled)
    - src/renderer/src/components/ui/alert.tsx (created)
tech_stack:
  added: []
  patterns:
    - sqlite.backup(dest) for WAL-safe copy (NOT fs.copyFile — Landmine 2, Pitfall 1)
    - PRAGMA integrity_check on copied DB before persisting appPrefs.dataFolder
    - TRPCError + unlink on integrity failure (corruption-safe rollback)
    - Two-mutation chain (pickDataFolder → changeDataFolder) in React component
    - useState(false) pendingRestart flag → conditional Alert banner
    - Alert shadcn pattern (alert.tsx created from scratch — component missing)
key_files:
  created:
    - src/renderer/src/components/ui/alert.tsx
  modified:
    - src/main/trpc/routers/appPrefs.ts (getCurrentDataFolder, pickDataFolder, changeDataFolder)
    - src/main/trpc/routers/appPrefs.test.ts (8 new tests)
    - src/renderer/src/screens/SettingsScreen.tsx (Data section)
decisions:
  - "sqlite.backup() used over fs.copyFile for WAL-safe database migration per RESEARCH.md Section 3 Landmine 2. backupRotation.ts uses copyFile only because it runs before the DB opens (WAL inactive). changeDataFolder runs while DB is open and WAL-active — backup is mandatory."
  - "Alert component created manually (alert.tsx) using shadcn/ui pattern — the component was missing from the ui/ directory despite being listed in components.json. Avoids installing @radix-ui/react-alert (which does not exist); alert is a pure HTML div component."
  - "Two-mutation chain: pickDataFolder (OS dialog) then changeDataFolder (backup) kept as separate tRPC procedures. This preserves the architectural boundary — main process owns both dialog and SQLite; renderer just calls the chain."
  - "path.join() used in tests instead of hardcoded Unix paths — Windows path separator (\\ vs /) would cause false test failures on this platform."
metrics:
  duration: "~20min"
  completed_date: "2026-06-02"
---

# Phase 8 Plan 06: Data Folder Migration (DIST-04) Summary

WAL-safe SQLite data folder migration via `sqlite.backup()` + `PRAGMA integrity_check` + restart-required flow; three new appPrefs tRPC procedures; SettingsScreen Data section completed with path display, Change Folder button, and conditional restart banner.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | appPrefs migration procedure tests (failing) | ccfe1ac | appPrefs.test.ts |
| 1 (GREEN) | appPrefs router — changeDataFolder / getCurrentDataFolder / pickDataFolder | 7aed251 | appPrefs.ts, appPrefs.test.ts |
| 2 | SettingsScreen Data section + Alert component | f17093f | SettingsScreen.tsx, alert.tsx |

## Verification

- `npm run test -- --run appPrefs`: 11/11 tests pass (including all 8 new migration tests)
- `npm run typecheck`: exits 0
- Full test suite: 125 pre-existing failures (better-sqlite3 ABI mismatch system Node 137 vs Electron ABI 145 — pre-existing, not plan-related); appPrefs and all non-sqlite tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Component] Created Alert component**
- **Found during:** Task 2
- **Issue:** `alert.tsx` did not exist in `src/renderer/src/components/ui/` despite being listed in the 08-UI-SPEC.md component inventory. The SettingsScreen Data section requires it for the "Restart Required" banner.
- **Fix:** Created `src/renderer/src/components/ui/alert.tsx` using the standard shadcn/ui pattern (cva-based variants, forwardRef, Alert/AlertTitle/AlertDescription). No new packages needed — uses only React, cva, and the existing `cn` utility.
- **Files modified:** `src/renderer/src/components/ui/alert.tsx` (created)
- **Commit:** f17093f

**2. [Rule 1 - Bug] Fixed Windows path separator in tests**
- **Found during:** Task 1 GREEN verification
- **Issue:** Test assertions used hardcoded Unix paths (`/new/folder/solocampaign.db`) but `path.join()` on Windows produces backslash-separated paths (`\new\folder\solocampaign.db`). 2 tests failed with path mismatch.
- **Fix:** Changed hardcoded Unix path strings in test assertions to `path.join('/new/folder', 'solocampaign.db')` so the comparison is platform-aware.
- **Files modified:** `src/main/trpc/routers/appPrefs.test.ts`
- **Commit:** 7aed251 (incorporated in GREEN commit)

## Known Stubs

None — the Data section is fully implemented. `changeDataFolder` persists the new path so `initDatabase` uses it on next launch (custom path wiring from 08-01 is already in place).

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's `<threat_model>`:
- T-08-17 (Tampering/Integrity): sqlite.backup() used; PRAGMA integrity_check validates copy; corrupted copy deleted before TRPCError thrown — fully mitigated
- T-08-18 (Tampering): folderPath from OS showOpenDialog (openDirectory) — trusted OS-sourced absolute path; z.string().min(1) validation at tRPC boundary — mitigated
- T-08-19 (DoS): single-user desktop, no remote actor — accepted
- T-08-SC: No new packages (better-sqlite3.backup and electron dialog already available) — accepted

## Self-Check: PASSED

Files exist:
- src/main/trpc/routers/appPrefs.ts: FOUND (contains changeDataFolder, getCurrentDataFolder, pickDataFolder, sqlite.backup(, PRAGMA integrity_check — no copyFile)
- src/main/trpc/routers/appPrefs.test.ts: FOUND (11 tests: 3 original + 8 new)
- src/renderer/src/screens/SettingsScreen.tsx: FOUND (contains Campaign Data Folder, Change Folder..., Restart Required, getCurrentDataFolder, pickDataFolder, changeDataFolder, pendingRestart)
- src/renderer/src/components/ui/alert.tsx: FOUND

Commits exist:
- ccfe1ac: FOUND (test RED)
- 7aed251: FOUND (feat GREEN)
- f17093f: FOUND (feat Task 2)
