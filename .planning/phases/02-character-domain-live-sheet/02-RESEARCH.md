# Phase 2: Character Domain & Live Sheet — Research

**Researched:** 2026-05-24
**Domain:** D&D 5e character domain model — Drizzle schema, tRPC routers, wizard modal pattern, image processing, JSON content delivery, Zustand store, TanStack Query mutations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Character creation is a modal wizard launched from the Character Sheet tab, using the `CreateCampaignModal` pattern.
- **D-02:** 6 wizard steps: Race → Class → Ability Scores → Background → Equipment → Review/Summary.
- **D-03:** One character per campaign (unique constraint on `campaign_id`).
- **D-04:** No character = wizard auto-launches; cannot dismiss without completing or cancelling.
- **D-05:** Creation-only wizard. Post-creation edits are inline on the sheet.
- **D-06:** Full stat blocks shown for each selectable option in the wizard.
- **D-07:** Content sourced from 2024 PHB, Tasha's, and Xanathar's (Reference Documents). Executor reads PDFs and authors JSON by hand.
- **D-08:** All species/races from the 2024 PHB content with full traits.
- **D-09:** Level-1 subclass picker shown within Class step for Cleric, Sorcerer, and Warlock only.
- **D-10:** Standard array (15/14/13/12/10/8) with manual per-stat override. No rolling UI.
- **D-11:** All backgrounds from PHB/Tasha's/Xanathar's; language picker for free-choice slots.
- **D-12:** Equipment step uses 2–3 predefined starting equipment packages per class.
- **D-13:** Character name required + optional backstory text area.
- **D-14:** Required fields block the Next button. No skipping steps.
- **D-15:** On wizard confirm, auto-calculate: HP = hit die + CON mod, AC = 10 + DEX mod (or armor-based), proficiency bonus = +2, spell slots by class/level, racial ASI bonuses, species-granted level-1 feats, background skill proficiencies, background tool proficiencies.
- **D-16:** Player manually selects class-granted skill proficiency picks and saving throw proficiency choices in Ability Scores step.
- **D-17:** Full character sheet renders immediately after wizard closes.
- **D-18:** Single scrollable column. 10 sections top-to-bottom (see CONTEXT.md).
- **D-19:** Ability score fields editable; live-play resources use stepper +/- controls; static fields read-only.
- **D-20:** HP/spell slots/currency/conditions/death saves/inspiration/attunement persist immediately on every press. Ability score edits persist on field blur. No debounce for combat-critical values.
- **D-21:** 14 standard conditions as toggleable badges.
- **D-22:** 3+3 death save checkboxes, always visible.
- **D-23:** Spell slots per slot level (1st–9th), only levels the class has. Tracking only.
- **D-24:** Images copied to `{userData}/images/{campaignId}/`; DB stores relative path.
- **D-25:** Accepted formats: PNG, JPG/JPEG, WEBP.
- **D-26:** Resize to max 1024px on longest side in main process before copying.
- **D-27:** Portrait imported via click on portrait area on character sheet header; cover image via CampaignCard or campaign view header.
- **D-28:** Content JSON files in `resources/` (asarUnpack); files: `races.json`, `classes.json`, `backgrounds.json`, `equipment.json`, `spells-by-class.json`.
- **D-29:** Content loaded in main process at startup; served via a new `content` tRPC router.
- **D-30:** Executor authors JSON from 2024 PHB PDFs. Full stat block text required per entry.

### Claude's Discretion

- Portrait fallback image (class icon or fantasy silhouette)
- Specific JSON schema structure for race/class/background/equipment content files
- Exact stepper +/- control component layout
- Which wizard step captures character name (first step or dedicated Name step)
- Exact condition badge visual design (colors, shape)

### Deferred Ideas (OUT OF SCOPE)

- Spell list selection and casting (Phase 5)
- Feat selection UI (Phase 7)
- Multiclassing (Phase 7)
- Advanced ability score methods — 4d6-drop, negative-trait point buy (Phase 7)
- Party/multi-character support (Phase 7)
- PDF import for user-importable content (Phase 7)
- Equipment encumbrance enforcement (Phase 7)
- Spell slot recovery on rest (Phase 5)
- XP-driven level-up flow (Phase 5)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAR-01 | User can create a character with step-by-step builder covering race, class, background, and equipment | Wizard modal pattern, content tRPC router, Drizzle schema, auto-calculation logic |
| CHAR-06 | User can import a local image file as their character portrait | Electron dialog API + jimp resize + fs.copyFile + tRPC mutation pattern |
| CHAR-07 | User can view and update HP, spell slots, death saves, XP, currency, and conditions live | Zero-debounce tRPC mutations, Zustand optimistic state, character sheet component tree |
| CHAR-09 | User can track attuned magic items (attunement limit displayed, not enforced) | character_items table with `isAttuned` column, attunement count aggregation |
| WORLD-02 | User can set a campaign cover image and character portrait by importing local image files | Same image import flow as CHAR-06, cover path stored on campaigns table |
</phase_requirements>

---

## Summary

Phase 2 builds the deepest domain model in the app — the character entity — across a 6-step creation wizard and a 10-section live-play sheet. Every subsystem in Phase 1 (tRPC, Drizzle, Zustand, TanStack Query) is now exercised at full scale.

The schema adds three tables to the one established in Phase 1: `characters` (core stat block), `character_resources` (live-play mutable state — HP, spell slots, currency, conditions, death saves, inspiration), and `character_items` (equipment list with attunement). A unique index on `campaign_id` enforces the one-character-per-campaign constraint from D-03. The wizard confirmation event drives a single `db.transaction()` that atomically inserts all three rows.

Image import — portrait and cover — follows the standard Electron pattern: a tRPC mutation triggers `dialog.showOpenDialog` in the main process, reads the selected file with jimp v1, resizes to max 1024px maintaining aspect ratio, writes the output to `{userData}/images/{campaignId}/`, and stores the relative path in SQLite. WEBP support requires adding `@jimp/wasm-webp` (D-25) because jimp's default build does not include WEBP. Electron's built-in `nativeImage` is an alternative for PNG/JPG but lacks WEBP support and has no file-write API, making jimp the correct choice.

Content delivery (races, classes, backgrounds, equipment, spells-by-class) follows the established `resources/migrations/` pattern: JSON files sit in `resources/` under asarUnpack, the `extraResources` key in `electron-builder.yml` copies them to the packaged build's `resources/` directory, and the main process reads them once at startup into a module-level cache served by a new `content` tRPC router.

**Primary recommendation:** Follow the campaignsRepo → tRPC router → TanStack Query pattern exactly. New patterns introduced in Phase 2: (1) the wizard uses `useState` step tracking (no form library needed at this complexity level), (2) the character sheet uses a single wide `characters.getByIdWithResources` tRPC query that JOINs all three tables, and (3) live-resource mutations fire immediately with no debounce, relying on `useMutation` + optimistic `queryClient.setQueryData` to prevent visible lag.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Character creation wizard | Renderer (React modal) | Main (tRPC mutation + auto-calc) | UI state (current step, form values) lives in renderer; DB write + calculations are main-process-only |
| Character sheet display | Renderer (React components) | Main (tRPC query) | Presentation is renderer; data access via tRPC query |
| Live resource mutation (HP, slots, etc.) | Renderer (useMutation + optimistic) | Main (tRPC mutation → SQLite) | Zero-debounce mutations require optimistic UI in renderer; persistence is main |
| Content delivery (races, classes, etc.) | Main (in-memory cache) | Renderer (TanStack Query) | Files read from disk once in main; served as query over IPC |
| Image import | Main (dialog + jimp + fs) | Renderer (triggers via mutation) | All file I/O must be main-process; renderer only triggers and displays |
| Image display | Renderer (img src) | — | CSP allows `img-src 'self' data: blob:` — paths served via custom protocol or `file://` prefix |
| DB schema + migrations | Main (Drizzle + better-sqlite3) | — | SQLite is main-process-only by established Phase 1 pattern |

---

## Standard Stack

### Core (all already in package.json — no new installs for core logic)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.36.0 | Schema definition + typed queries | Established in Phase 1 |
| better-sqlite3 | ^12.10.0 | Synchronous SQLite driver | Established in Phase 1 |
| @trpc/server + @trpc/client | ^10 | Type-safe IPC | Established in Phase 1 |
| electron-trpc | 0.7.1 | tRPC over Electron IPC | Established in Phase 1 |
| @tanstack/react-query | ^5.100.11 | Async state for IPC calls | Established in Phase 1 |
| zustand | ^5.0.13 | UI state | Established in Phase 1 |
| zod | ^3.24.0 | Input validation on IPC boundary | Established in Phase 1 |

### New Dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jimp | ^1.6.1 | Image resize before file copy (PNG/JPG) | Pure-JS, no native rebuild; already a transitive dep via electron-icon-builder; well-established (github.com/jimp-dev/jimp) |
| @jimp/wasm-webp | ^1.6.1 | WEBP read/write support for jimp | Required by D-25 (accept WEBP); official jimp WASM plugin; ESM-only — see pitfall below |

### Optional / Discretion

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.x | Form validation in wizard steps | Only if wizard step validation becomes complex; D-01 says follow CreateCampaignModal pattern (useState) — start without it |
| @hookform/resolvers | 5.x | Zod resolver for react-hook-form | Pair with react-hook-form only if adopted |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jimp | sharp | sharp is faster + supports WEBP natively, but requires native rebuild against Electron ABI 145 with `@electron/rebuild`. jimp is pure-JS, no rebuild needed, already transitive in the project. For max-1024px resize on user images (rare operation), jimp performance is sufficient. |
| jimp | Electron nativeImage | nativeImage is built-in, zero deps, but: no WEBP support (D-25 requires WEBP), no file-write API (returns Buffer only), output format limited to PNG/JPEG. Disqualified by WEBP requirement. |
| jimp | canvas (node-canvas) | node-canvas is a native module requiring rebuild and has broader WEBP support, but adds significant install complexity. Overkill. |

**Installation (new packages only):**
```bash
npm install jimp @jimp/wasm-webp
```

**Version verification (performed during research):**
- jimp: `1.6.1` (npm registry, 2025-05-09)
- @jimp/wasm-webp: `1.6.1` (npm registry, 2025-05-09)

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| jimp | npm | ~10 yrs | github.com/jimp-dev/jimp | [OK] | Approved |
| @jimp/wasm-webp | npm | ~1 yr (added v1.2.0, Sep 2024) | github.com/jimp-dev/jimp (monorepo) | [OK] | Approved |
| react-hook-form | npm | ~6 yrs | github.com/react-hook-form/react-hook-form | [OK] | Approved (discretion) |
| @hookform/resolvers | npm | ~5 yrs | github.com/react-hook-form/resolvers | [OK] | Approved (discretion) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Neither jimp nor @jimp/wasm-webp have a `postinstall` or `install` script. No network calls at install time.

---

## Architecture Patterns

### System Architecture Diagram

```
Renderer (React)                          Main Process (Node)
─────────────────────────────────         ──────────────────────────────────
CampaignViewScreen                        
  └─ CharacterSheetTab                    
       ├─ useQuery(characters.get)  ──────→ charactersRouter.get
       │                                       └─ db.select().from(characters)
       │                                          .leftJoin(character_resources)
       │                                          .leftJoin(character_items)
       │                            ←──────  [CharacterWithResources | null]
       │
       ├─ [null] → CreateCharacterWizard
       │    ├─ Step state (useState)
       │    ├─ useQuery(content.races.list)  ──→ contentRouter  → races.json cache
       │    ├─ useQuery(content.classes.list) ─→ contentRouter  → classes.json cache
       │    ├─ useQuery(content.backgrounds) ──→ contentRouter  → backgrounds.json cache
       │    ├─ useQuery(content.equipment)   ──→ contentRouter  → equipment.json cache
       │    └─ Confirm → useMutation(characters.create)
       │                   └─ auto-calculate HP/AC/slots/etc.
       │                   └─ db.transaction()
       │                         ├─ insert(characters)
       │                         ├─ insert(character_resources)
       │                         └─ insert(character_items) × N
       │
       ├─ [loaded] → CharacterSheet sections
       │    ├─ useMutation(characters.updateResource)  ──→ db.update(character_resources)
       │    ├─ useMutation(characters.updateAbilityScore) → db.update(characters)
       │    ├─ useMutation(characters.toggleCondition)  ──→ db.update(character_resources)
       │    └─ useMutation(characters.toggleItemAttuned) → db.update(character_items)
       │
       └─ Portrait click → useMutation(characters.importImage)
                              └─ dialog.showOpenDialog (main)
                              └─ jimp.read() → resize → write to userData/images/
                              └─ db.update(characters, { portraitPath })
```

### Recommended Project Structure (Phase 2 additions)

```
src/
├── main/
│   ├── db/
│   │   ├── schema.ts               # + characters, character_resources, character_items
│   │   ├── charactersRepo.ts       # new — DB access for characters domain
│   │   └── contentLoader.ts        # new — load+cache JSON files at startup
│   ├── trpc/
│   │   ├── router.ts               # + charactersRouter, contentRouter
│   │   └── routers/
│   │       ├── characters.ts       # new — character CRUD + resource mutations
│   │       └── content.ts          # new — races/classes/backgrounds/equipment list queries
│   └── imageService.ts             # new — dialog, resize, copy logic
│
├── renderer/src/
│   ├── screens/
│   │   └── CampaignViewScreen.tsx  # line 137: replace placeholder with <CharacterSheetTab>
│   ├── components/
│   │   ├── CharacterSheetTab.tsx   # new — top-level orchestrator
│   │   ├── CreateCharacterWizard.tsx # new — 6-step modal wizard
│   │   ├── wizard/
│   │   │   ├── StepRace.tsx
│   │   │   ├── StepClass.tsx
│   │   │   ├── StepAbilityScores.tsx
│   │   │   ├── StepBackground.tsx
│   │   │   ├── StepEquipment.tsx
│   │   │   └── StepReview.tsx
│   │   ├── sheet/
│   │   │   ├── SheetHeader.tsx           # portrait + name + race/class/level
│   │   │   ├── AbilityScoresSection.tsx
│   │   │   ├── SavingThrowsSection.tsx
│   │   │   ├── SkillsSection.tsx
│   │   │   ├── CombatStatsSection.tsx
│   │   │   ├── ResourcesSection.tsx      # HP, spell slots, inspiration, death saves, conditions
│   │   │   ├── CurrencySection.tsx
│   │   │   ├── EquipmentSection.tsx
│   │   │   ├── ProficienciesSection.tsx
│   │   │   ├── TraitsSection.tsx         # collapsible
│   │   │   └── Stepper.tsx               # reusable +/- stepper control
│   │   └── ui/                            # existing shadcn components + new additions
│   └── stores/
│       └── characterStore.ts              # new — wizard draft state, pending sheet edits

resources/
├── migrations/
│   ├── 0000_absent_thunderball.sql  # existing
│   └── 0001_characters.sql          # new — characters + character_resources + character_items
├── races.json                        # new — authored from 2024 PHB
├── classes.json                      # new — authored from 2024 PHB + Tasha's + Xanathar's
├── backgrounds.json                  # new — authored from 2024 PHB + Tasha's + Xanathar's
├── equipment.json                    # new — authored from 2024 PHB
└── spells-by-class.json              # new — slot counts per class/level
```

---

## Pattern 1: Drizzle Schema — Characters Domain

**What:** Three new tables with foreign keys to `campaigns`. `character_resources` holds all mutable play-state. `character_items` is a child list with attunement flag.

[VERIFIED: drizzle-orm/sqlite-core API confirmed against Drizzle ORM official docs]

```typescript
// src/main/db/schema.ts additions

import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  race: text('race').notNull(),
  subrace: text('subrace'),              // null for races without subraces
  class: text('class').notNull(),
  subclass: text('subclass'),            // null unless level-1 subclass class (Cleric/Sorc/Warlock)
  background: text('background').notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  backstory: text('backstory'),
  // Ability scores (base + racial bonuses already applied)
  strength: integer('strength').notNull(),
  dexterity: integer('dexterity').notNull(),
  constitution: integer('constitution').notNull(),
  intelligence: integer('intelligence').notNull(),
  wisdom: integer('wisdom').notNull(),
  charisma: integer('charisma').notNull(),
  // Proficiency selections (JSON arrays)
  savingThrowProficiencies: text('saving_throw_proficiencies').notNull().default('[]'), // JSON: ["strength","dexterity"]
  skillProficiencies: text('skill_proficiencies').notNull().default('[]'),              // JSON: ["athletics","stealth"]
  skillExpertise: text('skill_expertise').notNull().default('[]'),                      // JSON: ["stealth"]
  // Auto-calculated stats (re-derived on demand, stored for display)
  ac: integer('ac').notNull(),
  initiativeBonus: integer('initiative_bonus').notNull(),
  speed: integer('speed').notNull(),
  proficiencyBonus: integer('proficiency_bonus').notNull().default(2),
  // Language and tool proficiencies (JSON arrays of strings)
  languages: text('languages').notNull().default('[]'),
  toolProficiencies: text('tool_proficiencies').notNull().default('[]'),
  armorProficiencies: text('armor_proficiencies').notNull().default('[]'),
  weaponProficiencies: text('weapon_proficiencies').notNull().default('[]'),
  // Traits text (denormalized from content JSON for fast display)
  racialTraitsText: text('racial_traits_text'),   // rendered markdown/text block
  classFeatureText: text('class_feature_text'),   // level-1 class features text
  backgroundFeatureText: text('background_feature_text'),
  // Equipment package chosen (reference for display, actual items in character_items)
  equipmentPackage: text('equipment_package'),
  // Images
  portraitPath: text('portrait_path'),  // relative path under userData/images/{campaignId}/
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
}, (table) => ({
  // D-03: one character per campaign in Phase 2
  uniqueCampaign: unique().on(table.campaignId),
}))

export const characterResources = sqliteTable('character_resources', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  // HP
  hpCurrent: integer('hp_current').notNull(),
  hpMax: integer('hp_max').notNull(),
  hpTemp: integer('hp_temp').notNull().default(0),
  // Spell slots: stored as JSON per slot level { "1": {used:0,max:2}, "2": {...}, ... }
  // Only levels the class has are present in the JSON object
  spellSlots: text('spell_slots').notNull().default('{}'),
  // Currency
  cp: integer('cp').notNull().default(0),
  sp: integer('sp').notNull().default(0),
  ep: integer('ep').notNull().default(0),
  gp: integer('gp').notNull().default(0),
  pp: integer('pp').notNull().default(0),
  // Conditions: JSON array of active condition strings
  // e.g. ["poisoned", "prone"]
  conditions: text('conditions').notNull().default('[]'),
  // Death saves
  deathSaveSuccesses: integer('death_save_successes').notNull().default(0),
  deathSaveFailures: integer('death_save_failures').notNull().default(0),
  // Inspiration
  hasInspiration: integer('has_inspiration', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const characterItems = sqliteTable('character_items', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  weight: real('weight').notNull().default(0),     // lbs — stored but not enforced until Phase 7
  isAttuned: integer('is_attuned', { mode: 'boolean' }).notNull().default(false),
  isMagic: integer('is_magic', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})
```

**Key design decisions:**
- `savingThrowProficiencies`, `skillProficiencies`, `conditions`, `spellSlots` are JSON columns (SQLite text). This is pragmatic: these are small arrays read/written atomically, not queried by individual element in Phase 2. Phase 5 does not change this. [ASSUMED: JSON column approach is sufficient — no filtering by individual condition/skill needed until Phase 6+]
- `spellSlots` stores `{"1": {"used": 0, "max": 2}, "3": {"used": 1, "max": 3}}` — a sparse map of only the levels the class has. This matches D-23 (display only levels the class has).
- `portraitPath` is on `characters` (not `character_resources`) because it is static character identity, not live-play state.
- Cover image path goes on the existing `campaigns` table — add `coverImagePath text` column.

---

## Pattern 2: Drizzle Transaction — Atomic Character Creation

**What:** The wizard confirmation writes all three tables atomically. [VERIFIED: Drizzle ORM transactions docs]

```typescript
// src/main/db/charactersRepo.ts

import { db } from './index'
import { characters, characterResources, characterItems } from './schema'
import { randomUUID } from 'node:crypto'

export const charactersRepo = {
  createWithResources(input: CreateCharacterInput): CharacterWithResources {
    const charId = randomUUID()
    const resId = randomUUID()

    db.transaction((tx) => {
      tx.insert(characters).values({
        id: charId,
        campaignId: input.campaignId,
        name: input.name,
        // ... all fields
      }).run()

      tx.insert(characterResources).values({
        id: resId,
        characterId: charId,
        hpCurrent: input.calculatedHp,
        hpMax: input.calculatedHp,
        spellSlots: JSON.stringify(input.spellSlots),
        gp: input.startingGold,
        // ... other defaults
      }).run()

      for (const item of input.startingItems) {
        tx.insert(characterItems).values({
          id: randomUUID(),
          characterId: charId,
          name: item.name,
          quantity: item.quantity,
          weight: item.weight ?? 0,
        }).run()
      }
    })

    return this.getWithResources(charId)!
  },

  getWithResources(characterId: string): CharacterWithResources | undefined {
    // Single query with explicit JOINs, assemble in-memory
    const char = db.select().from(characters).where(eq(characters.id, characterId)).get()
    if (!char) return undefined
    const res = db.select().from(characterResources)
      .where(eq(characterResources.characterId, characterId)).get()
    const items = db.select().from(characterItems)
      .where(eq(characterItems.characterId, characterId))
      .orderBy(asc(characterItems.sortOrder))
      .all()
    return { ...char, resources: res!, items }
  },

  getByCampaignId(campaignId: string): CharacterWithResources | undefined {
    const char = db.select().from(characters)
      .where(eq(characters.campaignId, campaignId)).get()
    if (!char) return undefined
    return this.getWithResources(char.id)
  },
}
```

**Note:** better-sqlite3's synchronous API means `db.transaction()` takes a synchronous callback (not async). This is correct — do NOT use `async (tx) =>` with better-sqlite3. [VERIFIED: better-sqlite3 docs — transactions are synchronous]

---

## Pattern 3: Content Router — JSON Cache

**What:** JSON files loaded once at startup; served through tRPC with no disk I/O per query. [ASSUMED: module-level singleton cache is sufficient for read-only content data]

```typescript
// src/main/db/contentLoader.ts

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import type { Race, DndClass, Background, EquipmentPackage, SpellSlotsByClass } from './contentTypes'

// Matches the established migration path resolution pattern from migrate.ts
function resourcesPath(): string {
  return app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '../../resources')
}

let _content: ContentCache | null = null

interface ContentCache {
  races: Race[]
  classes: DndClass[]
  backgrounds: Background[]
  equipment: Record<string, EquipmentPackage[]>  // keyed by class name
  spellSlotsByClass: SpellSlotsByClass
}

export function loadContent(): ContentCache {
  if (_content) return _content
  const rp = resourcesPath()
  _content = {
    races: JSON.parse(fs.readFileSync(path.join(rp, 'races.json'), 'utf-8')),
    classes: JSON.parse(fs.readFileSync(path.join(rp, 'classes.json'), 'utf-8')),
    backgrounds: JSON.parse(fs.readFileSync(path.join(rp, 'backgrounds.json'), 'utf-8')),
    equipment: JSON.parse(fs.readFileSync(path.join(rp, 'equipment.json'), 'utf-8')),
    spellSlotsByClass: JSON.parse(fs.readFileSync(path.join(rp, 'spells-by-class.json'), 'utf-8')),
  }
  return _content
}
```

```typescript
// src/main/trpc/routers/content.ts

export const contentRouter = t.router({
  races: t.router({
    list: t.procedure.query(() => loadContent().races),
  }),
  classes: t.router({
    list: t.procedure.query(() => loadContent().classes),
  }),
  backgrounds: t.router({
    list: t.procedure.query(() => loadContent().backgrounds),
  }),
  equipment: t.router({
    listForClass: t.procedure
      .input(z.object({ className: z.string() }))
      .query(({ input }) => loadContent().equipment[input.className] ?? []),
  }),
  spellSlots: t.router({
    forClass: t.procedure
      .input(z.object({ className: z.string() }))
      .query(({ input }) => loadContent().spellSlotsByClass[input.className] ?? null),
  }),
})
```

**electron-builder.yml additions needed:**

```yaml
asarUnpack:
  - "**/node_modules/better-sqlite3/**"
  - "resources/migrations/**"
  - "resources/*.json"        # ADD: content JSON files

extraResources:
  - from: resources/migrations
    to: migrations
    filter:
      - "**/*"
  - from: resources           # ADD: content JSON at resources root
    to: .
    filter:
      - "*.json"
```

---

## Pattern 4: Image Import — Main Process Handler

**What:** tRPC mutation triggers dialog, jimp resize, fs copy. All file I/O in main process.

[VERIFIED: Electron dialog.showOpenDialog API — official Electron docs; VERIFIED: jimp resize API — official jimp docs; ASSUMED: @jimp/wasm-webp ESM import works in Electron main process with electron-vite's bundling]

```typescript
// src/main/imageService.ts

import { app, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Jimp } from 'jimp'
import log from 'electron-log'

const MAX_DIMENSION = 1024
const ACCEPTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

export async function importImage(campaignId: string): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Image',
    filters: [{ name: 'Images', extensions: ACCEPTED_EXTENSIONS }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return null

  const sourcePath = filePaths[0]
  const ext = path.extname(sourcePath).slice(1).toLowerCase()

  const image = await Jimp.read(sourcePath)
  const { width, height } = image.bitmap

  // Resize only if larger than 1024px on longest side
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      image.resize({ w: MAX_DIMENSION })   // jimp v1 preserves aspect ratio when only one dim given
    } else {
      image.resize({ h: MAX_DIMENSION })
    }
  }

  const destDir = path.join(app.getPath('userData'), 'images', campaignId)
  await fs.mkdir(destDir, { recursive: true })

  const fileName = `${Date.now()}_${path.basename(sourcePath)}`
  const destPath = path.join(destDir, fileName)

  // Write as original format (jimp infers from extension)
  await image.write(destPath as `${string}.${string}`)

  // Return relative path stored in DB
  return path.join('images', campaignId, fileName)
}
```

**WEBP note:** jimp v1 default install does NOT decode WEBP. To support WEBP, create a custom Jimp instance:

```typescript
// src/main/imageService.ts — WEBP-enabled Jimp

import { createJimp } from '@jimp/core'
import { defaultFormats, defaultPlugins } from 'jimp'
import { webp } from '@jimp/wasm-webp'

const JimpWithWebp = createJimp({
  formats: [...defaultFormats, webp],
  plugins: defaultPlugins,
})

// Then use JimpWithWebp.read() instead of Jimp.read()
```

**Important:** `@jimp/wasm-webp` is ESM-only. The main process in electron-vite compiles to CJS by default. Options:
1. Use dynamic `import('@jimp/wasm-webp')` at the call site (works in both CJS and ESM contexts)
2. Or configure electron-vite main to use ESM output (more invasive — do not do this in Phase 2)

**Recommended approach:** Use dynamic import wrapped in an async init function called at startup.

**Image display in renderer:** The CSP already allows `img-src 'self' data: blob:`. Stored paths like `images/camp123/portrait.jpg` are relative to userData. The renderer cannot access the filesystem directly (contextIsolation). Two options:
1. Return the full absolute path from tRPC and use `<img src="file:///...">` — works but CSP may block `file://` in production builds (current CSP does not list `file:`)
2. Add a custom protocol (`app://`) that serves files from userData — cleaner, already partially supported (CSP lists `app://`)
3. Return the image as a base64 data URL from a tRPC query — simplest, no CSP changes needed

[ASSUMED: base64 data URL approach is sufficient for 80×80px portraits and cover thumbnails — images are resized to ≤1024px so the payload is manageable over IPC]

**Recommended: Option 3 (base64 data URL)** for Phase 2. Add a `characters.getPortraitDataUrl` tRPC query that reads the file and returns `data:image/png;base64,...`. No protocol setup, no CSP changes. Revisit if performance is an issue.

---

## Pattern 5: Zero-Debounce Mutation with Optimistic Update

**What:** HP/currency/conditions mutate immediately. TanStack Query optimistic update prevents visible lag during the IPC round-trip. [ASSUMED: optimistic update pattern is necessary — synchronous SQLite is fast (~1ms), but IPC latency means the UI would flash without it]

```typescript
// ResourcesSection.tsx — HP stepper example

const queryClient = useQueryClient()
const QUERY_KEY = ['characters', 'getByIdWithResources', campaignId]

const hpMutation = useMutation({
  mutationFn: (delta: number) =>
    trpc.characters.updateHp.mutate({ campaignId, delta }),
  onMutate: async (delta) => {
    // Cancel any in-flight refetch to avoid overwriting optimistic state
    await queryClient.cancelQueries({ queryKey: QUERY_KEY })
    const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
    if (prev) {
      queryClient.setQueryData(QUERY_KEY, {
        ...prev,
        resources: {
          ...prev.resources,
          hpCurrent: Math.max(0, Math.min(prev.resources.hpMax, prev.resources.hpCurrent + delta)),
        },
      })
    }
    return { prev }
  },
  onError: (_err, _delta, context) => {
    // Roll back on error
    if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  },
})
```

**Race condition risk with rapid +/- presses:** Each press fires a separate mutation. The optimistic update applies immediately in-memory, and `cancelQueries` prevents stale refetches from overwriting. The DB writes are serialized by better-sqlite3's synchronous model. Net result: the final DB value equals the sum of all deltas. This is safe. [ASSUMED: delta-based mutations (not absolute value) are the correct design — "add 1 to HP" not "set HP to X" — prevents last-write-wins race conditions]

---

## Pattern 6: Wizard State — useState Step Tracking

**What:** Follow `CreateCampaignModal.tsx` pattern (D-01). Use `useState` for step index and form values. No form library needed for this complexity level.

```typescript
// CreateCharacterWizard.tsx

const TOTAL_STEPS = 6
const STEP_NAMES = ['Race', 'Class', 'Ability Scores', 'Background', 'Equipment', 'Review']

interface WizardState {
  step: number           // 0-5
  selectedRace: Race | null
  selectedSubrace: string | null
  selectedClass: DndClass | null
  selectedSubclass: string | null      // only for Cleric/Sorcerer/Warlock
  abilityScores: AbilityScoreAssignment  // { str: 15, dex: 14, ... }
  selectedSkillProficiencies: string[]   // class-granted picks (D-16)
  selectedSaveProficiencies: string[]    // class saving throw picks (D-16)
  selectedBackground: Background | null
  selectedLanguage: string | null        // background free-choice language
  selectedEquipmentPackage: EquipmentPackageChoice | null
  characterName: string
  backstory: string
}
```

**Where does name get collected?** D-13 says "first or dedicated Name step." Since there are 6 steps and the Review step shows a summary, the cleanest approach is to collect name in Step 1 (Race step) as a small field at the top, so it appears in the Review step. The Review step is read-only confirmation. [Claude's Discretion]

**Step validation (D-14):** Each step component exposes `isValid: boolean`. The wizard's Next button is `disabled={!isStepValid}`. Example: Race step is valid when `selectedRace !== null && characterName.trim().length >= 1`.

---

## Pattern 7: Auto-Calculation on Confirm

**What:** Domain utility module — pure functions, no DB access. Called in the tRPC mutation handler before the transaction.

```typescript
// src/main/characters/calculations.ts

export function calcAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function calcHP(hitDie: number, constitutionScore: number): number {
  return hitDie + calcAbilityModifier(constitutionScore)
}

export function calcAC(dexterityScore: number, armorBase?: number): number {
  if (armorBase !== undefined) return armorBase + calcAbilityModifier(dexterityScore)
  return 10 + calcAbilityModifier(dexterityScore)   // unarmored default
}

export function calcInitiativeBonus(dexterityScore: number): number {
  return calcAbilityModifier(dexterityScore)
}

export function buildSpellSlots(
  className: string,
  level: number,
  spellSlotsByClass: SpellSlotsByClass,
): Record<string, { used: number; max: number }> {
  const table = spellSlotsByClass[className]?.[level]
  if (!table) return {}
  return Object.fromEntries(
    Object.entries(table).map(([slotLevel, max]) => [slotLevel, { used: 0, max }])
  )
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resize | Custom pixel manipulation | jimp `.resize({ w: MAX })` | jimp handles all JPEG/PNG subformat variants, progressive scan, color profiles, EXIF stripping — hand-roll misses edge cases |
| Image WEBP decode | Canvas or native bindings | `@jimp/wasm-webp` plugin | WEBP has lossless/lossy variants, alpha channel, ICC profiles — WASM codec handles all correctly |
| File dialog | Direct file path input | `dialog.showOpenDialog` | OS-native dialog handles permissions, sandbox, file picker UX correctly cross-platform |
| Drizzle transactions | Manual BEGIN/COMMIT in SQL | `db.transaction(tx => {...})` | Drizzle handles savepoints, rollback on thrown exceptions, nested transactions |
| UUID generation | Custom ID generation | `randomUUID()` from `node:crypto` | Already used in campaignsRepo — consistent pattern |
| Spell slot count tables | Hard-coded arrays | `spells-by-class.json` | Data changes between editions; keep out of code |
| Ability score modifier formula | Anything other than `Math.floor((score - 10) / 2)` | The formula | This is the standard 5e formula — no library needed, but also never inline it |

---

## Common Pitfalls

### Pitfall 1: better-sqlite3 transaction is synchronous — do NOT use async
**What goes wrong:** `db.transaction(async (tx) => {...})` silently runs as a no-op transaction callback — the Promise is returned but SQLite completes the transaction before the async operations resolve.
**Why it happens:** better-sqlite3 calls the callback synchronously and commits when it returns. An async callback returns a Promise immediately, which SQLite treats as success.
**How to avoid:** All repo methods are synchronous. All DB work inside `db.transaction()` must be synchronous too. The tRPC mutation wraps the synchronous repo call — the `async` is in the tRPC handler, not in the DB layer.
**Warning signs:** Transaction completes but only the first insert appears in the DB.

### Pitfall 2: ASAR + extraResources path resolution
**What goes wrong:** `__dirname` in the packaged build points to `app.asar/out/main/`, not to `resources/`. `fs.readFileSync` fails with ENOENT.
**Why it happens:** electron-builder packs `out/` into ASAR; `resources/` goes to `process.resourcesPath` via `extraResources`.
**How to avoid:** Use the same two-branch pattern as `migrate.ts`:
```typescript
const rp = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../resources')
```
The content JSON files must be in `extraResources` in `electron-builder.yml` AND in `asarUnpack`.
**Warning signs:** App works in `npm run dev` but crashes after `npm run build`.

### Pitfall 3: @jimp/wasm-webp is ESM-only in a CJS main process
**What goes wrong:** `require('@jimp/wasm-webp')` throws `ERR_REQUIRE_ESM`. The electron-vite main build outputs CJS by default.
**Why it happens:** The package uses ES module syntax throughout and does not provide a CJS build.
**How to avoid:** Use dynamic `import()` at the point of use:
```typescript
async function getJimpWithWebp() {
  const { webp } = await import('@jimp/wasm-webp')
  const { createJimp } = await import('@jimp/core')
  const { defaultFormats, defaultPlugins } = await import('jimp')
  return createJimp({ formats: [...defaultFormats, webp], plugins: defaultPlugins })
}
```
**Warning signs:** Works in dev (Vite handles ESM), crashes in packaged build.

### Pitfall 4: Image display blocked by CSP — `file://` src in renderer
**What goes wrong:** `<img src="file:///C:/Users/.../userData/images/...">` renders blank in production (CSP does not allow `file://` in renderer).
**Why it happens:** The current CSP has `img-src 'self' data: blob:` — `file://` is not in the list.
**How to avoid:** Use base64 data URL pattern (tRPC query reads file, returns `data:image/...;base64,...`) or register a custom protocol. Do NOT modify the CSP to allow `file://` globally — that weakens security.
**Warning signs:** Portrait works in `npm run dev` (dev server relaxes some CSP enforcement) but is blank in packaged build.

### Pitfall 5: Rapid stepper presses + absolute-value mutations = race condition
**What goes wrong:** If the mutation writes `SET hpCurrent = 15` (absolute value) and two mutations fire 20ms apart, the second overwrites the first regardless of order, potentially causing a net delta of only 1 when user pressed twice.
**Why it happens:** IPC round-trip reordering.
**How to avoid:** Use delta-based mutations: `UPDATE character_resources SET hp_current = MAX(0, hp_current + ?) WHERE id = ?`. The DB applies each delta atomically in arrival order, so the sum is always correct.
**Warning signs:** HP "sticks" or skips values when buttons are pressed quickly.

### Pitfall 6: Drizzle migration numbering — must be sequential
**What goes wrong:** `drizzle-kit generate` creates the next migration with its own timestamp-based name. If migrations are manually created out of sequence, the journal file becomes inconsistent and `migrate()` throws.
**Why it happens:** Drizzle's migrator reads `meta/_journal.json` and applies all migrations in `idx` order.
**How to avoid:** Always use `npm run db:generate` to produce new migration files. Never manually rename or renumber migration files. Phase 2 migration will be `0001_<random_name>.sql`.
**Warning signs:** `migrate()` throws on startup after adding new schema.

### Pitfall 7: Unique constraint on campaign_id — error message must reach the UI
**What goes wrong:** If the wizard is triggered twice somehow (rapid double-click launch), the second `characters.create` throws a SQLite unique constraint error. The tRPC handler throws, the useMutation `onError` fires, but if there is no error state in the wizard, the user sees nothing.
**Why it happens:** No error handling in wizard confirmation step.
**How to avoid:** The wizard's `onError` handler must surface a human-readable error ("A character already exists for this campaign. Reload the page."). The tRPC mutation should catch the SQLite error and rethrow with a typed TRPCError.

### Pitfall 8: spellSlots JSON column — must parse before use in renderer
**What goes wrong:** `character.resources.spellSlots` arrives as a string `'{"1":{"used":0,"max":2}}'` over tRPC with superjson. If superjson doesn't auto-parse nested JSON strings, the renderer gets a raw string.
**Why it happens:** JSON columns in better-sqlite3 are stored as TEXT. Drizzle doesn't know they're JSON — it returns them as strings. superjson serializes strings as strings.
**How to avoid:** Parse explicitly in the repo layer before returning: `spellSlots: JSON.parse(row.spellSlots) as SpellSlotMap`. Return a typed object, never a raw string. Apply the same pattern to `conditions`, `savingThrowProficiencies`, `skillProficiencies`, etc.
**Warning signs:** `typeof character.resources.spellSlots === 'string'` in the renderer.

### Pitfall 9: tRPC v10 router assembly — createCaller signature
**What goes wrong:** Tests that use `createCallerFactory` fail with "createCallerFactory is not a function".
**Why it happens:** `createCallerFactory` is tRPC v11 API. This project pins v10. The v10 pattern is `router.createCaller({})`.
**How to avoid:** Test file pattern (from STATE.md):
```typescript
const caller = router.createCaller({})
const result = await caller.characters.getByCampaignId({ campaignId: 'test-uuid' })
```
**Warning signs:** TypeScript error "Property 'createCallerFactory' does not exist on AppRouter".

---

## Content JSON Schema

These schemas define what the executor must author. They must be complete enough to support the full-stat-block display required by D-06 and D-30.

[ASSUMED: Schema design below — validated against the wizard requirements in CONTEXT.md but not against any external standard]

### races.json schema

```typescript
interface Race {
  id: string                    // e.g. "human", "elf-high", "dragonborn"
  name: string                  // display name, e.g. "Human"
  subrace?: string              // if this entry IS a subrace variant
  parentRace?: string           // id of parent race for subraces
  size: 'Tiny' | 'Small' | 'Medium' | 'Large'
  speed: number                 // base walking speed in feet
  abilityScoreIncreases: { ability: string; bonus: number }[]
  darkvision?: number           // range in feet, if any
  traits: { name: string; description: string }[]   // full stat block text
  languages: string[]           // auto-granted languages
  freeLanguageChoices?: number  // number of additional language choices
  availableSubraces?: string[]  // ids of subrace entries
  source: string                // e.g. "2024 PHB p.43"
}
```

### classes.json schema

```typescript
interface DndClass {
  id: string                    // e.g. "fighter", "cleric"
  name: string
  hitDie: number                // e.g. 10 for Fighter (d10)
  primaryAbility: string[]      // e.g. ["strength", "dexterity"]
  savingThrowProficiencies: string[]         // fixed, e.g. ["strength", "constitution"]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  toolProficiencies: string[]
  skillChoiceCount: number      // how many skills the player picks
  skillChoices: string[]        // the pool to pick from
  startingEquipmentPackages: EquipmentPackageOption[]  // 2-3 options (D-12)
  level1Features: { name: string; description: string }[]
  spellcaster: boolean
  spellcastingAbility?: string  // e.g. "wisdom" for Cleric
  choosesSubclassAtLevel1: boolean  // true for Cleric, Sorcerer, Warlock
  subclasses?: Subclass[]       // only populated if choosesSubclassAtLevel1 is true
  source: string
}

interface Subclass {
  id: string                    // e.g. "life", "light", "trickery" for Cleric
  name: string                  // e.g. "Life Domain"
  features: { name: string; description: string }[]
}

interface EquipmentPackageOption {
  id: string                    // e.g. "fighter-a"
  label: string                 // e.g. "Option A: Chain mail, shield, and a martial weapon"
  items: { name: string; quantity: number; weight: number; isMagic?: boolean }[]
  startingGold?: number         // GP awarded in addition to items
}
```

### backgrounds.json schema

```typescript
interface Background {
  id: string                    // e.g. "acolyte", "criminal"
  name: string
  skillProficiencies: string[]  // auto-applied (D-11)
  toolProficiencies: string[]   // auto-applied (D-11)
  languages: string[]           // auto-granted
  freeLanguageChoices?: number  // additional language choices
  feature: { name: string; description: string }  // read-only (D-11)
  suggestedPersonalityTraits: string[]
  suggestedIdeals: string[]
  suggestedBonds: string[]
  suggestedFlaws: string[]
  startingEquipment: { name: string; quantity: number; weight: number }[]
  startingGold: number
  source: string
}
```

### spells-by-class.json schema

```typescript
// SpellSlotsByClass[className][level] = { slotLevel: maxSlots }
// Example: cleric level 1 has two 1st-level slots
type SpellSlotsByClass = {
  [className: string]: {
    [level: number]: {
      [slotLevel: string]: number  // slotLevel is "1"-"9", value is max slots
    }
  }
}
// Example:
// { "cleric": { 1: { "1": 2 }, 2: { "1": 3 }, 3: { "1": 4, "2": 2 }, ... } }
```

**Executor note:** The `spells-by-class.json` file only needs to cover level 1 for Phase 2 (D-23, D-15), but should be authored through level 20 now to avoid re-authoring in Phase 5. The full table is in the PHB class features section for each spellcaster.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.x |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAR-01 | calcHP returns hit die + CON mod | unit | `npm test -- src/main/characters/calculations.test.ts` | ❌ Wave 0 |
| CHAR-01 | calcAC returns 10 + DEX mod (unarmored) | unit | same | ❌ Wave 0 |
| CHAR-01 | buildSpellSlots returns correct slot map for Cleric level 1 | unit | same | ❌ Wave 0 |
| CHAR-01 | charactersRepo.createWithResources atomically inserts 3 rows | unit | `npm test -- src/main/db/charactersRepo.test.ts` | ❌ Wave 0 |
| CHAR-01 | characters.create tRPC procedure writes character to DB | unit | `npm test -- src/main/trpc/routers/characters.test.ts` | ❌ Wave 0 |
| CHAR-07 | delta-based HP mutation clamps at 0 and hpMax | unit | same | ❌ Wave 0 |
| CHAR-07 | conditions JSON roundtrip (parse/stringify) | unit | same | ❌ Wave 0 |
| CHAR-09 | characterItems isAttuned toggle mutation | unit | same | ❌ Wave 0 |
| WORLD-02 | importImage returns relative path and file exists in userData | unit (with fs mocking) | `npm test -- src/main/imageService.test.ts` | ❌ Wave 0 |
| CHAR-01 | contentLoader.loadContent returns races/classes arrays | unit | `npm test -- src/main/db/contentLoader.test.ts` | ❌ Wave 0 |

All UI behavior (wizard step transitions, sheet rendering, stepper interactions) is manual verification only — vitest runs in a node environment, not a browser.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/characters/calculations.test.ts` — covers CHAR-01 auto-calc
- [ ] `src/main/db/charactersRepo.test.ts` — covers CHAR-01 persistence
- [ ] `src/main/trpc/routers/characters.test.ts` — covers CHAR-07, CHAR-09 mutations
- [ ] `src/main/imageService.test.ts` — covers WORLD-02 / CHAR-06
- [ ] `src/main/db/contentLoader.test.ts` — covers content loading

---

## Security Domain

security_enforcement is enabled (absent from config = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (local app, no auth layer) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (single-user local app) |
| V5 Input Validation | yes | zod on all IPC boundary inputs (character name, ability scores, delta values) |
| V6 Cryptography | no | — (image paths, not secrets) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via image import | Tampering | Use Electron `dialog.showOpenDialog` — user picks file, main process reads `filePaths[0]` (OS-validated path). Never accept a raw path from the renderer IPC payload as the file to read. |
| IPC payload injection (e.g. huge backstory string) | Tampering | Zod schemas on all tRPC inputs: `name: z.string().min(1).max(100)`, `backstory: z.string().max(2000)`, `delta: z.number().int().min(-9999).max(9999)` |
| JSON column injection | Tampering | Never `JSON.parse(userInput)` directly into a DB column. Validate via Zod before serializing. |
| Foreign key violation (campaignId not in campaigns) | Tampering | SQLite `PRAGMA foreign_keys = ON` already set in Phase 1. Drizzle's `.references()` generates the FK constraint in migration. |

**Security note on image paths in DB:** Paths stored in `portraitPath` are relative (e.g. `images/uuid/filename.jpg`). The main process constructs the absolute path by prefixing `app.getPath('userData')`. The renderer never receives a filesystem path — it receives a base64 data URL. This means a malicious IPC payload cannot trick the main process into reading an arbitrary file.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Return JSON column as raw string from DB | Parse in repo layer, return typed object | Renderer never needs `JSON.parse()` — eliminates a class of bugs |
| Absolute `SET hp_current = ?` mutations | Delta-based `UPDATE ... SET hp_current = MAX(0, MIN(max, hp_current + ?))` | Race-condition-safe for rapid stepper presses |
| `drizzle.transaction(async tx => ...)` | `drizzle.transaction(tx => ...)` (synchronous) | better-sqlite3 requires synchronous callbacks |
| Import `Jimp` from `jimp` for WEBP | Create custom Jimp with `@jimp/wasm-webp` plugin | WEBP requires opt-in since jimp v1.2.0 (Sep 2024) |
| tRPC v11 `createCallerFactory` | tRPC v10 `router.createCaller({})` | This project is pinned to v10 — v11 API will throw |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JSON column approach for spellSlots/conditions/proficiencies is sufficient — no filtering by individual array element needed in Phase 2 | DB Schema Pattern | Low risk: Phase 5 can migrate to normalized table if needed; JSON works fine for Phase 2 read/write |
| A2 | module-level singleton cache for content JSON is sufficient (no hot reload needed) | Content Router Pattern | Very low risk: content is static, no reload scenarios |
| A3 | @jimp/wasm-webp ESM dynamic import works correctly in electron-vite CJS main output | Image Import Pattern | Medium risk: if dynamic import fails, WEBP support is broken; mitigation: test early in Phase 2 |
| A4 | base64 data URL approach for image display is sufficient (≤1024px image, manageable IPC payload) | Image Display | Low risk: 1024px JPEG is typically 50–200KB as base64 — fine over IPC; if performance is a concern, switch to custom protocol |
| A5 | delta-based HP/currency mutations are the correct design | Stepper Pattern | Low risk: standard approach for concurrent increment/decrement operations |
| A6 | spells-by-class.json only needs level 1 for Phase 2 but should be authored through level 20 now | Content JSON Schema | Low risk: authoring more data now costs executor time but saves Phase 5 rework |
| A7 | Wizard step validation via `isValid: boolean` per step component is sufficient — no form library needed | Wizard State Pattern | Low risk: 6 steps with ≤5 fields each is well within what `useState` handles cleanly |

---

## Open Questions

1. **Cover image path storage — campaigns table column**
   - What we know: D-27 says cover image is imported from CampaignCard. D-24 says images go to `{userData}/images/{campaignId}/`.
   - What's unclear: The existing `campaigns` table has no `coverImagePath` column. The Phase 2 Drizzle migration must add it.
   - Recommendation: Add `coverImagePath text` to the campaigns table schema and generate a new migration. Keep it nullable (existing campaigns have no cover image).

2. **Character name step placement in wizard**
   - What we know: D-13 says "character name is required (collected in the wizard — first or dedicated Name step)." This is Claude's Discretion per the discussion log.
   - What's unclear: Adding a separate "Name" step would make 7 steps; folding it into Race step is cleaner.
   - Recommendation: Collect name + optional backstory as fields at the top of Step 1 (Race step). This keeps the step count at 6 and makes the Review step feel complete (name is already set).

3. **CampaignCard cover image display**
   - What we know: The existing `CampaignCard.tsx` has a "cover image area placeholder." Phase 2 wires it.
   - What's unclear: The campaign list screen (not provided in files to read) renders `CampaignCard`. The cover image display needs the same base64 data URL approach as portrait.
   - Recommendation: Add `campaigns.getCoverDataUrl` tRPC query mirroring the portrait approach.

4. **Proficiency bonus scaling**
   - What we know: D-15 sets proficiency bonus to +2 at level 1.
   - What's unclear: The stored value should auto-update when level changes (Phase 5). The schema has `proficiencyBonus` as a stored column.
   - Recommendation: Store it as a derived column for now (`+2` always in Phase 2). In Phase 5, re-derive from level. The formula is standard: `Math.ceil(level / 4) + 1`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | jimp + fs operations | ✓ | 24.15 (bundled with Electron 41) | — |
| better-sqlite3 | DB operations | ✓ | 12.10.0 (installed, native rebuilt) | — |
| @electron/rebuild | Rebuild after new native deps | ✓ | 4.0.4 | — |
| jimp | Image resize | ✓ (transitive, needs `npm install jimp` as direct dep) | 1.6.1 | — |
| @jimp/wasm-webp | WEBP support | needs install | 1.6.1 | Skip WEBP support (fails D-25) |

**Missing dependencies with no fallback:**
- `@jimp/wasm-webp` must be installed before image import is implemented (D-25 requires WEBP).

**Note on jimp:** It is already present as a transitive dependency via `electron-icon-builder`. It should be added as a direct dependency so it is not silently dropped if `electron-icon-builder` is removed.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `src/main/db/migrate.ts`, `src/main/db/index.ts`, `src/main/trpc/routers/campaigns.ts`, `src/main/trpc/routers/prefs.ts`, `electron-builder.yml` — all patterns confirmed via direct code read
- Electron dialog API — [Electron docs — dialog.showOpenDialog](https://www.electronjs.org/docs/latest/api/dialog) — verified filter format and return shape
- Electron nativeImage API — [Electron docs — nativeImage](https://www.electronjs.org/docs/api/native-image) — confirmed WEBP is not supported as input/output format
- Drizzle ORM transactions — [orm.drizzle.team/docs/transactions](https://orm.drizzle.team/docs/transactions) — verified `db.transaction(tx => {...})` pattern and behavior option
- jimp official docs — [jimp-dev.github.io/jimp](https://jimp-dev.github.io/jimp/) — confirmed supported formats (PNG, JPEG, BMP, GIF, TIFF; no WEBP in default build)

### Secondary (MEDIUM confidence)
- jimp WEBP guide — [jimp-dev.github.io/jimp/guides/webp](https://jimp-dev.github.io/jimp/guides/webp/) — `@jimp/wasm-webp` usage and ESM-only constraint
- @jimp/wasm-webp npm — version 1.6.1 confirmed, same repo as jimp, slopcheck [OK]
- WebSearch results — sharp Electron ABI rebuild requirements (confirmed: sharp requires `@electron/rebuild`; jimp does not)

### Tertiary (LOW confidence)
- ASSUMED claims listed in Assumptions Log above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm, slopcheck [OK], source repos confirmed
- DB schema: HIGH — Drizzle v0.36 API confirmed from existing codebase patterns; schema design is ASSUMED per D&D 5e domain model
- Architecture patterns: HIGH — directly derived from Phase 1 codebase patterns
- Image processing: MEDIUM — jimp API confirmed, WEBP ESM dynamic import approach is ASSUMED until tested
- Content JSON schemas: ASSUMED — designed to support all wizard requirements, not validated against external standard

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (30 days — all libraries are stable)
