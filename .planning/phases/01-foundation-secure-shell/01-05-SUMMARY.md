---
phase: 01-foundation-secure-shell
plan: "05"
subsystem: ui
tags: [electron, titlebar, frameless, window-controls, electron-store, zustand, trpc, react]

requires:
  - phase: 01-01
    provides: "tRPC router skeleton with empty windowRouter placeholder; electron-store installed"
  - phase: 01-04
    provides: "CampaignViewScreen with split-panel layout; height style needing update for TitleBar"

provides:
  - "Custom frameless title bar with drag region, app name, campaign name, and Win/Linux window controls"
  - "windowRouter with minimize/maximize/close/isMaximized tRPC procedures"
  - "useWindowStore Zustand store for campaign name state in title bar"
  - "BrowserWindow frameless config: titleBarStyle:'hidden' (macOS) / frame:false (Win/Linux)"
  - "Window bounds persistence: read saved width/height/x/y on launch, write on resize/move (1s debounce)"
  - "FOUND-01 gap contribution: window chrome renders correctly in packaged build"

affects:
  - Phase 3 (AI Chat) — uses useWindowStore.setCampaignName when campaign is active
  - 01-06 (Settings) — CampaignListScreen now uses min-h-full inside flex-col container

tech-stack:
  added:
    - "src/renderer/src/components/TitleBar.tsx (new)"
    - "src/renderer/src/stores/windowStore.ts (new)"
  patterns:
    - "BrowserWindow frameless: titleBarStyle:'hidden' on darwin, frame:false on win32/linux"
    - "electron-store boundsStore for windowBounds — read at construction, write debounced 1s on resize/move"
    - "TitleBar uses BrowserWindow.getFocusedWindow() via tRPC window procedures (not raw IPC from renderer)"
    - "WebkitAppRegion: 'drag' on bar, 'no-drag' on buttons and text zone"
    - "navigator.platform for platform detection in renderer (sandbox: true — no process.platform)"
    - "useWindowStore: Zustand store with campaignName/setCampaignName; set on CampaignViewScreen mount, cleared on unmount"

key-files:
  created:
    - src/renderer/src/components/TitleBar.tsx
    - src/renderer/src/stores/windowStore.ts
  modified:
    - src/main/trpc/routers/window.ts (replaced empty placeholder with 4 procedures)
    - src/main/index.ts (frameless config + bounds persistence)
    - src/renderer/src/App.tsx (TitleBar above routes, flex-col wrapper)
    - src/renderer/src/screens/CampaignViewScreen.tsx (campaignName in store, h-full)
    - src/renderer/src/screens/CampaignListScreen.tsx (min-h-full)

key-decisions:
  - "BrowserWindow.getFocusedWindow() in window procedures — avoids circular import with index.ts; idiomatic for single-window Electron"
  - "navigator.platform for renderer-side platform detection — sandbox:true means no process.platform access in renderer"
  - "Custom controls shown on all platforms in Phase 1 (TODO comment left for macOS-only hide in later phase)"
  - "CampaignViewScreen height changed from height:'100vh' to h-full — screen sits inside flex-1 container"
  - "electron-store boundsStore (name:'windowBounds') separate from prefs store — clean separation of concerns"

patterns-established:
  - "Pattern: Zustand store for window-level UI state (campaignName) — set by route screens, consumed by global chrome"
  - "Pattern: tRPC procedures for window controls — renderer never calls Electron APIs directly"

requirements-completed:
  - FOUND-01

duration: 5min
completed: 2026-05-24T19:14:34Z
---

# Phase 1 Plan 05: Custom Frameless Title Bar + Window Size Persistence Summary

**Frameless BrowserWindow (titleBarStyle/frame:false) + custom TitleBar React component with drag region, tRPC window controls, Zustand campaign name state, and electron-store window bounds persistence**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-24T19:09:06Z
- **Completed:** 2026-05-24T19:14:34Z
- **Tasks:** 3
- **Files modified:** 7 (created 2, modified 5)

## Accomplishments

- `windowRouter` populated with `minimize`, `maximize` (toggle), `close`, `isMaximized` procedures — all using `BrowserWindow.getFocusedWindow()` to avoid circular imports
- `BrowserWindow` switched to frameless: `titleBarStyle: 'hidden'` on macOS (native traffic lights preserved), `frame: false` on Windows/Linux
- Window bounds persisted via `electron-store` key `windowBounds`: read on construction (default 1280×800), written on resize/move with 1s debounce
- `TitleBar.tsx` component: 32px (macOS) / 36px (Win/Linux) height, `WebkitAppRegion: 'drag'` on bar, `no-drag` on buttons and text zone, Lucide Minus/Square/Copy/X icons, `trpc.window.*` calls for window controls
- `useWindowStore` Zustand store with `campaignName` / `setCampaignName` — set by `CampaignViewScreen` when campaign data loads, cleared on unmount
- `App.tsx` updated to `flex flex-col h-screen overflow-hidden` with `TitleBar` above `<main className="flex-1 overflow-hidden">`
- `CampaignViewScreen` height computation corrected: `h-full` replaces `height:'100vh'` / `h-screen` to work inside the flex container
- TypeScript typecheck passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Populate windowRouter** - `72d0908` (feat)
2. **Task 2: Frameless BrowserWindow + bounds persistence** - `e81edde` (feat)
3. **Task 3: TitleBar, windowStore, App.tsx layout** - `5bb9fe6` (feat)

## Files Created/Modified

- `src/main/trpc/routers/window.ts` — Replaced empty `t.router({})` with 4 procedures: `minimize` (mutation), `maximize` (mutation — toggle), `close` (mutation), `isMaximized` (query). BrowserWindow imported from electron; `getFocusedWindow()` used in each procedure.
- `src/main/index.ts` — Added `electron-store` import, `boundsStore` module-scope instance, `savedBounds` read before BrowserWindow construction, platform-conditional frameless options, and `resize`/`move` event listeners with 1s debounce save.
- `src/renderer/src/components/TitleBar.tsx` — New component: `WebkitAppRegion: 'drag'` bar, left zone with "SoloCampaign" + optional " — {campaignName}", right zone with Minus/Square(Copy)/X buttons calling `trpc.window.*` procedures. `isMaximized` state polled on mount and kept in sync via `window.addEventListener('resize', ...)`.
- `src/renderer/src/stores/windowStore.ts` — New Zustand store: `campaignName: string | null`, `setCampaignName(name)`.
- `src/renderer/src/App.tsx` — Added `TitleBar` import and render above `<Routes>` inside `flex flex-col h-screen overflow-hidden` wrapper.
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Added `useWindowStore` import and `useEffect` to set/clear `campaignName`. Changed all `h-screen` and `height:'100vh'` to `h-full` to work inside the new flex container.
- `src/renderer/src/screens/CampaignListScreen.tsx` — Changed `min-h-screen` to `min-h-full` (both occurrences) to work inside the new flex container.

## Decisions Made

1. **`BrowserWindow.getFocusedWindow()` in window procedures**: Avoids a circular import between `window.ts` and `index.ts`. For a single-window app, the focused window is always `mainWindow` when the title bar button is clicked. This is idiomatic for single-window Electron apps.

2. **`navigator.platform` for platform detection in renderer**: `sandbox: true` means `process.platform` is not available in the renderer process. `navigator.platform.startsWith('Mac')` is the correct renderer-side approach.

3. **Custom controls visible on all platforms (Phase 1)**: Per plan spec — macOS users will see both native traffic lights (left) and custom buttons (right). A TODO comment is left for a future polish pass to hide the custom buttons on macOS.

4. **`h-full` in CampaignViewScreen / `min-h-full` in CampaignListScreen**: Both screens now live inside `<main className="flex-1 overflow-hidden">` which is a flex child of the root container. Using `h-screen` would overflow past the flex boundaries. `h-full` fills the parent's remaining height correctly.

## Deviations from Plan

None — plan executed exactly as written.

The CampaignListScreen `min-h-screen` → `min-h-full` fix was explicitly called out in the Task 3 action description ("check and change to `h-full` / `min-h-full` as needed"), so this is standard plan execution, not a deviation.

## Known Stubs

No new stubs introduced by this plan. The title bar shows "SoloCampaign" on the home route and "SoloCampaign — {name}" on the campaign route — both behaviors are fully wired, not stubbed.

## Threat Surface Scan

All threats from the plan's threat model are addressed:

| Threat | File | Status |
|--------|------|--------|
| T-01-05-01: window.close over IPC — Elevation | src/main/trpc/routers/window.ts | ACCEPTED (closing the app is a legitimate user action; no privilege escalation risk) |
| T-01-05-02: window.maximize IPC — Tampering | src/main/trpc/routers/window.ts | ACCEPTED (zero-input procedure, cannot be injected with malformed payloads) |
| T-01-05-03: Campaign name in title bar — Info Disclosure | src/renderer/src/components/TitleBar.tsx | ACCEPTED (user-supplied data shown in their own UI) |

No new threat surface beyond the plan's threat model.

## Next Phase Readiness

- 01-06 (Settings) is unblocked
- 01-07 (Smoke Tests) is unblocked
- Phase 3 can call `useWindowStore.getState().setCampaignName()` directly if needed from the AI chat layer
- The window bounds persist correctly — `windowBounds.json` in userData will be created after first resize/move

## Self-Check: PASSED

- src/main/trpc/routers/window.ts: FOUND (minimize, maximize, close, isMaximized — 4 procedures)
- src/main/index.ts: FOUND (titleBarStyle, frame: false, boundsStore, windowBounds)
- src/renderer/src/components/TitleBar.tsx: FOUND (WebkitAppRegion: 'drag', trpc.window.minimize/maximize/close)
- src/renderer/src/stores/windowStore.ts: FOUND (useWindowStore, campaignName, setCampaignName)
- src/renderer/src/App.tsx: FOUND (TitleBar, flex flex-col h-screen overflow-hidden)
- Commit 72d0908: Task 1 (windowRouter procedures)
- Commit e81edde: Task 2 (frameless BrowserWindow + bounds)
- Commit 5bb9fe6: Task 3 (TitleBar + windowStore + App.tsx)

---
*Phase: 01-foundation-secure-shell*
*Completed: 2026-05-24*
