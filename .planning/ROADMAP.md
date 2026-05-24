# SoloCampaign — Roadmap

**Project:** Local desktop AI Dungeon Master for solo D&D 5e
**Mode:** mvp
**Granularity:** fine
**Phases:** 9
**Coverage:** 53/53 v1 requirements mapped
**Last updated:** 2026-05-22

---

## Phases

- [~] **Phase 1: Foundation & Secure Shell** — Bootable Electron app with secure baseline, SQLite persistence, typed IPC, split-panel shell, and campaign list/create flow (3/3 core plans complete; 4 gap-closure plans created: 01-04/01-05/01-06/01-07)
- [ ] **Phase 2: Character Domain & Live Sheet** — Step-by-step SRD character builder with persistent character sheet, live resource tracking, and portrait/cover image import
- [ ] **Phase 3: AI Engine & Provider Abstraction** — Per-campaign AI provider configuration (OpenAI-compatible + Gemini) with encrypted keys, streaming chat, fallback handling, and DM personality/strictness controls
- [ ] **Phase 4: Long-Campaign Memory & Session Flow** — Three-layer memory architecture, structured session start prompts, end-of-session recap, and AI-generated summaries that keep months-long campaigns coherent
- [ ] **Phase 5: Rules Engine, Dice & Combat** — Deterministic rules engine, player-rolls-dice paradigm, combat tracker with initiative/HP/conditions, XP-driven level-up, rests, spell slot management, and currency
- [ ] **Phase 6: Quests, NPCs & World State** — AI-populated quest log, NPC tracker, faction/reputation, in-world calendar, location breadcrumb, and AI-awarded Inspiration via structured tool-call mutations
- [ ] **Phase 7: Content Depth & Advanced Character** — Full ability score generation methods (incl. negative-trait point buy), multiclass without prerequisites, feats + custom editor, companions as party members, Epic Boons, three world-setup modes, SRD reference, homebrew, and PDF/text rules import
- [ ] **Phase 8: Polish, Export & Accessibility** — Full campaign JSON export/import, character sheet PDF, sharable starter templates, custom data folder, and accessibility (font scaling, high contrast, ARIA/keyboard)
- [ ] **Phase 9: Distribution & Update Notifications** — Signed + notarized cross-platform installers (Windows, macOS, Linux), GitHub Releases publishing, and notify-only update flow

---

## Phase Details

### Phase 1: Foundation & Secure Shell
**Goal:** A user can install SoloCampaign on Windows/macOS/Linux, launch it, create a new campaign that persists across restarts, and see the split-panel layout shell — on a secure-by-default Electron baseline backed by SQLite.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** FOUND-01, FOUND-02, FOUND-04, SESS-01
**Success Criteria** (what must be TRUE):
  1. User can install and launch the app on Windows, macOS, and Linux from a packaged build without manual dependency setup
  2. User can create a new campaign, close the app, reopen it, and see the campaign with all data intact
  3. User sees a split-panel layout (narrative chat on left, tabbed right panel) immediately on entering a campaign
  4. Electron renderer runs with contextIsolation enabled, nodeIntegration disabled, and all IPC handlers validated via Zod
**Plans:** 7 plans
Plans:
- [x] 01-01-PLAN.md — Walking skeleton: Electron + SQLite + tRPC + campaign CRUD
- [x] 01-02-PLAN.md — Drizzle migrations + backup rotation + integrity check + single-instance lock
- [x] 01-03-PLAN.md — SecretStorageService + secrets tRPC router
- [ ] 01-04-PLAN.md — Split-panel campaign view shell (react-resizable-panels + 5-tab right panel)
- [ ] 01-05-PLAN.md — Custom frameless title bar + window size persistence
- [ ] 01-06-PLAN.md — Code review bug fixes (CR-01, CR-03, CR-04, CR-05)
- [ ] 01-07-PLAN.md — Packaged build smoke tests + CI matrix
**Phase 1 Progress:** 3/7 plans complete (wave 3: 01-04+01-05 parallel; wave 4: 01-06 after 01-05; wave 5: 01-07 after all)
**Notes:**
  - FOUND-04 covers encrypted secret storage via safeStorage; the actual provider/key UI ships in Phase 3 but the safeStorage wrapper lands here
  - No code signing per D-03 (user decision: unsigned installers with bypass documentation)
  - Electron 41.7.0 selected (ABI 145) — better-sqlite3 v12 prebuilt available; Electron 42 MSVC build fails
  - 01-01 completed: walking skeleton proven (Electron + SQLite + tRPC + React Router + campaign CRUD)
  - 01-02 completed: Drizzle migrate() auto-runs at startup; backup rotation + integrity_check + single-instance lock in place
  - 01-03 completed: SecretStorageService (safeStorage + B64 fallback + key normalization) + secrets tRPC router (exists/set/delete, no get) + 34 unit tests. FOUND-04 architecture complete.
  - Next: 01-04 (split-panel shell), 01-05 (title bar), 01-06 (CR bug fixes) run in parallel (wave 3); then 01-07 (smoke tests) in wave 4
**UI hint:** yes

### Phase 2: Character Domain & Live Sheet
**Goal:** A user can build a level-1 SRD character (race/class/background/equipment), import a portrait, and see/edit live HP, spell slots, XP, currency, conditions, death saves, and attuned items on a persistent character sheet panel.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** CHAR-01, CHAR-06, CHAR-07, CHAR-09, WORLD-02
**Success Criteria** (what must be TRUE):
  1. User can complete a step-by-step character builder selecting race, class, background, and starting equipment from the SRD and save the character to a campaign
  2. User can update HP, spell slots, death saves, XP, currency, and conditions live from the character sheet and see changes persist after restart
  3. User can import a local image file as a character portrait and as a campaign cover image
  4. User can mark items as attuned and see the attunement limit displayed (not enforced)
**Plans:** TBD
**Notes:**
  - Spell list interaction (CHAR-08) moves to Phase 5 with the rules engine; this phase ships the structural sheet
  - Advanced ability score methods (CHAR-02/03), multiclass (CHAR-04), and feats (CHAR-05) defer to Phase 7
**UI hint:** yes

### Phase 3: AI Engine & Provider Abstraction
**Goal:** A user can configure a unique AI provider per campaign (any OpenAI-compatible endpoint or Gemini), write a DM personality, set rules strictness, send a message, and see streaming narration — with encrypted key storage and graceful fallback on failure.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** FOUND-03, SESS-05, SESS-06, SESS-07, SESS-08
**Success Criteria** (what must be TRUE):
  1. User can configure an AI provider per campaign by choosing OpenAI-compatible (LM Studio, Jan AI, Ollama, OpenRouter, OpenAI) or Gemini and entering a key/URL
  2. User can write a DM personality description and select a rules strictness level (RAW vs. narrative) per campaign
  3. User can send a chat message and see tokens stream back in the narrative panel from the configured provider
  4. When the configured cloud provider fails, the app automatically retries and then prompts the user to switch to a configured local LLM
  5. API keys are never visible in plaintext config files, logs, or the renderer process
**Plans:** TBD
**Notes:**
  - ContextBuilder v1 (system + character + last N messages) ships here; v2 three-layer memory lands in Phase 4
  - Wrap Vercel AI SDK behind an LLMProvider interface from day one so phase 4 summarization slots in cleanly
  - Plan a clear user warning on headless Linux where safeStorage.isEncryptionAvailable() returns false
**UI hint:** yes

### Phase 4: Long-Campaign Memory & Session Flow
**Goal:** A user can play multiple sessions across weeks/months and the AI remembers what happened — via a structured session start (location/goal/context), an end-of-session recap with player notes, and a three-layer memory model (hot context + recent summaries + rolling campaign summary) injected at every session start.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. User starts a new session by entering current location, session goal, and context notes before the AI narrates the opening
  2. User can end a session and review an AI-generated recap, add personal notes, and save it to the session journal
  3. When the user starts session N+1, the AI demonstrably references events from earlier sessions (verified via prompt inspection that summaries are injected)
  4. A campaign played across 10+ sessions does not exhibit context overflow errors or token-budget collapse
**Plans:** TBD
**Notes:**
  - Token allocation per memory layer is configurable per campaign (research flag — empirical tuning required)
  - Session Journal tab UI lands here alongside the recap flow
**UI hint:** yes

### Phase 5: Rules Engine, Dice & Combat
**Goal:** A user can run a full D&D combat encounter — roll dice in-app, the AI manages enemy turns with visible rolls, conditions and HP track for all combatants, spell slots deduct on cast, the AI awards XP and prompts level-up, rests recover resources, and currency moves in/out automatically.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** COMB-01, COMB-02, COMB-03, COMB-04, CHAR-08, PROG-01, PROG-02, PROG-04, STATE-05
**Success Criteria** (what must be TRUE):
  1. User can roll d4/d6/d8/d10/d12/d20/d100 and custom expressions in-app; results appear in chat for the AI to narrate
  2. Combat tracker shows initiative order, current HP, and active conditions for player, party, companions, and enemies in one view
  3. AI manages enemy initiative, turn order, actions, and visible dice rolls (e.g. "the goblin rolls 14 to hit"); user never sees a hidden AI roll
  4. User can cast a spell from their spell list — the slot deducts automatically, concentration tracks, and the AI is aware the spell was cast
  5. After an encounter the AI awards XP, the app totals it, and the user is auto-prompted to level up at the threshold; short/long rests restore appropriate resources after AI narration
  6. Currency (CP/SP/EP/GP/PP) auto-updates from loot and purchases via AI tool calls
**Plans:** TBD
**Notes:**
  - This phase locks in the structured AI-mutation contract (tool calls + JSON-tail fallback); retrofitting it later is a near-rewrite
  - Test tool-calling reliability against LM Studio + Jan AI + Ollama before exit
  - Auto-save per turn (not just session end); append-only campaign_events log starts here
**UI hint:** yes

### Phase 6: Quests, NPCs & World State
**Goal:** A user playing a session sees the AI auto-populate a quest log and NPC tracker, watches faction reputations shift based on actions, sees the in-world calendar advance and a location breadcrumb update, and receives Inspiration for great roleplay — all via structured AI mutations.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** STATE-01, STATE-02, STATE-03, STATE-04, WORLD-03, PARTY-03
**Success Criteria** (what must be TRUE):
  1. As quests emerge in narration, the AI adds them to the quest log; the user can see all active and completed quests in the right panel
  2. As the user meets new NPCs, the AI adds them to the NPC tracker with names, descriptions, and relationship notes that update over time
  3. Faction relationships shift visibly in the UI based on the user's in-game actions
  4. UI displays current time of day, days elapsed, and season; values update as the AI narrates time passing
  5. UI shows a location breadcrumb (e.g. "Forest > Ancient Ruins > Crypt Level 2") that updates as the party moves
  6. AI awards Inspiration to the user's character when it detects exceptional roleplay; the inspiration token appears on the sheet
**Plans:** TBD
**UI hint:** yes

### Phase 7: Content Depth & Advanced Character
**Goal:** A user has the full toolkit for character expression and world setup — all SRD ability score methods (with negative-trait point buy), free multiclassing, SRD + custom feats, companions tracked as party members, Epic Boons past level 20, three world-setup modes (AI / brief / document import), browsable SRD reference, homebrew support, and optional encumbrance.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** CHAR-02, CHAR-03, CHAR-04, CHAR-05, PARTY-01, PARTY-02, PROG-03, WORLD-01, RULES-01, RULES-02, RULES-03, RULES-04, STATE-06
**Success Criteria** (what must be TRUE):
  1. User can generate ability scores via 4d6 drop-lowest (one reroll per stat), point buy with negative-trait bonuses, or manual entry — and assign preset or free-form negative traits in point buy mode
  2. User can multiclass into any combination of classes without ability score prerequisites and select feats from the SRD list or create custom feats via the in-app editor
  3. User can configure a campaign for solo play or a 2–4 character party, and add familiars/animal companions/summoned creatures as full party members with their own HP/stats/conditions
  4. User can set up a campaign world by letting the AI generate it, writing a text brief, or importing a PDF/text document — all three modes available per campaign
  5. User can browse the bundled SRD (rules, spells, items, monsters), add custom homebrew via in-app editor or file import, and import their own PDF/text documents as rules reference available to the AI
  6. User can enable encumbrance tracking per campaign and continue progressing characters past level 20 via Epic Boons
**Plans:** TBD
**Notes:**
  - PDF import (RULES-04, and the PDF world-doc path in WORLD-01) is the highest-complexity content feature — run a library-evaluation spike at the start of the phase before committing to an implementation path; if PDF is infeasible, ship text/markdown import for WORLD-01 and gate RULES-04 accordingly
  - SRD magic items database (RULES-02) bundled here; AI custom-loot path uses the Phase 5 inventory mutation contract
**UI hint:** yes

### Phase 8: Polish, Export & Accessibility
**Goal:** A user can export a full campaign as JSON, print/save their character sheet as a PDF, share a world setup as a starter template with another player, move their data folder, and use the entire app with adjusted font size, high contrast, keyboard navigation, and a screen reader.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** DIST-01, DIST-02, DIST-03, DIST-04, A11Y-01, A11Y-02, A11Y-03
**Success Criteria** (what must be TRUE):
  1. User can export a complete campaign as a JSON file and import a campaign JSON from another player with all state restored
  2. User can export their character sheet as a print-friendly PDF rendered via @react-pdf/renderer
  3. User can export a campaign as a sharable starter template (world config only, no save progress) and import a starter template into a new campaign
  4. User can change the campaign data folder from settings; existing data migrates and the app continues using the new location after restart
  5. User can scale the app's text size and enable high contrast mode from settings; both persist across launches
  6. Every interactive element has an ARIA label and can be reached/operated via keyboard; streamed AI narration announces in screen readers (NVDA + VoiceOver) on paragraph completion
**Plans:** TBD
**UI hint:** yes

### Phase 9: Distribution & Update Notifications
**Goal:** A user can download a signed, notarized SoloCampaign installer for their OS from a public GitHub Release, install it cleanly, and later see a notification when a new version ships — with the option to download and install manually.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements:** DIST-05
**Success Criteria** (what must be TRUE):
  1. A public GitHub Release exists with signed Windows (.exe via NSIS), notarized macOS (.dmg), and Linux (AppImage + .deb) artifacts produced by a GitHub Actions matrix build
  2. macOS installer passes Gatekeeper and notarization on Intel and M-series; Windows installer is signed via Azure Trusted Signing and shows the publisher name in SmartScreen
  3. When a new version is published on GitHub, the running app notifies the user; the user can dismiss or open the release page to download manually — no silent install ever happens
  4. better-sqlite3 native module loads correctly inside the notarized macOS hardened runtime on both Intel and Apple Silicon
**Plans:** TBD
**Notes:**
  - Validate macOS hardened runtime entitlements for the better-sqlite3 .node binary (research flag)
  - Code signing certs procured during Phase 1 should now be in hand; if not, this phase blocks until procurement completes
**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Secure Shell | 2/3 | In progress | - |
| 2. Character Domain & Live Sheet | 0/0 | Not started | - |
| 3. AI Engine & Provider Abstraction | 0/0 | Not started | - |
| 4. Long-Campaign Memory & Session Flow | 0/0 | Not started | - |
| 5. Rules Engine, Dice & Combat | 0/0 | Not started | - |
| 6. Quests, NPCs & World State | 0/0 | Not started | - |
| 7. Content Depth & Advanced Character | 0/0 | Not started | - |
| 8. Polish, Export & Accessibility | 0/0 | Not started | - |
| 9. Distribution & Update Notifications | 0/0 | Not started | - |

---

## Coverage Summary

**Total v1 requirements:** 53
**Mapped:** 53
**Orphans:** 0

| Category | Count | Phases |
|----------|-------|--------|
| Foundation (FOUND) | 4 | 1, 3 |
| Character (CHAR) | 9 | 2, 5, 7 |
| Party (PARTY) | 3 | 6, 7 |
| Session/AI (SESS) | 8 | 1, 3, 4 |
| World Setup (WORLD) | 3 | 2, 6, 7 |
| Combat (COMB) | 4 | 5 |
| Progression (PROG) | 4 | 5, 7 |
| World State (STATE) | 6 | 5, 6, 7 |
| Rules & Content (RULES) | 4 | 7 |
| Distribution (DIST) | 5 | 8, 9 |
| Accessibility (A11Y) | 3 | 8 |

---

## Architecture Ordering Rationale

The phase order follows the research-mandated build sequence so that load-bearing architectural decisions land before features depend on them:

1. **Foundation before everything** — Secure Electron baseline + SQLite + IPC pattern cannot be retrofitted (Pitfalls #1, #3, #4, #11, #12, #15)
2. **Character domain before AI** — Forces the largest domain model through the persistence layer with no AI distractions; surfaces schema issues early
3. **AI provider abstraction before memory** — Validates the LLMProvider interface with one-session play before betting on it for summarization
4. **Memory before mechanics** — A long campaign without summarization is broken; mechanics add volume on top of the foundation (Pitfall #2)
5. **Rules engine before content depth** — Locks in the AI-state-mutation contract (tool calls + JSON-tail) before content surfaces depend on it (Pitfall #6)
6. **Quests/NPCs before content polish** — Exercises the structured mutation contract end-to-end before broadening content
7. **Content depth before polish** — Feature surface complete before export/accessibility hardening
8. **Polish before distribution** — Do not fight code signing and notarization complexity until the app is stable; certs procured during Phase 1
9. **Distribution last** — Public release closes the v1 loop

---

*Generated: 2026-05-19*
