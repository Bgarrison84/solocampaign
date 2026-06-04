---
plan: 09-04
phase: 09-distribution-update-notifications
status: complete
completed: "2026-06-04T00:00:00Z"
executor: human-assisted
---

# Plan 09-04 Summary: Go-Live — GitHub Repo + v0.1.0 Release

## What Was Built

Created the public GitHub repository `Bgarrison84/solocampaign`, pushed master, and published the first release v0.1.0 by pushing the `v0.1.0` tag which triggered the release CI pipeline.

## Go-Live Outcome

**Repository:** https://github.com/Bgarrison84/solocampaign (public)

**Release v0.1.0:** Published 2026-06-03T23:34:04Z  
CI run: `completed / success` in 5m25s

| Platform | Artifact | Status |
|----------|----------|--------|
| Windows | `SoloCampaign.Setup.0.1.0.exe` + `.blockmap` | Published ✓ |
| macOS | `SoloCampaign-0.1.0-arm64-mac.zip` + `.blockmap` | Published ✓ |
| Linux | `SoloCampaign-0.1.0.AppImage` | Published ✓ |
| Update manifests | `latest.yml`, `latest-linux.yml`, `latest-mac.yml` | Published ✓ |

Release notes include SmartScreen ("More info → Run anyway") and Gatekeeper ("right-click → Open") bypass instructions, plus the `xattr -cr /Applications/SoloCampaign.app` fix for the "app is damaged" warning.

**Slug consistency:** `package.json` repository.url and `updateChecker.ts` GITHUB_RELEASES_API_URL both reference `Bgarrison84/solocampaign` ✓

**Package version:** 0.1.0 (per D-03, not bumped) ✓

## Deviations

**WR-04 not in v0.1.0 binary:** The `retry: false` fix (Plan 09-05) was committed to master after the v0.1.0 tag was pushed. The binary in v0.1.0 lacks this fix; it will be included in v0.1.1.

**Go-live was completed prior to this session:** The tag push and CI run occurred during the Phase 9 execution session before the SUMMARY.md was written. This plan was flagged as deferred in STATE.md but the actual go-live steps had already been completed.

## Key Files

- `.github/workflows/release.yml` — triggered by `v0.1.0` tag push, ran 3-platform matrix build + aggregator publish
- `package.json` — version 0.1.0 (authoritative slug source)
- `src/main/services/updateChecker.ts` — GITHUB_RELEASES_API_URL points to `Bgarrison84/solocampaign`

## Self-Check: PASSED

All acceptance criteria met:
- [x] Public repo `Bgarrison84/solocampaign` exists (`gh repo view` succeeds)
- [x] master branch pushed
- [x] package.json version is `0.1.0` (not bumped)
- [x] v0.1.0 tag exists on remote
- [x] release.yml workflow run: `completed / success`
- [x] Three platform artifacts published: Windows .exe, macOS .zip, Linux AppImage
- [x] Release notes contain SmartScreen + Gatekeeper bypass instructions
- [x] update manifests (latest*.yml) and .blockmap files published (CR-03 / electron-updater compatible)
