---
phase: 03
plan: 03
subsystem: ai-ipc-bridge
tags: [ai, ipc, streaming, trpc, preload, secret-storage, session-state, wave-2]
dependency_graph:
  requires:
    - 03-01 (schema + messagesRepo + campaignsRepo.updateAiConfig + Wave 0 stubs)
    - 03-02 (streamChat + buildContext + withRetry + listReferenceDocs)
  provides:
    - ipcMain.handle('ai:send-message') — streaming channel with key decrypt in-process
    - window.aiStream contextBridge surface (sendMessage/onToken/onFinish/onError/removeAllListeners)
    - aiSessionState.ts — in-memory fallback session map (D-19)
    - campaigns.updateAiConfig tRPC mutation (8 columns + SecretStorageService key storage)
    - ai.listReferenceDocs + ai.getMessages + ai.cancelStream tRPC queries
    - prefs.isEncryptionAvailable tRPC query
    - aiConfigSchema + sendMessageSchema Zod schemas
  affects:
    - src/main/index.ts
    - src/preload/index.ts
    - src/main/trpc/schemas.ts
    - src/main/trpc/router.ts
    - src/main/trpc/routers/ai.ts
    - src/main/trpc/routers/campaigns.ts
    - src/main/trpc/routers/prefs.ts
tech_stack:
  added: []
  patterns:
    - Custom IPC channel alongside tRPC for streaming (tRPC v10 cannot stream over contextBridge)
    - Per-request key decrypt in main process only — key never crosses IPC boundary (D-23)
    - sessionFallbackMap: in-memory Map<campaignId, boolean> for D-19 session fallback
    - ai-key-{campaignId} / ai-fallback-{campaignId} naming scheme (hyphens valid in secretKeySchema)
    - withRetry wraps streamChat — 3 attempts, 1s/2s/4s exponential backoff (D-18)
    - event.sender.send for streaming back to renderer: ai:token / ai:finish / ai:error
    - { started: true } return from ipcMain.handle (AI-SPEC Async-First Design)
key_files:
  created:
    - src/main/ai/aiSessionState.ts
    - src/main/trpc/routers/ai.ts
  modified:
    - src/main/index.ts (ipcMain.handle('ai:send-message') added after createIPCHandler)
    - src/preload/index.ts (window.aiStream contextBridge surface)
    - src/main/trpc/schemas.ts (aiConfigSchema + sendMessageSchema)
    - src/main/trpc/router.ts (ai: aiRouter registration)
    - src/main/trpc/routers/campaigns.ts (updateAiConfig mutation)
    - src/main/trpc/routers/prefs.ts (isEncryptionAvailable query)
    - src/main/trpc/routers/ai.test.ts (Wave 0 stubs turned green)
decisions:
  - Key naming scheme (D-08 Claude's discretion): 'ai-key-{campaignId}' (primary) and 'ai-fallback-{campaignId}' (fallback). Campaign UUIDs use hyphens which are valid in [a-zA-Z0-9_.-]. Lengths 43 and 47 chars — within 64-char max in secretKeySchema.
  - sessionFallbackMap exports an accessor bundle rather than the raw Map — prevents external mutation bypassing clearFallback cleanup path
  - ai:error payload uses { message: genericMessage } object to the renderer — no stack trace, no key, no provider response body (T-03-03-04)
  - cancelStream tRPC mutation clears the fallback state for a campaign rather than introducing a separate 'useSessionPrimary' concept
  - aiConfigSchema uses z.string().url().optional() for endpointUrl (validates URL format when present, allows undefined for Gemini where no URL is needed)
  - Wave 0 ai.test.ts stubs rewritten as 5 real tests with mocked filesystem + DB dependencies
metrics:
  duration: ~30 minutes
  completed: 2026-05-26
  tasks_completed: 2
  files_created: 2
  files_modified: 7
---

# Phase 03 Plan 03: tRPC AI Router, IPC Streaming Channel, preload contextBridge Summary

**One-liner:** Custom `ai:send-message` IPC handler decrypts keys in-process and streams tokens to renderer via `event.sender.send`, with `window.aiStream` contextBridge surface, `campaigns.updateAiConfig` storing keys via SecretStorageService, and full tRPC ai/prefs router surface.

## What Was Built

### aiSessionState.ts
- `sessionFallbackMap` with `setFallbackActive(campaignId)`, `isFallbackActive(campaignId)`, `clearFallback(campaignId)`
- In-memory only `Map<string, boolean>` — cleared on app restart (D-19)
- Accessor bundle pattern prevents external raw Map mutation

### Zod Schemas (schemas.ts)
- `aiConfigSchema` (AI-SPEC §4b): campaignId uuid, providerType enum, endpointUrl url optional, modelName min(1), apiKey optional, dmPersonality max(2000) optional, strictness enum default 'balanced', referenceDocs array default [], fallbackEndpointUrl/fallbackModelName/fallbackApiKey optional
- `sendMessageSchema` (AI-SPEC §4b): campaignId uuid, content min(1) max(10000) — used at the IPC boundary

### ai tRPC Router (routers/ai.ts)
- `listReferenceDocs`: calls `referenceDocLoader.listReferenceDocs()`, returns `{relativePath, title, isLarge}[]` — omits sizeBytes
- `getMessages`: `messagesRepo.getLastN(campaignId, 200)` — full history per D-16
- `cancelStream`: clears sessionFallbackMap for a campaign, returns `{cancelled: true}`
- No decrypt calls anywhere in this router — D-23 enforced

### campaigns.updateAiConfig Mutation (routers/campaigns.ts)
- Persists 8 non-secret columns via `campaignsRepo.updateAiConfig`
- Primary key: if apiKey non-empty → `secretStorage.encrypt('ai-key-' + campaignId)`; if empty string → `secretStorage.remove('ai-key-' + campaignId)`; if undefined → leave untouched
- Same logic for `fallbackApiKey` → `'ai-fallback-' + campaignId`
- Returns `campaignsRepo.get(campaignId)` — no key columns (D-23)

### prefs.isEncryptionAvailable Query (routers/prefs.ts)
- Calls `secretStorage.isSecure()` — checks BOTH `isEncryptionAvailable()` AND backend !== 'basic_text'
- Backs the D-24 headless-Linux warning in the AI config wizard

### Router Registration (router.ts)
- `ai: aiRouter` registered alongside existing campaigns/characters/content/prefs/secrets/window routers

### ipcMain.handle('ai:send-message') (index.ts)
Registered AFTER `createIPCHandler()` per RESEARCH.md Pattern 1 constraint:
1. **senderFrame validation** (T-03-03-02): same file://|app://|dev-http://localhost: allow-list as createIPCHandler
2. **Zod parse** (T-03-03-03): `sendMessageSchema.parse(payload)` — validates campaignId (uuid) + content (max 10000)
3. **Provider selection**: checks `sessionFallbackMap.isFallbackActive` + `useFallback` flag; loads campaign from DB; decrypts key via `secretStorage.decrypt('ai-key-{id}')` or `ai-fallback-{id}` in main process (D-23)
4. **Persist user message**: `messagesRepo.insert({campaignId, role:'user', content})`
5. **Context assembly**: `buildContext({campaignId, config})` → `{systemPrompt, messages}`
6. **Stream with retry**: `withRetry(() => streamChat(config, messages, systemPrompt, {...}), {maxAttempts:3, baseDelayMs:1000})`
   - `onToken`: accumulates buffer + `event.sender.send('ai:token', chunk)`
   - `onFinish`: `messagesRepo.insert({role:'assistant', content:buffer})` + `event.sender.send('ai:finish')`
   - `onError`: re-throws so withRetry catches and retries
7. **After final failure**: `event.sender.send('ai:error', {message: genericMessage})` (T-03-03-04: no stack/key/body)
8. **AI-SPEC §7 metrics**: latency_to_first_token_ms logged via electron-log; errorCount tracked
9. **Returns** `{started: true}` (AI-SPEC §3 Async-First Design)

### window.aiStream contextBridge (preload/index.ts)
- `sendMessage(payload)`: `ipcRenderer.invoke('ai:send-message', payload)` — returns `{started: true}`
- `onToken(cb)`: `ipcRenderer.on('ai:token', ...)` — receives batched token chunks
- `onFinish(cb)`: `ipcRenderer.on('ai:finish', ...)`
- `onError(cb)`: `ipcRenderer.on('ai:error', ...)` — normalizes `{message}` object and plain string
- `removeAllListeners()`: removes all three channels (Pitfall 2 guard — must call in useEffect cleanup)

### Test Coverage
- `ai.test.ts` Wave 0 stubs turned green: 5 real tests covering listReferenceDocs (returns docs, flags large, omits sizeBytes), getMessages (returns messages, empty for unknown campaign), cancelStream (clears fallback state)
- Full suite: 159 tests passing, 0 failing, 0 skipped

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 92d375f | feat(03-03): Zod schemas, ai router, updateAiConfig, isEncryptionAvailable, router registration |
| Task 2 | bb7241f | feat(03-03): ai:send-message IPC streaming handler + window.aiStream preload surface |

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first attempt. The aiSessionState.ts module was created as part of Task 1 (it was referenced from the ai router's cancelStream mutation) and the plan listed it as a Task 2 concern — treated as aligned since both tasks were completed sequentially and the file was needed for both.

## Known Stubs

None — all implementation files are complete with no stub patterns.

## Threat Surface Scan

All mitigations in the plan's threat register are implemented:

| Threat | Mitigation Implemented |
|--------|----------------------|
| T-03-03-01 (key leak) | apiKey decrypted via secretStorage.decrypt() in main process; never passed to event.sender.send; never logged (only length/latency metrics logged) |
| T-03-03-02 (IPC spoofing) | senderFrame.url validated against file://, app://, dev http://localhost: before any payload processing |
| T-03-03-03 (streaming injection) | sendMessageSchema.parse validates campaignId (uuid) + content (max 10000) before any DB/LLM op |
| T-03-03-04 (error disclosure) | ai:error payload is genericMessage string — no stack trace, provider response body, or key |

No new network endpoints, auth paths, file access patterns, or schema changes were introduced beyond those declared in the plan's threat model.

## Verification Results

- `npm test -- src/main/trpc/routers/ai.test.ts` → 5 tests passed
- `npm test` (full suite) → 159 tests passed, 0 failed, 0 skipped
- `npm run typecheck` → exit 0
- `ipcMain.handle('ai:send-message')` registered at line 154, after `createIPCHandler` at line 127
- `window.aiStream` surface exposes sendMessage/onToken/onFinish/onError/removeAllListeners
- `campaigns.updateAiConfig` contains literal key prefixes 'ai-key-' and 'ai-fallback-'; contains `secretStorage.encrypt`; does NOT contain any `secretStorage.decrypt` or `.get` call
- `prefs.isEncryptionAvailable` calls `secretStorage.isSecure()`
- `src/main/trpc/router.ts` registers `ai:` router

## Self-Check: PASSED

- [x] `src/main/ai/aiSessionState.ts` — FOUND
- [x] `src/main/trpc/routers/ai.ts` exports `aiRouter` with listReferenceDocs + getMessages + cancelStream — FOUND
- [x] `src/main/trpc/schemas.ts` contains aiConfigSchema and sendMessageSchema — FOUND
- [x] `src/main/trpc/routers/campaigns.ts` contains `updateAiConfig`, 'ai-key-', 'ai-fallback-', secretStorage.encrypt — FOUND
- [x] `src/main/trpc/routers/campaigns.ts` does NOT contain secretStorage.decrypt — VERIFIED
- [x] `src/main/trpc/routers/prefs.ts` contains isEncryptionAvailable — FOUND
- [x] `src/main/trpc/router.ts` registers `ai:` aiRouter — FOUND
- [x] `src/main/index.ts` contains ipcMain.handle('ai:send-message') after createIPCHandler — FOUND (line 154 > line 127)
- [x] `src/main/index.ts` contains senderFrame.url validation inside the ai:send-message handler — FOUND
- [x] `src/main/index.ts` contains sendMessageSchema.parse, secretStorage.decrypt, buildContext, streamChat, two messagesRepo.insert calls — FOUND
- [x] `src/main/index.ts` sends ai:token, ai:finish, ai:error; returns { started: true } — FOUND
- [x] `src/preload/index.ts` exposes aiStream with sendMessage/onToken/onFinish/onError/removeAllListeners — FOUND
- [x] Commit 92d375f — FOUND
- [x] Commit bb7241f — FOUND
