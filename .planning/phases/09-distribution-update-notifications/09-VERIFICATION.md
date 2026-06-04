---
phase: 09-distribution-update-notifications
verified: 2026-06-04T01:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 10/10
  gaps_closed:
    - "Plan 04 go-live deferred item: public repo Bgarrison84/solocampaign created, v0.1.0 released with 3 platform artifacts + update manifests"
    - "Plan 05 WR-04 fix applied: UpdateBanner checkForUpdate useQuery now has retry: false"
    - "Plan 05 CR-01 through CR-04 all confirmed present in source"
    - "Slug corrected in evidence: briston/solocampaign updated to Bgarrison84/solocampaign throughout"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Launch the app locally against a mock or real GitHub tag higher than the running version and confirm the UpdateBanner appears"
    expected: "A narrow Alert strip appears below the TitleBar reading 'SoloCampaign {version} is available — Download'"
    why_human: "Banner renders only when checkForUpdate returns available:true from a live or mocked GitHub API response; cannot assert rendering without running the Electron app"
  - test: "Click the Download link in the UpdateBanner"
    expected: "The GitHub Release page opens in the system default browser"
    why_human: "shell.openExternal behaviour requires a running Electron process; cannot trigger from grep/tsc"
  - test: "Click the dismiss button (X) in the UpdateBanner, then restart the app"
    expected: "The banner does not reappear for the same version after restart (dismissedUpdateVersion persisted)"
    why_human: "Persistence across restarts requires the Electron app to write and re-read electron-store; not verifiable statically"
---

# Phase 9: Distribution & Update Notifications Verification Report

**Phase Goal:** A user can download an (unsigned) SoloCampaign installer for their OS from a public GitHub Release, install it cleanly, and see a dismissible in-app banner on startup when a newer version is available — clicking it opens the GitHub Release page in the browser.
**Verified:** 2026-06-04T01:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plans 04 + 05 completed this session)

---

## Summary of Changes Since Previous Verification

The prior VERIFICATION.md (2026-06-03) was scoped to Plans 01-03 only (code-complete, 10/10 truths). Two items remained deferred:

- **Plan 04 (go-live):** Deferred pending GitHub authentication. Now complete — public repo `Bgarrison84/solocampaign` exists, v0.1.0 released via CI with Windows NSIS .exe, macOS arm64 .zip, Linux AppImage, and all update manifests.
- **Plan 05 (CR audit + WR-04):** Applied `retry: false` to the `checkForUpdate` useQuery in UpdateBanner.tsx; audited CR-01 through CR-04 all confirmed present.

Human verification item #4 (live CI run) is now closed. Three human verification items remain — all require a running Electron process and are correctly not verifiable statically.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | checkForUpdate returns { available: true, version, releaseUrl } when remote tag is newer than current | VERIFIED | 6/6 unit tests pass (newer/equal/older/network-error/non-ok/prerelease). updateChecker.ts line 27: `GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/Bgarrison84/solocampaign/releases/latest'` |
| 2 | checkForUpdate returns { available: false } on equal/older/pre-release/error conditions | VERIFIED | Same 6-test suite; cases 2-6 all assert the safe fallback shape |
| 3 | appPrefs persists dismissedUpdateVersion and exposes it via get() | VERIFIED | `dismissedUpdateVersion: string | null` key in AppPrefs interface (appPrefs.ts line 28), `null` default (line 38), round-trip confirmed by appPrefs test suite |
| 4 | trpc appPrefs.checkForUpdate query returns UpdateInfo; dismissUpdate mutation writes dismissed version | VERIFIED | Both procedures present in appPrefsRouter; 15/15 appPrefs tests pass |
| 5 | window.shellBridge.openExternal only opens https://github.com/ URLs | VERIFIED | Allow-list guard in preload/index.ts lines 186-189: url.startsWith('https://github.com/') |
| 6 | UpdateBanner renders nothing when no update or when version matches dismissed | VERIFIED | Lines 45-49 UpdateBanner.tsx: `if (!data?.available) return null` + `if (prefs !== undefined && data.version === prefs.dismissedUpdateVersion) return null` |
| 7 | UpdateBanner shows correct text, Download link, and dismiss button when update available | VERIFIED | Lines 63-89 UpdateBanner.tsx: 'SoloCampaign {data.version} is available', handleDownload via shellBridge, Button with aria-label="Dismiss update notification" |
| 8 | App.tsx renders UpdateBanner between TitleBar and main content | VERIFIED | App.tsx: import at line 8, `<UpdateBanner />` at line 14 between TitleBar and main |
| 9 | electron-builder produces macOS arm64 .zip with identity: null; win/linux/asarUnpack preserved | VERIFIED | electron-builder.yml mac section: `identity: null`, `target: zip`, `arch: arm64`; asarUnpack contains `**/node_modules/better-sqlite3/**`; win (nsis) and linux (AppImage) sections unchanged |
| 10 | release.yml triggers on v* tags, builds 3 platforms via matrix, publishes one Release via aggregator | VERIFIED | release.yml: `on: push: tags: ['v*']`; matrix includes windows-latest/macos-latest/ubuntu-latest; `publish` job `needs: [build]`; uses download-artifact@v4 + softprops/action-gh-release@v2. CR-03 confirmed: `latest*.yml` (line 95) and `*.blockmap` (line 96) in files glob |
| 11 | A public GitHub Release v0.1.0 is live with Windows, macOS, and Linux artifacts | VERIFIED | Repo `Bgarrison84/solocampaign` public; v0.1.0 published 2026-06-03T23:34:04Z via CI run (5m25s, success). Artifacts: SoloCampaign.Setup.0.1.0.exe, SoloCampaign-0.1.0-arm64-mac.zip, SoloCampaign-0.1.0.AppImage, latest.yml, latest-linux.yml, latest-mac.yml, .blockmap files |
| 12 | UpdateBanner checkForUpdate useQuery has retry: false (fire-and-forget per D-04) | VERIFIED | UpdateBanner.tsx line 28: `retry: false,` present in the checkForUpdate useQuery; second useQuery (appPrefs.get, local SQLite) correctly has no retry: false |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/services/updateChecker.ts` | Pure checkForUpdate service exporting UpdateInfo | VERIFIED | 98 lines, exports `checkForUpdate` and `UpdateInfo`, GITHUB_RELEASES_API_URL = `Bgarrison84/solocampaign`, User-Agent header, AbortController, NaN guard for both remote (ma/mi/pa) and local (ca/ci/cp) version parts |
| `src/main/services/updateChecker.test.ts` | 6 unit tests using vi.stubGlobal('fetch') | VERIFIED | 168 lines, 6 `it(` cases covering all contract branches |
| `src/main/trpc/routers/appPrefs.ts` | dismissedUpdateVersion key + checkForUpdate query + dismissUpdate mutation + backup cleanup | VERIFIED | Contains `dismissedUpdateVersion: string | null`, both procedures, dynamic import of updateChecker, `await unlink(newDbPath).catch` at lines 156 and 169 (CR-02) |
| `src/preload/index.ts` | window.shellBridge.openExternal with https://github.com/ allow-list | VERIFIED | shellBridge exposed at line 184; guard at lines 186-189 |
| `src/renderer/src/types/aiStream.d.ts` | Window.shellBridge TypeScript declaration + sessionRecap | VERIFIED | Lines 106-117: shellBridge declaration; lines 122-130: sessionRecap block with startStream/onToken/onFinish/onError/removeAllListeners (CR-04) |
| `src/renderer/src/components/UpdateBanner.tsx` | Dismissible update banner wired to tRPC; retry: false on checkForUpdate query | VERIFIED | 90 lines, exports UpdateBanner, retry: false at line 28, nil-render guards at lines 46 and 49, shellBridge wired at line 53 |
| `src/renderer/src/App.tsx` | UpdateBanner inserted above main content | VERIFIED | Line 8: import; line 14: `<UpdateBanner />` between TitleBar and main |
| `electron-builder.yml` | macOS zip target with identity: null + arm64; preserved win/linux/asarUnpack | VERIFIED | All conditions met |
| `.github/workflows/release.yml` | Tag-triggered matrix build + aggregator publish + latest*.yml + .blockmap | VERIFIED | on: push: tags: ['v*']; 3-platform matrix; publish job; latest*.yml (line 95) and .blockmap (line 96) in files glob |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/trpc/routers/appPrefs.ts` | `src/main/services/updateChecker.ts` | dynamic import in checkForUpdate query | WIRED | `await import('../../services/updateChecker')` |
| `src/main/trpc/routers/appPrefs.ts` | appPrefsStore | dismissUpdate writes dismissedUpdateVersion | WIRED | `appPrefsStore.set('dismissedUpdateVersion', input.version)` |
| `src/renderer/src/components/UpdateBanner.tsx` | trpc.appPrefs.checkForUpdate / dismissUpdate | useQuery + useMutation | WIRED | Lines 24-43: useQuery with retry: false + useMutation |
| `src/renderer/src/components/UpdateBanner.tsx` | window.shellBridge.openExternal | Download button onClick | WIRED | Lines 51-55: `window.shellBridge.openExternal(data.releaseUrl)` |
| `src/renderer/src/App.tsx` | UpdateBanner component | import + render above main | WIRED | Line 8 import, line 14 in JSX |
| `.github/workflows/release.yml` | publish job | needs: [build] aggregator | WIRED | `needs: [build]` |
| `.github/workflows/release.yml` | GitHub Release | download-artifact then action-gh-release | WIRED | download-artifact@v4, softprops/action-gh-release@v2 |
| `src/main/services/updateChecker.ts` | `Bgarrison84/solocampaign` GitHub Releases API | GITHUB_RELEASES_API_URL constant | WIRED | Constant at line 27 matches package.json repository.url (`Bgarrison84/solocampaign`) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `UpdateBanner.tsx` | `data` (UpdateInfo) | `trpc.appPrefs.checkForUpdate.query()` → appPrefs router → `checkForUpdate(app.getVersion())` → GitHub API `https://api.github.com/repos/Bgarrison84/solocampaign/releases/latest` | Yes — live HTTPS fetch in production; 6 unit tests with vi.stubGlobal mock | FLOWING |
| `UpdateBanner.tsx` | `prefs.dismissedUpdateVersion` | `trpc.appPrefs.get.query()` → `appPrefsStore.store` → electron-store JSON file | Yes — reads persisted electron-store value, default null until dismissed | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| updateChecker 6-test suite passes | `npm test -- src/main/services/updateChecker.test.ts` | 6/6 tests passed, exit 0 | PASS |
| appPrefs 15-test suite passes (checkForUpdate + dismissUpdate) | `npm test -- src/main/trpc/routers/appPrefs.test.ts` | 15/15 tests passed, exit 0 | PASS |
| TypeScript compiles without errors | `npx tsc --noEmit -p tsconfig.json` | Exit 0, no output | PASS |
| electron-builder.yml structural validity | js-yaml verify script | OK | PASS |
| release.yml structural validity | js-yaml verify script | OK | PASS |
| CR-01 NaN guard for ca/ci/cp | `grep "isNaN(ca) || isNaN(ci) || isNaN(cp)" updateChecker.ts` | Found at line 81 | PASS |
| CR-02 backup cleanup in appPrefs.ts | `grep "await unlink(newDbPath).catch" appPrefs.ts` | Found at lines 156 and 169 | PASS |
| CR-03 latest*.yml + .blockmap in release.yml | `grep "latest\*.yml\|\.blockmap" release.yml` | Found at lines 95-96 | PASS |
| CR-04 sessionRecap in aiStream.d.ts | `grep "sessionRecap" aiStream.d.ts` | Found at lines 122-124 | PASS |
| WR-04 retry: false in UpdateBanner | `grep "retry: false" UpdateBanner.tsx` | Found at line 28 | PASS |
| Second useQuery (appPrefs.get) unchanged — no retry: false | Manual scan UpdateBanner.tsx lines 32-35 | No `retry: false` in second useQuery | PASS |
| smoke.yml unchanged (D-07) | Source unchanged from Plans 01-03 verification | No changes | PASS |
| v0.1.0 GitHub Release live | Plan 04 SUMMARY: CI run completed / success in 5m25s; 3 platform artifacts + manifests published | Published 2026-06-03T23:34:04Z | PASS |
| Slug consistency: package.json matches updateChecker.ts | package.json repository.url = `Bgarrison84/solocampaign`; updateChecker.ts line 27 = `Bgarrison84/solocampaign` | Match confirmed | PASS |

---

### Probe Execution

No probe scripts declared or found in this phase. Step 7c: SKIPPED (no probe scripts).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DIST-05 | 09-01, 09-02, 09-03, 09-04, 09-05 | App notifies the user when a new version is available on GitHub; user downloads and installs manually | SATISFIED | updateChecker service + appPrefs tRPC procedures (Plan 01); shellBridge + UpdateBanner + App.tsx wiring (Plan 02); electron-builder.yml + release.yml CI pipeline (Plan 03); public repo + v0.1.0 release live (Plan 04); CR-01–CR-04 confirmed + WR-04 retry: false applied (Plan 05) |

---

### Anti-Patterns Found

No anti-patterns found. Scanned all files modified by this phase (updateChecker.ts, updateChecker.test.ts, appPrefs.ts, preload/index.ts, aiStream.d.ts, UpdateBanner.tsx, App.tsx, electron-builder.yml, release.yml) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers — none present.

No stub indicators: all data paths flow to real implementations. WR-04 removes the D-04 compliance gap (retry storm on GitHub API unavailability).

---

### Human Verification Required

#### 1. Update banner appears in running app

**Test:** Launch the app locally while configured to report a version lower than the latest GitHub release tag (or mock the tRPC checkForUpdate response to return { available: true, version: '99.0.0', releaseUrl: 'https://github.com/Bgarrison84/solocampaign/releases/tag/v99.0.0' }).
**Expected:** A narrow Alert strip appears below the TitleBar reading "SoloCampaign 99.0.0 is available — Download" with an X dismiss button at the right.
**Why human:** The banner renders conditionally on a live tRPC query response; asserting React rendering output requires a running Electron app.

#### 2. Download button opens GitHub Release page in browser

**Test:** With the banner visible, click the "Download" link.
**Expected:** The system default browser opens to the GitHub Release page URL (https://github.com/Bgarrison84/solocampaign/releases/...).
**Why human:** `shell.openExternal` requires a running Electron main process; the preload URL guard cannot be exercised by static analysis.

#### 3. Dismiss persists across restarts

**Test:** Click the X dismiss button on the UpdateBanner, quit the app, relaunch it.
**Expected:** The banner does not reappear for the same version (dismissedUpdateVersion stored in electron-store survives restart).
**Why human:** Persistence across process restarts requires running the Electron app and verifying state written to the userData directory.

---

### Gaps Summary

No gaps found. All 12 observable truths are verified by direct code inspection, passing test suites, TypeScript compilation, structural script validation, and live GitHub Release confirmation. The three remaining items above require a running Electron process and are correctly classified as human verification items rather than code gaps.

The phase goal is code-complete and live:
- The code path from GitHub API → updateChecker → tRPC → UpdateBanner → shellBridge → browser is fully implemented and wired.
- The public GitHub Release v0.1.0 at `Bgarrison84/solocampaign` provides the download artifact.
- The release pipeline (release.yml) is live and has successfully published one release.
- The WR-04 fire-and-forget compliance fix (retry: false) is in master; it will ship in v0.1.1.

---

_Verified: 2026-06-04T01:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — Plans 04 + 05 completed this session_
