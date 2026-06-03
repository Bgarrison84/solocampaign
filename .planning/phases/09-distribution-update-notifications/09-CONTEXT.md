# Phase 9: Distribution & Update Notifications - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can download a SoloCampaign installer for their OS from a public GitHub Release, install it cleanly (unsigned — SmartScreen/Gatekeeper bypass documented in release notes), and see a dismissible in-app banner on startup when a newer version is available — clicking it opens the GitHub Release page in the browser.

**In scope:** Cross-platform installers (Windows NSIS, macOS .zip, Linux AppImage), GitHub Actions release CI triggered by git tag, GitHub Releases as the publish target, GitHub API poll for update checking, in-app update notification banner.

**Out of scope:** Code signing / notarization (deferred — no certs for v1.0), silent/auto install (never — notify-only is the permanent design), .deb / Snap / Flatpak (AppImage only for v1.0), system tray integration, delta updates.

</domain>

<decisions>
## Implementation Decisions

### Code Signing & Installer Format

- **D-01: Ship unsigned v1.0 — D-03 from Phase 1 upheld.** No code signing for the initial release. Windows users will see a SmartScreen "unrecognized publisher" warning; macOS users will see a Gatekeeper block and need right-click → Open. Both bypass procedures are documented in the GitHub Release notes. No Azure Trusted Signing or Apple Developer enrollment required for v1.0.

- **D-02: Platform installer targets.** Windows → NSIS `.exe` (already configured). macOS → `.zip` app bundle (user chose .zip over .dmg — lighter, no installer friction for an unsigned build). Linux → AppImage only (no .deb for v1.0). Update `electron-builder.yml` accordingly.

- **D-03: Version stays at 0.1.0.** Do not bump to 1.0.0 for the initial release. Tag the first release as `v0.1.0`. `package.json` version field stays `"0.1.0"`.

### Update Notification

- **D-04: GitHub API poll on startup — no `electron-updater`.** On app launch, fetch `https://api.github.com/repos/{owner}/{repo}/releases/latest` (unauthenticated — public repo). Compare `tag_name` (strip leading `v`) against `app.getVersion()`. If newer: fire the update notification. No `electron-updater` dependency needed. Error/timeout is silent — never block startup.

- **D-05: In-app dismissible banner at the top of the main layout.** If a newer version is found, render a banner above the main content area: "SoloCampaign {newVersion} is available — [Download]". Clicking "Download" opens the GitHub Release page (`html_url` from the API response) in the default browser via `shell.openExternal()`. The banner has an ✕ dismiss button. Dismissed state is persisted in `appPrefs` electron-store so the same version's banner does not reappear on subsequent launches (only cleared when a newer version is found).

- **D-06: GitHub repository to be created as part of this phase.** The public GitHub repo does not exist yet. Phase 9 planning must include: creating the public repo, pushing master, and publishing the first GitHub Release (`v0.1.0`) as a phase task. The repo owner/name will be resolved during execution and baked into the API URL constant in the update-check service.

### Release CI Workflow

- **D-07: Separate `release.yml` workflow, triggered by `v*` tag push.** The existing smoke-test workflow (`smoke.yml`) is untouched. A new `release.yml` is added alongside it, triggered by `on: push: tags: ['v*']`. No dependency on smoke tests in the release workflow — tag pushes are intentional; prior commits are already smoke-tested.

- **D-08: Matrix build: windows-latest, macos-latest, ubuntu-latest.** Same matrix as the smoke-test workflow. Each runner: installs Node 20, runs `npm ci`, rebuilds `better-sqlite3`, runs `npm run build` with `CSC_IDENTITY_AUTO_DISCOVERY=false` and `SKIP_NOTARIZE=true`, then uploads the built artifacts to the GitHub Release via `softprops/action-gh-release` (or equivalent). The release is created as a draft first; all three platform artifacts upload; draft is published once all three succeed.

- **D-09: Release notes template included in `release.yml`.** Release notes include: version, what's new (placeholder for manual edit), and a "Security/Gatekeeper bypass" section with step-by-step instructions for Windows SmartScreen and macOS right-click → Open. Planner decides whether the notes are hardcoded in the workflow or templated via a `RELEASE_NOTES.md`.

### Claude's Discretion

- Exact GitHub API call implementation (fetch in main process or renderer, caching strategy, timeout value)
- Banner component placement in the React tree (above router outlet, below TitleBar)
- `appPrefs` key name for dismissed version (e.g., `dismissedUpdateVersion`)
- Whether the release workflow uses `softprops/action-gh-release`, `gh release`, or another upload mechanism
- Draft-release vs. pre-release flag strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing distribution config
- `electron-builder.yml` — current build config; needs mac target changed from `dir` to `zip`, linux target already `AppImage`
- `.github/workflows/smoke.yml` — existing CI pattern to follow for the new release workflow structure
- `package.json` — version field (`0.1.0`), existing `build` script

### Existing infrastructure to extend
- `src/main/index.ts` — main process entry point; update check service initializes here
- `src/main/trpc/routers/appPrefs.ts` — `appPrefsStore` already exists; dismissed version key added here
- `src/preload/index.ts` — contextBridge surface; `shell.openExternal` needs to be exposed for the Download link
- `src/renderer/src/App.tsx` — top-level renderer; update banner renders here (above `<Outlet />`)

### Phase decisions from prior phases
- Phase 1 D-03 (in STATE.md `## Accumulated Context`): No code signing — unsigned installers. Upheld in D-01.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/trpc/routers/appPrefs.ts` — `appPrefsStore` (electron-store instance): add `dismissedUpdateVersion` key here rather than creating a new store
- `src/renderer/src/components/ui/alert.tsx` — shadcn Alert component: suitable for the update banner (already in codebase from Phase 8)
- `src/preload/index.ts` — contextBridge already exposes `platform` and `appPrefsSync`; add `shell.openExternal` wrapper here for the Download link

### Established Patterns
- tRPC procedure + IPC for main-process operations (GitHub API fetch should run in main process, not renderer, to avoid CORS and CSP issues)
- `appPrefsStore.get/set` pattern for persisting small app-level flags
- `CSC_IDENTITY_AUTO_DISCOVERY: false` + `SKIP_NOTARIZE: true` already in CI env — keep as-is

### Integration Points
- `src/renderer/src/App.tsx` — banner renders above the router `<Outlet />`; needs a Zustand store slice or React state for `updateAvailable: boolean | string`
- `src/main/index.ts` — update check runs after app is ready and the main window is created; result sent to renderer via IPC event or tRPC query
- `.github/workflows/` — new `release.yml` sits alongside `smoke.yml`

</code_context>

<specifics>
## Specific Ideas

- Update banner copy: "SoloCampaign {newVersion} is available — [Download]" with an ✕ dismiss button
- Dismissed state: `appPrefsStore.set('dismissedUpdateVersion', newVersion)` — cleared automatically when a version newer than the dismissed one is found
- GitHub Release draft strategy: all three platform artifacts must upload before the release is published (prevents partial releases)
- macOS Gatekeeper bypass instruction (for release notes): "Right-click (or Control-click) SoloCampaign.app → Open → Open in the confirmation dialog"

</specifics>

<deferred>
## Deferred Ideas

- **Code signing** (Windows Azure Trusted Signing + macOS notarization) — deferred from v1.0. When certs are procured, update D-01/D-02 and remove `CSC_IDENTITY_AUTO_DISCOVERY=false` from CI.
- **macOS hardened runtime entitlements for better-sqlite3** — only required for notarized builds; deferred with code signing. Active todo from Phase 9 notes in STATE.md.
- **`.deb` Linux package** — deferred from v1.0. AppImage-only for now.
- **`electron-updater` with delta updates** — deferred until code signing is in place (delta updates require signed builds for security).
- **Snap / Flatpak** — no plans; deferred indefinitely.

</deferred>

---

*Phase: 9-distribution-update-notifications*
*Context gathered: 2026-06-02*
