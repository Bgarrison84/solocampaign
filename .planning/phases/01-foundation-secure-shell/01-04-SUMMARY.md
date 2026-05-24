---
phase: 01-foundation-secure-shell
plan: "04"
subsystem: ui
tags: [react, zustand, trpc, electron-store, react-resizable-panels, shadcn, tabs, panel-layout]

requires:
  - phase: 01-01
    provides: "tRPC router skeleton with empty prefsRouter placeholder; CampaignViewScreen stub; react-resizable-panels@^3 installed"

provides:
  - "prefs.panelSize.get + prefs.panelSize.set tRPC procedures (electron-store backed, per-campaign UUID key)"
  - "usePanelSizeStore Zustand store — sizes/isLoaded state + load/save/setLocalSizes actions"
  - "CampaignViewScreen full split-panel layout — PanelGroup 60/40 horizontal split with 5-tab right panel"
  - "shadcn Tabs component (tabs.tsx over @radix-ui/react-tabs)"
  - "Panel size persistence per campaign with 500ms debounce on resize"
  - "SESS-01 gap closed: user sees split-panel layout on entering a campaign"

affects:
  - 01-05-title-bar (TitleBar will sit above the flex-col div; height calc needs `calc(100vh - TITLE_BAR_HEIGHT)`)
  - Phase 2 (Character Sheet tab — already scaffolded)
  - Phase 3 (left panel chat shell — already scaffolded with 'AI narration appears here.' placeholder)
  - Phase 4 (Session Journal tab — already scaffolded)
  - Phase 5 (Combat Tracker tab — already scaffolded)
  - Phase 6 (NPC Tracker tab — already scaffolded)

tech-stack:
  added:
    - "@radix-ui/react-tabs@^1.1.13"
    - "src/renderer/src/components/ui/tabs.tsx (shadcn copy-in)"
    - "src/renderer/src/stores/panelSizeStore.ts (Zustand store)"
  patterns:
    - "Zustand store with async IPC load/save helpers — load(campaignId) + save(campaignId, l, r) call tRPC, setLocalSizes(l, r) is local-only for high-frequency resize events"
    - "usePanelSizeStore.setState({ isLoaded: false }) before load() to gate render on real values"
    - "Debounced panel resize save: useRef timeout, 500ms, cleared/reset on each onLayout call"
    - "electron-store prefs router pattern: Store<Record<string, T>>({ name: 'prefs' }), keyed by campaign UUID"
    - "Zod UUID + bounded number validation on prefs IPC input (T-01-04-01 mitigation)"

key-files:
  created:
    - src/renderer/src/stores/panelSizeStore.ts
    - src/renderer/src/components/ui/tabs.tsx
  modified:
    - src/main/trpc/routers/prefs.ts (replaced empty placeholder with panelSize.get + panelSize.set)
    - src/renderer/src/screens/CampaignViewScreen.tsx (replaced stub with full split-panel layout)
    - package.json (added @radix-ui/react-tabs)

key-decisions:
  - "electron-store keyed by campaign UUID for per-campaign panel sizes — avoids SQLite churn for pure UI preferences (D-14 pattern)"
  - "usePanelSizeStore.setState({ isLoaded: false }) before load() call — prevents rendering old sizes from a previous campaign when navigating between campaigns"
  - "@radix-ui/react-tabs installed with --legacy-peer-deps due to @trpc/react-query@10 peer dependency on react-query@^4 conflicting with installed v5"
  - "height: calc(100vh) on outer div (not h-screen class) — 01-05 will change this to calc(100vh - TITLE_BAR_HEIGHT) when TitleBar lands"

patterns-established:
  - "Pattern: Zustand store for UI state + async tRPC helpers — create<State>()(set => ...) with load/save using tRPC client directly (not React Query)"
  - "Pattern: PanelGroup.onLayout + debounced save — local state updates immediately, IPC persists after 500ms idle"

requirements-completed:
  - SESS-01

duration: 25min
completed: 2026-05-24
---

# Phase 1 Plan 04: Split-Panel Campaign View Shell Summary

**react-resizable-panels v3 PanelGroup (60/40 split) + shadcn Tabs (5-tab right panel) with per-campaign panel size persistence via electron-store prefs tRPC — SESS-01 gap closed**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-24T18:45:00Z
- **Completed:** 2026-05-24T19:10:00Z
- **Tasks:** 3
- **Files modified:** 5 (created 2, modified 3)

## Accomplishments

- `prefs.panelSize.get` and `prefs.panelSize.set` tRPC procedures with electron-store persistence and Zod UUID + bounds validation
- `usePanelSizeStore` Zustand store with `load/save/setLocalSizes` — async IPC helpers separated from local state updates for high-frequency resize events
- Full `CampaignViewScreen` replacing the stub: PanelGroup 60/40 default split, resize handle with hover affordance, 5-tab right panel (Character Sheet default)
- All tab labels and placeholder copy matching UI-SPEC Copywriting Contract exactly
- Panel sizes persist per campaign with 500ms debounce; load on mount with isLoaded gate prevents premature render

## Task Commits

Each task was committed atomically:

1. **Task 1: Add prefs router procedures for panel size persistence** - `fefa366` (feat)
2. **Task 2: Implement Zustand panelSizeStore** - `1f9dc78` (feat)
3. **Task 3: Replace CampaignViewScreen stub with full split-panel layout** - `90c74ef` (feat)
4. **Chore: Add @radix-ui/react-tabs dependency** - `bb701d5` (chore)

## Files Created/Modified

- `src/main/trpc/routers/prefs.ts` — Replaced empty placeholder with `panelSize.get` (query, default 60/40) + `panelSize.set` (mutation, stores per-campaign). electron-store module-scope instance. Zod UUID + 0-100 bounds validation.
- `src/renderer/src/stores/panelSizeStore.ts` — Zustand store: `sizes`/`isLoaded` state, `load(campaignId)` (tRPC query + isLoaded=true), `save(campaignId, l, r)` (local update + tRPC mutation), `setLocalSizes(l, r)` (local-only for debounce)
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Full PanelGroup + Tabs implementation. Loading gate waits for both campaignQuery and store.isLoaded. Debounced save via useRef setTimeout.
- `src/renderer/src/components/ui/tabs.tsx` — shadcn Tabs copy-in over @radix-ui/react-tabs (Tabs, TabsList, TabsTrigger, TabsContent)
- `package.json` — Added `@radix-ui/react-tabs@^1.1.13`

## Decisions Made

1. **electron-store keyed by campaign UUID**: Panel sizes are pure UI preference — electron-store per D-14, not SQLite. The `prefs.json` file in userData holds `{ [campaignId: UUID]: { leftSize: number, rightSize: number } }`.

2. **`usePanelSizeStore.setState({ isLoaded: false })` before `load()`**: When navigating between campaigns, the previous campaign's sizes would flash before the new ones load without this reset. The isLoaded gate prevents this.

3. **`@radix-ui/react-tabs` installed with `--legacy-peer-deps`**: The project has `@trpc/react-query@10` which declares a peer on `react-query@^4`, but the project uses v5. This mismatch has always been present (resolved with proxy client pattern in 01-01). Adding new packages requires `--legacy-peer-deps` until this peer dep conflict is resolved.

4. **Height `calc(100vh)` instead of `h-screen`**: Both render identically, but the explicit style makes the 01-05 adjustment obvious — the title bar plan just changes this to `calc(100vh - 32px)` or `calc(100vh - 36px)` based on platform.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @radix-ui/react-tabs not installed**
- **Found during:** Task 3 (creating tabs.tsx component)
- **Issue:** The plan says "shadcn Tabs (already installed via 01-01 `npx shadcn add tabs`)" but the tabs component was not present in `src/renderer/src/components/ui/` and `@radix-ui/react-tabs` was not installed.
- **Fix:** Installed `@radix-ui/react-tabs` with `--legacy-peer-deps`, created `tabs.tsx` shadcn copy-in component manually.
- **Files modified:** `src/renderer/src/components/ui/tabs.tsx` (created), `package.json`
- **Verification:** TypeScript typecheck passes; grep confirms Tabs/TabsList/TabsTrigger/TabsContent are exported
- **Committed in:** `90c74ef`, `bb701d5`

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking)
**Impact on plan:** Necessary to unblock Task 3. The tabs component was listed as a prerequisite from 01-01 but was not actually installed. The fix is equivalent to the planned `npx shadcn add tabs` step.

## Issues Encountered

- `npm install @radix-ui/react-tabs` failed with ERESOLVE due to the pre-existing `@trpc/react-query@10` peer dep conflict. Used `--legacy-peer-deps` as required throughout this project.

## Known Stubs

The following are intentional scaffolding stubs per D-08 and the UI-SPEC Copywriting Contract:

| Stub | File | Reason | Resolving Plan |
|------|------|--------|----------------|
| Left panel: "AI narration appears here." | CampaignViewScreen.tsx:72 | D-10: no skeleton bubbles | Phase 3 (AI Engine) |
| Character Sheet tab placeholder | CampaignViewScreen.tsx:82 | D-08: empty shell | Phase 2 (Character Domain) |
| Combat Tracker tab placeholder | CampaignViewScreen.tsx:92 | D-08: empty shell | Phase 5 (Rules Engine) |
| NPC Tracker tab placeholder | CampaignViewScreen.tsx:102 | D-08: empty shell | Phase 6 (World State) |
| Session Journal tab placeholder | CampaignViewScreen.tsx:112 | D-08: empty shell | Phase 4 (Session Memory) |
| Inventory tab placeholder | CampaignViewScreen.tsx:122 | D-08: empty shell | Phase 2 (Character Domain) |

All stubs are the plan's intended output for this phase — they don't prevent the plan's goal (SESS-01: user sees the split-panel layout). Each is labeled with the phase that fills it.

## Threat Surface Scan

Both threats from the plan's threat model are mitigated:

| Flag | File | Status |
|------|------|--------|
| T-01-04-01: Tampering — prefs.panelSize.set IPC input | src/main/trpc/routers/prefs.ts | MITIGATED — Zod: campaignId z.string().uuid(), leftSize/rightSize z.number().min(0).max(100) |
| T-01-04-02: DoS — panel size persistence | src/main/trpc/routers/prefs.ts | ACCEPTED — values bounded 0–100, no unbounded growth |

No new threat surface beyond the plan's threat model.

## Next Phase Readiness

- 01-05 (Title Bar) can now render the TitleBar component above the `<div className="flex flex-col" style={{ height: '100vh' }}>` wrapper. The title bar plan just needs to adjust the height to `calc(100vh - TITLE_BAR_HEIGHT)`.
- 01-06 (Settings) and 01-07 (Smoke Tests) are unblocked.
- Phase 3 can replace "AI narration appears here." with the actual chat input and streaming narration.
- Phase 2 can fill Character Sheet and Inventory tabs.

## Self-Check: PASSED

- src/main/trpc/routers/prefs.ts: FOUND (panelSize.get + panelSize.set)
- src/renderer/src/stores/panelSizeStore.ts: FOUND (usePanelSizeStore, load, save, setLocalSizes)
- src/renderer/src/screens/CampaignViewScreen.tsx: FOUND (PanelGroup, character-sheet, AI narration appears here.)
- src/renderer/src/components/ui/tabs.tsx: FOUND (Tabs, TabsList, TabsTrigger, TabsContent)
- Commit fefa366: Task 1
- Commit 1f9dc78: Task 2
- Commit 90c74ef: Task 3
- Commit bb701d5: chore

---
*Phase: 01-foundation-secure-shell*
*Completed: 2026-05-24*
