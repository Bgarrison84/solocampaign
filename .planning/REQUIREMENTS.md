# SoloCampaign — Requirements

## v1 Requirements

### Foundation & Infrastructure

- [ ] **FOUND-01**: User can install and launch SoloCampaign on Windows (.exe), macOS, and Linux
- [ ] **FOUND-02**: All campaign data persists locally in SQLite with versioned schema migrations
- [ ] **FOUND-03**: User can connect any OpenAI-compatible AI endpoint (LM Studio, Jan AI, Ollama, OpenRouter, OpenAI) or Gemini API per campaign
- [x] **FOUND-04**: API keys are stored encrypted via Electron safeStorage (never plaintext)

### Character Creation & Management

- [ ] **CHAR-01**: User can create a character with step-by-step builder covering race, class, background, and equipment from the D&D 5e SRD
- [ ] **CHAR-02**: User can generate ability scores via 4d6 drop-lowest (one reroll per stat), point buy with negative trait bonuses, or manual entry
- [ ] **CHAR-03**: User can assign negative traits (preset mechanical flaws or free-form narrative flaws) during point buy to gain additional ability score points
- [ ] **CHAR-04**: User can multiclass freely across any combination of classes without ability score prerequisites
- [ ] **CHAR-05**: User can select feats from the built-in SRD list or create custom feats via the in-app feat editor
- [ ] **CHAR-06**: User can import a local image file as their character portrait
- [ ] **CHAR-07**: User can view and update HP, spell slots, death saves, XP, currency, and conditions live during play on the character sheet panel
- [ ] **CHAR-08**: User can manage their full spell list — click to cast, auto-deduct slots, track concentration, with AI aware of all prepared spells
- [ ] **CHAR-09**: User can track attuned magic items (attunement limit displayed but not enforced)

### Party & Companions

- [ ] **PARTY-01**: User can run a campaign as a solo character or control a party of 2–4 characters (set per campaign)
- [ ] **PARTY-02**: User can track familiars, animal companions, and summoned creatures as full party members with their own HP, stats, and conditions
- [ ] **PARTY-03**: AI awards Inspiration to the player's character when it detects exceptional roleplay in the narrative

### Session & AI Engine

- [ ] **SESS-01**: User can play in a split-panel layout with narrative chat on the left and tabbed panels (Character Sheet, Combat Tracker, NPC Tracker, Session Journal, Inventory) on the right
- [ ] **SESS-02**: App maintains a three-layer memory architecture: verbatim hot context (recent messages) + recent session summaries + a rolling campaign summary — injected at session start
- [ ] **SESS-03**: Session start presents structured prompts (current location, session goal, context notes) before the AI narrates the opening
- [ ] **SESS-04**: Ending a session triggers a recap flow: AI generates a session summary, player can add personal notes, then the session saves
- [ ] **SESS-05**: User can configure a unique AI provider per campaign (different campaigns can use different models)
- [ ] **SESS-06**: User can write a per-campaign DM personality description (tone, style, narrative preferences)
- [ ] **SESS-07**: User can set rules strictness per campaign (rules-as-written vs. narrative flexibility)
- [ ] **SESS-08**: App automatically retries failed AI requests and prompts the user to switch to a configured local LLM if a cloud provider fails

### World Setup

- [ ] **WORLD-01**: User can set up a campaign world by having the AI generate it, writing a text brief, or importing a document (PDF or text file) — all three modes available per campaign
- [ ] **WORLD-02**: User can set a campaign cover image and character portrait by importing local image files
- [ ] **WORLD-03**: UI displays a location breadcrumb showing the current location hierarchy (e.g., Forest > Ancient Ruins > Crypt Level 2)

### Combat

- [ ] **COMB-01**: User can roll any standard D&D dice (d4, d6, d8, d10, d12, d20, d100) plus custom expressions via an in-app dice roller; results are surfaced to the AI for narration
- [ ] **COMB-02**: Combat tracker displays initiative order, current HP, and active conditions for all combatants (player characters, party, companions, enemies)
- [ ] **COMB-03**: AI manages enemy initiative, turn order, actions, and its own dice rolls — rolls are shown visibly in chat (e.g., "the goblin rolls a 14 to hit...")
- [ ] **COMB-04**: Conditions (Poisoned, Frightened, Stunned, etc.) can be applied by the AI in narrative or toggled manually by the player on any combatant

### Progression & Rests

- [ ] **PROG-01**: AI awards XP after encounters; app tracks total XP and auto-prompts the player to level up when a threshold is reached
- [ ] **PROG-02**: Player can request a short or long rest; AI narrates whether the situation permits it; app auto-recovers appropriate resources on approval
- [ ] **PROG-03**: App supports Epic Boons for characters beyond level 20 using the official 5e DMG system
- [ ] **PROG-04**: User can configure death/permadeath rules per campaign (permadeath, resurrection rules, or soft consequences)

### World State Tracking

- [ ] **STATE-01**: AI maintains a quest log — adds quests as they emerge in the story, marks them complete when resolved; player can view all quests in the right panel
- [ ] **STATE-02**: AI populates and updates an NPC tracker with characters the player encounters, including relationship notes and key information
- [ ] **STATE-03**: AI tracks faction relationships and adjusts the player's reputation with factions based on in-game actions
- [ ] **STATE-04**: AI manages in-world time (time of day, days elapsed, season) shown in the UI
- [ ] **STATE-05**: App tracks full currency (CP/SP/EP/GP/PP); AI automatically awards and deducts currency from loot and purchases
- [ ] **STATE-06**: User can enable or disable encumbrance/carrying capacity tracking per campaign

### Rules, Content & Homebrew

- [ ] **RULES-01**: D&D 5e SRD is bundled and browsable in-app as a reference (rules, spells, items, monsters)
- [ ] **RULES-02**: SRD magic items are available in a searchable database; AI can also introduce custom magic items that are added to the player's inventory
- [ ] **RULES-03**: User can add homebrew content (custom races, classes, spells, rules) via an in-app text editor or by importing a file
- [ ] **RULES-04**: User can import their own documents (PDF or text) as supplementary rules reference available to the AI

### Export, Data & Distribution

- [ ] **DIST-01**: User can export a complete campaign as a JSON file (full backup and portability)
- [ ] **DIST-02**: User can export their character sheet as a print-friendly PDF
- [ ] **DIST-03**: User can import a campaign file from another player; user can export their campaign world setup as a starter template (no save progress, just world config)
- [ ] **DIST-04**: User can change the folder where campaign data is stored (default OS app data dir with option to move to custom location)
- [ ] **DIST-05**: App notifies the user when a new version is available on GitHub; user downloads and installs manually

### Accessibility & UX

- [ ] **A11Y-01**: User can increase or decrease the app's text size in settings
- [ ] **A11Y-02**: User can enable a high contrast display mode
- [ ] **A11Y-03**: All interactive elements have ARIA labels and are fully keyboard-navigable

---

## v2 Requirements (Deferred)

- Voice input / TTS DM narration — text-only for v1
- AI-generated scene art (DALL-E, Stable Diffusion) — v2 after core is stable
- Multiple UI languages / localization — English only for v1
- Cloud sync / online backup — local-only for v1; users can move data folder to a cloud-synced location manually
- Ambient sound themes — explicitly out of scope per user preference

---

## Out of Scope

- **Multiplayer / co-op** — solo play only; multiplayer requires a fundamentally different architecture
- **Battle maps / tactical grid** — pure narrative experience; no visual map system
- **Pre-made bundled adventure modules** — SRD + blank slate only; players import their own content
- **Ability score multiclassing prerequisites** — removed by design for player freedom in solo play
- **Auto-update / silent install** — notify-only; players download new versions from GitHub manually
- **Audio (ambient or TTS)** — explicitly excluded; text-only experience

---

## Traceability

Generated by roadmapper on 2026-05-19. 53/53 v1 requirements mapped to phases.

| REQ-ID | Phase | Plan |
|--------|-------|------|
| FOUND-01 | Phase 1 | TBD |
| FOUND-02 | Phase 1 | TBD |
| FOUND-03 | Phase 3 | TBD |
| FOUND-04 | Phase 1 | 01-03 ✓ |
| CHAR-01 | Phase 2 | TBD |
| CHAR-02 | Phase 7 | TBD |
| CHAR-03 | Phase 7 | TBD |
| CHAR-04 | Phase 7 | TBD |
| CHAR-05 | Phase 7 | TBD |
| CHAR-06 | Phase 2 | TBD |
| CHAR-07 | Phase 2 | TBD |
| CHAR-08 | Phase 5 | TBD |
| CHAR-09 | Phase 2 | TBD |
| PARTY-01 | Phase 7 | TBD |
| PARTY-02 | Phase 7 | TBD |
| PARTY-03 | Phase 6 | TBD |
| SESS-01 | Phase 1 | TBD |
| SESS-02 | Phase 4 | TBD |
| SESS-03 | Phase 4 | TBD |
| SESS-04 | Phase 4 | TBD |
| SESS-05 | Phase 3 | TBD |
| SESS-06 | Phase 3 | TBD |
| SESS-07 | Phase 3 | TBD |
| SESS-08 | Phase 3 | TBD |
| WORLD-01 | Phase 7 | TBD |
| WORLD-02 | Phase 2 | TBD |
| WORLD-03 | Phase 6 | TBD |
| COMB-01 | Phase 5 | TBD |
| COMB-02 | Phase 5 | TBD |
| COMB-03 | Phase 5 | TBD |
| COMB-04 | Phase 5 | TBD |
| PROG-01 | Phase 5 | TBD |
| PROG-02 | Phase 5 | TBD |
| PROG-03 | Phase 7 | TBD |
| PROG-04 | Phase 5 | TBD |
| STATE-01 | Phase 6 | TBD |
| STATE-02 | Phase 6 | TBD |
| STATE-03 | Phase 6 | TBD |
| STATE-04 | Phase 6 | TBD |
| STATE-05 | Phase 5 | TBD |
| STATE-06 | Phase 7 | TBD |
| RULES-01 | Phase 7 | TBD |
| RULES-02 | Phase 7 | TBD |
| RULES-03 | Phase 7 | TBD |
| RULES-04 | Phase 7 | TBD |
| DIST-01 | Phase 8 | TBD |
| DIST-02 | Phase 8 | TBD |
| DIST-03 | Phase 8 | TBD |
| DIST-04 | Phase 8 | TBD |
| DIST-05 | Phase 9 | TBD |
| A11Y-01 | Phase 8 | TBD |
| A11Y-02 | Phase 8 | TBD |
| A11Y-03 | Phase 8 | TBD |

---

## Definition of Done (v1)

- All REQ-IDs marked complete in the phase they're assigned to
- Character can be created and played from level 1 to level 20+ across multiple sessions without AI memory degradation
- Campaign data persists across app restarts, exports cleanly to JSON, and imports successfully
- App installs and runs on Windows, macOS, and Linux without manual dependency setup
- All accessibility requirements verified with a screen reader
