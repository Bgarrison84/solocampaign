---
phase: 05-rules-engine-dice-combat
plan: 01
subsystem: database
tags: [drizzle, better-sqlite3, sqlite, migrations, rpg-dice-roller, zod, vitest, srd]

# Dependency graph
requires:
  - phase: 04-sessions-memory
    provides: sessions table, messagesRepo append pattern, character_resources schema, contextBuilder
  - phase: 02-character-domain-live-sheet
    provides: characters/character_resources tables, charactersRepo createWithResources, CharacterWithResources type
provides:
  - rpg-dice-roller dice utility (rollExpression, isValidExpression, RollResult)
  - combatants, campaign_events, character_spells tables (migration 0004)
  - character_resources columns concentratingOn, hitDiceCurrent, hitDiceTotal, pactSlots
  - campaigns.permadeathMode column (PROG-04)
  - combatantsRepo, campaignEventsRepo, characterSpellsRepo (synchronous Drizzle CRUD)
  - resources/spells.json (46 SRD spells)
  - RED test scaffolds for toolSchemas + mutationPipeline (Wave 1 targets)
affects: [05-02-ai-tooling, 05-03-combat, 05-04-dice, 05-05-spells, 05-06-levelup-rest, 05-07-toast-integration]

# Tech tracking
tech-stack:
  added: [rpg-dice-roller@5.0.0]
  patterns:
    - "Dice breakdown extraction filters to dice-group objects only (excludes operator/modifier entries)"
    - "Append-only event repo with rowid tiebreak for stable desc(createdAt) ordering"
    - "isActive soft-end pattern for combatants (endCombat flips flag, no delete)"

key-files:
  created:
    - src/renderer/src/lib/dice.ts
    - src/renderer/src/lib/dice.test.ts
    - resources/migrations/0004_phase5_rules_engine.sql
    - resources/spells.json
    - src/main/db/combatantsRepo.ts
    - src/main/db/campaignEventsRepo.ts
    - src/main/db/characterSpellsRepo.ts
    - src/main/db/combatantsRepo.test.ts
    - src/main/db/campaignEventsRepo.test.ts
    - src/main/db/characterSpellsRepo.test.ts
    - src/main/ai/toolSchemas.test.ts
    - src/main/ai/mutationPipeline.test.ts
  modified:
    - src/main/db/schema.ts
    - resources/migrations/meta/_journal.json
    - index.d.ts
    - src/main/ai/contextBuilder.test.ts
    - package.json

key-decisions:
  - "rpg-dice-roller v5 roll.rolls is a mixed array (dice groups + operator strings + modifier numbers); breakdown flattens only dice-group .rolls values, so 2d6+3 yields breakdown.length 2 and 4d6kh3 yields 4"
  - "campaign_events orders by desc(createdAt) then desc(rowid) so same-millisecond inserts stay deterministic"
  - "rpg-dice-roller module types declared in root index.d.ts because the package's exports map omits a types field"

patterns-established:
  - "New repos follow sessionsRepo synchronous Drizzle pattern (no await, .run()/.get()/.all())"
  - "Combatant lifecycle uses isActive soft-end rather than row deletion"

requirements-completed: [COMB-01, COMB-02, CHAR-08, STATE-05]

# Metrics
duration: 13min
completed: 2026-05-29
---

# Phase 5 Plan 01: Wave 0 Foundation Summary

**Dice utility (rpg-dice-roller), migration 0004 (combatants/campaign_events/character_spells + 5 columns), three synchronous repos, a 46-spell SRD content file, and six Wave 0 test files (4 GREEN, 2 RED scaffolds).**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-29T13:04:40Z
- **Completed:** 2026-05-29T13:17:50Z
- **Tasks:** 5
- **Files modified:** 17 (12 created, 5 modified)

## Accomplishments
- Installed rpg-dice-roller@5 and built a renderer dice wrapper proven by 5 passing tests across `d20`, `2d6+3`, and `4d6kh3`
- Extended the Drizzle schema with 3 tables + 5 columns and authored migration 0004, verified to apply in-memory with `integrity_check: ok`
- Authored `resources/spells.json` with 46 SRD spells (13 cantrips, 16 first-, 9 second-, 8 third-level) covering every spellcasting class's level-1 needs
- Built combatantsRepo, campaignEventsRepo, characterSpellsRepo (synchronous Drizzle) with 9 passing tests
- Created the two AI RED scaffolds (toolSchemas, mutationPipeline) that Wave 1 (05-02) turns GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: rpg-dice-roller + dice.ts wrapper + dice test** - `a2bee37` (feat)
2. **Task 2: schema extension + migration 0004 + _journal.json** - `b3a54c7` (feat)
3. **Task 3: resources/spells.json (SRD spell metadata)** - `351a6fe` (feat)
4. **Task 4: combatants/campaignEvents/characterSpells repos + tests** - `374c359` (feat)
5. **Task 5: RED test scaffolds for toolSchemas + mutationPipeline** - `b0189dd` (test)

_Plan metadata commit (this SUMMARY) follows separately._

## Files Created/Modified
- `src/renderer/src/lib/dice.ts` - rpg-dice-roller wrapper (rollExpression, isValidExpression, RollResult)
- `src/renderer/src/lib/dice.test.ts` - dice wrapper tests
- `src/main/db/schema.ts` - added combatants/campaignEvents/characterSpells tables; 4 character_resources columns; campaigns.permadeathMode
- `resources/migrations/0004_phase5_rules_engine.sql` - 3 CREATE TABLE + 5 ALTER TABLE statements
- `resources/migrations/meta/_journal.json` - appended idx 4 entry
- `resources/spells.json` - 46 SRD spells with full metadata + descriptions
- `src/main/db/combatantsRepo.ts` - combatant CRUD (create/listActive/updateHp/updateConditions/remove/endCombat/clearForCampaign)
- `src/main/db/campaignEventsRepo.ts` - append-only event log (insert/listByCampaign)
- `src/main/db/characterSpellsRepo.ts` - character spell list (seed/listByCharacter/removeAll)
- `src/main/db/{combatants,campaignEvents,characterSpells}Repo.test.ts` - 9 passing repo tests
- `src/main/ai/toolSchemas.test.ts`, `src/main/ai/mutationPipeline.test.ts` - RED scaffolds (import Wave 1 modules)
- `index.d.ts` - ambient module declaration for rpg-dice-roller types
- `src/main/ai/contextBuilder.test.ts` - added 4 new resource columns to fixture
- `package.json` / `package-lock.json` - rpg-dice-roller dependency

## Decisions Made
- **Dice breakdown extraction:** rpg-dice-roller v5's `roll.rolls` for `2d6+3` is a mixed array — index 0 is the dice-group object (`{rolls:[{value},{value}]}`), index 1 is the operator string `'+'`, index 2 is the modifier number `3`. The naive PATTERNS.md template `[r.value]` fallback would push `undefined` for operator/modifier entries and break `breakdown.length === 2`. Implemented a type guard (`isDiceGroup`) that flattens only dice-group `.rolls` values. For `4d6kh3` all four rolled dice (including the dropped die) appear in the breakdown.
- **campaign_events ordering:** Added `desc(rowid)` as a secondary sort after `desc(createdAt)` so events inserted in the same millisecond (common in fast tests) return in deterministic newest-first order — mirrors the messagesRepo rowid stability approach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] rpg-dice-roller types not resolved under moduleResolution: bundler**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** `dice.ts` import raised TS7016 — rpg-dice-roller ships types at `./types/index.d.ts` but its `package.json` `exports["."]` block omits a `types` field, so TypeScript (moduleResolution: bundler) could not find them.
- **Fix:** Added an ambient `declare module 'rpg-dice-roller'` to the repo-root `index.d.ts` re-exporting `rpg-dice-roller/types/index.d.ts`.
- **Files modified:** `index.d.ts`
- **Verification:** `npm run typecheck` no longer reports the dice.ts error.
- **Committed in:** `b3a54c7`

**2. [Rule 3 - Blocking] contextBuilder.test.ts fixture missing new resource columns**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** Adding 4 columns to `character_resources` broke the existing `CharacterWithResources` test fixture in contextBuilder.test.ts (TS2322 — missing concentratingOn/hitDiceCurrent/hitDiceTotal/pactSlots).
- **Fix:** Added the 4 new fields to the fixture (`concentratingOn: null`, `hitDiceCurrent: null`, `hitDiceTotal: null`, `pactSlots: '{}'`).
- **Files modified:** `src/main/ai/contextBuilder.test.ts`
- **Verification:** `npm run typecheck` no longer reports the fixture error; contextBuilder tests unaffected.
- **Committed in:** `b3a54c7`

**3. [Rule 3 - Blocking] npm install peer-dependency conflict**
- **Found during:** Task 1 (npm install rpg-dice-roller)
- **Issue:** The project has a pre-existing peer conflict (electron-trpc/@trpc/react-query v10 wants @tanstack/react-query v4, project uses v5). `npm install` aborted with ERESOLVE — unrelated to rpg-dice-roller itself (which was pre-approved in the Package Legitimacy Audit, slopcheck [OK]).
- **Fix:** Installed with `--legacy-peer-deps`, the project's existing install convention for this known conflict. No alternative/substitute package was installed.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** rpg-dice-roller@5.0.0 resolved; API smoke test + 5 dice tests pass.
- **Committed in:** `a2bee37`

---

**Total deviations:** 3 auto-fixed (3 blocking). No architectural changes, no scope creep. All three were necessary to complete the planned work and were caused directly by the plan's own schema/dependency changes.

## Issues Encountered
- **Pre-existing out-of-scope typecheck error (NOT fixed):** `src/renderer/src/components/ui/scroll-area.tsx(4,20)` fails with `Cannot find module '@/lib/utils'` because tsconfig defines only the `~/*` alias, not `@/*`. Confirmed pre-existing (file + tsconfig unchanged from base commit cb72e20) and outside this plan's scope. Logged to `.planning/phases/05-rules-engine-dice-combat/deferred-items.md`. The schema changes themselves typecheck clean.

## Known Stubs
- `src/main/ai/toolSchemas.test.ts` and `src/main/ai/mutationPipeline.test.ts` are intentional RED scaffolds — they import `./toolSchemas` and `./mutationPipeline` which Wave 1 (05-02) implements. They fail to load until then by design (per plan + VALIDATION.md Wave 0). Not a defect; not in scope to make GREEN here.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Wave 0 foundation artifacts exist: dice utility, migration 0004 (3 tables + 5 columns), 3 repos, spells.json, and 6 test files.
- Wave 1 (05-02) can now implement `toolSchemas.ts` (12 Zod tool schemas + PHASE5_TOOLS) and `mutationPipeline.ts` (stripAndParseJsonTail + applyMutationBatch) to turn the two RED scaffolds GREEN.
- Downstream UI waves (combat tracker, dice roller, spell list, level-up/rest) have their DB contract and content locked.

---
*Phase: 05-rules-engine-dice-combat*
*Completed: 2026-05-29*
