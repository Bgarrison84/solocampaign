# Phase 4: Long-Campaign Memory & Session Flow — Research

**Researched:** 2026-05-26
**Domain:** Session management, multi-layer LLM context assembly, Drizzle schema migration, Zustand session state, tRPC session procedures, async background tasks in Electron
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Session Start Flow**
- D-01: "Start Session" button in campaign header alongside gear icon. Not auto-prompted on campaign open.
- D-02: Modal dialog with three optional fields: current location (free-form), session goal (free-form), context notes (free-form). "Begin Session" closes modal and triggers AI narration.
- D-03: Chat input locked until a session is begun. Banner "Start your session to begin playing." over disabled input. Applies to every session including the first.
- D-04: "Begin Session" triggers immediate AI auto-narration using injected memory + session start context. Player does not send a first message.
- D-05: Every campaign open loads to "no active session." Player must click "Start Session" every time. No auto-resume.
- D-06: App closed mid-session auto-ends session. Next open detects unsummarized session and generates summary in background before allowing new session start.
- D-07: Location field is free-form text only. Phase 6 adds breadcrumb tracker.
- D-08: Once session is active, "Start Session" button transforms to "End Session."

**End-of-Session & Recap**
- D-09: "End Session" opens modal. AI generates session recap immediately (streaming into editable textarea). Below recap: player notes field. Player reviews, edits, adds notes, clicks "Save Session."
- D-10: Player can edit AI recap text directly. Saved version (used for Layer 2 memory) is the final edited text. Player notes are a separate field.
- D-11: AI uses ALL messages from the current session to generate the recap. Bounded to one session's transcript.
- D-12: Recap uses fixed hardcoded system prompt designed for concise DM-record-style summary. Campaign DM personality and strictness NOT applied to recap call — it is a summarization task.
- D-13: Recap is read-only in Session Journal tab after saved. Editing only during end-session modal flow. Player notes remain editable from Journal tab at any time.

**Three-Layer Memory Architecture (ContextBuilder v2)**
- D-14: Layer 1 (hot context): All messages from the current session. L1 overflow threshold: 6000 tokens → fallback to last 30 messages + warning banner.
- D-15: Layer 2 (recent session summaries): 3 most recently completed sessions' AI recaps. Cap: 2000 tokens total for L2 block (truncated if exceeded).
- D-16: Layer 3 (rolling campaign summary): Single rolling summary of all sessions older than L2 window. Re-generated (not appended) at each session end. Cap: 1000 tokens. Stored in campaigns.rolling_summary column.
- D-17: Injection order in system prompt: (1) DM preamble + strictness + personality + character summary, (2) reference documents, (3) L3 rolling campaign summary labelled "Campaign History So Far:", (4) L2 recent session recaps labelled "Previous Sessions — Session N:", (5) session start context labelled "Current Session:", (6) L1 as messages array (not in system prompt).
- D-18: Token budget defaults hardcoded (no UI). L1 overflow: 6000 tokens → last 30 messages. L2 cap: 2000 tokens. L3 cap: 1000 tokens. Constants in ContextBuilder v2.

**Database Schema**
- D-19: New `sessions` table: id, campaign_id (FK→campaigns cascade), session_number, started_at, ended_at (nullable), location, goal, context_notes, ai_recap, player_notes, is_summarized (default false).
- D-20: Add session_id (FK→sessions nullable) to existing messages table. Phase 3 rows get session_id = NULL.
- D-21: campaigns table gets rolling_summary column (TEXT nullable).

**Session Journal Tab UI**
- D-22: Stacked timeline, newest first. In-progress session shows "Session N in progress" placeholder at top.
- D-23: Each session = collapsed card showing "Session N — [date] — [location]". Click to expand. Expanded: AI recap (read-only), player notes (editable textarea).
- D-24: Player notes always editable from Journal tab. AI recap read-only.
- D-25: No search or filter in Phase 4.

### Claude's Discretion
- Exact wording of session recap system prompt (hardcoded summarization directive).
- Exact wording of rolling summary system prompt.
- Specific token counting approach (estimate via character count or actual token count).
- "Save Notes" button placement and styling in Journal tab session cards.
- L1 overflow warning exact copy and visual placement in chat scroll.
- How "Start Session" / "End Session" header button animates or transitions between states.

### Deferred Ideas (OUT OF SCOPE)
- Per-campaign token budget settings UI — Phase 8.
- Session Journal search/filter — Phase 8 (fuse.js / minisearch).
- PDF/markdown export of session journal — Phase 8.
- Location breadcrumb tracker — Phase 6.
- AI-detected session end — Phase 6 or later.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-02 | App maintains a three-layer memory architecture: verbatim hot context (recent messages) + recent session summaries + a rolling campaign summary — injected at session start | ContextBuilder v2 design, token estimation approach, injection order in Vercel AI SDK system prompt |
| SESS-03 | Session start presents structured prompts (current location, session goal, context notes) before the AI narrates the opening | Session start modal design, sessions table schema, tRPC session.start procedure, IPC send-message handler extension |
| SESS-04 | Ending a session triggers a recap flow: AI generates a session summary, player can add personal notes, then the session saves | generateText() for recap, streaming recap into EndSessionModal, sessions.end + sessions.updatePlayerNotes procedures, background rolling summary generation |
</phase_requirements>

---

## Summary

Phase 4 is a well-scoped extension of the existing Phase 3 architecture. Every major decision is locked in 04-CONTEXT.md and 04-UI-SPEC.md — research focus is on verifying the exact implementation mechanics, surfacing codebase specifics the planner must know, and catching integration pitfalls before planning.

The core technical challenge is **ContextBuilder v2**: replacing the Phase 3 "last 20 messages" approach with a three-layer assembly that (1) queries the current session's messages from the DB, (2) pulls the last three completed session recaps, and (3) injects the campaign's rolling summary. The Vercel AI SDK `generateText()` function — confirmed present and available in the installed `ai@6.0.191` — handles the recap generation and rolling summary refresh as non-streaming calls.

The **Drizzle migration** (migration 0003) is straightforward: CREATE sessions table, ALTER messages ADD session_id FK, ALTER campaigns ADD rolling_summary. SQLite's limitations around ALTER TABLE (no ADD FOREIGN KEY, no DROP COLUMN) are the primary pitfall. The `session_id` FK must be added as a nullable column via `ALTER TABLE messages ADD COLUMN session_id TEXT REFERENCES sessions(id)`.

The **background rolling summary generation** (after session end) is achievable synchronously in the main process without blocking the renderer, since the operation happens in the tRPC mutation handler after session save — the renderer receives the session-saved acknowledgement immediately and the summary generation follows. The AI call for the rolling summary is a `generateText()` call of ~1–5 seconds duration. The plan should use a `setImmediate`/`Promise.resolve().then()` approach to yield to the event loop before starting the AI call, allowing the tRPC response to return first.

**Primary recommendation:** Implement in six logical waves: (1) DB migration + schema + repos, (2) ContextBuilder v2, (3) session tRPC router, (4) IPC handler extension + aiSessionState extension, (5) renderer session state + modals, (6) Session Journal tab. The existing IPC streaming pattern for AI narration is reused for the recap streaming — the same `ai:token`/`ai:finish`/`ai:error` channels can be repurposed for the recap flow by adding a `ai:recap-token`/`ai:recap-finish`/`ai:recap-error` channel set.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session record persistence (start/end/save) | Main Process (DB) | — | SQLite write must stay in main process; sessions table owned by sessionsRepo |
| Three-layer context assembly | Main Process (AI) | — | ContextBuilder v2 reads DB synchronously; builds system prompt before LLM call |
| AI recap generation (non-streaming) | Main Process (AI) | — | generateText() call with full session transcript; API key decryption in main only |
| Rolling summary generation (background) | Main Process (AI) | — | Same as recap; must stay post-auth in main; async after session save |
| Session start state tracking (active session ID) | Main Process (in-memory) + Renderer (Zustand) | — | Main tracks active session ID for message routing; renderer tracks for UI locked/unlocked state |
| Session start modal UI | Renderer | — | Pure UI; fires tRPC session.start mutation |
| End-of-session recap modal UI + streaming | Renderer | Main Process (streaming IPC) | Modal drives the recap flow; streaming uses existing IPC pattern |
| Session Journal tab UI | Renderer | — | Reads sessions via tRPC query; edits player notes via tRPC mutation |
| L1 overflow detection and warning | Main Process (context builder) | Renderer (Zustand flag) | ContextBuilder v2 detects overflow and sets a flag that is communicated to renderer |
| Token counting/estimation | Main Process (ContextBuilder v2) | — | Character-count estimation is adequate (see token counting section) |

---

## Standard Stack

### Core (already installed — verified from package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | 6.0.191 (installed) | `generateText()` for recap + rolling summary; `streamText()` already used for chat | Unified provider abstraction — same model instance works for streaming and non-streaming [VERIFIED: npm registry] |
| `drizzle-orm` | 0.36.0 (installed) | Schema definition for sessions table; migration generation | Already in use; confirmed SQLite `ALTER TABLE ADD COLUMN` for nullable FK [VERIFIED: npm registry] |
| `better-sqlite3` | 12.10.0 (installed) | Synchronous reads for sessions, messages, campaigns in ContextBuilder v2 | Already in use; synchronous API fits main-process context assembly [VERIFIED: npm registry] |
| `zustand` | 5.0.13 (installed) | Session state slice (active session ID, isSessionActive, isL1Overflow) | Already in use for UI state [VERIFIED: npm registry] |
| `@tanstack/react-query` | 5.100.14 (installed) | Wrap all session tRPC procedures with useQuery/useMutation | Already in use [VERIFIED: npm registry] |
| `zod` | 3.24.0 (installed) | Validate all new tRPC session procedure inputs | Already in use [VERIFIED: npm registry] |
| `dayjs` | 1.11.20 (installed) | Format session dates in Journal tab ("May 24, 2026") | Already in use [VERIFIED: npm registry] |
| `react-hotkeys-hook` | 5.3.2 (installed) | Ctrl+Enter to save session / save notes | Already in use [VERIFIED: npm registry] |
| `electron-trpc` | 0.7.1 (installed) | New sessions tRPC router follows existing pattern | Already in use; v10 pin [VERIFIED: npm registry] |
| `@radix-ui/react-collapsible` | 1.1.12 (installed) | Session Journal card expand/collapse | Already installed (found in node_modules) [VERIFIED: npm registry] |

### New Installs Required

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `@radix-ui/react-scroll-area` | latest | Session Journal timeline scroll | UI-SPEC D-22/S6 requires `<ScrollArea>` for Journal timeline; NOT currently installed (confirmed absent from node_modules) [VERIFIED: npm registry] |

**Installation:**
```bash
npm install @radix-ui/react-scroll-area
npx shadcn@latest add scroll-area
```

The shadcn `scroll-area` component copies `src/renderer/src/components/ui/scroll-area.tsx` and installs `@radix-ui/react-scroll-area` as a dependency.

**Version verification (run at plan time):**
```bash
npm view @radix-ui/react-scroll-area version
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@radix-ui/react-scroll-area` | npm | ~4 years | Very high (core shadcn dependency) | github.com/radix-ui/primitives | Part of Radix UI primitives family [ASSUMED] | Approved — official Radix UI primitive, same org as all other @radix-ui packages already installed |

All other packages are already installed and in production use. No new packages require slopcheck beyond the scroll-area component.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Note: slopcheck was not available in this environment. `@radix-ui/react-scroll-area` is tagged [ASSUMED] per protocol, but risk is negligible — it is part of the same monorepo as `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`, etc., all of which are already installed and working.*

---

## Architecture Patterns

### System Architecture Diagram

```
Renderer (React)                          Main Process (Node.js)
─────────────────────────────             ──────────────────────────────────────
                                          
[CampaignViewScreen]                      [ai:send-message IPC handler]
  isSessionActive (Zustand)  ──────────►   buildContext v2(campaignId, sessionId)
  sessionId (Zustand)                        ├─ getBySessionId(sessionId)  → L1 msgs
  isL1Overflow (Zustand)  ◄──────────────    ├─ getL2Summaries(campaignId) → 3 recaps
                                             ├─ getRollingSummary(campaignId) → L3
[SessionStartModal]                          └─ assemble systemPrompt → streamChat()
  session.start.mutate()  ──── tRPC ────►  [sessionsRouter.start]
                                             ├─ sessionsRepo.create()
                                             └─ returns { sessionId, sessionNumber }

[ChatInputArea locked]                    [sessions IPC flow]
  locked when !isSessionActive             session created → sessionId stored in
                                           aiSessionState._activeSessionMap

[EndSessionModal]                         [sessions.end tRPC procedure]
  session.end.mutate()  ──── tRPC ────►   ├─ sessionsRepo.end(sessionId)
  recap streaming  ◄── IPC channels ──    └─ schedules rolling summary generation
  ai:recap-token                          
  ai:recap-finish                         [generateText() — recap]
  ai:recap-error                           ├─ messages = getBySessionId(sessionId)
                                           ├─ system prompt = RECAP_SYSTEM_PROMPT
[SessionJournalTab]                        └─ streams back via ai:recap-token IPC
  sessions.list.query()  ── tRPC ────►   [sessionsRepo.list(campaignId)]
  sessions.updatePlayerNotes.mutate()     
                                          [rolling summary — background]
                                           ├─ sessionsRepo.getOlderThan(campaignId, 3)
                                           ├─ generateText(ROLLING_SUMMARY_PROMPT)
                                           └─ campaignsRepo.updateRollingSummary()
```

### Recommended Project Structure (new files for Phase 4)

```
src/main/
├── ai/
│   ├── contextBuilder.ts        # REPLACE with v2 (session-aware)
│   ├── aiSessionState.ts        # EXTEND with _activeSessionMap
│   └── recapGenerator.ts        # NEW — generateText wrappers for recap + rolling summary
├── db/
│   ├── schema.ts                # EXTEND — sessions table, messages.session_id, campaigns.rolling_summary
│   ├── sessionsRepo.ts          # NEW — CRUD for sessions table
│   └── messagesRepo.ts          # EXTEND — getBySessionId(), getLastNForSession()
├── trpc/
│   ├── router.ts                # EXTEND — register sessionsRouter
│   ├── routers/
│   │   ├── sessions.ts          # NEW — session tRPC procedures
│   │   └── ai.ts                # EXTEND — handle L1 overflow IPC signal
│   └── schemas.ts               # EXTEND — session procedure input schemas
└── index.ts                     # EXTEND — ai:recap IPC channel; app-close auto-end handler

src/renderer/src/
├── components/
│   ├── SessionStartModal.tsx    # NEW
│   ├── EndSessionModal.tsx      # NEW
│   ├── SessionJournalTab.tsx    # NEW (replaces placeholder)
│   └── ui/
│       └── scroll-area.tsx      # NEW — shadcn ScrollArea
├── stores/
│   └── sessionStore.ts          # NEW — session Zustand slice
└── screens/
    └── CampaignViewScreen.tsx   # EXTEND — Start/End Session button, pass session state

resources/migrations/
└── 0003_*.sql                   # NEW — sessions table + messages.session_id + campaigns.rolling_summary
```

---

## Pattern 1: ContextBuilder v2 — Session-Aware Context Assembly

**What:** Replaces the v1 `buildContext()` with a version that accepts `sessionId` and assembles the three memory layers.

**v2 signature:**
```typescript
// Source: derived from existing contextBuilder.ts v1 interface
export interface BuildContextArgs {
  campaignId: string
  sessionId: string | null   // null = no active session (graceful degradation)
  sessionContext?: {          // from session start modal (D-17 item 5)
    location: string | null
    goal: string | null
    contextNotes: string | null
  }
  config: {
    strictness: 'strict' | 'balanced' | 'narrative'
    dmPersonality?: string | null
    referenceDocs?: string[]
    rollingSummary?: string | null    // from campaigns.rolling_summary (L3)
  }
}

export interface BuiltContext {
  systemPrompt: string
  messages: ModelMessage[]
  isL1Overflow: boolean     // NEW: flag for renderer warning banner
}
```

**L1 token counting approach (Claude's Discretion — resolved):** Use character count divided by 4 as a token estimate. This is the standard rough estimate (4 chars ≈ 1 token for English prose). For a 6000-token threshold, the character threshold is 24,000 characters. This is explicitly an estimate — the decision record (D-18) acknowledges that values "are best-effort and expected to need adjustment." Actual tokenizer calls (tiktoken, etc.) would require additional native dependencies not in the current stack. The estimation approach is adequate for the use case. [ASSUMED — but this is explicitly left to Claude's discretion in CONTEXT.md D-18]

**L1 assembly logic:**
```typescript
// Source: derived from codebase analysis + D-14
const TOKENS_L1_OVERFLOW_THRESHOLD = 6000
const CHARS_L1_OVERFLOW_THRESHOLD = TOKENS_L1_OVERFLOW_THRESHOLD * 4 // ~24,000 chars

// Get current session messages
let sessionMessages = sessionId
  ? messagesRepo.getBySessionId(sessionId)
  : []

// Check L1 overflow
const totalL1Chars = sessionMessages.reduce((sum, m) => sum + m.content.length, 0)
let isL1Overflow = false

if (totalL1Chars > CHARS_L1_OVERFLOW_THRESHOLD) {
  isL1Overflow = true
  sessionMessages = messagesRepo.getLastNForSession(sessionId!, 30)
}
```

**L2 assembly logic:**
```typescript
// Source: derived from D-15
const TOKENS_L2_CAP = 2000
const CHARS_L2_CAP = TOKENS_L2_CAP * 4 // ~8,000 chars

const recentSessions = sessionsRepo.getLastNCompleted(campaignId, 3)
let l2Block = ''
let l2CharCount = 0

for (const session of recentSessions.reverse()) { // oldest first
  const label = `\nPrevious Sessions — Session ${session.sessionNumber}:\n`
  const content = session.aiRecap ?? ''
  const candidate = label + content
  if (l2CharCount + candidate.length > CHARS_L2_CAP) {
    // Truncate: add as much as fits
    const remaining = CHARS_L2_CAP - l2CharCount
    l2Block += candidate.substring(0, remaining)
    break
  }
  l2Block += candidate
  l2CharCount += candidate.length
}
```

**L3 assembly logic:**
```typescript
// Source: derived from D-16, D-17
const TOKENS_L3_CAP = 1000
const CHARS_L3_CAP = TOKENS_L3_CAP * 4 // ~4,000 chars

const rollingSummary = config.rollingSummary
  ? config.rollingSummary.substring(0, CHARS_L3_CAP)
  : null

const l3Block = rollingSummary
  ? `\nCampaign History So Far:\n${rollingSummary}`
  : ''
```

**System prompt injection order (D-17):**
```typescript
const parts = [
  preamble,            // 1. Fixed DM preamble
  strictnessDirective, // 1. Strictness
  personality,         // 1. DM personality
  characterSummary,    // 1. Character summary
  referenceDocBlock,   // 2. Reference documents
  l3Block,             // 3. Rolling campaign summary
  l2Block,             // 4. Recent session recaps
  sessionContextBlock, // 5. Current session start context
]
```

---

## Pattern 2: sessionsRepo — Synchronous CRUD

**What:** New repository following the existing repo pattern (messagesRepo, campaignsRepo).

```typescript
// Source: derived from messagesRepo.ts pattern
export const sessionsRepo = {
  create(input: {
    campaignId: string
    location?: string | null
    goal?: string | null
    contextNotes?: string | null
  }): Session

  getById(sessionId: string): Session | undefined

  getActiveByCampaignId(campaignId: string): Session | undefined // ended_at IS NULL

  getLastNCompleted(campaignId: string, n: number): Session[]   // ended_at NOT NULL, DESC session_number

  getOlderThan(campaignId: string, afterSessionNumber: number): Session[]  // for L3 rolling summary

  end(sessionId: string): Session  // sets ended_at = now()

  saveRecap(sessionId: string, aiRecap: string, playerNotes?: string): Session  // sets is_summarized = false

  updatePlayerNotes(sessionId: string, playerNotes: string): Session

  markSummarized(sessionId: string): void  // sets is_summarized = true
  
  getLastLocation(campaignId: string): string | null  // for pre-fill on session 2+
}
```

**Session number assignment:**
```typescript
// In sessionsRepo.create() — D-19
// Get max session_number for this campaign, add 1
const maxRow = db.select({ max: sql<number>`MAX(session_number)` })
  .from(sessions)
  .where(eq(sessions.campaignId, campaignId))
  .get()
const sessionNumber = (maxRow?.max ?? 0) + 1
```

---

## Pattern 3: tRPC Sessions Router

**What:** New `sessions.ts` router following the `campaigns.ts` pattern. Registered in `router.ts`.

```typescript
// Source: derived from campaigns.ts + ai.ts patterns
export const sessionsRouter = t.router({
  start: t.procedure          // creates session row, returns {id, sessionNumber, campaignId}
    .input(z.object({ campaignId, location, goal, contextNotes }))
    .mutation(...)

  end: t.procedure            // sets ended_at, triggers recap via IPC channel
    .input(z.object({ sessionId: campaignIdSchema }))
    .mutation(...)

  saveRecap: t.procedure      // saves ai_recap + player_notes, schedules rolling summary
    .input(z.object({ sessionId, aiRecap, playerNotes }))
    .mutation(...)

  updatePlayerNotes: t.procedure  // editable from Journal tab at any time (D-24)
    .input(z.object({ sessionId, playerNotes }))
    .mutation(...)

  list: t.procedure           // for Session Journal tab
    .input(z.object({ campaignId }))
    .query(...)

  getActive: t.procedure      // renderer checks on campaign open
    .input(z.object({ campaignId }))
    .query(...)
})
```

**Registration in router.ts:**
```typescript
// Source: router.ts pattern
import { sessionsRouter } from './routers/sessions'
export const router = t.router({
  // ...existing routers...
  sessions: sessionsRouter,
})
```

---

## Pattern 4: generateText() for Recap and Rolling Summary

**What:** Vercel AI SDK `generateText()` is confirmed available in `ai@6.0.191` (verified by `typeof ai.generateText === 'function'`). Uses the same `buildModel()` helper from `llmProvider.ts`.

```typescript
// Source: confirmed from node_modules/ai — generateText function signature
import { generateText } from 'ai'
import { buildModel } from './llmProvider'

export async function generateSessionRecap(
  providerConfig: LLMProviderConfig,
  sessionMessages: ModelMessage[],
): Promise<string> {
  const model = buildModel(providerConfig)
  const { text } = await generateText({
    model,
    system: RECAP_SYSTEM_PROMPT,
    messages: sessionMessages,
    temperature: 0.3,  // lower temp for factual summaries
  })
  return text
}

export async function generateRollingSummary(
  providerConfig: LLMProviderConfig,
  olderSessions: Array<{ sessionNumber: number; aiRecap: string }>,
): Promise<string> {
  const model = buildModel(providerConfig)
  const historyText = olderSessions
    .map(s => `Session ${s.sessionNumber}: ${s.aiRecap}`)
    .join('\n\n')
  const { text } = await generateText({
    model,
    system: ROLLING_SUMMARY_SYSTEM_PROMPT,
    prompt: historyText,
    temperature: 0.3,
    maxTokens: 1000,  // matches L3 cap
  })
  return text
}
```

**Recap system prompt (Claude's Discretion — resolved):**
```
You are a Dungeon Master's record-keeper. Summarize the following D&D 5e session in
concise, third-person prose suitable for a DM's session notes. Include: key events in
order, significant NPC interactions, decisions the player made, any combat outcomes,
and where the session ended. Be factual and specific. Omit flavor prose — this is a
reference record, not narrative. Aim for 3-6 paragraphs.
```

**Rolling summary system prompt (Claude's Discretion — resolved):**
```
You are a Dungeon Master's campaign archivist. The following are session summaries from
earlier in a D&D 5e campaign. Synthesize them into a single cohesive campaign summary
of no more than 800 words. Capture: the overall story arc, key NPCs and their
relationships to the player, major plot points resolved or ongoing, and the current
state of the world. This summary will be injected into future AI context windows, so
be precise and information-dense. Use past tense.
```

---

## Pattern 5: aiSessionState Extension — Active Session Tracking

**What:** `aiSessionState.ts` gets a new `_activeSessionMap` (Map<campaignId, sessionId>) alongside the existing `_fallbackMap` and `_abortMap`. This allows the `ai:send-message` handler to know which session to associate messages with.

```typescript
// Source: aiSessionState.ts pattern — extend with new map
const _activeSessionMap = new Map<string, string>() // campaignId → sessionId

export const sessionActiveMap = {
  set: (campaignId: string, sessionId: string) =>
    _activeSessionMap.set(campaignId, sessionId),
  get: (campaignId: string): string | null =>
    _activeSessionMap.get(campaignId) ?? null,
  clear: (campaignId: string) =>
    _activeSessionMap.delete(campaignId),
} as const
```

**Extension to `ai:send-message` handler in `index.ts`:**
```typescript
// After Step 4 (persist user message), associate with active session
const activeSessionId = sessionActiveMap.get(campaignId)
messagesRepo.insert({
  campaignId,
  role: 'user',
  content,
  sessionId: activeSessionId,  // NEW — nullable FK
})
// Similarly for the assistant message in onFinish
```

---

## Pattern 6: Recap Streaming via Dedicated IPC Channels

**What:** The end-session recap streams from main → renderer using NEW dedicated IPC channels (`ai:recap-token`, `ai:recap-finish`, `ai:recap-error`) to avoid collision with the active chat stream channels.

**In `preload/index.ts`:**
```typescript
contextBridge.exposeInMainWorld('sessionRecap', {
  startStream: (payload: { campaignId: string; sessionId: string }) =>
    ipcRenderer.invoke('ai:recap-start', payload),
  onToken: (cb: (token: string) => void) =>
    ipcRenderer.on('ai:recap-token', (_, t) => cb(t)),
  onFinish: (cb: () => void) =>
    ipcRenderer.on('ai:recap-finish', () => cb()),
  onError: (cb: (err: { message: string }) => void) =>
    ipcRenderer.on('ai:recap-error', (_, m) => cb(m)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:recap-token')
    ipcRenderer.removeAllListeners('ai:recap-finish')
    ipcRenderer.removeAllListeners('ai:recap-error')
  },
})
```

**Why separate channels:** The `EndSessionModal` opens while the campaign is not in an active chat stream, but the channels must be named differently to avoid listener stacking if somehow both paths are open. Separate channels also make debugging easier.

---

## Pattern 7: Background Rolling Summary Generation

**What:** After `sessions.saveRecap` completes in the main process, rolling summary generation runs asynchronously without blocking the tRPC response.

**Pattern:**
```typescript
// In sessionsRouter.saveRecap mutation handler (or standalone IPC handler)
// First: save the session synchronously
sessionsRepo.saveRecap(sessionId, aiRecap, playerNotes)
sessionActiveMap.clear(campaignId)

// Then: schedule background rolling summary (does not block response)
Promise.resolve().then(async () => {
  try {
    const campaign = campaignsRepo.get(campaignId)
    if (!campaign || !campaign.providerType) return

    const savedSession = sessionsRepo.getById(sessionId)
    if (!savedSession) return

    // Sessions older than the L2 window (sessions 1..N-3)
    const olderSessions = sessionsRepo.getOlderThan(campaignId, savedSession.sessionNumber - 3)
    if (olderSessions.length === 0) {
      // No sessions old enough for L3 — clear any existing rolling summary
      campaignsRepo.updateRollingSummary(campaignId, null)
      return
    }

    const apiKey = await secretStorage.decrypt('ai-key-' + campaignId)
    const providerConfig: LLMProviderConfig = { /* from campaign */ }
    const rollingSummary = await generateRollingSummary(providerConfig, olderSessions)

    // Truncate to L3 cap
    const truncated = rollingSummary.substring(0, 4000) // 1000 tokens * 4 chars
    campaignsRepo.updateRollingSummary(campaignId, truncated)
    sessionsRepo.markSummarized(sessionId)
  } catch (err) {
    log.error('[sessions] Rolling summary generation failed:', err)
    // Non-fatal: next session will just lack L3 context
  }
})
```

**Why `Promise.resolve().then()` instead of setTimeout:** Gives the current synchronous call stack time to return the tRPC response before the async AI call begins. This is sufficient — the AI call takes 1-10 seconds and there's no UI to update during it. A more elaborate worker/queue is not warranted for this use case.

---

## Pattern 8: Drizzle Migration 0003

**What:** The next migration filename follows the `drizzle-kit generate` naming convention: `0003_*.sql`. The exact adjective-noun suffix is generated by drizzle-kit. The plan should:

1. Update `src/main/db/schema.ts` with the new tables/columns.
2. Run `npx drizzle-kit generate` to produce `0003_*.sql` and the updated `_journal.json`.
3. Commit both the schema change and the migration files together.

**Schema additions:**
```typescript
// New sessions table
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

// Extended messages (add session_id nullable FK)
// In schema.ts messages table, ADD:
sessionId: text('session_id').references(() => sessions.id),

// Extended campaigns (add rolling_summary)
// In schema.ts campaigns table, ADD:
rollingSummary: text('rolling_summary'),
```

**Critical SQLite constraint for ALTER TABLE (Pitfall #3 below):**

The `ALTER TABLE messages ADD COLUMN session_id TEXT REFERENCES sessions(id)` is valid SQLite. However, when drizzle-kit generates the migration SQL, it may emit this as an `ALTER TABLE ... ADD` statement which SQLite supports. The key constraint: SQLite does NOT support `ON DELETE SET NULL` on columns added via ALTER TABLE in older versions — but since `session_id` is nullable with no cascade, this is not an issue. The column will just be nullable with a foreign key hint (which SQLite does not enforce by default anyway — `PRAGMA foreign_keys = ON` must be set, which the app does at DB init).

---

## Pattern 9: Zustand Session Store

**What:** New `sessionStore.ts` following the `panelSizeStore.ts` pattern.

```typescript
// Source: panelSizeStore.ts pattern
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

**isL1Overflow propagation:** When ContextBuilder v2 detects L1 overflow, the `ai:send-message` handler sends an additional IPC event (`ai:session-state`) to the renderer with `{ isL1Overflow: true }`. The renderer's `useAiStream` hook (or a new dedicated effect) calls `sessionStore.setL1Overflow(true)`.

Alternatively (simpler): include `isL1Overflow` in the `ai:finish` event payload so the renderer learns about overflow only after the response completes. This avoids a second IPC channel. **Recommended:** add `isL1Overflow` to the existing `ai:finish` event payload as an optional boolean field.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer, tiktoken binding | Character-count estimation (4 chars ≈ 1 token) | tiktoken requires native bindings not in the stack; character estimation is explicitly acceptable per D-18 |
| Session recap streaming | Custom streaming infrastructure | Reuse existing `streamText()` + new `ai:recap-*` IPC channels | All streaming plumbing already works; just new channel names |
| Rolling summary deduplication | Append-based summary log | Re-generate from scratch at each session end (D-16) | Deterministic; no drift; simpler than incremental updating |
| Background task queue | Worker threads, message queues | `Promise.resolve().then()` scheduling | One session ends at a time; no queuing pressure; simpler |
| Session number gaps | UUID-based session IDs for ordering | Integer `session_number` column with `MAX() + 1` | Monotonic integer is human-readable; no gaps from cascaded deletes because campaigns.sessions are never partially deleted |
| Streaming recap in modal | Re-implementing streaming state | New `useRecapStream` hook following `useAiStream.ts` pattern | Same listener/cleanup pattern; just different IPC channels |

**Key insight:** This phase adds zero new infrastructure. Everything reuses existing patterns: Drizzle repos, tRPC procedures, Zustand stores, IPC streaming, shadcn modals. The only net-new mechanism is the `generateText()` call path (non-streaming), which is one function call with the same provider config already in use.

---

## Common Pitfalls

### Pitfall 1: SQLite Nullable FK via ALTER TABLE
**What goes wrong:** Drizzle-kit may generate `ALTER TABLE messages ADD COLUMN session_id TEXT REFERENCES sessions(id)` which is valid SQLite. But if the migration is hand-edited to add `ON DELETE SET NULL`, SQLite will reject it — SQLite does not support `ON DELETE SET NULL` in `ALTER TABLE ADD COLUMN` (it requires recreating the table).
**Why it happens:** Developers assume Drizzle handles FK constraints like PostgreSQL.
**How to avoid:** Do NOT add ON DELETE SET NULL to the session_id column. Nullable FK with no cascade is the correct approach (D-20 says existing messages get `session_id = NULL` — which is what nullable default gives us).
**Warning signs:** Migration fails with "near 'REFERENCES': syntax error" or similar SQLite error.

### Pitfall 2: Messages Written Before Session Start
**What goes wrong:** The `ai:send-message` handler writes messages to the DB. If the session store hasn't propagated `activeSessionId` to the main process by the time the handler runs, messages get `session_id = NULL` even during an active session.
**Why it happens:** The tRPC `session.start` mutation creates the session row and returns `sessionId` to the renderer, which then updates Zustand. But if the player immediately sends a chat message, the renderer's Zustand update and the IPC `send-message` call may race.
**How to avoid:** The session start flow (D-04) has the AI auto-narrate the opening — the session state is set in `aiSessionState._activeSessionMap` synchronously in the `sessions.start` tRPC mutation handler (in main process), BEFORE the renderer gets the response. The renderer's Zustand store update is irrelevant for main-process message routing — main reads from `aiSessionState._activeSessionMap`, not from the renderer.
**Warning signs:** Messages have `session_id = NULL` in a session that was started correctly.

### Pitfall 3: messagesRepo.getBySessionId() on Pre-Phase-4 Messages
**What goes wrong:** Phase 3 messages have `session_id = NULL`. If ContextBuilder v2 calls `getBySessionId(null)`, it would return all messages with null session_id — potentially the entire Phase 3 history.
**Why it happens:** SQL `WHERE session_id = NULL` is not the same as `WHERE session_id IS NULL`.
**How to avoid:** `getBySessionId` should use `eq(messages.sessionId, sessionId)` (Drizzle ORM) which generates `WHERE session_id = ?` with the actual UUID. Never call it with `null` — guard at the call site: if `sessionId === null`, return empty array (no active session = no L1 messages).
**Warning signs:** ContextBuilder v2 returns huge message arrays for campaigns with no active session.

### Pitfall 4: generateText() Provider Config at Recap Time
**What goes wrong:** By the time the player clicks "End Session," the in-memory fallback state may be active (`sessionFallbackMap.isFallbackActive(campaignId) === true`). The recap should use whichever provider was last successfully streaming — but the intent of the recap is to use the configured primary provider.
**Why it happens:** `sessionFallbackMap` persists across the session.
**How to avoid:** For recap generation, ALWAYS use the primary provider config (not fallback). The recap is a one-shot call, not a chat continuation. Read the campaign's primary config directly, ignore fallback state.
**Warning signs:** Recap fails when the primary provider is available but fallback is marked active.

### Pitfall 5: L1 Overflow During Auto-Narration on Session Start
**What goes wrong:** D-04 says the AI auto-narrates the opening immediately on session start. At this point, L1 is empty (no messages in the new session yet). The overflow check should always pass — but if there's a bug in `getBySessionId`, it could return old messages and trigger false overflow.
**Why it happens:** See Pitfall 3.
**How to avoid:** On session start, `sessionId` is the freshly created session ID — `getBySessionId` should return 0 messages (session just started). Guard that `isL1Overflow = false` when the session has 0 messages.
**Warning signs:** L1 overflow warning shows immediately after session start with 0 messages.

### Pitfall 6: App-Close Auto-End Session (D-06)
**What goes wrong:** On `app.before-quit`, the session must be auto-ended and marked for rolling summary on next open. The `before-quit` handler must be synchronous (or Electron will not wait for it).
**Why it happens:** `app.on('before-quit')` is synchronous — if you use `async` operations, Electron may quit before they complete.
**How to avoid:** The session end in the `before-quit` handler should ONLY update the DB synchronously (set `ended_at`). Do NOT attempt to generate the rolling summary here — it requires an async LLM call. The `isSummarized = false` flag means "rolling summary pending," and the NEXT app open detects this via `sessionsRepo.getActiveByCampaignId()` checking for sessions with `ended_at IS NOT NULL AND is_summarized = false`. That detection happens at app startup in main process and triggers background summary generation before allowing a new session start.
**Warning signs:** App hangs on close, or the DB write does not complete.

### Pitfall 7: react-hotkeys-hook Scope in Modal
**What goes wrong:** `Ctrl+Enter` to save session (EndSessionModal) and `Ctrl+Enter` to save notes (SessionJournalTab) fire simultaneously if both components are mounted.
**Why it happens:** `react-hotkeys-hook` v5 binds globally by default.
**How to avoid:** Use the `enableOnFormTags` option with a scoped `ref` or `enableOnContentEditable: false`, OR use the `scope` feature of react-hotkeys-hook v5. Since the EndSessionModal is a Dialog (mounted/unmounted), and Journal tab is in a different TabsContent, they should never both be mounted with active focus simultaneously. Still: add `enabled: open` to the EndSessionModal hotkey binding so it only fires when the modal is open.
**Warning signs:** Notes save fires when user tries to save the session recap, or vice versa.

### Pitfall 8: @radix-ui/react-scroll-area Not Installed
**What goes wrong:** SessionJournalTab uses `<ScrollArea>` from `src/renderer/src/components/ui/scroll-area.tsx`. This file does not exist and `@radix-ui/react-scroll-area` is not installed.
**Why it happens:** The UI-SPEC specifies this but the package was not included in Phase 1-3 work.
**How to avoid:** Wave 0 must install `@radix-ui/react-scroll-area` and scaffold `scroll-area.tsx` via `npx shadcn@latest add scroll-area` BEFORE any Journal tab implementation tasks.
**Warning signs:** Import error on `scroll-area` component, or npm error on missing peer dependency.

### Pitfall 9: Session Journal Tab Label
**What goes wrong:** The current tab in `CampaignViewScreen.tsx` is `value="session-journal"` with label "Session Journal". The UI-SPEC says the tab label should be shortened to "Journal" (see copywriting contract). The `value` attribute must stay `"session-journal"` (breaking change to change it if it's ever persisted), but the visible label changes.
**Why it happens:** Minor inconsistency between Phase 1 placeholder text and Phase 4 spec.
**How to avoid:** Keep `value="session-journal"`, update the visible tab text to `"Journal"` as specified in the copywriting contract.
**Warning signs:** Tab says "Session Journal" instead of "Journal" after Phase 4 ships.

---

## Code Examples

### L1 message query (new messagesRepo methods)
```typescript
// Source: derived from messagesRepo.ts getLastN pattern

/** All messages for a specific session in chronological order */
getBySessionId(sessionId: string): Message[] {
  return db.select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(sql`rowid`))
    .all()
},

/** Last N messages for a specific session (for L1 overflow fallback) */
getLastNForSession(sessionId: string, n: number): Message[] {
  const rows = db.select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(sql`rowid`))
    .limit(n)
    .all()
  return rows.reverse()
},

/** Updated insert to accept optional sessionId */
insert(input: { campaignId: string; role: 'user'|'assistant'; content: string; sessionId?: string | null }): Message
```

### Session start tRPC procedure calling pattern
```typescript
// Source: derived from campaigns.ts mutation pattern
// In sessionsRouter.start:
const session = sessionsRepo.create({
  campaignId: input.campaignId,
  location: input.location ?? null,
  goal: input.goal ?? null,
  contextNotes: input.contextNotes ?? null,
})

// Register session as active in main-process memory
sessionActiveMap.set(input.campaignId, session.id)

// Return session info to renderer for Zustand update
return { id: session.id, sessionNumber: session.sessionNumber }
```

### ContextBuilder v2 call site extension in index.ts
```typescript
// Source: index.ts ai:send-message handler — Step 5 extension
const activeSessionId = sessionActiveMap.get(campaignId)

// Load session context (location/goal/notes) if session is active
let sessionContext: BuildContextArgs['sessionContext'] = undefined
if (activeSessionId) {
  const session = sessionsRepo.getById(activeSessionId)
  if (session) {
    sessionContext = {
      location: session.location,
      goal: session.goal,
      contextNotes: session.contextNotes,
    }
  }
}

// L3 rolling summary from campaigns table
let rollingSummary: string | null = null
try {
  rollingSummary = campaign.rollingSummary ?? null
} catch { rollingSummary = null }

const { systemPrompt, messages: ctxMessages, isL1Overflow } = buildContext({
  campaignId,
  sessionId: activeSessionId,
  sessionContext,
  config: {
    strictness: ...,
    dmPersonality: ...,
    referenceDocs,
    rollingSummary,
  },
})

// Propagate L1 overflow to renderer (append to ai:finish event)
// Store isL1Overflow in a local variable to include in the finish event:
let finalIsL1Overflow = isL1Overflow
// ... then in onFinish callback:
safeSend('ai:finish', { isL1Overflow: finalIsL1Overflow })
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `messages: getLastN(20)` (Phase 3 v1) | Session-scoped L1 + L2 summaries + L3 rolling summary | Phase 4 | Context stays coherent across 20+ sessions |
| Single rolling append | Re-generate L3 from scratch at each session end | Phase 4 design (D-16) | Deterministic; no drift; simpler code |
| Vercel AI SDK `CoreMessage` | `ModelMessage` (renamed in AI SDK v6) | AI SDK v6 | Current codebase already uses `ModelMessage`; no action needed |
| `streamText()` only | `generateText()` alongside `streamText()` | AI SDK v4+ | Both confirmed available in installed v6 |

**Deprecated/outdated:**
- `messagesRepo.getLastN(campaignId, 20)` in ContextBuilder: replaced by `getBySessionId(sessionId)` with overflow fallback.
- ContextBuilder v1 `BuildContextArgs` without `sessionId`: replaced by v2 signature.

---

## Runtime State Inventory

> This is NOT a rename/refactor phase. However, there IS a data migration concern:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `messages` rows have no `session_id` (Phase 3 messages). After migration 0003, all existing rows will have `session_id = NULL`. | No data migration needed — NULL is the correct value for pre-Phase-4 messages. Code must guard against `getBySessionId(null)`. |
| Live service config | None — local SQLite only | None |
| OS-registered state | None | None |
| Secrets/env vars | None — session data stored in SQLite, not secrets | None |
| Build artifacts | `resources/migrations/_journal.json` must be updated when migration 0003 is generated | Run `drizzle-kit generate`, commit updated journal |

**Nothing found in most categories** — confirmed by codebase audit. The only migration concern is the null-session_id for Phase 3 messages, which is handled by design (nullable FK with NULL default).

---

## Open Questions

1. **D-06 Detection Timing — When Is "Unsummarized Session" Checked?**
   - What we know: `isSummarized = false` on sessions where `ended_at IS NOT NULL`.
   - What's unclear: The spec says "generates the summary in the background (or presents a brief prompt) before allowing a new session to start." The simplest implementation is: in `sessions.start`, check for any sessions with `ended_at IS NOT NULL AND is_summarized = false` before creating the new session. If found, run the rolling summary generation first (blocking the start briefly), then create the new session.
   - Recommendation: Implement as a pre-check in `sessions.start` — if there are unsummarized sessions, generate rolling summary synchronously (it's a ~5s LLM call, acceptable as a one-time startup cost), then proceed. The "no active session" state in the renderer means the chat is locked anyway, so the user sees the header button remain in "Starting…" state during the brief wait.

2. **isL1Overflow IPC propagation — Best channel?**
   - What we know: D-18 says "display a subtle warning in the chat area." The renderer needs to know about overflow.
   - What's unclear: Whether to add `isL1Overflow` to `ai:finish` payload (simplest) or add a new `ai:context-state` IPC push.
   - Recommendation: Append `isL1Overflow: boolean` to the existing `ai:finish` event payload. This keeps the IPC surface minimal and the renderer learns about overflow on the same event tick that the stream ends. The warning persists for the session duration via Zustand `isL1Overflow` flag.

3. **Session Recap Streaming — Does the recap stream through tRPC or through a separate IPC channel?**
   - What we know: tRPC v10 cannot stream (confirmed from Phase 3). The plan requires a dedicated IPC handler for `ai:recap-start`.
   - What's unclear: Should the recap streaming be a separate `ipcMain.handle('ai:recap-start', ...)` handler in `index.ts` (like `ai:send-message`), or should it be in a separate module?
   - Recommendation: Add `ai:recap-start` as a second `ipcMain.handle` in `index.ts`, co-located with `ai:send-message`. Both require the same campaign config loading, decryption, and provider setup. Keeping them in the same file avoids duplicating the security boilerplate. The handler uses `streamText()` (not `generateText()`) for the recap so it can stream to the modal.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ai` (Vercel AI SDK) | `generateText()` for recap/rolling summary | ✓ | 6.0.191 | — |
| `@radix-ui/react-scroll-area` | Session Journal ScrollArea | ✗ | — | Must install via shadcn add |
| `drizzle-kit` | Migration generation | ✓ | 0.31.10 (devDep) | — |
| `better-sqlite3` | sessionsRepo synchronous queries | ✓ | 12.10.0 | — |
| `@radix-ui/react-collapsible` | Journal session card expand/collapse | ✓ | 1.1.12 | — |

**Missing dependencies with no fallback:**
- `@radix-ui/react-scroll-area` — must be installed before Session Journal tab implementation. Install via `npx shadcn@latest add scroll-area`.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.0.0 |
| Config file | `vitest.config.ts` (electron-vite generated) |
| Quick run command | `npx vitest run src/main/` |
| Full suite command | `npx vitest run` |

**Pre-existing test failures:** 4 test files fail with `ERR_DLOPEN_FAILED` (better-sqlite3 native binding in Vitest's Node process — not Electron's Node). This is a known issue from Phase 3. It affects `campaignsRepo.test.ts`, `charactersRepo.test.ts`, `characters.test.ts`, and `messages.test.ts`. Phase 4 DB tests (sessionsRepo.test.ts, contextBuilder.test.ts) will likely have the same issue. The non-DB unit tests (111 currently passing) are the reliable baseline.

The approach established in Phase 3: DB-touching tests use the same `makeInMemoryDb()` + `vi.doMock('./index', () => ({ getDb: () => db }))` pattern. They pass in CI where the native module is properly compiled against the test runner's Node ABI.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-02 | ContextBuilder v2 assembles L1 from session messages | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ✅ (update existing) |
| SESS-02 | L1 overflow threshold triggers fallback + sets isL1Overflow | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ Wave 0 |
| SESS-02 | L2 summaries injected with correct labels and truncation | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ Wave 0 |
| SESS-02 | L3 rolling summary injected when present | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ Wave 0 |
| SESS-02 | System prompt injection order matches D-17 | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ Wave 0 |
| SESS-03 | sessionsRepo.create() returns row with correct sessionNumber | unit | `npx vitest run src/main/db/sessionsRepo.test.ts` | ❌ Wave 0 |
| SESS-03 | sessions.start tRPC sets activeSessionMap | unit | `npx vitest run src/main/trpc/routers/sessions.test.ts` | ❌ Wave 0 |
| SESS-04 | sessionsRepo.end() sets ended_at | unit | `npx vitest run src/main/db/sessionsRepo.test.ts` | ❌ Wave 0 |
| SESS-04 | sessionsRepo.saveRecap() persists aiRecap and playerNotes | unit | `npx vitest run src/main/db/sessionsRepo.test.ts` | ❌ Wave 0 |
| SESS-04 | generateSessionRecap() calls generateText with RECAP_SYSTEM_PROMPT | unit | `npx vitest run src/main/ai/recapGenerator.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/main/ai/contextBuilder.test.ts src/main/db/sessionsRepo.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (111 existing + new tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/db/sessionsRepo.test.ts` — covers SESS-03, SESS-04 DB layer
- [ ] `src/main/ai/recapGenerator.test.ts` — covers SESS-04 recap generation
- [ ] Update `src/main/ai/contextBuilder.test.ts` — add SESS-02 tests for v2 behavior
- [ ] `src/main/trpc/routers/sessions.test.ts` — covers tRPC procedure validation
- [ ] `src/renderer/src/components/ui/scroll-area.tsx` — install via `npx shadcn@latest add scroll-area`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Session here means game session, not auth session |
| V3 Session Management | No | Game sessions are not security sessions |
| V4 Access Control | No | Single-user desktop app |
| V5 Input Validation | Yes | All new tRPC procedures validate inputs via Zod (location: max 200 chars, goal/contextNotes: max 1000 chars, aiRecap: max ~50000 chars) |
| V6 Cryptography | Inherited | API key decrypt in main process only — unchanged from Phase 3 security contract |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized recap content injected as L2 memory | Tampering | Truncate L2 block to CHARS_L2_CAP (8000 chars) before injection into system prompt |
| Session ID spoofing from renderer | Tampering | Renderer passes `campaignId` only; main process derives `activeSessionId` from its own `sessionActiveMap` — renderer cannot inject a fake session ID into message writes |
| Plaintext session content over IPC | Information Disclosure | No change from Phase 3 — all session data (recap, notes) is non-secret and appropriate to send over IPC |
| Session not ended on app close | Data Loss | D-06 `before-quit` handler synchronously sets `ended_at`; `isSummarized = false` flag ensures rolling summary is generated on next open |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Character count / 4 approximates token count accurately enough for L1/L2/L3 thresholds | Pattern 1, ContextBuilder v2 | Over/under-estimating tokens by 50-100% could cause premature overflow or exceed model context window — mitigated by empirical tuning todo (STATE.md cross-phase todo) |
| A2 | `@radix-ui/react-scroll-area` at latest version integrates with the installed shadcn/ui and Tailwind v4 setup without compatibility issues | Standard Stack | Could require manual theme tweaks if new version changed CSS variable names — low risk given shadcn official support |
| A3 | `generateText()` in `ai@6.0.191` accepts the same `system` + `messages` API shape as `streamText()` | Pattern 4 | Minor: different parameter name would require adjustment. Confirmed by reading function signature from installed package |
| A4 | Background rolling summary generation with `Promise.resolve().then()` completes before the next session start in practice | Pattern 7 | Low risk: the rolling summary only matters for the NEXT session's L3 context. Even if it's still generating when the user immediately starts a new session, the L3 block would just be absent (prior value in campaigns.rolling_summary is unchanged until generateText completes) |

**Assumptions A1 and A4 are the highest-risk items.** Both are acknowledged as "best-effort" in the CONTEXT.md (D-18) and STATE.md (cross-phase todo).

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `src/main/ai/contextBuilder.ts` — v1 implementation, exact function signatures, reusable utilities (abilityMod, formatCharacterSummary, STRICTNESS_DIRECTIVES)
- `src/main/ai/aiSessionState.ts` — in-memory Map pattern for extension
- `src/main/db/schema.ts` — current schema (no session_id, no rolling_summary, no sessions table)
- `src/main/db/messagesRepo.ts` — existing query patterns to extend
- `src/main/trpc/routers/ai.ts` — existing AI router structure
- `src/main/trpc/routers/campaigns.ts` — tRPC mutation pattern (updateAiConfig)
- `src/main/index.ts` — `ai:send-message` IPC handler full implementation; app lifecycle hooks
- `src/preload/index.ts` — `window.aiStream` contextBridge pattern to extend
- `src/renderer/src/hooks/useAiStream.ts` — streaming hook pattern for `useRecapStream`
- `src/renderer/src/stores/panelSizeStore.ts` — Zustand store pattern
- `src/renderer/src/screens/CampaignViewScreen.tsx` — campaign header structure, tab structure
- `resources/migrations/_journal.json` — migration index (next is 0003_*)
- `node_modules/ai/dist/index.js` — confirmed `generateText` function exists and callable
- `package.json` — all installed versions verified

### Secondary (MEDIUM confidence — from planning documents)
- `.planning/phases/04-long-campaign-memory-session-flow/04-CONTEXT.md` — all locked decisions
- `.planning/phases/04-long-campaign-memory-session-flow/04-UI-SPEC.md` — full UI contract, component spec, copywriting

### Tertiary (LOW confidence — training knowledge, not independently verified this session)
- SQLite `ALTER TABLE ADD COLUMN` with FK reference behavior in SQLite v3.x [ASSUMED]
- `Promise.resolve().then()` as adequate background task scheduling in Electron main process [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- ContextBuilder v2 design: HIGH — derived directly from v1 source + locked decisions
- Drizzle migration pattern: HIGH — three prior migrations confirmed; SQLite ALTER TABLE behavior well-established
- tRPC session router: HIGH — exact pattern from existing routers
- generateText() API: HIGH — confirmed from installed package
- Token counting estimation: MEDIUM — character/4 is conventional but not verified against specific models
- Background task scheduling: MEDIUM — Promise.resolve().then() pattern is conventional Node.js but not benchmarked for this use case
- Pitfalls: HIGH — all derived from direct codebase analysis

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (stable stack; no fast-moving dependencies)
