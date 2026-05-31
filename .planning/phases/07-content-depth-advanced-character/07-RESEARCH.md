# Phase 7: Content Depth & Advanced Character - Research

**Researched:** 2026-05-31
**Domain:** D&D 5e character mechanics, PDF extraction in Electron/ASAR, SQLite schema migration, React wizard extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ability Score Methods (CHAR-02 / CHAR-03)**
- D-01: Four methods via method-selector tabs: Standard Array, 4d6 Drop Lowest (per-stat reroll), Manual Override, Point Buy (new)
- D-02: Point buy uses 27-point RAW budget, scores 8–15, standard cost table
- D-03: Negative traits section below point-buy scores; presets + free-form subsections
- D-04: 10–12 preset mechanical flaws (designed by researcher/planner)
- D-05: Free-form flaws: up to 2 fields, each +2 pts; saved to `negativeTraits` JSON column
- D-06: 4d6 per-stat reroll: one use per stat, keeps better result, button disappears after use

**Multiclassing (CHAR-04)**
- D-07: Multiclassing via Level-Up modal — choose existing class or add/level new class
- D-08: `classes` JSON column on characters; existing `class` column kept for backward compat; null for pre-Phase-7 characters
- D-09: PHB multiclass spell slot calculation in `calculations.ts` (pure function)
- D-10: SheetHeader shows full multiclass breakdown; proficiency bonus always from total level

**Feats (CHAR-05)**
- D-11: Feats in two places: creation wizard (Starting Feat step) and Level Up modal at ASI levels
- D-12: SRD feats in `resources/feats.json`
- D-13: Custom feats: name + description only; stored in `custom_feats` table; AI interprets mechanically
- D-14: `character_feats` table: id, character_id, feat_name, feat_source ('srd'|'custom'|'epic_boon'), custom_feat_id

**Subclass Selection**
- D-15: Subclass selection in Level-Up modal at class's subclass level (replaces Phase 5 "deferred" note)
- D-16: `classes.json` subclasses array for all 12 SRD classes

**Party Mode (PARTY-01)**
- D-17: Party size at campaign creation (Solo 1, Small 2, Party 3, Full Party 4); `partySize` int on campaigns
- D-18: Remove `uniqueCampaign` unique index on characters; app-level enforcement via `charactersRepo`
- D-19: Character switcher chips in Character Sheet tab; tracked in `campaignViewStore.activeCharacterId`
- D-20: "+ Add Character" button re-triggers `CreateCharacterWizard` until `partySize` filled

**Companions (PARTY-02)**
- D-21: `isCompanion = true` flag on characters; simplified Add Companion form (name, type, hpMax, ac)
- D-22: Companions in collapsible section within Character Sheet tab (below switcher chips)
- D-23: `addCompanion` / `removeCompanion` AI tool calls added to mutation pipeline

**Epic Boons (PROG-03)**
- D-24: Level cap removed — uncapped XP/level progression
- D-25: Epic Boon picker in Level-Up modal at levels 21+; from `resources/epic-boons.json`; stored in `character_feats` with `feat_source = 'epic_boon'`

**Encumbrance (STATE-06)**
- D-26: Encumbrance toggle at campaign creation; `encumbranceEnabled` bool on campaigns (default false)
- D-27: When enabled: running weight total in Inventory tab; thresholds at 5× and 10× STR score; AI knows via character summary

**World Setup Modes (WORLD-01)**
- D-28: World setup step in campaign creation wizard: three radio cards (AI / Brief / Import)
- D-29: "AI Generates": `generateText` call on creation; ~500–800 word brief; player can edit; saved to `worldBrief` TEXT on campaigns
- D-30: "Write a Brief": textarea saved to `worldBrief`
- D-31: "Import a Document": text extracted from PDF/txt; saved to `worldDocument` TEXT on campaigns; injected with priority over reference_docs
- D-32: PDF spike first: evaluate libraries for ASAR compatibility; fall back to text/markdown if infeasible

**SRD Reference Browser (RULES-01 / RULES-02)**
- D-33: Standalone `/library` route; accessible from campaign list and campaign header
- D-34: Four sections: Spells (existing spells.json), Magic Items (new), Rules (new), Monsters (new)
- D-35: SRD magic items in searchable database; AI references by name

**Homebrew & Rules Import (RULES-03 / RULES-04)**
- D-36: Homebrew editor in campaign gear modal ("Homebrew" tab); free-form textarea + file import; `homebrew_content` TEXT on campaigns
- D-37: Homebrew reaches AI via Phase 3 reference-docs mechanism (extended entries)
- D-38: Imported rules docs stored in new `campaign_reference_docs` table; replaces/extends `reference_docs` JSON column

### Claude's Discretion
- Exact point cost table for point buy (researcher confirms RAW table from SRD)
- Exact list of 10–12 preset negative flaws
- `classes.json` subclasses array for all 12 SRD classes
- Epic Boons JSON content
- Proficiency bonus table extension past level 20
- SRD content JSON structure for rules.json and monsters.json
- Exact ContextBuilder injection order for worldBrief/worldDocument vs. L3 rolling summary
- Migration number for Phase 7 (next after 0006)
- Token budget for world document injection
- `ReferenceDocSelect.tsx` refactor approach for multi-source reference docs

### Deferred Ideas (OUT OF SCOPE)
- Ritual casting mechanical enforcement
- Warlock Hexblade's Curse / advanced short-rest features
- Search/filter in spell list (Character Sheet)
- Named in-world calendar system
- Player-editable NPC notes
- Journal export (PDF/markdown)
- AI-generated scene art
- Ambient sound themes
- SRD monsters for combat tracker integration (auto-populate stats from monster DB)
- Subrace selection depth refinement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAR-02 | User can generate ability scores via 4d6 drop-lowest (one reroll per stat), point buy with negative-trait bonuses, or manual entry | Point buy math confirmed (§ Standard Stack), reroll pattern in existing `roll4d6DropLowest()` |
| CHAR-03 | User can assign negative traits (preset mechanical flaws or free-form narrative flaws) during point buy to gain additional ability score points | Preset flaws list designed (§ Architecture Patterns), `negativeTraits` JSON column schema confirmed |
| CHAR-04 | User can multiclass freely across any combination of classes without ability score prerequisites | Multiclass spell slot algorithm confirmed from 5e SRD (§ Research Findings — Multiclass) |
| CHAR-05 | User can select feats from the built-in SRD list or create custom feats via the in-app feat editor | `character_feats` + `custom_feats` schema confirmed; SRD feat JSON structure defined |
| PARTY-01 | User can run a campaign as a solo character or control a party of 2–4 characters (set per campaign) | `uniqueCampaign` index drop strategy confirmed; `partySize` column; character switcher pattern |
| PARTY-02 | User can track familiars, animal companions, and summoned creatures as full party members with their own HP, stats, and conditions | `isCompanion` flag on characters; simplified Add Companion form; combat tracker `isPlayer`/`isCompanion` distinction |
| PROG-03 | App supports Epic Boons for characters beyond level 20 using the official 5e DMG system | Full 26-boon list from DMG confirmed; `epic-boons.json` structure defined; proficiency extension decided |
| WORLD-01 | User can set up a campaign world by having the AI generate it, writing a text brief, or importing a document (PDF or text file) | PDF library spike finding: `unpdf` is recommended (§ PDF Library Evaluation); `worldBrief`/`worldDocument` schema confirmed |
| RULES-01 | D&D 5e SRD is bundled and browsable in-app as a reference (rules, spells, items, monsters) | Four content JSON files; `/library` route; search+detail panel pattern documented |
| RULES-02 | SRD magic items are available in a searchable database; AI can also introduce custom magic items | `magic-items.json` structure defined; AI mutation contract via existing `addItem` tool |
| RULES-03 | User can add homebrew content (custom races, classes, spells, rules) via an in-app text editor or by importing a file | `homebrew_content` TEXT column; homebrew tab in gear modal; Phase 3 reference-docs injection path |
| RULES-04 | User can import their own documents (PDF or text) as supplementary rules reference available to the AI | `campaign_reference_docs` table; `unpdf` extraction; migration 0007 |
| STATE-06 | User can enable or disable encumbrance/carrying capacity tracking per campaign | `encumbranceEnabled` bool on campaigns; existing `weight` field on `character_items`; thresholds at 5× and 10× STR |
</phase_requirements>

---

## Summary

Phase 7 is the broadest content phase in the project — 13 requirements, 8 distinct subsystems, and the first phase to touch every layer of the stack simultaneously (schema, main-process AI engine, tRPC routers, renderer components, content JSON files). The critical discovery is that the PDF import question (D-32) has a clear answer: **`unpdf` is viable in Electron's main process without ASAR issues**, because it ships a serverless build that inlines the PDF.js worker, eliminating the disk-based worker file problem that breaks other PDF libraries. This removes the highest-risk blocker from the phase.

The remaining complexity is organizational: Phase 7 has 9 largely independent subsystems that can be parallelized after a single Wave 0 schema migration. The migration itself is the single most critical blocking item — every other plan depends on migration 0007 landing first. The LevelUpModal extension (multiclass + ASI/feat + subclass + Epic Boon) is the most complex component change, touching an existing production-quality component that must remain backward compatible for existing single-class characters.

**Primary recommendation:** Run Wave 0 (schema + content JSON authoring + PDF spike confirmation) as the first plan. Parallelize the remaining waves aggressively — ContextBuilder, new tRPC routers, and React UI components are largely independent once the schema lands.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Point buy calculation (27-pt budget, cost table) | Main process (`calculations.ts`) | — | Pure function, tested independently; no UI state needed for correctness |
| Negative traits persistence | Main process (DB/schema) | Renderer (wizard step) | `negativeTraits` JSON column on characters; wizard collects, main saves |
| Multiclass spell slot calculation | Main process (`calculations.ts`) | — | PHB algorithm is deterministic; pure function alongside `buildSpellSlots` |
| Multiclass data storage | Main process (DB/schema) | Renderer (LevelUpModal) | `classes` JSON column on characters |
| Feat selection and storage | Main process (DB/tRPC) | Renderer (wizard + level-up modal) | `character_feats` + `custom_feats` tables; separate from character resource tracking |
| Party member tracking | Main process (DB) + Renderer (campaignViewStore) | — | `partySize` on campaigns; `activeCharacterId` in Zustand |
| Companion data | Main process (DB/schema) | Renderer (Character Sheet tab) | `isCompanion` flag reuses existing `characters` table rows |
| Epic Boons | Main process (DB/tRPC via `character_feats`) | Renderer (LevelUpModal) | Same storage as feats; `feat_source = 'epic_boon'` discriminator |
| World brief AI generation | Main process (`generateText`) | Renderer (CreateCampaignModal) | Non-streaming call in main process on campaign creation submit |
| World brief/document injection | Main process (`contextBuilder.ts`) | — | Injected in system prompt before L3; same layer as reference docs |
| PDF text extraction | Main process (file handler + `unpdf`) | — | File I/O must stay in main process; renderer sends file path via IPC |
| SRD reference browser | Renderer (`/library` route) | Main process (content loader) | Read-only JSON browsing; no mutations; content files already loaded by main |
| Homebrew content | Main process (DB/tRPC + referenceDocLoader extension) | Renderer (gear modal) | `homebrew_content` TEXT column; injected via existing reference-docs path |
| Campaign reference docs (`campaign_reference_docs`) | Main process (DB/tRPC) | Renderer (ReferenceDocSelect) | New table replaces/extends `referenceDocs` JSON column |
| Encumbrance status | Renderer (Inventory tab) | Main process (character summary injection) | Display-only in renderer; AI informed via contextBuilder character summary |

---

## Standard Stack

### Core (all verified against existing project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `unpdf` | 1.6.2 | PDF text extraction (main process) | Serverless-first build; inlined worker; no disk file requirement; CJS + ESM exports; `peerDependency: @napi-rs/canvas` is optional for image extraction only |
| `drizzle-orm` + `drizzle-kit` | 0.36+ (existing) | Migration 0007 schema additions | Established pattern; all prior phases used it |
| `vitest` | 2.x (existing) | New calculation tests (point buy, multiclass spell slots) | Existing test infrastructure (`vitest.config.ts` in place) |
| `react-router-dom` | 7.x (existing) | New `/library` route | Existing routing already wired |
| `zustand` | 5.x (existing) | `campaignViewStore` extension (`activeCharacterId`) | Existing store |
| Vercel AI SDK `generateText` | 4.x (existing) | World-brief generation (non-streaming) | Phase 3 `llmProvider.ts` already exposes `generateText`; same path as session recap |
| `electron-store` | 10.x (existing) | App-level prefs (no change) | Not used for new Phase 7 data |

**PDF library version verification:**
```
unpdf@1.6.2       — verified on npm registry
pdfjs-dist@6.0.227 — verified on npm registry (unpdf uses as peerDep for heavy image rendering only)
pdf-parse@2.4.5    — verified on npm registry (NOT recommended — see §PDF Library Evaluation)
```

### Content JSON Files (new in Phase 7)

| File | Est. Size | Structure |
|------|-----------|-----------|
| `resources/feats.json` | ~80–120 KB | `[{id, name, description, prerequisites}]` — SRD feats only |
| `resources/magic-items.json` | ~150–200 KB | `[{id, name, rarity, attunement, description}]` — SRD items |
| `resources/rules.json` | ~200–400 KB | `[{id, title, category, content}]` — SRD prose sections |
| `resources/monsters.json` | ~600–800 KB | `[{id, name, type, cr, ac, hp, speed, abilities, actions}]` — SRD monsters |
| `resources/epic-boons.json` | ~10 KB | `[{id, name, description}]` — 26 DMG boons |
| `resources/subclasses.json` (or extend `classes.json`) | ~50–80 KB | Embedded in classes.json as `subclasses: [{id, name, description, features: [...]}]` |

**Recommendation:** Embed subclass data inside each class entry in `classes.json` (extend the existing array's objects with a `subclasses` field and `subclassLevel` number). This keeps the subclass lookup local to the class object, which is the natural access pattern in `LevelUpModal.tsx`.

---

## Package Legitimacy Audit

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `unpdf` | npm | [OK] | Approved |
| `pdfjs-dist` | npm | [OK] | Approved (transitive peerDep of unpdf; already familiar library) |
| `pdf-parse` | npm | [OK] | NOT used — see §PDF Library Evaluation for rationale |

**Packages removed:** none
**Packages flagged as suspicious:** none

All three packages verified [OK] via slopcheck. `pdf-parse` is rejected on technical grounds (ASAR filesystem test-file bug), not safety grounds.

---

## Research Findings

### PDF Library Evaluation (D-32) — SPIKE RESULT

**Recommendation: Use `unpdf` for both WORLD-01 and RULES-04 PDF import. PDF import is viable in Electron — no fallback to text-only is needed.**

**Analysis of each candidate:**

| Library | ASAR Safe? | Worker Needed? | Node.js Entry | Verdict |
|---------|-----------|---------------|--------------|---------|
| `pdf-parse` | **No** | No | CJS sync | REJECTED — has a hardcoded `require()` of a test PDF file that resolves against the real filesystem at module load time; this path fails when the module is inside an ASAR archive. This is a documented, unfixed bug. [VERIFIED: github.com/mozilla/pdf.js related discussion + pkgpulse.com/blog comparison] |
| `pdfjs-dist` v4+ | **Conditional** | Yes (worker .js file on disk) | ESM only (.mjs) | RISKY — v4+ is ESM-only; requires a `pdf.worker.js` file resolvable on disk; in ASAR the worker `workerSrc` path must point outside the ASAR or use `asarUnpack`; adds configuration complexity. Can work but requires `asarUnpack` rules. [VERIFIED: github.com/mozilla/pdf.js/issues/16111] |
| `pdf2json` | Yes | No | CJS | Acceptable fallback — pure Node.js port of PDF.js for text; no worker; no filesystem startup bug. Lower fidelity on complex layouts. Reserve for fallback if `unpdf` has issues. |
| `unpdf` | **Yes** | **No** | CJS + ESM | **RECOMMENDED** — serverless-first build inlines the PDF.js worker into the bundle; no external worker file needed; no filesystem startup reads; ships both `./dist/index.cjs` and `./dist/index.mjs`. The `@napi-rs/canvas` peer dependency is optional and only needed for image extraction (not text extraction). [VERIFIED: github.com/unjs/unpdf README] |

**Implementation pattern for Electron main process:**

```typescript
// Source: github.com/unjs/unpdf README (verified)
import { getDocumentProxy, extractText } from 'unpdf'

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text
}
```

This runs entirely in the main process. The renderer sends the file path via tRPC; the main process reads the file with `fs.readFile`, passes the buffer to `extractPdfText`, and returns the extracted text string.

**Token budget for world document injection (D-31):**
- ContextBuilder current token budget: L1 overflow = 6000 tokens; L2 cap = 2000; L3 cap = 1000
- World document occupies the "World Overview" injection slot, which is higher priority than reference docs
- Recommended cap: **4000 tokens (~16,000 characters)** for `worldDocument` injection — same order of magnitude as L3, but world document is more permanent context
- Implementation: `worldDoc.substring(0, 16000)` with a trailing `... [truncated]` marker if truncated
- The `worldBrief` (AI-generated or player-written) is shorter (~500–800 words = ~3000–5000 chars); no truncation needed in practice

---

### Multiclass Spell Slot Calculation (CHAR-04, D-09)

**Algorithm (verified from 5th Edition SRD at 5thsrd.org/rules/multiclassing):**

1. Sum a "caster level" from all spellcasting classes:
   - Full casters (Bard, Cleric, Druid, Sorcerer, Wizard): add full class levels
   - Half casters (Paladin, Ranger): add floor(class level / 2)
   - Third casters (Eldritch Knight subclass of Fighter, Arcane Trickster subclass of Rogue): add floor(class level / 3) — NOTE: these are subclass-gated; Phase 7 should recognize them if `subclass` matches
   - Warlock: **excluded** — uses Pact Magic separately; never combined into the multiclass table
   - Non-spellcasters (Barbarian, Fighter base, Monk, Rogue base): 0 contribution

2. Look up the combined caster level in the multiclass spell slots table (same table as single-class spellcasters).

**Complete multiclass spell slot table (verified from 5thsrd.org):**

```
CasterLvl | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th
1         |  2  |  —  |  —  |  —  |  —  |  —  |  —  |  —  |  —
2         |  3  |  —  |  —  |  —  |  —  |  —  |  —  |  —  |  —
3         |  4  |  2  |  —  |  —  |  —  |  —  |  —  |  —  |  —
4         |  4  |  3  |  —  |  —  |  —  |  —  |  —  |  —  |  —
5         |  4  |  3  |  2  |  —  |  —  |  —  |  —  |  —  |  —
6         |  4  |  3  |  3  |  —  |  —  |  —  |  —  |  —  |  —
7         |  4  |  3  |  3  |  1  |  —  |  —  |  —  |  —  |  —
8         |  4  |  3  |  3  |  2  |  —  |  —  |  —  |  —  |  —
9         |  4  |  3  |  3  |  3  |  1  |  —  |  —  |  —  |  —
10        |  4  |  3  |  3  |  3  |  2  |  —  |  —  |  —  |  —
11–12     |  4  |  3  |  3  |  3  |  2  |  1  |  —  |  —  |  —
13–14     |  4  |  3  |  3  |  3  |  2  |  1  |  1  |  —  |  —
15–16     |  4  |  3  |  3  |  3  |  2  |  1  |  1  |  1  |  —
17        |  4  |  3  |  3  |  3  |  2  |  1  |  1  |  1  |  1
18        |  4  |  3  |  3  |  3  |  3  |  1  |  1  |  1  |  1
19–20     |  4  |  3  |  3  |  3  |  3  |  2  |  1  |  1  |  1
```

**Implementation location:** New function `calcMulticlassSpellSlots(classes: ClassEntry[]): SpellSlotMap` in `src/main/characters/calculations.ts`. For single-class characters (or when `classes` is null), the existing `buildSpellSlots()` function is used unchanged.

**Subclass-triggered spellcasting recognition:** The function must check `className === 'Fighter' && subclass includes 'Eldritch Knight'` (third caster) and `className === 'Rogue' && subclass includes 'Arcane Trickster'` (third caster). Since Phase 7 ships subclass selection, this check becomes feasible.

---

### Point Buy Math (CHAR-02 / CHAR-03, D-02)

**Exact RAW table (verified from 5thsrd.org via multiple sources):**

```
Score | Cost
  8   |  0
  9   |  1
 10   |  2
 11   |  3
 12   |  4
 13   |  5
 14   |  7
 15   |  9
```

Budget: **27 points**. Scores below 8 are not purchasable via point buy RAW. Scores above 15 are not purchasable via point buy RAW (racial bonuses apply after).

**Preset Negative Flaws (D-04) — Researcher-designed list (10 flaws, ~1–3 pts each):**

| ID | Name | Mechanical Penalty | Pts Awarded |
|----|------|-------------------|-------------|
| frail | Frail | −2 to max HP per level (minimum 1 HP/level) | +2 |
| clumsy | Clumsy | −2 AC | +2 |
| dim | Dim | −2 passive Perception; −2 passive Investigation | +1 |
| weak | Weak | −2 to all Strength checks and Strength saving throws | +2 |
| unlucky | Unlucky | Disadvantage on one saving throw type chosen at creation (CON/WIS/CHA) | +3 |
| slow | Slow | −10 ft movement speed (minimum 20 ft) | +2 |
| sickly | Sickly | Disadvantage on saving throws vs. disease and poison | +1 |
| timid | Timid | −2 to initiative rolls | +1 |
| fumbling | Fumbling | Once per session (DM's choice), disadvantage on one attack roll | +2 |
| cursed | Cursed | When rolling 1 on a d20, the DM may narrate an extra complication | +2 |

**All flaw text is stored in `characters.negativeTraits` (JSON) and injected into the AI character summary** so the DM can apply these narratively. The mechanical effects are advisory for the AI — they are not programmatically enforced by the app (consistent with the AI-DM narrates consequences pattern).

---

### Epic Boons (PROG-03, D-24/D-25)

**26 official DMG Epic Boons (verified from dnd5e.wikidot.com/epic-boons):**

All 26 boons have been confirmed: Boon of Combat Prowess, Dimensional Travel, Fate, Fortitude, High Magic, Immortality, Invincibility, Irresistible Offense, Luck, Magic Resistance, Peerless Aim, Perfect Health, Planar Travel, Quick Casting, Recovery, Resilience, Skill Proficiency, Speed, Spell Mastery, Spell Recall, the Fire Soul, the Night Spirit, the Stormborn, the Unfettered, Truesight, Undetectability.

**`resources/epic-boons.json` structure:**
```json
[
  {
    "id": "boon-of-combat-prowess",
    "name": "Boon of Combat Prowess",
    "description": "When you miss with a melee weapon attack, you can choose to hit instead. Once you use this boon, you can't use it again until you finish a short rest."
  }
]
```

**Proficiency bonus extension past level 20 (D-24):**
The SRD only defines levels 1–20. The pattern (every 4 levels) suggests: level 21–24 = +7, level 25–28 = +8, level 29+ = +9. [ASSUMED] based on community consensus; not in any official source. Since the app's XP thresholds table stops at level 20 (`XP_THRESHOLDS` in `LevelUpModal.tsx`), the `level + 1` calculation for `nextLevel` simply continues. Proficiency bonus formula: `Math.ceil(nextLevel / 4) + 1` (works for levels 1–20 per PHB, and extends naturally beyond).

Verification: PHB levels 1–4 = +2, 5–8 = +3, 9–12 = +4, 13–16 = +5, 17–20 = +6. Formula `Math.ceil(level/4) + 1` gives exactly these values. At level 21 it gives +7. This is the simplest defensible extension and matches common community practice.

---

### Database Schema Migration 0007

Migration number: **0007** (confirmed — current last migration is `0006_phase6_world_state.sql`).

**DDL summary for migration file `0007_phase7_content_depth.sql`:**

**New columns on `campaigns`:**
```sql
ALTER TABLE campaigns ADD COLUMN party_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN world_setup_mode TEXT;
ALTER TABLE campaigns ADD COLUMN world_brief TEXT;
ALTER TABLE campaigns ADD COLUMN world_document TEXT;
ALTER TABLE campaigns ADD COLUMN encumbrance_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN homebrew_content TEXT;
```

**New columns on `characters`:**
```sql
ALTER TABLE characters ADD COLUMN classes TEXT;
ALTER TABLE characters ADD COLUMN is_companion INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN negative_traits TEXT;
```

**Drop unique index, add party-size check (application-level only — SQLite CHECK constraints can be added but are advisory):**
```sql
DROP INDEX IF EXISTS characters_campaign_id_unique;
```

**New tables:**
```sql
CREATE TABLE character_feats (
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  feat_name TEXT NOT NULL,
  feat_source TEXT NOT NULL DEFAULT 'srd', -- 'srd' | 'custom' | 'epic_boon'
  custom_feat_id TEXT REFERENCES custom_feats(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE custom_feats (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE campaign_reference_docs (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

**Drizzle schema additions (schema.ts):**
All above translated to Drizzle table definitions. The `characters` table's `uniqueCampaign` constraint must be removed from the schema definition — this is a **Drizzle migration challenge**: Drizzle's `generate` for SQLite cannot drop a unique index declared in `(table) => ({...})` via `ALTER TABLE`. The migration SQL must manually run `DROP INDEX IF EXISTS characters_campaign_id_unique` and the schema.ts table definition must have the `unique()` call removed.

**Critical note:** `custom_feats` must be defined BEFORE `character_feats` in the migration because of the FK reference from `character_feats(custom_feat_id)` → `custom_feats(id)`.

---

### ContextBuilder Injection Order for Phase 7 (D-29/D-30/D-31)

Current injection order (from `contextBuilder.ts` source, verified):
1. Preamble + strictness + personality + character summary
2. `toolDescriptionsBlock` (Phase 5/6 tool descriptions)
3. `worldStateSummary` (Phase 6 — quests, NPCs, factions, time, location)
4. `referenceDocBlock` (Phase 3 reference docs)
5. L3: rolling campaign summary
6. L2: recent session recaps
7. Session context (location, goal, notes)

**Phase 7 extension — World Overview injection:**

"World Overview" (`worldBrief` or `worldDocument`) slots **between the character summary (item 1) and the tool descriptions block (item 2)**. Rationale: world context is as foundational as the character — the DM needs to know the world before knowing the tools. This also keeps it separated from and higher-priority than the reference_docs block (item 4).

Updated order:
1. Preamble + strictness + personality + character summary **(extended with: feats list, negative traits, companions, multiclass breakdown, encumbrance status)**
2. **[NEW] World Overview block** (worldBrief or worldDocument, truncated to 16,000 chars)
3. `toolDescriptionsBlock` **(extended with Phase 7 tools: addCompanion, removeCompanion)**
4. `worldStateSummary` (Phase 6, unchanged)
5. `referenceDocBlock` **(extended to include homebrew_content and campaign_reference_docs)**
6. L3: rolling campaign summary
7. L2: recent session recaps
8. Session context

**World Overview injection text:**
```
World Overview:
[worldBrief text]
```
or for document imports:
```
World Reference Document:
[worldDocument text — truncated at 16,000 chars]
```

If both `worldBrief` and `worldDocument` are null (legacy campaigns, or "AI Generates" mode before first session), the block is omitted.

**Character summary extensions for Phase 7:**
- After existing lines, add: `Classes: Fighter 5 / Wizard 3 — Total Level 8` (for multiclass; omit if `classes` is null)
- Add: `Feats: Alert, Great Weapon Master` (from `character_feats` query)
- Add: `Negative Traits: Frail (−2 HP/level), Clumsy (−2 AC)` (from `negativeTraits` JSON)
- Add: `Companions: Familiar "Midnight" (Owl, HP 2/2), Animal Companion "Rex" (Wolf, HP 11/11)` (from isCompanion characters)
- Add: `Encumbrance: Enabled (carrying 35/75 lbs)` (only when `encumbranceEnabled = true`)

---

### Subclass Levels for All 12 SRD Classes (D-15/D-16)

Current `LevelUpModal.tsx` `SUBCLASS_LEVELS` map is accurate but incomplete for Phase 7. The extended map (verified from D&D 5e SRD):

```typescript
const SUBCLASS_LEVELS: Record<string, number[]> = {
  barbarian: [3],      // Path at level 3
  bard: [3],           // College at level 3
  cleric: [1],         // Divine Domain at level 1 — already in choosesSubclassAtLevel1
  druid: [2],          // Circle at level 2
  fighter: [3],        // Archetype at level 3
  monk: [3],           // Tradition at level 3
  paladin: [3],        // Sacred Oath at level 3
  ranger: [3],         // Conclave at level 3
  rogue: [3],          // Archetype at level 3
  sorcerer: [1],       // Origin at level 1 — already in choosesSubclassAtLevel1
  warlock: [1],        // Patron at level 1 — already in choosesSubclassAtLevel1
  wizard: [2],         // Tradition at level 2
}
```

Phase 7 replaces the Phase 5 "deferred note" with an actual subclass dropdown. The `SUBCLASS_LEVELS` object already exists in `LevelUpModal.tsx` — Phase 7 adds the actual picker UI where the deferred note was.

---

### Campaign Creation Wizard Extension (D-17/D-26/D-28)

Current wizard: 3 steps (Campaign → AI Provider → DM Style). STEP_LABELS = `['Campaign', 'AI Provider', 'DM Style']`.

Phase 7 extends to **6 steps**: Campaign → **Party & World** → **World Setup** → AI Provider → DM Style → **Settings**.

Alternatively, a more conservative approach consolidates Phase 7 additions into the existing steps to minimize wizard scope changes:

**Recommended: Extend Step 1 to include Party Size + Encumbrance, add World Setup as new Step 2:**

New step layout:
- Step 0: **Campaign** (name + cover image placeholder + party size radio + encumbrance checkbox)
- Step 1: **World Setup** (AI/Brief/Import radio cards + conditional content)
- Step 2: **AI Provider** (existing `AiProviderFields`)
- Step 3: **DM Style** (existing personality/strictness)

Total: 4 steps. The `STEP_LABELS` array and `WizardProgress` component accept `totalSteps` as a prop — updating from 3 to 4 is a one-line change.

**World Setup step AI-generate path:** When the user selects "AI Generates" and proceeds to submit the campaign, the `handleSubmit` function in `CreateCampaignModal.tsx` must fire a `generateText` call (tRPC router: `campaigns.generateWorldBrief`) after creating the campaign. This call blocks the submit spinner. The generated brief is displayed in a review step before the modal closes. This is consistent with Phase 3's `generateText` usage in the recap flow.

---

### ReferenceDocSelect Refactor (D-38)

The existing component queries `trpc.ai.listReferenceDocs` which returns bundled reference documents (text/md files in `resources/reference-docs/`). Phase 7 adds user-imported documents stored in `campaign_reference_docs`.

**Approach:** Extend the component to accept `campaignId?: string` prop. When provided, it merges bundled docs (from existing `listReferenceDocs`) with campaign-imported docs (from new `trpc.campaignDocs.list(campaignId)` tRPC endpoint). The merged list renders in the same checkbox UI — imported docs get a "user" badge to distinguish them.

The existing `reference_docs` JSON column on `campaigns` becomes the persistence mechanism for the checkbox selection state (which bundled + imported docs are enabled for this campaign). The `campaign_reference_docs` table stores the imported document content. The `reference_docs` JSON column stores the list of enabled doc identifiers (bundled relative paths OR `campaign_reference_docs.id` strings).

---

## Architecture Patterns

### System Architecture Diagram

```
User Action (feat pick / multiclass / world setup)
    |
    v
[Renderer: React component]
    | tRPC mutation
    v
[Main Process: tRPC router]
    | Drizzle ORM
    v
[SQLite: schema.ts tables]
    |
    v (on next AI call)
[contextBuilder.ts]
    ├── formatCharacterSummary (extended: feats, multiclass, companions, negative traits)
    ├── World Overview block (worldBrief or worldDocument)
    ├── toolDescriptionsBlock (extended: addCompanion, removeCompanion)
    └── referenceDocBlock (extended: homebrew + campaign_reference_docs)
    |
    v
[Vercel AI SDK / LLM Provider]
    |
    v (AI tool call response)
[mutationPipeline.ts] -- addCompanion / removeCompanion
    |
    v
[SQLite: characters table (isCompanion = true)]
```

### Recommended Project Structure (new files only)

```
resources/
├── feats.json                    # SRD feats (new)
├── magic-items.json              # SRD magic items (new)
├── rules.json                    # SRD prose rules (new)
├── monsters.json                 # SRD monsters (new)
├── epic-boons.json               # 26 DMG epic boons (new)
└── classes.json                  # EXTENDED: add subclasses[] + subclassLevel field

src/main/
├── characters/
│   └── calculations.ts           # EXTENDED: calcMulticlassSpellSlots(), calcPointBuyCost(), MULTICLASS_SPELL_SLOTS table, POINT_BUY_COST_TABLE
├── ai/
│   ├── contextBuilder.ts         # EXTENDED: World Overview injection, extended character summary
│   ├── mutationPipeline.ts       # EXTENDED: addCompanion, removeCompanion cases
│   └── toolSchemas.ts            # EXTENDED: addCompanionSchema, removeCompanionSchema
├── db/
│   ├── schema.ts                 # EXTENDED: 6 new campaign columns, 3 new character columns, 3 new tables
│   ├── characterFeatsRepo.ts     # NEW: CRUD for character_feats
│   ├── customFeatsRepo.ts        # NEW: CRUD for custom_feats
│   └── campaignReferenceDocsRepo.ts  # NEW: CRUD for campaign_reference_docs
├── trpc/routers/
│   ├── library.ts                # NEW: SRD browser queries (spells/items/rules/monsters)
│   ├── feats.ts                  # NEW: feat picker queries + custom feat CRUD
│   └── router.ts                 # EXTENDED: register library, feats routers
└── services/
    └── pdfExtractor.ts           # NEW: unpdf text extraction wrapper

resources/migrations/
└── 0007_phase7_content_depth.sql # NEW

src/renderer/src/
├── screens/
│   └── LibraryScreen.tsx         # NEW: /library route — SRD reference browser
├── components/
│   ├── CreateCampaignModal.tsx   # EXTENDED: 4 steps, Party Size, Encumbrance, World Setup
│   ├── CreateCharacterWizard.tsx # EXTENDED: Starting Feat optional step; re-triggerable
│   ├── LevelUpModal.tsx          # EXTENDED: multiclass branch, ASI/feat choice, subclass picker, Epic Boon picker
│   ├── AiSettingsModal.tsx       # EXTENDED: Homebrew tab
│   ├── ReferenceDocSelect.tsx    # EXTENDED: campaign_reference_docs rows
│   ├── wizard/
│   │   ├── StepAbilityScores.tsx # EXTENDED: method selector tabs, point buy tab, negative traits panel
│   │   └── StepWorldSetup.tsx    # NEW: world setup mode radio cards + conditional content
│   ├── sheet/
│   │   └── SheetHeader.tsx       # EXTENDED: multiclass display
│   └── CompanionsSection.tsx     # NEW: collapsible companions section in Character Sheet tab
```

### Pattern 1: Point Buy State Machine

```typescript
// Source: derived from D-01/D-02/D-03 decisions + RAW SRD cost table
type AbilityScoreMethod = 'standard-array' | 'roll-4d6' | 'point-buy' | 'manual'

const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
}

function calcPointBuyCost(scores: Record<AbilityName, number>): number {
  return Object.values(scores).reduce(
    (sum, score) => sum + (POINT_BUY_COST[score] ?? 0), 0
  )
}

function calcPointBuyBudget(presetFlaws: PresetFlaw[], freeFormFlaws: string[]): number {
  const presetPts = presetFlaws.reduce((sum, f) => sum + f.points, 0)
  const freeFormPts = Math.min(freeFormFlaws.filter(f => f.trim()).length, 2) * 2
  return 27 + presetPts + freeFormPts
}
```

### Pattern 2: Multiclass Spell Slot Calculation

```typescript
// Source: PHB multiclass spellcasting rules (5thsrd.org/rules/multiclassing)
const MULTICLASS_SPELL_SLOTS: Record<number, Record<number, number>> = {
  1:  {1:2},
  2:  {1:3},
  3:  {1:4, 2:2},
  // ... (full table in calculations.ts)
  20: {1:4, 2:3, 3:3, 4:3, 5:3, 6:2, 7:1, 8:1, 9:1}
}

function calcMulticlassCasterLevel(classes: ClassEntry[]): number {
  return classes.reduce((total, entry) => {
    if (FULL_CASTERS.includes(entry.className.toLowerCase())) {
      return total + entry.level
    }
    if (HALF_CASTERS.includes(entry.className.toLowerCase())) {
      return total + Math.floor(entry.level / 2)
    }
    if (isThirdCaster(entry)) {  // EK / AT subclass check
      return total + Math.floor(entry.level / 3)
    }
    return total  // Non-casters + Warlock excluded
  }, 0)
}
```

### Pattern 3: addCompanion Tool Call (mutationPipeline extension)

```typescript
// Source: D-21/D-23 decisions; extends Phase 5/6 mutationPipeline pattern
export const addCompanionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['Familiar', 'Animal Companion', 'Summoned Creature']),
  hpMax: z.number().int().positive(),
  ac: z.number().int().min(1).max(30),
})

// In mutationPipeline.ts switch/case:
case 'addCompanion': {
  const parsed = addCompanionSchema.safeParse(call.args)
  if (!parsed.success) { log.warn('...'); break }
  const { name, type, hpMax, ac } = parsed.data
  charactersRepo.createCompanion({ campaignId, name, type, hpMax, ac })
  chips.push({ id: nanoid(), label: `${name} joined`, type: 'combat' })
  break
}
```

### Anti-Patterns to Avoid

- **Don't query character_feats in every AI call** — feats are injected once in the character summary as a text list; no real-time feat lookup per message
- **Don't put the full monsters.json in context** — the SRD monsters file (~700 KB) is for the reference browser only; never inject it into the AI context window
- **Don't enforce feat prerequisites in code** — D-12 says prerequisites are informational text only; the AI describes why a feat might not fit narratively
- **Don't use `referenceDocs` JSON column for new campaign_reference_docs** — store doc content in the new table; the JSON column only stores a list of enabled identifiers
- **Don't apply negative trait mechanical penalties programmatically** — they are text for the AI to narrate; the app does not modify AC/HP/speed directly based on flaw picks (consistent with the AI-DM-as-narrator pattern)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF byte parser | `unpdf` | Binary PDF format is a minefield; page ordering, encoding tables, font mapping — `unpdf` handles all of these via the inlined PDF.js engine |
| Point buy UI budget counter | Custom accumulator component | Derived state from `POINT_BUY_COST` table + flaw toggles | The cost lookup is a pure function; React state flows naturally from score inputs |
| Multiclass spell slot lookup | Ad-hoc conditional chains | Embed the full 20-row lookup table as a constant in `calculations.ts` | The table is fixed data from the SRD; a lookup is O(1) and never wrong |
| Feat search | Custom fuzzy match | React state filter on `feats.json` array (filter + `toLowerCase()`) | The feat list is small (~150 items); `fuse.js` would be overkill |
| Subclass level detection | Runtime API call | Lookup table (SUBCLASS_LEVELS in LevelUpModal.tsx already exists) | It's a static constant; no runtime lookup needed |

**Key insight:** The SRD rules content (spell slots, proficiency bonuses, point buy costs, subclass levels) are finite lookup tables. Embed them as TypeScript constants, not dynamic queries.

---

## Common Pitfalls

### Pitfall 1: Removing `uniqueCampaign` Index Breaks Existing Single-Character Campaigns
**What goes wrong:** The migration drops `DROP INDEX IF EXISTS characters_campaign_id_unique`. If the Drizzle schema.ts still has the `unique()` call in the `characters` table definition, `drizzle-kit generate` will re-create the index in a subsequent migration.
**Why it happens:** Drizzle generates migrations from schema diffs — if the schema still declares the unique constraint, it will be re-added.
**How to avoid:** Remove the `unique()` call from the `characters` table definition in `schema.ts` at the same time as adding the migration SQL.
**Warning signs:** `drizzle-kit generate` produces a migration that `CREATE UNIQUE INDEX characters_campaign_id_unique`.

### Pitfall 2: `classes` JSON Column Null vs. Array for Pre-Phase-7 Characters
**What goes wrong:** Code that reads `character.classes` without null-checking throws when accessing pre-Phase-7 single-class characters where `classes = null`.
**Why it happens:** D-08 says existing characters keep `classes = null`; only new multiclass picks populate it.
**How to avoid:** Every consumer of `character.classes` must normalize: `const effectiveClasses = character.classes ?? [{ className: character.class, level: character.level }]`. Add this normalization in `CharacterWithResources` type or a helper.
**Warning signs:** TypeScript errors on `character.classes.map(...)` or runtime `Cannot read property 'map' of null`.

### Pitfall 3: World Brief AI Generation on Campaign Create Blocks UX
**What goes wrong:** The "AI Generates" world brief path fires a `generateText` call during `handleSubmit` in `CreateCampaignModal`. If the user's model is slow, the modal spinner runs for 30+ seconds with no feedback.
**Why it happens:** `generateText` is non-streaming; the modal can't show progress.
**How to avoid:** Show a progress message in the modal while generating: "Generating your world brief (this may take 30 seconds…)". The campaign is created first; world brief generation is a second async step. If the call fails, the campaign is still created with `worldBrief = null` and the user can generate later from the gear modal.
**Warning signs:** User reports the modal "freezing" during campaign creation.

### Pitfall 4: PDF Content Token Budget Overflow
**What goes wrong:** A user imports a 200-page PDF rulebook as a world document. Even with 16,000-character truncation, this is injected at high priority into every single AI call for the campaign, consuming ~4000 tokens permanently.
**Why it happens:** `worldDocument` is injected in every call (unlike reference docs which are optional).
**How to avoid:** The UI must display a warning when `worldDocument.length > 12,000` characters: "This document is large (~X tokens). It will be truncated at the context limit. For better results, use a concise world brief instead." The user still proceeds but is warned.
**Warning signs:** Campaign responses are truncated or AI seems to "forget" recent context.

### Pitfall 5: LevelUpModal Multiclass Path Breaks Single-Class Regression
**What goes wrong:** Adding multiclass branch to `LevelUpModal` introduces bugs in the existing single-class HP/slots path.
**Why it happens:** The modal currently reads `character.class` directly for hit die and spell slots. Multiclass changes the data model.
**How to avoid:** Add a guard at the top: `const isMulticlass = character.classes != null && character.classes.length > 1`. All existing single-class code paths remain gated behind `!isMulticlass`. The multiclass path is a new branch, not a refactor of the existing path.
**Warning signs:** Existing characters fail to level up after Phase 7 is deployed.

### Pitfall 6: Party Member Active Character State Persists Across Campaigns
**What goes wrong:** `campaignViewStore.activeCharacterId` persists in memory; if the user switches campaigns, the character ID from the previous campaign may still be set, causing wrong character to be displayed.
**Why it happens:** Zustand store is in-memory for the app session.
**How to avoid:** `activeCharacterId` must be reset to `null` whenever the active campaign changes (in the campaign navigation logic).
**Warning signs:** Wrong character sheet data shown when switching between campaigns.

### Pitfall 7: `campaign_reference_docs.content` Stored as Full TEXT
**What goes wrong:** A single imported PDF extracts to 300,000 characters of text and is stored in SQLite TEXT column with no limit. The `SELECT *` query in the reference doc loader reads all of it into memory on every AI call.
**Why it happens:** No content cap at storage time.
**How to avoid:** Cap content at storage time: `content = content.substring(0, 50000)` in `campaignReferenceDocsRepo.create()`. Add a note in the UI. The 50,000-char cap (~12,500 tokens) is already larger than any reasonable AI context window slot for a reference document.
**Warning signs:** App becomes slow to respond as reference docs accumulate.

### Pitfall 8: SRD Content JSON Files Bundled in ASAR — Hot Reload Issues in Dev
**What goes wrong:** During development (`electron-vite dev`), adding large new JSON files to `resources/` may cause slow initial reload or the files not being picked up until a full rebuild.
**Why it happens:** electron-vite watches `src/` by default; `resources/` changes may not trigger HMR.
**How to avoid:** Content JSON files are authored once in Wave 0 and not expected to change during development. If authoring iteratively, run `npm run compile:app` after each file change to force a full rebuild.
**Warning signs:** Changes to `feats.json` or `magic-items.json` don't appear in the app after saving.

---

## Code Examples

### Point Buy UI State Shape

```typescript
// Source: derived from D-01/D-02/D-03 decisions
interface PointBuyState {
  scores: Record<AbilityName, number>   // 8–15 per score
  presetFlaws: string[]                  // IDs of selected preset flaws
  freeFormFlaws: [string, string]        // up to 2 free-text flaw descriptions
}

// Budget display:
// totalBudget = 27 + sum(presetFlaw.points) + min(nonEmptyFreeFormCount, 2) * 2
// spent = sum(POINT_BUY_COST[score] for score in scores)
// remaining = totalBudget - spent
```

### unpdf Text Extraction (main process)

```typescript
// Source: github.com/unjs/unpdf README
import { getDocumentProxy, extractText } from 'unpdf'
import { readFile } from 'node:fs/promises'

export async function extractTextFromFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text
}

// For .txt / .md files (no PDF extraction needed):
export async function readTextFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  return content
}
```

### Campaign Reference Docs tRPC Procedure

```typescript
// New router: src/main/trpc/routers/campaignDocs.ts
// Follows the pattern of questsRepo / npcsRepo routers (Phase 6)
import { z } from 'zod'
import { router, procedure } from '../trpc'
import { campaignReferenceDocsRepo } from '../../db/campaignReferenceDocsRepo'
import { extractTextFromFile, readTextFile } from '../../services/pdfExtractor'
import path from 'node:path'

export const campaignDocsRouter = router({
  list: procedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input }) => campaignReferenceDocsRepo.list(input.campaignId)),

  import: procedure
    .input(z.object({ campaignId: z.string(), filePath: z.string() }))
    .mutation(async ({ input }) => {
      const ext = path.extname(input.filePath).toLowerCase()
      const raw = ext === '.pdf'
        ? await extractTextFromFile(input.filePath)
        : await readTextFile(input.filePath)
      const content = raw.substring(0, 50_000)  // Pitfall 7 cap
      const filename = path.basename(input.filePath)
      return campaignReferenceDocsRepo.create({ campaignId: input.campaignId, filename, content })
    }),

  delete: procedure
    .input(z.object({ docId: z.string() }))
    .mutation(({ input }) => campaignReferenceDocsRepo.delete(input.docId)),
})
```

### LevelUpModal Extension Guard

```typescript
// Source: derived from D-07/D-08 decisions; extending existing LevelUpModal.tsx
// Add at top of LevelUpModal function body, after existing const declarations:
const isMulticlass = character.classes != null && character.classes.length > 1
const totalLevel = isMulticlass
  ? character.classes!.reduce((sum, c) => sum + c.level, 0)
  : character.level
const nextLevel = totalLevel + 1  // Replace existing: character.level + 1

// Epic Boon flag:
const isEpicBoonLevel = nextLevel > 20

// ASI levels (varies by class; simplify to standard Fighter/Rogue pattern):
const ASI_LEVELS = [4, 8, 12, 16, 19]  // Standard for most classes; Phase 7 decision
const isASILevel = ASI_LEVELS.includes(nextLevel)

// Subclass check at subclass level:
const subclassLevels = isMulticlass ? [] : (SUBCLASS_LEVELS[classKey] ?? [])
const isSubclassLevel = subclassLevels.includes(nextLevel)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-parse` for Node.js PDF text | `unpdf` (serverless/inlined worker) | 2024–2025 | ASAR compatibility; no disk filesystem dependency |
| Single-class only via `uniqueCampaign` index | Multi-character party via `partySize` + `activeCharacterId` | Phase 7 | All tools that use `characterId` must accept party-scoped IDs |
| `character.class` (single string) | `character.classes` JSON array (nullable) | Phase 7 | All class consumers need null-safe access |
| Phase 5 `LevelUpModal` deferred subclass note | Full subclass dropdown in modal | Phase 7 | Removes placeholder UI |
| `reference_docs` JSON column (array of bundled doc paths) | `campaign_reference_docs` table (per-doc content storage) + extended JSON identifiers | Phase 7 | Reference doc selection now spans two sources |

**Deprecated/outdated in this phase:**
- Phase 5's "Subclass selection will be available in a future update" deferred note — removed entirely in Phase 7
- `uniqueCampaign` unique index on `characters` — dropped; replaced by app-level `partySize` enforcement

---

## Wave / Dependency Ordering for the Planner

The following wave ordering is recommended based on cross-plan dependencies:

**Wave 0 — Foundation (blocks all other waves):**
- Schema migration 0007 + Drizzle schema.ts updates
- Content JSON authoring: `feats.json`, `magic-items.json`, `rules.json`, `monsters.json`, `epic-boons.json`; extend `classes.json` with `subclasses` + `subclassLevel`
- New pure calculation functions in `calculations.ts`: `calcMulticlassSpellSlots`, `calcPointBuyCost`, `MULTICLASS_SPELL_SLOTS` table
- New repos: `characterFeatsRepo`, `customFeatsRepo`, `campaignReferenceDocsRepo`
- `pdfExtractor.ts` service (wraps `unpdf`)
- Wave 0 test stubs
- **Risk gate:** If `unpdf` import test fails in the main process, fall back to text-only for WORLD-01 and gate RULES-04 as "text files only" — PDF deferred to Phase 8. This decision must be made in Wave 0 before any UI assumes PDF capability.

**Wave 1 — AI layer (depends on Wave 0 schema + repos):**
- Two new tRPC routers: `library.ts` (SRD reference queries) + `feats.ts` (feat picker + custom feat CRUD)
- `campaignDocs` tRPC router (file import + list + delete)
- Tool schema extensions: `addCompanionSchema`, `removeCompanionSchema`
- `mutationPipeline.ts` extension: `addCompanion` + `removeCompanion` cases
- `contextBuilder.ts` extension: World Overview injection + extended character summary

**Wave 2 — Character subsystems (can run parallel to Wave 1 after Wave 0):**
- `StepAbilityScores.tsx` extension (method selector tabs + point buy tab + negative traits panel)
- `LevelUpModal.tsx` extension (multiclass branch + ASI/feat choice + subclass picker + Epic Boon picker)
- `CreateCharacterWizard.tsx` extension (Starting Feat step + re-triggerable party member flow)

**Wave 3 — Campaign creation (depends on Wave 1 for `generateWorldBrief` tRPC):**
- `CreateCampaignModal.tsx` extension (Party Size step + World Setup step + Encumbrance toggle)

**Wave 4 — Character Sheet view (depends on Wave 0 schema + Wave 1 tRPC):**
- Party member switcher chips in `CampaignViewScreen.tsx` + `campaignViewStore` `activeCharacterId`
- `CompanionsSection.tsx` (new component for Character Sheet tab)
- `SheetHeader.tsx` extension (multiclass display)
- Encumbrance display in Inventory tab

**Wave 5 — Library browser (depends on Wave 1 library tRPC router):**
- `LibraryScreen.tsx` new route (`/library`)
- App navigation wiring: "Rules" link in campaign list header + "📖" button in campaign header

**Wave 6 — Homebrew + reference docs (depends on Wave 1 campaignDocs tRPC):**
- `AiSettingsModal.tsx` Homebrew tab
- `ReferenceDocSelect.tsx` extension (campaign_reference_docs rows)

**Wave 7 — Integration sweep + test completion:**
- End-to-end: create party campaign, add 2 characters, multiclass, earn Epic Boon
- Verify PDF import in dev build (not ASAR-packed build) and in packaged build
- `awardInspiration` tool: Party mode requires updating `awardInspiration` to support any character ID in the party (D-08 from Phase 6 CONTEXT.md)
- Full test suite green

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Proficiency bonus extension past level 20 follows `Math.ceil(level/4) + 1` (continues pattern to +7 at 21, +8 at 25, etc.) | Epic Boons / Level Cap | Low impact — formula is used only for display; AI narrates consequence |
| A2 | `unpdf` works in Electron main process without special ASAR configuration | PDF Library Evaluation | Medium impact — Wave 0 spike must validate this; fallback to text-only is defined |
| A3 | SRD monsters browsable reference does NOT auto-populate the combat tracker (explicitly deferred per CONTEXT.md) | Scope | Low — decision is locked; confirmed deferred |
| A4 | `awardInspiration` Phase 6 tool uses `characterId`; Phase 7 party mode just means the AI can call it with any party member's ID | Prior phase integration | Low — existing tool schema already accepts `characterId: string`; no schema change needed |
| A5 | The 10 preset flaws list (researcher-designed) matches D-04's intent of "10–12 curated flaws" | Negative Flaws list | Low — user can adjust in discuss phase before implementation |
| A6 | Third-caster subclasses (Eldritch Knight, Arcane Trickster) are recognized for multiclass spell slot calculation | Multiclass algorithm | Medium — these are subclass-gated; if subclass strings don't match the check, characters would be treated as non-casters. The check should be done case-insensitively against known subclass name strings |

---

## Open Questions (RESOLVED)

1. **RESOLVED — `awardInspiration` tool with party mode:** Phase 6 CONTEXT.md D-08 notes: "future-proof for Phase 7 party mode." In party mode, the system prompt currently injects only the "player character ID." The contextBuilder needs to inject ALL party member IDs so the AI can target any of them. This is a contextBuilder extension, not a tool schema change.
   - What we know: `awardInspiration({ characterId: string })` already supports any character ID
   - What's unclear: Whether the character summary section should list all party members or just the active one
   - Recommendation: Inject a "Party Members" section with all non-companion character IDs in the world state summary block
   - **RESOLVED:** 07-11 Task 1 — contextBuilder is extended to inject a "Party Members:" line listing all non-companion character IDs so the AI can target any party member with `awardInspiration`. No tool schema change required (A4 confirmed).

2. **RESOLVED — Multi-character combat tracker:** When `partySize > 1`, multiple characters are in the combat tracker. The existing `is_player` flag marks player characters. Phase 7 adds `isCompanion` characters. The Phase 5 combat tracker adds player characters via `addCombatant({ isPlayer: true })`. In party mode, how are multiple player characters added?
   - What we know: The combat tracker `is_player` flag already exists; companions are added via `addCompanion` tool
   - What's unclear: Whether a "Start Combat" flow automatically adds all party members, or the AI calls `addCombatant` once per party member
   - Recommendation: "Start Combat" button automatically adds all active (non-companion) party members as combatants with current HP; AI adds enemies and companions
   - **RESOLVED:** 07-08 Task 3 — the Start Combat handler is modified to call `trpc.combat.addCombatant({ isPlayer: true, … })` for each non-companion party member when `partySize > 1`. Solo campaigns (`partySize = 1`) are unaffected.

3. **RESOLVED — `reference_docs` JSON column migration strategy:** Currently stores `string[]` (relative paths of bundled docs). Phase 7 extends this to also include `campaign_reference_docs.id` strings. These look like UUIDs vs. relative paths — the system can distinguish them. But existing campaigns with reference_docs selections must continue to work.
   - What we know: The column is a JSON string array; the referenceDocLoader reads it and calls `readReferenceDocs(paths)` which looks up files on disk
   - What's unclear: Whether to keep the mixed-array approach or split into two columns
   - Recommendation: Keep mixed array. The `readReferenceDocs` function is extended to recognize IDs (UUIDs) and query `campaign_reference_docs` for those entries. Relative path strings continue to load from disk as before.
   - **RESOLVED:** 07-10 Task 2 — mixed-array approach adopted. `referenceDocLoader.ts` is extended: entries that match UUID format are resolved via `campaignReferenceDocsRepo.getById`; relative path strings continue to load from disk. Existing campaigns are unaffected.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `unpdf` | PDF text extraction (WORLD-01, RULES-04) | needs install | 1.6.2 | Text/markdown import only |
| Node.js `fs` module | `pdfExtractor.ts` file reads | native | N/A (built-in) | — |
| Electron main process `dialog.showOpenDialog` | File picker for PDF/text import | native | Electron 41.7.0 | — |
| `drizzle-kit` | Migration 0007 generation | installed | existing | — |
| `vitest` | New calculation tests | installed | existing | — |

**Missing dependencies with no fallback:** none
**Missing dependencies requiring install before Wave 0:** `unpdf@1.6.2`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.x |
| Config file | `vitest.config.ts` (exists, environment: 'node') |
| Quick run command | `npm run test -- --reporter=dot` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAR-02 | `calcPointBuyCost` returns correct totals for all scores 8–15 | unit | `npm run test -- src/main/characters/calculations.test.ts` | Wave 0 gap |
| CHAR-02 | `calcPointBuyBudget` adds 27 + flaw points correctly | unit | `npm run test -- src/main/characters/calculations.test.ts` | Wave 0 gap |
| CHAR-04 | `calcMulticlassSpellSlots` returns correct slot table for Fighter 5 / Wizard 3 (caster level 8) | unit | `npm run test -- src/main/characters/calculations.test.ts` | Wave 0 gap |
| CHAR-04 | `calcMulticlassCasterLevel` correctly applies half-caster division for Paladin | unit | `npm run test -- src/main/characters/calculations.test.ts` | Wave 0 gap |
| CHAR-05 | `characterFeatsRepo.add` and `list` persist feats correctly | unit | `npm run test -- src/main/db/characterFeatsRepo.test.ts` | Wave 0 gap |
| PROG-03 | Level-up past 20 increments level and uses `epic-boons.json` list | unit | `npm run test -- src/main/characters/calculations.test.ts` | Wave 0 gap |
| RULES-04 | `extractTextFromFile` returns non-empty string for a test PDF | unit | `npm run test -- src/main/services/pdfExtractor.test.ts` | Wave 0 gap |
| RULES-04 | `campaignReferenceDocsRepo.create` stores content capped at 50,000 chars | unit | `npm run test -- src/main/db/campaignReferenceDocsRepo.test.ts` | Wave 0 gap |
| WORLD-01 | `contextBuilder.buildContext` includes `worldBrief` in system prompt when set | unit | `npm run test -- src/main/ai/contextBuilder.test.ts` | extends existing |
| STATE-06 | `contextBuilder.formatCharacterSummary` includes encumbrance status when enabled | unit | `npm run test -- src/main/ai/contextBuilder.test.ts` | extends existing |
| PARTY-01 | `charactersRepo.create` enforces `partySize` limit at application level | unit | `npm run test -- src/main/db/charactersRepo.test.ts` | extends existing |
| PARTY-02 | `mutationPipeline.apply` with `addCompanion` creates `isCompanion = true` character | unit | `npm run test -- src/main/ai/mutationPipeline.test.ts` | extends existing |

### Sampling Rate
- **Per task commit:** `npm run test -- --reporter=dot src/main/characters/calculations.test.ts src/main/ai/contextBuilder.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/characters/calculations.test.ts` — extend with point buy and multiclass spell slot tests
- [ ] `src/main/services/pdfExtractor.test.ts` — new file; requires a small test PDF fixture in `src/main/services/fixtures/`
- [ ] `src/main/db/characterFeatsRepo.test.ts` — new file
- [ ] `src/main/db/customFeatsRepo.test.ts` — new file
- [ ] `src/main/db/campaignReferenceDocsRepo.test.ts` — new file
- [ ] Extend `src/main/ai/contextBuilder.test.ts` — World Overview injection test, extended character summary tests
- [ ] Extend `src/main/db/charactersRepo.test.ts` — `partySize` enforcement test, `isCompanion` creation test
- [ ] Extend `src/main/ai/mutationPipeline.test.ts` — `addCompanion` and `removeCompanion` pipeline tests

---

## Security Domain

`security_enforcement` is not set to false in config.json — security section applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | Zod schemas on all new tRPC inputs and tool call schemas |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Phase's Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in PDF/text file import | Tampering | `dialog.showOpenDialog` restricts to user's filesystem; validate `filePath` is an absolute path; do not allow relative paths or `..` sequences |
| PDF content injection into system prompt | Tampering | World document text is truncated and injected as literal text, not as instructions; existing `stripNewlines` pattern from Phase 6 applies; implement same sanitization on injected world document content |
| Oversized import content DoS | Denial of Service | 50,000-char cap at storage time in `campaignReferenceDocsRepo.create`; 16,000-char truncation at injection time |
| Custom feat name/description injection | Tampering | `custom_feats.name` and `custom_feats.description` are injected into the AI context; apply `stripNewlines` before injection; Zod validates max lengths at input (e.g., name ≤ 100 chars, description ≤ 2000 chars) |
| Companion tool-call abuse | Tampering | `addCompanionSchema` validates all fields via Zod in mutationPipeline (same T-05-02-01 pattern as Phase 5) |
| Party-size enforcement bypass | Tampering | Application-level check in `charactersRepo.create`: verify `character count < campaign.partySize` before insert; the DB no longer has the unique index as a safety net |

---

## Sources

### Primary (HIGH confidence)
- `src/main/db/schema.ts` — verified current schema (Phases 1–6)
- `src/main/ai/contextBuilder.ts` — verified injection order and world state injection
- `src/main/characters/calculations.ts` + test file — verified existing calculation pattern
- `src/renderer/src/components/LevelUpModal.tsx` — verified existing Phase 5 modal structure and SUBCLASS_LEVELS map
- `src/renderer/src/components/CreateCampaignModal.tsx` — verified existing 3-step wizard structure
- `src/renderer/src/components/ReferenceDocSelect.tsx` — verified existing reference doc selection component
- `resources/migrations/0006_phase6_world_state.sql` — confirmed last migration = 0006
- `resources/classes.json` — verified class data (12 classes, `spellcaster` field, `choosesSubclassAtLevel1`)
- `resources/spells-by-class.json` — verified spell slot structure format
- `package.json` — verified all existing dependencies
- [5thsrd.org — Multiclassing rules](https://5thsrd.org/rules/multiclassing/) — verified multiclass spell slot table and caster classifications
- [github.com/unjs/unpdf README](https://github.com/unjs/unpdf) — verified serverless build, inlined worker, CJS+ESM exports
- [dnd5e.wikidot.com/epic-boons](https://dnd5e.wikidot.com/epic-boons) — verified 26 DMG epic boons with descriptions

### Secondary (MEDIUM confidence)
- [pkgpulse.com — unpdf vs pdf-parse vs pdfjs-dist comparison](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — confirmed pdf-parse filesystem issue; unpdf serverless-first architecture
- [github.com/mozilla/pdf.js/issues/16111](https://github.com/mozilla/pdf.js/issues/16111) — confirmed pdfjs-dist worker-src ASAR issues
- npm registry: `npm view unpdf@1.6.2` — confirmed CJS entry, peerDep `@napi-rs/canvas` optional

### Tertiary (LOW confidence)
- Proficiency bonus extension formula `Math.ceil(level/4) + 1` — community consensus from EN World thread; not in any official source [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm; core is the existing project stack
- Architecture: HIGH — all integration points verified against actual source files
- PDF library recommendation: HIGH — `unpdf` architecture directly addresses the ASAR constraint; Wave 0 spike still recommended to confirm in-process behavior
- D&D rules (multiclass, point buy): HIGH — verified from 5e SRD directly
- Epic Boons: HIGH — 26 boons verified from wikidot (itself sourced from DMG)
- Proficiency beyond 20: LOW — no official source; ASSUMED extension of pattern
- Content JSON file sizes: MEDIUM — estimates based on comparable SRD sources; actual sizes TBD when files are authored

**Research date:** 2026-05-31
**Valid until:** 2026-07-01 (30 days; `unpdf` and `pdfjs-dist` versions should be re-checked if planning is delayed)
