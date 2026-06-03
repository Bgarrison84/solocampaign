---
phase: 9
slug: distribution-update-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 0 | DIST-05 | T-09-03 / T-09-04 | `checkForUpdate` returns `{ available: false }` on network error | unit | `npm test -- src/main/services/updateChecker.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 0 | DIST-05 | — | `checkForUpdate` returns `{ available: true }` when remote semver is newer | unit | `npm test -- src/main/services/updateChecker.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 0 | DIST-05 | — | `checkForUpdate` returns `{ available: false }` on same version | unit | `npm test -- src/main/services/updateChecker.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-04 | 01 | 0 | DIST-05 | — | `checkForUpdate` ignores pre-release tags | unit | `npm test -- src/main/services/updateChecker.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-05 | 01 | 1 | DIST-05 | T-09-04 | `dismissUpdate` persists `dismissedUpdateVersion` in appPrefs store | unit | `npm test -- src/main/trpc/routers/appPrefs.test.ts` | ✅ (extend) | ⬜ pending |
| 09-01-06 | 01 | 1 | DIST-05 | — | `checkForUpdate` tRPC query returns correct shape via caller | unit | `npm test -- src/main/trpc/routers/appPrefs.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/services/updateChecker.test.ts` — stubs for DIST-05: `checkForUpdate` version comparison, network error handling, pre-release skip
- [ ] Extend `src/main/trpc/routers/appPrefs.test.ts` — add test stubs for `checkForUpdate` query and `dismissUpdate` mutation

*Existing `appPrefs.test.ts` infrastructure covers mock patterns for `electron-store` and `electron` — reuse same mock setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Windows NSIS installer runs, SmartScreen shows "unrecognized publisher", user bypasses via "More info → Run anyway" | DIST-05 | Requires physical Windows machine + unsigned installer build | Download release artifact, run installer, confirm SmartScreen warning appears and app installs cleanly |
| macOS .zip app bundle: Gatekeeper blocks, user bypasses via right-click → Open | DIST-05 | Requires physical macOS machine + unsigned app bundle | Download .zip, extract, attempt to open, confirm Gatekeeper block, confirm right-click → Open works |
| Linux AppImage: `chmod +x` + execute works | DIST-05 | Requires Linux runner or VM | Download AppImage, `chmod +x`, run, confirm app launches |
| UpdateBanner appears on second launch after pushing a higher version tag | DIST-05 | Requires live GitHub release + app running against real API | Launch app with version < latest release, confirm banner appears with correct copy and Download link |
| Dismiss persists across restarts (banner does not reappear for same version) | DIST-05 | Requires UI interaction + app restart | Click ✕ on banner, restart app, confirm banner is gone for same version |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
