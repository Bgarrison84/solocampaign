---
phase: 07-content-depth-advanced-character
plan: 02
subsystem: content
tags: [json, srd-content, feats, epic-boons, subclasses, magic-items, rules, monsters]
dependency_graph:
  requires: []
  provides: [feats-library, epic-boons-library, subclass-data, magic-items-library, rules-library, monsters-library]
  affects: [07-05-feat-picker, 07-06-character-progression, 07-09-library-browser]
tech_stack:
  added: []
  patterns: [static-json-content, srd-data-authoring]
key_files:
  created:
    - resources/feats.json
    - resources/epic-boons.json
    - resources/magic-items.json
    - resources/rules.json
    - resources/monsters.json
  modified:
    - resources/classes.json
decisions:
  - electron-builder.yml required no change — existing extraResources filter covers all new JSON files
  - wizard subclasses expanded to all 8 SRD arcane traditions for completeness
  - rules.json includes death/dying rule for completeness of Combat category
metrics:
  duration: "~11 minutes"
  completed: "2026-05-31"
  tasks_completed: 2
  files_changed: 6
---

# Phase 7 Plan 02: SRD Content JSON Files Summary

**One-liner:** Five new SRD content JSON files authored (feats, epic-boons, magic-items, rules, monsters) and classes.json extended with subclassLevel and subclasses for all 12 SRD classes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author feats.json, epic-boons.json, extend classes.json | 285d44d | resources/feats.json, resources/epic-boons.json, resources/classes.json |
| 2 | Author magic-items.json, rules.json, monsters.json + bundle config | 49e62c9 | resources/magic-items.json, resources/rules.json, resources/monsters.json |

## Content Summary

### resources/feats.json (42 feats)
42 SRD feats with `{id, name, description, prerequisites}` — full SRD feat set including Alert, Lucky, Sentinel, Sharpshooter, War Caster, and 37 others. Prerequisites are informational text strings.

### resources/epic-boons.json (26 boons)
Exactly 26 DMG Epic Boons with `{id, name, description}`: Boon of Combat Prowess, Dimensional Travel, Fate, Fortitude, High Magic, Immortality, Invincibility, Irresistible Offense, Luck, Magic Resistance, Peerless Aim, Perfect Health, Planar Travel, Quick Casting, Recovery, Resilience, Skill Proficiency, Speed, Spell Mastery, Spell Recall, the Fire Soul, the Night Spirit, the Stormborn, the Unfettered, Truesight, Undetectability.

### resources/classes.json (all 12 classes extended)
All 12 SRD classes now have `subclassLevel` (number) and `subclasses` (array of `{id, name, description, features}`):
- barbarian: level 3 — Path of the Berserker, Path of the Totem Warrior
- bard: level 3 — College of Lore, College of Valor
- cleric: level 1 — 7 domains (Life, Light, Trickery, Knowledge, Nature, Tempest, War) — pre-existing entries preserved and enriched with `description` field
- druid: level 2 — Circle of the Land, Circle of the Moon
- fighter: level 3 — Champion, Battle Master, Eldritch Knight
- monk: level 3 — Way of the Open Hand, Way of Shadow, Way of the Four Elements
- paladin: level 3 — Oath of Devotion, Oath of the Ancients, Oath of Vengeance
- ranger: level 3 — Hunter, Beast Master
- rogue: level 3 — Thief, Assassin, Arcane Trickster
- sorcerer: level 1 — Draconic Bloodline, Wild Magic Surge (pre-existing, enriched)
- warlock: level 1 — The Archfey, The Fiend, The Great Old One (pre-existing, enriched)
- wizard: level 2 — 8 arcane traditions (Evocation, Abjuration, Conjuration, Divination, Enchantment, Illusion, Necromancy, Transmutation)

### resources/magic-items.json (32 items)
32 SRD magic items spanning Common through Legendary with `{id, name, rarity, attunement, description}`: consumables (potions), wondrous items (bag of holding, portable hole), armor/protection (bracers, cloaks, rings), ability-boosting items (belts, gauntlets, headbands), weapons (flame tongue, frost brand, holy avenger, vorpal sword), and utility items (ropes, lanterns, wands, staffs).

### resources/rules.json (29 rule sections)
29 SRD rule sections with `{id, title, category, content}` across 4 categories:
- **Combat** (10 sections): Initiative, Surprise, Your Turn, Actions in Combat, Attack Rolls, Damage Rolls, Opportunity Attacks, Grappling, Conditions Overview, Cover, Dropping to 0 HP
- **Adventuring** (7 sections): Movement, Resting, Light and Visibility, Falling, Suffocating, Food and Water, Carrying Capacity
- **Spellcasting** (4 sections): Basics, Concentration, Components, Ritual Casting
- **Conditions** (6 sections): Blinded, Charmed, Frightened, Poisoned, Prone, Stunned, Unconscious

### resources/monsters.json (22 monsters)
22 SRD monsters with full stat block shape `{id, name, type, cr, ac, hp, speed, abilities, actions}` including goblin, orc, kobold, skeleton, zombie, wolf, giant spider, ogre, troll, werewolf, vampire, young red dragon, adult green dragon, ancient blue dragon, lich, mind flayer, beholder, bandit, bandit captain, wyvern, owlbear, manticore.

## electron-builder.yml Bundling Confirmation

**No change required.** The existing configuration already covers all new content files through two mechanisms:
1. `asarUnpack: "resources/*.json"` — unpacks all JSON from the resources dir so they are accessible at runtime
2. `extraResources: from: resources, to: ., filter: "*.json"` — copies all JSON files to the app's resource directory

All five new files (feats.json, epic-boons.json, magic-items.json, rules.json, monsters.json) are automatically bundled by the existing globs.

## Verification Results

**Task 1 verify:** `OK feats=42 boons=26 classes=12`
**Task 2 verify:** `OK items=32 rules=29 monsters=22`

Both node verification scripts exited 0.

## Deviations from Plan

### Auto-enrichments (not bugs, within task scope)

**1. [Rule 2 - Enhancement] Added `description` field to pre-existing cleric, sorcerer, warlock subclasses**
- **Found during:** Task 1 — existing subclasses in classes.json lacked `description` field
- **Fix:** Added concise description strings to all pre-existing subclass objects to match the schema used for newly-authored subclasses
- **Files modified:** resources/classes.json

**2. [Rule 2 - Enhancement] Expanded wizard to all 8 SRD arcane traditions**
- **Found during:** Task 1 — plan said "SRD subclasses" for wizard, which has 8 traditions in the SRD
- **Fix:** Authored all 8 traditions (Evocation, Abjuration, Conjuration, Divination, Enchantment, Illusion, Necromancy, Transmutation) rather than a partial subset
- **Files modified:** resources/classes.json

## Known Stubs

None. All content files contain real SRD-derived data. No placeholder text or empty values that flow to UI rendering.

## Threat Flags

None. All new files are static read-only SRD content authored at build time with no user input path.

## Self-Check: PASSED

- [x] resources/feats.json — FOUND
- [x] resources/epic-boons.json — FOUND
- [x] resources/classes.json — FOUND
- [x] resources/magic-items.json — FOUND
- [x] resources/rules.json — FOUND
- [x] resources/monsters.json — FOUND
- [x] Commit 285d44d — FOUND (Task 1)
- [x] Commit 49e62c9 — FOUND (Task 2)
- [x] epic-boons.json count = 26 — VERIFIED
- [x] feats.json count = 42 — VERIFIED
- [x] All 12 classes have subclassLevel + subclasses — VERIFIED
- [x] electron-builder.yml bundling — CONFIRMED (no change needed)
