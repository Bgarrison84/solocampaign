---
phase: 08-polish-export-accessibility
fixed_at: 2026-06-02T00:00:00Z
review_path: .planning/phases/08-polish-export-accessibility/08-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-06-02T00:00:00Z
**Source review:** .planning/phases/08-polish-export-accessibility/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Dual electron-store instances — tRPC writes invisible to appPrefs:getInitial IPC bridge

**Files modified:** `src/main/index.ts`
**Commit:** 87cde15
**Applied fix:** Added `import { appPrefsStore } from './trpc/routers/appPrefs'` at the top of `index.ts`. Removed the local `const appPrefs = new Store<...>({ name: 'appPrefs', ... })` declaration (lines 35-41). Updated `appPrefs.get('dataFolder', null)` to `appPrefsStore.get('dataFolder', null)` and `appPrefs.store` to `appPrefsStore.store` in the `ipcMain.handle('appPrefs:getInitial', ...)` handler. The `Store` import was retained because `boundsStore` still uses it.

### CR-02: `ADD COLUMN IF NOT EXISTS` invalid SQLite syntax in migration 0008

**Files modified:** `resources/migrations/0008_fix_missing_phase7_columns.sql`
**Commit:** 255ea6e
**Applied fix:** Removed `IF NOT EXISTS` from all nine `ALTER TABLE ... ADD COLUMN` statements. The migration journal guarantees single application; `repairMissingColumns()` handles schema drift.

### CR-03: Death save dot formula crashes react-pdf when value > 3

**Files modified:** `src/main/services/CharacterSheetPdf.tsx`
**Commit:** e20466e
**Applied fix:** Introduced `const successes = Math.min(3, Math.max(0, data.deathSaveSuccesses))` and `const failures = Math.min(3, Math.max(0, data.deathSaveFailures))` at the top of `DeathSavesSection`. Updated both dot-string expressions to use the clamped variables so `.repeat()` never receives a negative count.

### WR-01: Prompt injection via `campaign.name` in `generateWorldBrief`

**Files modified:** `src/main/trpc/routers/campaigns.ts`
**Commit:** 7cdf42e
**Applied fix:** Added `const safeName = campaign.name.replace(/["\\\n]/g, ' ')` before the prompt string. Changed the campaign name embedding from `"${campaign.name}"` to `"""${safeName}"""` (triple-quote delimiters). Added inline comment referencing WR-01.

### WR-02: No Zod validation on imported JSON before DB insert

**Files modified:** `src/main/db/exportImport.ts`
**Commit:** d93eed2
**Applied fix:** Added `import { z } from 'zod'` to the imports. In `importCampaignOrTemplate`, before the `importCampaign` call, added a `campaignExportDataSchema` with `z.object()` covering all 15 tables. The campaign object validates the five high-risk text fields (`rolling_summary`, `world_document`, `homebrew_content`, `world_brief`, `dm_personality`) with `.string().max(200_000).optional().nullable()` and uses `.passthrough()` for remaining columns. All array fields use `z.array(z.record(z.unknown()))`. On validation failure a `TRPCError` with code `BAD_REQUEST` is thrown before any DB write.

### WR-03: `importHomebrewTextWithDialog` declares a `campaignId` input it never uses

**Files modified:** `src/main/trpc/routers/campaigns.ts`, `src/renderer/src/components/AiSettingsModal.tsx`
**Commit:** e459246
**Applied fix:** Removed `.input(z.object({ campaignId: campaignIdSchema }))` from the `importHomebrewTextWithDialog` tRPC procedure (the handler already ignored it). Updated the single call site in `AiSettingsModal.tsx` from `.mutate({ campaignId })` to `.mutate()`.

### WR-04: ARIA live region refs not reset on campaignId change

**Files modified:** `src/renderer/src/components/StoryScrollPanel.tsx`
**Commit:** 849b5c3
**Applied fix:** Added a `useEffect` with `[campaignId]` dependency immediately after the ref declarations that resets `paragraphBufferRef.current`, `lastProcessedLenRef.current`, and `isUserScrolledUpRef.current` to their initial values. Added explanatory comment.

### WR-05: `navigator.platform` deprecated

**Files modified:** `src/renderer/src/components/TitleBar.tsx`
**Commit:** 3e3eb0e
**Applied fix:** Replaced `const isMac = navigator.platform.startsWith('Mac')` with `const isMac = (window.platform as string) === 'darwin'`. Updated the comment to explain the contextBridge-exposed value. The preload already exposes `process.platform` as `window.platform`.

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-06-02T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
