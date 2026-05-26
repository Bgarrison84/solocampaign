---
phase: 03
plan: 05
subsystem: ai-config-ui
tags: [renderer, wizard, modal, ai-config, reference-docs, safe-storage, wave-4]
dependency_graph:
  requires:
    - 03-03 (campaigns.updateAiConfig, ai.listReferenceDocs, prefs.isEncryptionAvailable tRPC procedures)
    - 03-04 (CampaignViewScreen with onOpenSettings stub, ChatInputArea onOpenSettings prop)
  provides:
    - AiProviderFields — shared provider type picker + conditional fields + reference doc select + fallback collapsible
    - ReferenceDocSelect — controlled multi-select fed by trpc.ai.listReferenceDocs
    - CreateCampaignModal — 3-step wizard (name / AI provider + ref docs / DM personality + strictness)
    - AiSettingsModal — gear-icon reconfiguration modal (pre-filled, keys never echoed)
    - CampaignViewScreen gear button wired to AiSettingsModal + onOpenSettings seam connected
  affects:
    - src/renderer/src/components/AiProviderFields.tsx
    - src/renderer/src/components/ReferenceDocSelect.tsx
    - src/renderer/src/components/CreateCampaignModal.tsx
    - src/renderer/src/components/AiSettingsModal.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
tech_stack:
  added: []
  patterns:
    - AiProviderFields as shared controlled component used by wizard and gear modal
    - keepExistingKeyMode prop renders "(leave blank to keep current key)" placeholder for D-23
    - validateAiProviderFields + isAiProviderFieldsValid helpers for Next/Save gating
    - Two-mutation sequence in CreateCampaignModal: create() then updateAiConfig() in one handler
    - Pre-fill from trpc.campaigns.get on modal open; apiKey/fallbackApiKey always start empty
    - WizardProgress totalSteps=3, stepLabels=['Campaign','AI Provider','DM Style']
    - Cancel confirmation dialog on non-empty wizard state
    - CollapsibleContent from @radix-ui/react-collapsible for fallback provider section
key_files:
  created:
    - src/renderer/src/components/AiProviderFields.tsx
    - src/renderer/src/components/ReferenceDocSelect.tsx
    - src/renderer/src/components/AiSettingsModal.tsx
  modified:
    - src/renderer/src/components/CreateCampaignModal.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
decisions:
  - AiProviderFields single shared component for wizard Step 2 and gear modal avoids duplication
  - keepExistingKeyMode=false for wizard (no existing key), true for gear modal (D-23)
  - validateAiProviderFields exported as pure function for parent use; isAiProviderFieldsValid for boolean gating
  - Two-mutation sequence in handleSubmit (create then updateAiConfig) with single error path
  - AiSettingsModal pre-fills on campaign data load; re-fills whenever `open` and `campaign` both truthy
  - onOpenSettings stub in CampaignViewScreen resolved — _showAiSettings renamed to showAiSettings
  - cleanTitle function strips OceanofPDF prefix, author suffix, underscores, URL entities
metrics:
  duration: ~25 minutes
  completed: 2026-05-26
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 03 Plan 05: 3-Step Wizard, AiProviderFields, AiSettingsModal Gear Modal Summary

**One-liner:** 3-step campaign creation wizard (name → AI provider + reference docs + fallback → DM personality + strictness) and gear-icon AI Settings modal — both writing config through the secure updateAiConfig mutation with API keys never echoed back.

## What Was Built

### ReferenceDocSelect.tsx
- Controlled multi-select component fed by `trpc.ai.listReferenceDocs.query()`
- `max-h-[240px] overflow-y-auto` bordered list of checkbox rows
- Each row toggles on click; title cleaned via `cleanTitle()` (strips OceanofPDF prefix, author suffix, underscores, URL entities, title-cases result)
- Large-file warning icon (`AlertTriangle` amber) with Tooltip: "Large document — ensure your model's context window is sufficient"
- "Select All" / "Deselect All" toggle button + `{n} selected` count
- Helper text: "Documents are injected into the AI's context window. Choose only what your model can fit."
- Default selection: empty

### AiProviderFields.tsx
- Shared controlled component for wizard Step 2 and gear modal
- Provider type `Select` with `"OpenAI-compatible"` and `"Gemini"` options
- OpenAI-compatible fields: Endpoint URL (required), Model name (required), API key (optional)
- Gemini fields: API key (required), Model name (required) — no URL field
- D-24 amber warning (`bg-amber-950/40`) via `trpc.prefs.isEncryptionAvailable` when `isSecure=false` — shown ABOVE the API key field
- Embedded `<ReferenceDocSelect>` for reference document multi-select
- Collapsible fallback section (`@radix-ui/react-collapsible`) with same field set as primary, matching provider type
- `keepExistingKeyMode` prop renders "(leave blank to keep current key)" placeholders for D-23 gear modal use
- `validateAiProviderFields()` returns per-field error map; `isAiProviderFieldsValid()` returns boolean
- Field values preserved across provider type switches

### CreateCampaignModal.tsx (extended)
- Extended from 1-step to 3-step wizard
- `WizardProgress totalSteps={3}` with `stepLabels={['Campaign', 'AI Provider', 'DM Style']}`
- Dialog widened to `max-w-[560px]`
- Step 1: Campaign name + cover image placeholder + next gate (name ≥ 1 char)
- Step 2: `<AiProviderFields>` + next gate (required provider fields filled)
- Step 3: DM personality `<Textarea rows={5} maxLength={2000}>` with character counter + Rules Strictness `<Select>` (Strict/Balanced/Narrative, default Balanced) with live explanatory callout
- Submit: `campaigns.create.mutate({ name })` then `campaigns.updateAiConfig.mutate(...)` with all config; invalidates `['campaigns','list']`; navigates to campaign view
- Cancel confirmation dialog: "Cancel campaign creation?" / "Keep editing" / "Yes, cancel" (shown when non-empty data exists)
- WizardProgress completed-dot navigation; field state preserved across Back/Next
- Step counter "Step {n} of 3" below dialog title

### AiSettingsModal.tsx (new)
- Props: `campaignId`, `open`, `onClose`
- On open: `trpc.campaigns.get.query({ id: campaignId })` pre-fills provider type, endpoint URL, model name, reference docs, dm personality, strictness, fallback fields
- D-23: API key fields always initialized to empty string — keys are never returned by campaigns.get
- Single scrollable `DialogContent` (no wizard): `AiProviderFields` + border divider + DM personality textarea + strictness select
- Title: `"AI Settings — {campaign name}"`
- Footer: Cancel / Save Changes → `campaigns.updateAiConfig.mutate(...)` with blank apiKey as `undefined` (keeps existing key)
- On success: invalidates `['campaigns', 'get', campaignId]` and closes
- Loading state: "Saving…" + spinner

### CampaignViewScreen.tsx (updated)
- Gear button between spacer and Delete button: `<Button variant="ghost" size="sm">` with `<SlidersHorizontal className="h-4 w-4"/>` + "AI Settings" label
- Tooltip: "Configure AI provider, DM personality, and rules" (600ms delay)
- `showAiSettings` state replacing the plan 03-04 stub `_showAiSettings`
- `handleOpenSettings` now calls `setShowAiSettings(true)` — connects both the gear button and the `onOpenSettings` prop from `StoryScrollPanel`/`ChatInputArea`
- `<AiSettingsModal campaignId={id} open={showAiSettings} onClose={...}/>` rendered inside the fragment

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 3d64702 | feat(03-05): shared AiProviderFields + ReferenceDocSelect components |
| Task 2 | b44ba98 | feat(03-05): 3-step wizard, AiSettingsModal gear modal, gear button in action bar |

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first attempt.

## Known Stubs

None — all implementation files complete with no stub patterns. The `_showAiSettings` stub from plan 03-04 is resolved: renamed to `showAiSettings` and wired to the actual `AiSettingsModal`.

## Threat Surface Scan

All mitigations in the plan's threat register are implemented:

| Threat | Mitigation Implemented |
|--------|----------------------|
| T-03-05-01 (key echo) | AiSettingsModal initializes apiKey/fallbackApiKey as empty string; campaigns.get returns no key columns (D-23). Only sends apiKey when user typed something (truthy check before `|| undefined`). |
| T-03-05-02 (safeStorage warning) | AiProviderFields queries trpc.prefs.isEncryptionAvailable; renders amber warning block above API key fields when isSecure=false |
| T-03-05-03 (updateAiConfig input) | aiConfigSchema (plan 03-03) validates URL/enum/length at the IPC boundary; renderer sends typed payload |

No new network endpoints, auth paths, file access patterns, or schema changes beyond those declared in the plan's threat model.

## Verification Results

- `npm run typecheck` → exit 0 (all 5 files typecheck clean)
- `npm test` → 159 tests passed, 0 failed, 0 skipped (pre-existing suite unaffected)
- `ReferenceDocSelect.tsx` exports `ReferenceDocSelect`, contains `trpc.ai.listReferenceDocs`, contains `"Select All"` and `max-h-[240px]`
- `AiProviderFields.tsx` exports `AiProviderFields`, contains `"OpenAI-compatible"` and `"Gemini"`, contains `"Reduced key security"`, contains `"Add fallback provider (optional)"`
- `CreateCampaignModal.tsx` contains `WizardProgress`, `totalSteps={3}`, `AiProviderFields`, `updateAiConfig`, `"Cancel campaign creation?"`
- `AiSettingsModal.tsx` exports `AiSettingsModal`, calls `trpc.campaigns.get.query`, contains `"Save Changes"` and `updateAiConfig`, apiKey initialized to empty string (line 82)
- `CampaignViewScreen.tsx` contains `SlidersHorizontal`, `"AI Settings"`, `AiSettingsModal`

## Self-Check: PASSED

- [x] `src/renderer/src/components/AiProviderFields.tsx` — FOUND
- [x] `src/renderer/src/components/ReferenceDocSelect.tsx` — FOUND
- [x] `src/renderer/src/components/AiSettingsModal.tsx` — FOUND
- [x] `src/renderer/src/components/CreateCampaignModal.tsx` — FOUND (modified)
- [x] `src/renderer/src/screens/CampaignViewScreen.tsx` — FOUND (modified)
- [x] Commit 3d64702 — FOUND
- [x] Commit b44ba98 — FOUND
- [x] `npm run typecheck` exits 0 — VERIFIED
- [x] `npm test` 159/159 passed — VERIFIED
- [x] AiSettingsModal apiKey initialized to '' (line 82) — VERIFIED
