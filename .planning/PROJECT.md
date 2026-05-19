# SoloCampaign

## What This Is

SoloCampaign is a local desktop application (Electron, Win/Mac/Linux) for playing solo D&D 5e campaigns powered by a pluggable AI Dungeon Master. Players connect any AI provider — Gemini API, LM Studio, Jan AI, or any OpenAI-compatible local LLM — and the AI runs the world, NPCs, combat, and story while the player manages their character and party. It ships as a public release with a proper installer and GitHub-based update notifications.

## Core Value

A player with no group and no DM can sit down, load SoloCampaign, and play a full D&D 5e campaign — from character creation to level 20+ — with a competent AI DM that remembers everything, follows the rules (or bends them on command), and keeps the world alive.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**AI Engine**
- [ ] Per-campaign AI provider configuration (Gemini API, LM Studio, Jan AI, any OpenAI-compatible endpoint)
- [ ] AI fallback: auto-retry on failure, prompt to switch to local LLM if cloud AI fails
- [ ] Per-campaign DM personality text field (tone, style, strictness)
- [ ] Per-campaign rules strictness setting (RAW vs. narrative flexibility)
- [ ] AI receives full context at session start: session summary, character sheet, active quests, world brief, recent NPCs

**Session & Campaign Flow**
- [ ] Multiple campaigns, save/resume, indefinite length (level 1–20+ with Epic Boons)
- [ ] Structured session start: location, goal, and context prompts before AI narrates opening
- [ ] End-of-session prompt: AI writes recap, player adds notes, then saves
- [ ] Auto-session summarization fed back to AI each new session
- [ ] Campaign sharing: export/import campaign files, plus shareable starter templates

**World Setup (all three modes per campaign)**
- [ ] AI generates world from scratch (player just names the campaign)
- [ ] Player writes a world brief (text field: setting, tone, factions, main conflict)
- [ ] Import a pre-written adventure or setting document (PDF/text)

**Character System**
- [ ] Full step-by-step character builder (race, class, background, ability scores, feats, spells)
- [ ] Ability score generation: 4d6 drop lowest with one reroll per stat (in-app), point buy with negative traits for bonus points, or manual entry
- [ ] Negative traits: preset mechanical flaws (e.g. Frail: −2 max HP/level) AND free-form narrative flaws the AI tracks
- [ ] Multiclassing with no ability score prerequisites
- [ ] SRD feats built-in plus in-app feat editor for custom feats
- [ ] Solo or party mode per campaign (1–4 player-controlled characters)
- [ ] Live tracking: HP, spell slots, conditions, death saves, inspiration, XP, currency
- [ ] Full spell list with click-to-cast, auto slot deduction, concentration tracking; AI knows spell list
- [ ] Companions (familiars, animal companions, summoned creatures) tracked as party members
- [ ] Attunement tracked (not enforced — player decides)
- [ ] Encumbrance optional per campaign
- [ ] Character portrait image (imported from local file)

**Combat**
- [ ] In-app dice roller; player rolls for their characters, feeds results to AI narration
- [ ] AI manages enemy initiative, turn order, actions, and visible dice rolls shown in chat
- [ ] Combat tracker: initiative order, HP, conditions for all combatants (player + party + enemies + companions)
- [ ] Conditions applied manually by player OR by AI (both paths work)

**Right Panel Tabs**
- [ ] Character Sheet (hybrid layout — familiar structure, app-styled)
- [ ] Combat Tracker
- [ ] NPC Tracker (characters met, relationship notes — AI auto-populates)
- [ ] Session Journal (AI-generated recap + player notes side by side)
- [ ] Inventory (full item list, item weights if encumbrance enabled, currency)

**Progression & World State**
- [ ] XP tracking: AI awards XP after encounters, app tracks total, auto-prompts level up
- [ ] Epic Boons support for post-level-20 progression
- [ ] Quest log managed by AI (adds quests as they emerge, marks complete)
- [ ] Faction/reputation tracking managed by AI
- [ ] In-world time/calendar managed by AI (time of day, days passed, seasons shown in UI)
- [ ] Simple location tracker breadcrumb (Forest > Ancient Ruins > Crypt Level 2)
- [ ] Inspiration awarded by AI when it recognizes great roleplay moments

**Rulebook & Homebrew**
- [ ] D&D 5e SRD bundled as reference (player-browsable)
- [ ] Import user's own documents (PDF/text) as additional rules reference
- [ ] Homebrew input: in-app text editor AND file import
- [ ] SRD magic items database built-in; AI can also invent custom loot added to inventory
- [ ] Full currency tracking (CP/SP/EP/GP/PP); AI awards/deducts automatically

**Death & Rests**
- [ ] Death/permadeath mode configurable per campaign
- [ ] Rest system: player requests rest, AI narrates whether the situation allows it, app processes resource recovery

**Export & Data**
- [ ] Full campaign export (JSON)
- [ ] Character sheet export (PDF / print-friendly)
- [ ] Campaign cover image (imported from local file)
- [ ] Data stored in OS default app data folder with option to move to custom folder

**Distribution & Updates**
- [ ] Cross-platform builds: Windows (.exe), macOS, Linux
- [ ] GitHub release update notifications (notify user, manual download)
- [ ] Mostly offline: local LLM = no internet required; Gemini/cloud AI requires internet

**Accessibility & UI**
- [ ] Modern dark UI with subtle fantasy flavor
- [ ] Full accessibility: font size controls, high contrast mode, screen reader support
- [ ] English only (v1)
- [ ] Text-only (no audio)

### Out of Scope

- Multiplayer / co-op — solo play only; multiplayer changes the entire architecture
- Voice input / TTS DM narration — text-only for v1 simplicity
- Battle maps / tactical grid / visual maps — pure text narrative
- AI-generated scene art — v2 consideration
- Pre-made bundled adventure modules — SRD + blank slate only
- Cloud save / online sync — local storage only
- Multiple UI languages — v1 English only
- Ability score multiclassing prerequisites — deliberately removed for player freedom

## Context

- Target audience: solo D&D players who want a full campaign experience without a group
- Sessions range from 30 minutes to 5 hours; campaigns run from level 1 to 20+ over months
- AI context window is a real constraint for long campaigns — session summarization is load-bearing
- The SRD covers core 5e rules (most classes, races, spells) but excludes some proprietary content; players import their own materials for fuller coverage
- LM Studio and Jan AI expose OpenAI-compatible API endpoints — the app treats any such endpoint the same way
- "Paragon levels" = Epic Boons system from the official 5e DMG for post-level-20 characters

## Constraints

- **Platform**: Electron + Node.js — cross-platform desktop, ships as native installer
- **Storage**: Local SQLite for campaign data; no cloud backend
- **AI**: Any OpenAI-compatible API (local or cloud) — app must not be locked to one provider
- **Rules content**: Only D&D 5e SRD can be bundled; proprietary sourcebooks must be imported by the user
- **Offline**: Core gameplay must work fully offline when a local LLM is configured
- **Distribution**: GitHub Releases for public distribution; auto-update notifications only (no silent install)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron + Node.js | Cross-platform, ships as .exe, web tech inside — matches dev familiarity and target UX | — Pending |
| Per-campaign AI config | Different campaigns may use different providers (local vs. cloud) | — Pending |
| Session summarization over full history | AI context windows can't hold months of play; summaries keep long campaigns viable | — Pending |
| No multiclassing prerequisites | Player freedom over rules correctness for solo play | — Pending |
| SRD-only bundled rules | Legal — proprietary content must come from the player | — Pending |
| Text-only (no audio) | Scope control; TTS and ambient audio can be v2 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-19 after initialization*
