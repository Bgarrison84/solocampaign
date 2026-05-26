# Phase 3: AI Engine & Provider Abstraction - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can configure a unique AI provider per campaign (any OpenAI-compatible endpoint or Gemini), select reference documents to inject as context, write a DM personality, set rules strictness, and play a continuous chat session — with streaming narration, encrypted key storage, and graceful fallback when the provider fails.

**In scope:** Campaign creation wizard extended to three steps (name / AI provider + reference docs / DM personality + strictness), gear-icon reconfiguration in campaign header, story-scroll chat panel with streaming, messages table in SQLite (no session grouping), ContextBuilder v1 (system prompt + character summary + selected docs + last 20 messages), fallback endpoint per campaign with 3-retry exponential backoff, LLMProvider interface wrapping Vercel AI SDK.

**Out of scope:** Session boundaries / structured session start-end (Phase 4), three-layer memory / summarization (Phase 4), spell casting and rules enforcement (Phase 5), browsable SRD tab (Phase 7), user-imported documents (Phase 7 — `RULES-04`), AI-generated scene art / Stable Diffusion (v2 deferred), SRD browsable panel (Phase 7 — `RULES-01`).

</domain>

<decisions>
## Implementation Decisions

### Campaign Creation — AI Config Step (Step 2 of 3)

- **D-01:** `CreateCampaignModal` is extended from one step (name) to three steps:
  - **Step 1:** Campaign name + (optional) cover image placeholder — unchanged structure from existing modal.
  - **Step 2:** AI provider config — provider type picker (OpenAI-compatible | Gemini), connection fields, optional fallback endpoint, and reference document multi-select.
  - **Step 3:** DM personality text field + rules strictness selector.
- **D-02:** Provider type is a two-option picker: **OpenAI-compatible** or **Gemini**. No preset dropdown — the "OpenAI-compatible" label covers LM Studio, Jan AI, Ollama, OpenRouter, and OpenAI.
- **D-03:** **OpenAI-compatible** connection fields: endpoint URL + model name + optional API key. All three in Step 2. The API key is optional for local LLMs (LM Studio / Jan AI / Ollama run without auth).
- **D-04:** **Gemini** connection fields: API key + model name. No URL field — `@ai-sdk/google` handles the endpoint.
- **D-05:** **Reference document multi-select** in Step 2 (below provider fields): shows available docs from `Reference Documents/Converted/` as a list of checkboxes. User picks which documents the AI should know about per campaign. Selected doc paths stored as a JSON array in the DB. Documents are injected in full into the system prompt at AI call time — the user is responsible for selecting docs that fit their model's context window.
- **D-06:** **Fallback endpoint** in Step 2: optional secondary provider (same fields as primary: endpoint URL + model name + optional API key). Visible as a collapsible "Fallback Provider" section beneath the primary config.

### Campaign AI Config — Database Storage

- **D-07:** AI config is stored as **new columns on the `campaigns` table** (no separate table): `provider_type`, `endpoint_url` (nullable — Gemini doesn't use it), `model_name`, `reference_docs` (TEXT, JSON array of relative paths), `dm_personality` (TEXT nullable), `strictness` (TEXT: `'strict' | 'balanced' | 'narrative'`), `fallback_endpoint_url` (nullable), `fallback_model_name` (nullable).
- **D-08:** API keys (primary and fallback) are **never in SQLite**. They are stored and retrieved via `SecretStorageService`. Key naming convention is **Claude's discretion** — planner chooses a predictable scheme that fits the existing `[a-zA-Z0-9_.-]` key regex and is unique per campaign.

### Post-Creation Reconfiguration

- **D-09:** A **gear icon** in the campaign header opens the same config form (a modal) post-creation. All fields from Steps 2 and 3 are editable. Campaign name and Step 1 cover image remain editable from the campaign list.

### Rules Strictness

- **D-10:** Three options: **Strict** (rules-as-written, 5e mechanics enforced), **Balanced** (rules-aware but story-first — the default), **Narrative** (DM improvises freely, rules are flavoring). This maps to a system-prompt directive the researcher designs.

### Chat Panel — Story Scroll

- **D-11:** The left panel renders AI narration as **continuous paragraphs** in a scrollable story area. No chat bubbles. This is a narrative reading experience, not a messenger UI.
- **D-12:** Player messages appear as a **subtle separator** (thin horizontal rule) followed by an italic `You:` label in muted text, then the player's message text. Keeps immersion while making player actions scannable in a long scroll.
- **D-13:** **Streaming:** While tokens arrive, a **blinking CSS cursor** appears at the tail of the growing text block. No skeleton shimmer or "typing..." indicator.
- **D-14:** **Input area:** A multi-line `<textarea>` that grows up to ~4 lines. Sends on **Ctrl+Enter** (keyboard shortcut, with hint shown) OR clicking a **visible Send button**. Plain Enter adds a newline. `react-hotkeys-hook` is already in the stack.
- **D-15:** Player input is **sent verbatim** — no pre-processing, no action tagging. The AI DM interprets context from the conversation history.
- **D-16:** **One continuous chat per campaign** — no session start/end concept in Phase 3. The full message history loads on campaign open. Phase 4 adds session boundaries, structured start/end, and three-layer memory.

### Message Persistence

- **D-17:** A new **`messages` table** in SQLite: `id`, `campaign_id`, `role` (`'user' | 'assistant'`), `content`, `created_at`. No `session_id` column in Phase 3 (Phase 4 adds it via migration). All messages for a campaign live in one table, ordered by timestamp.

### Fallback Handling

- **D-18:** When the primary provider fails: **3 retries with exponential backoff** (1 s → 2 s → 4 s). After the 3rd failure, an **inline error block** appears in the chat scroll (not a modal or toast) with two buttons: **Switch to fallback** and **Retry**. If no fallback endpoint is configured, only **Retry** and a "Configure fallback in settings" link appear.
- **D-19:** "Switch to fallback" swaps the active endpoint for the current session (in memory only — the campaign's primary config is not permanently changed). The AI call is re-attempted immediately using the fallback config.

### ContextBuilder v1

- **D-20:** Each AI call assembles context in this order:
  1. **System prompt** — fixed preamble (`You are a Dungeon Master for D&D 5e. The player is [name], a Level [N] [Race] [Class].`) + strictness directive + DM personality text + formatted character summary.
  2. **Reference documents** — each selected document is read from `Reference Documents/Converted/` and appended to the system prompt as a labelled section.
  3. **Message history** — last 20 messages from the `messages` table (chronological), passed as the `messages` array to the Vercel AI SDK call.
- **D-21:** **Character summary** format (injected in system prompt):
  ```
  Character: [name], Level [N] [Race] [Class] ([subclass if any])
  HP: [current]/[max] | AC: [value] | Speed: [ft] | Initiative: [modifier]
  Stats: STR [N] ([mod]) | DEX [N] ([mod]) | CON [N] ([mod]) | INT [N] ([mod]) | WIS [N] ([mod]) | CHA [N] ([mod])
  Proficiency Bonus: +[N]
  Spell Slots: [1st: X/Y | 2nd: X/Y | ...] (omit if no spellcasting)
  Active Conditions: [list or "None"]
  Inspiration: [Yes/No]
  ```
- **D-22:** The LLM provider interface wraps the Vercel AI SDK from day one: `LLMProvider.streamChat(messages, systemPrompt)` → returns an async stream. This clean interface lets Phase 4 slot the summarization strategy in without touching call sites.

### Security Contract (inherited from Phase 1)

- **D-23:** The renderer **never receives plaintext API keys**. The `secrets.get` procedure does not exist. Phase 3's main process reads the key via `SecretStorageService.decrypt()` per-request, builds the Vercel AI SDK provider, makes the LLM call, and streams tokens back to the renderer. The renderer only sees tokens and error states.
- **D-24:** **Headless Linux safeStorage warning:** If `safeStorage.isEncryptionAvailable()` returns false, a visible warning appears in the AI config step ("Your key will be stored with reduced security on this platform. See documentation."). This was noted as Phase 3's responsibility in 01-CONTEXT.md D-15.

### Claude's Discretion

- API key naming scheme in SecretStorageService — planner chooses, must satisfy `[a-zA-Z0-9_.-]`, unique per campaign, distinct for primary vs. fallback keys.
- Exact wording of the D&D 5e rules preamble in the system prompt (researcher / planner designs the template).
- Handling of the reference document list display order and search/filter if the list is long.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Core value, constraints, key decisions (offline-first, per-campaign AI config, provider abstraction)
- `.planning/REQUIREMENTS.md` — Phase 3 requirements: FOUND-03, SESS-05, SESS-06, SESS-07, SESS-08
- `.planning/ROADMAP.md` § "Phase 3: AI Engine & Provider Abstraction" — Goal, success criteria, notes (ContextBuilder v1, LLMProvider interface, Phase 4 handoff)

### Prior Phase Context
- `.planning/phases/01-foundation-secure-shell/01-CONTEXT.md` — SecretStorageService contract (D-15), no-get-over-IPC rule, tRPC v10 + electron-trpc pattern, headless Linux safeStorage warning note
- `.planning/phases/02-character-domain-live-sheet/02-CONTEXT.md` — Campaign structure, characters/resources table schema, tRPC router patterns, modal pattern, shadcn/ui components available

### Existing Code — Critical Integration Points
- `src/main/secrets/secretStorageService.ts` — SecretStorageService to use for API key encrypt/decrypt
- `src/main/trpc/routers/secrets.ts` — No `get` procedure; per-request scoped decryption pattern
- `src/main/db/schema.ts` — campaigns table to extend with new AI config columns; characters + character_resources for context builder
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Left panel (chat area placeholder) and campaign header to extend with gear icon
- `src/renderer/src/components/CreateCampaignModal.tsx` — Modal to extend into three-step wizard

### Reference Documents (AI context injection source)
- `Reference Documents/Converted/` — All available reference documents as markdown files; displayed in multi-select in Step 2 of campaign creation; selected docs injected into system prompt at call time

### Technology Stack
- `CLAUDE.md` § "AI Provider Abstraction" — Vercel AI SDK (`ai` v4), `@ai-sdk/google` for Gemini, `@ai-sdk/openai-compatible` for LM Studio/Jan AI/Ollama; confirms provider-switching as first-class concern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/src/components/CreateCampaignModal.tsx` — Extend this modal into three steps. Step 1 is the existing name field; Steps 2–3 are new.
- `src/renderer/src/components/ui/dialog.tsx` — shadcn Dialog: the outer wrapper (already used by CreateCampaignModal)
- `src/renderer/src/components/ui/button.tsx` — Navigation (Next/Back/Create) + Send button for input area
- `src/renderer/src/components/ui/input.tsx` + `label.tsx` — Connection fields (endpoint URL, model name, API key)
- `src/renderer/src/components/ui/select.tsx` — Provider type picker (OpenAI-compatible / Gemini), strictness selector (Strict / Balanced / Narrative)
- `src/renderer/src/components/ui/tabs.tsx` — Already wired in CampaignViewScreen; not affected by chat panel changes
- `src/main/secrets/secretStorageService.ts` — `encrypt(key, value)` / `decrypt(key)` / `exists(key)` / `remove(key)` — use for primary + fallback API keys
- `react-hotkeys-hook` — Ctrl+Enter send shortcut for the input textarea

### Established Patterns
- **tRPC router in main:** Add `ai.ts` router (or extend `campaigns.ts`) following `characters.ts` and `prefs.ts` patterns
- **Drizzle schema + migration:** New columns on `campaigns` table + new `messages` table → new migration SQL file in `resources/migrations/`
- **TanStack Query:** Wrap all new tRPC calls with `useQuery`/`useMutation` following `campaignQuery` pattern in `CampaignViewScreen.tsx`
- **Streaming IPC:** tRPC v10 does not natively support streaming — researcher must validate the streaming delivery mechanism (custom IPC channel vs. tRPC subscription vs. Vercel AI SDK's own event streaming over IPC)

### Integration Points
- **CampaignViewScreen.tsx left panel** — Replace the `"AI narration appears here."` placeholder with the story-scroll chat component
- **CampaignViewScreen.tsx campaign header** — Add gear icon that opens the AI settings modal
- **src/main/db/schema.ts** — Add AI config columns to `campaigns` table; add `messages` table
- **src/main/trpc/router.ts** — Register new `ai` router (or `chat` router) for message send and streaming
- **src/main/trpc/routers/campaigns.ts** — Add campaign update mutation for AI config reconfiguration

</code_context>

<specifics>
## Specific Ideas

- **Story scroll aesthetic:** The chat area should feel like reading a novel — paragraph breaks between AI narration blocks, generous line height, the fantasy dark theme with subtle amber/gold for the `You:` prefix. No message timestamp stamps per message (keep it clean; timestamps on hover are acceptable).
- **Reference document list:** The `Reference Documents/Converted/` folder contains ~30 documents. The multi-select should show just the document title (strip the author and "OceanofPDF" prefix). Default selection: none (user must explicitly opt in). A "Select All" button is useful.
- **Send button placement:** Bottom-right of the input area, next to the textarea. The Ctrl+Enter hint appears as muted text inside the Send button or as a tooltip.
- **Gear icon:** In the campaign header near the campaign name (consistent with the title-bar pattern established in Phase 1). A simple settings/gear `lucide-react` icon — `Settings` or `SlidersHorizontal`.
- **Context window size note:** When the user selects large documents (PHB is >500K tokens in markdown), a visible warning should appear: "This document is large — ensure your model's context window is sufficient." The researcher should determine a reasonable size-warning threshold.

</specifics>

<deferred>
## Deferred Ideas

- **Stable Diffusion / AI-generated scene art via Stability Matrix** — v2 feature, explicitly deferred in `REQUIREMENTS.md`. The user mentioned this during discussion; captured here so Phase 7+ doesn't forget it.
- **Browsable SRD reference panel** (RULES-01) — Phase 7.
- **User-imported documents as supplementary rules reference** (RULES-04) — Phase 7. The `Reference Documents/Converted/` folder used in Phase 3 is a developer/design-time asset, not the general user import flow.
- **Session boundaries, structured session start/end** (SESS-03, SESS-04) — Phase 4. The `messages` table schema intentionally omits `session_id` so Phase 4 can add it via migration.
- **Three-layer memory / summarization** (SESS-02) — Phase 4.

</deferred>

---

*Phase: 3-AI Engine & Provider Abstraction*
*Context gathered: 2026-05-25*
