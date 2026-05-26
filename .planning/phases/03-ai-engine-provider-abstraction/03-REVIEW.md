---
phase: 03-ai-engine-provider-abstraction
reviewed: 2026-05-26T15:38:02Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - components.json
  - electron-builder.yml
  - package.json
  - src/main/ai/aiMetrics.ts
  - src/main/ai/aiSessionState.ts
  - src/main/ai/contextBuilder.ts
  - src/main/ai/llmProvider.ts
  - src/main/ai/referenceDocLoader.ts
  - src/main/ai/retryHandler.ts
  - src/main/db/campaignsRepo.ts
  - src/main/db/messagesRepo.ts
  - src/main/db/schema.ts
  - src/main/index.ts
  - src/main/trpc/router.ts
  - src/main/trpc/routers/ai.ts
  - src/main/trpc/routers/campaigns.ts
  - src/main/trpc/routers/prefs.ts
  - src/main/trpc/schemas.ts
  - src/preload/index.ts
  - src/renderer/src/components/AiProviderFields.tsx
  - src/renderer/src/components/AiSettingsModal.tsx
  - src/renderer/src/components/ChatErrorBlock.tsx
  - src/renderer/src/components/ChatInputArea.tsx
  - src/renderer/src/components/CreateCampaignModal.tsx
  - src/renderer/src/components/ReferenceDocSelect.tsx
  - src/renderer/src/components/StoryScrollPanel.tsx
  - src/renderer/src/hooks/useAiStream.ts
  - src/renderer/src/screens/CampaignViewScreen.tsx
  - src/renderer/src/types/aiStream.d.ts
findings:
  critical: 6
  warning: 6
  info: 3
  total: 15
status: critical_fixed
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-26T15:38:02Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

This review covers the Phase 3 AI engine and provider abstraction implementation across 29 files. The architecture is sound — IPC surface is narrow, API keys are handled via safeStorage and never passed through the renderer, context isolation and sandboxing are enabled, and the Zod validation layer is thorough at IPC boundaries.

However, six blockers were identified. Two are correctness crashes: a null-dereference when `buildModel` is called with a Gemini config but no `endpointUrl`, and a stream cancellation mechanism that is wired to the wrong abstraction and does not actually cancel the running stream. Two blockers involve type mismatches that corrupt data at runtime: the `onError` callback type is `string` in the preload but the hook expects `{ message: string }`, and `referenceDocs` is returned from the database as a JSON string but the UI treats it as a pre-parsed array. Two blockers involve incomplete error containment in the streaming hot path.

---

## Critical Issues

### CR-01: `buildModel` crashes with non-null assertion on `endpointUrl` for Gemini provider ✓ FIXED (c62d97f)

**File:** `src/main/ai/llmProvider.ts:49`
**Issue:** `buildModel` has a non-null assertion `config.endpointUrl!` on the last line of the `openai-compatible` branch, but the Gemini path exits early at line 44. The problem is that the fallback provider config in `src/main/index.ts:214` always uses `campaign.providerType` for the fallback provider type — even when that type is `'gemini'`. If a user has `providerType: 'gemini'` and configures a fallback, the fallback config will be constructed with `type: 'gemini'` but `endpointUrl: campaign.fallbackEndpointUrl` (an URL that only makes sense for openai-compatible). Conversely, if `providerType` is `'openai-compatible'` and `endpointUrl` is `null` or `undefined` in the DB (the column is nullable per schema.ts line 14), `config.endpointUrl!` will forcibly pass `undefined` as a string to `createOpenAICompatible`, causing an SDK-level failure or throwing inside the provider at runtime. The `!` operator suppresses TypeScript's safety check but does not guarantee a non-null value.

**Fix:**
```typescript
// In llmProvider.ts buildModel():
const openai = createOpenAICompatible({
  name: 'custom',
  baseURL: config.endpointUrl ?? (() => { throw new Error('endpointUrl is required for openai-compatible provider') })(),
  apiKey: config.apiKey ?? 'none',
})

// In index.ts, when providerType is 'gemini', the fallback type must default to 'openai-compatible'
// because fallback is always URL-based. Or: store fallback provider type separately.
// Minimal fix: validate endpointUrl before calling streamChat:
if (providerConfig.type === 'openai-compatible' && !providerConfig.endpointUrl) {
  event.sender.send('ai:error', { message: 'No endpoint URL configured for this provider.' })
  return { started: false }
}
```

---

### CR-02: `cancelStream` tRPC procedure does not cancel the running stream ✓ FIXED (0c33f5f)

**File:** `src/main/trpc/routers/ai.ts:54-59`
**Issue:** The `cancelStream` procedure only calls `sessionFallbackMap.clearFallback(campaignId)`. There is no `AbortController` or any mechanism to interrupt the `streamText` call or the `for await` loop in `llmProvider.ts`. Calling `cancelStream` clears the fallback flag but the active `streamText` loop in the main process continues running, consuming AI provider quota, appending tokens to `assistantBuffer`, and calling `event.sender.send('ai:token', ...)` on a potentially dead or re-navigated renderer WebContents. The docstring says "cancel the active stream" but the implementation cannot fulfil that contract.

**Fix:**
```typescript
// Keep a per-campaign AbortController in main process state:
const activeAborts = new Map<string, AbortController>()

// In the send handler, before streamChat:
const abortController = new AbortController()
activeAborts.set(campaignId, abortController)

// Pass signal to streamText:
const result = await streamText({
  model,
  system: systemPrompt,
  messages,
  temperature: 0.8,
  abortSignal: abortController.signal,
})

// In cancelStream:
cancelStream: t.procedure
  .input(z.object({ campaignId: campaignIdSchema }))
  .mutation(({ input }) => {
    activeAborts.get(input.campaignId)?.abort()
    activeAborts.delete(input.campaignId)
    sessionFallbackMap.clearFallback(input.campaignId)
    return { cancelled: true }
  }),
```

---

### CR-03: `onError` callback type mismatch between preload, type declaration, and hook ✓ FIXED (13db955)

**File:** `src/preload/index.ts:57` / `src/renderer/src/types/aiStream.d.ts:47` / `src/renderer/src/hooks/useAiStream.ts:58`
**Issue:** There is a three-way type inconsistency that causes a runtime crash.

- `preload/index.ts:57` declares `onError: (cb: (msg: string) => void)` — the callback receives a `string`.
- `aiStream.d.ts:47` declares `onError(cb: (err: { message: string }) => void)` — the callback receives an object.
- `useAiStream.ts:58` calls `window.aiStream.onError((err: { message: string }) => { setError({ message: err.message }) })` — reads `err.message`.

When the preload passes the raw string `m` (after the `typeof m === 'object' ? m.message : m` normalization), the hook receives a `string`, not an object. Accessing `.message` on a string returns `undefined`, so `setError({ message: undefined })` is called. The `ChatErrorBlock` then renders `undefined` as the body text. TypeScript does not catch this because the `.d.ts` declaration says the callback receives an object, matching the hook, while the preload's runtime signature disagrees.

**Fix:** Pick one contract and apply it consistently. The cleanest fix is to make the preload always call the callback with an object:
```typescript
// preload/index.ts
onError: (cb: (err: { message: string }) => void) => {
  ipcRenderer.on('ai:error', (_, m) => {
    const message = typeof m === 'object' && m !== null ? String(m.message ?? m) : String(m)
    cb({ message })
  })
},
```

---

### CR-04: `referenceDocs` returned from DB as JSON string, UI treats it as array — silent data loss ✓ FIXED (98572c5)

**File:** `src/renderer/src/components/AiSettingsModal.tsx:83` / `src/main/db/schema.ts:15`
**Issue:** `campaigns.referenceDocs` is stored as a `text` column (JSON string, e.g. `'["foo","bar"]'`). The tRPC `campaigns.get` procedure returns the raw `Campaign` row with `referenceDocs: string`. In `AiSettingsModal.tsx:83`:
```typescript
referenceDocs: Array.isArray(campaign.referenceDocs) ? campaign.referenceDocs : [],
```
`Array.isArray(string)` is always `false`. The pre-fill branch always falls through to `[]`, silently discarding the user's saved reference doc selections every time the AI settings modal is opened. The user re-selects their documents, saves, and the setting appears to persist — but the next time the modal opens it is wiped again.

The same issue exists in `CampaignViewScreen.tsx:194`:
```typescript
hasFallback={!!(campaignQuery.data?.fallbackEndpointUrl)}
```
is fine, but `campaignQuery.data.referenceDocs` anywhere in the renderer would have the same problem.

**Fix:** Parse `referenceDocs` on the way out of tRPC, either in the `campaigns.get` procedure or in a transformer:
```typescript
// In campaignsRouter.get (or a shared mapper):
get: t.procedure
  .input(z.object({ id: campaignIdSchema }))
  .query(({ input }) => {
    const campaign = campaignsRepo.get(input.id)
    if (!campaign) return undefined
    return {
      ...campaign,
      referenceDocs: JSON.parse(campaign.referenceDocs ?? '[]') as string[],
    }
  }),
```
Alternatively, apply `JSON.parse` in `AiSettingsModal` when `typeof campaign.referenceDocs === 'string'`.

---

### CR-05: `assistantBuffer` is never reset between retries — duplicate content on retry ✓ FIXED (c62d97f)

**File:** `src/main/index.ts:269` and `src/main/index.ts:287`
**Issue:** `assistantBuffer` is initialised once before `withRetry(...)`. If the first attempt streams 200 tokens and then errors, `assistantBuffer` contains those 200 tokens. The second retry calls `streamChat` fresh, and on success, `onFinish` calls `messagesRepo.insert` with `assistantBuffer` that includes the partial tokens from attempt 1 prepended to the full tokens from attempt 2. The persisted assistant message is therefore duplicated/corrupted.

Separately, `event.sender.send('ai:token', chunk)` is called inside `withRetry` on every attempt. If the stream partially succeeds on attempt 1 then retries, the renderer receives tokens from both attempts. The streaming display shows duplicated content.

**Fix:** Reset `assistantBuffer` and notify the renderer at the start of each retry:
```typescript
await withRetry(
  () => {
    assistantBuffer = ''                           // reset before each attempt
    tokenCount = 0
    // Optionally: event.sender.send('ai:retry')  // renderer clears streamingContent
    return streamChat(providerConfig, messages, systemPrompt, { ... })
  },
  { maxAttempts: 3, baseDelayMs: 1000 },
)
```

---

### CR-06: `event.sender.send` called after renderer WebContents may be destroyed ✓ FIXED (c62d97f)

**File:** `src/main/index.ts:283,290,315`
**Issue:** The `ai:send-message` handler is `async` and can take many seconds (up to 3 retries × 15s timeout = 45+ seconds). During that time the user can navigate away, close the campaign, or the window can be closed. When `event.sender.send('ai:token', chunk)` executes on a destroyed WebContents, Electron throws an unhandled error in the main process: `"Error: Object has been destroyed"`. This can crash the IPC handler loop. The `mainWindow.isDestroyed()` check at line 138 applies only to `boundsStore.set`, not to the streaming callback.

**Fix:**
```typescript
// Add a guard helper:
function safeSend(sender: Electron.WebContents, channel: string, ...args: unknown[]): void {
  if (!sender.isDestroyed()) {
    sender.send(channel, ...args)
  }
}

// Replace all event.sender.send in the streaming callbacks:
onToken: (chunk) => {
  // ...
  safeSend(event.sender, 'ai:token', chunk)
},
onFinish: () => {
  messagesRepo.insert({ campaignId, role: 'assistant', content: assistantBuffer })
  logTokensReceived(tokenCount)
  safeSend(event.sender, 'ai:finish')
},
// and in the catch block:
safeSend(event.sender, 'ai:error', { message: genericMessage })
```

---

## Warnings

### WR-01: `log.initialize()` called after the entire app bootstrap has already run

**File:** `src/main/index.ts:349`
**Issue:** `log.initialize()` appears at the very bottom of the file, after the `app.whenReady()` block, `app.on('window-all-closed')`, and `app.on('activate')` handlers are registered. According to `electron-log` documentation, `initialize()` must be called before any log statements to ensure the log transport is wired up. Any `log.error(...)` or `log.info(...)` call that executes during the `app.whenReady()` async block (e.g. DB init error at line 47, secret storage init at line 62) would fire before the logger is initialised.

**Fix:** Move `log.initialize()` to the very top of the file, before any other code:
```typescript
import log from 'electron-log'
log.initialize()  // Must be before app.whenReady() and any log.*() calls
log.info('[main] SoloCampaign starting up')
```

---

### WR-02: Fallback provider always inherits primary `providerType`, breaking Gemini-primary + OpenAI-compatible-fallback combination

**File:** `src/main/index.ts:214`
**Issue:** The fallback `providerConfig.type` is always set to `campaign.providerType`. If the user has `providerType: 'gemini'` as their primary, the fallback is also tagged as `'gemini'`. But the fallback fields (`fallbackEndpointUrl`, `fallbackModelName`) only make sense for `openai-compatible`. A Gemini-primary user cannot configure an OpenAI-compatible fallback endpoint. The `buildModel` function will attempt to construct a Google provider using `fallbackEndpointUrl` as the model name — undefined behaviour.

There is no separate `fallbackProviderType` column in the schema. The schema and UI implicitly assume the fallback is always OpenAI-compatible (it only stores `fallbackEndpointUrl` and `fallbackModelName`, no `fallbackProviderType`). The code should either document and enforce this constraint or add a `fallbackProviderType` column.

**Fix (minimal):** Hard-code the fallback to `'openai-compatible'` in the IPC handler, matching the schema's intent:
```typescript
providerConfig = {
  type: 'openai-compatible',  // fallback is always URL-based
  endpointUrl: campaign.fallbackEndpointUrl,
  modelName: campaign.fallbackModelName,
  apiKey,
}
```

---

### WR-03: Gemini validation bypassed when `keepExistingKeyMode` is true in the settings modal

**File:** `src/renderer/src/components/AiProviderFields.tsx:94-96`
**Issue:** `validateAiProviderFields` always rejects Gemini configs where `apiKey` is empty. In `AiSettingsModal`, when editing an existing Gemini campaign, the `apiKey` field is always initialised to `''` (D-23: write-only keys). The `isValid` guard at line 136 will therefore always be `false` for Gemini campaigns in the settings modal, permanently disabling the "Save Changes" button. Users can never update DM personality, strictness, or model name for a Gemini campaign without re-entering their API key.

The wizard does not have this bug because the key is required on first creation. The bug is specific to the gear-modal path.

**Fix:** Extend the validation signature to accept a `keepExistingKeyMode` flag, and skip the Gemini key requirement when the mode is active:
```typescript
export function validateAiProviderFields(
  value: AiProviderValue,
  opts?: { keepExistingKeyMode?: boolean }
): Partial<Record<keyof AiProviderValue, string>> {
  const errors: Partial<Record<keyof AiProviderValue, string>> = {}
  if (value.providerType === 'gemini') {
    if (!opts?.keepExistingKeyMode && !value.apiKey.trim()) {
      errors.apiKey = 'Enter your Gemini API key from Google AI Studio.'
    }
    // ...
  }
}
```

---

### WR-04: Path traversal guard uses string prefix check that fails on case-insensitive Windows filesystems

**File:** `src/main/ai/referenceDocLoader.ts:195`
**Issue:** The path traversal guard is:
```typescript
if (!resolved.startsWith(root + path.sep) && resolved !== root) {
```
On Windows, `path.resolve` normalises paths to lowercase or uppercase depending on the input casing. A crafted `relPath` like `../../../Windows/System32/drivers/etc/hosts` would be blocked. However, a path like `..\..\..\Windows\...` with mixed separators might not be normalised consistently before the `startsWith` check on some Windows builds where `path.resolve` preserves mixed-case. More critically: `root` itself is derived from `__dirname` (dev) or `process.resourcesPath` (packaged), which may or may not be lowercased. On a case-insensitive NTFS volume, `C:\Users\X\AppData\reference-docs\foo` and `c:\users\x\appdata\reference-docs\foo` compare as different strings even though they refer to the same file.

**Fix:** Normalise both paths to the same case before comparison on Windows:
```typescript
const normalise = (p: string) =>
  process.platform === 'win32' ? p.toLowerCase() : p

if (!normalise(resolved).startsWith(normalise(root) + path.sep) && normalise(resolved) !== normalise(root)) {
  log.warn('[referenceDocLoader] Blocked path traversal attempt:', relPath)
  continue
}
```

---

### WR-05: `createCampaignModal` orphans a campaign row if `updateAiConfig` fails mid-wizard

**File:** `src/renderer/src/components/CreateCampaignModal.tsx:148-163`
**Issue:** `handleSubmit` calls `createMutation.mutateAsync` (creates the campaign row) then `updateAiConfigMutation.mutateAsync`. If `updateAiConfig` throws (e.g., network error, safeStorage failure), the campaign row exists in the database but has no AI provider configured. The `catch {}` block at line 168 suppresses the error with no rollback. The user sees the error message and can retry, but each retry will call `createMutation.mutateAsync` again and create another orphan campaign row, because the `try` block does not check if `createMutation.data` is already set from a prior attempt.

**Fix:** Hoist the campaign creation step outside the inner try-catch and only execute it once. On retry, skip campaign creation if `createMutation.data` is already set:
```typescript
const handleSubmit = useCallback(async () => {
  if (isSubmitting) return
  try {
    // Only create if not already created (idempotent retry)
    const campaign = createMutation.data ?? await createMutation.mutateAsync({ name: trimmedName })
    await updateAiConfigMutation.mutateAsync({ campaignId: campaign.id, ... })
    queryClient.invalidateQueries(...)
    onClose()
    navigate(`/campaign/${campaign.id}`)
  } catch {
    // error displayed via mutation.error
  }
}, [...])
```

---

### WR-06: `ai` package version is v6 but CLAUDE.md spec says v4

**File:** `package.json:50`
**Issue:** `package.json` pins `"ai": "^6.0.191"` and uses `ModelMessage` (the v6 rename of `CoreMessage`). The CLAUDE.md technology stack explicitly specifies `"Vercel AI SDK (ai) — 4.x"`. The `@ai-sdk/google` package is `^3.0.79` and `@ai-sdk/openai-compatible` is `^2.0.48`. These minor-version providers are generally backwards-compatible but the core `ai` package at v6 is a major version ahead of the spec. This creates a risk that AI-SPEC features documented for v4 semantics (tool calling schema, streaming events, token counting) may behave differently. The mismatch should be intentional and documented.

**Fix:** Either update CLAUDE.md to reflect the actual `ai@6` dependency, or pin `"ai": "^4.x"` and update imports (`CoreMessage` instead of `ModelMessage`). If v6 was intentionally chosen, document why in the research notes and update CLAUDE.md.

---

## Info

### IN-01: Duplicate `cleanTitle` implementation in renderer and main process

**File:** `src/renderer/src/components/ReferenceDocSelect.tsx:25-46` / `src/main/ai/referenceDocLoader.ts:73-117`
**Issue:** `cleanTitle` is implemented twice with slightly different logic. The renderer version does not include the "replace hyphens with spaces" step (step 5 in the main process version), so `solo-adventurerx27s-guide` would render as `"Solo Adventurerx27S-Guide"` in the renderer but as `"Solo Adventurer's Guide"` in the main process system prompt. The title shown in the UI will differ from the title injected into the AI context.

**Fix:** Move the canonical `cleanTitle` function to a shared utility module (e.g. `src/shared/referenceDocUtils.ts`) imported by both `referenceDocLoader.ts` and `ReferenceDocSelect.tsx`. Alternatively expose it through the tRPC `listReferenceDocs` response (which already includes `title` cleaned by the main-process version), and remove the renderer-side duplicate.

---

### IN-02: `cancelStream` docstring says "cancel active AI stream" but it only clears fallback state

**File:** `src/main/trpc/routers/ai.ts:50-58`
**Issue:** The comment at line 9 says `cancelStream: in-memory cancellation signal for the active AI stream`. The implementation only calls `sessionFallbackMap.clearFallback()`. This misleads future developers about what the procedure actually does and can cause debugging confusion. This is a documentation defect tied to CR-02.

**Fix:** Once CR-02 is resolved with an `AbortController`, update the comment to accurately describe both abort and fallback-clear. Until then, rename the procedure or update the comment to say it only clears fallback state.

---

### IN-03: `activate` handler on macOS is a no-op with a comment but no implementation

**File:** `src/main/index.ts:341-344`
**Issue:**
```typescript
app.on('activate', () => {
  if (!mainWindow) {
    // Re-create window on macOS
  }
})
```
The comment says "Re-create window on macOS" but the body is empty. On macOS, clicking the dock icon when all windows are closed should re-create the window (standard macOS behaviour). As written, nothing happens and the app cannot be recovered from a closed window without quitting and relaunching.

**Fix:**
```typescript
app.on('activate', () => {
  // On macOS re-create a window when the dock icon is clicked and no windows are open
  // (standard macOS multi-lifecycle pattern)
  // TODO: extract window-creation logic into a createWindow() helper and call it here
})
```
The full fix requires extracting window creation into a `createWindow()` function, but a descriptive TODO is better than a silent no-op.

---

_Reviewed: 2026-05-26T15:38:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
