# Feature Landscape

**Project:** SoloCampaign
**Domain:** Solo D&D 5e desktop app with pluggable AI Dungeon Master
**Researched:** 2026-05-19
**Mode:** Ecosystem
**Overall Confidence:** HIGH (cross-referenced 12+ active competitors and player-expectation sources)

---

## Executive Summary

The solo-AI-TTRPG market in 2026 splits cleanly into three archetypes:

1. **Freeform fiction generators** (AI Dungeon, NovelAI, KoboldAI) — no rules engine, no determinism, infinite hallucination. Players churn after ~10 sessions due to memory loss and rules drift.
2. **Hosted D&D-flavored AI GMs** (Friends & Fables, RoleForge, AIDungeonMaster.ai, Macer.ai, AI Realm, Voyage) — subscription SaaS, server-side memory, cloud-only AI, no local LLM support, no offline play, no data ownership.
3. **Roleplay frontends** (SillyTavern, TavernAI) — local-first, BYO-LLM, infinitely flexible, but zero D&D structure (no character sheets, no combat tracker, no XP, no rules awareness).

**SoloCampaign's gap to exploit:** the *intersection* of (1) local-first / BYO-LLM (SillyTavern strength) and (2) actual D&D 5e structure (hosted GMs' strength). No competitor is currently delivering both well. The PROJECT.md requirements map almost perfectly onto this gap.

**Critical insight from competitor failure modes:** Every AI-DM that died in 2025-2026 (Deep DM, NeverEndingQuest) died from one of three problems: memory loss in long campaigns, AI overriding dice/rules, or subscription burnout. SoloCampaign's session-summarization + player-rolls-dice + local-LLM approach directly addresses all three.

---

## Table Stakes

Features users **expect** for an AI-DM D&D app. Missing any of these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Character creation (full 5e SRD)** | Foundational. Users won't engage without race/class/background/abilities. | High | All SRD classes, races, backgrounds. PROJECT.md already commits to this. |
| **Ability score generation (multiple methods)** | Players have strong preferences (4d6 vs point buy vs standard array). | Low | PROJECT.md goes further with negative-trait bonus points — differentiator. |
| **Live character sheet (HP, slots, conditions, XP, currency)** | The "always visible" anchor of every D&D app. | Medium | PROJECT.md scope is correct. |
| **Spell list with slot tracking** | Casters cannot function without it. | Medium | Click-to-cast + auto-slot-deduct is standard expectation now (D&D Beyond set the bar). |
| **Dice roller** | Players want visible, verifiable rolls. | Low | Must be in-app, not just "AI says you rolled a 14." |
| **Combat tracker (initiative, HP, conditions)** | All competitors have this. Solo play without one is unplayable past level 5. | High | Initiative for player + party + enemies + companions. |
| **Persistent campaign memory across sessions** | The #1 complaint about AI Dungeon, and the #1 selling point of every competitor that beats it. | Very High | Session summarization is load-bearing. PROJECT.md correctly identifies this. |
| **Save / load / multiple campaigns** | Standard for any campaign manager. | Low | SQLite makes this trivial. |
| **Session journal / recap** | Players forget; AI needs to be reminded. Two-way value. | Medium | AI-generated recap + player notes is the consensus pattern. |
| **NPC tracker** | Long campaigns produce dozens of NPCs. Without a list, players lose track. | Medium | Auto-populated by AI is the modern expectation (RoleForge, Voyage). |
| **Quest log** | Players need to know what they're doing. Universal in all competitors. | Medium | AI-managed (add/complete) is now the baseline. |
| **Inventory + currency tracking** | Loot is half the fun. Must be tracked or it gets forgotten. | Medium | CP/SP/EP/GP/PP standard. |
| **XP and level-up flow** | Progression is the core motivator. Must be smooth. | Medium | Auto-prompt level-up on threshold is expected UX. |
| **Rest mechanics (short / long rest)** | Resource recovery loop is foundational to 5e. | Low | Must process slot/HP recovery on confirm. |
| **AI fallback / graceful failure** | Cloud APIs fail. Local LLMs OOM. Players need recovery, not crashes. | Medium | PROJECT.md already specifies retry + switch-to-local. Critical for trust. |
| **Local data storage** | Players who own their data don't churn. D&D Beyond outages have burned this lesson into the community. | Low | SQLite is correct choice. |
| **Cross-platform desktop builds** | Win/Mac/Linux is the standard expectation for any non-mobile RPG tool. | Medium | Electron handles this. |
| **Dark mode UI with fantasy flavor** | Universal in this space. Default expectation. | Low | PROJECT.md commits to this. |
| **Death saves and combat death** | Core 5e mechanic. Must be tracked. | Low | Death/permadeath as configurable toggle is the modern norm. |
| **SRD rules reference (browsable)** | Players reference rules constantly. In-app beats Alt-Tab. | Medium | SRD is legally bundleable, must be included. |

---

## Differentiators

Features that set SoloCampaign apart. Not all competitors have these — building any 3-4 well creates competitive moat.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **BYO-LLM (any OpenAI-compatible endpoint)** | Killer differentiator. Hosted competitors lock you to their AI. Local LLM = zero recurring cost + privacy + offline + no censorship. | Medium | This is SoloCampaign's biggest weapon. SillyTavern proved the demand. PROJECT.md already commits. |
| **Per-campaign AI provider config** | Different campaigns may need different models (Claude for narrative campaigns, local for grindy combat, Gemini for cheap exploration). Hosted competitors can't do this. | Low | Pure config layer; cheap to build, massive UX win. |
| **Per-campaign DM personality + rules strictness** | Replicates "different DM, different vibe" — a real human-DM thing that AI tools rarely model. | Low | Just additional system-prompt fields. Tiny effort, huge perceived value. |
| **Negative traits with mechanical AND narrative options** | Sets you apart from "balanced point buy only" tools. Solo players love character flaws. PROJECT.md has this. | Medium | Preset mechanical flaws (Frail: -2 HP/lvl) + free-form narrative flaws AI tracks. Unique in the space. |
| **No multiclassing prerequisites (configurable)** | Solo players want freedom over rules-lawyering. Competitors enforce RAW; SoloCampaign liberates. | Low | Just don't enforce — easier than enforcing. PROJECT.md commits to this. |
| **Three world-setup modes (AI-generated / player brief / imported document)** | Most competitors give you one mode. PROJECT.md offering three is a real differentiator. | Medium | Document import is the highest-value of the three — players want to bring their existing worldbooks. |
| **Adventure / document import (PDF + text)** | SillyTavern users build worldbooks; D&D players have PDFs. Bridging this gap is rare. | High | PDF parsing is the painful part. Text import is easy. |
| **Homebrew support (in-app editor + file import)** | D&D players have homebrew. None of the AI-DM tools support importing user homebrew well. | Medium | Big trust signal — shows respect for player's existing prep. |
| **Player rolls dice, AI narrates outcome** | Inverts the "AI rolls in secret" anti-pattern that breaks trust. RoleForge advertises this; SoloCampaign should make it default. | Low | Dice transparency = anti-cheating = trust. The single most under-appreciated trust feature. |
| **Companions tracked as party members** | Druids, rangers, wizards with familiars all need this. Most AI-DMs ignore companions or get confused by them. | Medium | Just treat them as party members in the data model. |
| **Epic Boons / post-level-20 progression** | Almost no competitor supports past level 20. Solo campaigns that hit level 20 deserve continuation. | Medium | DMG-defined; data model just needs another progression track. |
| **Per-campaign permadeath toggle** | Some players want stakes, some want safety. Letting them choose per campaign is generous. | Low | Single boolean + UI flow change. |
| **Configurable encumbrance** | Most players hate encumbrance; some love it. Toggle = respect. | Low | If on, item weights; if off, hide. |
| **Full campaign export (JSON)** | Data ownership = trust. Players burned by D&D Beyond, Roll20, AI Dungeon want their data portable. | Low | SQLite → JSON is trivial. Huge marketing point. |
| **Offline gameplay (local LLM)** | Hosted competitors fundamentally cannot do this. Airplane / no-WiFi solo D&D is a real desire. | Medium | Just a function of the BYO-LLM design. Worth advertising. |
| **Campaign sharing (export/import + starter templates)** | Community-extensibility. Lets the project grow without server costs. | Medium | "Share your started campaign" is viral by design. |
| **AI auto-populates NPCs / quests / factions** | Manual tracking is tedious; auto-tracking is magical. RoleForge does this well; SoloCampaign should match. | High | Structured AI output (tool calls / JSON schema) is the implementation pattern. |
| **In-world time/calendar tracking** | Long campaigns need time pressure (winter coming, festival in 3 days). AI managing this autonomously is rare and delightful. | Medium | Lightweight state in the world model. |
| **Location breadcrumb tracking** | "Where am I?" is a constant question in long campaigns. Cheap to build, huge orientation value. | Low | Just a stack/list in state. |
| **Accessibility (font size, contrast, screen reader)** | Almost no AI-DM tool does this. Tabletop community has strong accessibility advocacy. | Medium | Differentiator AND ethical baseline. PROJECT.md commits. |
| **GitHub-based update notifications** | Trust signal (no auto-updates pushing changes you didn't approve), aligns with the open / player-controlled ethos. | Low | electron-updater or custom GitHub release check. |

---

## Anti-Features

Features to **deliberately NOT build**. Each is either a known failure mode in this space, a scope trap, or a fundamental misalignment with the product thesis.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **AI rolls dice in secret** | Breaks trust instantly. Players catch the AI fudging and quit. Documented failure mode of AI Dungeon. | Player rolls in-app, feeds result to AI. AI rolls visible enemy dice in chat. |
| **AI narrates outcome before player rolls** | "Your sword strikes true for 8 damage!" before the d20 collapses the game into choose-your-own-adventure. Top anti-pattern from the dev.to prompt architecture article. | Force structured turn: declare action → roll → narrate outcome. |
| **Locking to a single AI provider** | Killed many competitors. Pricing changes, content filters, model deprecations all destroy user trust overnight. | Already in PROJECT.md: any OpenAI-compatible endpoint. |
| **Cloud sync / multiplayer / co-op** | PROJECT.md correctly excludes. Multiplayer changes the whole architecture. Solo focus is the moat. | Stay solo. Reference the export feature for any "sharing" demand. |
| **Battle maps / tactical grid / VTT mode** | Massive scope creep. Foundry/Roll20 own this space. Adding it makes SoloCampaign a worse VTT instead of a better solo tool. | Pure text narrative. PROJECT.md already commits. |
| **Voice / TTS / audio** | Big complexity, niche demand, every competitor that built it (Macer, ZapGM) has mixed reviews. Distracting from the core loop. | Text-only v1. PROJECT.md correct. v2 consideration if demand emerges. |
| **AI-generated scene art** | Hot in 2024-2025, cooling in 2026 due to quality concerns + cost. Adds latency to every scene. | Skip. Character portrait via file import is enough. PROJECT.md correct. |
| **Pre-made bundled adventure modules** | Legal risk (only the SRD is safe), and competes with the "import your own adventure" feature. | SRD + blank + import only. PROJECT.md correct. |
| **Multiple UI languages** | Translation is expensive, AI roleplay quality varies wildly across languages. | English v1 only. PROJECT.md correct. |
| **Enforcing ability score multiclass prerequisites** | Solo player freedom matters more than RAW compliance. | Allow free multiclassing. PROJECT.md correct. |
| **Hard content filter / safety layer** | AI Dungeon's #1 quit reason. Local LLMs route around it anyway. Adds friction with no payoff. | Trust the player. The user's choice of model is their content policy. |
| **Forcing online connectivity for any core feature** | Breaks the "offline with local LLM" promise. Each online dependency is a fragility. | Optional online-only features (Gemini, GitHub update check) are fine; nothing core. |
| **Auto-updating with silent installs** | Players want control over their tool. Every silent auto-update is a trust debit. | GitHub notification + manual download. PROJECT.md correct. |
| **Subscription / recurring billing** | Free + BYO-LLM is the entire competitive thesis. Charging recurring kills it. | One-time release, free forever, optional donations / Patreon for development. |
| **Cloud telemetry / analytics by default** | Privacy-conscious users (a large overlap with the local-LLM crowd) will be hostile. | Opt-in only, or no telemetry. |
| **Procedurally generated everything ("infinite content")** | Pure randomness produces "mushy middle" — endless sameness that loses surprise. Cited as a key failure mode in AI Dungeon Masters literature. | Use AI for *consequential* generation tied to player choices, not for filler. |
| **Forcing AI to know full transcript** | Context window blowup, slow responses, escalating costs. Killed AI Dungeon's long campaigns. | Session summarization is load-bearing. PROJECT.md correctly identifies. |
| **Letting AI silently rewrite character sheet** | LLMs hallucinate stats. Authoritative state must be in the deterministic store. | App is authoritative for stats; AI requests changes via tool calls / structured output; player can confirm. |
| **One mega-prompt for everything** | "God prompt" pattern is brittle. Token bloat, instruction conflicts, hallucination chains. | Layered prompts: world state + recent session + character + current scene. Each provided as needed. |
| **Mobile app port (v1)** | Different UX, different LLM constraints (no LM Studio on mobile), splits dev focus. | Desktop only. Mobile is a v2+ consideration if it ever makes sense. |

---

## Feature Dependencies

Core ordering constraints. Useful for roadmap phase structure.

```
Foundation layer (must come first)
├── SQLite schema + campaign data model
├── AI provider abstraction (any OpenAI-compatible endpoint)
└── Cross-platform Electron shell + IPC

Character layer (requires foundation)
├── Character builder (race/class/background/abilities)
├── Live character sheet (HP/slots/XP/currency)
├── Spell list + slot tracking
└── Inventory + currency

Session layer (requires character + AI)
├── Session start flow (location/goal/context)
├── Chat/narration UI
├── Dice roller
├── Session journal / recap
└── Session summarization → context injection

Combat layer (requires session + character)
├── Combat tracker (initiative, HP, conditions)
├── Player-rolls-dice loop
└── AI enemy management

World layer (requires session + summarization)
├── NPC tracker (auto-populated)
├── Quest log (AI-managed)
├── Faction/reputation
├── In-world time/calendar
└── Location breadcrumb

Long-campaign layer (requires world + session summarization)
├── Multi-session memory
├── XP / level-up flow
├── Rest mechanics
└── Epic Boons (post-20)

Content layer (independent of other layers)
├── SRD bundle (rules + spells + items)
├── Homebrew editor
├── Document import (PDF/text)
└── Adventure import

Polish / distribution (last)
├── Export (JSON / PDF)
├── Accessibility
├── Update notifications
└── Installers for Win/Mac/Linux
```

**Critical dependency:** Session summarization is upstream of nearly every "feels good in long campaigns" feature. Build it early; iterate on it constantly.

**Loose coupling opportunity:** Character layer and World layer can develop in parallel after foundation. Combat layer depends on both.

---

## MVP Recommendation

A defensible v0.1 release that proves the thesis and earns the right to keep building.

**Must ship in MVP:**
1. AI provider config (Gemini + any OpenAI-compatible local endpoint) — the whole thesis
2. Character builder (SRD-complete) + live character sheet — playable from day one
3. Single-campaign save/resume with session summarization — proves the long-campaign claim
4. Chat-based session flow + in-app dice roller — the core loop
5. Combat tracker with player-rolls-dice paradigm — trust feature
6. Session journal + AI-generated recap — closes the session loop
7. NPC + quest auto-population — the "AI feels smart" moment
8. Cross-platform installers (Win/Mac/Linux) — distribution baseline

**Defer to post-MVP:**
- Adventure / document import (PDF parsing is hard; ship without, add v0.2)
- Epic Boons (almost no MVP user will be level 20; add when first players approach 18+)
- Homebrew editor (file import is enough for MVP; in-app editor is a polish)
- Encumbrance toggle (just default off; revisit if requested)
- Campaign sharing / templates (single-user first; community features later)
- Faction tracking (NPCs + quests are sufficient initial world state)
- Accessibility hardening (semantic HTML / dark mode in MVP; full screen-reader pass in v0.2)

**Skip indefinitely:**
- Anything from the Anti-Features table.

---

## Sources

- [Best AI Dungeon Master Tools for D&D 2026 — AIDungeonMaster.ai](https://aidungeonmaster.ai/blog/best-ai-dungeon-masters-2026/) (HIGH — multiple competitor positioning)
- [Best AI Dungeon Masters in 2026: Every Platform Compared — StoryRoll](https://storyroll.app/blog/best-ai-dungeon-masters-2026) (HIGH — competitor comparison)
- [Best AI Dungeon Master Tools 2026: We Reviewed Top 5 — RoleForge Blog](https://roleforge.ai/blog/best-ai-game-master-tools-compared/) (MEDIUM — vendor blog but useful for feature claims)
- [AI Dungeon Review 2026 — WeavAI Blog](https://weavai.app/blog/en/2026/04/23/ai-dungeon-review-2026-features-price-alternatives/) (HIGH — quit-reason research)
- [Read 23 AI Dungeon Reviews | justuseapp.com](https://justuseapp.com/en/app/1491268416/ai-dungeon/reviews) (MEDIUM — user complaints corpus)
- [AI Dungeon Issues: Common Problems — Games With AI](https://gameswithai.com/ai-dungeon-issues/) (MEDIUM — failure-mode catalog)
- [SillyTavern documentation](https://docs.sillytavern.app/) (HIGH — local-LLM frontend feature parity reference)
- [SillyTavern Review 2026 — WeavAI Blog](https://weavai.app/blog/en/2026/04/18/sillytavern-review-2026-ultimate-ai-roleplay-guide/) (MEDIUM)
- [SillyTavern + Local LLM Setup Guide (2026) — theservitor.com](https://theservitor.com/sillytavern-local-llm-setup-guide/) (MEDIUM)
- [Prompt Architecture for a Reliable AI Dungeon Master — dev.to](https://dev.to/austin_amento_860aebb9f55/prompt-architecture-for-a-reliable-ai-dungeon-master-d99) (HIGH — anti-pattern catalog)
- [AI RPG: Best AI-Powered RPG Experiences — Jenova.ai](https://www.jenova.ai/en/resources/ai-rpg) (MEDIUM — feature landscape)
- [AI in Solo RPGs: A Practical Guide — Town Scryer Blog](https://www.townscryer.com/blog/practical-guide-ai-tools-solo-rpg) (MEDIUM — player-perspective)
- [How to Play Solo TTRPGs with AI as Your Game Master — Feathered Fiction](https://featheredfiction.com/2026/01/05/solo-rpg-ai-gm-guide/) (MEDIUM)
- [Run Epic Roleplaying Sessions with Local LLMs — Arsturn](https://www.arsturn.com/blog/how-to-run-epic-roleplaying-sessions-with-local-llms) (MEDIUM — summarization techniques)
- [AI Dungeon Alternatives 2026 — Feelin Blog](https://feelin.ai/blog/home/deep-dive-audits-and-comparisons/ai-dungeon-alternatives) (MEDIUM — alternative tools survey)
- [10 Best AI Tools for D&D Dungeon Masters — CharGen](https://char-gen.com/blogs/top-8-ai-tools-every-dungeon-master-needs) (MEDIUM)
- [Roll20 vs Foundry VTT 2026 — Saga20](https://saga20.com/blog/roll20-vs-foundry-vtt-2026/) (MEDIUM — VTT feature baseline)
- [Foundry VTT: alternative to Roll20 — Scroll for Initiative](https://scrollforinitiative.com/2022/04/02/foundry-vtt-an-exciting-alternative-to-roll20-review/) (MEDIUM)
- [Top 10 Online Character Builders for 5e — Black Citadel](https://blackcitadelrpg.com/online-character-builders-5e/) (MEDIUM — character-builder feature parity)
- [Solo-TTRPG-AI-Toolkit — GitHub](https://github.com/ChrisPaladino/Solo-TTRPG-AI-Toolkit) (MEDIUM — community solo-RPG practice)
- [DnD Solo Guide — dndsolo.com](https://dndsolo.com/posts/solo-dnd-guide/) (MEDIUM)
- [A Guide to Tools for Solo RPGs — randroll.com](https://www.randroll.com/guide-solo/) (MEDIUM)
- [Context Window Management Strategies — Maxim AI](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) (HIGH — summarization architecture)
