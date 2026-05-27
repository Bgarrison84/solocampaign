# Phase 4: Long-Campaign Memory & Session Flow — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 19 new/modified files
**Analogs found:** 19 / 19

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/ai/contextBuilder.ts` | service (replace v1) | transform | `src/main/ai/contextBuilder.ts` (v1) | exact |
| `src/main/ai/aiSessionState.ts` | service (extend) | event-driven | `src/main/ai/aiSessionState.ts` (existing) | exact |
| `src/main/ai/recapGenerator.ts` | service (new) | request-response | `src/main/ai/llmProvider.ts` | role-match |
| `src/main/db/schema.ts` | model (extend) | CRUD | `src/main/db/schema.ts` (existing) | exact |
| `src/main/db/sessionsRepo.ts` | repository (new) | CRUD | `src/main/db/messagesRepo.ts` | exact |
| `src/main/db/messagesRepo.ts` | repository (extend) | CRUD | `src/main/db/messagesRepo.ts` (existing) | exact |
| `src/main/trpc/routers/sessions.ts` | route (new) | request-response | `src/main/trpc/routers/campaigns.ts` | exact |
| `src/main/trpc/router.ts` | route (extend) | request-response | `src/main/trpc/router.ts` (existing) | exact |
| `src/main/trpc/schemas.ts` | utility (extend) | transform | `src/main/trpc/schemas.ts` (existing) | exact |
| `src/main/index.ts` | controller (extend) | request-response | `src/main/index.ts` (existing `ai:send-message` handler) | exact |
| `src/preload/index.ts` | middleware (extend) | request-response | `src/preload/index.ts` (`window.aiStream` pattern) | exact |
| `src/renderer/src/stores/sessionStore.ts` | store (new) | event-driven | `src/renderer/src/stores/windowStore.ts` + `panelSizeStore.ts` | exact |
| `src/renderer/src/hooks/useRecapStream.ts` | hook (new) | streaming | `src/renderer/src/hooks/useAiStream.ts` | exact |
| `src/renderer/src/components/SessionStartModal.tsx` | component (new) | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | role-match |
| `src/renderer/src/components/EndSessionModal.tsx` | component (new) | streaming | `src/renderer/src/components/CreateCampaignModal.tsx` + `StoryScrollPanel.tsx` | role-match |
| `src/renderer/src/components/SessionJournalTab.tsx` | component (new) | CRUD | `src/renderer/src/components/CharacterSheetTab.tsx` | role-match |
| `src/renderer/src/components/ChatInputArea.tsx` | component (extend) | event-driven | `src/renderer/src/components/ChatInputArea.tsx` (existing) | exact |
| `src/renderer/src/screens/CampaignViewScreen.tsx` | screen (extend) | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` (existing) | exact |
| `src/renderer/src/components/ui/scroll-area.tsx` | ui (new) | — | `src/renderer/src/components/ui/collapsible.tsx` | role-match |
| `resources/migrations/0003_*.sql` | migration (new) | CRUD | `resources/migrations/0002_handy_spectrum.sql` | exact |

---

## Pattern Assignments

### `src/main/ai/contextBuilder.ts` (service, transform — REPLACE v1 with v2)

**Analog:** `src/main/ai/contextBuilder.ts` (v1, lines 1–212)

**Imports pattern** (lines 1–16, keep as-is):
```typescript
import type { ModelMessage } from 'ai'
import { charactersRepo } from '../db/charactersRepo'
import type { CharacterWithResources } from '../db/charactersRepo'
import { messagesRepo } from '../db/messagesRepo'
import { readReferenceDocs } from './referenceDocLoader'
import log from 'electron-log'
// ADD for v2:
import { sessionsRepo } from '../db/sessionsRepo'
```

**Reuse verbatim from v1** (lines 19–120):
- `STRICTNESS_DIRECTIVES` constant (lines 19–27)
- `abilityMod()` function (lines 51–54)
- `formatCharacterSummary()` function (lines 59–120)

**Updated interface** (replace lines 31–43):
```typescript
export interface BuildContextArgs {
  campaignId: string
  sessionId: string | null   // null = no active session (graceful degradation)
  sessionContext?: {
    location: string | null
    goal: string | null
    contextNotes: string | null
  }
  config: {
    strictness: 'strict' | 'balanced' | 'narrative'
    dmPersonality?: string | null
    referenceDocs?: string[]
    rollingSummary?: string | null    // campaigns.rolling_summary (L3)
  }
}

export interface BuiltContext {
  systemPrompt: string
  messages: ModelMessage[]
  isL1Overflow: boolean     // NEW — flag for renderer warning banner
}
```

**Core pattern — L1/L2/L3 assembly** (replace lines 136–201):
```typescript
export function buildContext(args: BuildContextArgs): BuiltContext {
  const { campaignId, sessionId, sessionContext, config } = args

  // Token estimation: 4 chars ≈ 1 token (D-18 — best-effort estimate)
  const CHARS_L1_OVERFLOW = 6000 * 4   // 24,000 chars
  const CHARS_L2_CAP      = 2000 * 4   // 8,000 chars
  const CHARS_L3_CAP      = 1000 * 4   // 4,000 chars

  // --- L1: current session messages (D-14) ---
  let sessionMessages = sessionId ? messagesRepo.getBySessionId(sessionId) : []
  let isL1Overflow = false
  if (sessionMessages.length > 0) {
    const totalChars = sessionMessages.reduce((sum, m) => sum + m.content.length, 0)
    if (totalChars > CHARS_L1_OVERFLOW) {
      isL1Overflow = true
      sessionMessages = messagesRepo.getLastNForSession(sessionId!, 30)
    }
  }

  // --- L2: 3 most recent completed session recaps (D-15) ---
  const recentSessions = sessionsRepo.getLastNCompleted(campaignId, 3)
  let l2Block = ''
  let l2CharCount = 0
  for (const session of [...recentSessions].reverse()) {
    const label = `\nPrevious Sessions — Session ${session.sessionNumber}:\n`
    const content = session.aiRecap ?? ''
    const candidate = label + content
    if (l2CharCount + candidate.length > CHARS_L2_CAP) {
      const remaining = CHARS_L2_CAP - l2CharCount
      l2Block += candidate.substring(0, remaining)
      break
    }
    l2Block += candidate
    l2CharCount += candidate.length
  }

  // --- L3: rolling campaign summary (D-16) ---
  const rollingSummary = config.rollingSummary
    ? config.rollingSummary.substring(0, CHARS_L3_CAP)
    : null
  const l3Block = rollingSummary ? `\nCampaign History So Far:\n${rollingSummary}` : ''

  // --- Session start context block (D-17 item 5) ---
  let sessionContextBlock = ''
  if (sessionContext) {
    const parts: string[] = ['\nCurrent Session:']
    if (sessionContext.location) parts.push(`Location: ${sessionContext.location}`)
    if (sessionContext.goal)     parts.push(`Goal: ${sessionContext.goal}`)
    if (sessionContext.contextNotes) parts.push(`Notes: ${sessionContext.contextNotes}`)
    sessionContextBlock = parts.join('\n')
  }

  // --- Assemble system prompt (D-17 injection order) ---
  const preamble = 'You are a Dungeon Master running a D&D 5e campaign...'
  const strictnessDirective = `Rules approach: ${STRICTNESS_DIRECTIVES[config.strictness ?? 'balanced']}`
  const personality = config.dmPersonality?.trim()
    ? `DM style: ${config.dmPersonality.trim()}`
    : 'DM style: Classic adventure DM — balanced tone, fair challenges, memorable moments.'
  const character = charactersRepo.getByCampaignId(campaignId)
  const characterSummaryBlock = character ? '\n' + formatCharacterSummary(character) : ''
  // ... referenceDocBlock (same as v1) ...
  const systemPrompt = [preamble, strictnessDirective, personality, characterSummaryBlock]
    .filter(p => p.length > 0).join('\n\n')
    + referenceDocBlock
    + l3Block
    + l2Block
    + sessionContextBlock

  // --- Messages array: L1 (D-17 item 6 — NOT in system prompt) ---
  const messages: ModelMessage[] = sessionMessages.map((msg) =>
    msg.role === 'assistant'
      ? { role: 'assistant' as const, content: msg.content }
      : { role: 'user' as const, content: msg.content }
  )

  log.debug('[contextBuilder] buildContext v2', {
    campaignId, sessionId, systemPromptLength: systemPrompt.length,
    messageCount: messages.length, isL1Overflow,
    l2Sessions: recentSessions.length, hasL3: !!rollingSummary,
  })

  return { systemPrompt, messages, isL1Overflow }
}
```

---

### `src/main/ai/aiSessionState.ts` (service, event-driven — EXTEND)

**Analog:** `src/main/ai/aiSessionState.ts` (lines 1–77)

**Existing map pattern** (lines 16–17 — copy exactly):
```typescript
const _fallbackMap = new Map<string, boolean>()
const _abortMap = new Map<string, AbortController>()
```

**New map to ADD** (follow the same private-map + exported-accessor pattern):
```typescript
// NEW: Map<campaignId, sessionId> — active game session per campaign
const _activeSessionMap = new Map<string, string>()

export const sessionActiveMap = {
  set: (campaignId: string, sessionId: string) =>
    _activeSessionMap.set(campaignId, sessionId),
  get: (campaignId: string): string | null =>
    _activeSessionMap.get(campaignId) ?? null,
  clear: (campaignId: string) =>
    _activeSessionMap.delete(campaignId),
} as const
```

**Export pattern** (lines 66–76 — same `as const` pattern):
```typescript
export const sessionFallbackMap = { ... } as const
export const sessionAbortMap    = { ... } as const
// ADD:
export const sessionActiveMap   = { ... } as const
```

---

### `src/main/ai/recapGenerator.ts` (service, request-response — NEW)

**Analog:** `src/main/ai/llmProvider.ts` (lines 1–170)

**Imports pattern** (copy from llmProvider.ts lines 1–16):
```typescript
import { generateText } from 'ai'
import type { ModelMessage } from 'ai'
import { buildModel } from './llmProvider'
import type { LLMProviderConfig } from './llmProvider'
import log from 'electron-log'
```

**Core pattern** — `generateText()` call mirrors `streamText()` in llmProvider.ts (lines 89–95), but non-streaming:
```typescript
export const RECAP_SYSTEM_PROMPT = `You are a Dungeon Master's record-keeper. Summarize the following D&D 5e session in concise, third-person prose suitable for a DM's session notes. Include: key events in order, significant NPC interactions, decisions the player made, any combat outcomes, and where the session ended. Be factual and specific. Omit flavor prose — this is a reference record, not narrative. Aim for 3-6 paragraphs.`

export const ROLLING_SUMMARY_SYSTEM_PROMPT = `You are a Dungeon Master's campaign archivist. The following are session summaries from earlier in a D&D 5e campaign. Synthesize them into a single cohesive campaign summary of no more than 800 words. Capture: the overall story arc, key NPCs and their relationships to the player, major plot points resolved or ongoing, and the current state of the world. This summary will be injected into future AI context windows, so be precise and information-dense. Use past tense.`

export async function generateSessionRecap(
  providerConfig: LLMProviderConfig,
  sessionMessages: ModelMessage[],
): Promise<string> {
  const model = buildModel(providerConfig)  // same helper as llmProvider.ts line 86
  log.debug('[recapGenerator] generateSessionRecap', {
    messageCount: sessionMessages.length,
    providerType: providerConfig.type,
    // apiKey intentionally omitted
  })
  const { text } = await generateText({
    model,
    system: RECAP_SYSTEM_PROMPT,
    messages: sessionMessages,
    temperature: 0.3,
  })
  return text
}
```

**Error handling pattern** (mirror llmProvider.ts lines 165–169):
```typescript
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    log.error('[recapGenerator] generateSessionRecap error:', error.message)
    throw error
  }
```

---

### `src/main/db/schema.ts` (model, CRUD — EXTEND)

**Analog:** `src/main/db/schema.ts` (lines 1–154)

**Table definition pattern** (lines 4–20 — `sqliteTable` with `text().primaryKey()`, `integer({ mode: 'timestamp_ms' })`, `.default(sql\`...\`)`):
```typescript
import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
```

**New sessions table** (follow messages table pattern lines 26–39):
```typescript
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  sessionNumber: integer('session_number').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' })
    .notNull().default(sql`(unixepoch() * 1000)`),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  location: text('location'),
  goal: text('goal'),
  contextNotes: text('context_notes'),
  aiRecap: text('ai_recap'),
  playerNotes: text('player_notes'),
  isSummarized: integer('is_summarized', { mode: 'boolean' })
    .notNull().default(false),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
```

**Extend campaigns table** (ADD after existing `fallbackModelName` column, line 19):
```typescript
  rollingSummary: text('rolling_summary'),
```

**Extend messages table** (ADD after `createdAt`, line 36):
```typescript
  sessionId: text('session_id').references(() => sessions.id),
```

**Type export pattern** (lines 22–23, 39–40 — `$inferSelect` / `$inferInsert`):
```typescript
export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
```

---

### `src/main/db/sessionsRepo.ts` (repository, CRUD — NEW)

**Analog:** `src/main/db/messagesRepo.ts` (lines 1–87)

**Imports pattern** (lines 8–11 of messagesRepo.ts):
```typescript
import { asc, desc, eq, sql, and, isNull, isNotNull, lt } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { sessions, campaigns } from './schema'
import type { Session } from './schema'
```

**Core CRUD pattern** — insert + select-back (messagesRepo.ts lines 25–48):
```typescript
export const sessionsRepo = {
  create(input: {
    campaignId: string
    location?: string | null
    goal?: string | null
    contextNotes?: string | null
  }): Session {
    const db = getDb()
    const id = randomUUID()

    // Monotonic session_number per campaign (D-19)
    const maxRow = db.select({ max: sql<number>`MAX(session_number)` })
      .from(sessions)
      .where(eq(sessions.campaignId, input.campaignId))
      .get()
    const sessionNumber = (maxRow?.max ?? 0) + 1

    db.insert(sessions)
      .values({ id, campaignId: input.campaignId, sessionNumber, ... })
      .run()

    const created = db.select().from(sessions).where(eq(sessions.id, id)).get()
    if (!created) throw new Error('[sessions] Failed to retrieve session after insert')
    return created
  },
```

**Query pattern** — `getLastN` mirrors messagesRepo.ts lines 58–71 (`desc` + `limit` + `.all()` + `.reverse()`):
```typescript
  getLastNCompleted(campaignId: string, n: number): Session[] {
    const db = getDb()
    const rows = db.select().from(sessions)
      .where(and(eq(sessions.campaignId, campaignId), isNotNull(sessions.endedAt)))
      .orderBy(desc(sessions.sessionNumber))
      .limit(n)
      .all()
    return rows.reverse()
  },
```

**Update pattern** — mirrors campaignsRepo.ts `updateAiConfig` (lines 68–83):
```typescript
  end(sessionId: string): Session {
    const db = getDb()
    db.update(sessions)
      .set({ endedAt: new Date(Date.now()) })
      .where(eq(sessions.id, sessionId))
      .run()
    const updated = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
    if (!updated) throw new Error('[sessions] Session not found after end()')
    return updated
  },
```

---

### `src/main/db/messagesRepo.ts` (repository, CRUD — EXTEND)

**Analog:** `src/main/db/messagesRepo.ts` (lines 1–87 — existing file to extend)

**Interface extension** (extend `InsertMessageInput` at line 14):
```typescript
export interface InsertMessageInput {
  campaignId: string
  role: 'user' | 'assistant'
  content: string
  sessionId?: string | null   // NEW — nullable FK (D-20)
}
```

**New methods** (add after `getByCampaignId`, following `getLastN` pattern lines 58–71):
```typescript
  /** All messages for a specific session in chronological order (L1 full) */
  getBySessionId(sessionId: string): Message[] {
    const db = getDb()
    return db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(sql`rowid`))
      .all()
  },

  /** Last N messages for a specific session — L1 overflow fallback (D-14) */
  getLastNForSession(sessionId: string, n: number): Message[] {
    const db = getDb()
    const rows = db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(sql`rowid`))
      .limit(n)
      .all()
    return rows.reverse()
  },
```

---

### `src/main/trpc/routers/sessions.ts` (route, request-response — NEW)

**Analog:** `src/main/trpc/routers/campaigns.ts` (lines 1–112)

**Imports pattern** (lines 1–7 of campaigns.ts):
```typescript
import { z } from 'zod'
import { t } from '../_base'
import { sessionsRepo } from '../../db/sessionsRepo'
import { campaignIdSchema } from '../schemas'
import { sessionActiveMap } from '../../ai/aiSessionState'
```

**Router structure** (campaigns.ts line 8 — `t.router({...})`):
```typescript
export const sessionsRouter = t.router({
  start: t.procedure
    .input(z.object({
      campaignId: campaignIdSchema,
      location: z.string().max(200).nullish(),
      goal: z.string().max(1000).nullish(),
      contextNotes: z.string().max(1000).nullish(),
    }))
    .mutation(({ input }) => {
      const session = sessionsRepo.create({ ... })
      // Register in main-process in-memory map (Pitfall 2 prevention)
      sessionActiveMap.set(input.campaignId, session.id)
      return { id: session.id, sessionNumber: session.sessionNumber }
    }),
```

**Query pattern** (campaigns.ts `list` procedure lines 9–11):
```typescript
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => {
      return sessionsRepo.list(input.campaignId)
    }),
```

**Mutation with validation** (campaigns.ts `updateAiConfig` lines 72–111):
```typescript
  saveRecap: t.procedure
    .input(z.object({
      sessionId: campaignIdSchema,    // reuse uuid schema
      campaignId: campaignIdSchema,
      aiRecap: z.string().max(50000),
      playerNotes: z.string().max(10000).optional(),
    }))
    .mutation(async ({ input }) => {
      sessionsRepo.saveRecap(input.sessionId, input.aiRecap, input.playerNotes)
      sessionActiveMap.clear(input.campaignId)
      // Background rolling summary — does not block response (Pattern 7)
      Promise.resolve().then(async () => { /* see Pattern 7 in RESEARCH.md */ })
      return { saved: true }
    }),
```

---

### `src/main/trpc/router.ts` (route, request-response — EXTEND)

**Analog:** `src/main/trpc/router.ts` (lines 1–20)

**Registration pattern** (lines 1–20 — add one import + one key):
```typescript
import { sessionsRouter } from './routers/sessions'

export const router = t.router({
  ai: aiRouter,
  campaigns: campaignsRouter,
  characters: charactersRouter,
  content: contentRouter,
  prefs: prefsRouter,
  secrets: secretsRouter,
  sessions: sessionsRouter,   // ADD
  window: windowRouter,
})
```

---

### `src/main/trpc/schemas.ts` (utility, transform — EXTEND)

**Analog:** `src/main/trpc/schemas.ts` (lines 1–55)

**Schema pattern** (lines 3–4 — add after `campaignIdSchema`):
```typescript
// Session schemas (Phase 4)
export const sessionIdSchema = z.string().uuid()
export const sessionLocationSchema = z.string().max(200)
export const sessionGoalSchema = z.string().max(1000)
export const sessionContextNotesSchema = z.string().max(1000)
export const sessionRecapSchema = z.string().max(50000)
export const playerNotesSchema = z.string().max(10000)
```

---

### `src/main/index.ts` (controller, request-response — EXTEND)

**Analog:** `src/main/index.ts` (lines 164–339 — the `ai:send-message` handler)

**New import** (add to lines 1–24):
```typescript
import { sessionsRepo } from './db/sessionsRepo'
import { sessionActiveMap } from './ai/aiSessionState'
import { generateSessionRecap, generateRollingSummary } from './ai/recapGenerator'
```

**Extend Step 4 — associate message with session** (after line 237, current `messagesRepo.insert`):
```typescript
// Step 4: Persist user message (extended for Phase 4 — D-20)
const activeSessionId = sessionActiveMap.get(campaignId)
messagesRepo.insert({ campaignId, role: 'user', content, sessionId: activeSessionId })
```

**Extend Step 5 — pass sessionId + rollingSummary to buildContext** (lines 247–254):
```typescript
const { systemPrompt, messages, isL1Overflow } = buildContext({
  campaignId,
  sessionId: activeSessionId,
  sessionContext: activeSessionId ? (() => {
    const sess = sessionsRepo.getById(activeSessionId)
    return sess ? { location: sess.location, goal: sess.goal, contextNotes: sess.contextNotes } : undefined
  })() : undefined,
  config: { strictness, dmPersonality, referenceDocs, rollingSummary: campaign.rollingSummary ?? null },
})
```

**Extend `onFinish` callback** (lines 300–305 — add `isL1Overflow` to `ai:finish` payload):
```typescript
onFinish: () => {
  messagesRepo.insert({ campaignId, role: 'assistant', content: assistantBuffer, sessionId: activeSessionId })
  logTokensReceived(tokenCount)
  sessionAbortMap.clearAbortController(campaignId)
  safeSend('ai:finish', { isL1Overflow: finalIsL1Overflow })  // EXTENDED
},
```

**New IPC handler for recap streaming** (add after existing `ai:send-message` handler, following exact same structure lines 174–339):
```typescript
ipcMain.handle('ai:recap-start', async (event, payload) => {
  // Step 1: senderFrame validation — copy verbatim from ai:send-message lines 175-184
  // Step 2: Validate payload (sessionId + campaignId)
  // Step 3: Load campaign config (same as lines 194-233, but ALWAYS use primary provider, not fallback — Pitfall 4)
  // Step 4: Get session messages via sessionsRepo.getById + messagesRepo.getBySessionId
  // Step 5: streamText with RECAP_SYSTEM_PROMPT → emit ai:recap-token / ai:recap-finish / ai:recap-error
  return { started: true }
})
```

**App-close auto-end handler** (add to `app.on('window-all-closed')` area, lines 354–358):
```typescript
app.on('before-quit', () => {
  // D-06: synchronous only — no async LLM calls here (Pitfall 6)
  // End any open sessions synchronously; isSummarized=false signals pending rolling summary
  // sessionsRepo.endAllActive() — single synchronous DB write
})
```

---

### `src/preload/index.ts` (middleware, request-response — EXTEND)

**Analog:** `src/preload/index.ts` (lines 29–73 — `window.aiStream` pattern)

**Exact pattern to copy for `window.sessionRecap`** (mirror lines 29–73, different channel names):
```typescript
contextBridge.exposeInMainWorld('sessionRecap', {
  startStream: (payload: { campaignId: string; sessionId: string }) =>
    ipcRenderer.invoke('ai:recap-start', payload),

  onToken: (cb: (token: string) => void) =>
    ipcRenderer.on('ai:recap-token', (_, t) => cb(t)),

  onFinish: (cb: (finalText: string) => void) =>
    ipcRenderer.on('ai:recap-finish', (_, text) => cb(text)),

  onError: (cb: (err: { message: string }) => void) =>
    ipcRenderer.on('ai:recap-error', (_, m) => cb(m)),

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:recap-token')
    ipcRenderer.removeAllListeners('ai:recap-finish')
    ipcRenderer.removeAllListeners('ai:recap-error')
  },
})
```

**Extend `window.aiStream.onFinish`** (line 49 — add optional `isL1Overflow` to payload):
```typescript
// Existing:
onFinish: (cb: () => void) => { ipcRenderer.on('ai:finish', () => cb()) }
// Extended:
onFinish: (cb: (meta?: { isL1Overflow?: boolean }) => void) => {
  ipcRenderer.on('ai:finish', (_, meta) => cb(meta))
},
```

---

### `src/renderer/src/stores/sessionStore.ts` (store, event-driven — NEW)

**Analog 1:** `src/renderer/src/stores/windowStore.ts` (lines 1–18 — simplest Zustand pattern)
**Analog 2:** `src/renderer/src/stores/panelSizeStore.ts` (lines 1–43 — store with async methods)

**Imports pattern** (windowStore.ts line 1):
```typescript
import { create } from 'zustand'
```

**Store structure** (windowStore.ts lines 8–18 — interface + `create<T>()((set) => ({...}))`):
```typescript
interface SessionState {
  activeSessionId: string | null
  isSessionActive: boolean
  sessionNumber: number | null
  sessionContext: { location: string | null; goal: string | null; contextNotes: string | null } | null
  isL1Overflow: boolean

  startSession: (sessionId: string, sessionNumber: number, context: SessionContext) => void
  endSession: () => void
  setL1Overflow: (overflow: boolean) => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  activeSessionId: null,
  isSessionActive: false,
  sessionNumber: null,
  sessionContext: null,
  isL1Overflow: false,

  startSession: (sessionId, sessionNumber, context) =>
    set({ activeSessionId: sessionId, isSessionActive: true, sessionNumber, sessionContext: context }),

  endSession: () =>
    set({ activeSessionId: null, isSessionActive: false, sessionNumber: null, sessionContext: null, isL1Overflow: false }),

  setL1Overflow: (overflow) => set({ isL1Overflow: overflow }),
}))
```

---

### `src/renderer/src/hooks/useRecapStream.ts` (hook, streaming — NEW)

**Analog:** `src/renderer/src/hooks/useAiStream.ts` (lines 1–116 — copy structure exactly, different channel)

**Imports pattern** (lines 1–4 of useAiStream.ts):
```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
```

**Hook signature** (mirror useAiStream lines 31–32):
```typescript
export function useRecapStream(campaignId: string, sessionId: string | null): UseRecapStreamReturn
```

**Listener registration pattern** (useAiStream.ts lines 43–68 — CRITICAL: same cleanup in return):
```typescript
useEffect(() => {
  window.sessionRecap.onToken((token: string) => {
    setStreamingContent((prev) => prev + token)
  })
  window.sessionRecap.onFinish((finalText: string) => {
    setIsStreaming(false)
    setFinalText(finalText)
  })
  window.sessionRecap.onError((err: { message: string }) => {
    setIsStreaming(false)
    setError({ message: err.message })
  })
  return () => {
    // CRITICAL: removeAllListeners on cleanup — same as useAiStream.ts line 67
    window.sessionRecap.removeAllListeners()
  }
}, [campaignId, sessionId])
```

**Send function** (useAiStream.ts lines 71–103 — mirror `send` with `startStream`):
```typescript
const startRecap = useCallback(() => {
  if (!sessionId) return
  setError(null)
  setStreamingContent('')
  setFinalText('')
  setIsStreaming(true)
  window.sessionRecap
    .startStream({ campaignId, sessionId })
    .catch((err: unknown) => {
      setIsStreaming(false)
      setError({ message: err instanceof Error ? err.message : 'Failed to generate recap.' })
    })
}, [campaignId, sessionId])
```

---

### `src/renderer/src/components/SessionStartModal.tsx` (component, request-response — NEW)

**Analog:** `src/renderer/src/components/CreateCampaignModal.tsx` (lines 1–429)

**Imports pattern** (lines 1–32 of CreateCampaignModal.tsx):
```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { useSessionStore } from '../stores/sessionStore'
```

**Props pattern** (CreateCampaignModal.tsx lines 33–36):
```typescript
interface SessionStartModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  lastLocation?: string | null   // pre-fill from previous session (Specific Ideas)
}
```

**useMutation pattern** (CreateCampaignModal.tsx lines 78–85):
```typescript
const startMutation = useMutation({
  mutationFn: (data: { campaignId: string; location?: string; goal?: string; contextNotes?: string }) =>
    trpc.sessions.start.mutate(data),
  onSuccess: (result) => {
    useSessionStore.getState().startSession(result.id, result.sessionNumber, { location, goal, contextNotes: notes })
    onClose()
    // D-04: trigger AI auto-narration after session starts
  },
})
```

**Dialog structure** (CreateCampaignModal.tsx lines 186–428 — single-step simpler version):
```tsx
<Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
  <DialogContent className="max-w-[480px] w-full">
    <DialogHeader>
      <DialogTitle>Start Session</DialogTitle>
    </DialogHeader>
    {/* Three optional Textarea fields: location, goal, context notes */}
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={handleSubmit} disabled={startMutation.isPending}>
        {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
        Begin Session
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**useEffect reset on open** (CreateCampaignModal.tsx lines 88–102):
```typescript
useEffect(() => {
  if (open) {
    setLocation(lastLocation ?? '')
    setGoal('')
    setNotes('')
  }
}, [open, lastLocation])
```

---

### `src/renderer/src/components/EndSessionModal.tsx` (component, streaming — NEW)

**Analog 1:** `src/renderer/src/components/CreateCampaignModal.tsx` (Dialog structure)
**Analog 2:** `src/renderer/src/components/StoryScrollPanel.tsx` (streaming render pattern lines 218–232)
**Analog 3:** `src/renderer/src/hooks/useAiStream.ts` (via `useRecapStream`)

**Imports pattern**:
```typescript
import React, { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useHotkeys } from 'react-hotkeys-hook'
import { Loader2 } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { useRecapStream } from '../hooks/useRecapStream'
import { useSessionStore } from '../stores/sessionStore'
```

**Streaming render pattern** (StoryScrollPanel.tsx lines 218–232 — adapt for textarea toggle):
```tsx
{/* While streaming: show raw text with blinking cursor (read-only) */}
{isStreaming && (
  <div className="text-sm leading-[1.6] text-foreground whitespace-pre-wrap font-mono">
    {streamingContent}
    <span aria-hidden="true" className="animate-[blink_1s_ease-in-out_infinite]">|</span>
  </div>
)}
{/* After streaming completes: editable textarea (D-10) */}
{!isStreaming && (
  <Textarea
    value={recapText}
    onChange={(e) => setRecapText(e.target.value)}
    rows={10}
    className="resize-none font-mono text-sm"
  />
)}
```

**Hotkeys pattern** (ChatInputArea.tsx lines 60–70 — `enabled: open` to prevent cross-modal firing, Pitfall 7):
```typescript
useHotkeys('ctrl+enter', (e) => { e.preventDefault(); handleSave() }, {
  enableOnFormTags: ['TEXTAREA'],
  enabled: open && !isStreaming && !saveMutation.isPending,
})
```

**Save mutation** (CreateCampaignModal.tsx mutation pattern lines 78–85):
```typescript
const saveMutation = useMutation({
  mutationFn: (data: { sessionId: string; campaignId: string; aiRecap: string; playerNotes?: string }) =>
    trpc.sessions.saveRecap.mutate(data),
  onSuccess: () => {
    useSessionStore.getState().endSession()
    queryClient.invalidateQueries({ queryKey: ['sessions', 'list', campaignId] })
    onClose()
  },
})
```

---

### `src/renderer/src/components/SessionJournalTab.tsx` (component, CRUD — NEW)

**Analog:** `src/renderer/src/components/CharacterSheetTab.tsx` (lines 1–30 — tab orchestrator pattern)

**Imports pattern** (CharacterSheetTab.tsx lines 1–14):
```typescript
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useHotkeys } from 'react-hotkeys-hook'
import dayjs from 'dayjs'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { useSessionStore } from '../stores/sessionStore'
```

**Query pattern** (CharacterSheetTab.tsx lines 29–34):
```typescript
const sessionsQuery = useQuery({
  queryKey: ['sessions', 'list', campaignId],
  queryFn: () => trpc.sessions.list.query({ campaignId }),
  enabled: !!campaignId,
})
```

**Collapsible card pattern** (using `src/renderer/src/components/ui/collapsible.tsx`):
```tsx
<Collapsible open={expandedId === session.id} onOpenChange={(open) => setExpandedId(open ? session.id : null)}>
  <CollapsibleTrigger asChild>
    <button className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-muted/50">
      {expandedId === session.id ? <ChevronDown /> : <ChevronRight />}
      <span className="font-semibold text-sm">
        Session {session.sessionNumber} — {dayjs(session.startedAt).format('MMM D, YYYY')}
        {session.location ? ` — ${session.location}` : ''}
      </span>
    </button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* AI recap read-only (D-13) */}
    <div className="px-4 pb-2 text-sm leading-[1.6] text-foreground whitespace-pre-wrap">
      {session.aiRecap}
    </div>
    {/* Player notes editable (D-24) */}
    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
    <Button size="sm" onClick={() => handleSaveNotes(session.id)}>Save Notes</Button>
  </CollapsibleContent>
</Collapsible>
```

**useMutation for notes update** (same pattern as CreateCampaignModal.tsx):
```typescript
const updateNotesMutation = useMutation({
  mutationFn: (data: { sessionId: string; playerNotes: string }) =>
    trpc.sessions.updatePlayerNotes.mutate(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sessions', 'list', campaignId] })
  },
})
```

---

### `src/renderer/src/components/ChatInputArea.tsx` (component, event-driven — EXTEND)

**Analog:** `src/renderer/src/components/ChatInputArea.tsx` (lines 1–143)

**Props extension** (lines 23–32 — add `isSessionActive` prop):
```typescript
export interface ChatInputAreaProps {
  onSend: (content: string) => void
  isStreaming: boolean
  disabled?: boolean          // existing: no AI provider configured
  isSessionActive?: boolean   // NEW: false = session not started (D-03)
  onOpenSettings: () => void
  className?: string
}
```

**Locked state banner pattern** (lines 127–139 — add as third condition alongside existing `disabled` amber notice):
```tsx
{!isSessionActive ? (
  <p className="text-[12px] text-amber-500/80 mt-1">
    Start your session to begin playing.
  </p>
) : disabled ? (
  <p className="text-[12px] text-amber-500 mt-1">
    Configure an AI provider to start playing.{' '}
    <button className="underline hover:no-underline" onClick={onOpenSettings} type="button">
      Open settings.
    </button>
  </p>
) : (
  <p className="text-[12px] text-muted-foreground mt-1">Ctrl+Enter to send</p>
)}
```

**Disable textarea when session not active** (line 97 — add `isSessionActive` to disabled condition):
```tsx
<Textarea
  disabled={disabled || isStreaming || !isSessionActive}
  ...
/>
```

---

### `src/renderer/src/screens/CampaignViewScreen.tsx` (screen, request-response — EXTEND)

**Analog:** `src/renderer/src/screens/CampaignViewScreen.tsx` (lines 1–370)

**New imports** (add to lines 1–29):
```typescript
import { useSessionStore } from '../stores/sessionStore'
import { SessionStartModal } from '../components/SessionStartModal'
import { EndSessionModal } from '../components/EndSessionModal'
import { SessionJournalTab } from '../components/SessionJournalTab'
import { PlayCircle, StopCircle } from 'lucide-react'
```

**Session state** (add alongside existing `showAiSettings` state, lines 47–50):
```typescript
const sessionStore = useSessionStore()
const [showSessionStart, setShowSessionStart] = useState(false)
const [showEndSession, setShowEndSession] = useState(false)
```

**Session Start/End button** (add to action bar alongside gear icon, lines 152–169):
```tsx
{/* Session Start / End button — D-01, D-08 */}
{!sessionStore.isSessionActive ? (
  <Button variant="ghost" size="sm" onClick={() => setShowSessionStart(true)} className="gap-1">
    <PlayCircle className="h-4 w-4" />
    Start Session
  </Button>
) : (
  <Button variant="ghost" size="sm" onClick={() => setShowEndSession(true)}
    className="gap-1 text-amber-500 hover:text-amber-400">
    <StopCircle className="h-4 w-4" />
    End Session
  </Button>
)}
```

**Session Journal tab** (replace placeholder TabsContent lines 305–313):
```tsx
<TabsContent value="session-journal" className="flex-1 overflow-hidden p-0">
  <SessionJournalTab campaignId={id} />
</TabsContent>
```

**Tab label fix** (line 259 — change visible text per Pitfall 9, keep `value` attribute):
```tsx
<TabsTrigger value="session-journal" ...>
  Journal   {/* was "Session Journal" */}
</TabsTrigger>
```

**Pass `isSessionActive` to ChatInputArea** (line 225):
```tsx
<ChatInputArea
  isSessionActive={sessionStore.isSessionActive}
  ...
/>
```

---

### `src/renderer/src/components/ui/scroll-area.tsx` (ui, — NEW)

**Analog:** `src/renderer/src/components/ui/collapsible.tsx` (lines 1–9 — shadcn thin wrapper pattern)

**Install command** (before implementation):
```bash
npm install @radix-ui/react-scroll-area
npx shadcn@latest add scroll-area
```

**Expected generated pattern** (mirrors collapsible.tsx):
```typescript
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cn } from "../../lib/utils"

const ScrollArea = React.forwardRef<...>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
```

---

### `resources/migrations/0003_*.sql` (migration, CRUD — NEW)

**Analog:** `resources/migrations/0002_handy_spectrum.sql` (lines 1–16) and `0001_far_paibok.sql` (lines 1–74)

**File generation** (do NOT hand-write — run drizzle-kit):
```bash
npx drizzle-kit generate
```

**Expected SQL structure** (follow 0001/0002 patterns):
```sql
-- sessions table (new — follows character_items/character_resources pattern from 0001)
CREATE TABLE `sessions` (
    `id` text PRIMARY KEY NOT NULL,
    `campaign_id` text NOT NULL,
    `session_number` integer NOT NULL,
    `started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
    `ended_at` integer,
    `location` text,
    `goal` text,
    `context_notes` text,
    `ai_recap` text,
    `player_notes` text,
    `is_summarized` integer DEFAULT false NOT NULL,
    FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- ALTER TABLE (follow 0002 pattern lines 10-16 for adding columns)
ALTER TABLE `messages` ADD `session_id` text REFERENCES `sessions`(`id`);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `rolling_summary` text;
```

**Critical constraint** (Pitfall 1): Do NOT add `ON DELETE SET NULL` to `session_id` column. Nullable with no cascade is correct. If drizzle-kit generates it, remove it.

---

## Shared Patterns

### In-Memory Map (closed accessor bundle)
**Source:** `src/main/ai/aiSessionState.ts` lines 16–76
**Apply to:** `aiSessionState.ts` extension (new `_activeSessionMap`), `recapGenerator.ts` (no maps, but same defensive export style)
```typescript
// Pattern: private Map → public accessor object → `as const` export
const _privateMap = new Map<string, T>()
export const publicAccessor = {
  method: (key: string) => _privateMap.get(key) ?? null,
} as const
```

### tRPC Procedure (query + mutation)
**Source:** `src/main/trpc/routers/campaigns.ts` lines 8–112
**Apply to:** `sessions.ts` router (all procedures)
```typescript
// query:   t.procedure.input(z.object({...})).query(({ input }) => repo.method(input))
// mutation: t.procedure.input(z.object({...})).mutation(({ input }) => { repo.mutate(input); return result })
```

### senderFrame Validation
**Source:** `src/main/index.ts` lines 175–184
**Apply to:** New `ai:recap-start` IPC handler (copy verbatim — security contract)
```typescript
const senderUrl = (event as any).senderFrame?.url ?? ''
const isDev = process.env.NODE_ENV === 'development'
if (
  !senderUrl.startsWith('file://') &&
  !senderUrl.startsWith('app://') &&
  !(isDev && senderUrl.startsWith('http://localhost:'))
) {
  throw new Error('IPC sender frame URL not allowed')
}
```

### safeSend Guard
**Source:** `src/main/index.ts` lines 268–271
**Apply to:** New `ai:recap-start` IPC handler
```typescript
const safeSend = (channel: string, ...args: unknown[]): void => {
  if (!event.sender.isDestroyed()) {
    event.sender.send(channel, ...args)
  }
}
```

### IPC Listener Cleanup (React hook)
**Source:** `src/renderer/src/hooks/useAiStream.ts` lines 43–68
**Apply to:** `useRecapStream.ts`
```typescript
// CRITICAL: Always remove listeners in useEffect cleanup
return () => {
  window.sessionRecap.removeAllListeners()
}
```

### Zustand Store Shape
**Source:** `src/renderer/src/stores/windowStore.ts` lines 1–18
**Apply to:** `sessionStore.ts`
```typescript
export const useXxxStore = create<XxxState>()((set) => ({
  // state fields first
  // action functions last: (args) => set({ ... })
}))
```

### Repo: Insert + Select-back
**Source:** `src/main/db/messagesRepo.ts` lines 25–48
**Apply to:** `sessionsRepo.ts` `create()` method
```typescript
// Insert, then SELECT back by primary key — do not trust INSERT return value with better-sqlite3
db.insert(table).values({...}).run()
const created = db.select().from(table).where(eq(table.id, id)).get()
if (!created) throw new Error('...')
return created
```

### Drizzle Update
**Source:** `src/main/db/campaignsRepo.ts` lines 68–83
**Apply to:** `sessionsRepo.ts` `end()`, `saveRecap()`, `updatePlayerNotes()`, `markSummarized()`
```typescript
db.update(table).set({ column: value }).where(eq(table.id, id)).run()
```

### TanStack Query: useMutation
**Source:** `src/renderer/src/components/CreateCampaignModal.tsx` lines 78–85
**Apply to:** `SessionStartModal.tsx`, `EndSessionModal.tsx`, `SessionJournalTab.tsx`
```typescript
const mutation = useMutation({
  mutationFn: (data) => trpc.router.procedure.mutate(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['...'] })
  },
})
```

---

## No Analog Found

All 19 files have analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively — all patterns are grounded in real codebase code.

---

## Metadata

**Analog search scope:** `src/main/ai/`, `src/main/db/`, `src/main/trpc/`, `src/main/`, `src/preload/`, `src/renderer/src/stores/`, `src/renderer/src/hooks/`, `src/renderer/src/components/`, `src/renderer/src/screens/`, `resources/migrations/`
**Files scanned:** 47 source files read directly
**Pattern extraction date:** 2026-05-26
