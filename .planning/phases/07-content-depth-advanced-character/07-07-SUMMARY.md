---
phase: 07-content-depth-advanced-character
plan: "07"
subsystem: campaign-creation-wizard
tags: [wizard, ui, party-size, encumbrance, world-setup, trpc]
dependency_graph:
  requires: ["07-01", "07-03", "07-04"]
  provides:
    - CreateCampaignModal-4-step-wizard
    - StepWorldSetup-component
    - campaigns.importWorldDoc
    - campaigns.create-extended-payload
  affects:
    - src/renderer/src/components/CreateCampaignModal.tsx
    - src/renderer/src/components/wizard/StepWorldSetup.tsx
    - src/main/trpc/routers/campaigns.ts
    - src/main/db/campaignsRepo.ts
tech_stack:
  added: []
  patterns:
    - RadioGroup card pattern (shadcn radio-group, bg-secondary + border-accent-gold selected)
    - Wizard step extension (STEP_LABELS + WizardProgress totalSteps extension)
    - Non-blocking AI generation spinner (submitPhase state machine: creating/generating/null)
    - tRPC dialog.showOpenDialog pattern (mirrors importCoverImage, campaignDocs.import)
key_files:
  created:
    - src/renderer/src/components/wizard/StepWorldSetup.tsx
  modified:
    - src/renderer/src/components/CreateCampaignModal.tsx
    - src/main/trpc/routers/campaigns.ts
    - src/main/db/campaignsRepo.ts
decisions:
  - "worldDocumentFilename stored in WorldSetupState (local wizard state) for UI display — not persisted to DB, only the content is"
  - "importWorldDoc opens OS dialog in main process — renderer never passes file paths (T-07-07-01 pattern)"
  - "submitPhase state machine (null/creating/generating) avoids race conditions during multi-step submit"
  - "generateWorldBrief failure is non-blocking — campaign created + navigated even on AI error"
  - "isStepWorldSetupValid always returns true (permissive) — all three modes are valid selections"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-31T23:44:08Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 7 Plan 07: Campaign Creation Wizard — Party Size + Encumbrance + World Setup Summary

**One-liner:** 4-step campaign creation wizard with party size radio cards, encumbrance toggle, and three world-setup modes (AI/Brief/Import) firing generateWorldBrief on submit with a non-blocking spinner.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | StepWorldSetup component + importWorldDoc + extended campaigns.create | 3c1caad | StepWorldSetup.tsx, campaigns.ts, campaignsRepo.ts |
| 2 | Extend CreateCampaignModal to 4-step wizard | 12395a5 | CreateCampaignModal.tsx |
| 3 | Checkpoint: human verify (auto-approved) | — | — |

## What Was Built

### StepWorldSetup.tsx (new)

Three stacked RadioGroup cards mapped to `worldSetupMode: 'ai' | 'brief' | 'import'`:

- **AI Generates** (default): static helper text, nothing more required
- **Write a Brief**: reveals a `Textarea rows={6}` bound to `worldBrief` with world-brief placeholder from UI spec
- **Import a Document**: "Choose file…" Button triggers `campaigns.importWorldDoc` tRPC mutation; shows filename; amber truncation warning when extracted content > 12,000 chars (T-07-07-02)

Each card: `bg-secondary rounded-lg p-4 border border-border`, selected `border-accent-gold bg-secondary/80`. Icons: Sparkles / PenLine / FileText (lucide).

Exports: `StepWorldSetup`, `isStepWorldSetupValid` (always true), `WorldSetupMode` type, `WorldSetupState` interface.

### campaigns.importWorldDoc (new tRPC mutation)

Opens `dialog.showOpenDialog` in main process (pdf/txt/md filters). Extracts text via `pdfExtractor.extractTextFromFile` or `readTextFile`. Returns `{ filename, content }` or `null` if cancelled. Path-traversal guard (T-07-07-01): `isAbsolute` + no `..` check. Content truncated to 50,000 chars.

### campaigns.create payload extension

New optional fields: `partySize` (int 1–4, default 1), `encumbranceEnabled` (bool, default false), `worldSetupMode` ('ai'|'brief'|'import'), `worldBrief` (string ≤8000), `worldDocument` (string ≤50,000). All persisted to DB via extended `campaignsRepo.create()`.

### CreateCampaignModal.tsx (extended)

4-step wizard:

- **Step 0 (Campaign)**: name field + Party Size 2×2 RadioGroup (Solo=1 default / Small Party=2 / Party=3 / Full Party=4) with User/Users icons + Encumbrance Checkbox
- **Step 1 (World Setup)**: mounts `<StepWorldSetup>`; always valid (permissive)
- **Step 2 (AI Provider)**: existing AI provider fields (shifted from step 1)
- **Step 3 (DM Style)**: existing DM personality + strictness (shifted from step 2)

Submit flow:
1. `createMutation` with full payload (partySize, encumbranceEnabled, worldSetupMode, worldBrief/worldDocument for respective modes)
2. `updateAiConfigMutation` to persist provider config
3. If `worldSetupMode === 'ai'`: button shows "Generating your world…" spinner + "This may take up to 30 seconds…" while calling `generateWorldBrief`
4. On brief gen failure: campaign still created, still navigated; non-blocking amber error chip shown

Reset effect extended to reset partySize=1, encumbranceEnabled=false, worldSetupMode='ai', worldBrief='', worldDocument=null.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @radix-ui/react-radio-group and @radix-ui/react-separator packages**
- **Found during:** Task 1 tsc verification
- **Issue:** Packages were added to package.json in 07-04 but `npm install` was never run, causing TS2307 errors for both radix packages
- **Fix:** Ran `npm install --legacy-peer-deps` in the main repo (worktrees share node_modules)
- **Commit:** Separate from task commits (system fix before 3c1caad)

### Checkpoint Status

`checkpoint:human-verify` (Task 3) auto-approved per `auto_advance=true` configuration. Visual verification of 4-step flow + AI brief generation spinner + truncation warning can be confirmed at next dev run.

## Known Stubs

None. All flows are fully wired:
- Party size written to DB at create time via extended `campaignsRepo.create()`
- Encumbrance toggle written to DB at create time
- World brief (for 'brief' mode) written to DB at create time
- World document (for 'import' mode) written to DB at create time
- AI generates mode fires `generateWorldBrief` which writes `worldBrief` via `campaignsRepo.updateWorldBrief()`

The `worldBriefError` display is shown inline on Step 3 when generation failed — this is intentional (UI spec: "non-blocking error chip after modal closes"; adapted to show inline before close for UX clarity).

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: path-traversal-mitigated | campaigns.ts (importWorldDoc) | T-07-07-01: file path from dialog.showOpenDialog only; isAbsolute + no '..' double-check |
| threat_flag: DoS-mitigated | campaigns.ts (importWorldDoc) | T-07-07-02: 12,000-char UI warning in StepWorldSetup; 50,000-char import cap; 16,000-char injection truncation in contextBuilder (07-03) |

## Self-Check: PASSED

Files confirmed to exist:
- `src/renderer/src/components/wizard/StepWorldSetup.tsx` — FOUND (exports StepWorldSetup, isStepWorldSetupValid, WorldSetupMode)
- `src/renderer/src/components/CreateCampaignModal.tsx` — FOUND (STEP_LABELS = 4, totalSteps={4}, partySize, StepWorldSetup)
- `src/main/trpc/routers/campaigns.ts` — FOUND (importWorldDoc mutation, extended create schema)
- `src/main/db/campaignsRepo.ts` — FOUND (extended create with partySize, encumbranceEnabled, worldSetupMode, worldBrief, worldDocument)

Commits confirmed:
- `3c1caad` — FOUND (feat(07-07): StepWorldSetup + importWorldDoc + extended create)
- `12395a5` — FOUND (feat(07-07): extend CreateCampaignModal to 4-step wizard)

tsc: clean (0 errors)
