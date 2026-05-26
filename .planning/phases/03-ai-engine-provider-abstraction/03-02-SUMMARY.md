---
phase: 03
plan: 02
subsystem: ai-engine
tags: [ai, streaming, vercel-ai-sdk, llm-provider, retry, context-builder, reference-docs, wave-1]
dependency_graph:
  requires:
    - 03-01 (schema + messagesRepo + Wave 0 stubs)
  provides:
    - streamChat() + buildModel() factory — wraps Vercel AI SDK streamText
    - withRetry() — 3 attempts, 1000/2000/4000ms exponential backoff
    - listReferenceDocs() + readReferenceDocs() — title cleaning + path-traversal guard
    - buildContext() — system prompt assembly + character summary + last-20 messages
    - All 4 Wave 0 AI engine test stubs turned green (37 tests)
  affects:
    - src/main/ai/llmProvider.ts
    - src/main/ai/retryHandler.ts
    - src/main/ai/referenceDocLoader.ts
    - src/main/ai/contextBuilder.ts
tech_stack:
  added:
    - Vercel AI SDK v6 ModelMessage type (CoreMessage renamed in v6; re-exported for compatibility)
  patterns:
    - Promise.race() for first-token timeout vs stream iteration
    - 16ms token batching buffer to prevent IPC saturation on fast models
    - Injectable sleep function in withRetry for deterministic test control
    - Wrapper object pattern to avoid TypeScript never-type narrowing issue in Promise callbacks
    - vi.mock('node:fs') for referenceDocLoader unit tests without real filesystem
key_files:
  created:
    - src/main/ai/llmProvider.ts
    - src/main/ai/retryHandler.ts
    - src/main/ai/referenceDocLoader.ts
    - src/main/ai/contextBuilder.ts
  modified:
    - src/main/ai/llmProvider.test.ts (Wave 0 stubs → 6 real tests)
    - src/main/ai/retryHandler.test.ts (Wave 0 stubs → 5 real tests)
    - src/main/ai/referenceDocLoader.test.ts (Wave 0 stubs → 11 real tests)
    - src/main/ai/contextBuilder.test.ts (Wave 0 stubs → 15 real tests)
decisions:
  - AI SDK v6 renamed CoreMessage to ModelMessage; re-exported CoreMessage alias for forward compatibility with plan descriptions
  - 15s timeout implemented as Promise.race between iterateStream() and a timeout promise (not Promise.race on streamText() itself — streamText resolves fast but textStream yields slowly for long-reasoning models)
  - cleanTitle() applies underscore→space conversion BEFORE author-suffix strip so " - " separator is visible (underscored form uses " _ - _ " which would not match)
  - ModelMessage mapping uses explicit role === 'assistant' branch to satisfy TypeScript union narrowing
  - listReferenceDocs() skips folders where no same-named .md file exists (non-doc folders like image directories are skipped)
metrics:
  duration: ~40 minutes
  completed: 2026-05-26
  tasks_completed: 2
  files_created: 4
  files_modified: 4
---

# Phase 03 Plan 02: AI Engine Core Modules Summary

**One-liner:** Provider-agnostic streamChat wrapping Vercel AI SDK v6 with 15s timeout + 16ms IPC batching, 3-retry exponential backoff, reference doc loader with path-traversal guard and title cleaning, and ContextBuilder v1 assembling D-21 character summary + strictness directive + DM personality.

## What Was Built

### llmProvider.ts
- `buildModel(config)` factory: `gemini` → `createGoogleGenerativeAI({apiKey})(modelName)`; `openai-compatible` → `createOpenAICompatible({name:'custom', baseURL, apiKey: apiKey ?? 'none'})(modelName)` — Pitfall 1 enforced
- `streamChat(config, messages, systemPrompt, callbacks)`: calls `streamText` with `temperature: 0.8`; iterates `result.textStream` with `for await` (Pitfall 3); tokens coalesced in 16ms batches before `onToken` invocation (Pitfall 5 / IPC buffer guard)
- **15s first-token timeout (T-03-02-03)**: `Promise.race([iterateStream(), timeoutPromise])` — timeout fires via `setTimeout(15000)` after `streamText` resolves; cleared on first token; calls `callbacks.onError(new Error('Provider did not respond in time'))` if fired
- T-03-02-02 security: `apiKey` never passed to `log.*` — only `systemPromptLength` and `messageCount` logged
- `CoreMessage` re-exported as alias for AI SDK v6 `ModelMessage`

### retryHandler.ts
- `withRetry<T>(fn, opts?)`: 3 attempts, backoff `baseDelayMs * 2^attempt` = 1000ms/2000ms/4000ms
- `sleep` function is injectable via `opts.sleep` for deterministic test control without real `setTimeout` waits
- Surfaces the final error after all attempts exhausted (SESS-08)

### referenceDocLoader.ts
- `getReferenceDocsRoot()`: packaged → `process.resourcesPath/reference-docs`; dev → `<repo-root>/Reference Documents/Converted`
- `listReferenceDocs()`: enumerates folders under Converted/, looks for `<name>/<name>.md` file, returns sorted `ReferenceDocInfo[]` with cleaned title + sizeBytes + `isLarge` flag (`> 200_000` bytes)
- `readReferenceDocs(relativePaths)`: reads each file; **T-03-02-01 path traversal guard**: `resolved.startsWith(root + sep)` — rejects `../` paths
- `cleanTitle(rawName)`: strips `_OceanofPDF.com_` prefix → underscores to spaces → author suffix after last ` - ` → URL-decode `xHH` hex entities → hyphens to spaces → title-case (preserves existing caps like `RPG`)

### contextBuilder.ts
- `buildContext({campaignId, config})` → `{ systemPrompt, messages }`
- **System prompt order (D-20 / AI-SPEC §4b)**:
  1. Fixed preamble
  2. Strictness directive (`strict`: rules-as-written; `balanced`: story-first; `narrative`: rules are flavor)
  3. DM personality (or `"Classic adventure DM — balanced tone, fair challenges, memorable moments."` fallback)
  4. Character summary (D-21 format): name/level/race/class, HP/AC/Speed/Initiative, stats with modifiers, proficiency bonus, spell slots (omitted if empty), conditions (None if empty), inspiration
  5. Reference docs as `=== {title} ===\n{content}` blocks via `readReferenceDocs`
- `messages`: `messagesRepo.getLastN(campaignId, 20)` mapped to `ModelMessage[]`
- Integrates `charactersRepo.getByCampaignId` and `messagesRepo.getLastN`

### Test Coverage
- `llmProvider.test.ts`: 6 tests — token delivery, onError on throw, onFinish after tokens, buildModel factory routes, no-apiKey passes 'none', 15s timeout fires with correct error message
- `retryHandler.test.ts`: 5 tests — 3 attempts then fail, succeeds on 2nd attempt, 1000/2000ms backoff timing, final error propagated, immediate success no sleep
- `referenceDocLoader.test.ts`: 11 tests — 5 cleanTitle cases (OceanofPDF strip, author suffix, URL decode+title-case, plain name, .md extension), listReferenceDocs (empty root, folder with .md, isLarge flag), readReferenceDocs (valid file, path traversal blocked, skip on read error)
- `contextBuilder.test.ts`: 15 tests — character name/level/race/class, HP/AC/speed/initiative, all 3 strictness directives, DM personality injection + fallback, reference doc appended, last 20 messages, spell slots omitted when empty, Active Conditions: None, conditions list, spell slots with ordinals, subclass in class line

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | f73cf8e | feat(03-02): implement llmProvider streamChat + retryHandler with tests |
| Task 2 | 22459d2 | feat(03-02): implement referenceDocLoader, contextBuilder, fix AI SDK v6 types |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AI SDK v6 renamed CoreMessage to ModelMessage**
- **Found during:** Task 1 — typecheck after writing llmProvider.ts
- **Issue:** Plan spec and AI-SPEC §3 reference `CoreMessage` from `'ai'`, but the installed `ai@6.x` package exports `ModelMessage` instead (breaking change from v4/v5)
- **Fix:** Changed all imports to `import type { ModelMessage } from 'ai'`; exported `type CoreMessage = ModelMessage` as a compatibility alias in both llmProvider.ts and contextBuilder.ts
- **Files modified:** `src/main/ai/llmProvider.ts`, `src/main/ai/contextBuilder.ts`
- **Commit:** 22459d2

**2. [Rule 1 - Bug] 15s timeout implementation — Promise.race must race iteration, not streamText()**
- **Found during:** Task 1 — timeout test failure on first attempt
- **Issue:** Initial implementation raced `streamText()` itself against the timeout. Since `streamText()` is mocked to resolve immediately in tests, the race always resolved before the timeout. The 15s guard is for _first-token arrival_, not SDK initialization.
- **Fix:** Restructured to race `iterateStream()` (the `for await` loop over `result.textStream`) against the timeout promise. The timeout fires if no `yield` occurs within 15s of the loop starting.
- **Commit:** f73cf8e

**3. [Rule 3 - Blocking] cleanTitle author-suffix strip required underscore-to-space conversion first**
- **Found during:** Task 2 — first referenceDocLoader test run
- **Issue:** The author-suffix strip searched for ` - ` (space-dash-space) but the OceanofPDF folder name uses `_-_` (underscore form): `..._Guide_-_James_DAmato`. Since underscore→space conversion ran _after_ the suffix check, the separator was never found.
- **Fix:** Moved underscore→space conversion to step 2 (before author-suffix strip at step 3), so both `_Guide_-_James_DAmato` and `Guide - Author` patterns are handled correctly.
- **Commit:** 22459d2

## Known Stubs

None — all implementation files are complete with no stub patterns.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes were introduced beyond those declared in the plan's threat model. The T-03-02-01 (path traversal), T-03-02-02 (API key logging), and T-03-02-03 (streaming timeout) mitigations are all implemented.

## Verification Results

- `npm test -- src/main/ai/` → 37 tests passed, 0 skipped (all 4 Wave 0 stub files green)
- `npm test` (full suite) → 154 passed, 5 skipped (ai.test.ts Wave 3 stubs — plan 03-03), 0 failed
- `npm run typecheck` → exit 0
- All 4 Wave 0 stub files turned green from 28 skipped tests to 37 real passing tests

## Self-Check: PASSED

- [x] `src/main/ai/llmProvider.ts` — FOUND
- [x] `src/main/ai/retryHandler.ts` — FOUND
- [x] `src/main/ai/referenceDocLoader.ts` — FOUND
- [x] `src/main/ai/contextBuilder.ts` — FOUND
- [x] `src/main/ai/llmProvider.ts` contains `export async function streamChat(` — FOUND
- [x] `src/main/ai/llmProvider.ts` contains `createOpenAICompatible(` — FOUND
- [x] `src/main/ai/llmProvider.ts` contains `createGoogleGenerativeAI(` — FOUND
- [x] `src/main/ai/llmProvider.ts` contains `apiKey ?? 'none'` — FOUND
- [x] `src/main/ai/llmProvider.ts` contains 15000 timeout value — FOUND
- [x] `src/main/ai/retryHandler.ts` contains `export` `withRetry` — FOUND
- [x] `src/main/ai/retryHandler.ts` contains 1000/2000/4000 backoff values — FOUND
- [x] `src/main/ai/referenceDocLoader.ts` contains `export` `listReferenceDocs` and `readReferenceDocs` — FOUND
- [x] `src/main/ai/referenceDocLoader.ts` contains `startsWith` path guard — FOUND
- [x] `src/main/ai/referenceDocLoader.ts` contains 200_000 threshold — FOUND
- [x] `src/main/ai/contextBuilder.ts` contains `export` `buildContext`, `getByCampaignId`, `getLastN` — FOUND
- [x] `src/main/ai/contextBuilder.ts` contains all three strictness directive strings — FOUND
- [x] Commit f73cf8e — FOUND
- [x] Commit 22459d2 — FOUND
