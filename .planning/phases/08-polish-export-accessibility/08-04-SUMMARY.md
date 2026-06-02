---
phase: 08-polish-export-accessibility
plan: "04"
subsystem: starter-templates
tags: [export, import, starter-template, DIST-03, tRPC, CreateCampaignModal, CampaignCard, CampaignListScreen, alert]
dependency_graph:
  requires: ["08-03"]
  provides:
    - exportStarterTemplate(campaignId) — world-config-only StarterTemplatePayload (D-15 fields)
    - campaigns.exportTemplate tRPC mutation (OS save dialog, -template.json)
    - CreateCampaignModal initialTemplate prop + pre-fill useEffect + Alert banner
    - CampaignCard "Export as Starter Template" menu item wired
    - CampaignListScreen template-import branch completing 08-03 stub
  affects:
    - src/main/db/exportImport.ts (exportStarterTemplate added)
    - src/main/trpc/routers/campaigns.ts (exportTemplate mutation added)
    - src/renderer/src/components/CreateCampaignModal.tsx (initialTemplate prop, pre-fill, banner, homebrewContent state)
    - src/renderer/src/components/CampaignCard.tsx (exportTemplateMutation wired)
    - src/renderer/src/screens/CampaignListScreen.tsx (importedTemplate state, template branch completed)
    - src/renderer/src/components/ui/alert.tsx (new shadcn Alert component)
tech_stack:
  added:
    - alert.tsx (shadcn Alert component — manually scaffolded, no new npm packages)
  patterns:
    - Renderer-side StarterTemplate interface mirrors main-process type (avoids cross-boundary type import)
    - useEffect keyed on [open, initialTemplate] for template pre-fill (runs after reset effect)
    - homebrewContent state in CreateCampaignModal + updateHomebrew call in handleSubmit (D-19)
    - importedTemplate cleared in closeModal so blank wizard on next "New Campaign" click
key_files:
  created:
    - src/renderer/src/components/ui/alert.tsx
  modified:
    - src/main/db/exportImport.ts
    - src/main/trpc/routers/campaigns.ts
    - src/renderer/src/components/CreateCampaignModal.tsx
    - src/renderer/src/components/CampaignCard.tsx
    - src/renderer/src/screens/CampaignListScreen.tsx
decisions:
  - "Defined StarterTemplate interface in CreateCampaignModal.tsx (renderer-side) rather than importing from main process — avoids cross-boundary type coupling; interface matches D-15 shape exactly"
  - "Added homebrewContent state to CreateCampaignModal and updateHomebrew call in handleSubmit to persist D-19 homebrew text from template; wizard has no homebrew step so content is applied silently post-create"
  - "alert.tsx scaffolded manually following existing shadcn pattern (cva + cn) — no new npm packages; same approach as dropdown-menu.tsx in 08-03"
  - "compile:app (electron-vite build) used for build verification instead of electron-builder — electron-builder fails in worktree due to missing electron binary (pre-existing constraint; same as prior 08-xx plans)"
metrics:
  duration: "~25min"
  completed_date: "2026-06-02"
---

# Phase 8 Plan 04: Starter Templates (DIST-03) Summary

Starter template export/import end-to-end: exportStarterTemplate returns world-config-only JSON (9 D-15 fields, no save state), campaigns.exportTemplate writes it via OS save dialog, CampaignCard menu item triggers it, and importing a -template.json opens the Create Campaign wizard pre-filled with all D-15 fields plus a pre-fill banner — completing DIST-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | exportStarterTemplate + campaigns.exportTemplate | b791fab | exportImport.ts, campaigns.ts |
| 2 | CreateCampaignModal initialTemplate pre-fill + banner | 222c0a4 | CreateCampaignModal.tsx, alert.tsx |
| 3 | Wire Export Template menu item + template-import branch | 2c28f15 | CampaignCard.tsx, CampaignListScreen.tsx |

## Verification

- `npm run typecheck`: exits 0 (all tasks)
- `npm run compile:app` (electron-vite build): exits 0 (Task 3)
- `npm run test -- --run exportImport`: dispatcher tests (Tests 5-6) pass; DB tests (Tests 1-4) skip due to pre-existing Node.js ABI mismatch in worktree (better-sqlite3 compiled for Electron ABI 145, test runner uses Node ABI 137 — same constraint as 08-03)
- Manual (required post-merge): export a template from campaign card; import it; confirm wizard opens pre-filled with name/world/DM personality/strictness/party size/encumbrance/homebrew; banner visible; AI key blank

## Deviations from Plan

### Auto-added Missing Functionality

**1. [Rule 2 - Missing] homebrewContent state + updateHomebrew call in handleSubmit**
- **Found during:** Task 2 implementation
- **Issue:** The plan's acceptance criteria lists `setHomebrewContent` as a required pre-fill setter, but CreateCampaignModal had no homebrewContent state and the submit handler had no call to persist it. Without this, D-19 (homebrew travels with template) would be silently dropped at campaign creation.
- **Fix:** Added `homebrewContent` state, reset it in the reset effect, pre-filled it from `initialTemplate.homebrewContent` in the template effect, and added `updateHomebrewMutation` + conditional call in `handleSubmit` after AI config is persisted.
- **Files modified:** src/renderer/src/components/CreateCampaignModal.tsx
- **Commit:** 222c0a4

**2. [Rule 2 - Missing] alert.tsx shadcn component**
- **Found during:** Task 2 (Alert import needed for pre-fill banner)
- **Issue:** alert.tsx does not exist in the UI components directory; the plan references it without noting it needs to be created.
- **Fix:** Scaffolded alert.tsx manually following existing shadcn component pattern (cva + cn + forwardRef), same approach used for dropdown-menu.tsx in 08-03. No new npm packages needed.
- **Files modified:** src/renderer/src/components/ui/alert.tsx (created)
- **Commit:** 222c0a4

## Known Stubs

None — all acceptance criteria are wired end to end.

## Threat Surface Scan

All threat mitigations from the plan's `<threat_model>` are implemented:
- T-08-11 (template fields injected into wizard): Template import performs NO DB write (D-16); fields land in editable React state (confirmed: all setters fire, wizard stays fully editable)
- T-08-12 (template export leaking save state): exportStarterTemplate SELECTs only the 9 D-15 columns — no characters/sessions/messages (confirmed: raw SQL uses explicit column list, not SELECT *)
- T-08-13 (exportTemplate file path): Path from OS showSaveDialog only; campaignId validated as UUID by campaignIdSchema
- T-08-SC (no new packages): alert.tsx created from existing @radix-ui primitives already in project; no npm install

No new threat surface introduced beyond the documented mitigations.

## Self-Check: PASSED

Files exist:
- src/main/db/exportImport.ts (modified — exportStarterTemplate): FOUND
- src/main/trpc/routers/campaigns.ts (modified — exportTemplate): FOUND
- src/renderer/src/components/CreateCampaignModal.tsx (modified — initialTemplate): FOUND
- src/renderer/src/components/CampaignCard.tsx (modified — exportTemplateMutation): FOUND
- src/renderer/src/screens/CampaignListScreen.tsx (modified — template branch): FOUND
- src/renderer/src/components/ui/alert.tsx (created): FOUND

Commits exist:
- b791fab: FOUND (feat Task 1)
- 222c0a4: FOUND (feat Task 2)
- 2c28f15: FOUND (feat Task 3)
