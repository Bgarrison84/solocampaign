---
phase: 07-content-depth-advanced-character
plan: "10"
subsystem: homebrew-rules-import
tags: [homebrew, rules-import, reference-docs, ai-settings, trpc]
dependency_graph:
  requires: ["07-03"]
  provides:
    - AiSettingsModal-homebrew-tab
    - campaignDocs-importWithDialog
    - campaigns-updateHomebrew
    - campaigns-importHomebrewTextWithDialog
    - ReferenceDocSelect-campaignId-prop
    - readReferenceDocsForCampaign
  affects:
    - AiSettingsModal.tsx (Tabs wrapper + Homebrew tab)
    - ReferenceDocSelect.tsx (campaignId prop + imported-doc merge)
    - referenceDocLoader.ts (readReferenceDocsForCampaign)
    - contextBuilder.ts (switched to readReferenceDocsForCampaign)
    - campaignsRepo.ts (updateHomebrew)
    - campaigns.ts (updateHomebrew + importHomebrewTextWithDialog mutations)
    - campaignDocs.ts (importWithDialog mutation)
tech_stack:
  added: []
  patterns:
    - OS file dialog in main process (mirrors imageService/importCoverImage pattern)
    - Mixed-array reference_docs identifiers (bundled relative paths OR UUID strings)
    - UUID detection regex for partitioning identifier arrays
    - Tabs component wrapping existing modal content (shadcn Tabs)
key_files:
  created: []
  modified:
    - src/renderer/src/components/AiSettingsModal.tsx
    - src/renderer/src/components/ReferenceDocSelect.tsx
    - src/main/ai/referenceDocLoader.ts
    - src/main/ai/referenceDocLoader.test.ts
    - src/main/ai/contextBuilder.ts
    - src/main/ai/contextBuilder.test.ts
    - src/main/db/campaignsRepo.ts
    - src/main/trpc/routers/campaigns.ts
    - src/main/trpc/routers/campaignDocs.ts
decisions:
  - "File dialog opened in main process via tRPC mutations (importHomebrewTextWithDialog / importWithDialog) — renderer never supplies file paths directly"
  - "UUID detection via /^[0-9a-f]{8}-...-[0-9a-f]{12}$/i regex in readReferenceDocsForCampaign"
  - "homebrew_content appended last in readReferenceDocsForCampaign (after bundled + imported docs)"
  - "ReferenceDocSelect accepts optional campaignId; when absent, behaves exactly as before (backwards compat)"
  - "contextBuilder calls readReferenceDocsForCampaign instead of readReferenceDocs to get homebrew + imported docs in AI context"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-31"
  tasks_completed: 2
  files_changed: 9
---

# Phase 7 Plan 10: Homebrew Tab + Rules Import + Merged Reference-Doc Selection Summary

**One-liner:** Homebrew tab added to AiSettingsModal (textarea + word count + file import), imported rules documents managed per campaign, ReferenceDocSelect extended to merge bundled + imported docs with user badge, and referenceDocLoader extended so homebrew + imported docs reach the AI via the existing reference-doc context slot.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Homebrew tab in AiSettingsModal + imported docs list | 0f6f1b7 | AiSettingsModal.tsx, campaignsRepo.ts, campaigns.ts, campaignDocs.ts |
| 2 | Merge imported docs into ReferenceDocSelect + extend referenceDocLoader | d29c417 | ReferenceDocSelect.tsx, referenceDocLoader.ts, contextBuilder.ts + tests |
| — | Checkpoint: human-verify (auto-approved) | — | — |

## What Was Built

### AiSettingsModal.tsx — Homebrew tab

The existing modal content is now wrapped in a `Tabs` component with two triggers: "AI Settings" (original content, unchanged) and "Homebrew" (new tab).

**Homebrew tab layout:**
- "Homebrew Content" label + subtitle "Custom races, classes, spells, and rules available to the AI DM."
- `Textarea rows={12}` bound to `homebrewContent` state (pre-filled from `campaign.homebrewContent`)
- Word count display: "N words" below the textarea
- "Import file…" button (`.txt`, `.md`) — calls `campaigns.importHomebrewTextWithDialog` tRPC mutation which opens the OS dialog in the main process and returns the file text; appended to the textarea with blank-line separator
- "Save Homebrew" button — calls `campaigns.updateHomebrew` tRPC mutation
- Separator
- "Imported Rules Documents" section: `campaignDocs.list` rows with × remove button (`campaignDocs.delete`), "Import PDF or text file…" button (`campaignDocs.importWithDialog`), inline "Importing…" spinner, error copy "Could not read that file. Try a different PDF or use a text file instead.", empty state "No imported documents."

### New tRPC procedures

**`campaigns.updateHomebrew`:** Persists `homebrew_content` for a campaign. Enforced via `campaignsRepo.updateHomebrew()` which caps at 50,000 chars (T-07-10-02 DoS mitigation).

**`campaigns.importHomebrewTextWithDialog`:** Opens Electron `dialog.showOpenDialog` in the main process for `.txt`/`.md` files; reads via `readTextFile`; caps at 50,000 chars; returns text (or null if cancelled).

**`campaignDocs.importWithDialog`:** Opens Electron `dialog.showOpenDialog` in the main process for `.pdf`/`.txt`/`.md` files; extracts/reads content; caps at 50,000 chars via `campaignReferenceDocsRepo.create()`; returns the created `CampaignReferenceDoc` row.

### ReferenceDocSelect.tsx — campaignId prop + imported-doc merge

Added optional `campaignId?: string` prop. When provided:
- Second query `trpc.campaignDocs.list({ campaignId })` (30s stale time)
- Bundled docs + imported docs merged into a unified `DocEntry[]` array
- Imported rows show a `User` icon badge (with "Imported document" tooltip)
- Bundled large-doc `AlertTriangle` icon still shown for bundled docs only
- Selection (`onChange(string[])`) stores bundled relative paths OR `campaign_reference_docs.id` UUIDs in the same array (mixed-array approach per D-38 / Open Question 3)

When `campaignId` is absent, component behaves exactly as before (backwards compatible).

### referenceDocLoader.ts — readReferenceDocsForCampaign

New exported function `readReferenceDocsForCampaign(campaignId, identifiers)`:

1. **UUID partition:** identifiers matching `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` are treated as `campaign_reference_docs.id` UUIDs; the rest are bundled relative paths.
2. **Bundled docs:** loaded via existing `readReferenceDocs()` (path-traversal guard unchanged).
3. **Imported docs:** `campaignReferenceDocsRepo.list(campaignId)` fetched once; UUID identifiers resolved against the result by `Map` lookup.
4. **Homebrew:** `campaignsRepo.get(campaignId).homebrewContent` appended as `{ title: 'Homebrew Rules', content }` when non-empty.

### contextBuilder.ts — wired to readReferenceDocsForCampaign

`buildContext` now calls `readReferenceDocsForCampaign(campaignId, referenceDocs)` instead of `readReferenceDocs(referenceDocs)`. Homebrew content and imported docs are injected into the existing `referenceDocBlock` slot — at lower priority than the World Overview block, consistent with D-37.

### Test coverage

`referenceDocLoader.test.ts` extended with 5 new tests in a `readReferenceDocsForCampaign` suite:
- UUID resolved to campaign_reference_docs content
- Missing UUID skipped
- Homebrew appended when non-empty
- No homebrew appended when empty
- Mixed bundled + UUID identifiers both resolved

`contextBuilder.test.ts` updated to mock `readReferenceDocsForCampaign` (the renamed import). All 42 contextBuilder tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] contextBuilder.test.ts mock missing new export**
- **Found during:** Task 2 test run
- **Issue:** `contextBuilder.test.ts` mocked `readReferenceDocs` but after the switch to `readReferenceDocsForCampaign`, vitest reported "No readReferenceDocsForCampaign export is defined on the mock", causing 25 test failures.
- **Fix:** Added `readReferenceDocsForCampaign: vi.fn().mockReturnValue([])` to the mock; updated all `vi.mocked(readReferenceDocs)` calls to `vi.mocked(readReferenceDocsForCampaign)`; updated `toHaveBeenCalledWith` assertion to include the campaignId parameter.
- **Files modified:** `src/main/ai/contextBuilder.test.ts`
- **Commit:** d29c417

## Known Stubs

None. All features are fully implemented and wired:
- `updateHomebrew` tRPC mutation persists to DB
- `importWithDialog` opens real OS dialog in main process
- `readReferenceDocsForCampaign` queries live DB (campaignReferenceDocsRepo + campaignsRepo)
- ReferenceDocSelect merges real bundled + imported docs

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: DoS-mitigated | campaigns.ts | importHomebrewTextWithDialog caps at 50,000 chars (T-07-10-02) |
| threat_flag: DoS-mitigated | campaignDocs.ts | importWithDialog delegates to campaignReferenceDocsRepo which caps at 50,000 chars (T-07-10-02) |
| threat_flag: DoS-mitigated | campaignsRepo.ts | updateHomebrew caps at 50,000 chars before storage (T-07-10-02) |
| threat_flag: path-traversal-not-applicable | campaigns.ts / campaignDocs.ts | Dialog-provided paths are absolute OS paths; no user-supplied path reaches file read APIs |
| threat_flag: prompt-injection-mitigated | referenceDocLoader.ts | Homebrew/imported content injected as literal reference text, not instructions (T-07-10-03) |

## Self-Check: PASSED

Files confirmed to exist:
- src/renderer/src/components/AiSettingsModal.tsx — FOUND (contains Tabs, TabsContent, Homebrew, homebrewContent, importWithDialog)
- src/renderer/src/components/ReferenceDocSelect.tsx — FOUND (contains campaignId, importedDocs, source: 'imported', User badge)
- src/main/ai/referenceDocLoader.ts — FOUND (contains readReferenceDocsForCampaign, UUID_REGEX, Homebrew Rules)
- src/main/ai/referenceDocLoader.test.ts — FOUND (contains readReferenceDocsForCampaign, UUID resolution tests)
- src/main/ai/contextBuilder.ts — FOUND (contains readReferenceDocsForCampaign import)
- src/main/db/campaignsRepo.ts — FOUND (contains updateHomebrew)
- src/main/trpc/routers/campaigns.ts — FOUND (contains updateHomebrew, importHomebrewTextWithDialog)
- src/main/trpc/routers/campaignDocs.ts — FOUND (contains importWithDialog)

Commits confirmed to exist:
- 0f6f1b7 — FOUND (feat(07-10): Homebrew tab in AiSettingsModal + imported docs list)
- d29c417 — FOUND (feat(07-10): merge imported docs into ReferenceDocSelect + extend referenceDocLoader)

Test results: referenceDocLoader.test.ts 16/16 passing, contextBuilder.test.ts 42/42 passing, tsc clean
