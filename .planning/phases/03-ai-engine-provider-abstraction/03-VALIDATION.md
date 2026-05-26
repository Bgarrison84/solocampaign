---
phase: 3
slug: ai-engine-provider-abstraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x (already installed: `"vitest": "^2.0.0"` in devDependencies) |
| **Config file** | `vitest.config.ts` (or inline in `vite.config.ts` — verify at implementation time) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --reporter=verbose` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test -- --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-install-deps | 01 | 0 | FOUND-03 | — | N/A | compile | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 03-schema-migration | 01 | 1 | SESS-05 | — | N/A | unit | `npm test -- src/main/db/campaignsRepo.test.ts` | ❌ W0 | ⬜ pending |
| 03-messages-repo | 01 | 1 | FOUND-03 | — | N/A | unit | `npm test -- src/main/db/messagesRepo.test.ts` | ❌ W0 | ⬜ pending |
| 03-llm-provider | 02 | 2 | FOUND-03 | T-key-leak | Keys decrypted in main process only; renderer never receives key | unit | `npm test -- src/main/ai/llmProvider.test.ts` | ❌ W0 | ⬜ pending |
| 03-context-builder | 02 | 2 | SESS-06/07 | — | System prompt contains strictness directive and personality | unit | `npm test -- src/main/ai/contextBuilder.test.ts` | ❌ W0 | ⬜ pending |
| 03-retry-handler | 02 | 2 | SESS-08 | — | N/A | unit | `npm test -- src/main/ai/retryHandler.test.ts` | ❌ W0 | ⬜ pending |
| 03-ref-doc-loader | 02 | 2 | FOUND-03 | — | N/A | unit | `npm test -- src/main/ai/referenceDocLoader.test.ts` | ❌ W0 | ⬜ pending |
| 03-ai-router | 03 | 3 | SESS-05 | — | N/A | unit | `npm test -- src/main/trpc/routers/ai.test.ts` | ❌ W0 | ⬜ pending |
| 03-ipc-handler | 03 | 3 | FOUND-03 | T-key-leak | No plaintext key in ipcMain.handle context; senderFrame.url validated | unit | `npm test -- src/main/ai/llmProvider.test.ts` | ❌ W0 | ⬜ pending |
| 03-story-scroll-ui | 04 | 4 | SESS-05 | — | N/A | manual | open app, verify story scroll renders | n/a | ⬜ pending |
| 03-wizard-extension | 04 | 4 | SESS-05/06/07 | — | API key never logged or returned via tRPC | manual | create campaign, verify 3-step wizard | n/a | ⬜ pending |
| 03-gear-modal | 05 | 5 | SESS-05 | — | N/A | manual | click gear icon, verify modal pre-fills | n/a | ⬜ pending |
| 03-streaming-e2e | 05 | 5 | FOUND-03/SESS-08 | T-stream-hang | Error block shown after 3 retries; fallback swap works | manual | connect LM Studio, send message, verify stream | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/ai/llmProvider.test.ts` — stubs for FOUND-03 (mock `streamText`, verify token delivery and error path)
- [ ] `src/main/ai/contextBuilder.test.ts` — stubs for SESS-06, SESS-07 (character summary format, strictness directive, personality injection)
- [ ] `src/main/ai/retryHandler.test.ts` — stubs for SESS-08 (3 retry attempts, exponential backoff timing, final error callback)
- [ ] `src/main/ai/referenceDocLoader.test.ts` — stubs for FOUND-03 (title cleaning, path construction)
- [ ] `src/main/db/messagesRepo.test.ts` — stubs for D-17 (insert message, getLastN query, campaign cascade delete)
- [ ] Extend `src/main/db/campaignsRepo.test.ts` — add AI config update round-trip test (SESS-05)
- [ ] `src/main/trpc/routers/ai.test.ts` — stubs for listReferenceDocs and getMessages tRPC queries

*Mock provider pattern for unit tests:*
```typescript
// In llmProvider.test.ts — mock the ai module
vi.mock('ai', () => ({
  streamText: vi.fn().mockResolvedValue({
    textStream: (async function* () {
      yield 'Hello, '
      yield 'adventurer.'
    })(),
  }),
}))
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming tokens appear in story scroll in real-time | FOUND-03 | Requires live LLM endpoint; Electron IPC streaming cannot be unit-tested end-to-end | Connect LM Studio on localhost:1234; create campaign; send "Hello"; verify tokens stream into left panel |
| API key is not visible in SQLite campaigns table | FOUND-03, SESS-05 | Security property; requires DB inspection | After saving config, open SQLite with DB Browser; verify `campaigns` table has no `api_key` column |
| safeStorage warning shows on headless Linux | FOUND-03 | Requires Linux without kwallet/gnome-keyring | Run on headless Linux CI; open wizard; verify amber warning appears above API key field |
| Fallback swap works end-to-end | SESS-08 | Requires two live LLM endpoints | Configure primary (bad URL) + fallback (LM Studio); send message; verify inline error block; click Switch to fallback; verify stream resumes |
| Ctrl+Enter sends in chat panel | SESS-05 | Keyboard event testing requires rendered app | Focus textarea; press Ctrl+Enter; verify message sent |
| Gear modal saves config and new config used on next message | SESS-05/06/07 | Requires live app interaction | Click gear icon; change model name; save; send message; verify new model is called (check electron-log) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
