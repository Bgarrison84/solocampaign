---
phase: 08-polish-export-accessibility
plan: "03"
subsystem: export-import
tags: [export, import, campaign-portability, uuid-remap, tRPC, shadcn, dropdown-menu, DIST-01, DIST-03]
dependency_graph:
  requires: ["08-01"]
  provides:
    - exportCampaign(campaignId) — serializes all 15 tables to versioned JSON payload
    - importCampaign(payload) — UUID-remapped FK-ordered transactional INSERT
    - importCampaignOrTemplate(parsed) — version/type dispatcher
    - campaigns.export tRPC mutation (OS save dialog)
    - campaigns.importJson tRPC mutation (OS open dialog + 50MB guard)
    - dropdown-menu.tsx shadcn component
    - CampaignCard 3-dot menu (Export JSON + Delete)
    - CampaignListScreen Import button
  affects:
    - src/main/db/exportImport.ts (new)
    - src/main/db/exportImport.test.ts (new)
    - src/main/trpc/routers/campaigns.ts (export + importJson added)
    - src/renderer/src/components/ui/dropdown-menu.tsx (new)
    - src/renderer/src/components/CampaignCard.tsx (3-dot menu)
    - src/renderer/src/screens/CampaignListScreen.tsx (Import button)
    - package.json / package-lock.json (@radix-ui/react-dropdown-menu added)
tech_stack:
  added:
    - "@radix-ui/react-dropdown-menu": manually installed + shadcn component scaffolded
  patterns:
    - crypto.randomUUID() for all id generation (no uuid library needed)
    - sqlite.transaction() for all-or-nothing import
    - IdMap<old, new> remap() helper for FK consistency
    - DropdownMenu + e.stopPropagation() on trigger (Pitfall 6)
    - 'kind' in result discriminant for TypeScript union narrowing
key_files:
  created:
    - src/main/db/exportImport.ts
    - src/main/db/exportImport.test.ts
    - src/renderer/src/components/ui/dropdown-menu.tsx
  modified:
    - src/main/trpc/routers/campaigns.ts
    - src/renderer/src/components/CampaignCard.tsx
    - src/renderer/src/screens/CampaignListScreen.tsx
    - package.json
    - package-lock.json
decisions:
  - "shadcn CLI failed with ERESOLVE (tRPC v10 + React Query v5 peer dep conflict); @radix-ui/react-dropdown-menu installed manually with --legacy-peer-deps and dropdown-menu.tsx scaffolded by hand following existing shadcn component style"
  - "Test assertion for UUID remap corrected: original rows remain in DB post-import; test now queries messages by newCampaignId rather than asserting no old-id rows exist globally"
  - "CampaignListScreen importJson onSuccess uses 'kind' in result discriminant rather than result.canceled to avoid TS2339 on union type narrowing"
  - "TDD RED/GREEN pattern used for Task 1: failing test committed first (7fa022c), implementation committed second (7a3a584)"
metrics:
  duration: "~35min"
  completed_date: "2026-06-02"
---

# Phase 8 Plan 03: Campaign JSON Export / Import Summary

Full campaign export/import with UUID remapping, FK-ordered transactional insert, version/type dispatcher, OS dialogs, shadcn DropdownMenu, 3-dot card menu, and Import Campaign button — DIST-01 complete, DIST-03 groundwork in place.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | exportImport tests (failing) | 7fa022c | exportImport.test.ts |
| 1 (GREEN) | exportImport.ts — export/import/dispatcher | 7a3a584 | exportImport.ts, exportImport.test.ts |
| 1 (fix) | Correct UUID remap test assertion | 445a614 | exportImport.test.ts |
| 2 | campaigns.export + importJson tRPC procedures | 1c409ac | campaigns.ts |
| 3 | DropdownMenu + CampaignCard 3-dot + Import button | 15caebe | dropdown-menu.tsx, CampaignCard.tsx, CampaignListScreen.tsx, package.json |

## Verification

- `npm run test -- --run exportImport`: 6/6 tests pass
- `npm run typecheck`: exits 0 (all tasks)
- `npm run compile:app` (build): exits 0
- Full test suite: 384 passing (net +126 vs baseline 258), 1 pre-existing failure in charactersRepo.levelUp.test.ts (unrelated)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Incorrect test assertion for UUID remap check**
- **Found during:** Task 1 GREEN verification
- **Issue:** Test asserted `all messages in DB` should not have old campaign_id. But original messages remain in the DB post-import (correct behavior — import is additive). This caused the assertion to fail.
- **Fix:** Changed assertion to query only messages belonging to `newCampaignId` and verify they use the new id.
- **Files modified:** src/main/db/exportImport.test.ts
- **Commit:** 445a614

**2. [Rule 3 - Blocking] shadcn CLI failed with ERESOLVE peer dep conflict**
- **Found during:** Task 3 (installing DropdownMenu)
- **Issue:** `npx shadcn@latest add dropdown-menu --yes` failed with `npm error ERESOLVE could not resolve` due to tRPC v10 + React Query v5 peer dependency conflict (pre-existing project constraint).
- **Fix:** Installed `@radix-ui/react-dropdown-menu` directly with `--legacy-peer-deps`, then manually scaffolded `dropdown-menu.tsx` following the same Radix + cn() pattern as other shadcn components in the project.
- **Files modified:** src/renderer/src/components/ui/dropdown-menu.tsx (created manually), package.json, package-lock.json
- **Commit:** 15caebe

**3. [Rule 1 - Bug] TypeScript union narrowing error on importJson result**
- **Found during:** Task 3 typecheck
- **Issue:** `result.kind` caused TS2339 because the `{ canceled: true }` branch of the `importJson` return union doesn't have `kind`. TypeScript couldn't narrow past `canceled` as a `boolean`.
- **Fix:** Used `'kind' in result` discriminant guard instead of `result.canceled` check.
- **Files modified:** src/renderer/src/screens/CampaignListScreen.tsx
- **Commit:** 15caebe (included in same fix)

## Known Stubs

- `CampaignCard.tsx`: Comment `{/* 08-04: Export as Starter Template item */}` marks where the template export menu item will be added by plan 08-04.
- `CampaignListScreen.tsx`: In importMutation onSuccess, template branch `setModalOpen(true)` is a minimal stub — 08-04 wires the `initialTemplate` prop to pre-fill the wizard.

Both stubs are intentional and do not prevent the plan's goal (DIST-01 campaign export/import) from working.

## TDD Gate Compliance

- RED gate commit: 7fa022c (test(08-03): add failing tests...)
- GREEN gate commit: 7a3a584 (feat(08-03): exportImport.ts...)
- Fix commit: 445a614 (fix(08-03): correct test assertion...)

## Threat Surface Scan

All threat mitigations from the plan's `<threat_model>` are implemented:
- T-08-06 (Tampering via import): version === 1 check in importCampaignOrTemplate before any DB write; sqlite.transaction rolls back on constraint failure
- T-08-07 (API key leakage in export): No api_key column in campaigns table — confirmed by schema.ts audit
- T-08-08 (DoS via oversized file): 50MB guard before readFile in importJson procedure
- T-08-09 (Path traversal): Paths from OS dialog only (showSaveDialog/showOpenDialog); no renderer-supplied paths
- T-08-10 (Spoofing via malicious import): crypto.randomUUID() for all entity ids; FK remapping prevents collision with existing data
- T-08-SC (Radix dropdown package): Installed from npm registry following same pattern as 10 other @radix-ui packages already in project

No new threat surface introduced beyond the documented mitigations.

## Self-Check: PASSED

Files exist:
- src/main/db/exportImport.ts: FOUND
- src/main/db/exportImport.test.ts: FOUND
- src/renderer/src/components/ui/dropdown-menu.tsx: FOUND
- src/main/trpc/routers/campaigns.ts: FOUND (modified)
- src/renderer/src/components/CampaignCard.tsx: FOUND (modified)
- src/renderer/src/screens/CampaignListScreen.tsx: FOUND (modified)

Commits exist:
- 7fa022c: FOUND (test RED)
- 7a3a584: FOUND (feat GREEN)
- 445a614: FOUND (fix test assertion)
- 1c409ac: FOUND (feat campaigns tRPC)
- 15caebe: FOUND (feat Task 3 UI)
