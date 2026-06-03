---
phase: 09-distribution-update-notifications
verified: 2026-06-03T22:30:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
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
  - test: "Push a v* tag to the repository and observe the GitHub Actions Release workflow"
    expected: "All three matrix build jobs complete, artifacts upload, the publish job downloads them and creates one GitHub Release with SmartScreen/Gatekeeper notes and installer files attached"
    why_human: "Live CI run requires a real GitHub repository and tag push; deferred from Plan 04 per user instruction"
---

# Phase 9: Distribution & Update Notifications Verification Report

**Phase Goal:** A user can download an (unsigned) SoloCampaign installer for their OS from a public GitHub Release, install it cleanly, and see a dismissible in-app banner on startup when a newer version is available — clicking it opens the GitHub Release page in the browser.
**Verified:** 2026-06-03T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Scope note:** Plan 09-04 (go-live: repo creation + v0.1.0 publish) was intentionally deferred and excluded from this verification. Assessment covers code readiness for Plans 01, 02, and 03 only.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | checkForUpdate returns { available: true, version, releaseUrl } when remote tag is newer than current | VERIFIED | 6/6 unit tests pass (newer/equal/older/network-error/non-ok/prerelease) — `npm test -- updateChecker.test.ts` exits 0 |
| 2 | checkForUpdate returns { available: false } on equal/older/pre-release/error conditions | VERIFIED | Same 6-test suite; cases 2-6 all assert the safe fallback shape |
| 3 | appPrefs persists dismissedUpdateVersion and exposes it via get() | VERIFIED | `dismissedUpdateVersion: string | null` key in AppPrefs interface (line 28 appPrefs.ts), `null` default (line 38), round-trip confirmed by test `'get() returns dismissedUpdateVersion: null by default'` in 15-test appPrefs suite |
| 4 | trpc appPrefs.checkForUpdate query returns UpdateInfo; dismissUpdate mutation writes dismissed version | VERIFIED | Both procedures present in appPrefsRouter (lines 205-228 appPrefs.ts); 15/15 appPrefs tests pass including `checkForUpdate` and `dismissUpdate` describe blocks |
| 5 | window.shellBridge.openExternal only opens https://github.com/ URLs | VERIFIED | Allow-list guard in preload/index.ts lines 186-189: `url.startsWith('https://github.com/')` — non-GitHub URLs call `Promise.reject` without reaching shell.openExternal |
| 6 | UpdateBanner renders nothing when no update or when version matches dismissed | VERIFIED | Lines 45-48 UpdateBanner.tsx: `if (!data?.available) return null` + `if (prefs !== undefined && data.version === prefs.dismissedUpdateVersion) return null` |
| 7 | UpdateBanner shows correct text, Download link, and dismiss button when update available | VERIFIED | Lines 66-86 UpdateBanner.tsx: `'SoloCampaign {data.version} is available'`, `onClick={handleDownload}` calling shellBridge, Button with `aria-label="Dismiss update notification"` |
| 8 | App.tsx renders UpdateBanner between TitleBar and main content | VERIFIED | App.tsx lines 13-15: `<TitleBar />` then `<UpdateBanner />` then `<main className="flex-1 overflow-hidden">` — correct source order |
| 9 | electron-builder produces macOS arm64 .zip with identity: null; win/linux/asarUnpack preserved | VERIFIED | electron-builder.yml mac section: `identity: null`, `target: zip`, `arch: arm64`; asarUnpack still contains `**/node_modules/better-sqlite3/**`; win (nsis) and linux (AppImage) sections unchanged. Plan verify script: `node -e "..."` prints OK |
| 10 | release.yml triggers on v* tags, builds 3 platforms via matrix, publishes one Release via aggregator | VERIFIED | release.yml: `on: push: tags: ['v*']`; matrix includes windows-latest/macos-latest/ubuntu-latest with per-platform npm_config_arch; `publish` job `needs: [build]`; uses `actions/download-artifact@v4` + `softprops/action-gh-release@v2`. Release body contains `xattr -cr /Applications/SoloCampaign.app` and SmartScreen "Run anyway". Plan verify script prints OK |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/services/updateChecker.ts` | Pure checkForUpdate service exporting UpdateInfo | VERIFIED | 98 lines, exports `checkForUpdate` and `UpdateInfo`, contains GITHUB_RELEASES_API_URL constant, User-Agent header, AbortController, NaN guard, silent catch |
| `src/main/services/updateChecker.test.ts` | 6 unit tests using vi.stubGlobal('fetch') | VERIFIED | 168 lines, contains `vi.stubGlobal('fetch'`, 6 `it(` cases covering all contract branches |
| `src/main/trpc/routers/appPrefs.ts` | dismissedUpdateVersion key + checkForUpdate query + dismissUpdate mutation | VERIFIED | Contains `dismissedUpdateVersion: string | null` in interface, both procedures, dynamic import of updateChecker |
| `src/preload/index.ts` | window.shellBridge.openExternal with https://github.com/ allow-list | VERIFIED | shellBridge exposed at line 184; guard at lines 186-189 |
| `src/renderer/src/types/aiStream.d.ts` | Window.shellBridge TypeScript declaration | VERIFIED | Lines 106-117: `shellBridge: { openExternal(url: string): Promise<void> }` in Window interface |
| `src/renderer/src/components/UpdateBanner.tsx` | Dismissible update banner wired to tRPC | VERIFIED | 89 lines, exports `UpdateBanner`, two useQuery + useMutation pattern, nil-render guards, shellBridge wired |
| `src/renderer/src/App.tsx` | UpdateBanner inserted above main content | VERIFIED | Line 8: import; line 14: `<UpdateBanner />` between TitleBar and main |
| `electron-builder.yml` | macOS zip target with identity: null + arm64; preserved win/linux/asarUnpack | VERIFIED | All conditions met, js-yaml verify script prints OK |
| `.github/workflows/release.yml` | Tag-triggered matrix build + aggregator publish | VERIFIED | All conditions met, js-yaml verify script prints OK |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/trpc/routers/appPrefs.ts` | `src/main/services/updateChecker.ts` | dynamic import in checkForUpdate query | WIRED | Line 206: `await import('../../services/updateChecker')` |
| `src/main/trpc/routers/appPrefs.ts` | appPrefsStore | dismissUpdate writes dismissedUpdateVersion | WIRED | Line 226: `appPrefsStore.set('dismissedUpdateVersion', input.version)` |
| `src/renderer/src/components/UpdateBanner.tsx` | trpc.appPrefs.checkForUpdate / dismissUpdate | useQuery + useMutation | WIRED | Lines 26, 38: `trpc.appPrefs.checkForUpdate.query()` and `trpc.appPrefs.dismissUpdate.mutate(...)` |
| `src/renderer/src/components/UpdateBanner.tsx` | window.shellBridge.openExternal | Download button onClick | WIRED | Lines 51-53: `window.shellBridge.openExternal(data.releaseUrl)` |
| `src/renderer/src/App.tsx` | UpdateBanner component | import + render above main | WIRED | Line 8 import, line 14 `<UpdateBanner />` in JSX |
| `.github/workflows/release.yml` | publish job | needs: [build] aggregator | WIRED | `needs: [build]` at line 74 |
| `.github/workflows/release.yml` | GitHub Release | download-artifact then action-gh-release | WIRED | download-artifact@v4 at line 81, softprops/action-gh-release@v2 at line 87 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `UpdateBanner.tsx` | `data` (UpdateInfo) | `trpc.appPrefs.checkForUpdate.query()` → appPrefs router → `checkForUpdate(app.getVersion())` → GitHub API `https://api.github.com/repos/briston/solocampaign/releases/latest` | Yes — live HTTPS fetch in production; unit-tested with vi.stubGlobal('fetch') mock | FLOWING |
| `UpdateBanner.tsx` | `prefs.dismissedUpdateVersion` | `trpc.appPrefs.get.query()` → `appPrefsStore.store` → electron-store JSON file | Yes — reads persisted electron-store value, default null until dismissed | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| updateChecker 6-test suite passes | `npm test -- src/main/services/updateChecker.test.ts` | 6/6 tests passed, exit 0 | PASS |
| appPrefs 15-test suite passes (including new checkForUpdate + dismissUpdate tests) | `npm test -- src/main/trpc/routers/appPrefs.test.ts` | 15/15 tests passed, exit 0 | PASS |
| TypeScript compiles without errors | `npx tsc --noEmit -p tsconfig.json` | Exit 0, no output | PASS |
| electron-builder.yml structural validity | `node -e "..."` js-yaml verify | OK | PASS |
| release.yml structural validity | `node -e "..."` js-yaml verify | OK | PASS |
| smoke.yml unchanged (D-07) | `git diff --stat .github/workflows/smoke.yml` | No output (no changes) | PASS |

---

### Probe Execution

No probe scripts declared or found in this phase. Step 7c: SKIPPED (no probe scripts; live CI verification deferred to Plan 04 per user instruction).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DIST-05 | 09-01, 09-02, 09-03 | App notifies the user when a new version is available on GitHub; user downloads and installs manually | SATISFIED (code-complete) | updateChecker service + appPrefs tRPC procedures (Plan 01); shellBridge + UpdateBanner + App.tsx wiring (Plan 02); electron-builder macOS zip + release.yml CI pipeline (Plan 03). Live GitHub publish deferred (Plan 04). |

---

### Anti-Patterns Found

No anti-patterns found. Scanned all files modified by this phase (updateChecker.ts, updateChecker.test.ts, appPrefs.ts, preload/index.ts, aiStream.d.ts, UpdateBanner.tsx, App.tsx, electron-builder.yml, release.yml) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers — none present.

No stub indicators: all data paths flow to real implementations (no `return []`, `return {}`, `return null` as final renders without data).

---

### Human Verification Required

#### 1. Update banner appears in running app

**Test:** Launch the app locally while configured to report a version lower than the latest GitHub release tag (or mock the tRPC checkForUpdate response to return { available: true, version: '99.0.0', releaseUrl: 'https://github.com/briston/solocampaign/releases/tag/v99.0.0' }).
**Expected:** A narrow Alert strip appears below the TitleBar reading "SoloCampaign 99.0.0 is available — Download" with an X dismiss button at the right.
**Why human:** The banner renders conditionally on a live tRPC query response; asserting React rendering output requires a running Electron app.

#### 2. Download button opens GitHub Release page in browser

**Test:** With the banner visible, click the "Download" link.
**Expected:** The system default browser opens to the GitHub Release page URL.
**Why human:** `shell.openExternal` requires a running Electron main process; the preload URL guard cannot be exercised by static analysis.

#### 3. Dismiss persists across restarts

**Test:** Click the X dismiss button on the UpdateBanner, quit the app, relaunch it.
**Expected:** The banner does not reappear for the same version (dismissedUpdateVersion stored in electron-store survives restart).
**Why human:** Persistence across process restarts requires running the Electron app and verifying state written to the userData directory.

#### 4. Live GitHub Actions release pipeline

**Test:** Create the GitHub repository, push a v0.1.0 tag.
**Expected:** The release.yml workflow triggers, all three matrix build jobs complete, the publish job creates one GitHub Release with .exe, .zip, and .AppImage artifacts attached, and the release notes body includes the SmartScreen/Gatekeeper bypass instructions.
**Why human:** Live CI run requires repository creation and tag push (Plan 04, deferred per user instruction — requires GitHub authentication checkpoint).

---

### Gaps Summary

No gaps found. All 10 observable truths are verified by direct code inspection, passing test suites, TypeScript compilation, and structural script validation. The four items above require a running Electron process or live CI and are correctly classified as human verification items rather than code gaps.

---

_Verified: 2026-06-03T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
