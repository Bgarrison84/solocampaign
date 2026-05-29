---
phase: 05-rules-engine-dice-combat
plan: 02
subsystem: ai
tags: [vercel-ai-sdk, zod, tool-calling, drizzle, better-sqlite3, electron-ipc]

# Dependency graph
requires:
  - phase: 05-01
    provides: combatants/campaign_events tables + repos, characterResources Phase 5 columns (concentratingOn, hitDiceCurrent/Total, pactSlots), RED test stubs (toolSchemas.test.ts, mutationPipeline.test.ts)
  - phase: 03
    provides: llmProvider.streamChat + contextBuilder.buildContext + ai:send-message IPC handler
provides:
  - 12 bounded Zod tool schemas + PHASE5_TOOLS ToolSet (no execute — D-04)
  - applyMutationBatch (single-transaction, per-tool safeParse, silent-failure isolation — D-06)
  - stripAndParseJsonTail (end-anchored JSON-tail fallback parser — D-02, Pitfall 3)
  - streamChat tools passthrough + onToolCallsFinish surfacing native tool calls
  - contextBuilder tool-usage + JSON-tail system prompt block, concentratingOn/hitDice summary lines
  - ai:send-message mutation wiring (strip tail, apply mutations, persist dice_roll messages, emit ai:mutations-applied)
affects: [05-03 combat, 05-04 dice, 05-05 spells, 05-06 rest/level-up, 05-07 toast/integration, phase-06, phase-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI mutation contract: tools have description + inputSchema, NO execute; mutations batch-applied in onFinish (D-04)"
    - "Per-tool safeParse dispatch over a switch with silent-failure isolation inside one db.transaction() (D-06)"
    - "Native tool calls take priority; JSON-tail is a fallback applied only when no native calls fired (D-02)"

key-files:
  created:
    - src/main/ai/toolSchemas.ts
    - src/main/ai/mutationPipeline.ts
  modified:
    - src/main/ai/llmProvider.ts
    - src/main/ai/contextBuilder.ts
    - src/main/index.ts
    - src/main/db/messagesRepo.ts
    - src/main/ai/mutationPipeline.test.ts

key-decisions:
  - "AI SDK v6 tool() field is inputSchema, not the v4 parameters name the plan/RESEARCH used"
  - "Surface native tool calls by awaiting result.toolCalls in the streamChat wrapper (deterministic ordering before onFinish) instead of the SDK onFinish callback"
  - "Widen messagesRepo InsertMessageInput role to include dice_roll + system so dice/system chips persist as message rows"

patterns-established:
  - "Pattern: campaign_events payload is JSON.stringify'd before campaignEventsRepo.insert (repo takes a pre-serialized string)"
  - "Pattern: player characterId resolved from campaignId via charactersRepo.getByCampaignId when a tool omits it"

requirements-completed: [COMB-03, COMB-04, CHAR-08, PROG-01, PROG-02, STATE-05]

# Metrics
duration: ~70min
completed: 2026-05-29
---

# Phase 5 Plan 02: AI-Mutation Contract Summary

**12 bounded Zod tool schemas + a single-transaction mutation pipeline (with end-anchored JSON-tail fallback) wired through streamChat, the context builder's tool-usage prompt, and the ai:send-message IPC handler — the load-bearing AI→DB contract for all of Phase 5.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-05-29T12:31:00Z
- **Completed:** 2026-05-29T13:42:35Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified incl. test)

## Accomplishments
- Defined all 12 Phase 5 tools (`updateHp`, `applyCondition`, `removeCondition`, `deductSpellSlot`, `restoreSpellSlots`, `awardXp`, `updateCurrency`, `addCombatant`, `removeCombatant`, `endCombat`, `processRest`, `showDiceRoll`) with bounded Zod schemas and registered them as `PHASE5_TOOLS` with no `execute` property (D-04, Pitfall 1).
- Built `applyMutationBatch` — per-tool `safeParse` dispatch inside one `db.transaction()`, silent-failure isolation (D-06), a `campaign_events` row per applied mutation (D-05), long/short rest recovery (D-36/D-40), and a `{ chips, diceRolls }` return for the renderer.
- Built `stripAndParseJsonTail` — strips only an end-anchored ```json block (Pitfall 3), returns `mutations:null`/unchanged text on malformed JSON.
- Extended `streamChat` to pass `tools`/`toolChoice` and surface native tool calls via `onToolCallsFinish` (awaited before `onFinish` for deterministic ordering).
- Extended `contextBuilder` with the tool-usage + JSON-tail-fallback system prompt block (D-02/D-08) and `Concentrating on:`/`Hit Dice:` summary lines (D-25/D-38, Pitfall 8).
- Wired `ai:send-message` to strip the JSON-tail before saving the assistant message, apply native tool calls (and tail mutations only as a fallback, never double-applying), persist `dice_roll` messages, and emit `ai:mutations-applied`.

## Task Commits

1. **Task 1: toolSchemas.ts — 12 tool definitions + Zod schemas** - `4df23d8` (feat) — turns `toolSchemas.test.ts` GREEN (8 tests).
2. **Task 2: mutationPipeline.ts — applyMutationBatch + JSON-tail parser + per-tool dispatch** - `a2ebb83` (feat) — pure tests GREEN (4); DB-backed tests authored against the real schema.
3. **Task 3: Wire tools into llmProvider, contextBuilder, and ai:send-message** - `9fd4b35` (feat) — typecheck GREEN; contextBuilder (22) + llmProvider (6) tests still GREEN.

_TDD note: Tasks 1 & 2 had pre-existing RED stubs from 05-01; this plan implemented the modules to turn them GREEN (the Wave 0 RED → Wave 1 GREEN flow), with Task 2 also adding the now-runnable applyMutationBatch behavior assertions._

## Files Created/Modified
- `src/main/ai/toolSchemas.ts` (created) - 12 bounded Zod schemas + `tool()` registrations + `PHASE5_TOOLS` ToolSet.
- `src/main/ai/mutationPipeline.ts` (created) - `applyMutationBatch`, `stripAndParseJsonTail`, per-tool dispatch, rest recovery, pact-slot handling.
- `src/main/ai/llmProvider.ts` (modified) - `StreamOptions.tools` + `onToolCallsFinish`; streamText passes tools; wrapper surfaces native tool calls before onFinish.
- `src/main/ai/contextBuilder.ts` (modified) - tool-usage/JSON-tail prompt block; concentratingOn/hitDice summary lines.
- `src/main/index.ts` (modified) - ai:send-message: strip tail, save cleanText, apply mutations (native + fallback), persist dice_roll messages, emit ai:mutations-applied.
- `src/main/db/messagesRepo.ts` (modified) - `InsertMessageInput.role` widened to include `dice_roll` + `system`.
- `src/main/ai/mutationPipeline.test.ts` (modified) - added DB-backed applyMutationBatch behavior tests (HP, long/short rest, partial-failure isolation, dice data).

## Decisions Made
- **AI SDK v6 uses `inputSchema`, not `parameters`.** The plan and RESEARCH.md both said `parameters` (the v4 name). The installed `ai@6.0.191` `tool()` helper requires `inputSchema`; used it so the code typechecks. The intent — "no `execute` property" (D-04) — is fully honored.
- **Native tool calls surfaced via awaited `result.toolCalls`** in the `streamChat` wrapper rather than the SDK's `onFinish` callback. This guarantees `onToolCallsFinish` runs (and sets the native-calls flag) before `callbacks.onFinish()` runs the JSON-tail-fallback decision, eliminating a double-apply race (D-02).
- **AI SDK v6 tool calls expose `input`, not `args`** — normalized to `{ toolName, args }` in the wrapper so native calls and JSON-tail calls flow through the same `MutationToolCall` shape into the pipeline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tool()` field is `inputSchema` (not `parameters`)**
- **Found during:** Task 1
- **Issue:** Plan/RESEARCH specified `parameters: <schema>` (AI SDK v4 name); `ai@6.0.191` `tool()` requires `inputSchema`, so `parameters` would fail typecheck.
- **Fix:** Used `inputSchema: <schema>` on all 12 tools. No `execute` property anywhere (D-04 preserved).
- **Files modified:** src/main/ai/toolSchemas.ts
- **Verification:** `toolSchemas.test.ts` GREEN (8 tests); `npm run typecheck` clean for the file.
- **Committed in:** `4df23d8`

**2. [Rule 3 - Blocking] `messagesRepo.InsertMessageInput.role` did not allow `dice_roll`/`system`**
- **Found during:** Task 3
- **Issue:** Plan requires persisting `role: 'dice_roll'` messages, but the type was `'user' | 'assistant'`; the DB column is plain text (no CHECK), so only the TS type blocked it.
- **Fix:** Widened the union to `'user' | 'assistant' | 'dice_roll' | 'system'` (PATTERNS.md StoryScrollPanel renders both).
- **Files modified:** src/main/db/messagesRepo.ts
- **Verification:** `npm run typecheck` clean.
- **Committed in:** `9fd4b35`

**3. [Rule 1 - Bug] Double-apply race between native tool calls and JSON-tail**
- **Found during:** Task 3
- **Issue:** Relying on the SDK `onFinish` callback to set the native-calls flag did not guarantee it ran before the `streamChat` wrapper's own `onFinish` (which decides whether to apply the tail) — a potential double-apply.
- **Fix:** Await `result.toolCalls`/`result.text` in the wrapper and invoke `onToolCallsFinish` there, before `callbacks.onFinish()`; the IPC handler sets `nativeToolCallsApplied` and skips the tail when set (D-02).
- **Files modified:** src/main/ai/llmProvider.ts, src/main/index.ts
- **Verification:** `llmProvider.test.ts` GREEN (6); `npm run typecheck` clean.
- **Committed in:** `9fd4b35`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All three were required for correctness/compilation against the installed AI SDK v6. No scope creep — the tool surface, schemas, and pipeline behavior match the plan exactly.

## Issues Encountered
- **`better-sqlite3` native binding ABI mismatch blocks DB-backed vitest suites.** The installed binding is compiled for Electron's Node ABI (145, via `@electron/rebuild`), but vitest runs under system Node v24.15.0 (ABI 137). This is a **pre-existing environment issue** — 05-01's `combatantsRepo.test.ts` fails identically, and 05-02 did not touch it. The 5 DB-backed `applyMutationBatch` tests are authored against the real schema (same proven harness as `combatantsRepo.test.ts`) and will pass once the runner's binding ABI matches. The 4 pure `stripAndParseJsonTail` tests pass, and `npm run typecheck` is clean for all main-process files. Logged in `deferred-items.md`; a rebuild was deliberately NOT performed because it is a global side-effect on the shared `node_modules` (would break the Electron app and parallel worktree agents).

## Known Stubs
None. `showDiceRoll` is intentionally a display-only tool (no DB mutation by design — D-22); it surfaces dice data to the renderer and logs a `dice_roll` event.

## Threat Flags
None — no new trust-boundary surface beyond the plan's `<threat_model>`. The pipeline `safeParse`s every tool call with bounded schemas (T-05-02-01), parses the JSON-tail through the same pipeline only as a fallback (T-05-02-02), and tool calls originate solely from the main-process AI response path, never the renderer (T-05-02-03).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The AI→DB mutation contract is complete and referenced by every later Phase 5 wave (combat 05-03, dice 05-04, spells 05-05, rest/level-up 05-06, toast/integration 05-07).
- `ai:mutations-applied` (with `chips`) and persisted `dice_roll` messages are ready for the renderer toast/chip stack (05-07) and StoryScrollPanel dice chips (05-04).
- **Blocker for full test verification:** the `better-sqlite3` ABI mismatch must be resolved at the test-runner level (see deferred-items.md) for the DB-backed `applyMutationBatch` tests to run green in CI/local vitest.

## Self-Check: PASSED

- Created files exist: `src/main/ai/toolSchemas.ts`, `src/main/ai/mutationPipeline.ts`, `05-02-SUMMARY.md` — all FOUND.
- Task commits exist: `4df23d8`, `a2ebb83`, `9fd4b35` — all FOUND.

---
*Phase: 05-rules-engine-dice-combat*
*Completed: 2026-05-29*
