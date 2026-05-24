# Phase 2: Character Domain & Live Sheet — Discussion Log

**Date:** 2026-05-24
**Participants:** User + Claude
**Output:** `02-CONTEXT.md`

---

## Areas Discussed

### 1. Character Builder Entry

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Where does the character builder live? | Modal wizard / Full-screen route / Inline reveal | Modal wizard |
| How many steps and order? | 4 steps (no ability scores) / 5 steps incl. ability scores / You decide | 5 steps (→ became 6 with Review step) |
| Ability score method? | Standard array only / Standard array + manual / Standard array + point buy | Standard array + manual entry |
| One character or N per campaign? | One per campaign / Schema supports N | One per campaign |
| Post-creation edit? | Inline fields / Re-open wizard / You decide | Inline fields only |
| Option display in selection lists? | Summary card / Full stat blocks / Names only | Full stat blocks |
| Content source for races/classes/etc.? | Character sheet PDFs for layout only / Extract from proprietary books / PDF import in Phase 2 | All Reference Documents (full extraction) |
| Auto-apply racial bonuses? | Auto-apply / Manual confirm / Display only | Auto-apply |
| What's auto-calculated? | AC+prof+slots; manual skills/saves | AC (10+DEX), proficiency bonus, spell slots |
| Spell handling? | Slot tracking only / Full spell list in Phase 2 / You decide | Spell slot tracking only |
| Level-1 subclass for early classes? | Yes / No / You decide | Yes (Cleric, Sorcerer, Warlock) |
| Equipment selection? | Package choice / Item-by-item / Gold start | Package choice (2–3 predefined packages per class) |
| Personality traits/alignment? | Background shows suggested traits as optional fields / Alignment only / Skip | Background shows suggested traits as optional fields |
| Feats at level 1? | No feats in Phase 2 / Yes with feat list / You decide | No feats in Phase 2 (species-granted auto-applied) |
| Background features? | Read-only info / Track mechanically | Read-only info |
| Languages? | Language picker for free-choice slots / Auto-assign / You decide | Language picker for free-choice slots |
| Skill proficiencies? | Auto-assign background, class picker / Combined step / You decide | Auto-assign background; class skills selectable |
| Tool proficiencies? | Auto-assign, show on sheet / Defer | Auto-assign, display on sheet |
| Review/Summary step? | Yes with Confirm / No incremental save / You decide | Yes with Confirm button |
| Wizard skippable? | No — auto-launch / Yes — optional | No — auto-launch |
| Post-wizard display? | Full sheet immediately / Portrait prompt first / You decide | Full sheet immediately |
| SRD races scope? | All 9 SRD races / You decide | All races from Reference Documents |
| Subclass at creation? | Yes for level-1 subclass classes / No / You decide | Yes for Cleric/Sorcerer/Warlock |
| Wizard validation? | Required fields block Next / Warn but allow skip / No validation | Required fields block Next |
| Character name and backstory? | Name required + optional backstory / Name only / You decide | Name required + optional backstory |
| What's shown after wizard? | Full sheet / Portrait prompt / You decide | Full sheet |
| Spell support? | Slot tracking only / Full spell selection / You decide | Slot tracking only |
| Feats at creation? | No in Phase 2 / Yes full feat list / You decide | No in Phase 2 |
| Background features mechanical? | Read-only / Track mechanically | Read-only |
| Languages? | Picker for free-choice / Auto-assign / You decide | Picker |
| Background skill prof choice? | Auto-assign / Combined step / You decide | Auto-assign |
| Tool prof tracking? | Auto-assign + display / Defer | Auto-assign + display |
| Review step? | Yes Confirm / No incremental / You decide | Yes |
| Does Phase 2 include spellcasting? | Slot tracking only / Full spell list | Slot tracking only |

---

### 2. Sheet Layout & Density

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Sheet organization? | Single scrollable column / Mini sub-tabs / Two-column grid | Single scrollable column |
| Section order? | Header→Ability→Skills→Combat→Resources→Equipment→Traits / Ability-first / You decide | Header → Ability scores → Skills/Saves → Combat Stats → Resources → Equipment → Traits |
| Live-editable field style? | Inline edit on click / Stepper +/- buttons / Edit mode toggle | Stepper +/- buttons |
| Which fields are editable? | Live-play fields only / All fields / Two modes | Live-play fields + ability scores (can change from ASIs/effects) |
| Condition tracking? | Condition badges toggle / Free text / Checklist | Condition badges toggle |
| Portrait display? | 80×80px in header / 120×160px card / No portrait on sheet | 80×80px in header |
| Equipment display? | Compact list with attunement toggle / Grid of cards / Bullet list | Compact list with attunement toggle |
| Currency? | All 5 denominations with steppers / GP only / You decide | All 5 denominations with +/- steppers |
| Death saves? | 3+3 checkboxes / Always visible | 3+3 checkboxes, always visible |
| Saving throws? | 6 rows with proficiency dot / Proficient only / You decide | 6 rows with proficiency dot |
| Skills section? | All 18 with proficiency dots / Proficient only / You decide | All 18 with proficiency/expertise dots |
| HP persist? | Immediate / Debounced 500ms / You decide | Immediate on every press |
| Passive perception? | Yes near skills / No | Yes near skills |
| Combat stats prominence? | AC/Init/Speed prominent / Buried / You decide | Prominent (big numbers in a row) |
| Inspiration? | Single toggle on sheet / Defer to Phase 6 / You decide | Single toggle on sheet |
| Traits section? | Collapsible at bottom / No | Collapsible section with racial traits + level-1 features |
| Proficiencies section? | Compact block / In traits section | Compact separate block |

---

### 3. Image Storage

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Storage method? | Copy to userData + store path / Store original path / Base64 in SQLite | Copy to userData, store relative path in DB |
| Accepted formats? | PNG/JPG/WEBP / Any format / You decide | PNG, JPG/JPEG, WEBP |
| Size limit? | Resize to 1024px max / No resize / You decide | Resize to max 1024px on longest side |

---

### 4. Content Data Delivery

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Bundling format? | JSON in resources/ / Hard-coded TS constants / Seeded SQLite tables | JSON files in resources/ (asarUnpack) |
| Who authors the content? | Executor by hand from PHB PDFs / PDF parser script / You decide | Executor authors by hand from Reference Document PDFs |

---

## Claude's Discretion

- Portrait fallback image when no portrait imported (class icon or fantasy silhouette)
- Specific JSON schema structure for race/class/background/equipment content files
- Exact layout of the stepper +/- control component
- Which step in the wizard captures character name (first step or separate Name step)
- Exact condition badge visual design (colors, shape)

## Deferred Ideas

- Spell list selection and casting (Phase 5)
- Feat selection UI (Phase 7)
- Multiclassing (Phase 7)
- Advanced ability score methods — 4d6-drop, negative-trait point buy (Phase 7)
- Party/multi-character support (Phase 7)
- PDF import for user-importable content (Phase 7)
- Equipment encumbrance enforcement (Phase 7)
- Spell slot recovery on rest (Phase 5)
- XP-driven level-up flow (Phase 5)

---

*Generated: 2026-05-24*
