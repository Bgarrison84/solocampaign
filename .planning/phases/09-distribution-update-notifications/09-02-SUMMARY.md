---
phase: 09-distribution-update-notifications
plan: "02"
subsystem: ui
tags: [react, shadcn, electron, contextbridge, tanstack-query, trpc, update-notification, dist-05]

# Dependency graph
requires:
  - phase: 09-01
    provides: appPrefs.checkForUpdate tRPC query, appPrefs.dismissUpdate tRPC mutation, dismissedUpdateVersion electron-store key
provides:
  - window.shellBridge.openExternal — contextBridge surface with https://github.com/ allow-list (preload)
  - Window.shellBridge TypeScript declaration (aiStream.d.ts)
  - UpdateBanner component — shadcn Alert-based dismissible update banner (DIST-05)
  - App.tsx wired — UpdateBanner rendered between TitleBar and main content
affects:
  - Phase 9 UAT — manual verification: banner appears on launch against higher remote tag, Download opens release page, dismiss persists

# Tech tracking
tech-stack:
  added: []
  patterns:
    - contextBridge.exposeInMainWorld with URL allow-list guard before shell.openExternal
    - UpdateBanner: useQuery(checkForUpdate staleTime 10min) + useQuery(appPrefs.get) + useMutation(dismissUpdate)
    - Dismiss suppression: render null when data.version === prefs.dismissedUpdateVersion
    - Alert with className "rounded-none border-x-0 border-t-0 py-2" for full-width inline strip

key-files:
  created:
    - src/renderer/src/components/UpdateBanner.tsx
  modified:
    - src/preload/index.ts
    - src/renderer/src/types/aiStream.d.ts
    - src/renderer/src/App.tsx

key-decisions:
  - "shellBridge URL allow-list in preload (not renderer) — preload runs in main-process context, renderer cannot bypass"
  - "staleTime 10min on checkForUpdate — prevents GitHub API rate-limit (Pitfall 4)"
  - "Two separate useQuery calls (checkForUpdate + appPrefs.get) — reuses existing appPrefs cache key for dismissed version"
  - "No new npm dependencies — all primitives (Alert, Button, lucide X, TanStack Query) were already in the project"

patterns-established:
  - "shell.openExternal via contextBridge allow-list: validate url.startsWith(allowedPrefix) before calling shell.openExternal"
  - "Dismiss suppression pattern: compare data.version to prefs.dismissedUpdateVersion — render null when equal"

requirements-completed: [DIST-05]

# Metrics
duration: 12min
completed: 2026-06-03
---

# Phase 9 Plan 02: Update Banner Renderer — shellBridge + UpdateBanner + App.tsx Wiring

**Secure `shell.openExternal` contextBridge bridge with https://github.com/ allow-list, dismissible `UpdateBanner` shadcn Alert component wired to tRPC checkForUpdate/dismissUpdate, inserted between TitleBar and main content in App.tsx — completing the DIST-05 end-to-end slice.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-03T17:10:00Z
- **Completed:** 2026-06-03T17:22:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Extended preload with `window.shellBridge.openExternal` — URL allow-list in main-process context blocks file://, ssh:// and other non-GitHub protocols (T-09-07)
- Created `UpdateBanner` component: two-query pattern (checkForUpdate + appPrefs.get), dismiss mutation with cache invalidation, nil-render when no update or version already dismissed
- Wired `<UpdateBanner />` into App.tsx between TitleBar and main — renders nothing when no update available so insertion is unconditional and safe

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shellBridge preload surface + Window type declaration** - `8554958` (feat)
2. **Task 2: Create UpdateBanner component** - `98015f3` (feat)
3. **Task 3: Wire UpdateBanner into App.tsx** - `a1f5d9a` (feat)

## Files Created/Modified

- `src/preload/index.ts` — Added `shell` to electron import; added `contextBridge.exposeInMainWorld('shellBridge', { openExternal })` with URL allow-list guard
- `src/renderer/src/types/aiStream.d.ts` — Added `shellBridge: { openExternal(url: string): Promise<void> }` to Window interface
- `src/renderer/src/components/UpdateBanner.tsx` — New component: shadcn Alert strip with Download link and dismiss button
- `src/renderer/src/App.tsx` — Added `import { UpdateBanner }` and `<UpdateBanner />` between TitleBar and main

## Decisions Made

- shellBridge URL allow-list enforced in preload (main-process context) not renderer — a compromised renderer cannot bypass it
- staleTime 10 min on checkForUpdate query to guard against GitHub API rate limit (RESEARCH Pitfall 4)
- Two separate useQuery calls reuse the existing `['appPrefs']` cache key for dismissed version without a third query
- No new npm packages — all required primitives already present

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript passed clean on all three tasks. Pre-existing `better-sqlite3` NODE_MODULE_VERSION failures (125 tests) are unchanged — these are a known artifact of vitest's Node ABI differing from the Electron ABI the native module was compiled against (documented in 09-01 SUMMARY).

## Known Stubs

None — all data paths are wired end-to-end.

## Threat Surface Scan

No new threat surface beyond the plan's threat model:

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-09-07 | URL allow-list in preload: `url.startsWith('https://github.com/')` before shell.openExternal | Implemented |
| T-09-08 | shellBridge exposes single host-validated method — no arbitrary shell execution | Implemented |
| T-09-09 | Banner shows only public version string and public GitHub URL (accept) | Accepted |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- DIST-05 end-to-end slice is complete. Manual UAT (per 09-VALIDATION.md): run the app against a GitHub tag higher than the current build, confirm banner appears, Download opens the release page in default browser, and dismiss persists across restart.
- Phase 9 plans 09-01, 09-02, 09-03 are complete. Remaining plan 09-04 (validation/packaging) is the final step.

## Self-Check: PASSED

- [x] `src/renderer/src/components/UpdateBanner.tsx` exists with `export function UpdateBanner`
- [x] `src/preload/index.ts` contains `shell` in import and `exposeInMainWorld('shellBridge'`
- [x] `src/preload/index.ts` contains `https://github.com/` allow-list guard
- [x] `src/renderer/src/types/aiStream.d.ts` contains `shellBridge: { openExternal(url: string): Promise<void> }`
- [x] `src/renderer/src/App.tsx` contains `import { UpdateBanner }` and `<UpdateBanner />`
- [x] `<UpdateBanner />` appears after `<TitleBar />` and before `<main` in source order
- [x] Commits verified: `8554958`, `98015f3`, `a1f5d9a`
- [x] `npx tsc --noEmit` exits 0 on all three tasks
- [x] No new npm dependencies added

---
*Phase: 09-distribution-update-notifications*
*Completed: 2026-06-03*
