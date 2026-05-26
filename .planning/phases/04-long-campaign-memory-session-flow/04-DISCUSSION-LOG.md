# Phase 4: Long-Campaign Memory & Session Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 04-long-campaign-memory-session-flow
**Areas discussed:** Session start flow, End-of-session & recap, Three-layer memory defaults, Session Journal tab

---

## Session Start Flow

### Q1: When should the session start prompt appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-prompt on campaign open | Dialog appears before chat is interactive, every time | |
| Explicit 'Start Session' button | Campaign loads to chat; player decides when to begin | ✓ |
| First message triggers it | Session start fields appear inline at top of chat | |

**Notes:** Player may want to browse journal or character sheet before starting.

---

### Q2: Where does 'Start Session' live and what does clicking open?

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign header → modal dialog | Button near gear icon opens modal with 3 fields | ✓ |
| Campaign header → inline panel above chat | Form appears inline in chat area | |
| Separate 'New Session' screen | Session selection screen on campaign open | |

---

### Q3: Is Start Session required before you can type?

| Option | Description | Selected |
|--------|-------------|----------|
| Required — chat locked until session begins | Input disabled with banner for all sessions | ✓ |
| Optional for session 1 | First-time experience unblocked | |
| Auto-generate session 1 with default values | Silent session creation on first message | |

---

### Q4: After form submit, how does the AI open the session?

| Option | Description | Selected |
|--------|-------------|----------|
| AI auto-narrates the opening immediately | AI generates opening on Begin Session click | ✓ |
| Player sends first message | Session saved; player types to kick off narration | |
| AI narrates, player confirms before it posts | Preview/accept flow before posting | |

---

### Q5: When a returning player opens an existing campaign?

| Option | Description | Selected |
|--------|-------------|----------|
| Always loads to 'no active session' — must Start Session | Enforces fresh session every time | ✓ |
| Resumes the last session automatically | Picks up where left off if not ended | |
| Prompt asking Resume or Start New | Dialog on every open | |

---

### Q6: App closes mid-session without End Session?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-ended on app close — summary on next open | Graceful with deferred summary generation | ✓ |
| Auto-ended — summary skipped, saved without recap | Simpler but loses session context | |
| Session stays 'open' until explicitly ended | Strict enforcement, resumes open session | |

---

### Q7: Location field format?

| Option | Description | Selected |
|--------|-------------|----------|
| Free-form text field | Player types path like "Forest > Ruins > Crypt Level 2" | ✓ |
| Read-only, pre-filled from last session's end location | App remembers end location | |
| Let Claude decide | Claude picks optimal UX | |

---

## End-of-Session & Recap

### Q1: What triggers end of session?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit 'End Session' button in campaign header | Clean deliberate boundary | ✓ |
| Player types '/end session' command | Command-driven, less discoverable | |
| Let Claude decide | Claude picks trigger mechanism | |

---

### Q2: What does the end-of-session recap flow look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal with streaming AI recap + player notes field | Review before save | ✓ |
| Recap appears in Session Journal tab | Tab-based, less modal | |
| End Session auto-saves without review | Background generation, view later | |

---

### Q3: What does the AI use for recap generation?

| Option | Description | Selected |
|--------|-------------|----------|
| All messages from current session | Full session transcript | ✓ |
| Last N messages of current session | Cheaper but may miss early events | |
| Let Claude decide | Dynamic based on session length | |

---

### Q4: Can the player edit or regenerate the AI recap?

| Option | Description | Selected |
|--------|-------------|----------|
| Player can edit the recap text directly | Editable textarea; saved text used for memory | ✓ |
| Player can regenerate (retry) but not edit | Read-only with Regenerate button | |
| Recap is read-only — player adds notes in separate field only | Clean separation of AI vs player content | |

---

### Q5: What system prompt for recap generation?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed recap prompt — Claude's discretion for wording | Hardcoded DM-record-style directive | ✓ |
| Player-configurable recap prompt per campaign | Custom prompt in AI settings | |
| Same DM personality + strictness as gameplay | Consistent voice but suboptimal for summarization task | |

---

## Three-Layer Memory Defaults

### Q1: Layer 1 (hot context — current session messages)?

| Option | Description | Selected |
|--------|-------------|----------|
| All messages from current session | Replaces Phase 3's last-20 limit | ✓ |
| Last N messages from current session (default 30) | Cap even within a session | |
| Dynamic based on token count | Most efficient but complex | |

---

### Q2: Layer 2 (recent session summaries)?

| Option | Description | Selected |
|--------|-------------|----------|
| Last 3 session summaries in full | Good recent history, bounded | ✓ |
| Last 5 session summaries in full | More history for larger context windows | |
| Configurable per campaign (default 3) | Maximum flexibility, more settings knobs | |

---

### Q3: How does Layer 3 (rolling campaign summary) stay bounded?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-summarize all sessions older than L2 each session end | Single rolling summary, replaced not appended | ✓ |
| Append-only | Grows with every session, breaks at scale | |
| Re-summarize only when L3 exceeds token threshold | Lazy approach, good for short campaigns | |

---

### Q4: Injection order in system prompt?

| Option | Description | Selected |
|--------|-------------|----------|
| L3 → L2 → session start context → L1 messages | Chronological narrative order | ✓ |
| Session start context first → L2 → L3 → L1 | Today's intent framed first | |
| Let Claude decide | Claude picks best order for AI coherence | |

---

### Q5: Token budget defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| L2: 2000 tokens, L3: 1000 tokens — conservative | Fits 4K-8K context window local LLMs | ✓ |
| L2: 3000 tokens, L3: 2000 tokens — generous | Better for 8K-32K models | |
| No preset — fully configurable with UI | Maximum flexibility | |

---

### Q6: L1 overflow behavior (session grows very large)?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to last 30 messages with visible warning | Honest, practical | ✓ |
| Silently truncate to last N messages | Simpler UX, no warning | |
| Prompt player to end session early | Educates player but interrupts gameplay | |

---

### Q7: Token budget settings UI in Phase 4?

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden defaults only — expose in later phase | Conservative, no misconfiguration risk | ✓ |
| Expose 'Memory Settings' in gear modal in Phase 4 | Available immediately | |
| Let Claude decide | Claude determines appropriate phase for settings | |

---

## Session Journal Tab

### Q1: What does the Session Journal tab show?

| Option | Description | Selected |
|--------|-------------|----------|
| Timeline of all past sessions — AI recap + player notes, newest first | Scannable historical record | ✓ |
| Current session's in-progress notes at top, past sessions below | Emphasizes current play | |
| Dedicated 'Session N' pages with navigation arrows | Book-like, less scannable | |

---

### Q2: Can the player edit session notes from Journal tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — player notes always editable from Journal tab | Add afterthoughts, correct notes | ✓ |
| Read-only after session save | Clean historical record, inflexible | |
| Both recap and notes editable from Journal tab | Full edit control including recap | |

---

### Q3: What should a session card look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Session N header — date — location — collapsed recap + notes | Compact, scannable | ✓ |
| Session N header with one-line preview of recap | More information density | |
| Let Claude decide | Claude picks card layout for dark fantasy aesthetic | |

---

### Q4: Search or filter in Phase 4?

| Option | Description | Selected |
|--------|-------------|----------|
| No search — scrollable timeline only | Simple, sufficient for 20-30 sessions | ✓ |
| Simple text search across recaps and notes | More powerful, adds complexity | |
| Filter by 'has player notes' or date range | Checkbox/toggle filters | |

---

## Claude's Discretion

- Exact wording of the session recap system prompt (hardcoded DM-record-style directive)
- Exact wording of the rolling campaign summary system prompt
- Token counting approach (character estimation vs actual token count)
- "Save Notes" button placement in Journal tab session cards
- L1 overflow warning exact copy and visual placement in chat scroll
- "Start Session" / "End Session" header button transition/animation
- Location field pre-fill behavior on session 2+ (use last session's start location as default)

## Deferred Ideas

- Per-campaign token budget settings UI (Phase 8 or later)
- Session Journal search/filter (Phase 8)
- PDF/markdown export of session journal (Phase 8)
- Location breadcrumb tracker (Phase 6, WORLD-03)
- AI-detected session end suggestion (Phase 6+ after tool-call contract from Phase 5)
