---
phase: 06-quests-npcs-world-state
plan: 03
subsystem: ai-context-injection
tags: [contextBuilder, world-state, system-prompt, tool-descriptions, json-tail, security]
requires:
  - "06-01: quests/npcs/factions tables + Quest/Npc/Faction types + world-state columns on campaigns + questsRepo/npcsRepo/factionsRepo"
  - "06-02: campaignsRepo.getWorldState; ALL_TOOLS in streamText; 8 Phase 6 mutation pipeline cases"
provides:
  - "contextBuilder.formatWorldStateSummary(campaignId): active quests (with IDs), NPCs (with IDs+relationship, capped 20), factions (with tier), world time, location (newline-stripped), player characterId"
  - "toolDescriptionsBlock extended with all 8 Phase 6 tools (addQuest/updateQuestStatus/addNpc/updateNpc/updateFaction/updateWorldTime/updateLocation/awardInspiration) for JSON-tail fallback providers"
  - "World-state summary injected into systemPrompt after toolDescriptionsBlock, before referenceDocBlock"
affects:
  - "Wave 3 UI: no direct consumer — this is the AI-facing read-back loop. Closes D-18 so the AI can reference quest/NPC IDs in updateQuestStatus/updateNpc and the characterId in awardInspiration"
tech-stack:
  added: []
  patterns:
    - "formatWorldStateSummary mirrors formatCharacterSummary: module-level function returning a compact text block, '' when nothing to report (lines.length > 1 guard)"
    - "Repos imported at top (questsRepo/npcsRepo/factionsRepo/campaignsRepo) and mocked in the test the same way charactersRepo already is — no SQLite needed, dodges the worktree better-sqlite3 ABI issue"
    - "Security: stripNewlines on each location segment (T-06-03-01); JSON.parse guarded with try/catch + [] fallback (T-06-03-03); NPC list slice(0,20) (T-06-03-02)"
    - "Injection position: '\\n\\n' + toolDescriptionsBlock + (worldStateSummary ? '\\n\\n' + worldStateSummary : '') + referenceDocBlock (Assumption A5)"
key-files:
  created: []
  modified:
    - src/main/ai/contextBuilder.ts
    - src/main/ai/contextBuilder.test.ts
decisions:
  - "Single feat commit (not RED→GREEN split): the plan's Task 1 action block directs writing implementation AND tests together as one unit; the world-state summary read-back is a single cohesive feature"
  - "stripNewlines collapses CR/LF runs to a single space (not deletion) so adjacent words stay separated and an injected 'SYSTEM:' directive cannot start a new prompt line"
  - "Player character ID line emitted only when a character exists; the lines.length>1 guard means a campaign with a character but no other world state still yields a non-empty summary (the characterId is itself world state worth injecting for awardInspiration)"
metrics:
  duration: ~12min
  tasks: 1
  files: 2
  completed: 2026-05-30
---

# Phase 6 Plan 03: ContextBuilder World-State Injection Summary

Closed the AI read-back loop (D-18) by extending `contextBuilder.ts` so every AI call now sees the current world state and knows about all 8 Phase 6 tools. `formatWorldStateSummary()` renders active quests (with IDs), NPCs (with IDs + relationship, capped at 20), factions (with tier), world time, location (newline-stripped), and the player characterId; the summary is injected into the system prompt immediately after the tool descriptions block. The `toolDescriptionsBlock` now describes all 8 Phase 6 tools so JSON-tail (non-tool-calling) local LLM providers can actually drive them (Pitfall 6).

## What Was Built

**Task 1 — formatWorldStateSummary() + toolDescriptionsBlock extension + injection** (commit `075dbe4`)
- Imported `questsRepo`, `npcsRepo`, `factionsRepo`, `campaignsRepo` at the top of `contextBuilder.ts`.
- Added module-level `formatWorldStateSummary(campaignId: string): string` (RESEARCH § Pattern 4):
  - Header `'Current world state:'`; emits `''` unless at least one data line is added (`lines.length > 1`).
  - `- Player character ID: <id>` from `charactersRepo.getByCampaignId(campaignId)?.id` (Pitfall 7) — gives `awardInspiration` a reliable target.
  - `- Time: <timeOfDay>, Day <dayNumber>, <season>` only when `worldTimeOfDay` or `worldDayNumber` is present (with `?` fallbacks for partial state).
  - `- Location: <segs joined by ' > '>` via guarded `JSON.parse` (try/catch → `[]`, and an `Array.isArray` check), with each segment passed through `stripNewlines` (CR/LF runs → single space) before join (T-06-03-01 / T-06-03-03).
  - `- Active quests:` listing only `status === 'Active'` quests as `  * [ID: <id>] <name>` (non-active excluded).
  - `- Known NPCs:` listing `npcs.slice(0, 20)` as `  * [ID: <id>] <name> (<relationship>)` (T-06-03-02 cap).
  - `- Factions:` listing `  * <name>: <tier>`.
- Extended `toolDescriptionsBlock` with a "World & story tracking:" section describing all 8 Phase 6 tools in the existing `- Use \`toolName\` to ...` style, plus a "Valid `toolName` values include..." line in the JSON-tail fallback paragraph enumerating all 18 tool names.
- In `buildContext()`: computed `const worldStateSummary = formatWorldStateSummary(campaignId)` and inserted `+ (worldStateSummary ? '\n\n' + worldStateSummary : '')` between `toolDescriptionsBlock` and `referenceDocBlock` (Assumption A5).
- Exported `formatWorldStateSummary` from the test-export block.
- Extended `contextBuilder.test.ts`: added `vi.mock` for the 4 world-state repos (same object-literal shape the existing `charactersRepo` mock uses), reset them in `beforeEach`, and added a `formatWorldStateSummary` describe with 12 tests:
  empty → `''`; active quest id included + non-active excluded; NPC cap at 20 (npc-19 present, npc-20/24 absent); factions name+tier; Time line; Location join; newline strip (asserts the Location line contains no `\n` and the forged `SYSTEM:` directive is flattened inline); malformed-JSON → no Location line + no throw; player characterId line; `buildContext` injection order (tool block < world state < reference docs) with quest id + characterId present; and all 8 Phase 6 tool substrings in the system prompt.

## Verification

- `npx vitest run src/main/ai/contextBuilder.test.ts` → **33 passed, exit 0** (21 pre-existing + 12 new). No SQLite dependency — all repos mocked, so the worktree better-sqlite3 ABI mismatch (logged by 06-01/06-02) does not affect this suite.
- `npx tsc --noEmit -p tsconfig.json` → **0 errors in `contextBuilder.ts` / `contextBuilder.test.ts`**. The only project-wide type errors are in `src/main/ai/llmProvider.ts` and `src/renderer/src/screens/CampaignViewScreen.tsx` — both pre-existing and out of scope (logged by Wave 1's `deferred-items.md`, confirmed unchanged by 06-02, untouched here).
- All four `must_haves.truths` satisfied: world-state summary block present (quests+IDs / NPCs+IDs+relationship / factions+tier / time / location), toolDescriptionsBlock describes all 8 tools, player characterId included, NPC list capped at 20.
- `must_haves.key_links` satisfied: `buildContext()` calls `formatWorldStateSummary(campaignId)` and injects its output into the system prompt after `toolDescriptionsBlock`.

## Deviations from Plan

### Adjusted

**1. [Rule 3 — Blocking config] `<verification>` referenced a non-existent `tsconfig.node.json`**
- **Found during:** verification.
- **Issue:** The plan's `<verification>` lists `npx tsc --noEmit -p tsconfig.node.json`. This project ships a single unified `tsconfig.json`; `tsconfig.node.json` is absent (TS5058). Same deviation 06-01 and 06-02 both recorded.
- **Fix:** Ran `npx tsc --noEmit -p tsconfig.json`. Confirmed 0 errors in the two plan files.
- **Files modified:** none (tooling adjustment).
- **Commit:** n/a.

## Deferred Issues

**better-sqlite3 ABI mismatch (pre-existing, environment-level) — not encountered here.** 06-02 logged that SQLite-backed vitest suites fail in this worktree (native module compiled for Electron ABI 145, worktree Node ABI 137). This plan's test mocks all four repos, so it has no SQLite dependency and runs green. No action needed for this plan; the broader rebuild-before-formal-run note from 06-02 still applies to the SQLite-backed suites.

## Known Stubs

None. `formatWorldStateSummary` reads the real repos in production and is fully wired into `buildContext`'s system prompt assembly. The repos are mocked only in the unit test (the established pattern for `contextBuilder.test.ts`, which already mocks `charactersRepo`/`messagesRepo`/`sessionsRepo`).

## Threat Flags

None. All surface is covered by the plan's `<threat_model>`: location segments newline-stripped (T-06-03-01), NPC list capped at 20 (T-06-03-02), `worldLocationPath` JSON parse guarded with try/catch + `[]` fallback (T-06-03-03), no new packages (T-06-03-SC).

## Self-Check: PASSED

- src/main/ai/contextBuilder.ts (formatWorldStateSummary + extended toolDescriptionsBlock + injection + export) — FOUND
- src/main/ai/contextBuilder.test.ts (12 new tests, 33 total) — FOUND
- Commit 075dbe4 (Task 1) — FOUND
