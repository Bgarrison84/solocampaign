# Phase 3: AI Engine & Provider Abstraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 3-AI Engine & Provider Abstraction
**Areas discussed:** AI config entry point, Chat panel style, Fallback UX, Context window v1 content

---

## AI Config Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| During campaign creation | Extend CreateCampaignModal with config step | ✓ |
| Settings modal in campaign view | Gear icon opens config at any time | |
| First-message lazy prompt | Setup only when user tries to chat | |

**User's choice:** During campaign creation — three-step modal (name / AI provider + reference docs / DM personality + strictness)

---

### AI Types Clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Two text LLM endpoints | LM Studio + Stability Matrix both as text LLMs | |
| Image generation is a future idea | Stable Diffusion deferred | ✓ |
| Both in Phase 3 | Text DM + image scene art | |

**Notes:** User mentioned Stability Matrix and Stable Diffusion; clarified that image generation is v2/deferred.

---

### Extended Creation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Two-step modal | Name + cover, then AI config + DM personality | |
| Three-step modal | Name / AI provider + docs / DM personality + strictness | ✓ |
| Single step with sections | Collapsible sections on one modal | |

---

### Rules Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| RAW vs. Narrative | Simple binary toggle | |
| Strict / Balanced / Narrative | Three-option selector | ✓ |
| Slider 1–5 | Continuous scale | |

---

### Post-Creation Reconfiguration

| Option | Description | Selected |
|--------|-------------|----------|
| Gear icon in campaign header | Opens config form at any time during play | ✓ |
| Campaign list edit action | Right-click/long-press from list | |
| No reconfiguration | Re-create campaign to change | |

---

### OpenAI-Compatible Connection

| Option | Description | Selected |
|--------|-------------|----------|
| Endpoint URL + model name + optional API key | Three fields, covers all providers | ✓ |
| Endpoint URL + API key only | No model field | |
| Provider preset picker | Dropdown with templates | |

---

### Gemini Connection

| Option | Description | Selected |
|--------|-------------|----------|
| API key + model name | Two fields | ✓ |
| API key only (hardcoded model) | Single field | |
| API key + model dropdown | Curated dropdown | |

---

### Database Location

| Option | Description | Selected |
|--------|-------------|----------|
| New columns on campaigns table | Simple per-campaign columns | ✓ |
| Separate campaign_ai_configs table | 1:1 FK table | |
| You decide | Planner chooses | |

---

### API Key Naming

| Option | Description | Selected |
|--------|-------------|----------|
| ai-key-{campaignId} | Simple predictable pattern | |
| ai-{provider}-{campaignId} | Provider-encoded name | |
| You decide | Planner decides | ✓ |

---

## Chat Panel Style

| Option | Description | Selected |
|--------|-------------|----------|
| Story scroll | Continuous paragraphs, no bubbles | ✓ |
| Chat bubbles | iMessage-style, user right / AI left | |
| Command line | Text adventure style | |

**User's choice:** Story scroll — immersive narrative experience

---

### Player Input Visual Distinction

| Option | Description | Selected |
|--------|-------------|----------|
| Italic 'You:' prefix + separator | Muted italic label with thin rule | ✓ |
| Amber left border indent | Accent-colored indent block | |
| No visual distinction | Pure narrative stream | |

---

### Streaming Appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Blinking cursor | CSS cursor at tail of streaming text | ✓ |
| Typing indicator | '...' then text | |
| Skeleton shimmer | Shimmer placeholder | |

---

### Input Area

| Option | Description | Selected |
|--------|-------------|----------|
| Textarea + Ctrl+Enter only | No send button | |
| Single-line + Enter | Minimal input | |
| Textarea + Send button + Ctrl+Enter | Both send methods | ✓ |

**Notes:** User specified "text area with send button or ctrl+enter" — both methods enabled.

---

### Player Input Processing

| Option | Description | Selected |
|--------|-------------|----------|
| Free-form verbatim | No pre-processing | ✓ |
| Type-tagged (Action/Dialogue/OOC) | Tagged messages | |
| OOC prefix only (/) | Minimal tagging | |

---

### Message Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Per campaign in SQLite, no session grouping | messages table with campaign_id | ✓ |
| Per campaign grouped by session_id | sessions + messages tables | |
| In-memory only | No persistence | |

---

### Session Concept

| Option | Description | Selected |
|--------|-------------|----------|
| One continuous chat, no session boundaries | Phase 4 adds sessions | ✓ |
| Implicit sessions per launch | Auto-session on open | |
| Manual Start Session button | Explicit session management | |

---

## Fallback UX

### Fallback Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback endpoint in campaign config | Per-campaign primary + optional fallback | ✓ |
| Global app preference | One fallback for all campaigns | |
| No auto-fallback | Manual error + reconfigure | |

---

### Retry Count

| Option | Description | Selected |
|--------|-------------|----------|
| 3 retries, exponential backoff (1s, 2s, 4s) | ~7s total before prompt | ✓ |
| 1 retry immediate | Fast feedback | |
| Configurable | User-tunable | |

---

### Fallback Prompt Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error in chat + Switch/Retry buttons | Non-blocking, in narrative area | ✓ |
| Toast notification | Corner pop-up | |
| Modal dialog | Blocking dialog | |

---

## Context Window v1 Content

### System Prompt Contents

| Option | Description | Selected |
|--------|-------------|----------|
| D&D 5e rules brief + DM role + character + personality + strictness | Full context preamble | ✓ |
| Minimal: DM personality + strictness only | Trust model's D&D knowledge | |
| You decide | Researcher designs template | |

**Notes:** User also specified reference documents should be included in the context.

---

### Reference Documents

| Option | Description | Selected |
|--------|-------------|----------|
| Note for Phase 7, compact rules brief in Phase 3 | Keep context small | |
| Inject key sections per class/level | Smart extraction | |
| User-selectable in campaign config (full injection) | Full docs, user manages context limits | ✓ |

**Notes:** Reference Documents/Converted/ folder contains ~30 markdown-converted books. Multi-select in Step 2 of campaign creation. User responsible for context window fit.

---

### Reference Document Injection Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Injected in full into system prompt | Works best with large-context models (Gemini 2.5M) | ✓ |
| As separate user messages | Multi-turn context approach | |
| You decide (researcher picks) | Delegate injection strategy | |

---

### Reference Document Location in UI

| Option | Description | Selected |
|--------|-------------|----------|
| Step 2 with AI provider config | Co-located with provider setup | ✓ |
| Step 3 with DM personality | Conceptually with DM behavior | |
| Separate Step 4 | Clean separation | |

---

### Message History Count

| Option | Description | Selected |
|--------|-------------|----------|
| Last 20 messages | Fits most local LLM context windows | ✓ |
| Last 50 messages | More history, large context required | |
| Configurable | Power user slider | |

---

### Character Sheet Injection Format

| Option | Description | Selected |
|--------|-------------|----------|
| Formatted summary | Human-readable labeled block | ✓ |
| Full JSON from DB | Verbose but complete | |
| You decide | Planner designs format | |

---

## Claude's Discretion

- API key naming scheme in SecretStorageService (planner picks a predictable pattern within `[a-zA-Z0-9_.-]`)
- Exact wording of the D&D 5e rules preamble in the system prompt
- Reference document list display order and search/filter if the list is long
- Context-window size warning threshold for large reference docs

## Deferred Ideas

- Stable Diffusion / AI-generated scene art (v2 — Stability Matrix, user mentioned during discussion)
- Session boundaries and structured session start/end (Phase 4)
- Three-layer memory and summarization (Phase 4)
- Browsable SRD panel (Phase 7 — RULES-01)
- User-imported document as supplementary rules reference (Phase 7 — RULES-04)
