---
phase: 07-content-depth-advanced-character
plan: "09"
subsystem: srd-library-browser
tags: [library, SRD, react-router, trpc, search, spells, magic-items, rules, monsters]
dependency_graph:
  requires: ["07-02", "07-03"]
  provides:
    - LibraryScreen
    - route:/library
    - CampaignListScreen-rules-link
    - CampaignViewScreen-library-button
  affects:
    - src/renderer/src/screens/LibraryScreen.tsx (created)
    - src/renderer/src/App.tsx (route added)
    - src/renderer/src/screens/CampaignListScreen.tsx (nav entry point)
    - src/renderer/src/screens/CampaignViewScreen.tsx (nav entry point)
tech_stack:
  added: []
  patterns:
    - three-panel SRD browser (sidebar pills + list + detail)
    - client-side search filter (useState + toLowerCase)
    - trpc.library.* sub-router consumption
    - navigate(-1) back navigation
key_files:
  created:
    - src/renderer/src/screens/LibraryScreen.tsx
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/screens/CampaignListScreen.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
decisions:
  - "Spells sourced from trpc.spells.listAllSpells (existing endpoint) rather than duplicating via library router"
  - "Section switch resets both selectedId and query for clean UX"
  - "Rarity badge uses inline className approach (not ConditionBadge) to keep color logic co-located"
metrics:
  duration: 5min
  completed: "2026-05-31"
  tasks_completed: 3
  files_changed: 4
---

# Phase 7 Plan 09: SRD Library Browser Summary

SRD reference browser at `/library` with Spells/Magic Items/Rules/Monsters sections, client-side search, and detail panel; reachable from campaign list ("Rules" button) and campaign header ("📖").

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build LibraryScreen with four sections + search + detail | 1d1fb0a | LibraryScreen.tsx (created) |
| 2 | Register /library route + navigation entry points | 1218187 | App.tsx, CampaignListScreen.tsx, CampaignViewScreen.tsx |
| 3 | Checkpoint: SRD library reachable (auto-approved) | — | — |

## What Was Built

**LibraryScreen.tsx** — A three-panel screen at `/library`:
- Left sidebar (200px): "← Back" ghost button + "SRD Library" label + four section pills with `role="tablist"`/`role="tab"`/`aria-selected` + search Input (h-9)
- Center panel (flex-1): ScrollArea list with per-section rows — Spells (name + level/school), Magic Items (name + rarity badge), Rules (title + category), Monsters (name + type/CR); selected row `bg-secondary`; empty search state "No results for \"{query}\""
- Right detail panel (320px): "Select an entry to view details." empty state; per-section detail with spell metadata, magic item attunement badge, rule markdown prose via ReactMarkdown, monster 2-column mono stat block

**Route + Navigation:**
- `App.tsx`: `<Route path="/library" element={<LibraryScreen />} />`
- `CampaignListScreen.tsx`: "Rules" ghost button in header — `navigate('/library')`
- `CampaignViewScreen.tsx`: 📖 ghost button in action bar — `navigate('/library')`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all four data sources are wired to live tRPC endpoints (trpc.spells.listAllSpells, trpc.library.magicItems.list, trpc.library.rules.list, trpc.library.monsters.list). Data renders when present in the bundled JSON files.

## Threat Flags

None — per the plan's threat model, the library surfaces only static bundled SRD content (T-07-09-01: accept). No new trust boundaries introduced.

## Self-Check: PASSED

- [x] `src/renderer/src/screens/LibraryScreen.tsx` — exists
- [x] `src/renderer/src/App.tsx` — contains `path="/library"` and imports LibraryScreen
- [x] `src/renderer/src/screens/CampaignListScreen.tsx` — contains `navigate('/library')`
- [x] `src/renderer/src/screens/CampaignViewScreen.tsx` — contains `navigate('/library')`
- [x] Commits 1d1fb0a and 1218187 exist in git log
- [x] tsc reports no errors in LibraryScreen or the three modified files (only pre-existing unrelated errors in radio-group.tsx and separator.tsx)
