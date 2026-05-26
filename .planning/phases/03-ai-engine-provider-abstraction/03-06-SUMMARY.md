---
phase: 03
plan: 06
subsystem: ai-packaging-observability
tags: [ai, metrics, electron-builder, packaging, reference-docs, csp, wave-5]
dependency_graph:
  requires:
    - 03-02 (referenceDocLoader.ts — path resolution + listReferenceDocs)
    - 03-03 (ai:send-message handler in src/main/index.ts)
  provides:
    - Reference docs bundled in packaged installer via extraResources (resources/reference-docs)
    - aiMetrics.ts — logAiMetric + 5 named wrappers for AI-SPEC §7 metrics
    - ai:send-message handler wired with all 5 metrics (no key/content leak)
    - CSP connect-src documentation (Pitfall 8 / main-process-fetch limitation)
  affects:
    - electron-builder.yml
    - src/main/ai/aiMetrics.ts
    - src/main/index.ts
tech_stack:
  added: []
  patterns:
    - electron-builder extraResources with **/*.md filter (markdown only, no JPEG images)
    - aiMetrics module with named wrappers for structured [ai-metric] electron-log lines
    - Coarse error classification (timeout/network/api) — no provider body or key in log
key_files:
  created:
    - src/main/ai/aiMetrics.ts
  modified:
    - electron-builder.yml
    - src/main/index.ts
decisions:
  - extraResources "to: reference-docs" matches the packaged path in referenceDocLoader.ts (process.resourcesPath/reference-docs) — no asarUnpack needed since extraResources land outside the asar
  - logAiMetric accepts only numeric/boolean + coarse AiErrorType — function signatures make it structurally impossible to pass an API key or message content (T-03-06-01)
  - Error classification uses keyword matching on error message (includes 'time' → timeout; includes 'network'/'fetch' → network; else → api) — intentionally coarse to avoid leaking provider error body
  - logFallbackActivated fires when shouldUseFallback is true (covers both useFallback flag from renderer AND isFallbackActive from sessionFallbackMap) — supports SESS-08 reliability analysis
  - CSP connect-src left unchanged; comment documents main-process-fetch architecture so future developers do not "fix" it by adding '*' (T-03-06-02)
metrics:
  duration: ~20 minutes
  completed: 2026-05-26
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 03 Plan 06: Reference Doc Bundling, AI Metrics, and CSP Documentation Summary

**One-liner:** Reference document markdown bundled into the packaged installer via electron-builder extraResources with path matching referenceDocLoader's packaged branch, five AI-SPEC §7 metrics wired into the ai:send-message handler via a security-hardened aiMetrics module, and CSP connect-src limitation documented without weakening the renderer's network posture.

## What Was Built

### electron-builder.yml — extraResources entry

Added a new `extraResources` entry that copies all markdown files from `Reference Documents/Converted` into `resources/reference-docs` in the packaged build:

```yaml
- from: "Reference Documents/Converted"
  to: reference-docs
  filter:
    - "**/*.md"
```

The `**/*.md` filter excludes JPEG page images that would bloat the installer. The `to: reference-docs` destination matches the packaged path in `referenceDocLoader.ts` (`process.resourcesPath/reference-docs`). No `asarUnpack` entry is required because `extraResources` are copied outside the asar bundle by electron-builder automatically.

### src/main/ai/aiMetrics.ts — New File

Exports `logAiMetric(name, value, extra?)` as the core helper writing structured `[ai-metric]` electron-log lines, plus five named wrappers for call-site readability:

- `logLatencyToFirstToken(ms: number)` — `ai.stream.latency_to_first_token_ms`
- `logTokensReceived(count: number)` — `ai.stream.total_tokens_received`
- `logStreamError(errorType: AiErrorType)` — `ai.stream.error_count` with coarse type
- `logFallbackActivated()` — `ai.fallback.activated`
- `logSystemPromptLength(length: number)` — `ai.context.system_prompt_length`

Security T-03-06-01: All function signatures accept only `number`, `boolean`, or the `AiErrorType` union (`'timeout' | 'api' | 'network' | 'unknown'`). It is structurally impossible to pass an API key, URL, or message content. The module-level security comment explicitly forbids adding such parameters in future.

### src/main/index.ts — Metric Wiring + CSP Documentation

All five AI-SPEC §7 metrics are now emitted at the correct points in the `ai:send-message` handler:

1. **`logSystemPromptLength`** — called immediately after `buildContext()` returns; logs `systemPrompt.length` (character count, not content)
2. **`logFallbackActivated`** — called when `shouldUseFallback` is true (covers both explicit renderer request and session-map fallback)
3. **`logLatencyToFirstToken`** — called on first `onToken` callback; replaces the previous ad-hoc `log.info` call
4. **`logTokensReceived`** — called in `onFinish`; uses the new `tokenCount` counter (incremented per chunk in `onToken`); replaces the previous `totalContentLength` log
5. **`logStreamError`** — called in the `catch` block after all retries exhausted; coarse error type classified from error message keywords; replaces the previous `log.error` call

CSP Pitfall 8 documentation added above the `connect-src` directive: the comment explains that all provider HTTP calls are made from the main process (Node.js), the renderer never contacts providers directly, and therefore `connect-src` does not gate arbitrary user-entered LLM endpoints. The directive value is unchanged — it is NOT broadened to `*`.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 7c98b4f | chore(03-06): bundle reference docs markdown into packaged build via extraResources |
| Task 2 | 7743c9d | feat(03-06): aiMetrics module + wire AI-SPEC §7 metrics + CSP main-process-fetch comment |

## Deviations from Plan

None — plan executed exactly as written. `referenceDocLoader.ts` already used `process.resourcesPath/reference-docs` as the packaged path from plan 03-02, so no reconciliation was needed. The `app.isPackaged` approach was not required since the existing `'resourcesPath' in process` check is equivalent and already tested.

## Known Stubs

None — all implementation files are complete with no stub patterns.

## Threat Surface Scan

All mitigations in the plan's threat register are implemented:

| Threat | Mitigation Implemented |
|--------|----------------------|
| T-03-06-01 (key disclosure in metrics) | logAiMetric function signatures accept only numeric/boolean/AiErrorType — no key or content parameter exists |
| T-03-06-02 (CSP widening) | connect-src unchanged; comment explicitly documents why it must not be broadened; mainprocess-only fetch noted |
| T-03-06-03 (reference doc tampering) | Read-only design-time assets bundled via extraResources; not writable at runtime |

No new network endpoints, auth paths, file access patterns, or schema changes were introduced beyond those declared in the plan's threat model.

## Verification Results

- `npm run typecheck` → exit 0
- `npm test` (full suite) → 159 passed, 0 failed, 0 skipped
- `electron-builder.yml` contains `to: reference-docs` with `**/*.md` filter
- `electron-builder.yml` still contains `to: migrations` entry (unchanged)
- `referenceDocLoader.ts` contains `reference-docs` and `resourcesPath` (packaged path resolution unchanged)
- `aiMetrics.ts` exports `logAiMetric` + all 5 metric name strings; no `apiKey`/`key` in function signatures
- `index.ts` calls all 5 metric helpers; CSP comment contains "main process" text; connect-src is not `*`

## Self-Check: PASSED

- [x] `electron-builder.yml` contains `reference-docs` — FOUND
- [x] `electron-builder.yml` contains `to: migrations` — FOUND
- [x] `src/main/ai/referenceDocLoader.ts` contains `reference-docs` — FOUND (line 49)
- [x] `src/main/ai/referenceDocLoader.ts` contains `resourcesPath` — FOUND (line 47-49)
- [x] `src/main/ai/aiMetrics.ts` — FOUND
- [x] `src/main/ai/aiMetrics.ts` exports `logAiMetric` — FOUND
- [x] `src/main/ai/aiMetrics.ts` contains all 5 metric name strings — FOUND
- [x] `src/main/ai/aiMetrics.ts` has no `apiKey` or `key` parameter in function signatures — VERIFIED
- [x] `src/main/index.ts` calls `logLatencyToFirstToken` — FOUND
- [x] `src/main/index.ts` calls `logTokensReceived` — FOUND
- [x] `src/main/index.ts` calls `logStreamError` — FOUND
- [x] `src/main/index.ts` calls `logFallbackActivated` — FOUND
- [x] `src/main/index.ts` calls `logSystemPromptLength` — FOUND
- [x] `src/main/index.ts` CSP block contains "main process" text near connect-src — FOUND
- [x] `src/main/index.ts` connect-src is NOT `*` — VERIFIED
- [x] Commit 7c98b4f — FOUND
- [x] Commit 7743c9d — FOUND
