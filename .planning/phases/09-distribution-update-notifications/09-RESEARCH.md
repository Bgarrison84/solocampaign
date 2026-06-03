# Phase 9: Distribution & Update Notifications - Research

**Researched:** 2026-06-03
**Domain:** Electron cross-platform packaging, GitHub Actions CI/CD, GitHub API update checking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Ship unsigned v1.0 — no code signing. Windows SmartScreen + macOS Gatekeeper block documented in release notes. No Azure Trusted Signing or Apple Developer enrollment.
- **D-02:** Windows → NSIS `.exe`, macOS → `.zip` app bundle, Linux → AppImage only. Update `electron-builder.yml` accordingly.
- **D-03:** Version stays `0.1.0`. First tag is `v0.1.0`.
- **D-04:** GitHub API poll on startup — no `electron-updater`. On launch, fetch `https://api.github.com/repos/{owner}/{repo}/releases/latest` (unauthenticated). Compare `tag_name` (strip leading `v`) against `app.getVersion()`. Error/timeout is silent.
- **D-05:** In-app dismissible banner above main content: "SoloCampaign {newVersion} is available — [Download]". Clicking "Download" opens `html_url` via `shell.openExternal()`. Dismissed state persisted in `appPrefs` electron-store as `dismissedUpdateVersion`. Banner cleared when a newer-than-dismissed version is found.
- **D-06:** Public GitHub repo to be created as part of this phase. Phase 9 must include: create repo, push master, publish first release (`v0.1.0`).
- **D-07:** Separate `release.yml` triggered by `on: push: tags: ['v*']`. Existing `smoke.yml` untouched.
- **D-08:** Matrix build — `windows-latest`, `macos-latest`, `ubuntu-latest`. Each runner: `npm ci` + rebuild `better-sqlite3` + `npm run build` with `CSC_IDENTITY_AUTO_DISCOVERY=false` and `SKIP_NOTARIZE=true`. Upload artifacts via `softprops/action-gh-release`. Draft first; publish after all three succeed.
- **D-09:** Release notes include SmartScreen/Gatekeeper bypass instructions.

### Claude's Discretion

- Exact GitHub API call implementation (fetch in main process, caching strategy, timeout value)
- Banner component placement in React tree (above router outlet, below TitleBar)
- `appPrefs` key name for dismissed version (e.g., `dismissedUpdateVersion`)
- Whether release workflow uses `softprops/action-gh-release`, `gh release`, or another upload mechanism
- Draft-release vs. pre-release flag strategy

### Deferred Ideas (OUT OF SCOPE)

- Code signing (Windows Azure Trusted Signing + macOS notarization) — deferred from v1.0
- macOS hardened runtime entitlements for better-sqlite3 — deferred with signing
- `.deb` Linux package — AppImage-only for v1.0
- `electron-updater` with delta updates — deferred until signing is in place
- Snap / Flatpak — deferred indefinitely

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIST-05 | App notifies the user when a new version is available on GitHub; user downloads and installs manually | GitHub API poll pattern (D-04), dismissible banner (D-05), `shell.openExternal` for download link |

</phase_requirements>

---

## Summary

Phase 9 has two independent workstreams that can largely be parallelized: (1) the release pipeline — configuring `electron-builder.yml`, writing `release.yml`, creating the GitHub repo, and publishing `v0.1.0`; (2) the update notification feature — a tRPC `app.checkForUpdate` query, a `dismissedUpdateVersion` key in `appPrefsStore`, a `shell.openExternal` IPC surface in the preload, and a `<UpdateBanner>` React component inserted above the router `<Outlet />` in `App.tsx`.

The project already has the complete pattern: `smoke.yml` demonstrates the exact rebuild + build sequence that `release.yml` must follow. The `appPrefsStore` is already wired in `appPrefs.ts`. The `alert.tsx` shadcn component is already in the codebase. The main challenge is getting the `electron-builder.yml` macOS target right (change `dir` to `zip`), handling the macOS runner arch correctly in CI (the smoke.yml hardcodes `npm_config_arch: x64` which must be revisited for `macos-latest` arm64 runners), and implementing a correct concurrent-upload strategy for the release workflow so all three platform artifacts appear before the release publishes.

The update-check feature is purely additive: a new tRPC procedure in the `appPrefs` router, a new preload surface for `shell.openExternal`, and a new React component. No existing code is modified except `appPrefs.ts` (add key), `preload/index.ts` (add `shell.openExternal`), and `App.tsx` (insert banner).

**Primary recommendation:** Follow the exact `smoke.yml` build pattern for `release.yml`; use the aggregator pattern (upload-artifact in matrix jobs, single publish job with `needs:`) to avoid race conditions; implement update check as a tRPC query in `appPrefs` router returning `{ available: boolean; version: string | null; releaseUrl: string | null }`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GitHub API fetch (update check) | Main process (Node) | — | CORS-free in main; CSP in renderer blocks external fetch; existing pattern in codebase |
| Update state (available version) | Renderer (React/Zustand) | Main (query result) | tRPC query result flows to renderer; Zustand stores `updateInfo` for banner display |
| Banner display | Renderer (React) | — | Pure UI concern; `<UpdateBanner>` above `<Outlet />` in `App.tsx` |
| Dismiss persistence | Main process (electron-store) | — | All `appPrefsStore` writes live in main; `dismissedUpdateVersion` key added here |
| `shell.openExternal` | Main process (Electron API) | Preload bridge | Electron's `shell` only exists in main; exposed via narrow contextBridge surface |
| Installer packaging | CI (GitHub Actions) | — | `electron-builder` runs on each platform runner |
| Artifact upload | CI (GitHub Actions) | — | `softprops/action-gh-release` + aggregator job to avoid race conditions |
| Release notes | CI (GitHub Actions) | — | Hardcoded template in `release.yml` body field; D-09 |

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-builder | 26.x (26.8.1 installed) | Cross-platform packaging — NSIS/zip/AppImage | Already in devDependencies; project standard |
| electron-store | 10.x | `dismissedUpdateVersion` persistence | Already used for `appPrefsStore`; no new dependency |
| @electron/rebuild | 4.0.4 installed | Rebuild better-sqlite3 against Electron ABI | Already in devDependencies; used in smoke.yml |
| Node.js `fetch` (built-in) | Node 24 (built-in) | GitHub API call from main process | Native since Node 21; no new dependency |
| shadcn Alert | (copy-in, in codebase) | Update banner UI | `alert.tsx` already in `src/renderer/src/components/ui/` |
| electron-trpc | 0.7.1 (installed) | `checkForUpdate` tRPC query | Existing IPC pattern for all main-process operations |

### Supporting (new in this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `softprops/action-gh-release` | v2 | Upload artifacts to GitHub Release from CI | GitHub Actions release workflow |
| `actions/upload-artifact` | v4 | Stage artifacts from matrix jobs before aggregator | In matrix build jobs (avoids race conditions) |
| `actions/download-artifact` | v4 | Download staged artifacts in aggregator job | In the aggregator publish job |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Aggregator pattern | Direct upload in each matrix job with `softprops` | Race condition risk: body-update race is a documented issue when all three jobs hit the API simultaneously; aggregator is safer |
| Inline simple version compare | `semver` package | semver [OK] per slopcheck but is only a transitive dep (v6.3.1); inline comparison is cleaner for a simple major.minor.patch check |
| `shell.openExternal` via new IPC | tRPC mutation | Either works; preload contextBridge surface matches existing pattern for narrow API exposure |

**Installation:** No new npm dependencies required for Phase 9. All packages already installed.

---

## Package Legitimacy Audit

Phase 9 introduces no new npm packages. The CI workflow uses GitHub Actions (not npm packages). The only packages touched are:
- `electron-builder` — already in project, [VERIFIED: npm registry], 8+ years, weekly downloads in millions
- `@electron/rebuild` — already in project, [VERIFIED: npm registry], official Electron org package
- `electron-store` — already in project, [VERIFIED: npm registry]

**New CI actions referenced:**
| Action | Registry | Notes | slopcheck | Disposition |
|--------|----------|-------|-----------|-------------|
| `softprops/action-gh-release@v2` | GitHub Marketplace | Well-known, 10+ years, used by major projects | N/A (GitHub Action) | Approved |
| `actions/upload-artifact@v4` | GitHub (official) | Official GitHub Actions team | N/A (official) | Approved |
| `actions/download-artifact@v4` | GitHub (official) | Official GitHub Actions team | N/A (official) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Tag push (v*)
     |
     v
GitHub Actions release.yml
     |
     +---> [windows-latest] npm ci + rebuild + build --> upload-artifact (NSIS .exe)
     +---> [macos-latest]   npm ci + rebuild + build --> upload-artifact (.zip)
     +---> [ubuntu-latest]  npm ci + rebuild + build --> upload-artifact (AppImage)
     |
     v (needs: [build-windows, build-macos, build-linux])
[publish job]
     |
     +---> download-artifact (all 3 artifacts)
     +---> softprops/action-gh-release (create/publish release with all artifacts)

--- Runtime: update check flow ---

App launch
     |
     v
main/index.ts (app.whenReady + window created)
     |
     v
appPrefsRouter.checkForUpdate (tRPC query)
     |
     +---> fetch(GITHUB_API_URL) [main process, Node fetch, no CORS]
     +---> compare tag_name vs app.getVersion()
     +---> return { available, version, releaseUrl }
     |
     v
Renderer: App.tsx useQuery(trpc.appPrefs.checkForUpdate)
     |
     +---> if available && version != dismissedUpdateVersion --> show <UpdateBanner>
     +---> user clicks "Download" --> window.shellBridge.openExternal(releaseUrl)
     +---> user clicks "X" --> trpc.appPrefs.dismissUpdate(version)
```

### Recommended Project Structure (new files only)

```
src/
├── main/
│   ├── trpc/
│   │   └── routers/
│   │       └── appPrefs.ts          # Add: checkForUpdate query + dismissUpdate mutation
│   └── services/
│       └── updateChecker.ts         # New: GitHub API fetch logic (pure function, testable)
├── preload/
│   └── index.ts                     # Add: window.shellBridge.openExternal
├── renderer/src/
│   ├── App.tsx                      # Add: <UpdateBanner> above <Routes>
│   └── components/
│       └── UpdateBanner.tsx         # New: shadcn Alert wrapper with dismiss button
.github/
└── workflows/
    └── release.yml                  # New: tag-triggered cross-platform release workflow
electron-builder.yml                 # Modify: mac target dir -> zip
```

### Pattern 1: GitHub API Update Check (tRPC query in appPrefs router)

```typescript
// Source: [ASSUMED] — based on existing tRPC query pattern in appPrefs.ts

// src/main/services/updateChecker.ts
const GITHUB_API_URL = 'https://api.github.com/repos/briston/solocampaign/releases/latest'

export interface UpdateInfo {
  available: boolean
  version: string | null
  releaseUrl: string | null
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout — silent on error

  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: { 'User-Agent': 'SoloCampaign-App' },
      signal: controller.signal,
    })
    if (!res.ok) return { available: false, version: null, releaseUrl: null }

    const data = await res.json() as { tag_name: string; html_url: string; prerelease: boolean }

    // Skip pre-releases (prerelease: true) — only notify on stable releases
    if (data.prerelease) return { available: false, version: null, releaseUrl: null }

    const remoteVersion = data.tag_name.replace(/^v/, '')
    const [ma, mi, pa] = remoteVersion.split('.').map(Number)
    const [ca, ci, cp] = currentVersion.split('.').map(Number)

    if (isNaN(ma) || isNaN(mi) || isNaN(pa)) {
      return { available: false, version: null, releaseUrl: null }
    }

    const isNewer = ma > ca || (ma === ca && mi > ci) || (ma === ca && mi === ci && pa > cp)
    return isNewer
      ? { available: true, version: remoteVersion, releaseUrl: data.html_url }
      : { available: false, version: null, releaseUrl: null }
  } catch {
    return { available: false, version: null, releaseUrl: null }
  } finally {
    clearTimeout(timeout)
  }
}
```

```typescript
// In appPrefs.ts — add to appPrefsRouter:
// Source: [ASSUMED] — follows existing tRPC query pattern

checkForUpdate: t.procedure.query(async () => {
  const { checkForUpdate } = await import('../../services/updateChecker')
  const currentVersion = app.getVersion()
  return checkForUpdate(currentVersion)
}),

dismissUpdate: t.procedure
  .input(z.object({ version: z.string() }))
  .mutation(({ input }) => {
    appPrefsStore.set('dismissedUpdateVersion', input.version)
    return { dismissed: true as const }
  }),
```

### Pattern 2: preload `shell.openExternal` bridge

```typescript
// Source: [ASSUMED] — follows existing contextBridge pattern in preload/index.ts
// Add to src/preload/index.ts:

import { shell } from 'electron'

contextBridge.exposeInMainWorld('shellBridge', {
  /**
   * Open a URL in the user's default browser.
   * Used by UpdateBanner to open the GitHub Release page.
   * T-09-01: URL is sourced from GitHub API response html_url — validated as string
   */
  openExternal: (url: string) => shell.openExternal(url),
})
```

**Note:** Alternatively, expose as a tRPC mutation `appPrefs.openReleaseUrl(url)` that calls `shell.openExternal` in main. Both approaches are valid; the contextBridge surface is simpler and matches `platform` / `appPrefsSync` precedent.

### Pattern 3: UpdateBanner React component

```typescript
// Source: [ASSUMED] — follows shadcn Alert + existing component patterns

// src/renderer/src/components/UpdateBanner.tsx
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { X } from 'lucide-react'
import { trpc } from '../lib/trpc' // existing tRPC client

export function UpdateBanner() {
  const { data } = trpc.appPrefs.checkForUpdate.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // re-check every 10 minutes
  })
  const dismiss = trpc.appPrefs.dismissUpdate.useMutation()
  const { data: prefs } = trpc.appPrefs.get.useQuery()

  if (!data?.available) return null
  if (prefs && data.version === prefs.dismissedUpdateVersion) return null

  return (
    <Alert className="rounded-none border-x-0 border-t-0 py-2">
      <AlertDescription className="flex items-center justify-between">
        <span>
          SoloCampaign {data.version} is available —{' '}
          <button
            className="underline"
            onClick={() => window.shellBridge.openExternal(data.releaseUrl!)}
          >
            Download
          </button>
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dismiss.mutate({ version: data.version! })}
          aria-label="Dismiss update notification"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  )
}
```

### Pattern 4: electron-builder.yml — macOS zip target

```yaml
# Source: [CITED: electron.build/docs/mac/]
# Change mac.target from `dir` to:

mac:
  icon: src/resources/build/icons/icon.icns
  category: public.app-category.games
  identity: null   # D-01: skip code signing
  target:
    - target: zip
      arch: arm64  # macos-latest runner is arm64 (Apple Silicon) as of 2025
```

**Critical:** `identity: null` disables signing on macOS. Without it, electron-builder may attempt signing and fail in unsigned CI. [CITED: electron.build/docs/mac/]

### Pattern 5: release.yml aggregator pattern

```yaml
# Source: [ASSUMED] — aggregator pattern from community research
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    name: Build — ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            artifact_name: windows-artifacts
            npm_config_arch: x64
          - os: macos-latest
            artifact_name: macos-artifacts
            npm_config_arch: arm64   # macos-latest is Apple Silicon arm64 in 2025
          - os: ubuntu-latest
            artifact_name: linux-artifacts
            npm_config_arch: x64

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Rebuild better-sqlite3
        run: npx @electron/rebuild -f -w better-sqlite3
        env:
          npm_config_arch: ${{ matrix.npm_config_arch }}
      - name: Build
        run: npm run build
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: false
          SKIP_NOTARIZE: true
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact_name }}
          path: dist/
          retention-days: 1

  publish:
    name: Publish Release
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts/
          merge-multiple: true
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          draft: false
          generate_release_notes: false
          body: |
            ## SoloCampaign ${{ github.ref_name }}

            ### Installation & Security Warnings

            #### Windows — SmartScreen Warning
            1. Download `SoloCampaign-Setup-*.exe`
            2. When SmartScreen shows "Windows protected your PC", click **More info**
            3. Click **Run anyway**

            #### macOS — Gatekeeper Block
            1. Download and unzip `SoloCampaign-*.zip`
            2. Move `SoloCampaign.app` to `/Applications`
            3. Right-click (or Control-click) → **Open** → **Open** in the confirmation dialog
            4. If you see "app is damaged", run: `xattr -cr /Applications/SoloCampaign.app`

            #### Linux — AppImage
            1. Download `SoloCampaign-*.AppImage`
            2. `chmod +x SoloCampaign-*.AppImage`
            3. Run `./SoloCampaign-*.AppImage`

          files: |
            artifacts/**/*.exe
            artifacts/**/*.zip
            artifacts/**/*.AppImage
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Anti-Patterns to Avoid

- **Calling `shell.openExternal` from the renderer directly:** `shell` is not available in the sandboxed renderer. Must go through the preload bridge.
- **Doing the GitHub API fetch in the renderer process:** The renderer's CSP only allows `connect-src` to specific domains. `api.github.com` is not in the current allow-list. Fetch from main process (no CSP constraints).
- **Uploading from each matrix job directly to GitHub Release with `softprops`:** Race condition in the release body-update API when all three jobs run concurrently. The aggregator pattern (upload-artifact → single publish job) is the documented fix.
- **Using `electron-updater` for notify-only mode:** Overkill — it still downloads the full update manifest. Pure GitHub API fetch is simpler and dependency-free.
- **Blocking app startup on the update check:** The update check must be fire-and-forget. Start the check after `mainWindow` is created; never `await` it in the startup critical path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform installers | Custom packaging scripts | `electron-builder` (already configured) | NSIS installer on Windows requires NSIS toolchain that electron-builder bundles |
| AppImage creation | Manual AppImage tooling | `electron-builder` (target: AppImage) | AppImage tools, runtime, and desktop integration handled automatically |
| Version comparison | Manual string split/compare | Inline 3-number compare (or `semver.gt`) | Edge cases: pre-release tags (v0.2.0-beta.1), invalid tags — inline NaN guard handles these |
| Artifact upload to GitHub | `gh release upload` shell script | `softprops/action-gh-release` | Handles asset replacement, retry, release creation atomically |
| Native module rebuild | Custom node-gyp invocation | `npx @electron/rebuild -f -w better-sqlite3` | Correctly targets Electron ABI; handles platform-specific C++ toolchain |

**Key insight:** The entire release pipeline already exists in `smoke.yml` as a build test. `release.yml` is `smoke.yml` minus the smoke test steps, plus artifact upload and a publish step.

---

## Common Pitfalls

### Pitfall 1: macOS runner arch mismatch — `npm_config_arch: x64` on arm64 runner

**What goes wrong:** The existing `smoke.yml` hardcodes `npm_config_arch: x64` for ALL platforms including macOS. In 2025, `macos-latest` is Apple Silicon (arm64). Rebuilding `better-sqlite3` for x64 on an arm64 runner produces an x64 `.node` binary. The Electron arm64 process then fails to load it at runtime (ABI mismatch between architecture — not version).

**Why it happens:** The smoke test was written when `macos-latest` was x64. GitHub switched `macos-latest` to arm64 (Apple Silicon M1) in 2024/2025.

**How to avoid:** In `release.yml`, set `npm_config_arch: arm64` for the macOS matrix entry. In `electron-builder.yml`, set `mac.target.arch: arm64` to match. The macOS `.zip` will be arm64-native and run on all Apple Silicon Macs (M1, M2, M3) without Rosetta.

**Warning signs:** The smoke test passing on `macos-latest` with `npm_config_arch: x64` but the packaged app silently crashing on launch — this is a sign the native module arch doesn't match the runner's Electron binary arch.

**Note:** This means the smoke.yml also has a potential arch mismatch issue, but it may work under Rosetta. The release workflow should explicitly set the correct arch per platform.

### Pitfall 2: Race condition in concurrent matrix artifact uploads

**What goes wrong:** If all three matrix jobs call `softprops/action-gh-release` simultaneously, the GitHub Releases API race condition causes two of the three body-update calls to fail silently — the release gets published with only one platform's description or missing artifact metadata.

**Why it happens:** GitHub Releases API has a known race when multiple clients update the same release concurrently (documented in community research: the first job that transitions from `draft:false` wins the body update; subsequent updates to a published release use a different code path).

**How to avoid:** Use the aggregator pattern: each matrix job uploads artifacts via `actions/upload-artifact@v4`; a final `publish` job (with `needs: [build]`) downloads all artifacts and calls `softprops/action-gh-release` exactly once.

**Warning signs:** GitHub Release page showing only one or two platform artifacts after a CI run that showed all three jobs green.

### Pitfall 3: `better-sqlite3` failing to load in packaged app due to ASAR

**What goes wrong:** `better-sqlite3.node` is a native binary. If it lands inside the ASAR archive (not unpacked), the OS cannot `dlopen` it.

**Why it happens:** ASAR is a virtual filesystem that doesn't support `dlopen` on `.node` binaries.

**How to avoid:** The current `electron-builder.yml` already has `asarUnpack: ["**/node_modules/better-sqlite3/**"]` — this is correct and must be preserved. Verify that the packaged output contains `app.asar.unpacked/node_modules/better-sqlite3/` alongside the ASAR.

**Warning signs:** App launches but crashes immediately with `NODE_MODULE_VERSION` or `cannot find module 'better-sqlite3'` errors in the packaged (non-dev) build.

### Pitfall 4: GitHub API rate limit (60 req/hr unauthenticated)

**What goes wrong:** A development machine running the app repeatedly (multiple launches per hour) could hit the 60 req/hr unauthenticated limit. Requests after the limit fail with HTTP 403/429.

**Why it happens:** GitHub's unauthenticated REST API rate limit is 60 requests/hour per IP [CITED: docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api].

**How to avoid:** The update check is already "fire-and-forget" (D-04: errors are silent). Add a `User-Agent: SoloCampaign-App` header (GitHub requires this for API calls). The check only runs once per startup, so a normal user making 60 launches in an hour is not a realistic concern. TanStack Query's `staleTime: 10 * 60 * 1000` in the renderer prevents redundant re-queries during the same session.

**Warning signs:** API calls returning 403 with "API rate limit exceeded" during rapid development with `npm run dev`.

### Pitfall 5: macOS `.zip` → Gatekeeper "app is damaged" error

**What goes wrong:** On modern macOS, quarantine attributes on downloaded ZIPs can cause Gatekeeper to show "SoloCampaign.app is damaged and can't be opened" rather than the more benign right-click bypass dialog.

**Why it happens:** macOS applies the `com.apple.quarantine` extended attribute to internet downloads. For unsigned/unnotarized apps, this triggers the "damaged" message rather than the "unverified developer" dialog.

**How to avoid:** Document the fix in release notes: `xattr -cr /Applications/SoloCampaign.app` removes the quarantine attribute. This is a one-time user action and is already standard for unsigned macOS app distribution.

**Warning signs:** Users report "app is damaged" instead of the expected right-click → Open dialog.

### Pitfall 6: Calling `shell.openExternal` with unsanitized URLs

**What goes wrong:** If `shell.openExternal` is exposed broadly (e.g., `openExternal: (url) => shell.openExternal(url)` with no validation), a malicious page could call it with `file://` or `ssh://` URLs.

**Why it happens:** `shell.openExternal` in Electron passes URLs to the OS's default handler — this includes protocol handlers beyond `http/https`.

**How to avoid:** In the tRPC mutation variant: validate the URL starts with `https://github.com/` before calling `shell.openExternal`. In the contextBridge variant: add a URL allow-list check in the preload. For this phase, the URL comes directly from `html_url` in the GitHub API response (a known-safe GitHub URL), but defensive validation is cheap.

**Warning signs:** Security review flags unrestricted `shell.openExternal` surface.

### Pitfall 7: `dismissedUpdateVersion` causing banner suppression after every dismiss

**What goes wrong:** If the dismissed version is always compared with `===`, the banner will reappear after every app launch when a version newer than the dismissed one is released — this is correct behavior. But if the logic is inverted (`dismissedUpdateVersion === latestVersion` → hide), users who dismiss v0.2.0 will never see the v0.3.0 banner.

**How to avoid:** Logic: show banner if `available && data.version !== dismissedUpdateVersion`. When a newer version arrives (v0.3.0), `data.version` is `"0.3.0"` and `dismissedUpdateVersion` is `"0.2.0"` → they differ → banner appears again. The dismissed version key is never cleared; it simply becomes stale when a newer release exists.

---

## Code Examples

### App.tsx: Insert UpdateBanner above Routes

```typescript
// Source: [ASSUMED] — existing App.tsx structure

export function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <UpdateBanner />   {/* <-- Added above <main>; renders nothing if no update */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<CampaignListScreen />} />
          <Route path="/campaign/:id" element={<CampaignViewScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>
    </div>
  )
}
```

### appPrefs.ts: Add `dismissedUpdateVersion` to AppPrefs interface

```typescript
// Source: [ASSUMED] — extends existing AppPrefs pattern

interface AppPrefs {
  fontSize: 'small' | 'normal' | 'large'
  highContrast: boolean
  dataFolder: string | null
  dismissedUpdateVersion: string | null  // <-- New key
}

export const appPrefsStore = new Store<AppPrefs>({
  name: 'appPrefs',
  defaults: {
    fontSize: 'normal',
    highContrast: false,
    dataFolder: null,
    dismissedUpdateVersion: null,  // <-- New default
  },
})
```

### electron-builder.yml: macOS target change

```yaml
# Source: [CITED: electron.build/docs/mac/]
# Before:
mac:
  target:
    - dir

# After:
mac:
  icon: src/resources/build/icons/icon.icns
  category: public.app-category.games
  identity: null
  target:
    - target: zip
      arch: arm64
```

### TypeScript declaration for new preload surfaces

```typescript
// Source: [ASSUMED] — extends existing window.d.ts or src/renderer/src/types/electron.d.ts pattern

interface Window {
  // ... existing declarations ...
  shellBridge: {
    openExternal: (url: string) => Promise<void>
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `electron-updater` for all update scenarios | GitHub API poll + notify-only | D-04 decision | Simpler, no `electron-updater` dep, no delta download artifacts needed |
| `softprops/action-gh-release` direct in each matrix job | Aggregator pattern (upload-artifact → single publish) | 2024 community guidance | Eliminates race condition in body-update API |
| `macos-latest` = x64 Intel runner | `macos-latest` = arm64 Apple Silicon (M1) | 2024 GitHub change | Must set `npm_config_arch: arm64` in macOS matrix entry |
| `mac.target: dir` in electron-builder | `mac.target: zip` | D-02 decision | Distributable `.zip` instead of unpacked directory |

**Deprecated/outdated:**
- `macos-13` runner: GitHub announced macOS 13 runner image shutdown by December 4, 2025. Do not use.
- `electron-rebuild` (legacy CLI): Superseded by `@electron/rebuild`. The smoke.yml uses `npx @electron/rebuild` — correct.
- `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` (string): Must be the string `'false'` not boolean `false` in GitHub Actions YAML — environment variables are always strings.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `macos-latest` in 2025/2026 is arm64 Apple Silicon — rebuild with `npm_config_arch: arm64` | Pitfall 1, Pattern 5 | If runner switches back to x64, arm64 `.node` binary would fail to load; easy to detect and fix |
| A2 | Inline 3-part semver comparison is sufficient (no pre-release handling needed) | Pattern 1, Code Examples | If GitHub releases ever have pre-release tags (v0.2.0-beta.1) that should notify, they'd be silently skipped; acceptable for this project's release cadence |
| A3 | `shell.openExternal` exposed via `contextBridge` is the right pattern (vs. tRPC mutation) | Pattern 2 | Both approaches work; tRPC mutation would be more consistent but adds a round trip |
| A4 | `User-Agent: SoloCampaign-App` header satisfies GitHub's API requirement | Pattern 1 | GitHub requires a User-Agent header; if rejected, check required format |
| A5 | `actions/upload-artifact@v4` with `merge-multiple: true` correctly merges artifacts from different matrix jobs in the download step | Pattern 5 | If merge-multiple is not supported in v4, use separate download steps per artifact |
| A6 | `gh repo create --public --source . --remote origin --push` is the correct one-liner for creating and pushing to a new GitHub repo | Open Questions #1 | If `gh` CLI is not available or syntax differs, use GitHub web UI + `git remote add origin` manually |

---

## Open Questions

1. **GitHub repo name / owner slug for the API URL constant**
   - What we know: `package.json` has `repository.url: "https://github.com/briston/solocampaign"` — repo owner is `briston`, repo name is `solocampaign`
   - What's unclear: The repo doesn't exist yet (D-06); the constant `https://api.github.com/repos/briston/solocampaign/releases/latest` is tentative until the repo is created under that exact slug
   - Recommendation: Hard-code the constant in `updateChecker.ts` using the `package.json` repository URL as authoritative source. Make it a named constant (`GITHUB_RELEASES_API_URL`) so it's easy to patch if the slug differs.

2. **smoke.yml `npm_config_arch: x64` for macOS — update or leave?**
   - What we know: smoke.yml hardcodes `x64` for all platforms; `macos-latest` is arm64 in 2025
   - What's unclear: Smoke tests may be passing via Rosetta; changing smoke.yml is out of scope for Phase 9 (D-07: smoke.yml untouched)
   - Recommendation: Leave `smoke.yml` as-is per D-07. In `release.yml`, use platform-appropriate arch per matrix entry. The smoke test validates the app builds and runs (possibly under Rosetta); the release build validates native arm64 binaries.

3. **Where to initialize the update check in main/index.ts**
   - What we know: The check must run after `mainWindow` is created (so the result can be sent to the renderer); must not block app startup
   - What's unclear: Should it be a fire-and-forget `void` call or should it use tRPC's query mechanism exclusively from the renderer?
   - Recommendation: Implement as a tRPC query (`trpc.appPrefs.checkForUpdate`) called from the renderer via `useQuery`. The renderer initiates the check; main process handles the fetch. This is the cleanest pattern — no need for `ipcMain`-push of update results, and TanStack Query handles the async state.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Release CI | ✓ (setup-node@v4) | 20 (CI), 24 (local) | — |
| npm | Release CI | ✓ | bundled with Node | — |
| electron-builder | `npm run build` | ✓ | 26.8.1 (local) | — |
| @electron/rebuild | CI rebuild step | ✓ | 4.0.4 (local) | — |
| NSIS (for Windows installer) | electron-builder Windows | ✓ (bundled in electron-builder) | bundled | — |
| FUSE / libfuse2 (for AppImage) | AppImage on Linux CI | ✗ (must install in CI step) | — | `sudo apt-get install -y fuse libfuse2` |
| Xvfb (for Linux smoke) | Not needed for release | N/A | N/A | — |
| `gh` CLI | Repo creation (D-06) | ✓ (pre-installed on GitHub-hosted runners) | latest | GitHub web UI |
| better-sqlite3 `.node` binary | Packaged app at runtime | ✓ ABI 145 (verified: `.forge-meta: x64--145`) | 12.10.0 | — |

**Missing dependencies with no fallback:** None — all required tooling is either in the project or available on GitHub-hosted runners.

**Missing dependencies with fallback:**
- `fuse libfuse2` on Ubuntu runner — install in CI step (already done in `smoke.yml`; must replicate in `release.yml` if AppImage build requires FUSE)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-05 | `checkForUpdate` returns `{ available: true }` when remote is newer | unit | `npm test -- --reporter=verbose src/main/services/updateChecker.test.ts` | ❌ Wave 0 |
| DIST-05 | `checkForUpdate` returns `{ available: false }` when same version | unit | `npm test -- --reporter=verbose src/main/services/updateChecker.test.ts` | ❌ Wave 0 |
| DIST-05 | `checkForUpdate` returns `{ available: false }` on network error | unit | `npm test -- --reporter=verbose src/main/services/updateChecker.test.ts` | ❌ Wave 0 |
| DIST-05 | `dismissUpdate` persists `dismissedUpdateVersion` in appPrefs store | unit | `npm test -- --reporter=verbose src/main/trpc/routers/appPrefs.test.ts` | ✅ (existing test file, extend it) |
| DIST-05 | `checkForUpdate` ignores pre-release tags (`v0.2.0-beta.1`) | unit | `npm test -- --reporter=verbose src/main/services/updateChecker.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/services/updateChecker.test.ts` — covers DIST-05 update check logic (mock `fetch`, test version comparison, timeout handling)
- [ ] Extend `src/main/trpc/routers/appPrefs.test.ts` — add tests for `checkForUpdate` query and `dismissUpdate` mutation

*(Existing `appPrefs.test.ts` infrastructure covers mock patterns for `electron-store` and `electron` — reuse same mock setup)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Validate `html_url` starts with `https://github.com/` before `shell.openExternal` |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + External URL Handling

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `shell.openExternal` with unsanitized URL from API response | Tampering | Validate URL protocol and host before calling; allow-list `https://github.com/` only |
| GitHub API response spoofing (MITM) | Tampering | HTTPS-only fetch; no cert pinning needed for this low-risk use case |
| DoS via malformed tag_name (NaN injection) | DoS | `isNaN()` guard in version comparison — returns `false` safely |
| IPC surface expansion (new preload methods) | Elevation of Privilege | `shell.openExternal` wrapper validates URL host before opening; no arbitrary shell execution |

---

## Sources

### Primary (HIGH confidence)
- Codebase `.github/workflows/smoke.yml` — existing CI pattern; verified line-by-line
- Codebase `electron-builder.yml` — verified current config; `dir` target confirmed
- Codebase `src/main/trpc/routers/appPrefs.ts` — store pattern and tRPC router structure
- Codebase `src/preload/index.ts` — contextBridge surface pattern
- Codebase `src/main/index.ts` — startup sequence, CSP config, IPC handler registration
- `package.json` — version `0.1.0`, repository URL, all dependency versions
- `vitest.config.ts` — test infrastructure
- [VERIFIED: npm registry] `electron-builder@26.8.1` — confirmed current version
- [VERIFIED: npm registry] `@electron/rebuild@4.0.4` — confirmed current version
- [CITED: docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api] — 60 req/hr unauthenticated, per-IP
- [CITED: electron.build/docs/mac/] — macOS zip target, `identity: null` for unsigned

### Secondary (MEDIUM confidence)
- [CITED: github.com/softprops/action-gh-release README] — `draft`, `files`, `overwrite_files` options
- Verified with community research: aggregator pattern for matrix builds avoids race condition
- GitHub blog post confirmed: `macos-latest` is arm64 Apple Silicon (M1) as of 2024/2025

### Tertiary (LOW confidence)
- `npm_config_arch: arm64` for macOS matrix entry — based on runner architecture research; verify if smoke tests fail on macOS
- `actions/upload-artifact@v4` `merge-multiple: true` option — assumed from v4 documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed in project
- Architecture: HIGH — patterns derived directly from existing codebase
- Release workflow: MEDIUM — aggregator pattern and macOS arch are community-researched, not from official electron-builder docs
- Pitfalls: HIGH — most pitfalls have direct evidence (macOS arm64 runner, ASAR `.node`, race condition)

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (30 days — GitHub Actions runner specs can change)
