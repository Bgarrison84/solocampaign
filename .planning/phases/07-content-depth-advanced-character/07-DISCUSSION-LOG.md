# Phase 7: Content Depth & Advanced Character - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 7-Content Depth & Advanced Character
**Areas discussed:** Ability scores + negative traits, World setup modes, SRD reference + homebrew, Party mode + companions, Multiclassing UX, Feats + custom feat editor, Encumbrance, Subclass selection

---

## Ability Scores + Negative Traits

### Point buy budget

| Option | Description | Selected |
|--------|-------------|----------|
| 27-point standard buy (RAW) | Official D&D 5e point buy — 27 points, scores from 8–15. Negative traits add extra points on top. | ✓ |
| Custom budget with negative traits only | Start at 0 points; negative traits are the only source of points. | |
| You decide | Researcher/planner picks. | |

**User's choice:** 27-point standard buy (RAW)

---

### Preset negative traits count

| Option | Description | Selected |
|--------|-------------|----------|
| 6–8 presets (a solid set) | Core archetypes covered: Frail, Clumsy, Weak, Dim, Naive, Awkward, Unlucky. | |
| 10–12 presets (comprehensive) | Fuller list covering more playstyle variety. More design work but richer expression. | ✓ |
| 4–5 presets minimum viable | Prove the mechanic, expand later. | |

**User's choice:** 10–12 presets (comprehensive)

---

### Free-form flaw points

| Option | Description | Selected |
|--------|-------------|----------|
| 1 point per flaw (max 2 flaws) | Low mechanical value — role-playing tool first. | |
| 2 points per flaw (max 2 flaws) | Comparable to lightweight preset; more meaningful. | ✓ |
| You decide | Planner picks balanced value. | |

**User's choice:** 2 points per free-form flaw (max 2 flaws)

---

### 4d6 reroll mechanic

| Option | Description | Selected |
|--------|-------------|----------|
| Per-stat reroll button (keep better) | Reroll button per stat; automatically keeps higher of original vs. new result. | ✓ |
| Per-stat reroll button (take new result) | Always replaces current score with new roll, no comparison. | |
| You decide | Planner designs reroll UX. | |

**User's choice:** Per-stat reroll button, keeps better result

---

## World Setup Modes

### When world setup happens

| Option | Description | Selected |
|--------|-------------|----------|
| During campaign creation (wizard step) | World Setup step added to campaign creation before the campaign opens. | ✓ |
| Post-creation in campaign settings | Stays in gear modal; campaign creation stays lightweight. | |
| Prompted automatically before first session | Modal appears when player hits Start Session for the first time. | |

**User's choice:** During campaign creation (new wizard step)

---

### AI-generate mode behavior

| Option | Description | Selected |
|--------|-------------|----------|
| AI generates during first session narration | Campaign just notes "world mode: AI-generated"; AI invents world in opening narration. | |
| AI generates a world brief at campaign creation | Non-streaming AI call generates a 500–800 word world brief saved to the campaign. | ✓ |
| You decide | Planner designs the AI-generate flow. | |

**User's choice:** AI generates a world brief at campaign creation (saved to `worldBrief` column)

---

### Imported world document storage

| Option | Description | Selected |
|--------|-------------|----------|
| Injected as a reference doc (same as Phase 3) | Added to reference_docs list; injected at session start via existing ContextBuilder path. | |
| Stored as a dedicated 'world document' field | New `worldDocument` column on campaigns; injected in dedicated "World Overview" section with higher priority. | ✓ |
| You decide | Planner picks architecturally cleanest path. | |

**User's choice:** Dedicated `worldDocument` column, injected in "World Overview" section

---

## SRD Reference + Homebrew

### SRD reference location

| Option | Description | Selected |
|--------|-------------|----------|
| New 7th tab in the right panel | Reference tab added to CampaignViewScreen tab list. | |
| Standalone screen (separate from campaign view) | Dedicated `/library` route accessible from campaign list + header button. | ✓ |
| Popover/modal triggered from a button | Large modal overlay with the reference browser. | |

**User's choice:** Standalone screen (separate from campaign view)

---

### SRD reference scope for Phase 7

| Option | Description | Selected |
|--------|-------------|----------|
| All four sections (rules, spells, items, monsters) | Full RULES-01 compliance — all four sections in Phase 7. | ✓ |
| Spells + items first (rules + monsters deferred) | Two sections in Phase 7; rules prose + monster stat blocks in Phase 8. | |
| You decide | Planner scopes based on effort and SRD data. | |

**User's choice:** All four sections in Phase 7

---

### Homebrew + rules import → AI path

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Phase 3 reference docs mechanism | Homebrew/imported docs added to reference_docs list; same ContextBuilder path. | ✓ |
| Separate AI context section with higher priority | Dedicated "House Rules & Homebrew" block before reference docs. | |
| You decide | Planner picks cleanest architectural fit. | |

**User's choice:** Extend Phase 3 reference docs mechanism (no new ContextBuilder path)

---

### PDF import handling

| Option | Description | Selected |
|--------|-------------|----------|
| Include PDF import in Phase 7 (spike first) | First plan = library evaluation spike; ship if viable, fall back to text-only if not. | ✓ |
| Text-only in Phase 7, PDF deferred to Phase 8 | Phase 7 = .txt/.md only; PDF spike pairs with character sheet PDF export in Phase 8. | |
| PDF import for world docs only (skip RULES-04 PDF) | WORLD-01 supports PDF; RULES-04 text/markdown only in Phase 7. | |

**User's choice:** Include PDF import in Phase 7, spike-first approach

---

## Party Mode + Companions

### Party size configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign creation wizard (Party Size field) | Player chooses size at campaign creation; locked after first character is created. | ✓ |
| Campaign settings only | Party size in gear modal; changeable before first session with confirmation. | |
| You decide | Planner picks lowest-friction path. | |

**User's choice:** Campaign creation wizard (new Party Size field)

---

### Multi-character Character Sheet tab layout

| Option | Description | Selected |
|--------|-------------|----------|
| Character tabs (switcher chips at top of sheet) | Chip row switches between character sheets; existing sheet components unchanged. | ✓ |
| Stacked sheets (all characters visible, collapsible) | All sheets stack vertically; may be crowded at 4 characters. | |
| You decide | Planner picks based on existing tab architecture. | |

**User's choice:** Character switcher chips at top of Character Sheet tab

---

### Companions data model

| Option | Description | Selected |
|--------|-------------|----------|
| Separate companions table (simpler data, no wizard) | New table with only combat-relevant fields. AI adds/removes via tool calls. | |
| Flag on the characters table (isCompanion column) | Existing characters table + `isCompanion` bool. Simplified add form (no wizard). | ✓ |
| You decide | Planner decides based on schema complexity. | |

**User's choice:** `isCompanion` flag on the characters table

---

### Epic Boons flow

| Option | Description | Selected |
|--------|-------------|----------|
| Level cap removed + Epic Boon picker on level-up past 20 | Level Up modal shows boon picker from `epic-boons.json` when newLevel > 20. | ✓ |
| Level cap removed + player notes boon in character sheet | Free-form text field; no structured picker. | |
| You decide | Planner designs Epic Boon flow. | |

**User's choice:** Epic Boon picker in Level-Up modal (from `epic-boons.json`)

---

## Multiclassing UX

### Entry point for adding a second class

| Option | Description | Selected |
|--------|-------------|----------|
| Via Level-Up modal (extended) | Modal offers "Level up in [class]" OR "Add multiclass: [pick class]". | ✓ |
| Character sheet 'Add Class' action | Standalone button in the class/level section; independent of level-up. | |
| You decide | Planner designs the multiclass entry point. | |

**User's choice:** Via Level-Up modal (Phase 5 modal extended)

---

### Multiclass data storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSON column 'classes' on characters table | `[{className, level}]` array; existing `class` column kept for backward compat. | ✓ |
| Separate character_classes table | Normalized; cleaner querying but more schema work. | |
| You decide | Planner picks based on schema simplicity. | |

**User's choice:** `classes` JSON column on characters table

---

## Feats + Custom Feat Editor

### When feats are selected

| Option | Description | Selected |
|--------|-------------|----------|
| Creation wizard + Level-Up modal at ASI levels | Both paths: optional starting feat in wizard + ASI/Feat choice at levels 4/8/12/16/19. | ✓ |
| Level-Up modal only | Feats only at ASI levels; no wizard changes for feats. Starting feats applied manually. | |
| You decide | Planner picks based on effort. | |

**User's choice:** Both paths (creation wizard optional starting feat + Level-Up modal at ASI levels)

---

### Custom feat content fields

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description only (AI interprets) | Free-form; AI applies effects narratively from description. | ✓ |
| Name + description + optional ability score bonus | Structured +2 field for mechanical effect; AI handles rest. | |
| You decide | Planner designs custom feat schema. | |

**User's choice:** Name + description only (AI interprets mechanically)

---

## Encumbrance (STATE-06)

### Encumbrance toggle location

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign creation wizard (checkbox) | Encumbrance checkbox in the campaign creation wizard. Also in gear modal post-creation. | ✓ |
| Campaign gear modal only | Setting only in existing gear modal; no creation wizard changes. | |
| You decide | Planner picks least invasive path. | |

**User's choice:** Campaign creation wizard checkbox (also accessible in gear modal)

---

## Subclass Selection

### Subclass selection flow

| Option | Description | Selected |
|--------|-------------|----------|
| Level-Up modal: subclass picker at the class's subclass level | Picker appears in Level Up modal when character hits the relevant level. | ✓ |
| Character sheet 'Change Subclass' option (retroactive, anytime) | Editable field; no level-gating; simpler. | |
| You decide | Planner designs based on classes.json. | |

**User's choice:** Level-Up modal subclass picker (level-gated per class)

---

## Claude's Discretion

- Exact list of 10–12 preset negative flaws (names, penalties, point values)
- Exact point cost table for point buy (RAW from SRD)
- `classes.json` subclasses array content for all 12 SRD classes
- Epic Boons JSON content (SRD boons + descriptions)
- Proficiency bonus table extension past level 20
- SRD content JSON structure for rules.json, monsters.json, magic-items.json
- Exact ContextBuilder injection order for worldBrief/worldDocument vs. L3
- Migration number for Phase 7 (next after Phase 6's migration 0006)
- Token budget for world document injection
- PDF library selection (result of Phase 7 spike)

## Deferred Ideas

- Ritual casting mechanical enforcement — still deferred (narrative only)
- Warlock advanced short-rest features — still player-managed
- Spell list search/filter in Character Sheet — Phase 8 polish
- SRD monsters for auto-populate combatant stats in combat tracker — Phase 8 enhancement
- Subrace ability score + trait depth refinement — may need revisiting if gaps found
- Named in-world calendar system — Phase 8+
- Player-editable NPC notes — Phase 8
- Journal PDF/markdown export — Phase 8
