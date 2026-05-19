# Project Research Summary

**Project:** SoloCampaign -- local desktop AI Dungeon Master for solo D&D 5e
**Domain:** Single-user desktop app, AI orchestration, local SQLite persistence, TTRPG rules engine
**Researched:** 2026-05-19
**Confidence:** HIGH

---

## Executive Summary

SoloCampaign occupies a genuine gap in the 2026 AI-TTRPG market: no competitor combines local-first BYO-LLM support (SillyTavern's strength) with actual D&D 5e structure -- character sheets, combat tracking, XP, spell slots, session memory (the hosted AI-GMs' strength). The product thesis is sound and well-differentiated. Every major competitor failure mode maps to a specific design decision already listed in PROJECT.md: context collapse is solved by session summarization; AI dice-fudging is solved by player-rolls-first; provider lock-in is solved by the OpenAI-compatible abstraction; subscription burnout is solved by BYO-LLM free-forever distribution.

The 2026 stack is highly consolidated around a single path: Electron 41 + electron-vite + React 19 + TypeScript 5 + Tailwind v4 + shadcn/ui on the frontend; better-sqlite3 + Drizzle ORM for persistence; Vercel AI SDK for provider abstraction; electron-builder + electron-updater for distribution. This is the recipe that active 2025-2026 boilerplates converge on, and every piece is battle-tested in production. The daltonmenezes/electron-app boilerplate ships most of this pre-configured.

The dominant risks are architectural, not technical: (1) If the three-layer session summarization pipeline is added as an afterthought to a full-history design, retrofitting it requires a near-rewrite of the AI engine. (2) If game state mutation is handled through prose parsing rather than structured tool calls from the start, HP drift and quest-log drift will compound irreversibly. (3) If the Electron security baseline (contextIsolation, nodeIntegration, safeStorage) is not locked in Phase 1, retrofitting it becomes a security audit of every IPC channel added since. Build the architecture in the right order and none of these risks materialize.

---

## Key Findings

### Recommended Stack

The stack is highly opinionated and well-justified. Use **electron-vite 3.x** (not Electron Forge's still-experimental Vite plugin) as the build framework. Clone daltonmenezes/electron-app as the scaffold -- it ships React 19 + TS 5 + Tailwind v4 + shadcn/ui + electron-vite + a GitHub Actions release pipeline, saving approximately a week of plumbing. The two state-management layers are non-negotiable: **Zustand 5.x** for UI/ephemeral state and **TanStack Query 5.x** for all IPC-backed async state (treat the main process as a local server). Use **better-sqlite3 11.x + Drizzle ORM 0.36+** for persistence -- Prisma is actively being abandoned by the Electron community (500 MB installers). The **Vercel AI SDK 4.x** with @ai-sdk/google and @ai-sdk/openai-compatible handles multi-provider abstraction without rolling custom SSE parsing.

**Core technologies:**

- **Electron 41.x** -- cross-platform desktop shell; pin to second-newest major for v1 stability
- **electron-vite 3.x + electron-builder 26.x** -- standard 2025-2026 build/package pipeline; Electron Forge Vite plugin is still experimental
- **React 19 + TypeScript 5.6+** -- only framework with first-class shadcn/ui, Vercel AI SDK hooks, and rich Electron boilerplate coverage
- **Tailwind v4 + shadcn/ui + react-resizable-panels v4** -- copy-in component model owns the dark fantasy theme; react-resizable-panels is the VS Code split-panel primitive
- **Zustand 5.x + TanStack Query 5.x** -- two-layer state: UI state vs IPC-backed async state; universal 2025 consensus for single-user Electron apps
- **better-sqlite3 11.x + Drizzle ORM 0.36+** -- synchronous SQLite in main process, type-safe queries, migrations via drizzle-kit; 30ms vs 450ms for Prisma
- **Vercel AI SDK 4.x (@ai-sdk/google + @ai-sdk/openai-compatible)** -- provider-agnostic streaming + tool calling; LM Studio and Jan AI are documented use cases
- **Zod 3.x** -- schema validation at every process boundary (IPC payloads, AI tool args, settings)
- **electron-updater 6.x** -- notify-only GitHub Releases auto-update; matches PROJECT.md requirement
- **@react-pdf/renderer 4.x** -- character sheet PDF export without spinning up a second Chromium
- **rpg-dice-roller** -- parses and rolls notation like 2d6+3; back with crypto.randomInt() underneath
- **electron-log 5.x** -- structured logging to userData; essential for debugging public releases

### Expected Features

The feature research cross-referenced 12+ active competitors and documented failure modes of defunct products (Deep DM, NeverEndingQuest, AI Dungeon at scale). The market gap is clear and PROJECT.md maps onto it accurately.

**Must have (table stakes):**

- Full 5e SRD character creation (race/class/background/abilities, multiple stat-gen methods)
- Live character sheet (HP, spell slots, conditions, XP, currency -- always visible)
- Spell list with slot tracking and click-to-cast
- In-app dice roller (player-visible, verifiable rolls -- the number one trust feature)
- Combat tracker (initiative, HP, conditions, enemy management)
- Persistent campaign memory across sessions (session summarization is load-bearing)
- Session journal + AI-generated recap
- NPC tracker and quest log (AI auto-populated via structured output)
- Save/load/multiple campaigns
- Rest mechanics (short/long rest with resource recovery)
- Cross-platform installers (Win/Mac/Linux)
- Dark mode UI with fantasy flavor
- AI fallback/graceful failure on provider errors
- Death saves and configurable permadeath

**Should have (differentiators):**

- BYO-LLM with any OpenAI-compatible endpoint (the single biggest differentiator; SillyTavern proved the demand)
- Per-campaign AI provider + DM personality + rules strictness config
- Negative traits with mechanical AND narrative options (unique in the space)
- Three world-setup modes (AI-generated / player brief / document import)
- Player rolls dice, AI narrates outcome (inverts the trust-killing secret-roll anti-pattern)
- Full campaign JSON export (data ownership signal that builds loyalty)
- Companion/familiar tracking as party members
- Epic Boons / post-level-20 progression (no competitor supports this)
- In-world time/calendar tracking
- Homebrew support (file import + in-app editor)
- Configurable encumbrance toggle
- Accessibility (font size, contrast, screen reader) -- ethical baseline AND differentiator

**Defer to v0.2+:**

- PDF/text adventure document import (PDF parsing is high complexity; ship text-import first)
- Homebrew in-app editor (file import is sufficient for MVP)
- Faction/reputation tracking (NPC + quest log covers MVP world state)
- Epic Boons (almost no MVP user will reach level 20)
- Campaign sharing + starter templates (single-user first)
- Encumbrance toggle (default off; add on request)
- Full accessibility hardening (semantic HTML + dark mode in MVP; screen-reader pass in v0.2)

**Never build:**

- AI rolling dice in secret (documented trust-killer across every competitor)
- Cloud sync / multiplayer
- Battle maps / VTT grid
- Voice/TTS / AI-generated scene art
- Subscription billing / silent auto-install updates
- Hard content filter

### Architecture Approach

SoloCampaign is a three-tier local application: renderer process (React thin client, pure UI), main process (Node.js authoritative backend -- all game logic, AI orchestration, persistence), and the typed IPC bridge between them. The renderer never imports fs, better-sqlite3, or calls LLM APIs directly. Use **electron-trpc** for type-safe RPC over IPC -- a D&D app has 40+ operations and hand-rolled contextBridge methods become unmaintainable. The **three-layer memory model** (hot verbatim context + recent session summaries + rolling campaign summary) must be designed in from Phase 2, not retrofitted later. Game state is **always authoritative in SQLite**; the AI requests mutations via tool calls which services validate and apply.

**Major components:**

1. **Main Process / Application Services** -- CampaignService, CharacterService, SessionService, CombatService, QuestService, InventoryService, RestService, ProgressionService, WorldStateService; one service per aggregate
2. **AI Orchestrator (main process)** -- ContextBuilder (three-layer prompt within token budget), LLMProvider interface + adapters (OpenAICompatible, Gemini), Summarizer, StructuredEventParser; wraps Vercel AI SDK as implementation detail
3. **Data Layer (main process)** -- better-sqlite3 with WAL mode + JSON1; hybrid relational/JSON schema; Repository pattern per aggregate; linear versioned migration runner
4. **IPC Bridge** -- electron-trpc router in main; typed client in renderer; request/response for CRUD, subscriptions for AI token streams and game-state push events
5. **Renderer / UI Layer** -- React 19 + five named Zustand stores (campaign, character, chat, combat, UI); TanStack Query wraps all IPC fetches; mirror state synced from main via push events
6. **Event Bus (main process internal)** -- in-process EventEmitter decouples services from IPC layer

### Critical Pitfalls

1. **Insecure Electron renderer configuration** -- contextIsolation: false + nodeIntegration: true is RCE-via-XSS from any AI-generated content or imported PDF. Lock the secure baseline in Phase 1. Add electronegativity to CI. Non-negotiable day-one constraint.

2. **AI context window collapse over long campaigns** -- Naive full-history prompting chokes at session 10-20; a 3-hour session produces 30k+ tokens. Design the three-layer tiered memory model from the start of Phase 2. This is architectural, not a feature, and cannot be retrofitted.

3. **Game state inconsistency from AI-driven mutations** -- AI narrating effects without triggering tool calls causes HP drift, phantom quests, and stale inventory. All state changes must come through typed tool calls validated by Zod + RulesEngine. The AI describes; only the app commits. Build an append-only campaign_events log.

4. **better-sqlite3 native module rebuild failures** -- Packaged builds crash with NODE_MODULE_VERSION mismatch without electron-rebuild configured and better-sqlite3 unpacked from asar. Configure postinstall rebuild, add asarUnpack, smoke-test packaged builds on all three platforms from Phase 1.

5. **API key leakage** -- Keys in plaintext config.json are one Dropbox sync away from exposure. Use safeStorage.encryptString() from the first AI integration. Scrub logs. Never let the renderer see keys.

6. **SQLite WAL corruption** -- Single-instance lock, single writer in main process only, consistent WAL pragmas, automatic backup before every session (last 10 copies), PRAGMA integrity_check on launch.

---

## Implications for Roadmap

### Phase 1: Foundation and Shell

**Rationale:** The entire app depends on the data layer, IPC bridge, and Electron security baseline. None of these can be retrofitted safely. Three of the six critical pitfalls must be addressed before any feature exists.

**Delivers:** Bootable app with secure Electron config, SQLite schema + migrations, typed tRPC IPC round-trip, campaign list + New Campaign flow, character builder MVP (race/class/ability scores persists), read-only character sheet and inventory tabs, split-panel layout shell.

**Addresses:** Save/load campaigns, cross-platform desktop, local data storage (all table stakes).

**Pitfalls to lock in:** Secure BrowserWindow config (#1), better-sqlite3 + asarUnpack + electron-rebuild (#3), single-instance + WAL pragmas + auto-backup + integrity_check (#4), Zod validation on all IPC handlers + senderFrame.url check (#11), versioned migration runner with pre-migration backup (#12), cross-platform CI with packaged build smoke tests (#15).

**Research flag:** Standard patterns -- well-documented. No additional research needed.

---

### Phase 2: AI Engine Core

**Rationale:** Provider abstraction must be designed as an interface from day one. The tiered memory model determines whether the app succeeds at long campaigns and cannot be retrofitted. One-session play validates the abstraction; session summarization validates long-campaign viability.

**Delivers:** LLMProvider interface + OpenAICompatibleProvider + GeminiProvider, safeStorage-backed API key management, per-campaign provider config UI, ContextBuilder v1 (system + character + last N messages), chat panel with streaming tokens + AbortSignal cancellation, provider health check + fallback UX, session lifecycle (start/end/resume), end-of-session summarizer (per-session recap + rolling summary), ContextBuilder v2 (three-layer with token budget), session journal tab.

**Addresses:** AI fallback/graceful failure (table stakes), BYO-LLM + per-campaign AI config (top differentiator), persistent campaign memory (table stakes), DM personality + rules strictness config (differentiator).

**Pitfalls to lock in:** Tiered memory architecture (#2), safeStorage for all keys (#5), AbortController through every layer + server-side cancel (#7), provider capability detection + graceful degradation (#17).

**Research flag:** Token allocation per context layer is MEDIUM confidence -- depends on models users run. Plan configurable per-campaign context window. Research token-counting strategies for local LLMs without exposed tokenizer APIs.

---

### Phase 3: Game Mechanics and Rules Engine

**Rationale:** Real D&D feel requires deterministic rules enforcement and the structured AI-game-state mutation contract. This must come before combat and content polish. The state-mutation contract must be designed here -- retrofitting it is a near-rewrite.

**Delivers:** Structured event parser (tool-call mode + JSON-tail fallback for models without tool support), RulesEngine (pure functions: damage, XP, level-up, spell slots, rest recovery), combat tracker (initiative, turn order, HP, conditions, enemy management), DiceService with crypto.randomInt() + visible roll log, player-rolls-dice paradigm, dice roller UI, XP tracking + level-up flow, rest mechanics, quest tracker (AI auto-populated), NPC tracker (AI auto-populated), campaign_events append-only log, auto-save per turn, session start reconciliation prompt.

**Addresses:** Dice roller, combat tracker, XP/level-up, rest mechanics, NPC tracker, quest log (all table stakes); player-rolls-dice paradigm, companions as party members (differentiators).

**Pitfalls to lock in:** AI state mutation contract via tool calls only (#6), auto-save per turn not just session end (#18), SRD-only content audit (#13), crypto.randomInt for dice (#14).

**Research flag:** Tool-calling reliability varies across local LLM providers. The JSON-tail fallback is essential for broad compatibility. Test against LM Studio + Jan + Ollama during this phase.

---

### Phase 4: Content and Campaign Depth

**Rationale:** Once the mechanics engine is solid, extend the content layer and long-campaign features. This phase can parallelize internally -- world state features are independent of character progression features.

**Delivers:** Full SRD character builder (feats, spells, multiclass without prerequisites, negative traits with mechanical + narrative options), multiple ability score generation methods including negative-trait bonus system, companions/familiars as party members, in-world time/calendar tracking, location breadcrumb tracking, faction/reputation state, Epic Boons / post-level-20 progression, SRD rules reference browser (bundled read-only), homebrew file import, three world-setup modes (AI-generated / player brief / text document import), death saves + permadeath toggle, configurable encumbrance.

**Addresses:** Negative traits (differentiator), no-multiclass-prerequisites (differentiator), three world-setup modes (differentiator), Epic Boons (differentiator), in-world calendar (differentiator), SRD reference (table stakes), homebrew support (differentiator).

**Research flag:** PDF document import scope is MEDIUM confidence -- library quality varies. Start with plain text/markdown import; gate PDF on a spike evaluation in this phase.

---

### Phase 5: Polish and Export

**Rationale:** Once the core experience is solid end-to-end, harden UX edges and add export/sharing features that build community trust and differentiate on data ownership.

**Delivers:** Full campaign JSON export/import, character sheet PDF export via @react-pdf/renderer (not webContents.printToPDF), campaign sharing + starter templates, accessibility hardening (font scaling, high contrast, ARIA live regions for streamed AI text, screen reader testing on NVDA + VoiceOver), keyboard shortcuts, homebrew in-app editor, PDF adventure import if Phase 4 evaluation validated a path.

**Addresses:** Full campaign export (differentiator + trust signal), accessibility (differentiator + ethical baseline), character sheet PDF (table stakes adjacent), sharing/templates (differentiator).

**Pitfalls to lock in:** Hidden BrowserWindow + asset synchronization for PDF export (#8), ARIA live region semantics for streaming text -- paragraph-complete updates, not per-token (#16).

**Research flag:** ARIA live region strategy with streaming AI text is MEDIUM confidence. PDFKit as fallback for printToPDF hangs is the safer path.

---

### Phase 6: Distribution

**Rationale:** Do not fight electron-builder, code signing, and auto-updater complexity until there is a stable app worth shipping. Start certificate procurement during Phase 1 due to multi-week onboarding lead times.

**Delivers:** electron-builder packaging (NSIS + DMG + AppImage/deb), GitHub Actions matrix build (windows-latest / macos-latest / ubuntu-latest), macOS notarization via @electron/notarize + notarytool, Windows code signing via Azure Trusted Signing, electron-updater notify-only GitHub Releases check (no silent install), update notification UI, public GitHub release.

**Pitfalls to lock in:** Notify-only updater flow -- no silent downloads (#9), Apple Developer ID Application cert + notarytool + hardened runtime entitlements (#10), cert expiry calendar alerts + weekly CI sign/notarize smoke test, ALL required artifacts published to GitHub Release.

**Research flag:** macOS hardened runtime entitlements for better-sqlite3 native module may need adjustment. Validate on M-series Mac. Azure Trusted Signing pricing should be verified at release time.

---

### Phase Ordering Rationale

- Foundation before AI: DB schema, IPC pattern, and security baseline must be correct before anything else. Three of six critical pitfalls live here.
- Character before AI chat: Forces through the largest domain model with no AI distractions. Surfaces schema design issues before the AI layer bets on them.
- One-session AI before long-campaign AI: Validates the provider abstraction before investing in summarization. The summarizer is the highest-risk architectural piece.
- Summarization before mechanics depth: A long campaign without summarization is broken. Mechanics add volume on top of the foundation -- do not add volume before the foundation handles campaign length.
- Mechanics before content polish: D&D feel comes from correct mechanical behavior. Rules engine must be correct and tested before layering more content.
- Distribution last: Do not fight packaging and signing complexity until the app is stable. Start certificate procurement during Phase 1.

### Research Flags

Phases needing deeper research during planning:

- **Phase 2 (summarization token tuning):** Exact per-layer token allocations depend on which models users run. Plan configurable per-campaign context window. Research token-counting for local LLMs without tokenizer APIs.
- **Phase 3 (structured AI output reliability):** Tool-calling support varies across LM Studio / Jan AI / Ollama. Test all three before shipping; JSON-tail fallback is the required safety net.
- **Phase 4 (PDF document import):** Multiple candidates; PDF quality in the wild varies. Do a spike before committing.
- **Phase 6 (code signing entitlements):** macOS hardened runtime entitlements for better-sqlite3 .node binary may need adjustment. Validate on M-series Mac.

Phases with standard patterns (skip additional research):

- **Phase 1 (Foundation):** Electron security baseline, better-sqlite3 setup, electron-vite scaffold, tRPC IPC pattern -- all extensively documented and stable.
- **Phase 5 (Export):** @react-pdf/renderer is well-documented; campaign JSON export from SQLite is trivial.
- **Phase 6 (Distribution broadly):** electron-builder + electron-updater + GitHub Releases is the standard path with extensive docs.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Universal 2025-2026 convergence across boilerplates. One MEDIUM note: Drizzle ASAR migration journal is a known footgun with documented fix -- use embedded migrations. |
| Features | HIGH | Cross-referenced 12+ active competitors + documented failure modes. Table stakes and differentiators are clear. |
| Architecture | HIGH | Electron patterns, data layer, AI provider abstraction well-established. MEDIUM on exact token allocations and tRPC subscriptions vs custom IPC events. |
| Pitfalls | HIGH | Cross-referenced Electron official docs, SQLite official corruption guide, GitHub issue trackers, academic sources. Most pitfalls have documented real-world incidents. |

**Overall confidence:** HIGH

### Gaps to Address

- **Token budget tuning for local LLMs:** Three-layer memory model structure is sound, but exact allocations depend on models users run. Plan configurable per-campaign context window; tune empirically during Phase 2.
- **Structured output reliability per local LLM:** Tool-calling is inconsistent across LM Studio / Jan AI / Ollama. Design and test both tool-call and JSON-tail paths during Phase 3.
- **PDF document import library selection:** Multiple candidates. PDF quality in the wild varies. Do a spike in Phase 4 before committing.
- **macOS hardened runtime + better-sqlite3 entitlements:** Exact entitlements plist for notarized builds may need adjustment. Validate during Phase 6 on Intel and M-series Macs.
- **Linux safeStorage fallback:** On headless/minimal Linux, safeStorage.isEncryptionAvailable() returns false. Design a passphrase-encrypted fallback or clear user warning during Phase 2.

---

## Sources

### Primary (HIGH confidence)
- Electron official docs (security, process model, IPC, contextBridge, safeStorage, code signing)
- electron-vite.org -- build tooling recommendation and framework docs
- Drizzle ORM docs + GitHub discussions #1891 -- ASAR migration journal footgun and fix
- better-sqlite3 GitHub issues #1163, #1171 -- native module rebuild patterns
- electron-builder docs + GitHub issue #3485 -- auto-update artifacts and differential update bugs
- Vercel AI SDK docs -- multi-provider abstraction, LM Studio openai-compatible provider
- arXiv 2308.15022 -- recursive summarization for long-term dialogue memory (three-layer model)
- SQLite official WAL docs + How to Corrupt SQLite -- WAL integrity guidance
- shadcn/ui docs (Tailwind v4 + Resizable) -- UI component stack

### Secondary (MEDIUM confidence)
- AIDungeonMaster.ai, StoryRoll, RoleForge blog -- competitor feature landscape and positioning
- WeavAI blog (AI Dungeon Review 2026, SillyTavern Review 2026) -- competitor quit-reason research
- dev.to -- Prompt Architecture for a Reliable AI Dungeon Master (anti-pattern catalog)
- electron-trpc.dev -- type-safe IPC via tRPC
- daltonmenezes/electron-app GitHub -- boilerplate assessment
- renqiankun/electron-vite-template -- Drizzle + better-sqlite3 + electron-vite reference
- apxml.com -- summary memory for long conversations

### Tertiary (LOW confidence / taste or empirical)
- Font choices (Geist Mono vs JetBrains Mono) -- taste, no research needed
- Exact token allocation per context layer -- requires empirical tuning with real user models
- PDF import library selection -- needs spike evaluation in Phase 4

---
*Research completed: 2026-05-19*
*Ready for roadmap: yes*
