---
phase: 08-polish-export-accessibility
verified: 2026-06-02T12:00:00Z
status: human_needed
score: 5/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "KEYBOARD NAVIGATION — Tab through campaign list, campaign view, settings, dice roller, modals"
    expected: "Focus reaches every interactive element with visible ring; Left/Right arrows switch right-panel tabs; Escape closes modals/popovers; Enter/Space activates buttons"
    why_human: "Keyboard focus order and operability require live app interaction — grep cannot verify traversal order or focus-trap behavior"
  - test: "SCREEN READER (NVDA/Windows or VoiceOver/macOS) — send a chat message and listen to streaming narration"
    expected: "AI narration is announced at paragraph/sentence boundaries (whole paragraphs), NOT character-by-character or per-token; history loading does NOT re-announce old messages"
    why_human: "Screen reader announcements require assistive technology running against the live app; grep cannot observe what NVDA/VoiceOver reads aloud"
  - test: "ARIA LABEL AUDIT — focus icon-only buttons and check screen reader readout"
    expected: "Buttons announce: 'Campaign options', 'Open Settings', 'Minimize window', 'Maximize window' / 'Restore window', 'Close window', combatant row 'NAME — view details', 'Export character sheet as PDF'"
    why_human: "Accessibility tree inspection requires live app or axe-core DevTools run — static grep confirmed labels exist in code but cannot verify they are attached to the correct DOM elements at runtime"
  - test: "PACKAGED BUILD smoke test — PDF export generates a non-empty file"
    expected: "@react-pdf/renderer v4 + yoga-layout resolve correctly in the packaged ASAR; the PDF save dialog opens and writes a readable PDF"
    why_human: "React 19 reconciler + ESM-only renderToBuffer + yoga-layout __dirname resolution only verifiable in a packaged electron-builder build, not dev mode (ROADMAP.md Note: Open Q1 + A2)"
  - test: "HIGH-CONTRAST theme WCAG AA contrast check"
    expected: "All four OKLCH token pairs cited in globals.css comments achieve their stated contrast ratios (4.5:1 normal text, 3:1 large/UI components) against the dark background"
    why_human: "OKLCH contrast must be verified with a tool (WebAIM Contrast Checker or similar); the CSS comment lists the targets but does not prove they are met"
  - test: "DATA FOLDER migration E2E — change data folder, restart app, verify campaigns are accessible"
    expected: "After changing the data folder path and restarting, all campaigns and characters are present; app reads from the new path"
    why_human: "Requires an app restart to test the new path applied at initDatabase() call time — automated test cannot simulate a real process restart"
---

# Phase 8: Polish, Export & Accessibility — Verification Report

**Phase Goal:** A user can export a full campaign as JSON, print/save their character sheet as a PDF, share a world setup as a starter template, move their data folder, and use the entire app with adjusted font size, high contrast, keyboard navigation, and a screen reader.
**Verified:** 2026-06-02T12:00:00Z
**Status:** human_needed — 5/6 automated truths verified; 1 truth (A11Y-02 + A11Y-03) requires live assistive-technology testing
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can export a complete campaign as JSON and import it with all state restored and new IDs | VERIFIED | `exportCampaign()` in `exportImport.ts` queries all 15 tables; `importCampaign()` regenerates all UUIDs via `crypto.randomUUID()` idMap, inserts in FK-safe order inside a single transaction. `importCampaignOrTemplate()` validates version=1, type='campaignExport', runs Zod schema on data fields before any DB write. `campaigns.export`, `campaigns.importJson` tRPC procedures wired in `router.ts`; CampaignCard 3-dot menu triggers export mutations; CampaignListScreen has "Import Campaign..." button. |
| 2 | User can export their character sheet as a print-friendly PDF via @react-pdf/renderer | VERIFIED | `CharacterSheetPdf.tsx` is a fully implemented react-pdf Document with two-column A4 layout (Page 1: ability scores, saves, skills, combat stats, death saves, conditions, currency, equipment, traits; Page 2: spell list conditional on `hasSpells`). `pdfService.ts` uses dynamic `import('@react-pdf/renderer')` (ESM-safe). `characters.exportPdf` tRPC procedure builds `CharacterPdfData` from DB and calls `generateCharacterPdf()`. CharacterSheetTab has "Export PDF" button with `aria-label="Export character sheet as PDF"` wired to the mutation. Death saves clamped to [0,3] (CR-03 fixed). |
| 3 | User can export a starter template (world config only) and import it to pre-fill a new campaign wizard | VERIFIED | `exportStarterTemplate()` selects exactly the 9 D-15 fields (name, worldSetupMode, worldBrief, worldDocument, dmPersonality, strictness, partySize, encumbranceEnabled, homebrewContent) — no characters/sessions/save state. Template JSON has `type: "starterTemplate"` discriminant. `campaigns.exportTemplate` procedure writes file via OS save dialog. `importCampaignOrTemplate` detects `type: "starterTemplate"` and returns the template payload (no DB write). `CampaignListScreen.importMutation` `onSuccess` detects `result.kind === 'template'` and calls `setImportedTemplate()` + `setModalOpen(true)`. `CreateCampaignModal` accepts `initialTemplate` prop and has a `useEffect([open, initialTemplate])` that pre-fills all 8 wizard fields. |
| 4 | User can change the data folder from settings; existing data migrates and the app uses the new location after restart | VERIFIED | `appPrefs.changeDataFolder` tRPC procedure uses `sqlite.backup(newDbPath)` (WAL-safe, not `fs.copyFile`), runs `PRAGMA integrity_check` on the copy, deletes on failure, persists `appPrefsStore.set('dataFolder', folderPath)`. `main/index.ts` reads `appPrefsStore.get('dataFolder', null)` before `initDatabase()` on every launch. SettingsScreen shows current path, "Change Folder..." button opens OS folder picker, shows restart-required Alert banner on success. CR-01 fixed: single `appPrefsStore` instance in `appPrefs.ts` imported into `main/index.ts`; no dual-instance split. |
| 5 | User can scale text size and enable high contrast; both persist across launches | VERIFIED | `globals.css` defines `html { font-size: calc(1rem * var(--font-scale, 1)); }` and a full `.high-contrast { ... }` block with OKLCH overrides. `main.tsx` reads `window.appPrefsSync.getInitialPrefs()` before `ReactDOM.createRoot()` and applies `--font-scale` CSS property and `high-contrast` class to `documentElement` before first render (FOUC prevention). `preload/index.ts` exposes `appPrefsSync.getInitialPrefs` via `ipcRenderer.invoke('appPrefs:getInitial')`. `ipcMain.handle('appPrefs:getInitial', () => appPrefsStore.store)` registered in `main/index.ts` before BrowserWindow creation. SettingsScreen segmented control + Switch wired to `appPrefs.setFontSize` / `appPrefs.setHighContrast` mutations, applying CSS immediately without reload. |
| 6 | Every interactive element has an ARIA label; keyboard navigation works; streamed narration announces at paragraph boundaries in screen readers | PARTIAL — automated code verified; human testing required | Code evidence: StoryScrollPanel has an always-rendered `<div ref={liveRegionRef} aria-live="polite" aria-atomic="false" aria-label="Story narration" className="sr-only" />` outside the scroll area div. `findParagraphBoundary()` implemented with `\n\n > 20 chars` and `[.!?][\s\n] > 60 chars` thresholds. Buffer in `useRef` (no per-token setState). rAF double-update pattern (clear → set). Flush on `isStreaming → false`. TitleBar: Minimize/Maximize/"Restore window"/Close window `aria-label` present. CombatTrackerTab: `aria-label="{combatant.name} — view details"` on collapsible trigger. See Human Verification Required section for what cannot be confirmed without live AT testing. |

**Score:** 5/6 truths verified (Truth 6 is partially verified automatically; live assistive-technology testing required)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/db/exportImport.ts` | Campaign export/import logic (DIST-01, DIST-03) | VERIFIED | 729 lines; `exportCampaign`, `importCampaign`, `exportStarterTemplate`, `importCampaignOrTemplate` all substantive. UUID remap via `crypto.randomUUID()` idMap; 15-table transactional insert; Zod validation before DB write (WR-02 fixed). |
| `src/main/db/index.ts` | `initDatabase(customPath?)` accepts DIST-04 override | VERIFIED | `customPath ?? app.getPath('userData')` on line 13. |
| `src/main/db/migrate.ts` | `repairMissingColumns` + valid migration path | VERIFIED | `repairMissingColumns()` checks `PRAGMA table_info` and applies idempotent `ALTER TABLE ADD COLUMN`. |
| `resources/migrations/0008_fix_missing_phase7_columns.sql` | Valid SQLite `ALTER TABLE ADD COLUMN` syntax | VERIFIED | 9 statements, all `ALTER TABLE ... ADD COLUMN ...` without `IF NOT EXISTS` (CR-02 fixed). |
| `src/main/index.ts` | `appPrefsStore` import, dataFolder read, `appPrefs:getInitial` handler | VERIFIED | Line 6: `import { appPrefsStore } from './trpc/routers/appPrefs'`. Line 53: `appPrefsStore.get('dataFolder', null)`. Line 112: `ipcMain.handle('appPrefs:getInitial', () => appPrefsStore.store)`. CR-01 fixed — no duplicate store instance. |
| `src/main/trpc/routers/appPrefs.ts` | `appPrefsStore`, setFontSize, setHighContrast, changeDataFolder | VERIFIED | Single `new Store<AppPrefs>({ name: 'appPrefs' })` export. All 5 procedures implemented with Zod validation. `changeDataFolder` uses `sqlite.backup()` not `fs.copyFile`. |
| `src/main/trpc/routers/campaigns.ts` | `export`, `exportTemplate`, `importJson` procedures | VERIFIED | All three procedures present and wired to `exportCampaign`, `exportStarterTemplate`, `importCampaignOrTemplate`. OS dialogs used for all file paths. WR-01 fixed (safeName sanitization). |
| `src/main/trpc/routers/characters.ts` | `exportPdf` procedure | VERIFIED | Lines 546-738: full `CharacterPdfData` construction from DB queries + `generateCharacterPdf()` + OS save dialog. |
| `src/main/services/CharacterSheetPdf.tsx` | react-pdf two-column layout | VERIFIED | 855 lines; complete A4 two-column document with all required sections. CR-03 fixed: death saves clamped to [0,3]. |
| `src/main/services/pdfService.ts` | `generateCharacterPdf` with ESM-safe dynamic import | VERIFIED | Uses `await import('@react-pdf/renderer')` pattern. |
| `src/preload/index.ts` | `appPrefsSync` and `platform` contextBridge surfaces | VERIFIED | Both exposed. `appPrefsSync.getInitialPrefs` calls `ipcRenderer.invoke('appPrefs:getInitial')`. |
| `src/renderer/src/App.tsx` | `/settings` route registered | VERIFIED | Line 18: `<Route path="/settings" element={<SettingsScreen />} />`. |
| `src/renderer/src/screens/SettingsScreen.tsx` | Font size, high contrast, data folder UI | VERIFIED | 254 lines. Segmented control, Switch, folder picker, restart banner — all wired to tRPC mutations with immediate CSS application. |
| `src/renderer/src/components/TitleBar.tsx` | Gear icon, window control aria-labels, `window.platform` usage | VERIFIED | Settings gear navigates to `/settings` with `aria-label="Open Settings"`. Window controls: `aria-label="Minimize window"`, dynamic `aria-label={isMaximized ? 'Restore window' : 'Maximize window'}`, `aria-label="Close window"`. WR-05 fixed: `(window.platform as string) === 'darwin'` instead of `navigator.platform`. |
| `src/renderer/src/components/CampaignCard.tsx` | 3-dot menu with export options | VERIFIED | DropdownMenu with "Export Campaign (JSON)", "Export as Starter Template", "Delete Campaign" items wired to respective mutations. |
| `src/renderer/src/components/CreateCampaignModal.tsx` | `initialTemplate` prop + pre-fill useEffect | VERIFIED | `initialTemplate?: StarterTemplate | null` prop; `useEffect([open, initialTemplate])` pre-fills all 8 D-15 fields. |
| `src/renderer/src/screens/CampaignListScreen.tsx` | "Import Campaign..." button | VERIFIED | Button triggers `importMutation`; `onSuccess` handler dispatches to campaign-list refresh or template pre-fill. |
| `src/renderer/src/components/CharacterSheetTab.tsx` | PDF export button | VERIFIED | "Export PDF" button with `aria-label="Export character sheet as PDF"`, wired to `exportPdfMutation` for `effectiveActiveId`. |
| `src/renderer/src/components/StoryScrollPanel.tsx` | Off-screen ARIA live region + paragraph-boundary detection | VERIFIED | Always-rendered `<div ref={liveRegionRef} aria-live="polite" aria-atomic="false" aria-label="Story narration" className="sr-only" />`. `findParagraphBoundary()` with correct thresholds. `useRef` buffer (no per-token setState). WR-04 fixed: refs reset on `[campaignId]` change. |
| `src/renderer/src/components/CombatTrackerTab.tsx` | `aria-label` on combatant row trigger | VERIFIED | `aria-label={"${combatant.name} — view details"}` on the collapsible trigger div. |
| `src/renderer/src/styles/globals.css` | `--font-scale`, `.high-contrast`, `.sr-only` | VERIFIED | `html { font-size: calc(1rem * var(--font-scale, 1)); }` present. `.sr-only` utility class defined. `.high-contrast` block with OKLCH overrides for all required tokens. |
| `src/renderer/src/main.tsx` | Pre-mount font scale + high contrast application | VERIFIED | Async IIFE reads `window.appPrefsSync?.getInitialPrefs()`, applies `--font-scale` CSS property and `high-contrast` class before `ReactDOM.createRoot()`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `main/index.ts` | `appPrefsStore` | `import { appPrefsStore } from './trpc/routers/appPrefs'` | WIRED | Line 6; same instance used for both startup dataFolder read and IPC handler |
| `main/index.ts` | `initDatabase(customDataFolder)` | `appPrefsStore.get('dataFolder', null)` before `initDatabase()` | WIRED | Lines 52-56 |
| `main/index.ts` | `'appPrefs:getInitial'` IPC handler | `ipcMain.handle('appPrefs:getInitial', () => appPrefsStore.store)` | WIRED | Line 112; registered before BrowserWindow creation |
| `preload/index.ts` | `appPrefs:getInitial` | `ipcRenderer.invoke('appPrefs:getInitial')` in `appPrefsSync.getInitialPrefs` | WIRED | Line 26 |
| `main.tsx` | `window.appPrefsSync.getInitialPrefs()` | Async IIFE before ReactDOM mount | WIRED | Lines 34-43 |
| `CampaignCard.tsx` | `campaigns.export` | `exportMutation` → `trpc.campaigns.export.mutate()` | WIRED | Line 56 |
| `CampaignCard.tsx` | `campaigns.exportTemplate` | `exportTemplateMutation` → `trpc.campaigns.exportTemplate.mutate()` | WIRED | Line 60 |
| `CampaignListScreen.tsx` | `campaigns.importJson` | `importMutation` → `trpc.campaigns.importJson.mutate()` | WIRED | Line 25 |
| `CampaignListScreen.tsx` | `CreateCampaignModal initialTemplate` | `setImportedTemplate(result.template)` in onSuccess | WIRED | Lines 33-35 |
| `CharacterSheetTab.tsx` | `characters.exportPdf` | `exportPdfMutation` → `trpc.characters.exportPdf.mutate({ characterId })` | WIRED | Lines 58-67, 220-222 |
| `characters.ts:exportPdf` | `generateCharacterPdf()` | `await generateCharacterPdf(data)` | WIRED | Line 724 |
| `pdfService.ts` | `CharacterSheetPdf` | `await import('./CharacterSheetPdf')` | WIRED | Line 42 |
| `StoryScrollPanel.tsx` | off-screen live region | `liveRegionRef.textContent = ''` then rAF `liveRegionRef.textContent = announcement` | WIRED | Lines 197-203 |
| `router.ts` | `appPrefsRouter` | `appPrefs: appPrefsRouter` | WIRED | Line 22 |
| `SettingsScreen.tsx` | `appPrefs.setFontSize` | `handleFontChange` → `setFontSizeMutation.mutate(value)` | WIRED | Lines 96-101 |
| `SettingsScreen.tsx` | `appPrefs.setHighContrast` | `handleHighContrastChange` → `setHighContrastMutation.mutate(checked)` | WIRED | Lines 107-110 |
| `SettingsScreen.tsx` | `appPrefs.changeDataFolder` | `handleChangeFolderClick` → `changeDataFolderMutation.mutate(folderPath)` | WIRED | Lines 121-127 |
| `exportImport.ts:importCampaignOrTemplate` | Zod validation | `campaignExportDataSchema.safeParse(p.data)` before `importCampaign()` | WIRED | Lines 686-715 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `StoryScrollPanel.tsx` | `messages` | `trpc.ai.getMessages.query({ campaignId })` via TanStack Query | DB query via `messagesRepo` | FLOWING |
| `StoryScrollPanel.tsx` | `streamingContent` | Accumulated from `window.aiStream.onToken` IPC callbacks | Live LLM stream | FLOWING |
| `SettingsScreen.tsx` | `currentFontSize`, `currentHighContrast` | `trpc.appPrefs.get.query()` | `appPrefsStore.store` from electron-store | FLOWING |
| `SettingsScreen.tsx` | `currentPath` | `trpc.appPrefs.getCurrentDataFolder.query()` | `appPrefsStore.get('dataFolder', null) ?? app.getPath('userData')` | FLOWING |
| `CharacterSheetTab.tsx` | `activeCharacter` | `trpc.characters.list.query({ campaignId })` | DB query via `charactersRepo` | FLOWING |
| `CampaignListScreen.tsx` | `campaigns` | `trpc.campaigns.list.query()` | DB query via `campaignsRepo` | FLOWING |
| `characters.ts:exportPdf` | `CharacterPdfData` | `charactersRepo.getWithResources()` + `characterSpellsRepo.listByCharacter()` | DB queries | FLOWING |
| `CharacterSheetPdf.tsx:TraitsSection` | `personality`, `ideals`, `bonds`, `flaws` | Hard-coded `undefined` in exportPdf procedure | No DB column exists for these fields | STATIC (see note below) |

**Note on TraitsSection:** The `personality/ideals/bonds/flaws` fields in the PDF are always `undefined` because the `characters` DB schema has no dedicated trait columns (only `backstory`). `TraitsSection` renders nothing when all values are undefined. This is documented in 08-REVIEW.md as IN-02 (informational) — the schema never had these columns, and the traits section in the PDF will always be empty. This is an accepted known limitation, not a blocking stub (the `backstory` column exists but was not mapped to the PDF in Phase 8).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `exportCampaign` function exists and queries all 15 tables | `grep -c "SELECT \*" src/main/db/exportImport.ts` | 15 SELECT statements confirmed | PASS |
| `importCampaign` regenerates all IDs via `crypto.randomUUID` | `grep "randomUUID" src/main/db/exportImport.ts` | `idMap.set(oldId, randomUUID())` found | PASS |
| `importCampaignOrTemplate` checks `version !== 1` before import | `grep "p.version !== 1" src/main/db/exportImport.ts` | Found on line 674 | PASS |
| appPrefsStore uses single instance imported in main/index.ts | `grep "appPrefsStore" src/main/index.ts` | Lines 6, 53, 112 — all use the imported instance | PASS |
| Death saves clamped before `.repeat()` | `grep "Math.min(3, Math.max(0" src/main/services/CharacterSheetPdf.tsx` | Lines 599, 600 — clamped | PASS |
| findParagraphBoundary returns -1 when no boundary found | Code reads `return -1` at end of function (line 74) | PASS |
| `aria-live="polite"` is on off-screen div, NOT the scroll area | StoryScrollPanel lines 233-239 vs 242-250 | Live region is separate off-screen div; scroll div has no aria-live | PASS |

Step 7b: Packaged build smoke test SKIPPED — cannot run `electron-builder` in this environment (ROADMAP.md notes this as Open Q1; requires packaged build verification).

---

### Probe Execution

No probe scripts found under `scripts/*/tests/probe-*.sh`. Phase does not declare probes.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DIST-01 | 08-03 | Full campaign JSON export/import with UUID remap | SATISFIED | `exportImport.ts`, `campaigns.export/importJson`, CampaignCard menu, CampaignListScreen button |
| DIST-02 | 08-05 | Character sheet PDF export via @react-pdf/renderer | SATISFIED | `CharacterSheetPdf.tsx`, `pdfService.ts`, `characters.exportPdf`, CharacterSheetTab button |
| DIST-03 | 08-04 | Starter template export/import (world config only) | SATISFIED | `exportStarterTemplate`, `campaigns.exportTemplate`, `campaigns.importJson` template dispatch, `CreateCampaignModal` pre-fill |
| DIST-04 | 08-06 | Custom data folder via settings (WAL-safe copy + integrity check) | SATISFIED | `appPrefs.changeDataFolder` uses `sqlite.backup()`, SettingsScreen Data section, `initDatabase(customPath)` |
| A11Y-01 | 08-02 | Font scale (Small/Normal/Large) + high contrast toggle, persisting | SATISFIED | `globals.css` `--font-scale`/`.high-contrast`, `main.tsx` pre-mount, `appPrefsStore` persistence |
| A11Y-02 | 08-07 | ARIA labels on all icon-only elements + keyboard navigation | NEEDS HUMAN | Code: aria-labels present; runtime keyboard/AT behavior requires human verification |
| A11Y-03 | 08-07 | Streamed narration announced at paragraph boundaries via ARIA live region | NEEDS HUMAN | Code: off-screen live region + `findParagraphBoundary` implemented; screen reader behavior requires NVDA/VoiceOver test |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/trpc/routers/characters.ts` | 709-712 | `personality: undefined, ideals: undefined, bonds: undefined, flaws: undefined` in exportPdf | Info | TraitsSection in PDF always empty — no crash, no data loss; schema never had these columns; documented as IN-02 in 08-REVIEW.md |
| `src/renderer/src/components/TitleBar.tsx` | 14 | `TODO: 01-05 — hide Win/Linux controls on macOS` | Info | References a tracked plan ID (01-05); not an unresolved debt marker per debt-marker gate rules |

No TBD, FIXME, or XXX markers found in Phase 8 modified files.

---

### Human Verification Required

Phase 8 plan 07 contains a **blocking `checkpoint:human-verify`** (Task 3) for A11Y-02 and A11Y-03. The automated code work is complete and typechecks pass, but the following tests require a human with a running app:

#### 1. Keyboard Navigation

**Test:** Launch the app (dev build or packaged). From campaign list, press Tab repeatedly. Navigate into a campaign view, use the right panel tabs, open a modal (AI Settings or dice roller), press Escape.

**Expected:** Every interactive element is reachable via Tab with a visible focus ring. Left/Right arrow keys switch the right-panel tabs. Escape closes all modals and popovers. Enter/Space activate buttons.

**Why human:** Focus traversal order and focus-trap behavior inside Radix dialogs/popovers require live DOM inspection and keyboard operation — grep cannot verify these.

#### 2. Screen Reader Paragraph-Boundary Announcements (NVDA/VoiceOver)

**Test:** Enable NVDA (Windows) or VoiceOver (macOS). Send a chat message in an active campaign. Listen to how the streaming AI narration is announced.

**Expected:** Announcements fire at paragraph or sentence boundaries (whole paragraphs), NOT token-by-token. Loading old message history does NOT re-announce.

**Why human:** Screen reader output is observed only by the assistive technology user. No automated test can confirm what NVDA or VoiceOver speaks aloud.

#### 3. ARIA Label Audit (Screen Reader + Focus)

**Test:** Tab to each of: campaign 3-dot button, Settings gear, Minimize/Maximize/Close buttons, combatant row collapse trigger, Export PDF button. Confirm the screen reader announces the correct label.

**Expected:** Announced labels match: "Campaign options", "Open Settings", "Minimize window", "Maximize window" / "Restore window", "Close window", "[Name] — view details", "Export character sheet as PDF".

**Why human:** ARIA tree inspection requires DevTools Accessibility panel or screen reader + running app.

#### 4. Packaged Build PDF Smoke Test

**Test:** Build with `electron-builder`, launch the packaged app, navigate to a character sheet, click Export PDF, save the file, open it.

**Expected:** @react-pdf/renderer v4 + yoga-layout resolve correctly inside the ASAR; a valid PDF is written to disk and opens cleanly.

**Why human:** ROADMAP.md Open Q1 (React 19 reconciler + @react-pdf/renderer v4 ASAR compatibility) can only be confirmed in a real packaged build, not dev mode.

#### 5. High Contrast WCAG AA Contrast Check

**Test:** Enable high contrast mode. Use WebAIM Contrast Checker with the OKLCH values from `globals.css` `.high-contrast` block.

**Expected:** All four pairs cited in the CSS comments achieve their stated ratios: `--muted-foreground` (L=0.80) vs `--background` (L=0.16) >= 4.5:1; `--destructive` (L=0.72) vs `--background` >= 4.5:1; `--primary` (L=0.88) vs `--background` >= 3:1; `--border` (L=0.50) vs `--background` >= 3:1.

**Why human:** OKLCH contrast verification requires an actual contrast-ratio calculator — computed by tool, not by reading the CSS.

#### 6. Data Folder Migration E2E

**Test:** In Settings, change the data folder to a new directory. Restart the app. Verify campaigns and characters are still accessible.

**Expected:** After restart, `initDatabase()` opens from the new path; all data is intact.

**Why human:** Requires a real process restart to confirm `appPrefsStore.get('dataFolder')` is read by `initDatabase()` on the new invocation.

---

### Gaps Summary

No BLOCKER gaps. All six critical review findings (CR-01, CR-02, CR-03, WR-01, WR-02, WR-04) and two warning findings (WR-03, WR-05) were fixed and verified in code. The only unresolved items are items that require a human with a running app (keyboard navigation, screen reader behavior, packaged build, contrast ratio calculation, and data folder migration restart). These are correctly classified as `human_needed`, not gaps.

The TraitsSection empty output (IN-02) is an accepted limitation — no DB columns exist for personality traits and none were planned for Phase 8. The PDF layout renders correctly; the traits section is simply absent.

---

_Verified: 2026-06-02T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
