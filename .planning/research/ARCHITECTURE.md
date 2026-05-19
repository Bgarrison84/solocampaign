# Architecture Patterns

**Domain:** Local Electron desktop app for solo D&D 5e with AI Dungeon Master
**Researched:** 2026-05-19
**Confidence:** HIGH for Electron patterns and data layer; HIGH for AI provider abstraction; MEDIUM for AI memory/summarization (rapidly evolving field, multiple competing approaches)

---

## Recommended Architecture

SoloCampaign is a three-tier local application running inside Electron, with strict separation between Node-privileged backend logic (main process) and presentation (renderer process). The opinionated architecture:

```
+--------------------------------------------------------------+
|                     RENDERER PROCESS                          |
|  (Chromium + React + Zustand — pure UI, no Node)              |
|                                                                |
|  +----------------+  +----------------+  +-----------------+   |
|  |  Chat Panel    |  | Right Tabs     |  | Modals/Dialogs  |   |
|  |  (streaming)   |  | (sheet/combat/ |  | (character      |   |
|  |                |  |  npcs/journal/ |  |  builder, etc)  |   |
|  |                |  |  inventory)    |  |                 |   |
|  +----------------+  +----------------+  +-----------------+   |
|           |                  |                   |             |
|           +------------------+-------------------+             |
|                              |                                 |
|                        UI Store (Zustand)                      |
|                  - mirror of game state slice                  |
|                  - ephemeral UI state                          |
|                              |                                 |
|                contextBridge / typed IPC (electron-trpc)       |
+------------------------------|---------------------------------+
                               |
+------------------------------|---------------------------------+
|                       MAIN PROCESS                             |
|              (Node.js — authoritative source of truth)         |
|                                                                |
|  +-------------------------------------------------------+    |
|  |              Application Services Layer               |    |
|  |                                                       |    |
|  |  CampaignService  CombatService   CharacterService    |    |
|  |  SessionService   QuestService    InventoryService    |    |
|  |  RestService      ProgressionSvc  WorldStateService   |    |
|  +-------------------------------------------------------+    |
|             |                |                |                |
|  +----------v----+  +--------v-----+  +-------v---------+     |
|  | AI Orchestrator|  | Repositories |  | Event Bus      |     |
|  |  - Context     |  | (one per     |  | (in-process    |     |
|  |    Builder     |  |  aggregate)  |  |  EventEmitter) |     |
|  |  - Provider    |  |              |  |                |     |
|  |    Adapter     |  +------+-------+  +----------------+     |
|  |  - Summarizer  |         |                                 |
|  +-------+--------+         |                                 |
|          |          +-------v--------+                        |
|          |          | better-sqlite3 |                        |
|          |          | + WAL + JSON1  |                        |
|          |          +----------------+                        |
|          |                                                    |
|  +-------v---------+   +---------------+   +---------------+  |
|  | LLM Provider    |   | SafeStorage   |   | FileSystem    |  |
|  | (Gemini/        |   | (API keys,    |   | (PDFs,        |  |
|  |  LM Studio/     |   |  encrypted)   |   |  portraits,   |  |
|  |  Jan/OAI-compat)|   |               |   |  exports)     |  |
|  +-----------------+   +---------------+   +---------------+  |
+----------------------------------------------------------------+
```

**Core principle:** The renderer is a "thin client" that displays state and dispatches intents. All game logic, AI orchestration, and persistence live in the main process. The renderer never imports `fs`, `better-sqlite3`, or calls LLM APIs directly. This protects API keys, keeps the UI responsive during AI streaming, and provides a clean serializable boundary for testing.

---

## Main Process vs Renderer Process Split

### Main Process Responsibilities
- **Persistence**: SQLite database access via better-sqlite3 (synchronous, native module — must run in Node)
- **AI orchestration**: All LLM HTTP calls (so API keys never touch the renderer; cloud requests can be retried server-side)
- **File I/O**: PDF/text rulebook imports, character portrait imports, campaign export/import
- **Secure storage**: API keys via Electron `safeStorage` (OS keychain integration)
- **Game rules engine**: SRD lookups, level-up calculations, encumbrance math, rest resource recovery
- **Session lifecycle**: Session start/end orchestration, summarization pipeline triggering
- **Domain services**: Combat resolution helpers, quest state machine, currency math
- **Auto-updater**: GitHub Releases polling for update notifications
- **Window management**: Single main window, dialog windows for builders if needed

### Renderer Process Responsibilities
- **All UI rendering**: React component tree, Tailwind/CSS, animations
- **Local UI state**: Currently-open tab, modal open/closed, scroll positions, form drafts
- **Mirror of game state**: A read-only projection synced from main, used for fast rendering
- **Dice roll animations**: Visual dice with deterministic results requested from main
- **Input collection**: Forms, character builder steps, chat input, action buttons
- **Streaming display**: Receives token stream from main and renders incrementally
- **Accessibility features**: Font scaling, high contrast, screen reader hooks

### Boundary Discipline
| Anti-Pattern | Why Bad | Correct Pattern |
|--------------|---------|-----------------|
| `nodeIntegration: true` | Lets renderer execute Node code — huge security hole | Always `contextIsolation: true` + `nodeIntegration: false` |
| Direct `fetch()` to LLM from renderer | Leaks API key to webContents devtools / extensions | LLM calls only from main; renderer subscribes to streamed deltas |
| SQLite imported in renderer | Breaks ASAR packaging, blocks UI thread | `better-sqlite3` only in main; renderer queries via IPC |
| Synchronous `ipcRenderer.sendSync` | Freezes the UI | Always `ipcRenderer.invoke` (async) — or RPC framework |

(Confidence: HIGH — Electron official docs and community consensus, see [Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) and [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc).)

---

## Recommended IPC Layer: electron-trpc

Hand-rolled `contextBridge.exposeInMainWorld({ getCampaign, ... })` becomes a maintenance burden once you have 40+ operations (and a D&D app will have many). Recommended pattern:

- Use **electron-trpc** for type-safe RPC. The main process defines a tRPC router (queries, mutations, subscriptions); the renderer gets a fully-typed client. Subscriptions map naturally to AI token streams and game-state change notifications.
- Reasonable alternative: `electron-typescript-ipc` — lighter weight, no tRPC dependency, still gives type-safe IPC channels. Pick this if tRPC feels like overkill.

**Why this matters for SoloCampaign specifically:** The app has both request/response patterns (load campaign, save character, roll dice) and streaming patterns (AI narration tokens, game-state change events). tRPC's subscriptions handle the streaming case cleanly without inventing a custom event protocol.

(Confidence: MEDIUM-HIGH — pattern is well-established but choice between tRPC vs lighter alternative is a taste judgement. Both are valid.)

---

## Data Layer Architecture

### Stack
- **better-sqlite3** (synchronous, single-threaded, lowest overhead). Synchronous is fine because all DB work happens in main process which doesn't block the renderer.
- **WAL mode enabled** for better concurrent read while writing (matters when summarizer is running).
- **SQLite JSON1 extension** (built into modern SQLite) for the hybrid relational/JSON pattern.
- **No ORM**. For a fixed local schema with full control, an ORM adds indirection without payoff. Use a thin repository layer with hand-written SQL.

### Schema Strategy: Hybrid Relational + JSON
The D&D 5e domain has two distinct data shapes:

1. **Structured / queryable / referenced**: campaign metadata, characters (top-level fields), inventory items, NPCs, quests, sessions, messages.
2. **Deeply nested / opaque / display-only**: full character sheet (spells known, feats, class features, race traits, ability scores breakdown), session summaries, world brief, custom homebrew.

Storing every spell-slot-per-day-per-class as a separate table becomes an unmaintainable join hell. Storing everything as a single JSON blob makes querying ("which characters have Healing Word prepared?") expensive. The hybrid approach:

- **Top-level fields as columns**: campaign_id, name, hp, max_hp, level, class_summary, location, created_at, updated_at.
- **Complex nested data as JSON columns**: sheet_data, spell_data, conditions, custom_data.
- Use SQLite JSON1 functions (`json_extract`, `json_each`) when needed.

### Core Schema (conceptual)

```sql
-- Campaign aggregate (each row is one save file)
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cover_image_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- AI configuration
  ai_provider_id TEXT NOT NULL,         -- 'gemini' | 'openai-compatible' | etc
  ai_endpoint_url TEXT,                 -- for local LLMs
  ai_model TEXT,
  ai_api_key_ref TEXT,                  -- safeStorage handle, NOT the key itself
  dm_personality TEXT,
  rules_strictness TEXT,                -- 'raw' | 'flexible' | 'narrative'
  -- Per-campaign settings
  permadeath_enabled INTEGER NOT NULL DEFAULT 0,
  encumbrance_enabled INTEGER NOT NULL DEFAULT 0,
  -- Denormalized world state for fast load
  world_brief TEXT,                     -- JSON: setting, factions, tone
  world_state TEXT,                     -- JSON: time, calendar, weather, location breadcrumb
  factions TEXT                         -- JSON array
);

-- Characters (1..4 per campaign)
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_player_controlled INTEGER NOT NULL DEFAULT 1,
  is_companion INTEGER NOT NULL DEFAULT 0,
  -- Quick-access live tracking columns
  level INTEGER NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  hp_current INTEGER NOT NULL,
  hp_max INTEGER NOT NULL,
  hp_temp INTEGER NOT NULL DEFAULT 0,
  death_save_successes INTEGER NOT NULL DEFAULT 0,
  death_save_failures INTEGER NOT NULL DEFAULT 0,
  inspiration INTEGER NOT NULL DEFAULT 0,
  portrait_path TEXT,
  -- Full sheet as JSON (race, class breakdown, abilities, feats, skills, features)
  sheet_data TEXT NOT NULL,
  -- Spell state as JSON (slots used/max, known/prepared, concentration)
  spell_data TEXT,
  -- Active conditions
  conditions TEXT NOT NULL DEFAULT '[]',
  -- Negative traits (mechanical and narrative)
  negative_traits TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_characters_campaign ON characters(campaign_id);

-- Inventory (each item is a row — small enough to be flat)
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight REAL,
  equipped INTEGER NOT NULL DEFAULT 0,
  attuned INTEGER NOT NULL DEFAULT 0,
  item_data TEXT,                       -- JSON: description, magic properties, charges
  source TEXT                           -- 'srd' | 'ai-generated' | 'homebrew'
);
CREATE INDEX idx_inventory_character ON inventory_items(character_id);

-- Currency (one row per character)
CREATE TABLE currency (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  cp INTEGER NOT NULL DEFAULT 0,
  sp INTEGER NOT NULL DEFAULT 0,
  ep INTEGER NOT NULL DEFAULT 0,
  gp INTEGER NOT NULL DEFAULT 0,
  pp INTEGER NOT NULL DEFAULT 0
);

-- NPCs (auto-populated by AI)
CREATE TABLE npcs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  relationship_notes TEXT,
  first_met_session_id TEXT,
  last_seen_session_id TEXT,
  metadata TEXT                         -- JSON: faction, location, etc
);

-- Quests
CREATE TABLE quests (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,                 -- 'active' | 'complete' | 'failed' | 'abandoned'
  created_session_id TEXT,
  completed_session_id TEXT,
  metadata TEXT                         -- JSON: rewards, related_npcs, location
);

-- Sessions (each save/resume is bounded by a session)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  starting_location TEXT,
  session_goal TEXT,
  ai_recap TEXT,                        -- AI-generated end-of-session summary
  player_notes TEXT,                    -- Player free-form notes
  rolling_summary TEXT                  -- Cumulative rolling summary up to this session
);
CREATE INDEX idx_sessions_campaign ON sessions(campaign_id);

-- Chat messages (the play-by-play transcript)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,            -- denormalized for fast filter
  role TEXT NOT NULL,                   -- 'player' | 'dm' | 'system' | 'dice'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  token_count INTEGER,                  -- cached for context budgeting
  metadata TEXT                         -- JSON: dice rolls, mechanical events
);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_messages_campaign ON messages(campaign_id, created_at);

-- Combat encounters (lives only during combat)
CREATE TABLE combat_encounters (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  current_round INTEGER NOT NULL DEFAULT 1,
  current_turn_combatant_id TEXT,
  combatants TEXT NOT NULL,             -- JSON array: initiative, hp, conditions
  log TEXT NOT NULL DEFAULT '[]'        -- JSON array of round events
);

-- Homebrew content (per campaign or global)
CREATE TABLE homebrew (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,                     -- NULL = global
  kind TEXT NOT NULL,                   -- 'feat' | 'item' | 'spell' | 'rule' | 'race' | 'class'
  name TEXT NOT NULL,
  content TEXT NOT NULL                 -- JSON
);

-- Reference SRD content (read-only, bundled at build time, never modified)
-- Loaded from JSON files, NOT from this DB — keeps user DB lean
-- Alternative: ship as a second SQLite file (srd.db) opened read-only

-- Settings (global app settings, single row)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL                   -- JSON
);

-- Migration tracking
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
```

### Repository Pattern
One repository per aggregate root: `CampaignRepository`, `CharacterRepository`, `SessionRepository`, `MessageRepository`, `QuestRepository`, `NPCRepository`, `InventoryRepository`. Each owns its SQL and returns domain objects to services. This isolates schema changes from business logic.

### Migrations
A simple linear migration runner that reads `migrations/001_initial.sql`, `002_add_companions.sql`, etc. and applies any unapplied versions on app start. No need for a heavyweight migration library at this scale.

### Database File Location
- Default: Electron `app.getPath('userData')/campaigns.db`
- User-configurable: app can read a redirect file pointing to a different location (satisfies "option to move to custom folder" requirement).
- SRD reference: bundled as `resources/srd.db` (read-only) or as JSON files loaded into memory on demand.

(Confidence: HIGH for schema strategy; HIGH for better-sqlite3 choice — see [SQLite + Electron guide](https://www.freecodecamp.org/news/how-to-build-an-electron-desktop-app-in-javascript-multithreading-sqlite-native-modules-and-1679d5ec0ac/). MEDIUM on exact column breakdown — refine during implementation.)

---

## AI Provider Abstraction Layer

### Pattern: Adapter + OpenAI-Compatible Default

Define one provider interface, ship multiple implementations:

```typescript
interface LLMProvider {
  readonly id: string;
  readonly displayName: string;

  // Single-shot completion (used for summaries, structured outputs)
  complete(req: CompletionRequest): Promise<CompletionResponse>;

  // Streaming completion (used for DM narration)
  stream(req: CompletionRequest, opts: { signal: AbortSignal }):
    AsyncIterable<StreamChunk>;

  // Capabilities probe (some providers don't support structured output, etc)
  capabilities(): ProviderCapabilities;

  // Health check (used before starting a session)
  ping(): Promise<{ ok: boolean; latencyMs?: number; error?: string }>;

  // Token counting (used for context budgeting)
  countTokens(text: string): number;     // best-effort, can be approximate
}
```

### Implementations
1. **OpenAICompatibleProvider** — single class that talks to any `/v1/chat/completions` endpoint. Covers LM Studio, Jan AI, Ollama (in OpenAI-compat mode), llama.cpp server, OpenAI itself, OpenRouter, vLLM, and many more. This is the workhorse — most providers are just OpenAI-compatible URL + key.
2. **GeminiProvider** — Google's API is NOT OpenAI-compatible by default; needs its own implementation. (Gemini does have a separate OpenAI-compat endpoint, but the native API is more capable. Recommendation: support both — auto-detect.)
3. (Future) Anthropic, Cohere, etc. — add as separate adapters if demanded.

### Why a Real Abstraction (Not Just "Use Vercel AI SDK")
The Vercel AI SDK is excellent for OpenAI-compatible endpoints, but using it as the only layer creates lock-in to its capabilities. For SoloCampaign:
- You need provider-specific health checks (LM Studio shows different errors than Gemini).
- You need provider-specific fallback logic ("Gemini failed → prompt user to switch to local LM Studio").
- You need to display provider-specific quirks in UI (Jan's loaded model name, LM Studio's port).

Treat the SDK as an implementation detail of the OpenAI-compatible adapter, not the public interface.

### Configuration Storage
- Per-campaign provider config lives in `campaigns.ai_provider_id` etc.
- API keys NEVER stored in plaintext SQL. Store via `safeStorage.encryptString()` and write the encrypted buffer (base64) to `campaigns.ai_api_key_ref`. Decrypt only when making a call.
- Linux note: warn user if no system keychain detected (safeStorage falls back to a hardcoded password — better than plaintext but acknowledge it).

### Fallback Chain
A `ProviderRouter` wraps providers. Logic:
1. Try primary provider with N retries (exponential backoff for cloud, 1 retry for local).
2. On final failure, surface a UI prompt: "Gemini is unavailable. Switch to your local LM Studio endpoint? [Yes / Wait / Cancel]"
3. If user picks Yes, swap provider for this session only (don't permanently change campaign config without explicit save).

(Confidence: HIGH — this is a well-trodden pattern. See [Continue's OpenAI Adapters](https://deepwiki.com/continuedev/continue/4.3-extension-activation-and-setup), [Vercel openai-compatible](https://www.npmjs.com/package/@ai-sdk/openai-compatible).)

---

## Session Summarization Pipeline

This is the load-bearing architectural piece. Long campaigns over months of play will explode any context window. The pipeline:

### Three-Layer Memory Model

```
+----------------------------------------------------------+
|   LAYER 1: HOT CONTEXT (verbatim, sent every turn)       |
|   - System prompt (DM personality, rules strictness)     |
|   - World brief (~500-1500 tokens)                       |
|   - Active character sheets (compact form)               |
|   - Active quests                                        |
|   - Active combat state (if any)                         |
|   - Recent NPCs (last 5-10 met)                          |
|   - Last K messages of current session (verbatim)        |
|     (K dynamically chosen based on token budget)         |
+----------------------------------------------------------+
|   LAYER 2: SESSION SUMMARIES (compressed, recent)        |
|   - Per-session AI recaps (last 3-5 sessions)            |
|   - Each ~300-500 tokens                                 |
+----------------------------------------------------------+
|   LAYER 3: ROLLING CAMPAIGN SUMMARY (heavily compressed) |
|   - Single ~1000-2000 token summary of everything older  |
|   - Updated after each session: new = compress(          |
|       old_rolling + last_session_recap)                  |
+----------------------------------------------------------+
```

### Pipeline Stages

**On every user input (chat turn):**
1. **Context Builder** assembles the prompt from layers 1-3 + the user message.
2. Token budgeting: if total exceeds (model_context - response_budget), aggressively trim Layer 1's K messages first, then drop oldest session summaries.
3. **Provider Adapter** streams the response.
4. Tokens stream to renderer via tRPC subscription / IPC events.
5. On stream complete, persist the full message; persist any extracted structured events (XP awarded, quest added, NPC met, inventory change) by parsing tool/function calls or a structured tail.

**On session end:**
1. **Summarizer** runs (uses the same LLM or a separate "cheaper" model if configured):
   - Input: full session transcript + previous session summary
   - Output: structured session recap (narrative summary, key NPCs, quest changes, character changes, locations visited)
2. Persist `sessions.ai_recap`.
3. Update `sessions.rolling_summary` = LLM.compress(prior_rolling_summary + new_recap).
4. Prompt user to add player notes.

**On session start (resume):**
1. Show structured prompt: "Where are you? What's your goal? Any context?"
2. Context Builder assembles fresh Layer 1+2+3 from DB.
3. AI generates opening narration based on the rolling summary, recent session summaries, and the user's session-start context.

### Structured Event Extraction
The AI narration is plain text, but mechanical effects (XP awarded, NPC met, quest progressed) need to update the database. Two viable strategies:

- **Function calling / tool use**: If the provider supports it, define tools like `award_xp(amount, reason)`, `add_npc(...)`, `update_quest(...)`. Strongest reliability.
- **Structured tail**: Prompt the AI to end each response with a JSON block like `<gamestate>{"xp_awarded": 50, "quest_added": "..."}</gamestate>`. Parse the block, strip from displayed text. Works on any model. Recommended default since SoloCampaign needs to work with local LLMs that may lack tool support.

Build both. Use tool-calling when capability probe says it's supported; fall back to structured tail otherwise.

### Anti-Patterns
- **Sending the full transcript every turn**: Quietly works at session 1; chokes at session 20.
- **Skipping the rolling summary**: Loses early-campaign context that matters at level 15.
- **Trusting the AI to update the DB itself**: It can't — the main process owns persistence. Always parse structured events and apply them via services.

(Confidence: HIGH for the three-layer pattern — [recursive summarization paper](https://arxiv.org/html/2308.15022v3), [rolling summary memory](https://apxml.com/courses/getting-started-with-llm-toolkit/chapter-7-conversational-applications-with-memory/summary-memory-for-long-conversations). MEDIUM on exact token allocations — depends on chosen model.)

---

## State Management Patterns

### Authoritative State in Main Process
Game state lives in SQLite. Services in the main process are the only writers. This avoids the "two stores" desync nightmare common in Electron apps.

### Renderer State: Zustand Slices
The renderer has two kinds of state:
1. **Mirror state**: A read-projection of the current campaign's game state. Loaded on campaign open; updated via push events from main when services mutate.
2. **UI state**: Modal open/closed, current tab, form drafts, scroll position. Lives only in the renderer.

Recommended: **Zustand** with one store per concern:
- `useCampaignStore` — current campaign metadata, world state
- `useCharacterStore` — characters array
- `useChatStore` — current session messages, streaming buffer
- `useCombatStore` — active combat state (or null)
- `useUIStore` — modals, tabs, sidebar state

Subscriptions from main → renderer push state diffs into the right store. Renderer components select narrow slices to avoid re-renders.

### Why Zustand over Redux
- D&D state is mostly straightforward CRUD on aggregates; you don't benefit from action/reducer ceremony.
- Minimal boilerplate; first-class TypeScript inference.
- Smaller bundle, simpler mental model.
- If you later need time-travel debugging, Zustand has a devtools middleware.
- Redux-electron syncing solutions exist but add a layer of complexity you don't need given the "main is authoritative" model.

### Why Not Sync the Full Store via IPC
Don't ship the entire game state to the renderer on every mutation. Two patterns:
1. **Targeted updates**: When `CharacterService.applyDamage(charId, 5)` runs, it emits an event `character:updated` with the new character object; main pushes it; renderer's `useCharacterStore` patches just that entry.
2. **Query invalidation**: For complex updates, emit `campaign:invalidate` and let the renderer re-fetch what it needs. Works well with tRPC's `invalidate` pattern.

### Event Bus (Main Process Internal)
In the main process, a simple `EventEmitter` (or Node's built-in events) connects services to the IPC push layer:

```
CombatService.endTurn() → emits 'combat:turn-changed'
                       → CombatRepository persists
                       → IPC layer broadcasts to all renderer subscribers
                       → renderer Zustand updates
```

This decouples services from knowing about renderers, makes services testable in isolation, and keeps the streaming pipeline natural.

(Confidence: HIGH on Zustand recommendation for this size of app; HIGH on "main is authoritative" pattern; MEDIUM on exact sync mechanism — depends on whether you adopt tRPC subscriptions or roll your own IPC events.)

---

## Component Boundaries & Data Flow

### Vertical Slice: Player Sends a Chat Message

```
[Renderer: ChatInput]
  ─(user submits "I attack the goblin")─►
[Renderer: useChatStore.sendMessage]
  ─(tRPC mutation: session.sendMessage)─►
[Main: SessionService.sendMessage]
  ├─(persist player message to messages table)
  ├─(ContextBuilder.build(campaignId, sessionId))
  │   ├─(load Layer 1: characters, quests, recent messages)
  │   ├─(load Layer 2: recent session summaries)
  │   ├─(load Layer 3: rolling summary)
  │   └─(assemble system + user prompt within token budget)
  ├─(LLMProvider.stream(prompt))
  │   └─[as tokens arrive] ──(tRPC subscription)──►
  │                              [Renderer: useChatStore appends to buffer]
  ├─(on stream complete: persist DM message)
  ├─(StructuredEventParser.parse(full_response))
  │   ├─if {xp_awarded}    → ProgressionService.awardXP(charId, amount)
  │   ├─if {quest_added}   → QuestService.create(...)
  │   ├─if {npc_met}       → NPCService.upsert(...)
  │   └─if {inventory_*}   → InventoryService.applyChange(...)
  └─(emit events; renderer stores patch)
```

### Vertical Slice: Player Rolls Dice for Their Character

```
[Renderer: Dice button on character sheet]
  ─(invoke: dice.roll({expr: "1d20+5"}))─►
[Main: DiceService.roll]
  └─(returns deterministic result)
[Renderer: shows animation, asks "Send to DM?"]
  ─(on confirm: session.sendMessage with dice metadata)─►
[Main: same flow as above, dice result becomes a system-prefix line]
```

### Vertical Slice: End of Session

```
[Renderer: End Session button]
  ─(invoke: session.end(sessionId))─►
[Main: SessionService.end]
  ├─(LLMProvider.complete with summarization prompt)
  ├─(persist sessions.ai_recap)
  ├─(LLMProvider.complete with rolling summary update prompt)
  ├─(persist sessions.rolling_summary)
  └─(emit 'session:ended' with recap)
[Renderer: shows recap, prompts for player notes]
  ─(invoke: session.savePlayerNotes(sessionId, notes))─►
[Main: SessionService.saveNotes → done]
```

### Component Boundary Table

| Component | Lives In | Responsibility | Communicates With |
|-----------|----------|---------------|-------------------|
| `MainWindow` | Main | Window lifecycle, IPC bootstrap | Electron API, tRPC router |
| `tRPC Router` | Main | Type-safe API surface | All Services |
| `CampaignService` | Main | Campaign CRUD, settings | CampaignRepository, FileSystem |
| `CharacterService` | Main | Character mutations, level-up | CharacterRepository, RulesEngine |
| `SessionService` | Main | Session lifecycle, summarization triggering | SessionRepo, MessageRepo, ContextBuilder, LLM |
| `CombatService` | Main | Initiative, turn order, conditions | CombatRepository, EventBus |
| `QuestService` | Main | Quest state machine | QuestRepository |
| `InventoryService` | Main | Item CRUD, currency | InventoryRepository |
| `NPCService` | Main | NPC tracking | NPCRepository |
| `ProgressionService` | Main | XP, level-up, epic boons | CharacterRepo, RulesEngine |
| `RestService` | Main | Short/long rest resource recovery | CharacterRepo, RulesEngine |
| `WorldStateService` | Main | Time, calendar, factions, location | CampaignRepo |
| `ContextBuilder` | Main | Assemble LLM prompt from DB | All repositories |
| `LLMProvider` (interface) | Main | LLM abstraction | HTTP / network |
| `Summarizer` | Main | Multi-stage summarization | LLMProvider, ContextBuilder |
| `RulesEngine` | Main | Pure functions: SRD lookups, math | (none — pure) |
| `DiceService` | Main | Deterministic dice rolls | (none — pure RNG) |
| `EventBus` | Main | Internal events | All services |
| `Repositories` | Main | SQL access per aggregate | better-sqlite3 |
| `tRPC Client` | Renderer | Type-safe client | tRPC Router via IPC |
| `Zustand Stores` | Renderer | Mirror + UI state | tRPC client, React |
| `React Components` | Renderer | Render UI | Zustand stores |
| `Chat Panel` | Renderer | Streaming display | useChatStore |
| `Right Tabs` | Renderer | Sheet/Combat/NPC/Journal/Inventory | corresponding stores |
| `Character Builder` | Renderer | Multi-step wizard | useCharacterStore + SRD data |

---

## Patterns to Follow

### Pattern: Service + Repository + Domain Object
**What:** Services contain business logic and orchestrate; repositories own SQL; domain objects are plain TypeScript types/interfaces (no behavior). Avoid ActiveRecord.
**When:** All persistence-touching code.
**Why:** Lets you change schema, swap to a different DB engine, or test services with mock repositories without rewriting business logic.

```typescript
// Domain type
interface Character {
  id: string;
  campaignId: string;
  name: string;
  level: number;
  hp: { current: number; max: number; temp: number };
  // ... etc, but no methods
}

// Repository (data access only)
class CharacterRepository {
  constructor(private db: Database) {}
  findById(id: string): Character | null { /* SELECT ... */ }
  save(c: Character): void { /* INSERT/UPDATE ... */ }
  findByCampaign(campaignId: string): Character[] { /* ... */ }
}

// Service (business logic, uses repos + emits events)
class CharacterService {
  constructor(
    private repo: CharacterRepository,
    private events: EventBus,
    private rules: RulesEngine
  ) {}

  applyDamage(charId: string, amount: number): Character {
    const c = this.repo.findById(charId);
    if (!c) throw new NotFound();
    const next = this.rules.applyDamage(c, amount); // pure
    this.repo.save(next);
    this.events.emit('character:updated', next);
    return next;
  }
}
```

### Pattern: Pure Rules Engine
**What:** `RulesEngine` is a collection of pure functions: `applyDamage(char, n) → char`, `awardXP(char, n) → char`, `canCastSpell(char, spell) → boolean`. No I/O, no DB, no async.
**Why:** SRD rules are deterministic and complex. Pure functions are trivial to unit test and reason about. Services compose them.

### Pattern: Structured AI Output Contract
**What:** Define a strict JSON schema for AI-emitted structured events (XP, quests, NPCs, inventory). Validate with Zod on parse. Reject malformed payloads gracefully — don't crash the session.

### Pattern: Token-Budget-Aware Context Builder
**What:** `ContextBuilder.build(campaignId)` receives the model's context window size and a target response budget. It assembles layers 1-3, computing token costs as it goes, and trims the verbatim message tail until the budget fits.
**Why:** Prevents 4097-token-overflow errors from killing the session.

### Pattern: Streaming with AbortSignal
**What:** All LLM streaming accepts an `AbortSignal`. The renderer can cancel a running narration. Main process tears down the HTTP request cleanly.
**Why:** Players will hit "Stop" mid-narration. Don't leak HTTP connections.

### Pattern: Per-Campaign Database File (Optional Future)
**What:** Currently one DB with `campaign_id` foreign keys. A future option: one SQLite file per campaign, enabling clean campaign exports (just copy the file).
**Why:** "Campaign sharing" requirement gets dramatically simpler. Implement single-DB now; consider per-campaign DB later if exports become painful.

---

## Anti-Patterns to Avoid

### Anti-Pattern: Renderer Owns Game State
**What:** Building the game logic in React components ("useState for HP", "useEffect to save"), with the main process as a dumb file store.
**Why bad:** State desync across tabs/windows, races during save, no testability, security (LLM keys leak), and rewrite pain when you add the second window.
**Instead:** Main process is authoritative. Renderer is a view.

### Anti-Pattern: Single Mega-Service ("CampaignService" doing everything)
**What:** One giant service class that handles characters, combat, quests, inventory, AI, summarization, rests...
**Why bad:** Becomes untestable, unmaintainable, and tightly coupled within a few months.
**Instead:** One service per aggregate. Cross-aggregate orchestration goes in higher-level "session flow" coordinators that compose services.

### Anti-Pattern: AI Mutates DB Directly via Tool Calls
**What:** Letting the LLM call functions that directly INSERT/UPDATE the database.
**Why bad:** The AI hallucinates. It will award 10,000 XP, delete the wrong character, or grant a +5 sword to a level 1 PC.
**Instead:** AI emits structured events; services validate (with rules engine) and apply. Reject or sanitize impossible events. Surface AI-proposed changes to player when they're large (e.g., level-up bonuses).

### Anti-Pattern: Full-History Prompts
**What:** Concatenating every message ever sent into the LLM prompt.
**Why bad:** Works for 3 sessions; breaks at session 10; impossible at session 30.
**Instead:** The three-layer memory model above.

### Anti-Pattern: Storing API Keys in Plain SQL or JSON
**What:** Putting the Gemini API key into `campaigns.api_key TEXT NOT NULL`.
**Why bad:** A single export, accidental log, or backup leaks the key in plaintext.
**Instead:** Electron `safeStorage.encryptString` → store the encrypted buffer.

### Anti-Pattern: Blocking the UI on Summarization
**What:** Running session summarization synchronously when the user clicks "End Session" and showing a spinner for 30 seconds.
**Why bad:** Bad UX. Wastes the user's time.
**Instead:** Run summarization in background after the user has dismissed the session-end dialog. Show "summarizing previous session…" indicator. Only block on summary when starting the next session if it isn't ready yet.

### Anti-Pattern: Reusing the Same SQLite Connection Across Concurrent Writes
**What:** Multiple async operations all trying to write through the same better-sqlite3 connection without serialization.
**Why bad:** better-sqlite3 is synchronous; concurrent ops are serialized at the call site. Mixing async-await around DB calls can interleave a transaction incorrectly.
**Instead:** Wrap multi-statement writes in `db.transaction(fn)`. Treat the main process as single-threaded for DB ops (it is). Document the invariant.

### Anti-Pattern: Tight Coupling to Gemini's SDK
**What:** Importing `@google/generative-ai` throughout services.
**Why bad:** Locks you to Gemini. Hard to test. Breaks offline-only requirement.
**Instead:** Hide it behind `LLMProvider` interface from day one.

---

## Scalability Considerations

This is a single-user local app, so "scalability" is about campaign size, not concurrent users.

| Concern | At Session 1 | At Session 50 | At Session 200 |
|---------|--------------|---------------|-----------------|
| Message count | <100 | ~5,000–10,000 | ~20,000–40,000 |
| DB size | <1 MB | ~30–100 MB | ~200–500 MB |
| Context build time | <50ms | <100ms (indexed queries) | <200ms |
| Rolling summary update | <5s | <10s | <15s (longer summary input) |
| Session load time | <100ms | <500ms (selective load) | <1s (paginated history) |

Implications:
- Don't load all messages on session open. Page or lazy-load older messages on scroll-up.
- Index `messages(session_id, created_at)` and `messages(campaign_id, created_at)`.
- Token counts cached per message (in `messages.token_count`) so context budgeting doesn't re-tokenize history.
- VACUUM the DB periodically (e.g., on app startup if last VACUUM > 30 days ago).
- Consider a periodic "deep summary" pass that condenses rolling summaries even further every N sessions.

---

## Suggested Build Order

The architecture has natural seams. Build outward from the foundation:

### Phase A — Foundation (no AI yet)
**Goal: Boot a window, save a campaign, edit a character. Prove the data layer end-to-end.**

1. **Project scaffold**: electron-vite + React + TypeScript + Tailwind. Strict contextIsolation, no nodeIntegration. Single window, blank shell.
2. **DB layer**: better-sqlite3 + WAL + migrations runner + schema_version table. Create the initial schema. Smoke-test with a manual seed campaign.
3. **IPC layer**: Pick electron-trpc (or electron-typescript-ipc). Wire one round-trip ("ping") end-to-end. Establish the pattern.
4. **Repositories**: CampaignRepository, CharacterRepository, SessionRepository. Plus thin services to expose them.
5. **Renderer skeleton**: Zustand stores wired to tRPC. App shell: main window with campaign list, "New Campaign" flow, basic split-pane (chat-left empty, tabs-right empty).
6. **Character builder MVP**: Just enough to create a character (race, class, ability scores, HP) and persist it. SRD JSON data loaded statically. This forces you through the largest domain model and validates the schema.
7. **Right-panel tabs (read-only)**: Show the persisted character on the Character Sheet tab. Inventory tab shows currency + items list.

*At end of Phase A: you can create a campaign, build a character, see them in the UI. No AI yet. Everything persists across restarts.*

### Phase B — AI Integration (minimum viable DM)
**Goal: Connect a real LLM and get a chat working end-to-end.**

8. **LLMProvider interface + OpenAICompatibleProvider**. Test against LM Studio first (fastest local iteration loop).
9. **API key safe storage** via Electron safeStorage. Settings UI for per-campaign provider config.
10. **ContextBuilder v1**: Builds the simplest possible prompt — system + character sheet + last N messages. No summarization yet (single-session play only).
11. **Chat panel with streaming**: Player types, message persists, LLM streams response, tokens render incrementally. Cancel button works.
12. **Provider fallback UX**: Health-check before session start; surface a switch-provider prompt on failure.
13. **GeminiProvider** as second adapter to validate the interface.

*At end of Phase B: you can play a one-session adventure. Conversations work. AI sees the character. No long-campaign capability yet.*

### Phase C — Long-Campaign Survival
**Goal: Make multi-session play viable.**

14. **Session lifecycle**: Start session (with location/goal prompt), end session, save/resume.
15. **Summarizer**: End-of-session AI recap; persist to `sessions.ai_recap`.
16. **Rolling summary**: Update `sessions.rolling_summary` at session end.
17. **ContextBuilder v2 (three-layer)**: Integrates rolling summary + recent session summaries + verbatim tail. Token budgeting.
18. **Session journal tab**: Renders AI recap + player notes side-by-side.

*At end of Phase C: you can play a 10+ session campaign and the AI still has coherent context. This is the architectural keystone — verify it actually works at scale.*

### Phase D — Game Mechanics Depth
**Goal: Real D&D rules engine and structured events.**

19. **Structured event parser**: Tool-call + tail-JSON modes. Wire events to services (XP, quests, NPCs, inventory, currency).
20. **RulesEngine**: SRD rules, level-up, rest recovery, encumbrance, spell slot tracking, concentration.
21. **Combat module**: Initiative tracker, turn order, condition tracking, HP updates, AI as enemy controller.
22. **DiceService + dice UI**: In-app roller; results feed into chat.
23. **Quest tracker, NPC tracker, faction/reputation**: Tabs fully wired to AI-emitted structured events.

*At end of Phase D: a serious mechanical D&D experience, not just chat-with-flavor.*

### Phase E — Content & Polish
24. **SRD reference browser** (read-only UI for bundled SRD content).
25. **PDF/text rulebook import** for user-supplied content.
26. **Homebrew editor** (feats, items, custom rules).
27. **Character builder full feature** (feats, spells, multiclass, negative traits).
28. **Companions/familiars/summons** tracked as party members.
29. **Death/permadeath modes, attunement tracking, Epic Boons**.

### Phase F — Distribution
30. **Campaign export/import** (JSON / SQLite file).
31. **Character sheet PDF export**.
32. **electron-builder** packaging for Win/Mac/Linux.
33. **GitHub Releases auto-update notifier**.
34. **Accessibility pass** (font scaling, high contrast, ARIA, screen reader, keyboard nav).
35. **Public release**.

### Why This Order
- **Foundation first**: Without the DB + IPC + UI shell working, you can't validate anything else. These have to be right.
- **Character before AI**: Forces you through the most complex domain model with no AI distractions. Surfaces schema and UI issues early.
- **One-session AI before long-campaign AI**: Validates the provider abstraction before you bet on summarization.
- **Summarization before mechanics**: The summarization pipeline is the highest-risk architectural piece. Prove it works before adding feature volume on top.
- **Mechanics before polish**: D&D feel comes from real mechanics. Don't polish a thin chat layer.
- **Distribution last**: Don't fight electron-builder until you have something worth shipping.

### Dependency Graph
```
Foundation (1-7) → AI Integration (8-13) → Long-Campaign Survival (14-18)
                                              │
                                              ▼
                                      Game Mechanics (19-23)
                                              │
                                              ▼
                                      Content & Polish (24-29)
                                              │
                                              ▼
                                      Distribution (30-35)
```

Phases A, B, C are strictly sequential. Within Phase D the order is somewhat fungible (combat could come before quests, etc.). Phase E can be parallelized once D is solid.

---

## Sources

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — HIGH
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — HIGH
- [Electron contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge) — HIGH
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — HIGH
- [electron-vite Getting Started](https://electron-vite.org/guide/) — HIGH
- [electron-trpc: Type-safe IPC via tRPC](https://electron-trpc.dev/) — HIGH
- [electron-typescript-ipc (alternative)](https://www.npmjs.com/package/electron-typescript-ipc) — MEDIUM
- [How to Build an Electron Desktop App with SQLite (freeCodeCamp)](https://www.freecodecamp.org/news/how-to-build-an-electron-desktop-app-in-javascript-multithreading-sqlite-native-modules-and-1679d5ec0ac/) — HIGH
- [better-sqlite3 + Electron integration guide](https://dev.to/arindam1997007/a-step-by-step-guide-to-integrating-better-sqlite3-with-electron-js-app-using-create-react-app-3k16) — MEDIUM
- [Repository Pattern (Khalil Stemmler)](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/) — HIGH
- [Vercel AI SDK: OpenAI-Compatible Providers](https://deepwiki.com/vercel/ai/3.7-openai-compatible-providers-and-adapter-pattern) — HIGH
- [@ai-sdk/openai-compatible package](https://www.npmjs.com/package/@ai-sdk/openai-compatible) — HIGH
- [Continue's OpenAI Adapters (40+ providers)](https://deepwiki.com/continuedev/continue/4.3-extension-activation-and-setup) — HIGH
- [TetherAI: minimal TypeScript AI provider abstraction](https://medium.com/@nbursa/tetherai-a-minimal-typescript-sdk-for-ai-provider-abstraction-2800d4721669) — MEDIUM
- [Recursively Summarizing Enables Long-Term Dialogue Memory (arXiv)](https://arxiv.org/html/2308.15022v3) — HIGH
- [Summary Memory for Long Conversations (apxml)](https://apxml.com/courses/getting-started-with-llm-toolkit/chapter-7-conversational-applications-with-memory/summary-memory-for-long-conversations) — MEDIUM
- [Context Window Management Strategies (Maxim)](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) — MEDIUM
- [Prompt Architecture for a Reliable AI Dungeon Master](https://dev.to/austin_amento_860aebb9f55/prompt-architecture-for-a-reliable-ai-dungeon-master-d99) — MEDIUM
- [Zutron: Zustand state for Electron](https://github.com/goosewobbler/zutron) — MEDIUM
- [Managing state on Electron apps (Vitor Dino)](https://vitordino.com/writing/electron-state) — MEDIUM
- [Streaming LLM Responses with SSE](https://dev.to/pockit_tools/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534) — MEDIUM
- [dnd5e_json_schema (character schema reference)](https://github.com/BrianWendt/dnd5e_json_schema) — MEDIUM
- [BTMorton/dnd-5e-srd (SRD as JSON)](https://github.com/BTMorton/dnd-5e-srd) — MEDIUM
