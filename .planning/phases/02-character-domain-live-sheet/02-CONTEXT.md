# Phase 2: Character Domain & Live Sheet - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can build a level-1 character using a multi-step wizard (pulling content from the bundled 2024 PHB, Tasha's, and Xanathar's), import a portrait and cover image, and see/edit live HP, spell slots, XP, currency, conditions, death saves, and attuned items on a persistent character sheet in the right panel.

**In scope:** Character creation wizard (modal, 6 steps), full PHB content bundled as JSON, character sheet tab (single scrollable column), live resource editing (stepper +/- controls), portrait/cover image import with copy-to-userData, all 5 currency denominations, condition badges, skills/saves display, traits/proficiencies sections.

**Out of scope:** Spell list selection and casting (Phase 5), party/multi-character support (Phase 7), feats UI (Phase 7), multiclassing (Phase 7), advanced ability score methods — 4d6-drop/negative-trait point buy (Phase 7), PDF import (Phase 7), combat automation (Phase 5), AI tool-call mutations to character state (Phase 5+).

</domain>

<decisions>
## Implementation Decisions

### Character Builder Entry Point

- **D-01:** Character creation is a modal wizard launched from the Character Sheet tab. Uses the same modal pattern as `CreateCampaignModal` already in the codebase.
- **D-02:** The wizard has 6 steps: **Race → Class → Ability Scores → Background → Equipment → Review/Summary**. The Review step shows all choices with a Confirm button before writing to the DB.
- **D-03:** One character per campaign in Phase 2. Unique constraint on `campaign_id` in the characters table. Phase 7 removes the constraint when party support ships.
- **D-04:** If a campaign has no character when the user navigates to it, the wizard launches automatically. It cannot be dismissed without completing or cancelling (cancel returns to the campaign list).
- **D-05:** The wizard is creation-only. Post-creation edits happen inline on the sheet. No "rebuild" or "edit in wizard" flow in Phase 2.
- **D-06:** Full stat blocks are shown for each selectable option (race, class, background) — not just names or summaries. Player can read full traits/features before choosing.

### Wizard Steps — Content

- **D-07:** **Content source:** All Reference Documents override the SRD-only constraint. Bundled data is authored from the 2024 Player's Handbook, Tasha's Cauldron of Everything, and Xanathar's Guide to Everything (files in `Reference Documents/Player guides/`). The executor reads the PDFs and authors the JSON by hand.
- **D-08:** **Race step:** All species/races from the 2024 PHB content. Each entry shows full traits, ASI bonuses, speed, size, and special abilities as a stat block.
- **D-09:** **Class step:** All classes from the 2024 PHB. For classes that choose a subclass at level 1 (Cleric: Divine Domain, Sorcerer: Sorcerous Origin, Warlock: Patron), a subclass picker is shown within the Class step. Other classes defer subclass choice to later levels (not tracked in Phase 2).
- **D-10:** **Ability Scores step:** Standard array (15/14/13/12/10/8) assignment with manual override per stat. Player assigns the 6 values to STR/DEX/CON/INT/WIS/CHA, then can override individual values if needed. No rolling UI. Advanced methods (4d6-drop, negative-trait point buy) are Phase 7.
- **D-11:** **Background step:** All backgrounds from the bundled PHB/Tasha's/Xanathar's content. Each shows: skill proficiency grants (auto-applied, no choice), tool proficiency grants (auto-applied), background feature as read-only text, starting equipment, and suggested Personality Traits/Ideals/Bonds/Flaws as optional text fields. Language picker shown where the background grants a free language choice.
- **D-12:** **Equipment step:** Package choice — 2–3 predefined starting equipment packages per class (e.g., Fighter: Package A: chain mail + shield + a martial weapon OR Package B: leather armor + longbow). Matches the PHB class starting equipment presentation.
- **D-13:** Character name is required (collected in the wizard — first or dedicated Name step). Optional backstory text area.
- **D-14:** **Validation:** Required fields block the Next button. Cannot advance a step without making the required selection. No skipping steps.

### Wizard Completion — Auto-Calculations

- **D-15:** On wizard confirmation, the following are auto-calculated and written to the DB:
  - HP = class hit die + CON modifier
  - AC = 10 + DEX modifier (or armor-based if equipped with armor)
  - Proficiency bonus = +2 (level 1)
  - Spell slots = by class/level from bundled data
  - Racial ASI bonuses added to base ability scores
  - Species-granted level-1 feats auto-applied from content data (no picker UI)
  - Background skill proficiencies auto-applied
  - Background tool proficiencies auto-applied
- **D-16:** Player manually makes skill proficiency choices (class-granted picks) in the Ability Scores step. Saving throw proficiencies are fixed per class (auto-applied, displayed read-only — no picker UI). The 2024 PHB gives each class exactly two fixed saves; the player's "choice" is the class selection itself. *(Updated from discuss-phase: original wording said "and saving throw proficiency choices" but the rules have no save choice — corrected 2026-05-25.)*
- **D-17:** After the wizard closes, the Character Sheet tab renders immediately with the completed character. No intermediate portrait-prompt step.

### Character Sheet Layout

- **D-18:** Single scrollable column inside the Character Sheet `TabsContent`. No nested sub-tabs. Section order (top → bottom):
  1. **Header** — 80×80px portrait thumbnail + character name + race/class/level line
  2. **Ability Scores** — STR/DEX/CON/INT/WIS/CHA scores with modifiers
  3. **Saving Throws** — 6 rows (one per ability) with modifier + proficiency dot (filled = proficient, empty = not)
  4. **Skills** — All 18 skills, governing ability, modifier, proficiency/expertise dot markers. Passive Perception (10 + Perception mod) shown here.
  5. **Combat Stats** — AC / Initiative (DEX mod) / Speed — displayed as prominent big numbers
  6. **Resources** — Current HP / Max HP (stepper), Spell Slots used/max per level (stepper), Inspiration toggle, Death Save checkboxes (3 success + 3 failure, always visible), Conditions row
  7. **Currency** — CP / SP / EP / GP / PP each with +/- stepper buttons
  8. **Equipment** — Compact item list (name / weight / qty columns). Attunement toggle per item, attunement count shown (e.g., 1/3 attuned).
  9. **Proficiencies** — Compact block: armor types / weapon categories / tool proficiencies (read-only, derived from class + background data)
  10. **Traits** — Collapsible section: racial traits + level-1 class features as read-only text from bundled content

- **D-19:** **Editable fields:** All ability score fields are editable (player may need to adjust for ASIs, magical effects, ability score drain). Live-play resource fields (HP, spell slots, currency, death saves, conditions, attunement, inspiration) use stepper +/- controls. Static fields (race, class, background, base proficiencies, traits text) are read-only.
- **D-20:** **Persist strategy:** HP, spell slots, currency, conditions, death saves, inspiration, and attunement changes persist immediately on every stepper press or toggle. Ability score edits persist on field blur. No debounce for combat-critical values.
- **D-21:** **Condition badges:** Row of toggleable badges for all 14 standard D&D 5e conditions (Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned). Active conditions highlighted.
- **D-22:** **Death saves:** 3 success + 3 failure checkboxes, always visible on the sheet (player can track them any time, not just at 0 HP).
- **D-23:** **Spell slots:** Shown per slot level (1st through 9th). Only levels the class has are displayed. Each slot level shows used/max with a stepper or pip row. Spell slot tracking only — no spell list or casting UI in Phase 2.

### Image Import

- **D-24:** When a user imports a portrait or cover image, the file is **copied** into the app's userData directory under `images/{campaignId}/`. The DB stores the relative path. The original source file can be moved or deleted without breaking the app.
- **D-25:** Accepted formats: PNG, JPG/JPEG, WEBP. The file picker filters to these types.
- **D-26:** Images are resized to a max of 1024px on the longest side (maintaining aspect ratio) in the main process before copying. Prevents large source images from bloating the userData folder.
- **D-27:** Portrait is imported from the character sheet header (click the portrait area to open the file picker). Cover image is imported from the campaign card (click the cover image area on the CampaignCard or a button within the campaign view header).

### Content Data Format

- **D-28:** Race/class/background/equipment data is stored as **JSON files in `resources/`** (asarUnpack list in electron-builder config — same approach as the Drizzle migration SQL files). Files: `races.json`, `classes.json`, `backgrounds.json`, `equipment.json`, `spells-by-class.json` (for slot calculation reference).
- **D-29:** Data is loaded in the main process at startup and served via a new `content` tRPC router (e.g., `content.races.list`, `content.classes.list`, `content.backgrounds.list`). The renderer never reads the files directly.
- **D-30:** JSON content is authored by the executor from the 2024 PHB PDFs in `Reference Documents/Player guides/`. Each race/class/background entry must include the full stat block text to support the full-stat-block display in the wizard (D-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: CHAR-01, CHAR-06, CHAR-07, CHAR-09, WORLD-02
- `.planning/ROADMAP.md` § "Phase 2: Character Domain & Live Sheet" — Goal, success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-secure-shell/01-CONTEXT.md` — Established patterns: tRPC, Drizzle, Zustand, modal pattern, shadcn/ui, theme direction

### Existing Code Integration Points
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Character Sheet `TabsContent` at line 137 is the placeholder this phase replaces
- `src/renderer/src/components/CreateCampaignModal.tsx` — Modal pattern to follow for the character creation wizard
- `src/main/db/schema.ts` — Existing campaigns table; Phase 2 adds characters table (and related resource tables)
- `src/main/trpc/routers/campaigns.ts` — tRPC router pattern to follow for new `characters` and `content` routers
- `src/renderer/src/components/ui/` — shadcn/ui Button, Dialog, Input, Label, Tabs components available

### Reference Documents (content source)
- `Reference Documents/Player guides/_OceanofPDF.com_Dungeons_and_Dragons_Players_Handbook_2024_-_Wizards_of_the_Coast.pdf` — Primary content source: races, classes, subclasses, backgrounds, equipment
- `Reference Documents/Player guides/_OceanofPDF.com_Tashas_Cauldron_of_Everything_-_Wizards_of_the_Coast.pdf` — Additional subclasses, optional class features, custom lineage
- `Reference Documents/Player guides/_OceanofPDF.com_Xanathars_Guide_to_Everything_-_Wizards_of_the_Coast.pdf` — Additional subclasses, racial feats, expanded options
- `Reference Documents/Character Sheets/MPMB's Character Record Sheet (v13.2.3) [Printer Friendly].pdf` — Reference for character sheet layout and field completeness
- `Reference Documents/Character Sheets/5E_CharacterSheet_Fillable.pdf` — Reference for standard field layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/src/components/ui/dialog.tsx` — shadcn Dialog component: use as the outer wrapper for the character creation wizard modal
- `src/renderer/src/components/ui/button.tsx` — shadcn Button: wizard Next/Back/Confirm navigation
- `src/renderer/src/components/ui/input.tsx` + `label.tsx` — Form fields for character name, backstory, manual ability score overrides
- `src/renderer/src/components/ui/tabs.tsx` — Already wired in CampaignViewScreen for the right panel tabs
- `src/renderer/src/components/CampaignCard.tsx` — Pattern for the cover image slot already present (cover image area is a placeholder today)

### Established Patterns
- **tRPC router in main:** Add `characters.ts` and `content.ts` routers following the pattern of `campaigns.ts` and `prefs.ts`
- **Drizzle schema:** Add `characters` table (and related: `character_resources`, `character_items`) to `src/main/db/schema.ts`; new Drizzle migration SQL file in `resources/migrations/`
- **Zustand store:** Add `useCharacterStore` following `usePanelSizeStore` and `useWindowStore` pattern for local sheet UI state (current conditions, pending edits)
- **TanStack Query:** Wrap all character tRPC calls with `useQuery`/`useMutation` following the `campaignQuery` pattern in `CampaignViewScreen.tsx`
- **Modal pattern:** Follow `CreateCampaignModal.tsx` for the wizard — Dialog wrapper, step state managed with `useState`, form fields with validation

### Integration Points
- **CampaignViewScreen.tsx line 137** — Replace the `TabsContent value="character-sheet"` placeholder with `<CharacterSheetTab campaignId={id} />`
- **CampaignCard.tsx** — Wire the cover image import to the existing placeholder slot
- **electron-builder config** — Add `races.json`, `classes.json`, `backgrounds.json`, `equipment.json` to the `asarUnpack` list alongside the existing migrations directory
- **src/main/trpc/router.ts** (or wherever routers are assembled) — Register new `characters` and `content` routers

</code_context>

<specifics>
## Specific Ideas

- **Theme:** "Subtle fantasy" dark UI with muted gold/amber accents — consistent with Phase 1 direction. Character sheet should feel like a digital version of the MPMB Printer Friendly sheet: clean, legible, organized.
- **Portrait fallback:** If no portrait is imported, show a fantasy-themed silhouette or class icon placeholder in the 80×80px header slot.
- **Condition badge colors:** Active conditions should use a warning amber/red tone to stand out from the dark background. Inactive conditions are muted.
- **Stepper controls:** +/- buttons should be compact and thumb-friendly. HP stepper should be visually prominent (most-used during play).
- **Reference Documents path:** `Reference Documents/Player guides/` — the executor must read the PDFs to author the JSON. Full stat blocks are required (D-06, D-30).

</specifics>

<deferred>
## Deferred Ideas

- **Spell list selection and casting** — Phase 5 (rules engine). Only spell slot counts are tracked in Phase 2.
- **Feat selection** — Phase 7.
- **Multiclassing** — Phase 7.
- **Advanced ability score methods** (4d6-drop-lowest, negative-trait point buy) — Phase 7.
- **Party/multi-character support** — Phase 7. The unique constraint on `campaign_id` must be dropped then.
- **PDF/text rules import** — Phase 7. The Reference Documents are used by the executor to author JSON, not importable by the user in Phase 2.
- **Equipment weight/encumbrance enforcement** — Phase 7 (D-30 stores weight as data but does not enforce limits).
- **Spell slots recovery (short/long rest)** — Phase 5.
- **XP-driven level-up flow** — Phase 5.

</deferred>

---

*Phase: 2-Character Domain & Live Sheet*
*Context gathered: 2026-05-24*
