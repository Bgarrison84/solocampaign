---
phase: 09-distribution-update-notifications
plan: 03
subsystem: infra
tags: [electron-builder, github-actions, ci-cd, release-pipeline, macos-arm64, nsis, appimage]

# Dependency graph
requires: []
provides:
  - "electron-builder.yml mac target changed to unsigned arm64 .zip"
  - ".github/workflows/release.yml: tag-triggered cross-platform matrix build + aggregator publish"
  - "Release notes template with SmartScreen and Gatekeeper bypass instructions"
affects:
  - 09-distribution-update-notifications

# Tech tracking
tech-stack:
  added:
    - "softprops/action-gh-release@v2 (GitHub Actions CI only)"
    - "actions/upload-artifact@v4 (GitHub Actions CI only)"
    - "actions/download-artifact@v4 (GitHub Actions CI only)"
  patterns:
    - "Aggregator pattern: matrix jobs upload-artifact, single publish job (needs:[build]) creates Release"
    - "Per-platform npm_config_arch via matrix field (arm64 for macos-latest)"

key-files:
  created:
    - ".github/workflows/release.yml"
  modified:
    - "electron-builder.yml"

key-decisions:
  - "identity: null in electron-builder.yml mac section disables macOS code signing in CI (D-01)"
  - "macOS target changed from dir to zip with arch: arm64 (macos-latest runners are Apple Silicon)"
  - "Aggregator publish job (needs: [build]) avoids concurrent Release body-update race (T-09-11)"
  - "npm_config_arch set per matrix entry rather than hardcoded x64 (fixes Pitfall 1)"
  - "Linux FUSE install step drops Xvfb — release build-only, no virtual display needed"
  - "Release notes include xattr quarantine fix for macOS 'app is damaged' case (D-09/Pitfall 5)"

patterns-established:
  - "GitHub Actions aggregator: matrix uploads to upload-artifact, single job downloads + publishes"
  - "electron-builder.yml mac block: identity: null + target: zip + arch: arm64 for unsigned CI builds"

requirements-completed: [DIST-05]

# Metrics
duration: 12min
completed: 2026-06-03
---

# Phase 9 Plan 03: Distribution Pipeline Summary

**Unsigned cross-platform release pipeline: electron-builder macOS .zip (arm64) + GitHub Actions tag-triggered matrix build with aggregator-pattern single-publish job including SmartScreen/Gatekeeper bypass notes**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-03T21:54:00Z
- **Completed:** 2026-06-03T22:06:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Changed electron-builder.yml macOS target from bare `dir` to `zip` with `arch: arm64` and `identity: null` to prevent code-signing failures in unsigned CI builds
- Created `.github/workflows/release.yml` with tag-triggered matrix build (windows-latest, macos-latest, ubuntu-latest) each using per-platform `npm_config_arch`
- Implemented aggregator pattern: matrix jobs upload-artifact, single `publish` job with `needs: [build]` downloads all artifacts and creates one GitHub Release via softprops/action-gh-release@v2
- Release notes template includes Windows SmartScreen "More info → Run anyway", macOS Gatekeeper right-click/open, and `xattr -cr /Applications/SoloCampaign.app` quarantine fix
- smoke.yml left completely untouched (D-07 compliance verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: Change electron-builder macOS target to unsigned zip** - `5520e99` (chore)
2. **Task 2: Create release.yml tag-triggered matrix build + aggregator publish** - `c28e9c2` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `electron-builder.yml` - mac section: added `identity: null`, changed target from `- dir` to `- target: zip` + `arch: arm64`; all other sections (asarUnpack, extraResources, linux, win) preserved
- `.github/workflows/release.yml` - New: tag-triggered release workflow with 3-platform matrix + aggregator publish job

## Decisions Made
- Per-platform `npm_config_arch` in matrix (`arm64` for macOS, `x64` for Windows/Linux) — critical because smoke.yml hardcodes x64 which would produce wrong native module architecture on Apple Silicon runners
- Aggregator pattern chosen over per-job `softprops` publish — avoids documented concurrent body-update race when all three matrix jobs try to create/update the same Release simultaneously
- Linux FUSE step drops Xvfb — release workflow is build-only (no smoke tests), so virtual display is unnecessary
- `permissions: contents: write` scoped to publish job only — least-privilege (T-09-12)
- `retention-days: 1` on upload-artifact — artifacts only need to survive between matrix finish and publish job start, minimal storage cost

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required for the pipeline definition itself. Creating the GitHub repo and pushing the first tag (`v0.1.0`) is deferred to Plan 04.

## Known Stubs
None — this plan is purely CI/build configuration with no UI stubs.

## Threat Flags
None — no new network endpoints, auth paths, or trust boundaries introduced beyond what the plan's threat model already covers (T-09-10 through T-09-13 all handled by plan design: identity: null, aggregator pattern, per-matrix npm_config_arch, permissions: contents: write).

## Next Phase Readiness
- Release pipeline is complete and tag-ready
- Pushing `v0.1.0` tag after repo creation (Plan 04) will trigger the full build matrix
- Plan 01 (update checker) and Plan 02 (UpdateBanner component) are independent parallel deliverables feeding into Plan 04 validation

---
*Phase: 09-distribution-update-notifications*
*Completed: 2026-06-03*
