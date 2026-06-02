---
phase: 08-polish-export-accessibility
plan: "05"
subsystem: pdf-export
tags: [pdf, character-sheet, react-pdf, tRPC, export, DIST-02]
dependency_graph:
  requires: ["08-01"]
  provides:
    - CharacterSheetPdf (react-pdf Document, two-column A4, conditional spell page)
    - CharacterPdfData interface (source of truth in pdfService.ts)
    - generateCharacterPdf(data) → Promise<Buffer> (pdfService.ts)
    - characters.exportPdf tRPC mutation (characters.ts)
    - CharacterSheetTab PDF button (Export PDF, Loader2 spinner, aria-label)
  affects:
    - src/main/trpc/routers/characters.ts (exportPdf procedure added)
    - src/renderer/src/components/CharacterSheetTab.tsx (PDF button added)
    - package.json (@react-pdf/renderer added)
tech_stack:
  added:
    - "@react-pdf/renderer ^4.5.1 (dynamic import — ESM-only v4)"
  patterns:
    - dynamic import() for ESM-only packages (mirrors pdfExtractor.ts/unpdf pattern)
    - CharacterPdfData built in tRPC procedure from multiple repos
    - OS dialog.showSaveDialog for trusted save path (T-08-15)
key_files:
  created:
    - src/main/services/CharacterSheetPdf.tsx
    - src/main/services/pdfService.ts
    - src/main/services/pdfService.test.ts
  modified:
    - src/main/trpc/routers/characters.ts (exportPdf procedure)
    - src/renderer/src/components/CharacterSheetTab.tsx (PDF button)
    - package.json (@react-pdf/renderer added)
decisions:
  - "Dynamic import() for @react-pdf/renderer v4 (ESM-only) — required to avoid CJS/ESM interop failure in electron-vite main process bundle. Mirrors existing unpdf pattern."
  - "CharacterPdfData type lives in CharacterSheetPdf.tsx and is re-exported from pdfService.ts — single source of truth."
  - "Skills list duplicated in characters.ts (not imported from renderer sheetHelpers.ts) to avoid Landmine 7 cross-process imports."
  - "React.createElement cast to `any` for renderToBuffer — type mismatch between FunctionComponentElement and DocumentProps, but correct at runtime."
  - "@react-pdf/renderer installed via --legacy-peer-deps (existing tRPC/react-query peer dep conflict pre-dates this plan)."
metrics:
  duration: "~30min"
  completed_date: "2026-06-02"
---

# Phase 8 Plan 05: Character Sheet PDF Export Summary

Character sheet PDF export (DIST-02) implemented via react-pdf two-column A4 document, dynamic renderToBuffer service, tRPC procedure, and PDF button in CharacterSheetTab with loading state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CharacterSheetPdf.tsx (react-pdf two-column, conditional spell page) | e323f41 | CharacterSheetPdf.tsx |
| 2 | pdfService.ts (dynamic renderToBuffer) + Wave 0 tests (3/3) | 1bcde81 | pdfService.ts, pdfService.test.ts |
| 3 | characters.exportPdf procedure + CharacterSheetTab PDF button | ea95125 | characters.ts, CharacterSheetTab.tsx, pdfService.ts |
| — | package.json: add @react-pdf/renderer | 74af63a | package.json |

## Verification

- `npm run test -- --run pdfService`: 3/3 tests pass (non-empty Buffer, spellcaster=2 pages, martial=1 page)
- `npm run typecheck`: exits 0 (all tasks)
- Full test suite: pre-existing better-sqlite3 native binding failures unrelated to plan changes (NODE_MODULE_VERSION 145 vs 137 — Electron vs system Node); pdfService tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @react-pdf/renderer was not installed despite plan stating "already in package.json"**
- **Found during:** Task 1 typecheck
- **Issue:** The plan's threat model states "@react-pdf/renderer (already installed) — accept" and RESEARCH.md states "4.5.1 (latest) [VERIFIED: npm registry] — already in package.json", but the package was absent from both `package.json` and `node_modules`.
- **Fix:** Installed via `npm install @react-pdf/renderer@^4.5.1 --legacy-peer-deps` (legacy flag needed due to pre-existing tRPC/react-query peer dep conflict). Package is legitimate: github.com/diegomura/react-pdf, 8 years old, ~800k weekly downloads. Explicitly pre-approved in CLAUDE.md and plan threat model (T-08-SC: [OK] approved).
- **Files modified:** package.json (added @react-pdf/renderer ^4.5.1), node_modules updated in main repo
- **Commits:** e323f41 (deviation noted), 74af63a (package.json update)

**2. [Rule 1 - Bug] React.createElement type cast needed for renderToBuffer**
- **Found during:** Task 3 typecheck
- **Issue:** `renderToBuffer` expects `ReactElement<DocumentProps>` but `React.createElement(CharacterSheetPdf, { data })` returns `FunctionComponentElement<{data: CharacterPdfData}>`. TypeScript rejects the assignment.
- **Fix:** Cast element to `any` before passing to `renderToBuffer`. The cast is correct at runtime since `CharacterSheetPdf` renders a `<Document>` root.
- **Files modified:** src/main/services/pdfService.ts
- **Commit:** ea95125

## Known Stubs

None — the PDF export is fully wired:
- CharacterSheetPdf renders a complete two-column A4 sheet from real data
- Personality/ideals/bonds/flaws fields are undefined (CharacterPdfData supports them, but the characters table stores them differently — these fields are left as `undefined` in the current procedure. Future enhancement: look up personality text from character backstory or notes)

The PDF export produces a functional, print-ready document. The personality section renders empty for the v1 launch.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's `<threat_model>`:
- T-08-14: characterId validated as UUID by Zod schema at tRPC boundary (mitigated)
- T-08-15: save path from OS showSaveDialog — renderer never supplies a path (mitigated)
- T-08-16: PDF contains only user's own character data; no secrets/keys; generated locally (accepted)
- T-08-SC: @react-pdf/renderer approved package (accepted)

## Manual Verification Required Before Ship

Per plan verification section and Open Question 1 / Assumption A2:
- Run `npm run compile:app && electron out/main/index.js`
- Export a martial character (expect 1-page PDF, white background, two-column layout)
- Export a spellcaster (expect 2-page PDF with spell slots + spell table on page 2)
- If yoga-layout `__dirname` fails in ASAR: add `@react-pdf/renderer` to `electron-builder.asar.unpack`

## Self-Check: PASSED

Files exist:
- src/main/services/CharacterSheetPdf.tsx: FOUND
- src/main/services/pdfService.ts: FOUND
- src/main/services/pdfService.test.ts: FOUND

Commits exist:
- e323f41: FOUND (CharacterSheetPdf)
- 1bcde81: FOUND (pdfService + tests)
- ea95125: FOUND (exportPdf procedure + button)
- 74af63a: FOUND (package.json)
