---
phase: 02-character-domain-live-sheet
plan: "07"
subsystem: campaign-cover-image-ui
tags: [cover-image, campaign-card, trpc, tanstack-query, react, ui]
dependency_graph:
  requires: [02-04, 02-06]
  provides: [CampaignCard-cover-image, CampaignViewScreen-change-cover-button, WORLD-02-complete]
  affects: []
tech_stack:
  added: []
  patterns:
    - "div[role=button] outer wrapper avoids nested <button> violation when inner clickable cover area is a <button>"
    - "useQuery for getCoverDataUrl keyed [campaigns, getCoverDataUrl, campaign.id] — conditional img vs gradient placeholder branch"
    - "useMutation for importCoverImage with dual invalidation: getCoverDataUrl key + campaigns.list"
    - "e.stopPropagation() on cover click prevents navigate-to-campaign from firing on card body click"
    - "Loader2 animate-spin spinner overlay on cover area during import pending state"
    - "ml-auto trailing action slot in TabsList for [Change Cover Image] button"
key_files:
  created: []
  modified:
    - src/renderer/src/components/CampaignCard.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
decisions:
  - "CampaignCard outer element changed from <button> to <div role='button'> with tabIndex=0 to allow inner cover <button> without nesting violation"
  - "[Change Cover Image] button placed as ml-auto trailing action inside TabsList (option 1 from plan) — avoids a separate header bar and keeps layout minimal"
  - "Error message rendered inline as text-destructive below card body (not a toast) — simpler implementation, same user feedback quality"
metrics:
  duration: "12 minutes"
  completed_date: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 02 Plan 07: Campaign Cover Image UI — Summary

**One-liner:** CampaignCard and CampaignViewScreen both wire cover image display and import via `campaigns.importCoverImage` mutation — WORLD-02 delivered end-to-end.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire cover image display + import trigger into CampaignCard | fdf4875 | CampaignCard.tsx |
| 2 | Add [Change Cover Image] button to campaign view header | d437c94 | CampaignViewScreen.tsx |

## Verification Results

- `npm run typecheck` — exits 0 (both tasks)
- `npm test` — 69/100 pass, 31 fail (pre-existing ABI mismatch — better-sqlite3 compiled for Electron ABI 145, system Node.js ABI 137; same count as 02-06 — no regressions)

### Acceptance Criteria Check — Task 1 (CampaignCard)

- Imports `useMutation`, `useQuery`, `useQueryClient` from '@tanstack/react-query' — CONFIRMED
- Contains `trpc.campaigns.getCoverDataUrl.query` (via useQuery queryFn) — CONFIRMED
- Contains `trpc.campaigns.importCoverImage.mutate` (via useMutation mutationFn) — CONFIRMED
- Contains `e.stopPropagation()` on the cover click handler — CONFIRMED
- Contains `'Add cover image'` literal (title on gradient placeholder button) — CONFIRMED
- Contains `'Change cover image'` literal (text on hover overlay button) — CONFIRMED
- Contains `'Could not import image. Please try a different file.'` error string — CONFIRMED
- No longer references `/placeholder-cover.svg` — CONFIRMED
- Outer wrapper is `<div role="button">` not a `<button>` — CONFIRMED (no nested button violation)

### Acceptance Criteria Check — Task 2 (CampaignViewScreen)

- Contains `trpc.campaigns.importCoverImage` — CONFIRMED
- Contains `"Change Cover Image"` literal string — CONFIRMED
- Imports `Camera` from 'lucide-react' — CONFIRMED
- Imports `Button` from '../components/ui/button' — CONFIRMED
- Invalidates `['campaigns', 'getCoverDataUrl', id]` on cover import success — CONFIRMED
- `npm run typecheck` exits 0 — CONFIRMED
- `npm test` exits same failure count as prior plan (no regressions) — CONFIRMED

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Cover image display is fully wired to real tRPC queries. Gradient placeholder is the correct designed empty state (not a stub) — it renders when `getCoverDataUrl` returns null, which is the expected state before any cover is imported.

## Threat Flags

None. All cover import calls go through the existing `importCoverImage` tRPC procedure (Plan 04) which uses the OS file picker — renderer never supplies a path directly. T-02-17 inherited mitigation intact.

## Self-Check: PASSED

Files exist:
- src/renderer/src/components/CampaignCard.tsx — FOUND (modified)
- src/renderer/src/screens/CampaignViewScreen.tsx — FOUND (modified)

Commits exist:
- fdf4875 — FOUND (feat(02-07): wire cover image display + import trigger into CampaignCard)
- d437c94 — FOUND (feat(02-07): add [Change Cover Image] button to campaign view header)

Typecheck: exits 0
Test suite: 69/100 pass (31 fail — pre-existing ABI mismatch, same count as all prior plans)
