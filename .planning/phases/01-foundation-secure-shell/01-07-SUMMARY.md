---
plan: "01-07"
phase: 1
title: "Packaged Build Smoke Tests + CI Matrix"
subsystem: ci
tags: [smoke-test, ci, packaging, electron-builder, github-actions]
dependency_graph:
  requires: ["01-04", "01-05", "01-06"]
  provides: ["packaged-build-verification", "ci-matrix"]
  affects: []
tech_stack:
  added: []
  patterns:
    - "PowerShell smoke script (pwsh -File) for Windows packaged build verification"
    - "Bash smoke scripts with set -u for macOS and Linux verification"
    - "GitHub Actions matrix strategy with fail-fast: false"
    - "AppImage extraction via --appimage-extract for static ASAR checks without FUSE"
    - "Xvfb virtual display for Linux headless GUI testing"
key_files:
  created:
    - scripts/smoke/smoke.win.ps1
    - scripts/smoke/smoke.mac.sh
    - scripts/smoke/smoke.linux.sh
    - .github/workflows/smoke.yml
  modified: []
decisions:
  - "Linux smoke script uses AppImage extraction (--appimage-extract) as primary path and linux-unpacked as fallback to avoid FUSE dependency for static checks"
  - "CSC_IDENTITY_AUTO_DISCOVERY=false + SKIP_NOTARIZE=true in CI per D-03 (no code signing)"
  - "concurrency group cancels in-progress smoke runs on new push to same branch — avoids wasted CI minutes"
  - "fail-fast: false in matrix so all platforms report independently — one platform failure doesn't mask others"
metrics:
  duration: "5 minutes"
  completed: "2026-05-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 0
---

# Phase 1 Plan 07: Packaged Build Smoke Tests + CI Matrix Summary

**One-liner:** Three-platform smoke test scripts (Windows PS1, macOS bash, Linux bash) plus a GitHub Actions CI matrix that builds, packages, and verifies SoloCampaign on windows-latest, macos-latest, and ubuntu-latest — closing FOUND-01's packaged-build verification gap.

## What Was Built

### scripts/smoke/smoke.win.ps1
Windows PowerShell smoke script with 7 checks:
1. NSIS installer `.exe` exists in `dist/`
2. `win-unpacked\SoloCampaign.exe` exists
3. `better-sqlite3` `.node` file in `app.asar.unpacked\node_modules\better-sqlite3`
4. Drizzle migration SQL at `win-unpacked\resources\migrations\0000_absent_thunderball.sql`
5. Packaged app launches without immediate crash (running after 6s)
6. Single-instance lock — second process exits within 3s
7. `solocampaign.db` created in `%APPDATA%\SoloCampaign\`

### scripts/smoke/smoke.mac.sh
macOS bash smoke script with 7 checks:
1. `.app` bundle exists at `dist/mac/SoloCampaign.app`
2. Main executable inside `.app` at `Contents/MacOS/SoloCampaign`
3. `better-sqlite3` `.node` in `app.asar.unpacked/node_modules/better-sqlite3`
4. Drizzle migration SQL at `Contents/Resources/migrations/0000_absent_thunderball.sql`
5. Packaged app launches without crash (running after 6s)
6. Single-instance lock (second `open` does not spawn extra process)
7. `solocampaign.db` in `~/Library/Application Support/SoloCampaign/`

### scripts/smoke/smoke.linux.sh
Linux bash smoke script:
1. AppImage artifact found in `dist/`
2. `better-sqlite3` `.node` in `asar.unpacked` (via AppImage extraction or `linux-unpacked` fallback)
3. Drizzle migration SQL present in resources
4. AppImage launches and runs for 6s
5. Single-instance lock (second launch exits)
6. `solocampaign.db` in `~/.config/SoloCampaign/`

### .github/workflows/smoke.yml
GitHub Actions CI matrix:
- Triggers on `push` and `pull_request` to `master`/`main`
- 3-job matrix: `windows-latest`, `macos-latest`, `ubuntu-latest`
- Each job: checkout → Node 20 → `npm ci` → `@electron/rebuild better-sqlite3` → `npm run build` → platform smoke script
- `CSC_IDENTITY_AUTO_DISCOVERY: false` + `SKIP_NOTARIZE: true` (per D-03)
- Linux job: installs `fuse libfuse2 xvfb`, starts Xvfb, sets `DISPLAY=:99`
- Uploads `dist/` on failure for debugging (3-day retention)
- Concurrency group cancels in-progress runs on new pushes

## Commits

| Task | Description | Hash |
|------|-------------|------|
| Task 1 | Windows PowerShell smoke script | c56bd98 |
| Task 2 | macOS and Linux smoke scripts | 0c1f188 |
| Task 3 | GitHub Actions CI matrix | cfda1ee |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Linux asar.unpacked path search improved**
- **Found during:** Task 2 verification
- **Issue:** Initial Linux script searched generically for `*.node` files without the `asar.unpacked` path pattern in the search expression, failing the acceptance criteria grep check
- **Fix:** Added explicit `app.asar.unpacked/node_modules/better-sqlite3/*.node` path pattern as first search strategy, with generic `*.node` as fallback, then `linux-unpacked/resources/app.asar.unpacked/...` as final fallback
- **Files modified:** `scripts/smoke/smoke.linux.sh`
- **Commit:** 0c1f188 (included in same task commit)

## Known Stubs

None — these are test/CI scripts with no UI rendering or data display.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. CI scripts only execute build artifacts produced from this repository's own source code (T-01-07-01 accepted).

## Self-Check: PASSED

- `scripts/smoke/smoke.win.ps1`: EXISTS, contains asar.unpacked, solocampaign.db, exit 1, exit 0
- `scripts/smoke/smoke.mac.sh`: EXISTS, shebang OK, contains asar.unpacked, 0000_absent_thunderball, solocampaign.db
- `scripts/smoke/smoke.linux.sh`: EXISTS, shebang OK, contains asar.unpacked, 0000_absent_thunderball, solocampaign.db
- `.github/workflows/smoke.yml`: EXISTS, all 3 platforms present, CSC_IDENTITY_AUTO_DISCOVERY set, @electron/rebuild present, npm run build present, pull_request trigger, fuse/xvfb Linux step present
- Commits c56bd98, 0c1f188, cfda1ee all present in git log
