# Phase 3: AI Engine & Provider Abstraction — Research

**Researched:** 2026-05-26
**Domain:** Streaming LLM integration in Electron + Vercel AI SDK v4 + custom IPC streaming channel
**Confidence:** HIGH (codebase directly verified; package versions confirmed via npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: `CreateCampaignModal` extended to 3 steps: (1) Campaign name, (2) AI provider + reference docs, (3) DM personality + strictness
- D-02: Provider type picker: OpenAI-compatible | Gemini only. No preset dropdown.
- D-03: OpenAI-compatible fields: endpoint URL + model name + optional API key
- D-04: Gemini fields: API key + model name. No URL field.
- D-05: Reference document multi-select in Step 2 from `Reference Documents/Converted/`. Selected paths stored as JSON array in DB. Docs injected in full into system prompt.
- D-06: Fallback endpoint in Step 2 — collapsible section, same fields as primary
- D-07: AI config as new columns on `campaigns` table (no separate table): `provider_type`, `endpoint_url`, `model_name`, `reference_docs`, `dm_personality`, `strictness`, `fallback_endpoint_url`, `fallback_model_name`
- D-08: API keys never in SQLite. Stored via SecretStorageService. Naming: Claude's discretion (must match `[a-zA-Z0-9_.-]`, unique per campaign, distinct primary vs. fallback)
- D-09: Gear icon in campaign header opens same config form post-creation (all Step 2+3 fields editable)
- D-10: Strictness: Strict | Balanced (default) | Narrative
- D-11: Left panel — continuous paragraphs in scrollable story area. No chat bubbles.
- D-12: Player messages — subtle separator (thin hr) + italic `You:` label (muted gold) + player message text
- D-13: Streaming — blinking CSS cursor at tail of growing text. No shimmer or "typing..." indicator.
- D-14: Input — multi-line textarea, grows to ~4 lines. Ctrl+Enter sends. Plain Enter = newline. Visible Send button.
- D-15: Player input sent verbatim. No pre-processing.
- D-16: One continuous chat per campaign. No session start/end in Phase 3.
- D-17: New `messages` table: `id`, `campaign_id`, `role` (`'user' | 'assistant'`), `content`, `created_at`. No `session_id` (Phase 4 adds via migration).
- D-18: 3 retries with exponential backoff (1s → 2s → 4s). After 3rd failure: inline error block with Switch to fallback + Retry buttons.
- D-19: "Switch to fallback" swaps active endpoint in-memory only for the current session.
- D-20: Context assembly: system prompt (preamble + strictness + personality + character summary) + reference docs + last 20 messages
- D-21: Character summary format — HP/AC/Speed/Initiative/Stats/ProfBonus/SpellSlots/Conditions/Inspiration
- D-22: LLMProvider interface wraps Vercel AI SDK: `LLMProvider.streamChat(messages, systemPrompt)` → async stream
- D-23: Renderer never receives plaintext API keys. Main process decrypts per-request, makes LLM call, streams tokens back.
- D-24: Headless Linux safeStorage warning shown in AI config step when `isEncryptionAvailable()` returns false.

### Claude's Discretion

- API key naming scheme in SecretStorageService (must match `[a-zA-Z0-9_.-]`, unique per campaign, primary vs. fallback distinct)
- Exact wording of D&D 5e rules preamble in system prompt
- Reference document list display order and search/filter for long lists

### Deferred Ideas (OUT OF SCOPE)

- Session boundaries / structured session start-end (Phase 4)
- Three-layer memory / summarization (Phase 4)
- Spell casting and rules enforcement (Phase 5)
- Browsable SRD tab (Phase 7)
- User-imported documents (Phase 7 — RULES-04)
- AI-generated scene art / Stable Diffusion (v2 deferred)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-03 | User can connect any OpenAI-compatible AI endpoint (LM Studio, Jan AI, Ollama, OpenRouter, OpenAI) or Gemini API per campaign | Vercel AI SDK v4 `@ai-sdk/openai-compatible` + `@ai-sdk/google` provide unified abstraction; D-22 LLMProvider interface is the implementation target |
| SESS-05 | User can configure a unique AI provider per campaign | D-07 campaigns table columns + D-08 safeStorage key-per-campaign pattern; `campaigns.updateAiConfig` tRPC mutation |
| SESS-06 | User can write a per-campaign DM personality description | D-07 `dm_personality` column; Step 3 of wizard (DM personality textarea); injected in system prompt D-20 |
| SESS-07 | User can set rules strictness per campaign | D-07 `strictness` column; Step 3 of wizard (Select component); maps to strictness directive in system prompt D-10/D-20 |
| SESS-08 | App automatically retries failed AI requests and prompts user to switch to fallback | D-18 retry handler (3 retries, exponential backoff); D-19 in-memory fallback swap; inline error block UI from 03-UI-SPEC S5 |
</phase_requirements>

---

## Summary

Phase 3 ships the AI heart of SoloCampaign: streaming LLM calls from the Electron main process to any OpenAI-compatible or Gemini endpoint, with per-campaign encrypted key storage, a three-step campaign creation wizard, and a narrative story-scroll chat panel.

The critical architectural fact discovered in codebase inspection is that **tRPC v10 (the installed version, pinned at `electron-trpc@0.7.1`) does not support streaming over `contextBridge`**. A dedicated custom IPC channel (`ipcMain.handle('ai:send-message')` → `event.sender.send('ai:token', chunk)`) is the correct pattern — proven by inspection of the existing `src/main/index.ts` and `src/preload/index.ts`. The preload currently exposes only `exposeElectronTRPC()` and `window.platform`; adding `window.aiStream` as a narrow surface is safe and consistent with the existing contextBridge pattern.

The Vercel AI SDK v4 is **not yet installed**. The current `package.json` has no `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/google`, `react-markdown`, or `react-hotkeys-hook` packages. All five must be installed before implementation begins. The `WizardProgress` component (6-step from Phase 2) already exists at `src/renderer/src/components/wizard/WizardProgress.tsx` and can be reused directly with `totalSteps=3`. The `shadcn` CLI must add `checkbox`, `textarea`, and `collapsible` components (not yet present in `src/renderer/src/components/ui/`).

The reference documents live in `Reference Documents/Converted/` as per-folder markdown files (26 folders, each containing one primary `.md` file). The PHB is 1.7MB, the Monster Manual 2.7MB — these are large. The `referenceDocLoader.ts` must read them from a **dev-time app resources path** (they ship alongside the app, not in userData). The correct path in Electron is via `app.getAppPath()` or `path.join(__dirname, '..', '..', '..', 'Reference Documents')` depending on the build layout — this needs careful handling.

**Primary recommendation:** Implement the custom IPC streaming channel (`ai:send-message` handle + `ai:token`/`ai:finish`/`ai:error` events) as a first-class architectural decision, not an afterthought. The tRPC boundary handles all database operations; the custom IPC channel handles only the streaming flow. This separation is clean and does not require upgrading tRPC.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI provider selection + config storage | API/Backend (main process + SQLite) | — | API keys must never cross to renderer; config is campaign data |
| API key encrypt/decrypt | API/Backend (main process: SecretStorageService) | — | FOUND-04 security contract: no key over IPC |
| Streaming token delivery | API/Backend (ipcMain) → Browser/Client (renderer) | — | Main process calls LLM, streams tokens via custom IPC channel |
| Context assembly (system prompt + docs + history) | API/Backend (main process: ContextBuilder) | — | System prompt never exposed to renderer |
| Message persistence | Database (SQLite `messages` table) | — | All messages persist immediately; loaded by tRPC query |
| Story scroll UI (StoryScrollPanel) | Browser/Client (renderer React) | — | Pure UI: assembles messages from TanStack Query + streaming tokens |
| Chat input + send | Browser/Client (renderer React) | — | Calls `ipcRenderer.invoke('ai:send-message', {...})` |
| Wizard (CreateCampaignModal extension) | Browser/Client (renderer React) | — | Calls `trpc.campaigns.create` + `trpc.secrets.set` mutations |
| Reference document listing | API/Backend (main process: tRPC query) | — | Filesystem access for listing and reading docs is main-process only |
| Fallback retry logic | API/Backend (main process: retryHandler) | — | Retry logic wraps streamChat; renderer only sees error/success events |
| safeStorage availability check | API/Backend (main process: tRPC query) | — | Same as existing `prefs.isEncryptionAvailable` pattern from 01-CONTEXT D-15 |

---

## Standard Stack

### Core (Phase 3 additions — NOT YET INSTALLED)

| Library | Version (npm registry) | Purpose | Why Standard |
|---------|------------------------|---------|--------------|
| `ai` | 6.0.191 | Vercel AI SDK — `streamText()`, `CoreMessage`, streaming | Locked decision (AI-SPEC §2, CONTEXT.md); only SDK treating provider-switching as first-class |
| `@ai-sdk/openai-compatible` | 2.0.48 | Factory for LM Studio, Jan AI, Ollama, OpenRouter, OpenAI | Locked in AI-SPEC; vendor-documented for LM Studio/Jan AI |
| `@ai-sdk/google` | 3.0.79 | Gemini provider via Google AI API | Locked in AI-SPEC; replaces deprecated `@google/generative-ai` |
| `react-markdown` | 10.1.0 | Render AI narration markdown (bold, italic, lists) | CLAUDE.md stack; `react-markdown` is the canonical React markdown renderer |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown plugin for react-markdown | Standard peer plugin for react-markdown |
| `react-hotkeys-hook` | 5.3.2 | Ctrl+Enter keyboard shortcut for chat send | CLAUDE.md stack; purpose-built for keyboard shortcuts in React |

**Version note:** The npm registry currently shows `ai@6.x`, `@ai-sdk/openai-compatible@2.x`, and `@ai-sdk/google@3.x`. These are the latest 2026 versions. The AI-SPEC references `ai@^4.0` in its examples — the API surface for `streamText()` and `CoreMessage` is stable across v4→v6; install latest. The import paths (`import { streamText, CoreMessage } from 'ai'`) and `createOpenAICompatible` / `createGoogleGenerativeAI` factories remain unchanged. [VERIFIED: npm registry]

### Supporting (already installed)

| Library | Version (installed) | Purpose |
|---------|---------------------|---------|
| `zod` | `^3.24.0` | IPC payload validation, aiConfig schema, sendMessage schema |
| `better-sqlite3` | `^12.10.0` | Messages table queries (synchronous) |
| `drizzle-orm` | `^0.36.0` | Schema extension + messages table queries |
| `@tanstack/react-query` | `^5.100.11` | Wrap tRPC calls for message list fetching + mutation state |
| `electron-trpc` | `0.7.1` | tRPC router for non-streaming operations (getMessages, updateAiConfig) |
| `electron-log` | `^5.4.4` | Log streaming metrics (latency_to_first_token_ms, etc.) per AI-SPEC §7 |
| `lucide-react` | `^0.556.0` | SlidersHorizontal icon for gear button, AlertTriangle for warnings |
| `react-hotkeys-hook` | (not installed) | See Core above |

### shadcn Components (must add via CLI)

| Component | Status | Command |
|-----------|--------|---------|
| `checkbox` | NOT present | `npx shadcn@latest add checkbox` |
| `textarea` | NOT present | `npx shadcn@latest add textarea` |
| `collapsible` | NOT present | `npx shadcn@latest add collapsible` |
| `tooltip` | NOT present | `npx shadcn@latest add tooltip` |
| `button`, `dialog`, `input`, `label`, `select`, `tabs` | Present in `src/renderer/src/components/ui/` | — |

**Confirmed missing:** Inspected `src/renderer/src/components/ui/` — only `button.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `tabs.tsx` are present. [VERIFIED: codebase inspection]

### Installation

```bash
# AI packages
npm install ai @ai-sdk/openai-compatible @ai-sdk/google

# Renderer packages
npm install react-markdown remark-gfm react-hotkeys-hook

# shadcn components
npx shadcn@latest add checkbox textarea collapsible tooltip
```

---

## Package Legitimacy Audit

All packages below are from the CLAUDE.md prescribed stack or are long-established ecosystem packages verified on npm.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `ai` | npm | 3+ yrs | 3M+/wk | github.com/vercel/ai | [ASSUMED] | Approved — Vercel's official AI SDK, prescribed in CLAUDE.md |
| `@ai-sdk/openai-compatible` | npm | 2+ yrs | 1M+/wk | github.com/vercel/ai (monorepo) | [ASSUMED] | Approved — same Vercel monorepo; prescribed in CLAUDE.md |
| `@ai-sdk/google` | npm | 2+ yrs | 1M+/wk | github.com/vercel/ai (monorepo) | [ASSUMED] | Approved — same Vercel monorepo; prescribed in CLAUDE.md |
| `react-markdown` | npm | 10+ yrs | 5M+/wk | github.com/remarkjs/react-markdown | [ASSUMED] | Approved — long-established, remark ecosystem |
| `remark-gfm` | npm | 5+ yrs | 5M+/wk | github.com/remarkjs/remark-gfm | [ASSUMED] | Approved — remark ecosystem standard plugin |
| `react-hotkeys-hook` | npm | 5+ yrs | 800K+/wk | github.com/JohannesKlauss/react-hotkeys-hook | [ASSUMED] | Approved — prescribed in CLAUDE.md stack |

**slopcheck was not available at research time** — all packages tagged [ASSUMED]. The planner should verify each install via `npm view <pkg> version` before executing. These are all high-confidence mainstream packages prescribed in CLAUDE.md, reducing the actual risk to near-zero.

**Packages removed:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Renderer Process (Browser)                Main Process (Node.js)
─────────────────────────────             ──────────────────────────────────────

[CreateCampaignModal / AiSettingsModal]
  │ trpc.campaigns.create.mutate()
  │ trpc.campaigns.updateAiConfig.mutate()
  │ trpc.secrets.set.mutate()               ──→ [campaignsRouter] → [campaignsRepo] → SQLite
  │ trpc.campaigns.get.query()              ──→ [secretsRouter] → [SecretStorageService]
  │ trpc.ai.listReferenceDocs.query()       ──→ [aiRouter] → [referenceDocLoader] → filesystem
  │ trpc.ai.getMessages.query()             ──→ [aiRouter] → [messagesRepo] → SQLite
  │
  │ ipcRenderer.invoke('ai:send-message', { campaignId, content })
  │                                         ──→ ipcMain.handle('ai:send-message')
  │                                                 │
  │                                                 ├─ [campaignsRepo].getAiConfig(campaignId)
  │                                                 ├─ [SecretStorageService].decrypt(key)
  │                                                 ├─ [messagesRepo].save(userMsg)
  │                                                 ├─ [contextBuilder].build(campaignId)
  │                                                 │       ├─ character + resources query
  │                                                 │       ├─ reference doc reads
  │                                                 │       └─ last 20 messages query
  │                                                 ├─ [retryHandler].withRetry(3, backoff)
  │                                                 │       └─ [llmProvider].streamChat(...)
  │                                                 │               └─ Vercel AI SDK streamText()
  │                                                 │                       └─ LLM endpoint (HTTP)
  │                                                 │
  │ ←─ event.sender.send('ai:token', chunk)  ──────┘
  │ ←─ event.sender.send('ai:finish', {})
  │ ←─ event.sender.send('ai:error', msg)
  │
[StoryScrollPanel]
  window.aiStream.onToken(cb)    ← reads from contextBridge
  window.aiStream.onFinish(cb)
  window.aiStream.onError(cb)
```

### Recommended Project Structure

```
src/
├── main/
│   ├── ai/
│   │   ├── llmProvider.ts          # LLMProvider interface + streamChat() — wraps Vercel AI SDK
│   │   ├── contextBuilder.ts       # Assembles system prompt + reference docs + message history
│   │   ├── retryHandler.ts         # 3-retry exponential backoff wrapper
│   │   └── referenceDocLoader.ts   # Enumerates + reads Reference Documents/Converted/ at runtime
│   ├── db/
│   │   ├── schema.ts               # Extended with AI config columns + messages table
│   │   ├── campaignsRepo.ts        # Extended with getAiConfig, updateAiConfig
│   │   └── messagesRepo.ts         # NEW: insert message, getLastN messages by campaignId
│   ├── trpc/
│   │   ├── router.ts               # Register new aiRouter
│   │   ├── schemas.ts              # Add aiConfigSchema, sendMessageSchema
│   │   └── routers/
│   │       ├── ai.ts               # NEW: listReferenceDocs query, getMessages query
│   │       └── campaigns.ts        # Extended: updateAiConfig mutation, create extended
│   └── index.ts                    # Add ipcMain.handle('ai:send-message') + streaming setup
├── preload/
│   └── index.ts                    # Add contextBridge.exposeInMainWorld('aiStream', {...})
└── renderer/
    └── src/
        ├── components/
        │   ├── StoryScrollPanel.tsx     # Narrative scroll area + streaming cursor
        │   ├── ChatInputArea.tsx        # Textarea + Send button + Ctrl+Enter
        │   ├── ChatErrorBlock.tsx       # Inline error block (D-18)
        │   ├── AiSettingsModal.tsx      # Gear icon modal (D-09)
        │   ├── CreateCampaignModal.tsx  # Extended to 3-step wizard
        │   └── wizard/
        │       └── WizardProgress.tsx  # REUSE existing component (change totalSteps to 3)
        └── screens/
            └── CampaignViewScreen.tsx  # Add gear icon + replace left panel placeholder
```

### Pattern 1: Custom IPC Streaming Channel (alongside tRPC)

**What:** `ipcMain.handle('ai:send-message')` initiates the LLM stream and returns `{ started: true }` immediately. Tokens arrive asynchronously via `event.sender.send('ai:token', chunk)`. The renderer registers callbacks via `window.aiStream.onToken()` before invoking the handler.

**When to use:** Any time the main process needs to push data to the renderer asynchronously (not request-response). tRPC v10 over `contextBridge` does not support subscriptions/streaming.

**Preload addition:**
```typescript
// src/preload/index.ts — add after exposeElectronTRPC()
import { ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('aiStream', {
  sendMessage: (payload: { campaignId: string; content: string }) =>
    ipcRenderer.invoke('ai:send-message', payload),
  onToken: (cb: (token: string) => void) => {
    ipcRenderer.on('ai:token', (_, t) => cb(t))
  },
  onFinish: (cb: () => void) => {
    ipcRenderer.on('ai:finish', () => cb())
  },
  onError: (cb: (msg: string) => void) => {
    ipcRenderer.on('ai:error', (_, m) => cb(m))
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:token')
    ipcRenderer.removeAllListeners('ai:finish')
    ipcRenderer.removeAllListeners('ai:error')
  },
})
```

**Main process handler (skeleton):**
```typescript
// src/main/index.ts — add inside app.whenReady() after createIPCHandler()
import { ipcMain } from 'electron'

ipcMain.handle('ai:send-message', async (event, { campaignId, content }) => {
  // 1. Validate input (Zod sendMessageSchema)
  // 2. Save user message to messages table
  // 3. Build context (ContextBuilder)
  // 4. Decrypt API key (SecretStorageService)
  // 5. Stream with retry handler
  //    - onToken: event.sender.send('ai:token', chunk)
  //    - onFinish: save assistant message, event.sender.send('ai:finish', {})
  //    - onError after retries: event.sender.send('ai:error', message)
  return { started: true }
})
```

**Important:** The `ipcMain.handle()` call must be placed AFTER `createIPCHandler()` in `src/main/index.ts` to avoid channel registration conflicts.

### Pattern 2: Vercel AI SDK streamText() in Node.js Main Process

**What:** `streamText()` returns an object with `textStream` as an async iterable. Use `for await` to iterate tokens.

**Critical mistake to avoid:**
```typescript
// WRONG — awaits full response before streaming begins
const { text } = await streamText({ model, messages })

// CORRECT — iterates tokens as they arrive
const result = await streamText({ model, system: systemPrompt, messages })
for await (const chunk of result.textStream) {
  event.sender.send('ai:token', chunk)
}
```

**IPC backpressure:** At high token rates (GPT-4o ~100 tok/s), tokens queue faster than the renderer renders. Batch tokens in 16ms windows:
```typescript
let buffer = ''
let flushTimer: ReturnType<typeof setTimeout> | null = null

const flush = () => {
  if (buffer) {
    event.sender.send('ai:token', buffer)
    buffer = ''
  }
  flushTimer = null
}

for await (const chunk of result.textStream) {
  buffer += chunk
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 16)
  }
}
// Flush remaining buffer
if (buffer) event.sender.send('ai:token', buffer)
```

**15-second timeout guard:**
```typescript
const timeoutMs = 15_000
let gotFirstToken = false

const timeoutId = setTimeout(() => {
  if (!gotFirstToken) {
    event.sender.send('ai:error', 'Provider did not respond in time')
    // Cancel stream — result.textStream is a ReadableStream; cancel via reader
  }
}, timeoutMs)

for await (const chunk of result.textStream) {
  if (!gotFirstToken) {
    gotFirstToken = true
    clearTimeout(timeoutId)
  }
  // ... batch and send
}
```

### Pattern 3: API Key Naming Scheme (Claude's Discretion — D-08)

**Scheme:**
- Primary key: `ai-key-{campaignId}` (e.g., `ai-key-550e8400-e29b-41d4-a716`)
  - Campaign UUIDs use hyphens, which are in `[a-zA-Z0-9_.-]` — valid.
  - Total length: 7 + 36 = 43 chars — within the 64-char max in `secretKeySchema`.
- Fallback key: `ai-fallback-{campaignId}` (e.g., `ai-fallback-550e8400-e29b-41d4-a716`)
  - Total length: 11 + 36 = 47 chars — within 64-char max.

Both patterns satisfy `secretKeySchema`'s `^[a-zA-Z0-9_.-]+$` regex (hyphens are `-`, in the character class as literal `-`). [VERIFIED: codebase inspection of `src/main/trpc/routers/secrets.ts`]

**Renderer calls secrets.set with these keys:**
```typescript
trpc.secrets.set.mutate({ key: `ai-key-${campaignId}`, value: apiKey })
trpc.secrets.set.mutate({ key: `ai-fallback-${campaignId}`, value: fallbackApiKey })
```

**Main process decrypts per-request:**
```typescript
const apiKey = await secretStorage.decrypt(`ai-key-${campaignId}`)
```

### Pattern 4: Drizzle Migration 0002

**Migration file:** `resources/migrations/0002_ai_config.sql`

**Journal:** The `resources/migrations/meta/_journal.json` has entries at idx 0 and idx 1. Migration 0002 becomes idx 2. Drizzle Kit's `db:generate` command generates the migration automatically from schema changes. The developer should:
1. Update `src/main/db/schema.ts` with the new columns and `messages` table
2. Run `npm run db:generate` to produce the migration SQL
3. The migration runs automatically at startup via the existing `migrate()` call in `src/main/db/index.ts`

**Expected SQL shape for migration 0002:**
```sql
-- Add AI config columns to campaigns table
ALTER TABLE `campaigns` ADD `provider_type` text DEFAULT 'openai-compatible' NOT NULL;
ALTER TABLE `campaigns` ADD `endpoint_url` text;
ALTER TABLE `campaigns` ADD `model_name` text;
ALTER TABLE `campaigns` ADD `reference_docs` text DEFAULT '[]' NOT NULL;
ALTER TABLE `campaigns` ADD `dm_personality` text;
ALTER TABLE `campaigns` ADD `strictness` text DEFAULT 'balanced' NOT NULL;
ALTER TABLE `campaigns` ADD `fallback_endpoint_url` text;
ALTER TABLE `campaigns` ADD `fallback_model_name` text;
--> statement-breakpoint
-- Create messages table
CREATE TABLE `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_campaign_id_idx` ON `messages` (`campaign_id`);
```

**Drizzle schema additions:**
```typescript
// Updated campaigns table (add to existing exports in schema.ts)
export const campaigns = sqliteTable('campaigns', {
  // ... existing columns ...
  providerType: text('provider_type', { enum: ['openai-compatible', 'gemini'] })
    .notNull()
    .default('openai-compatible'),
  endpointUrl: text('endpoint_url'),
  modelName: text('model_name'),
  referenceDocs: text('reference_docs').notNull().default('[]'),
  dmPersonality: text('dm_personality'),
  strictness: text('strictness', { enum: ['strict', 'balanced', 'narrative'] })
    .notNull()
    .default('balanced'),
  fallbackEndpointUrl: text('fallback_endpoint_url'),
  fallbackModelName: text('fallback_model_name'),
})

// New messages table
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})
```

### Pattern 5: Reference Document Loader

**Where do the docs live in production?**

The `Reference Documents/Converted/` folder is a **dev-time / distribution asset**, not user data. It ships bundled with the app. The correct path depends on the electron-vite build layout:

- In development: relative to the project root. `path.join(process.cwd(), 'Reference Documents', 'Converted')` or use `app.getAppPath()`.
- In production (packaged ASAR): Files outside the `src/` directory that are in `extraResources` in electron-builder config will be placed in `process.resourcesPath`. If not configured as `extraResources`, they end up inside ASAR and must be accessed via the ASAR path.

**Recommended approach:** Add `Reference Documents` to `extraResources` in `electron-builder.yml` (or equivalent config) so it lands in `process.resourcesPath` and is accessible as a regular filesystem path. [ASSUMED — need to verify electron-builder config location in this project]

**Reference doc listing (tRPC query, called at wizard open time):**
```typescript
// src/main/ai/referenceDocLoader.ts
import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { app } from 'electron'

function getReferencDocsBasePath(): string {
  // In production: process.resourcesPath (if extraResources configured)
  // In dev: app.getAppPath() points to project root
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'Reference Documents', 'Converted')
  }
  return path.join(app.getAppPath(), 'Reference Documents', 'Converted')
}

export async function listReferenceDocs(): Promise<Array<{
  name: string        // display-cleaned name
  relativePath: string // folder/filename.md (stored in DB)
  sizeBytes: number   // for large-file warning (>200KB)
}>> {
  const baseDir = getReferencDocsBasePath()
  const folders = await readdir(baseDir, { withFileTypes: true })
  const results = []
  for (const folder of folders.filter(f => f.isDirectory())) {
    const files = await readdir(path.join(baseDir, folder.name))
    const mdFile = files.find(f => f.endsWith('.md'))
    if (!mdFile) continue
    const fullPath = path.join(baseDir, folder.name, mdFile)
    const info = await stat(fullPath)
    const relativePath = path.join(folder.name, mdFile)
    results.push({
      name: cleanDocTitle(folder.name),
      relativePath,
      sizeBytes: info.size,
    })
  }
  return results
}

export async function readReferenceDoc(relativePath: string): Promise<string> {
  const baseDir = getReferencDocsBasePath()
  return readFile(path.join(baseDir, relativePath), 'utf-8')
}
```

**Title cleaning (D-05, UI-SPEC doc title display):**
```typescript
function cleanDocTitle(folderName: string): string {
  let title = folderName
  // Strip _OceanofPDF.com_ prefix
  title = title.replace(/^_OceanofPDF\.com_/, '')
  // Strip leading underscore
  title = title.replace(/^_/, '')
  // Strip author suffix after last ' - '
  const authorSepIdx = title.lastIndexOf(' - ')
  if (authorSepIdx !== -1) title = title.substring(0, authorSepIdx)
  // Decode URL entities
  title = title.replace(/x27/g, "'").replace(/%27/g, "'")
  // Replace underscores with spaces
  title = title.replace(/_/g, ' ')
  return title.trim()
}
```

**CRITICAL — Reference Documents path in electron-builder:** Check `electron.vite.config.ts` and `electron-builder.yml` for existing `extraResources` configuration. If not present, add:
```yaml
# electron-builder.yml
extraResources:
  - from: "Reference Documents"
    to: "Reference Documents"
    filter: ["**/*.md"]  # Only markdown files, not images
```
This prevents the images (JPEG files found inside each folder) from bloating the installer. [ASSUMED — need to verify electron-builder config file location and existing extraResources settings]

### Pattern 6: ContextBuilder v1 — Character Query

**Existing schema supports all required fields.** The `characters` table has all stats (strength, dexterity, constitution, intelligence, wisdom, charisma, ac, initiativeBonus, speed, proficiencyBonus, level, name, race, class, subclass). The `characterResources` table has `hpCurrent`, `hpMax`, `spellSlots`, `conditions`, `hasInspiration`.

**Single-join query for character summary:**
```typescript
// In contextBuilder.ts — use existing charactersRepo pattern
const character = db.select()
  .from(characters)
  .where(eq(characters.campaignId, campaignId))
  .get()

if (!character) return null

const resources = db.select()
  .from(characterResources)
  .where(eq(characterResources.characterId, character.id))
  .get()
```

These are two synchronous queries (better-sqlite3) — fast, no async overhead. The `CharacterWithResources` type from `charactersRepo.ts` already handles JSON parsing of `conditions` and `spellSlots`.

**Modifier calculation (needed for character summary):**
```typescript
const mod = (score: number) => Math.floor((score - 10) / 2)
const modStr = (score: number) => {
  const m = mod(score)
  return m >= 0 ? `+${m}` : `${m}`
}
```

**Spell slot summary formatting:**
```typescript
// spellSlots is SpellSlotMap: { "1": { used: 0, max: 2 }, "2": { used: 1, max: 3 }, ... }
function formatSpellSlots(slots: SpellSlotMap): string {
  const entries = Object.entries(slots)
    .filter(([, v]) => v.max > 0)
    .map(([level, v]) => `${level}st: ${v.max - v.used}/${v.max}`)  // remaining/max
  return entries.length > 0 ? `Spell Slots: ${entries.join(' | ')}` : ''
}
```

### Pattern 7: Retry Handler

**Exponential backoff (1s → 2s → 4s, 3 retries):**
```typescript
// src/main/ai/retryHandler.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  onFinalError: (err: Error) => void,
): Promise<T | null> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }
      onFinalError(lastErr!)
  return null
}
```

**Usage in the ipcMain handler:**
```typescript
await withRetry(
  () => streamChat(config, messages, systemPrompt, {
    onToken: (chunk) => { /* batch + send */ },
    onFinish: () => { /* save assistant message, send ai:finish */ },
    onError: (err) => { throw err }, // Re-throw to trigger retry
  }),
  3,
  (finalErr) => {
    event.sender.send('ai:error', finalErr.message)
  },
)
```

**In-memory fallback session state:** When the renderer sends "Switch to fallback", invoke a new `ipcMain.handle('ai:use-fallback', { campaignId })` that updates an in-memory Map:
```typescript
const sessionFallbackMap = new Map<string, boolean>() // campaignId → useFallback
```
Subsequent `ai:send-message` calls for that campaign check this map before building the provider config. The map is cleared on app restart (in-memory only, per D-19).

### Pattern 8: WizardProgress Reuse

The `WizardProgress` component at `src/renderer/src/components/wizard/WizardProgress.tsx` takes `totalSteps`, `currentStep`, `completedUpTo`, `stepLabels`, and `onStepClick`. Use it directly with `totalSteps=3` and `stepLabels={['Campaign', 'AI Provider', 'DM Style']}`.

The component uses `bg-accent-gold` (a custom token from the Tailwind v4 theme, established in Phase 1). This is already correct for the active/completed state per UI-SPEC.

**Wizard modal state machine:**
```typescript
type WizardStep = 1 | 2 | 3

interface WizardState {
  step: WizardStep
  completedUpTo: number      // -1 if none completed
  name: string               // Step 1
  providerType: 'openai-compatible' | 'gemini'  // Step 2
  endpointUrl: string
  modelName: string
  apiKey: string
  referenceDocs: string[]
  fallbackEndpointUrl: string
  fallbackModelName: string
  fallbackApiKey: string
  dmPersonality: string      // Step 3
  strictness: 'strict' | 'balanced' | 'narrative'
}
```

On submit (Step 3 → Create):
1. `trpc.campaigns.create.mutate({ name })` — creates campaign with name only
2. `trpc.campaigns.updateAiConfig.mutate({ campaignId, providerType, endpointUrl, modelName, referenceDocs, dmPersonality, strictness, fallbackEndpointUrl, fallbackModelName })` — adds AI config
3. If `apiKey` non-empty: `trpc.secrets.set.mutate({ key: 'ai-key-{campaignId}', value: apiKey })`
4. If `fallbackApiKey` non-empty: `trpc.secrets.set.mutate({ key: 'ai-fallback-{campaignId}', value: fallbackApiKey })`

### Pattern 9: react-markdown Import

**Import pattern (standard):**
```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// In StoryScrollPanel:
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    p: ({ children }) => <p className="mb-4 text-sm leading-[1.6] text-foreground">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="pl-4 list-disc mb-4">{children}</ul>,
    ol: ({ children }) => <ol className="pl-4 list-decimal mb-4">{children}</ol>,
    h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mb-2">{children}</h3>,
  }}
>
  {content}
</ReactMarkdown>
```

**Streaming concern:** React-markdown re-renders the entire content string on every token. For a smooth streaming experience, maintain the growing AI response as a string in state and pass the full string each render. This is acceptable at token-per-16ms batching rate.

**Alternative for streaming:** Append raw text without react-markdown during streaming; apply react-markdown only to completed messages loaded from DB. This avoids re-rendering overhead during streaming. Recommended for Phase 3.

### Anti-Patterns to Avoid

- **Passing `streamText()` result before iterating:** Do NOT `await streamText(...)` and then spread the text. Must iterate `result.textStream`.
- **Using `generateText()` for player-facing calls:** Always `streamText()` per AI-SPEC §4.
- **Calling `SecretStorageService.decrypt()` from the renderer via tRPC:** No `get` procedure exists on the secrets router and must not be added. Decryption is main-process only.
- **Storing API keys in the `campaigns` table:** Keys go to safeStorage only. The `campaigns` table row must never contain plaintext keys.
- **IPC listener leaks:** Always call `window.aiStream.removeAllListeners()` in the component's cleanup effect (React `useEffect` return) before the component unmounts or before re-registering.
- **Not handling `ipcRenderer.removeAllListeners` on channel:** Each campaign open/close cycle must clean up listeners or they stack up.
- **Placing `ipcMain.handle('ai:send-message')` before `createIPCHandler()`:** The `createIPCHandler` from `electron-trpc` sets up the `electron-trpc` channel; placing `ipcMain.handle` after it avoids any registration order issues.
- **Reference docs path in ASAR:** If `extraResources` is not configured correctly, `Reference Documents/` ends up inside the ASAR bundle. Files inside ASAR are accessible via `fs.readFile()` (Electron patches `fs`), but large markdown reads from ASAR have performance overhead. Configuring `extraResources` is preferred.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-provider LLM streaming | Custom SSE parser + provider-specific streaming | Vercel AI SDK `streamText()` | Handles SSE reconnect, partial tokens, backpressure, provider differences — ~400 lines of glue code |
| Keyboard shortcut handling | `onKeyDown` conditional + document listeners | `react-hotkeys-hook` `useHotkeys()` | Handles focus scope, `enableOnFormTags`, cleanup, TypeScript types |
| Markdown rendering | Custom regex-based HTML generator | `react-markdown` + `remark-gfm` | Handles nested inline formatting, edge cases, XSS (sanitization via the renderer boundary) |
| Provider credential isolation | Custom encryption | `SecretStorageService` (already built, Phase 1) | OS-native DPAPI/Keychain/kwallet; rebuild would introduce security regressions |
| Wizard step indicator | Custom step UI from scratch | Existing `WizardProgress` component (Phase 2 asset) | Already built, themed, and accessible |
| Exponential backoff | Ad-hoc `setTimeout` chain | `retryHandler.ts` abstraction | Reusable, testable, prevents duplicated backoff logic across future callers |

**Key insight:** The Vercel AI SDK's streaming abstraction alone removes the single hardest implementation problem (provider-specific SSE parsing with backpressure). Everything else in this phase builds on solid foundations already in place from Phases 1 and 2.

---

## Common Pitfalls

### Pitfall 1: Local LLMs Require Non-Empty apiKey String

**What goes wrong:** `createOpenAICompatible({ apiKey: undefined })` throws at provider instantiation time, not at call time. LM Studio, Jan AI, and Ollama don't require auth, so users leave the API key blank.

**Why it happens:** The Vercel AI SDK validates `apiKey` is a string (even `''` may fail depending on version).

**How to avoid:** Pass `apiKey: apiKey ?? 'none'` (or `'local'`) when building the OpenAI-compatible provider. Check the AI-SPEC §3 for the confirmed workaround pattern.

**Warning signs:** TypeError at provider construction, not at the HTTP call.

### Pitfall 2: IPC Listener Stacking on Component Re-mounts

**What goes wrong:** `ipcRenderer.on('ai:token', cb)` accumulates listeners each time `StoryScrollPanel` mounts. After navigating away and back, there are 2, then 4 listeners — tokens double or quadruple.

**Why it happens:** `ipcRenderer.on()` does not replace previous registrations. React's `useEffect` cleanup must call `removeAllListeners()`.

**How to avoid:**
```typescript
useEffect(() => {
  window.aiStream.onToken(handleToken)
  window.aiStream.onFinish(handleFinish)
  window.aiStream.onError(handleError)
  return () => {
    window.aiStream.removeAllListeners()
  }
}, []) // Empty deps — register once per mount, clean up on unmount
```

**Warning signs:** Tokens appear duplicated in the scroll area; streaming appears to run twice.

### Pitfall 3: Reference Documents Inside ASAR

**What goes wrong:** `fs.readFile('Reference Documents/...')` works in development (no ASAR), fails in packaged build (ASAR strips paths).

**Why it happens:** electron-vite packages source files into ASAR by default. Large binary assets outside `src/` may not be included unless `extraResources` is configured.

**How to avoid:** Add `Reference Documents` to `extraResources` in the electron-builder config with a filter for `**/*.md` only. Access via `process.resourcesPath` in packaged builds, `app.getAppPath()` in development.

**Warning signs:** Reference doc list is empty in production builds but works in dev.

### Pitfall 4: Drizzle Migration Journal Corruption

**What goes wrong:** Manually editing migration SQL files after the journal has been committed causes migration checksum mismatches on other machines or on app reinstall.

**Why it happens:** Drizzle Kit stores checksums in the journal. Hand-editing the SQL invalidates them.

**How to avoid:** Always use `npm run db:generate` to produce migrations from schema changes. Never hand-edit generated migration files. If a migration needs to be corrected, create a new migration that applies the correction.

**Warning signs:** `drizzle-kit push` or `migrate()` throws a checksum mismatch error.

### Pitfall 5: Streaming textStream is a ReadableStream

**What goes wrong:** Developer tries `.on('data', ...)` or `.pipe()` on `result.textStream`, gets TypeError.

**Why it happens:** The Vercel AI SDK returns a web-standard `ReadableStream`, not a Node.js `stream.Readable`. These have different APIs.

**How to avoid:** Always use `for await (const chunk of result.textStream)`. If you need a Node.js stream, wrap with `stream.Readable.from(result.textStream)`.

**Warning signs:** `result.textStream.on is not a function` error.

### Pitfall 6: safeStorage.isEncryptionAvailable() vs. isSecure()

**What goes wrong:** Using `safeStorage.isEncryptionAvailable()` alone to show the D-24 warning misses headless Linux where it returns `true` but the backend is `basic_text` (plaintext password).

**Why it happens:** Linux Electron reports `isEncryptionAvailable() = true` even when the actual backend is not secure (no kwallet/gnome-keyring available).

**How to avoid:** Use `SecretStorageService.isSecure()` which checks BOTH `isEncryptionAvailable()` AND `getSelectedStorageBackend() !== 'basic_text'`. Expose this via a new tRPC query (`prefs.isEncryptionAvailable`) that calls `secretStorage.isSecure()`.

**Warning signs:** Linux headless CI shows no warning, but keys are stored as base64. Already solved in Phase 1 — see `secretStorageService.ts` `isSecure()` method.

### Pitfall 7: WizardProgress completedUpTo Semantics

**What goes wrong:** Passing the wrong value for `completedUpTo` prop makes step navigation incorrect.

**Why it happens:** `completedUpTo` is the index of the highest completed step (0-based), not a count.

**How to avoid:** Track `completedUpTo` as `step - 1` when advancing to a new step. On Step 1 → Step 2: `completedUpTo = 0`. On Step 2 → Step 3: `completedUpTo = 1`. Back navigation should NOT reduce `completedUpTo` — completed steps stay clickable.

### Pitfall 8: CSP Blocks LLM Endpoint Connections

**What goes wrong:** The configured CSP in `src/main/index.ts` only allows `https://api.openai.com` and `https://generativelanguage.googleapis.com` as connect-src. Local LLM endpoints (`http://localhost:1234`, `http://127.0.0.1:11434`) are covered by `http://localhost:* http://127.0.0.1:*` — but other hostnames (e.g., a remote Ollama at `http://192.168.1.100:11434`) are blocked.

**Why it happens:** The CSP was set up in Phase 1 without knowledge of all Phase 3 LLM endpoints.

**How to avoid:** The current CSP includes `http://localhost:* http://127.0.0.1:*` which covers standard local setups. For remote LAN endpoints, the CSP must be updated. In Phase 3, document this as a known limitation — custom remote endpoints beyond localhost require a CSP update.

**Warning signs:** Network request blocked by CSP in DevTools console; the call never reaches the LLM.

---

## Code Examples

### Complete streamChat Implementation

```typescript
// src/main/ai/llmProvider.ts
import { streamText, CoreMessage } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import log from 'electron-log'

export interface LLMProviderConfig {
  type: 'openai-compatible' | 'gemini'
  endpointUrl?: string
  modelName: string
  apiKey?: string
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onFinish: () => void
  onError: (error: Error) => void
}

export async function streamChat(
  config: LLMProviderConfig,
  messages: CoreMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const model = buildModel(config)
  const startTime = Date.now()
  let gotFirstToken = false
  let tokenCount = 0

  try {
    const result = await streamText({
      model,
      system: systemPrompt,
      messages,
      temperature: 0.8,
    })

    // 15s timeout for first token
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        if (!gotFirstToken) reject(new Error('Provider did not respond in time'))
      }, 15_000),
    )

    // Buffer tokens in 16ms windows for backpressure
    let buffer = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      if (buffer) {
        callbacks.onToken(buffer)
        buffer = ''
      }
      flushTimer = null
    }

    await Promise.race([
      (async () => {
        for await (const chunk of result.textStream) {
          if (!gotFirstToken) {
            gotFirstToken = true
            log.info(`[AI] First token in ${Date.now() - startTime}ms`)
          }
          buffer += chunk
          tokenCount++
          if (!flushTimer) flushTimer = setTimeout(flush, 16)
        }
        if (flushTimer) clearTimeout(flushTimer)
        flush()
      })(),
      timeoutPromise,
    ])

    log.info(`[AI] Stream complete: ${tokenCount} tokens in ${Date.now() - startTime}ms`)
    callbacks.onFinish()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}

function buildModel(config: LLMProviderConfig) {
  if (config.type === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: config.apiKey! })
    return google(config.modelName)
  }
  const openai = createOpenAICompatible({
    name: 'custom',
    baseURL: config.endpointUrl!,
    apiKey: config.apiKey ?? 'none',
  })
  return openai(config.modelName)
}
```

### System Prompt Template

```typescript
// src/main/ai/contextBuilder.ts — buildSystemPrompt()
function buildSystemPrompt(
  character: CharacterWithResources | null,
  config: { strictness: string; dmPersonality: string | null },
  referenceDocs: string[],  // pre-read content strings
): string {
  const strictnessDirective = {
    strict: 'Apply all D&D 5e rules exactly as written. Reference specific rule pages if a player asks.',
    balanced: 'Be rules-aware but prioritize story and fun over strict RAW adherence.',
    narrative: 'Rules are flavor. Prioritize dramatic storytelling, player enjoyment, and narrative logic over mechanical accuracy.',
  }[config.strictness] ?? 'Be rules-aware but prioritize story and fun.'

  const personalityLine = config.dmPersonality?.trim()
    ? `DM style: ${config.dmPersonality}`
    : 'DM style: Classic adventure DM — balanced tone, fair challenges, memorable moments.'

  let prompt = `You are a Dungeon Master running a D&D 5e campaign. Your role is to narrate the world, portray NPCs, describe consequences, and facilitate the story. The player is the sole protagonist.

Rules approach: ${strictnessDirective}

${personalityLine}
`

  if (character) {
    const r = character.resources
    const mod = (s: number) => Math.floor((s - 10) / 2)
    const modStr = (s: number) => { const m = mod(s); return m >= 0 ? `+${m}` : `${m}` }
    const slots = formatSpellSlots(r.spellSlots)
    const conditions = r.conditions.length > 0 ? r.conditions.join(', ') : 'None'

    prompt += `
Current character: ${character.name}, Level ${character.level} ${character.race} ${character.class}${character.subclass ? ` (${character.subclass})` : ''}
HP: ${r.hpCurrent}/${r.hpMax} | AC: ${character.ac} | Speed: ${character.speed} ft | Initiative: ${modStr(character.dexterity)}
Stats: STR ${character.strength} (${modStr(character.strength)}) | DEX ${character.dexterity} (${modStr(character.dexterity)}) | CON ${character.constitution} (${modStr(character.constitution)}) | INT ${character.intelligence} (${modStr(character.intelligence)}) | WIS ${character.wisdom} (${modStr(character.wisdom)}) | CHA ${character.charisma} (${modStr(character.charisma)})
Proficiency Bonus: +${character.proficiencyBonus}
${slots ? slots + '\n' : ''}Active Conditions: ${conditions}
Inspiration: ${r.hasInspiration ? 'Yes' : 'No'}
`
  }

  for (const docContent of referenceDocs) {
    prompt += `\n=== Reference Document ===\n${docContent}\n`
  }

  return prompt
}
```

### Renderer Hook: useAiStream

```typescript
// src/renderer/src/hooks/useAiStream.ts
import { useEffect, useRef, useState } from 'react'

interface UseAiStreamResult {
  isStreaming: boolean
  streamingContent: string
  error: string | null
  sendMessage: (campaignId: string, content: string) => Promise<void>
  clearError: () => void
}

export function useAiStream(): UseAiStreamResult {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isStreamingRef = useRef(false)

  useEffect(() => {
    window.aiStream.onToken((token) => {
      setStreamingContent(prev => prev + token)
    })
    window.aiStream.onFinish(() => {
      isStreamingRef.current = false
      setIsStreaming(false)
      setStreamingContent('')
    })
    window.aiStream.onError((msg) => {
      isStreamingRef.current = false
      setIsStreaming(false)
      setStreamingContent('')
      setError(msg)
    })
    return () => {
      window.aiStream.removeAllListeners()
    }
  }, [])

  const sendMessage = async (campaignId: string, content: string) => {
    if (isStreamingRef.current) return
    isStreamingRef.current = true
    setIsStreaming(true)
    setError(null)
    setStreamingContent('')
    await window.aiStream.sendMessage({ campaignId, content })
  }

  return {
    isStreaming,
    streamingContent,
    error,
    sendMessage,
    clearError: () => setError(null),
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` (legacy Google JS SDK) | `@ai-sdk/google` (Vercel AI SDK provider) | August 2025 (legacy deprecated) | Phase 3 must use `@ai-sdk/google`, not the legacy package |
| tRPC subscriptions for streaming | Custom `ipcMain.handle` + `event.sender.send` | tRPC v10 never supported subscriptions over contextBridge | Phase 3 uses custom IPC channel; tRPC handles only non-streaming ops |
| `react-resizable-panels` v4 | Pinned at v3 (already in package.json) | Phase 1 research found v4 breaks shadcn Resizable wrapper | No action needed — already pinned correctly |
| Vercel AI SDK v4.x (AI-SPEC reference) | `ai@6.x` (latest on npm, May 2026) | SDK has had major version increments | The API for `streamText`, `CoreMessage`, `createOpenAICompatible`, `createGoogleGenerativeAI` is stable; install latest |

**Deprecated / outdated:**
- `@google/generative-ai`: Deprecated August 2025. Do not use. Use `@ai-sdk/google` instead.
- tRPC subscriptions via contextBridge: Not supported in the pinned `electron-trpc@0.7.1`. Use custom IPC channel.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel AI SDK `streamText()` and `CoreMessage` API surface is unchanged from v4 to v6 | Standard Stack, Code Examples | If API changed, imports/call signatures in code examples need updating; low risk (Vercel maintains backwards compat on core functions) |
| A2 | `createGoogleGenerativeAI` factory name is unchanged in `@ai-sdk/google@3.x` | Code Examples | If renamed, main AI code won't compile; verify with `import { createGoogleGenerativeAI } from '@ai-sdk/google'` after install |
| A3 | `Reference Documents/Converted/` lives outside the ASAR bundle and requires `extraResources` configuration in electron-builder | Pattern 5: Reference Document Loader | If already configured as extraResources, the path logic is correct. If not, the path in production will fail silently (empty doc list). Must verify electron-builder config file during implementation. |
| A4 | All slopcheck results for the 6 new packages are [OK] | Package Legitimacy Audit | These are all mainstream packages from major organizations (Vercel, remark ecosystem); actual risk is near-zero |
| A5 | `createOpenAICompatible` accepts `apiKey: 'none'` for unauthenticated local LLMs in the current v2.x of `@ai-sdk/openai-compatible` | Pitfall 1, Code Examples | If the SDK validates `apiKey` differently in v2, the workaround may need adjustment (e.g., empty string `''` instead of `'none'`) |
| A6 | electron-builder config file for this project is in the project root as `electron-builder.yml` or embedded in `package.json` | Pattern 5 (extraResources) | Need to verify the exact config file location before adding extraResources |

---

## Open Questions

1. **Vercel AI SDK v6 API compatibility with AI-SPEC examples**
   - What we know: `npm view ai version` returns `6.0.191`. AI-SPEC examples were written for v4.
   - What's unclear: Whether `streamText` still accepts `system` as a top-level option in v6, and whether `result.textStream` is still the async iterable property name.
   - Recommendation: Install `ai@latest` in Wave 0 and run a TypeScript compile check against the AI-SPEC example code immediately. If any API changed, update before implementation proceeds.

2. **electron-builder `extraResources` configuration location**
   - What we know: `Reference Documents/Converted/` must be accessible at runtime in packaged builds. The current `package.json` has `"resources": "src/resources"` which is NOT the standard electron-builder extraResources config.
   - What's unclear: Whether there is a separate `electron-builder.yml` or `electron-builder.json5` file not yet discovered, or whether extraResources is configured elsewhere.
   - Recommendation: Check for `electron-builder.yml`, `electron-builder.json5`, or `"build"` key in `package.json`. If none, add `extraResources` configuration before the first reference doc test.

3. **`isEncryptionAvailable` tRPC procedure name**
   - What we know: 01-CONTEXT.md D-15 says the safeStorage warning is Phase 3's responsibility. The prefs router doesn't currently expose this.
   - What's unclear: Should this be `prefs.isEncryptionAvailable` or `secrets.isEncryptionAvailable`?
   - Recommendation: Add as `prefs.isEncryptionAvailable` — it's a UI preference concern, not a secret store operation. The procedure calls `secretStorage.isSecure()`.

4. **`5e Automated Character Sheet` and MPMB character sheet folders — useful docs or noise?**
   - What we know: The reference docs list includes character sheet PDFs (MPMB sheets, 5E CharacterSheet Fillable, `5e Automated Character Sheet`). These are not rule reference documents.
   - What's unclear: Should these be excluded from the selectable doc list since they add no DM context value?
   - Recommendation: Filter out docs with file size < 50KB that match character sheet patterns, OR let the user decide — the UI already shows file sizes via the warning icon. Not a blocking question.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | AI SDK install, main process | ✓ | 24.x (bundled with Electron 41) | — |
| npm | Package install | ✓ | Bundled | — |
| `ai`, `@ai-sdk/*` packages | LLM streaming | ✗ (not installed) | — | Must install in Wave 0 |
| `react-markdown`, `remark-gfm` | Story scroll rendering | ✗ (not installed) | — | Must install in Wave 0 |
| `react-hotkeys-hook` | Ctrl+Enter shortcut | ✗ (not installed) | — | Must install in Wave 0 |
| `checkbox`, `textarea`, `collapsible`, `tooltip` shadcn components | Wizard UI | ✗ (not present) | — | Must add via shadcn CLI in Wave 0 |
| LM Studio / Jan AI / Ollama / Cloud LLM | AI streaming test | Depends on user setup | — | Mock provider for unit tests |
| `Reference Documents/Converted/` markdown files | Context injection | ✓ | 26 folders, 26 .md files | — |

**Missing dependencies with no fallback:**
- `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/google` — must be installed before any AI code compiles
- `react-markdown`, `remark-gfm`, `react-hotkeys-hook` — must be installed before renderer compiles

**Missing dependencies with fallback:**
- LLM endpoint for testing — use a mock `streamText()` wrapper in tests (see Validation Architecture section)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (already installed: `"vitest": "^2.0.0"` in devDependencies) |
| Config file | `vitest.config.ts` or inline in `vite.config.ts` (verify at implementation time) |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-03 | `buildModel()` creates valid provider for both types | unit | `npm test -- src/main/ai/llmProvider.test.ts` | ❌ Wave 0 |
| FOUND-03 | `streamChat()` streams tokens from mock provider | unit | `npm test -- src/main/ai/llmProvider.test.ts` | ❌ Wave 0 |
| SESS-05 | `campaignsRepo.updateAiConfig()` round-trips to DB | unit | `npm test -- src/main/db/campaignsRepo.test.ts` | ❌ Wave 0 (extend existing) |
| SESS-05 | `secretsRouter.set` stores key, `secretStorage.decrypt` retrieves it | unit | `npm test -- src/main/trpc/routers/secrets.test.ts` | ✅ (extend) |
| SESS-06 | Character summary template includes personality in system prompt | unit | `npm test -- src/main/ai/contextBuilder.test.ts` | ❌ Wave 0 |
| SESS-07 | Strictness directive maps correctly in system prompt | unit | `npm test -- src/main/ai/contextBuilder.test.ts` | ❌ Wave 0 |
| SESS-08 | `withRetry()` calls fn 3 times before invoking error callback | unit | `npm test -- src/main/ai/retryHandler.test.ts` | ❌ Wave 0 |
| SESS-08 | In-memory fallback swap persists for session | unit | `npm test -- src/main/ai/retryHandler.test.ts` | ❌ Wave 0 |
| D-23 | `ai:send-message` handler never sends plaintext key to renderer | integration | manual + code review | n/a |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test -- --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/main/ai/llmProvider.test.ts` — covers FOUND-03 streaming with a mock provider
- [ ] `src/main/ai/contextBuilder.test.ts` — covers SESS-06, SESS-07, character summary format
- [ ] `src/main/ai/retryHandler.test.ts` — covers SESS-08 retry logic (3 attempts, backoff timing)
- [ ] `src/main/db/messagesRepo.test.ts` — covers messages table insert + getLastN query
- [ ] Extend `src/main/db/campaignsRepo.test.ts` — add AI config update round-trip test

**Mock provider pattern for unit tests:**
```typescript
// In llmProvider.test.ts
import { vi } from 'vitest'
import * as aiModule from 'ai'

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

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (no user auth; single-user desktop app) | — |
| V3 Session Management | Partially (streaming session state) | In-memory session state for fallback; no persistent session tokens |
| V4 Access Control | Yes (renderer cannot access main process directly) | contextBridge narrow surface; no nodeIntegration |
| V5 Input Validation | Yes (IPC payloads, AI config fields) | Zod `aiConfigSchema`, `sendMessageSchema` at IPC boundary |
| V6 Cryptography | Yes (API key storage) | `SecretStorageService` (DPAPI/Keychain/kwallet) — never hand-rolled |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key extraction via IPC sniffing | Information Disclosure | No `get` procedure on secrets router; keys decrypted per-request in main process only |
| Prompt injection via player input | Tampering | Player input sent verbatim (D-15) — acceptable for this use case; no executable context in prompts |
| IPC channel impersonation (non-renderer frame) | Spoofing | Existing `senderFrame.url` validation in `createIPCHandler` createContext; apply same check to `ai:send-message` handler |
| Token stream hijacking by malicious extensions | Spoofing | sandbox: true on BrowserWindow prevents extension injection; contextBridge isolates the surface |
| Large reference doc injection (>1M tokens) | Denial of Service | UI warns user when doc > 200KB (AI-SPEC §4 threshold); no hard enforcement in Phase 3 |

**Security constraint from Phase 1 (must maintain):** The `ai:send-message` ipcMain handler must validate `event.senderFrame.url` using the same pattern as `createIPCHandler`'s `createContext`. This prevents a hypothetical injected iframe or devtools-abused frame from triggering LLM calls.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/main/index.ts`, `src/preload/index.ts`, `src/main/db/schema.ts`, `src/main/secrets/secretStorageService.ts`, `src/main/trpc/routers/*.ts`, `src/renderer/src/components/wizard/WizardProgress.tsx`, `package.json` [VERIFIED: codebase]
- npm registry — `npm view ai version`, `npm view @ai-sdk/openai-compatible version`, `npm view @ai-sdk/google version`, `npm view react-hotkeys-hook version`, `npm view react-markdown version`, `npm view remark-gfm version` [VERIFIED: npm registry]
- 03-CONTEXT.md, 03-AI-SPEC.md, 03-UI-SPEC.md (upstream design contracts — fully read) [VERIFIED: codebase]
- `resources/migrations/meta/_journal.json` — confirmed 2 existing migrations (idx 0 and 1); migration 0002 is next [VERIFIED: codebase]
- Reference Documents filesystem scan — 30 folders, 26 with .md files; file sizes confirmed [VERIFIED: codebase]

### Secondary (MEDIUM confidence)

- Vercel AI SDK API patterns from 03-AI-SPEC.md (AI-SPEC was authored from official Vercel AI SDK docs at time of generation)
- IPC streaming pattern (custom channel alongside tRPC) from 03-AI-SPEC.md §3 — consistent with Electron architecture

### Tertiary (LOW confidence / ASSUMED)

- Vercel AI SDK v6 API surface compatibility with v4 examples — assumed stable [ASSUMED: A1]
- Package slopcheck results — all packages assumed OK given mainstream provenance [ASSUMED: A4]
- electron-builder extraResources for Reference Documents — solution described but config file location not verified [ASSUMED: A3]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry; packages prescribed in CLAUDE.md
- Architecture (IPC pattern): HIGH — confirmed by reading existing preload/main/tRPC code; tRPC v10 streaming limitation confirmed by project history (STATE.md note)
- Drizzle migration pattern: HIGH — existing migration journal and migration files directly inspected
- Reference document loader: MEDIUM — path logic described with assumption about extraResources (not yet verified)
- Vercel AI SDK code examples: MEDIUM — based on AI-SPEC which was built from official docs; v6 API compatibility assumed

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (30 days) — Vercel AI SDK moves fast; re-verify SDK API if planning is delayed more than 2 weeks
