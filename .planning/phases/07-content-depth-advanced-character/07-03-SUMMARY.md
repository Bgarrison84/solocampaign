---
phase: 07-content-depth-advanced-character
plan: "03"
subsystem: ai-data-layer
tags: [trpc, routers, tools, companion, partySize, contextBuilder, worldBrief]
dependency_graph:
  requires: ["07-01", "07-02"]
  provides:
    - libraryRouter
    - featsRouter
    - campaignDocsRouter
    - addCompanionSchema
    - removeCompanionSchema
    - PHASE7_TOOLS
    - mutationPipeline-companion
    - charactersRepo-createCompanion
    - charactersRepo-partySize
    - contextBuilder-worldOverview
    - contextBuilder-extendedCharSummary
    - generateWorldBrief
  affects:
    - router.ts (3 new router keys)
    - toolSchemas.ts (ALL_TOOLS now 22)
    - mutationPipeline.ts (companion type + 2 cases)
    - contextBuilder.ts (extended formatCharacterSummary signature)
    - characterFeatsRepo.test.ts (partySize fix)
    - characters.test.ts (partySize fix)
tech_stack:
  added: []
  patterns:
    - Static content cache pattern (module-level null + lazy load, mirrors spells.ts)
    - TDD RED/GREEN cycle (Task 2 + Task 3)
    - Repository pattern (synchronous better-sqlite3)
    - tRPC path-traversal validation (isAbsolute + no ..)
    - generateText for non-streaming AI tasks (mirrors recapGenerator.ts)
key_files:
  created:
    - src/main/trpc/routers/library.ts
    - src/main/trpc/routers/feats.ts
    - src/main/trpc/routers/campaignDocs.ts
  modified:
    - src/main/trpc/router.ts (library, feats, campaignDocs registered)
    - src/main/ai/toolSchemas.ts (addCompanionSchema, removeCompanionSchema, PHASE7_TOOLS, ALL_TOOLS=22)
    - src/main/ai/mutationPipeline.ts (companion MutationChip type, addCompanion + removeCompanion cases)
    - src/main/db/charactersRepo.ts (createCompanion, deleteCompanion, partySize enforcement)
    - src/main/db/campaignsRepo.ts (getWorldOverview, updateWorldBrief)
    - src/main/trpc/routers/campaigns.ts (generateWorldBrief mutation)
    - src/main/ai/contextBuilder.ts (World Overview block, extended formatCharacterSummary)
    - src/main/ai/toolSchemas.test.ts (Phase 7 schema tests)
    - src/main/ai/mutationPipeline.test.ts (companion mutation tests)
    - src/main/db/charactersRepo.test.ts (partySize + createCompanion tests)
    - src/main/ai/contextBuilder.test.ts (World Overview + extended summary tests)
    - src/main/db/characterFeatsRepo.test.ts (partySize fix)
    - src/main/trpc/routers/characters.test.ts (partySize fix, db returned from makeRouter)
decisions:
  - "Companion type stored in characters.subclass column (text, repurposed for companions; subclass is irrelevant for companion rows)"
  - "companions do not count toward partySize — checked via isCompanion=false filter in count query"
  - "worldOverviewBlock injected between character summary and toolDescriptionsBlock per RESEARCH injection order"
  - "formatCharacterSummary signature extended with optional params (encumbranceEnabled, featNames, companions) for backwards compat"
  - "generateWorldBrief uses generateText (non-streaming) mirroring recapGenerator.ts pattern"
  - "ALL_TOOLS now 22 tools (was 20) — existing test updated to reflect Phase 7 addition"
metrics:
  duration: "~60 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  files_changed: 14
---

# Phase 7 Plan 03: AI + Data Layer — Routers, Tools, ContextBuilder Summary

**One-liner:** Three new tRPC routers (library, feats, campaignDocs), addCompanion/removeCompanion tools wired through schema-pipeline-repo, partySize enforcement in charactersRepo, contextBuilder World Overview injection + extended character summary, and generateWorldBrief tRPC mutation — all tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | library, feats, campaignDocs tRPC routers | 6e10bb2 | library.ts, feats.ts, campaignDocs.ts, router.ts |
| 2 RED | Failing tests for companion tools + partySize | 65fc93e | toolSchemas.test.ts, mutationPipeline.test.ts, charactersRepo.test.ts |
| 2 GREEN | addCompanion/removeCompanion tools + partySize | 297c64c | toolSchemas.ts, mutationPipeline.ts, charactersRepo.ts + tests |
| 3 RED | Failing tests for contextBuilder Phase 7 | d149814 | contextBuilder.test.ts |
| 3 GREEN | World Overview + extended summary + generateWorldBrief | 5590edb | contextBuilder.ts, campaignsRepo.ts, campaigns.ts + test fixes |

## What Was Built

### library.ts router (RULES-01, RULES-02)

Five sub-routers each exposing a `.list` query returning the full SRD JSON array:
- `library.feats.list` → `resources/feats.json` (42 feats)
- `library.epicBoons.list` → `resources/epic-boons.json` (26 boons)
- `library.magicItems.list` → `resources/magic-items.json` (32 items)
- `library.rules.list` → `resources/rules.json` (29 rule sections)
- `library.monsters.list` → `resources/monsters.json` (22 monsters)

Module-level cache (null → lazy load) mirrors the spells.ts pattern. `getFeats()` and `getEpicBoons()` exported for reuse by feats.ts.

### feats.ts router (CHAR-05, PROG-03)

8 procedures: `listSrd`, `listEpicBoons`, `listByCharacter`, `add`, `remove`, `listCustomByCampaign`, `createCustom` (name ≤100, desc ≤2000 — T-07-03-02), `deleteCustom`. Uses `characterFeatsRepo` and `customFeatsRepo` from 07-01.

### campaignDocs.ts router (RULES-04, WORLD-01)

3 procedures: `list`, `import`, `delete`. The `import` procedure enforces T-07-03-01 path traversal mitigation:
1. `path.isAbsolute(filePath)` — rejects relative paths
2. `filePath.includes('..')` — rejects traversal segments
3. `.pdf` extension → `extractTextFromFile`; else → `readTextFile`
4. `substring(0, 50_000)` cap before storage (T-07-03-05)

### addCompanion/removeCompanion tools (PARTY-02)

- `addCompanionSchema`: name min1 max100, type enum (Familiar/Animal Companion/Summoned Creature), hpMax int positive max9999, ac int 1-30
- `removeCompanionSchema`: companionId string
- Both registered via `tool({ description, inputSchema })` — no execute (D-04)
- `PHASE7_TOOLS` contains both; `ALL_TOOLS` now has 22 tools total

### mutationPipeline.ts companion cases

`MutationChip.type` union includes `'companion'`. Two new cases:
- `addCompanion`: safeParse → `charactersRepo.createCompanion()` → chip `{label: "${name} joined", type: "companion"}`
- `removeCompanion`: safeParse → `charactersRepo.deleteCompanion()` → chip `{label: "Companion removed", type: "companion"}`

### charactersRepo additions (PARTY-01, PARTY-02)

**partySize enforcement in `createWithResources()`:** Before insert, counts non-companion characters for the campaign via Drizzle `count()`. Throws if `count >= campaign.partySize`. Companions bypass this check.

**`createCompanion()`:** Inserts a `characters` row with `isCompanion=true`. Companion type is stored in the `subclass` column (text field; meaningful for real characters but irrelevant for companions — documented here as the design decision). Non-nullable columns (`class`, `background`, ability scores) receive minimal placeholder values (`'Companion'` / 10). A paired `characterResources` row is created with `hpMax=hpMax, hpCurrent=hpMax`.

**`deleteCompanion()`:** Deletes the companion scoped to campaign + `isCompanion=true` guard.

### contextBuilder World Overview injection (WORLD-01)

Between the character summary block and the tool descriptions block:
```
if worldDocument → "World Reference Document:\n" + worldDocument.substring(0, 16_000)
else if worldBrief → "World Overview:\n" + stripNewlines(worldBrief)
else → omit block
```

New `campaignsRepo.getWorldOverview(campaignId)` returns `{ worldBrief, worldDocument, encumbranceEnabled }`.

### contextBuilder extended formatCharacterSummary (CHAR-04, CHAR-05, STATE-06)

Signature extended with optional params (backwards compatible):
```ts
formatCharacterSummary(char, encumbranceEnabled=false, featNames=[], companions=[])
```

New lines appended at the end of the summary (when data is present):
- `Feats: Alert, Lucky, ...` (from featNames array, newline-stripped)
- `Negative Traits: Greedy, Reckless` (from negativeTraits JSON, try/catch guarded)
- `Companions: Ember (Familiar, HP 8/10), ...`
- `Encumbrance: Enabled (carrying X/Y lbs)` (only when encumbranceEnabled=true)

### generateWorldBrief tRPC mutation (WORLD-01)

On `campaigns.generateWorldBrief({ campaignId })`:
1. Load campaign + AI config
2. `buildModel()` from existing `llmProvider.ts`
3. `generateText()` (non-streaming, mirrors recapGenerator.ts) with a world-building prompt
4. Save result via `campaignsRepo.updateWorldBrief()`
5. Return `{ brief }`

## Companion Type Storage Decision

The companion `type` field (`'Familiar' | 'Animal Companion' | 'Summoned Creature'`) is stored in the `characters.subclass` column. This avoids a schema-breaking change (migration). For companion rows, `subclass` has no semantic meaning (companions are not player characters with subclasses), so the column is repurposed as a type tag. The `isCompanion=true` flag distinguishes companion rows from player character rows.

Future plans that need to read companion type should access `character.subclass` when `character.isCompanion === true`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] characterFeatsRepo.test.ts multi-character test broke after partySize enforcement**
- **Found during:** Task 3 full suite run
- **Issue:** The `listByCharacter does not return feats from other characters` test creates two characters in the same campaign. Default partySize=1, so the second `createWithResources()` now throws.
- **Fix:** Added `db.update(campaigns).set({ partySize: 2 })` before creating the second character.
- **Files modified:** `src/main/db/characterFeatsRepo.test.ts`
- **Commit:** 5590edb

**2. [Rule 1 - Bug] characters.test.ts party-mode test broke after partySize enforcement**
- **Found during:** Task 3 full suite run
- **Issue:** The `allows a second character in the same campaign (Phase 7 party mode — D-18)` test creates two characters without setting partySize=2. The test comment said "partySize enforcement planned for 07-04" but we implemented it in 07-03.
- **Fix:** Set partySize=2 before creating the second character; returned `db` from `makeRouter()`.
- **Files modified:** `src/main/trpc/routers/characters.test.ts`
- **Commit:** 5590edb

**3. [Rule 1 - Bug] formatCharacterSummary duplicate export**
- **Found during:** Task 3 GREEN implementation
- **Issue:** Made `formatCharacterSummary` an `export function` but the bottom re-export `export { ..., formatCharacterSummary, ... }` caused esbuild "Multiple exports with the same name" error.
- **Fix:** Removed `formatCharacterSummary` from the bottom re-export (already exported via `export function`).
- **Files modified:** `src/main/ai/contextBuilder.ts`
- **Commit:** 5590edb

## Known Stubs

None. All functions are fully implemented. The `formatCharacterSummary` feats and companions parameters are wired through `buildContext`'s data-loading path — however, `buildContext` currently passes empty defaults for featNames and companions (it does not yet query `characterFeatsRepo` or companion rows). This is intentional: the `buildContext` extension to wire live feat/companion data is scoped to the UI plans that display these features. The summary parameters are ready for Phase 7 UI plans to pass live data.

**Note:** The `worldOverviewBlock` is fully wired — `buildContext` calls `campaignsRepo.getWorldOverview()` and injects the block. Feats and companions in the character summary are not yet auto-loaded in `buildContext` (they require the calling code to pass the data). This is the planned architecture — the tRPC routers created in Task 1 expose the queries the UI will use.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: path-traversal-mitigated | campaignDocs.ts | T-07-03-01: isAbsolute check + no '..' check before file read |
| threat_flag: DoS-mitigated | campaignDocs.ts | T-07-03-05: substring(0, 50_000) before storage; 16_000 truncation for worldDocument injection |
| threat_flag: input-validated | toolSchemas.ts | T-07-03-03: addCompanionSchema bounds validated in mutationPipeline before DB write |
| threat_flag: partySize-enforced | charactersRepo.ts | T-07-03-04: application-level count check in createWithResources |

## Self-Check: PASSED

Files confirmed to exist:
- src/main/trpc/routers/library.ts — FOUND (contains `.feats.list`, `.magicItems.list`, `.rules.list`, `.monsters.list`)
- src/main/trpc/routers/feats.ts — FOUND (contains `createCustom` with `z.string().max(100)`)
- src/main/trpc/routers/campaignDocs.ts — FOUND (contains `path.isAbsolute` + `..` check + `substring(0, 50_000)`)
- src/main/trpc/router.ts — FOUND (contains `library:`, `feats:`, `campaignDocs:`)
- src/main/ai/toolSchemas.ts — FOUND (contains `addCompanionSchema`, `removeCompanionSchema`, `PHASE7_TOOLS`, `ALL_TOOLS`)
- src/main/ai/mutationPipeline.ts — FOUND (contains `'companion'` type, `case 'addCompanion'`, `case 'removeCompanion'`)
- src/main/db/charactersRepo.ts — FOUND (contains `createCompanion`, `deleteCompanion`, `partySize` throw)
- src/main/db/campaignsRepo.ts — FOUND (contains `getWorldOverview`, `updateWorldBrief`)
- src/main/trpc/routers/campaigns.ts — FOUND (contains `generateWorldBrief` calling `generateText` and `updateWorldBrief`)
- src/main/ai/contextBuilder.ts — FOUND (contains `World Overview:`, `World Reference Document:`, `substring(0, 16_000)`)

Commits confirmed to exist:
- 6e10bb2 — FOUND (feat(07-03): library, feats, campaignDocs routers)
- 65fc93e — FOUND (test(07-03): RED companion tests)
- 297c64c — FOUND (feat(07-03): companion tools + partySize)
- d149814 — FOUND (test(07-03): RED contextBuilder tests)
- 5590edb — FOUND (feat(07-03): contextBuilder World Overview + generateWorldBrief)

Test results: 367 passing, 0 failing, 29 todo
