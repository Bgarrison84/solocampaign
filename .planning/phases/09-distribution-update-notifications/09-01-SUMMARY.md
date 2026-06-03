---
phase: 09-distribution-update-notifications
plan: "01"
subsystem: update-checker
tags: [tdd, services, trpc, update-notification, dist-05]
dependency_graph:
  requires: []
  provides:
    - updateChecker.ts — checkForUpdate(currentVersion) pure service
    - appPrefs.checkForUpdate tRPC query — GitHub Releases poller via IPC
    - appPrefs.dismissUpdate tRPC mutation — persist dismissed version
    - appPrefs.dismissedUpdateVersion — persisted electron-store key
  affects:
    - src/main/trpc/routers/appPrefs.ts
tech_stack:
  added: []
  patterns:
    - Pure Node service (no electron-log) with AbortController timeout and silent catch
    - Inline 3-part semver comparison with isNaN guard (no semver package)
    - Dynamic import in tRPC query to enable mocking in tests
    - vi.stubGlobal('fetch') pattern for testing global fetch in vitest
key_files:
  created:
    - src/main/services/updateChecker.ts
    - src/main/services/updateChecker.test.ts
  modified:
    - src/main/trpc/routers/appPrefs.ts
    - src/main/trpc/routers/appPrefs.test.ts
decisions:
  - Silent error handling in updateChecker — no electron-log per D-04 (errors are fire-and-forget)
  - Named GITHUB_RELEASES_API_URL constant derived from package.json repository.url for easy patching
  - Dynamic import of updateChecker in tRPC query enables vi.mock isolation in tests
  - NO_UPDATE const for safe fallback instead of repeated object literals
metrics:
  duration: "7 minutes"
  completed: "2026-06-03"
  tasks_completed: 3
  files_created: 2
  files_modified: 2
requirements: [DIST-05]
---

# Phase 9 Plan 01: Update Checker Backend — Main Process Service + tRPC Surface

**One-liner:** Pure `checkForUpdate` GitHub Releases poller with silent error handling wired to `appPrefs` tRPC router via `checkForUpdate` query and `dismissUpdate` mutation backed by `dismissedUpdateVersion` electron-store key.

## What Was Built

### updateChecker.ts service
Pure Node service (no Electron dependencies) that fetches `https://api.github.com/repos/briston/solocampaign/releases/latest` and compares `tag_name` against `currentVersion` passed as a parameter. Returns `UpdateInfo { available, version, releaseUrl }`.

Key behaviors:
- `User-Agent: SoloCampaign-App` header required by GitHub API (Pitfall 4 mitigation)
- `AbortController` with 5000ms timeout (T-09-06 — never blocks startup)
- Pre-release tags (`prerelease: true`) skipped — only stable releases trigger notification
- `isNaN` guard on parsed semver parts (T-09-05 — NaN injection defense)
- All errors caught silently — returns `NO_UPDATE` fallback, never throws

### appPrefs.ts extensions
Three additions to the existing router:
1. `dismissedUpdateVersion: string | null` — new AppPrefs interface key with `null` default
2. `checkForUpdate` query — dynamically imports updateChecker service, calls `app.getVersion()`, returns `UpdateInfo`
3. `dismissUpdate` mutation — Zod-validated `{ version: z.string() }` input, writes `dismissedUpdateVersion` to store (T-09-04)

### Test coverage
- `updateChecker.test.ts` — 6 tests (newer/equal/older/network-error/non-ok/prerelease) using `vi.stubGlobal('fetch')`
- `appPrefs.test.ts` extensions — 5 new tests (default null, checkForUpdate shape, dismissUpdate persistence, dismissed: true return)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | `5448878` | PASSED — 6 tests fail because updateChecker.ts absent |
| GREEN (impl) | `f49156d` | PASSED — all 6 tests pass |
| REFACTOR | n/a | Not needed — implementation was clean first pass |

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Wave 0 — failing unit tests for updateChecker | `5448878` | `updateChecker.test.ts` (created) |
| 2 | Implement updateChecker service (GREEN) | `f49156d` | `updateChecker.ts` (created) |
| 3 | Extend appPrefs router + tests | `feee8f6` | `appPrefs.ts` (modified), `appPrefs.test.ts` (modified) |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new threat surface introduced beyond what the plan's threat model anticipated:

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-09-03 | HTTPS-only URL constant; html_url returned but not acted on (Plan 02 validates) | Implemented |
| T-09-04 | Zod `z.object({ version: z.string() })` before appPrefsStore.set | Implemented |
| T-09-05 | `isNaN` guard returns `NO_UPDATE` fallback on malformed tag_name | Implemented |
| T-09-06 | AbortController 5s timeout; non-ok → fallback; fire-and-forget pattern | Implemented |

## Known Stubs

None — all data paths are wired. The `updateChecker` service is fully functional. Plan 02 will add the renderer UI layer.

## Self-Check: PASSED

- [x] `src/main/services/updateChecker.ts` exists and exports `checkForUpdate` and `UpdateInfo`
- [x] `src/main/services/updateChecker.test.ts` exists with `vi.stubGlobal('fetch'` and 6 tests
- [x] `src/main/trpc/routers/appPrefs.ts` contains `dismissedUpdateVersion`, `checkForUpdate`, `dismissUpdate`
- [x] `src/main/trpc/routers/appPrefs.test.ts` contains `dismissUpdate` and `checkForUpdate` describe blocks
- [x] Commits verified: `5448878`, `f49156d`, `feee8f6`
- [x] `npm test -- src/main/services/updateChecker.test.ts` → 6/6 passed
- [x] `npm test -- src/main/trpc/routers/appPrefs.test.ts` → 15/15 passed (10 existing + 5 new)
- [x] No regressions: pre-existing failures (better-sqlite3 NODE_MODULE_VERSION in non-mocked test files) unchanged at 125 failures
