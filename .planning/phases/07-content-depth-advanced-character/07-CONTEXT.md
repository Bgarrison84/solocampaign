# Phase 7: Content Depth & Advanced Character - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A user has the full toolkit for character expression and world setup — all SRD ability score methods (point buy with negative-trait bonuses, 4d6 drop-lowest with per-stat reroll, standard array, manual entry), multiclassing via the Level-Up modal with a JSON-column multiclass schema, feats at creation and ASI levels, subclass selection at the class's subclass level, companions tracked via an `isCompanion` flag on the characters table, Epic Boons on level-up past 20, encumbrance as an optional campaign setting, three world-setup modes (AI-generates-a-brief / player-writes-text-brief / document-import) integrated into campaign creation, a standalone SRD reference screen (rules, spells, items, monsters) accessible from the campaign list or header, and homebrew + PDF/text rules import extending the existing Phase 3 reference docs mechanism.

**In scope:** Ability score methods (CHAR-02/03), multiclassing schema + Level-Up flow (CHAR-04), feats (CHAR-05), party mode 1–4 characters (PARTY-01), companions via `isCompanion` (PARTY-02), Epic Boons picker on level-up past 20 (PROG-03), encumbrance toggle (STATE-06), world setup modes at campaign creation (WORLD-01), standalone SRD reference screen covering rules/spells/items/monsters (RULES-01/02), homebrew editor + file import → reference docs (RULES-03), PDF/text rules import → reference docs (RULES-04), subclass selection in Level-Up modal.

**Out of scope:** Multiplayer, campaign export/import (Phase 8), character sheet PDF export (Phase 8), campaign cover image (done in Phase 2), any quest/NPC/world-state changes (done in Phase 6), accessibility pass (Phase 8), distribution/update notifications (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Ability Score Methods (CHAR-02 / CHAR-03)

- **D-01:** **Four methods in the ability score wizard step:** Standard Array (existing), 4d6 Drop Lowest (existing roll-all button), Manual Override (existing per-stat override), and Point Buy (new). The step gets a method selector tabs/toggle at the top; switching method resets scores.

- **D-02:** **Point buy uses 27-point RAW budget.** Scores purchasable from 8–15 per RAW D&D 5e rules. Negative traits award additional points on top of the base 27. The standard cost table (8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9) applies.

- **D-03:** **Negative traits section appears below point-buy scores in point-buy mode.** Two subsections: (a) Preset Mechanical Flaws — a list of 10–12 curated flaws the player can pick (each shows name, penalty, and points awarded); (b) Free-Form Narrative Flaws — up to 2 free-text fields, each awarding +2 points. The player can mix and match presets and free-form flaws.

- **D-04:** **10–12 preset mechanical flaws ship in Phase 7.** Each preset: name, mechanical penalty description, and point value (+1 to +3 depending on severity). Researcher/planner designs the exact list; examples: Frail (−2 max HP per level, +2 pts), Clumsy (−2 AC, +2 pts), Dim (−2 passive Perception/Investigation, +1 pt), Unlucky (disadvantage on one type of saving throw, +3 pts), Weak (−2 to Strength checks and saves, +2 pts).

- **D-05:** **Free-form flaws:** up to 2 free-text fields; each grants +2 bonus points. The flaw text is saved to the character (new column `negativeTraits` JSON on the characters table) and injected into the AI system prompt so the DM can reference and apply them narratively.

- **D-06:** **4d6 reroll: per-stat reroll button, keeps better result.** After initial roll-all, each stat row gets a 🎲 reroll button (usable once per stat). Clicking re-rolls 4d6 drop lowest for that stat and auto-keeps the higher of the original vs. new result. Reroll button disappears once used.

### Multiclassing (CHAR-04)

- **D-07:** **Multiclassing via Level-Up modal.** When the player levels up, the modal offers two options: "Level up in [current main class]" OR "Add/level multiclass: [pick new or existing secondary class]". The player can choose to gain a level in a different class. No ability score prerequisites (locked per PROJECT.md key decisions).

- **D-08:** **Multiclass data stored in a `classes` JSON column.** New `classes` column on the characters table: `[{className: 'Fighter', level: 5}, {className: 'Wizard', level: 3}]`. The existing `class` text column is kept for backward compatibility as the primary class label (first entry in `classes` array, or the original single class for pre-Phase-7 characters). Migration: add `classes` nullable column; existing characters get `classes = null` (fall back to single `class` column). New multiclass picks populate `classes`.

- **D-09:** **Multiclass spell slot calculation.** When a character has multiple spellcasting classes, the app applies the PHB multiclass spell slot table (combine levels of spellcasting classes using the conversion table). This is a pure calculation in `calculations.ts`. Non-spellcasting classes (Barbarian, Fighter, etc.) do not count toward spell slot table unless the subclass grants spellcasting.

- **D-10:** **Character sheet class display.** The SheetHeader shows the full multiclass breakdown: "Fighter 5 / Wizard 3 — Total Level 8". Proficiency bonus is always based on total character level.

### Feats (CHAR-05)

- **D-11:** **Feats in two places:** (a) Character creation wizard — a new optional "Starting Feat" step (or section in the review step) for characters whose background grants a feat or who the player wants to start with one (variant human, etc.); (b) Level Up modal at ASI levels (4, 8, 12, 16, 19 for most classes) — shows "ASI or Feat" choice: either +2 to one ability / +1 to two abilities, or pick a feat.

- **D-12:** **SRD feats in a `feats.json` content file.** New `resources/feats.json` with all SRD feats: id, name, description, prerequisites (text only — prerequisites are informational, not enforced). The feat picker shows the full list with a search field.

- **D-13:** **Custom feats: name + description only.** Custom feats are created in the homebrew editor (see RULES-03 decisions) or inline in the feat picker ("Create custom feat" option). A custom feat has: name (string) + description (string). No structured mechanical fields — the AI interprets the description. Custom feats are stored in a `custom_feats` table: id, campaign_id, name, description.

- **D-14:** **Feats on characters stored in a `character_feats` table:** id, character_id, feat_name, feat_source ('srd' | 'custom'), custom_feat_id (nullable FK). Feats are surfaced in the AI character summary as a list of feat names + descriptions.

### Subclass Selection

- **D-15:** **Subclass selection in the Level-Up modal, triggered at the class's subclass level.** When the character reaches the level at which their class grants a subclass (e.g., Fighter level 3, Cleric level 1, Rogue level 3), the Level Up modal displays a "Choose Subclass" section with a dropdown populated from the class entry in `classes.json` (the `subclasses` array). Player selects one; saved to `characters.subclass`. If `classes.json` has no subclasses for a class, skip the section.

- **D-16:** **Subclass content added to `classes.json`.** Each class entry gets a `subclasses` array: `[{id: 'battle-master', name: 'Battle Master', description: '...', features: [...]}]`. Researcher populates with SRD subclasses for all 12 SRD classes.

### Party Mode (PARTY-01)

- **D-17:** **Party size set at campaign creation.** A "Party Size" field is added to the campaign creation wizard/modal (after campaign name, before AI config). Options: Solo (1 character, default), Small Party (2), Party (3), Full Party (4). This sets `partySize` on the campaigns table (new integer column, default 1).

- **D-18:** **The `uniqueCampaign` constraint on characters.campaignId is removed.** Migration drops the unique index and replaces it with an application-level enforcement: `charactersRepo` validates character count ≤ `campaign.partySize` before insert. Existing single-character campaigns are unaffected.

- **D-19:** **Character Sheet tab gets a character switcher for multi-character campaigns.** A pill/chip row at the top of the Character Sheet tab content area shows character name chips (one per party member). Clicking a chip switches the displayed sheet. In solo mode (partySize = 1), the switcher is hidden. The active character is tracked in `campaignViewStore` (Zustand, new `activeCharacterId` field).

- **D-20:** **Character creation wizard can be re-triggered to add party members.** A "+ Add Character" button appears in the campaign view (e.g., campaign header or Character Sheet tab) when `characters.length < campaign.partySize`. Clicking opens the same `CreateCharacterWizard`. Once all party slots are filled the button disappears.

### Companions (PARTY-02)

- **D-21:** **Companions use `isCompanion = true` flag on the characters table.** New boolean column `isCompanion` (default false). Companions skip the full character creation wizard — they are added via a simplified "Add Companion" form: name, type (Familiar / Animal Companion / Summoned Creature), HP max, AC. All other character fields (class, background, ability scores, etc.) are null for companions.

- **D-22:** **Companions appear in a separate "Companions" section within the Character Sheet tab** — below the character switcher chips, in a collapsible section. Each companion shows: name, type badge, current/max HP stepper, AC, conditions. Not a full character sheet — just the combat-relevant fields.

- **D-23:** **The AI can add/remove companions via new tool calls.** Two new Phase 7 tool additions to the mutation pipeline: `addCompanion({name, type, hpMax, ac})` and `removeCompanion({companionId})`. Companions also appear in the combat tracker (PARTY-02 requires their HP/conditions tracked during combat — the existing `addCombatant` tool already covers this during encounters).

### Epic Boons (PROG-03)

- **D-24:** **Level cap removed — characters can level past 20.** The XP threshold logic and level-up checks are uncapped. At level 21+, the level number increments normally; proficiency bonus follows the standard table (or extends it per DMG rules — researcher determines).

- **D-25:** **Epic Boon picker in Level-Up modal at levels 21+.** When the character's new level > 20, the Level Up modal replaces the subclass/ASI section with an "Epic Boon" picker: a scrollable list from a new `resources/epic-boons.json` file (SRD Epic Boons). Player picks one boon per applicable level-up. Boons are stored alongside feats in `character_feats` with `feat_source = 'epic_boon'`.

### Encumbrance (STATE-06)

- **D-26:** **Encumbrance toggle in campaign creation wizard.** A checkbox "Enable encumbrance tracking" in the campaign creation wizard (same step as party size or a settings section). Stored as `encumbranceEnabled` boolean column on campaigns (default false). Also accessible via the campaign gear/settings modal post-creation.

- **D-27:** **When encumbrance is enabled:** The inventory tab shows each item's weight (the `weight` field already exists on `character_items`). A running total "X / Y lbs carried" appears at the top of the Inventory tab. Thresholds: encumbered = 5× STR score lbs, heavily encumbered = 10× STR score. Status badges appear at the thresholds. The AI knows encumbrance is enabled via the character summary (new `encumbranceEnabled` field injected).

### World Setup Modes (WORLD-01)

- **D-28:** **World setup is a step in the campaign creation wizard.** After campaign name + party size, before AI config: a "World Setup" step. Three options presented as radio cards: (a) AI Generates — AI creates a world brief at campaign creation; (b) Write a Brief — player writes a text brief (textarea); (c) Import a Document — player imports a PDF or text file. Selection stored as `worldSetupMode` (text: 'ai' | 'brief' | 'import') on campaigns.

- **D-29:** **"AI Generates" mode:** On campaign creation confirmation, the app makes a non-streaming AI call (`generateText`) to produce a 500–800 word world brief: setting name, tone, factions, main conflict, key locations, and hook for Session 1. This brief is saved to a new `worldBrief` TEXT column on campaigns. Displayed to the player after generation (they can edit before saving). Injected into the AI context at each session start in a "World Overview" section before the rolling summary (L3).

- **D-30:** **"Write a Brief" mode:** A free-form textarea in the campaign creation wizard where the player describes their world. The text is saved to `worldBrief`. Same injection position as AI-generated briefs.

- **D-31:** **"Import a Document" mode (PDF or text):** The player picks a file via OS file picker. The extracted/raw text is saved to `worldDocument` TEXT column on campaigns (dedicated field — higher context priority than the Phase 3 reference_docs list). The text brief (`worldBrief`) is left null in this mode. The `worldDocument` is injected into the AI context in the same "World Overview" position as `worldBrief`. If the document is very long, the ContextBuilder truncates to a configured max (researcher determines token budget).

- **D-32:** **PDF import for world documents:** Make PDF extraction the first plan in Phase 7. Research evaluates `pdf-parse`, `pdfjs-dist`, `unpdf`, and `pdf2json` for Electron ASAR compatibility. If PDF extraction is viable, it ships. If no library is viable in Electron without ASAR unpacking, fall back to text/markdown file import only for WORLD-01 (PDFs deferred to Phase 8). The same spike also validates RULES-04 PDF import.

### SRD Reference Browser (RULES-01 / RULES-02)

- **D-33:** **SRD reference is a standalone screen,** accessible from: (a) a "Rules" button/link in the campaign list screen, and (b) a "📖" icon button in the campaign header bar during play. Opening it navigates to a full-screen reference view; a "← Back" button returns to the campaign. React Router page (`/library` route).

- **D-34:** **Four sections in the SRD reference screen:** Spells (from existing `resources/spells.json`), Magic Items (new `resources/magic-items.json`), Rules (new `resources/rules.json` — prose sections from SRD), and Monsters (new `resources/monsters.json`). Each section has a search bar + list + detail panel.

- **D-35:** **SRD magic items (RULES-02):** Searchable database. Each item: name, rarity, attunement requirement, description. The AI can reference magic items by name in narration; when the AI awards a magic item via inventory mutation, it uses the item name from this database.

### Homebrew & Rules Import (RULES-03 / RULES-04)

- **D-36:** **Homebrew content editor** in the campaign gear modal (new "Homebrew" tab within the settings modal). Player can write/paste free-form homebrew text (custom races, classes, spells, rules) into a textarea. Also has a "Import file" button for `.txt` / `.md` files. Content saved to a `homebrew_content` TEXT column on campaigns.

- **D-37:** **Homebrew + imported rules reach the AI via the Phase 3 reference docs mechanism.** The existing `reference_docs` list on campaigns (already wired into `ContextBuilder`) is extended to include homebrew text and imported document text as additional entries. No new ContextBuilder injection path required — same reference-doc slot, lower priority than the world brief. The researcher confirms the exact format for multi-source reference docs.

- **D-38:** **RULES-04 document import (PDF/text):** Same PDF spike as D-32. Imported rules documents are processed (text extracted if PDF, or raw text if .txt/.md) and stored as entries in a new `campaign_reference_docs` table: id, campaign_id, filename, content (TEXT), created_at. This replaces/extends the existing `reference_docs` JSON column so documents can be stored individually. The existing `ReferenceDocSelect.tsx` component is updated to show both bundled references and user-imported documents.

### Claude's Discretion

- Exact point cost table for point buy (researcher confirms RAW table from SRD)
- Exact list of 10–12 preset negative flaws (names, penalties, point values)
- Character Sheet "Companions" section exact layout within the tab
- `classes.json` subclasses array for all 12 SRD classes
- Epic Boons JSON content (SRD boons + planner-authored descriptions)
- Proficiency bonus table extension past level 20
- SRD content JSON structure for rules.json and monsters.json
- Exact ContextBuilder injection order for worldBrief/worldDocument vs. L3 rolling summary
- Migration number for Phase 7 (next after migration 0006 from Phase 6)
- `ReferenceDocSelect.tsx` refactor approach for multi-source reference docs
- Token budget for world document injection (researcher determines from context window analysis)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` § "Phase 7: Content Depth & Advanced Character" — Goal, 6 success criteria, requirements list, notes (PDF spike recommendation)
- `.planning/REQUIREMENTS.md` — CHAR-02, CHAR-03, CHAR-04, CHAR-05, PARTY-01, PARTY-02, PROG-03, WORLD-01, RULES-01, RULES-02, RULES-03, RULES-04, STATE-06

### Prior Phase Context (critical integration)
- `.planning/phases/06-quests-npcs-world-state/06-CONTEXT.md` — D-14 (8 Phase 6 tool schemas), D-18 (ContextBuilder world-state injection), D-08 (`awardInspiration` tool with `characterId` — Phase 7 party mode must update this to support multiple character IDs)
- `.planning/phases/05-rules-engine-dice-combat/05-CONTEXT.md` — D-01 (Phase 5 tool-call schema — Phase 7 adds `addCompanion`/`removeCompanion` tools alongside these), D-30 (Level Up modal implementation in Phase 5 — Phase 7 extends it for multiclass/feat/subclass/Epic Boon), D-38 (hit dice system), D-09 (Combat tracker supports `is_player` flag — companions also need `isCompanion` variant)
- `.planning/phases/04-long-campaign-memory-session-flow/04-CONTEXT.md` — D-17 (system prompt injection order — Phase 7 adds "World Overview" section before L3 rolling summary)
- `.planning/phases/03-ai-engine-provider-abstraction/03-CONTEXT.md` — Reference docs mechanism (`reference_docs` JSON column on campaigns, `ReferenceDocSelect.tsx`, `referenceDocLoader` in main process) — Phase 7 extends this for homebrew/imported docs
- `.planning/phases/02-character-domain-live-sheet/02-CONTEXT.md` — Character creation wizard structure, `CharacterSheetTab.tsx` section layout

### Existing Code — Critical Integration Points
- `src/main/db/schema.ts` — Current schema; Phase 7 migrations add: `partySize` (int) + `worldSetupMode` (text) + `worldBrief` (text) + `worldDocument` (text) + `encumbranceEnabled` (bool) + `homebrew_content` (text) on campaigns; `classes` (JSON) + `isCompanion` (bool) + `negativeTraits` (JSON) on characters; new tables: `character_feats`, `custom_feats`, `campaign_reference_docs`; drop `uniqueCampaign` index on characters
- `src/renderer/src/components/wizard/StepAbilityScores.tsx` — Extended with method selector + point buy tab + negative traits panel + per-stat reroll button
- `src/renderer/src/components/LevelUpModal.tsx` — Extended with multiclass option, ASI/feat choice, subclass picker, Epic Boon picker (for levels > 20)
- `src/renderer/src/screens/CampaignViewScreen.tsx` — `activeCharacterId` added to `campaignViewStore`; Character Sheet tab gets character switcher chips + Companions section
- `src/renderer/src/components/CreateCharacterWizard.tsx` — Re-triggered for additional party members; optional starting feat step
- `src/main/ai/contextBuilder.ts` — New "World Overview" injection section; character summary updated with feats, companions, encumbrance status, multiclass breakdown, negative traits
- `src/main/ai/mutationPipeline.ts` — Two new Phase 7 tools: `addCompanion` + `removeCompanion`
- `src/renderer/src/components/AiSettingsModal.tsx` — New "Homebrew" tab for homebrew editor + file import
- `src/renderer/src/components/ReferenceDocSelect.tsx` — Updated to show campaign_reference_docs rows alongside bundled docs

### Technology Stack
- `CLAUDE.md` § "AI Provider Abstraction" — Vercel AI SDK `generateText` (non-streaming) for world-brief generation
- `CLAUDE.md` § "Local Storage" — Drizzle migration pattern for schema additions
- `CLAUDE.md` § "Supporting Libraries" → PDF import: evaluate `pdf-parse`, `pdfjs-dist`, `unpdf`, `pdf2json` for Electron ASAR compatibility in Phase 7 spike plan

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/src/components/wizard/StepAbilityScores.tsx` — Extend in-place with method selector; existing `roll4d6DropLowest()` function already implemented, reused for per-stat reroll
- `src/renderer/src/components/LevelUpModal.tsx` — Phase 5 modal to extend for multiclass choice, ASI/feat picker, subclass dropdown, and Epic Boon picker
- `src/renderer/src/components/sheet/ConditionBadge.tsx` — Reuse pill pattern for feat display, companion type badges, encumbrance status badges
- `src/renderer/src/components/ui/dialog.tsx` — Companion add form modal, feat picker modal
- `src/renderer/src/components/ui/popover.tsx` — Existing pattern for small pickers (reuse for feat quick-add inline)
- `src/renderer/src/components/ui/scroll-area.tsx` — SRD reference browser list panel
- `src/renderer/src/components/ui/tabs.tsx` — SRD reference screen section tabs (Spells / Items / Rules / Monsters)
- `src/main/ai/llmProvider.ts` — `generateText` call (non-streaming) for world-brief AI generation — Phase 3 already has `generateText` for session recaps (D-12 in 04-CONTEXT.md); same path
- `resources/spells.json` — Already exists; SRD reference screen Spells section reads it directly

### Established Patterns
- **Drizzle migration:** Phase 7 = migration 0007 (Phase 6 used 0006). Multiple ALTER TABLE ADD COLUMN statements + new tables + index drop.
- **tRPC router:** New `library.ts` router (SRD reference queries) + `homebrew.ts` router. Register in `src/main/trpc/router.ts`.
- **Content JSON files:** New files in `resources/`: `feats.json`, `magic-items.json`, `rules.json`, `monsters.json`, `epic-boons.json`, `subclasses.json` (or subclass data embedded in `classes.json`). Follow `spells.json` / `races.json` structure.
- **Tool-call extension:** Phase 7 adds `addCompanion` + `removeCompanion` to `PHASE7_TOOLS` alongside existing ALL_TOOLS — same pipeline extension pattern as Phase 6.

### Integration Points
- **Campaign creation wizard/modal (`CreateCampaignModal.tsx`)** → new steps: Party Size, World Setup mode (with AI-generate path triggering a `generateText` call on submit), Encumbrance toggle
- **Character Sheet tab** → character switcher chips (for party mode) + Companions collapsible section below the existing sections
- **Level Up modal** → multiclass branch at level-up + ASI/Feat choice at levels 4/8/12/16/19 + subclass picker at subclass level + Epic Boon picker at levels 21+
- **ContextBuilder** → "World Overview" block injected before L3 rolling summary; character summary updated with feats list, negative traits, companions, multiclass breakdown
- **SRD reference screen** → new React Router route `/library` with sidebar nav + search + detail panel for all four sections

</code_context>

<specifics>
## Specific Ideas

- **Point buy UI:** A table of 6 rows (one per ability), each with + / − stepper buttons and a running "X / 27 + N points" budget display at the top. Negative traits section below the score table with checkboxes for presets and text inputs for free-form flaws. Budget counter updates live as flaws are toggled/written.
- **4d6 reroll button:** Small 🎲 icon button to the right of each stat after initial roll-all. Shows "✓ used" (muted) after it has been clicked once. Auto-highlights improved stats in green briefly when the reroll is better.
- **Party size in creation wizard:** Radio cards with icon + label: "Solo" (1 figure), "Pair" (2), "Group" (3), "Full Party" (4). Description notes that all characters are created before the first session.
- **World setup mode radio cards in creation wizard:** "🤖 AI Generates" / "📝 Write a Brief" / "📄 Import a Document" — clicking each reveals the relevant input area below the card (textarea for brief, file picker for import, nothing for AI-generate).
- **SRD reference screen layout:** Left sidebar with section pills (Spells / Items / Rules / Monsters) + search input. Main panel = item list. Right panel (or below) = selected item detail. Keyboard-navigable.
- **Homebrew tab in settings modal:** Simple textarea labeled "Homebrew Content" with a character/word count indicator + "Import file…" button underneath. A list of previously imported files with a remove (×) button for each.
- **Epic Boon picker:** Same UI as the feat picker but filters to `epic-boons.json`. Displayed only when `newLevel > 20`. Shows boon name + short description; expandable for full text.

</specifics>

<deferred>
## Deferred Ideas

- **Ritual casting mechanical enforcement** — deferred from Phase 5, still deferred; narrative only in Phase 7
- **Warlock Hexblade's Curse / advanced class-specific short-rest features** — still player-managed in Phase 7
- **Search/filter in spell list (Character Sheet)** — Phase 8 polish
- **Named in-world calendar system** (month/day names) — deferred from Phase 6 discussion, still Phase 8+
- **Player-editable NPC notes** — Phase 8 polish (deferred from Phase 6)
- **Journal export (PDF/markdown)** — Phase 8 (DIST-02 area)
- **AI-generated scene art** — v2 scope, not v1
- **Ambient sound themes** — explicitly excluded per user preference
- **SRD monsters for combat tracker integration** (auto-populate combatant stats from monster DB) — Phase 8 enhancement; Phase 7 ships the monster reference browse only
- **Subrace selection depth** — current wizard has basic subrace handling; full subrace ability score + trait application from `races.json` may need refinement if gaps are found during implementation

</deferred>

---

*Phase: 7-Content Depth & Advanced Character*
*Context gathered: 2026-05-30*
