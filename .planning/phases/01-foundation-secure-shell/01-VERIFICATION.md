---
phase: 01-foundation-secure-shell
verified: 2026-05-24T14:40:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/8
  gaps_closed:
    - "User sees split-panel layout on entering campaign (ROADMAP SC-3 / SESS-01)"
    - "Packaged build smoke test scripts and CI matrix exist (ROADMAP SC-1 / FOUND-01)"
    - "SecretStorageService lazy dir getter — CR-03 startup crash risk eliminated"
    - "localhost IPC guard is dev-only — CR-04 security gap fixed"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Install from packaged build on Windows and launch"
    expected: "App installs via NSIS installer, launches without dependency errors, shows the dark-themed campaign list screen with a frameless custom title bar"
    why_human: "No packaged build has been run in this verification session; smoke scripts test artifacts but CI has not executed yet. Cannot verify NSIS-installed binary behaviour programmatically from source."
  - test: "Create a campaign, quit the app, reopen it, verify campaign persists"
    expected: "Campaign created in the modal appears in the card grid after app restart with the same name and creation date"
    why_human: "Requires running the app — cannot verify SQLite WAL persistence across process restart programmatically from source alone."
  - test: "Navigate to a campaign and verify the split-panel layout renders correctly"
    expected: "Left panel shows 'AI narration appears here.' centered in muted text; right panel shows 5 shadcn Tabs with 'Character Sheet' active by default; dragging the resize handle works and snaps to min constraints"
    why_human: "Visual layout and interactive resize behaviour require a running app. The code wiring is verified; the rendered output needs human confirmation."
  - test: "Drag the title bar to move the window; close and reopen — verify window restores to saved size and position"
    expected: "Window reappears at the same screen position and dimensions from the previous session"
    why_human: "Window bounds persistence requires two app launch cycles to verify. Requires running the app."
  - test: "Click Minimize, Maximize, and Close buttons in the title bar"
    expected: "Minimize hides to taskbar, Maximize/Restore toggles correctly (icon switches between Square and Copy), Close quits the app"
    why_human: "Window control behaviour is not verifiable from source — requires the Electron window to be running."
---

# Phase 1: Foundation & Secure Shell — Re-Verification Report

**Phase Goal:** A user can install SoloCampaign on Windows/macOS/Linux, launch it, create a new campaign that persists across restarts, and see the split-panel layout shell — on a secure-by-default Electron baseline backed by SQLite.
**Verified:** 2026-05-24T14:40:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous status: gaps_found, 5/8)

---

## Goal Achievement

### ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC-1 | User can install and launch on Win/Mac/Linux from packaged build without manual dep setup | VERIFIED (code) / HUMAN (runtime) | Smoke scripts + CI matrix exist; scripts/smoke/smoke.win.ps1, .mac.sh, .linux.sh all present with ASAR/migration/launch checks; .github/workflows/smoke.yml covers all 3 platforms |
| SC-2 | User can create a new campaign, close, reopen, and see data intact | VERIFIED | Drizzle migrate() + backup rotation + WAL + single-instance lock all confirmed in code; SQLite persist chain intact |
| SC-3 | User sees split-panel layout (narrative chat left, tabbed right panel) on entering campaign | VERIFIED (code) / HUMAN (visual) | CampaignViewScreen.tsx: PanelGroup 60/40 split, 5 TabsTriggers (character-sheet/combat-tracker/npc-tracker/session-journal/inventory), "AI narration appears here." left panel — all confirmed at source level |
| SC-4 | Electron renderer: contextIsolation enabled, nodeIntegration disabled, all IPC via Zod | VERIFIED | contextIsolation: true (line 84), sandbox: true (line 85), nodeIntegration: false (line 86) in src/main/index.ts; Zod schemas on all IPC inputs; isDev guard on localhost |

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T-1 | User can install and launch from a packaged build on Win/Mac/Linux | VERIFIED (scripts) | smoke.win.ps1 checks .exe artifact, ASAR-unpacked .node, migration SQL, launch, single-instance, solocampaign.db; smoke.mac.sh and smoke.linux.sh mirror all 7 checks |
| T-2 | User can create a new campaign, restart, see data intact | VERIFIED | migrate.ts uses ASAR-safe path; backupRotation.ts with MAX_BACKUPS=10; WAL pragma; single-instance lock before app.whenReady |
| T-3 | User sees split-panel layout on entering campaign | VERIFIED | PanelGroup from react-resizable-panels confirmed; stub text "Campaign loaded:" absent; 5 tab values present; "AI narration appears here." present at line 91-93 |
| T-4 | contextIsolation: true, sandbox: true, nodeIntegration: false literal in BrowserWindow | VERIFIED | src/main/index.ts lines 84-86 confirmed |
| T-5 | SecretStorageService uses lazy getter (no eager app.getPath at module load) | VERIFIED | "private get dir(): string" present at line 11; "private dir = path.join" absent (no match) — CR-03 fix confirmed |
| T-6 | B64 fallback decrypt uses .toString('ascii') | VERIFIED | Line 81 of secretStorageService.ts: buf.subarray(4).toString('ascii') — CR-05 fix confirmed |
| T-7 | DB init failure shows dialog.showErrorBox and calls app.quit() | VERIFIED | src/main/index.ts lines 34-39 confirmed; dialog imported from electron line 1; showErrorBox + app.quit() + return in catch block |
| T-8 | localhost IPC access gated to isDev only (not allowed in production) | VERIFIED | src/main/index.ts lines 119-123: const isDev = process.env.NODE_ENV === 'development'; guard wraps http://localhost check — CR-04 fix confirmed |

**Score: 8/8 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/screens/CampaignViewScreen.tsx` | Full split-panel layout with PanelGroup + Tabs; replaces stub | VERIFIED | 187 lines; imports Panel/PanelGroup/PanelResizeHandle; 5 TabsTrigger values; "AI narration appears here."; stub text absent |
| `src/renderer/src/stores/panelSizeStore.ts` | Zustand store for panel size state + load/save helpers | VERIFIED | usePanelSizeStore exported; load/save/setLocalSizes; trpc.prefs.panelSize.get/set calls |
| `src/main/trpc/routers/prefs.ts` | panelSize.get + panelSize.set procedures | VERIFIED | prefsRouter exports panelSize.get (query, default 60/40) and panelSize.set (mutation); Zod UUID + 0-100 bounds |
| `src/renderer/src/components/TitleBar.tsx` | Custom frameless title bar with drag region and window controls | VERIFIED | WebkitAppRegion: 'drag' on bar; 'no-drag' on buttons/text; Minus/Square/Copy/X from lucide-react; trpc.window.minimize/maximize/close.mutate() |
| `src/renderer/src/stores/windowStore.ts` | Campaign name state for title bar | VERIFIED | useWindowStore with campaignName + setCampaignName |
| `src/main/trpc/routers/window.ts` | minimize/maximize/close/isMaximized tRPC procedures | VERIFIED | All 4 procedures using BrowserWindow.getFocusedWindow(); no raw IPC from renderer |
| `src/main/index.ts` | Frameless BrowserWindow + bounds persistence + DB error dialog + isDev IPC guard | VERIFIED | titleBarStyle/frame:false; boundsStore; dialog.showErrorBox; isDev guard; all security flags preserved |
| `src/main/secrets/secretStorageService.ts` | Fixed: lazy dir getter + ascii B64 decode | VERIFIED | private get dir() at line 11; .toString('ascii') at line 81; isEncryptionAvailable; getSelectedStorageBackend; B64: prefix |
| `scripts/smoke/smoke.win.ps1` | Windows packaged build smoke test | VERIFIED | Exists; contains asar.unpacked, solocampaign.db, 0000_absent_thunderball, exit 0/exit 1 |
| `scripts/smoke/smoke.mac.sh` | macOS packaged build smoke test | VERIFIED | Exists; #!/usr/bin/env bash shebang; contains asar.unpacked, solocampaign.db, 0000_absent_thunderball |
| `scripts/smoke/smoke.linux.sh` | Linux packaged build smoke test | VERIFIED | Exists; #!/usr/bin/env bash shebang; contains asar.unpacked, solocampaign.db, 0000_absent_thunderball |
| `.github/workflows/smoke.yml` | CI matrix running smoke tests on all 3 platforms | VERIFIED | windows-latest, macos-latest, ubuntu-latest; npm ci + @electron/rebuild + npm run build + smoke script; CSC_IDENTITY_AUTO_DISCOVERY: false |
| `src/renderer/src/App.tsx` | TitleBar above routes, flex-col wrapper | VERIFIED | TitleBar imported and rendered; div.flex.flex-col.h-screen.overflow-hidden wraps TitleBar + main |
| `resources/migrations/0000_absent_thunderball.sql` | Drizzle migration SQL for campaigns table | VERIFIED | File exists in resources/migrations/ |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| CampaignViewScreen.tsx | panelSizeStore.ts | usePanelSizeStore hook | WIRED | store.load(id), store.save(), store.setLocalSizes() called in component |
| panelSizeStore.ts | prefs.ts | trpc.prefs.panelSize.get/set | WIRED | trpc.prefs.panelSize.get.query and trpc.prefs.panelSize.set.mutate called in load/save |
| TitleBar.tsx | window.ts | trpc.window.minimize/maximize/close.mutate() | WIRED | All 3 button onClick handlers confirmed |
| CampaignViewScreen.tsx | windowStore.ts | setCampaignName on mount/unmount | WIRED | useEffect at lines 23-30 calls setCampaignName with campaign name; cleanup calls setCampaignName(null) |
| App.tsx | TitleBar.tsx | import + render above routes | WIRED | TitleBar imported from ./components/TitleBar; rendered as first child of flex-col container |
| index.ts | dialog API | dialog.showErrorBox on DB init failure | WIRED | dialog imported at line 1; showErrorBox called in catch block at lines 34-38 |
| index.ts | IPC senderFrame | isDev guard on localhost | WIRED | isDev = process.env.NODE_ENV === 'development' at line 119; guards localhost check at lines 121-123 |
| smoke.yml | smoke scripts | pwsh/bash runner per platform | WIRED | matrix.script in smoke.yml references smoke.win.ps1, smoke.mac.sh, smoke.linux.sh |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CampaignViewScreen.tsx | sizes (leftSize/rightSize) | trpc.prefs.panelSize.get → electron-store | Yes — electron-store keyed by campaign UUID; defaults to 60/40 if no stored value | FLOWING |
| TitleBar.tsx | campaignName | useWindowStore (set by CampaignViewScreen on campaign data load) | Yes — campaignQuery.data.name from real SQLite query via tRPC | FLOWING |
| panelSizeStore.ts | sizes | trpc.prefs.panelSize.get.query({ campaignId }) | Yes — electron-store returns stored value or default | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript typecheck passes | npm run typecheck | 0 errors (clean exit) | PASS |
| 34 unit tests pass | npx vitest run | 34/34 passed (2 test files) | PASS |
| CampaignViewScreen has PanelGroup | grep "PanelGroup" src/renderer/src/screens/CampaignViewScreen.tsx | line 83: PanelGroup direction="horizontal" | PASS |
| Stub text absent | grep "Campaign loaded" CampaignViewScreen.tsx | No matches found | PASS |
| lazy getter present | grep "private get dir()" secretStorageService.ts | line 11 match | PASS |
| eager init absent | grep "private dir = path.join" secretStorageService.ts | No matches found | PASS |
| isDev guard present | grep "NODE_ENV.*development" src/main/index.ts | line 119 match | PASS |
| smoke scripts exist | Glob scripts/smoke/* | 3 files: smoke.win.ps1, smoke.mac.sh, smoke.linux.sh | PASS |

---

## Probe Execution

Step 7c: No probe scripts declared in plan frontmatter. Conventional `scripts/*/tests/probe-*.sh` pattern: no files found matching this pattern. The smoke scripts in `scripts/smoke/` are _build_ verification scripts, not pre-execution probes — they require a `npm run build` output to run against and cannot execute in the source tree without a packaged build. Marked SKIP (requires packaged artifacts).

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| scripts/smoke/smoke.win.ps1 | bash "$probe" | Requires packaged dist/ artifacts | SKIP — needs built app |
| scripts/smoke/smoke.mac.sh | bash "$probe" | Requires packaged dist/ artifacts | SKIP — needs built app |
| scripts/smoke/smoke.linux.sh | bash "$probe" | Requires packaged dist/ artifacts | SKIP — needs built app |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOUND-01 | 01-01, 01-05, 01-07 | User can install and launch on Win/Mac/Linux | SATISFIED (scripts) | Smoke scripts + CI matrix verify packaged build; frameless window chrome in 01-05 |
| FOUND-02 | 01-01, 01-02 | All campaign data persists locally in SQLite with versioned schema migrations | SATISFIED | Drizzle migrate() + backup rotation + WAL + single-instance lock all wired |
| FOUND-04 | 01-03, 01-06 | API keys stored encrypted via Electron safeStorage (never plaintext) | SATISFIED | SecretStorageService: safeStorage path + B64 fallback; lazy getter (CR-03 fixed); ascii decode (CR-05 fixed); no get procedure over IPC |
| SESS-01 | 01-04 | Split-panel layout with narrative chat left and 5-tab right panel | SATISFIED | CampaignViewScreen: PanelGroup 60/40, 5 TabsTriggers, "AI narration appears here.", Character Sheet default |

---

## Anti-Patterns Found

Scanned files modified across all phase plans (01-01 through 01-07).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| TitleBar.tsx | 13 | TODO comment: "TODO: 01-05 — hide Win/Linux controls on macOS via platform IPC if desired in a later polish pass" | Info | Intentional UX compromise noted in plan — macOS shows both native traffic lights (left) and custom buttons (right). No formal issue reference, but the plan itself explicitly documented this as Phase 1 acceptable behaviour. |

No TBD/FIXME/XXX markers found in modified files. No unreferenced debt markers. The TODO in TitleBar.tsx references a future polish pass and is within the accepted behaviour described by the plan — it is informational only, not a blocker.

---

## Human Verification Required

### 1. Packaged Build Launch (FOUND-01 runtime clause)

**Test:** Build the app (`npm run build`) and run `pwsh -File scripts/smoke/smoke.win.ps1` on Windows (or the appropriate script on macOS/Linux).
**Expected:** All 7 smoke checks pass — installer artifact, ASAR-unpacked better-sqlite3 .node file, Drizzle migration SQL at resourcesPath, app launches without crash within 6s, single-instance lock exits second process, solocampaign.db created in userData.
**Why human:** The smoke scripts require a packaged build (`dist/` output from `npm run build`). No packaged build was produced during this verification session. Source-level checks confirm the scripts and CI matrix are correct; runtime behaviour needs a real build run.

### 2. Campaign Persistence Across Restart (SC-2 / FOUND-02)

**Test:** Run `npm run dev`, create a new campaign via the modal, close the app window, reopen with `npm run dev`, verify the campaign card appears.
**Expected:** Campaign name and creation date visible in the card grid after restart. SQLite DB file exists at `%APPDATA%\SoloCampaign\solocampaign.db` (Windows) or equivalent.
**Why human:** Requires running the app through two lifecycle cycles. SQLite persistence logic is verified at source level; the actual round-trip across process restart needs a live app.

### 3. Split-Panel Layout Visual and Interaction (SC-3 / SESS-01)

**Test:** Run `npm run dev`, create a campaign, click the campaign card to navigate to `/campaign/:id`. Verify: (1) left panel shows "AI narration appears here." centered, (2) "Character Sheet" tab is active by default, (3) all 5 tab labels are visible and clickable, (4) dragging the resize handle moves the divider and respects min constraints.
**Expected:** Full split-panel layout renders as designed. No stub text, no "Campaign loaded:" heading. Resize handle has hover affordance.
**Why human:** Visual rendering and interactive panel resize require a running Electron app. Code wiring is confirmed at source level.

### 4. Title Bar — Drag, Window Controls, Campaign Name (01-05)

**Test:** Run `npm run dev`. Verify: (1) custom title bar visible at top with "SoloCampaign" text, (2) dragging the title bar (not buttons) moves the window, (3) Minimize/Maximize/Close buttons work, (4) clicking a campaign card updates the title bar to "SoloCampaign — {name}", (5) pressing Back (or navigating to /) clears the campaign name.
**Expected:** All 5 behaviours work correctly. The window controls call tRPC procedures (not raw Electron APIs).
**Why human:** Window chrome interaction, drag region, and title text update all require a running Electron window.

### 5. Window Bounds Persistence (01-05)

**Test:** Run `npm run dev`, resize and move the window, close the app, reopen — verify window restores to the same size and position.
**Expected:** Window appears at the position and dimensions from the previous session. `windowBounds.json` exists in the Electron userData directory.
**Why human:** Requires two app launch cycles and visual inspection of window position.

---

## Gaps Summary

No gaps remain. All 4 gaps from the previous verification (01-04 split-panel stub, 01-07 missing smoke scripts, CR-03 startup crash risk, CR-04 localhost IPC in production) have been resolved:

- Gap 1 (SC-3): CampaignViewScreen replaced with full PanelGroup + Tabs implementation (01-04).
- Gap 2 (SC-1): Three platform smoke scripts and GitHub Actions CI matrix created (01-07).
- Gap 3 (CR-03): SecretStorageService lazy getter confirmed; eager initialization absent.
- Gap 4 (CR-04): isDev guard confirmed on localhost IPC check.

The phase proceeds to `human_needed` because 5 items require a running app to verify (visual layout, runtime persistence, window interaction, packaged build smoke). All automated checks pass at 8/8.

---

## Self-Check

- [x] TypeScript typecheck: `npm run typecheck` — 0 errors (clean exit)
- [x] Unit tests: `npx vitest run` — 34/34 passed
- [x] All 8 ROADMAP/plan must-haves verified in actual source files
- [x] Previous 4 gaps confirmed closed in code
- [x] No regressions: contextIsolation/sandbox/nodeIntegration flags intact; senderFrame validation intact; secretStorage.init() still called; isSecure() still checks both conditions
- [x] No new TBD/FIXME/XXX blockers introduced
- [x] Status correctly set to human_needed (5 human verification items, no automated gaps)

---

_Verified: 2026-05-24T14:40:00Z_
_Verifier: Claude (gsd-verifier)_
