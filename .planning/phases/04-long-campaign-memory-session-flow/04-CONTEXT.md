# Phase 4: Long-Campaign Memory & Session Flow - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can play multiple sessions across weeks or months and the AI remembers what happened — via an explicit session start modal (location / goal / context notes), an end-of-session recap flow (AI-generated + player-editable), and a three-layer memory model (hot context + recent session summaries + rolling campaign summary) injected into every AI call. The Session Journal right-panel tab is delivered alongside.

**In scope:** Sessions table + migration (adds `session_id` to messages), session start modal, session state tracking (active/ended), end-of-session recap modal with streaming AI generation + player notes, ContextBuilder v2 replacing the Phase 3 v1, three-layer memory assembly, rolling campaign summary generation at session end, Session Journal tab UI.

**Out of scope:** Location breadcrumb tracker (Phase 6), per-campaign token budget settings UI (later phase), search/filter in Session Journal (Phase 8), PDF/text export of journal (Phase 8), NPC/quest/faction tracking from session context (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Session Start Flow

- **D-01:** "Start Session" button in campaign header (alongside gear icon). **Not** auto-prompted on campaign open — the player decides when to begin.
- **D-02:** Clicking "Start Session" opens a **modal dialog** with three fields: current location (free-form text), session goal (free-form text), context notes (free-form text). All fields optional but encouraged. A "Begin Session" button closes the modal and triggers AI narration.
- **D-03:** **Chat input is locked until a session is begun** — applies to every session including the very first. A banner ("Start your session to begin playing") appears over the disabled input. This enforces clean session structure from day one.
- **D-04:** When the player hits "Begin Session," the AI **auto-narrates the opening immediately** using the injected memory + the session start context (location, goal, notes). The first message in the chat scroll is the AI's narration — player does NOT need to send a first message.
- **D-05:** Every campaign open loads to "no active session" state. The player must click "Start Session" every time — including returning to an in-progress campaign. No auto-resume.
- **D-06:** If the app is closed mid-session without an explicit "End Session": the session is **auto-ended on app close**. On the next open, the app detects the unsummarized session and generates the summary in the background (or presents a brief prompt) before allowing a new session to start.
- **D-07:** Location field is **free-form text only** (e.g., "Forest > Ancient Ruins > Crypt Level 2"). Phase 6 adds the proper location breadcrumb tracker — this is just the session start prompt field.
- **D-08:** Once a session is active, the "Start Session" button in the header transforms to / is replaced by an **"End Session" button**.

### End-of-Session & Recap

- **D-09:** Clicking "End Session" opens a **modal dialog**. The AI generates the session recap immediately (streaming into an editable textarea in the modal). Below the recap, a separate player notes free-form field. Player reviews, edits the recap if desired, adds notes, then clicks "Save Session." The modal closes and the session is saved.
- **D-10:** The **player can edit the AI recap text directly** in the modal textarea. The saved version (which is used for Layer 2 memory injection) is the final edited text. Player notes are a separate field — both are saved to the sessions table.
- **D-11:** The AI uses **all messages from the current session** to generate the recap (not just the last N). Bounded to one session's transcript.
- **D-12:** The recap uses a **fixed hardcoded system prompt** designed to produce a concise DM-record-style summary (e.g., key events, NPC encounters, decisions, where the session ended). Researcher/planner designs the exact wording. The campaign's DM personality and strictness settings are NOT applied to the recap call — it is a summarization task, not gameplay.
- **D-13:** The recap is read-only in the **Session Journal tab** after it's saved. Editing only happens during the end-session modal flow. Player notes remain editable from the Journal tab at any time.

### Three-Layer Memory Architecture (ContextBuilder v2)

- **D-14:** **Layer 1 (hot context):** All messages from the current session. Replaces Phase 3's "last 20 messages" limit. If the total token count of L1 + L2 + L3 + system prompt would exceed the **L1 overflow threshold** (default: 6000 tokens for L1 alone), fall back to the last 30 messages from the current session and display a subtle warning in the chat area: "Context window is getting full — earlier parts of this session may not be remembered."
- **D-15:** **Layer 2 (recent session summaries):** The **3 most recently completed sessions'** AI recaps (as saved — possibly player-edited). Injected as labelled sections in the system prompt. Cap: **2000 tokens total** for the L2 block (summaries are truncated if they collectively exceed this).
- **D-16:** **Layer 3 (rolling campaign summary):** A single rolling summary of all sessions older than the Layer 2 window (sessions 1 through N-3 for a campaign on session N). **Re-generated (not appended) at each session end** using all sessions older than L2. Cap: **1000 tokens.** The rolling summary is stored in the campaigns table as a column.
- **D-17:** **Injection order** in the system prompt at each AI call:
  1. Fixed DM preamble + strictness + personality + character summary (existing)
  2. Reference documents (existing)
  3. **Layer 3:** Rolling campaign summary (oldest history, labelled "Campaign History So Far:")
  4. **Layer 2:** Recent session recaps (labelled "Previous Sessions — Session N:", "Session N-1:", "Session N-2:")
  5. **Session start context:** Today's location, goal, and context notes (labelled "Current Session:")
  6. **Layer 1:** Current session messages as the `messages` array (not in system prompt — passed as `messages` to Vercel AI SDK)
- **D-18:** Token budget defaults are **hidden in Phase 4** — no UI exposed to the player. Values: L1 overflow threshold 6000 tokens → last 30 messages fallback. L2 cap: 2000 tokens. L3 cap: 1000 tokens. These defaults are hardcoded constants in ContextBuilder v2. A settings UI surface may be added in Phase 8 or a later phase. The cross-phase todo ("empirical token-budget tuning per memory layer") remains open — defaults are best-effort and expected to need adjustment.

### Database Schema (new for Phase 4)

- **D-19:** New **`sessions` table**: `id`, `campaign_id` (FK → campaigns, cascade), `session_number` (integer, monotonically increasing per campaign), `started_at`, `ended_at` (nullable — null while session is active), `location` (text, nullable), `goal` (text, nullable), `context_notes` (text, nullable), `ai_recap` (text, nullable — filled at session end), `player_notes` (text, nullable), `is_summarized` (boolean default false — set true when Layer 3 rolling summary has incorporated this session).
- **D-20:** **Migration:** Add `session_id` (FK → sessions, nullable) to the existing `messages` table. Rows from Phase 3 (no session) get `session_id = NULL`. New messages written during a session get the active session's ID.
- **D-21:** **`campaigns` table** gets a new column: `rolling_summary` (TEXT nullable) — the Layer 3 rolling summary. Updated at session end.

### Session Journal Tab UI

- **D-22:** Session Journal tab shows a **stacked timeline of all completed sessions, newest first**. In-progress session (if any) shows a "Session N in progress" placeholder card at the top.
- **D-23:** Each session = a **collapsed card** displaying: "Session N — [date] — [location]" as the header. Click to expand. Expanded view shows: AI recap text (read-only, styled like the story scroll), player notes (editable textarea — click to focus, Ctrl+Enter or a visible "Save Notes" button to save).
- **D-24:** Player notes remain **always editable from the Journal tab** even for past sessions. AI recap text is read-only in the Journal — it was finalized during the end-session modal.
- **D-25:** **No search or filter** in Phase 4 — scrollable timeline only. A campaign of 20-30 sessions scrolls fine. Search is a Phase 8 consideration.

### Claude's Discretion

- Exact wording of the session recap system prompt (hardcoded summarization directive).
- Exact wording of the recap regeneration / rolling summary system prompt.
- Specific token counting approach (estimate via character count or actual token count). If using estimation, note in code.
- "Save Notes" button placement and styling in Journal tab session cards.
- L1 overflow warning exact copy and visual placement in chat scroll.
- How the "Start Session" / "End Session" header button animates or transitions between states.

### Folded Todos

- **Cross-phase todo (STATE.md):** "Phase 4: Empirical token-budget tuning per memory layer for common local LLMs" — folded into Phase 4 as hardcoded defaults (L2: 2000, L3: 1000, L1 overflow: 6000 tokens). A configurable settings UI is deferred to a later phase. This todo remains open as a tracking item; the default values are best-effort starting points.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Core value, constraints, session summarization rationale ("AI context window is a real constraint for long campaigns — session summarization is load-bearing")
- `.planning/REQUIREMENTS.md` — Phase 4 requirements: SESS-02 (three-layer memory architecture), SESS-03 (structured session start), SESS-04 (end-of-session recap flow)
- `.planning/ROADMAP.md` § "Phase 4: Long-Campaign Memory & Session Flow" — Goal, success criteria, notes (token allocation configurable, Session Journal tab, empirical tuning flag)

### Prior Phase Context (critical integration)
- `.planning/phases/03-ai-engine-provider-abstraction/03-CONTEXT.md` — D-16 (messages table has no session_id in Phase 3 — Phase 4 adds via migration), D-17 (messages table schema), D-20 (ContextBuilder v1 interface to replace), D-22 (LLMProvider interface `streamChat` — Phase 4 adds summarize call alongside it)
- `.planning/phases/01-foundation-secure-shell/01-CONTEXT.md` — tRPC v10 + electron-trpc pattern, Drizzle migration pattern

### Existing Code — Critical Integration Points
- `src/main/ai/contextBuilder.ts` — ContextBuilder v1 to be replaced by v2. The `buildContext(args: BuildContextArgs): BuiltContext` signature should remain backward-compatible or upgraded with session awareness.
- `src/main/db/schema.ts` — Current schema: campaigns (no rolling_summary yet), messages (no session_id yet), characters, characterResources, characterItems. Phase 4 adds sessions table + rolling_summary column + session_id FK.
- `src/main/ai/aiSessionState.ts` — In-memory fallback/abort tracking. Phase 4 adds in-memory "active session ID" tracking per campaign (what session is currently open).
- `src/main/db/messagesRepo.ts` — `getLastN()` and `getByCampaignId()` need new variants: `getBySessionId()` for all messages in a session (for recap generation), and session-aware `getLastN()` (within current session only for L1).
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Campaign header where Start Session / End Session button goes; Session Journal tab slot already exists as placeholder.
- `src/main/trpc/routers/ai.ts` — AI tRPC router to extend with session-start, session-end, recap-generate, save-session, and update-player-notes procedures.

### Technology Stack
- `CLAUDE.md` § "AI Provider Abstraction" — Vercel AI SDK v4 for the summarize/recap call (same interface as streamChat, but non-streaming `generateText` for recap)
- `CLAUDE.md` § "State Management" — Zustand for in-session UI state (active session ID, session status, recap modal open state); TanStack Query for IPC calls to session repo

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/ai/contextBuilder.ts` — Replace with v2; keep `formatCharacterSummary()`, `abilityMod()`, and `STRICTNESS_DIRECTIVES` utilities. The `buildContext()` function gets a new session-aware signature.
- `src/main/ai/llmProvider.ts` — Add `generateText(prompt, systemPrompt)` or `summarize(messages, systemPrompt)` alongside existing `streamChat()`. Used for both session recap and rolling summary generation.
- `src/renderer/src/components/ui/dialog.tsx` (shadcn Dialog) — Reuse for both Session Start modal and End Session recap modal.
- `src/renderer/src/components/ui/textarea.tsx` — For location, goal, context notes in start modal; recap edit and player notes in end modal; notes editing in Journal tab.
- `src/renderer/src/components/ui/button.tsx` — "Start Session" / "End Session" header button, "Begin Session" / "Save Session" in modals.
- `src/renderer/src/components/StoryScrollPanel.tsx` — Reference the streaming render pattern for streaming recap generation in the end-session modal.
- `react-hotkeys-hook` — Ctrl+Enter to save player notes in Journal tab and in the end-session modal.

### Established Patterns
- **Drizzle migration:** New migration SQL file in `resources/migrations/` for sessions table + messages.session_id FK + campaigns.rolling_summary column. Follow existing migration file pattern.
- **tRPC router:** New `sessions.ts` router following `campaigns.ts` and `ai.ts` patterns. Register in `src/main/trpc/router.ts`.
- **TanStack Query:** Wrap all new tRPC session calls with `useQuery`/`useMutation` following `campaignQuery` pattern.
- **Modal pattern:** Session Start and End Session modals follow the existing `CreateCampaignModal.tsx` pattern (shadcn Dialog, form fields, action buttons).

### Integration Points
- **Campaign header** (`CampaignViewScreen.tsx`) — Add "Start Session" button next to gear icon. Transform to "End Session" when session is active (driven by Zustand session state).
- **Session Journal tab** — The fifth tab slot in the right panel. Replace placeholder with `SessionJournalTab` component that reads from `sessionsRepo`.
- **ContextBuilder v2** — Consumed by the existing `ai:send-message` IPC handler. The handler passes the active `session_id` to ContextBuilder v2 so it can assemble L1 (current session messages) vs L2/L3 (older session summaries).
- **Session end handler** — After saving session: trigger rolling summary regeneration for L3 (async, can be done in background — the next session start is where it's consumed).

</code_context>

<specifics>
## Specific Ideas

- **"Session N in progress" placeholder:** While a session is active, the Journal tab's top card should show a subtle "Session in progress" state (grayed out, no expand). Makes it clear the current session isn't journaled yet.
- **Location field pre-fill:** On session 2+, pre-fill the location field with the location entered at the last session start (not session end — we don't have an "end location" field). Player overrides with free text if moved.
- **Context window warning:** Show the L1 overflow warning as a subtle amber/muted alert in the chat scroll area (not a modal), consistent with the story-scroll aesthetic. Something like a thin bar: "Earlier conversation history is not visible to the AI — session context grew beyond model limit."
- **Recap modal:** The AI recap streams into the modal like the story scroll (same font, same aesthetic). The editable textarea replaces the read-only view once streaming completes (or the textarea allows editing during stream but is read-only while streaming).
- **Session number:** Monotonically assigned at session start (`max(session_number) + 1` per campaign). Display as "Session 1," "Session 2," etc. in the Journal tab and modal headers.

</specifics>

<deferred>
## Deferred Ideas

- **Per-campaign token budget settings UI** — The player cannot configure L2/L3 token caps in Phase 4. Hidden hardcoded defaults. Revisit in Phase 8 Polish if the cross-phase todo demands it.
- **Session Journal search/filter** — Scrollable timeline only in Phase 4. Search is a Phase 8 consideration (fuse.js or minisearch are already in the stack recommendation).
- **PDF/markdown export of session journal** — Export of the journal as a human-readable document is Phase 8 (DIST-02 covers character sheet PDF; journal export is adjacent but not in scope).
- **Location breadcrumb tracker** — Phase 6 adds the proper `WORLD-03` location tracker. Phase 4 captures location only as a free-form session start field.
- **AI-detected session end** — If the AI narrative reaches a natural stopping point, it could suggest "End session here?" — scoped to Phase 6 or later as AI-state-mutation relies on Phase 5's tool-call contract.

</deferred>

---

*Phase: 4-Long-Campaign Memory & Session Flow*
*Context gathered: 2026-05-26*
