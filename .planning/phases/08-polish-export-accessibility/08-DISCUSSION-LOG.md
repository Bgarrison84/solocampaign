# Phase 8: Polish, Export & Accessibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 8-Polish, Export & Accessibility
**Areas discussed:** Export scope, Settings surface, Character sheet PDF, Starter template

---

## Export scope

### Message history

| Option | Description | Selected |
|--------|-------------|----------|
| Full history | Every message row in the DB — full narrative continuity | ✓ |
| Metadata only | Characters, sessions, quests, NPCs, factions — no chat logs | |
| Recent N sessions | Last N sessions of messages + all structural data | |

**User's choice:** Full history
**Notes:** Complete faithful snapshot is the priority; file size accepted.

---

### AI provider config handling

| Option | Description | Selected |
|--------|-------------|----------|
| Include provider config, exclude keys | Export providerType, endpointUrl, modelName, dmPersonality, strictness — no API keys | ✓ |
| Exclude all AI config | Import starts with blank AI config | |
| Include everything including fallback config | Export primary + fallback endpoint structure | |

**User's choice:** Include provider config, exclude keys
**Notes:** Including fallback config not chosen — primary config is sufficient.

---

### ID handling on import

| Option | Description | Selected |
|--------|-------------|----------|
| Regenerate all IDs | Fresh UUIDs for everything; prevents collisions | ✓ |
| Preserve original IDs | Simpler code; risk of collision if IDs already exist | |

**User's choice:** Regenerate all IDs on import

---

### Export/Import UI location

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign card context menu | 3-dot dropdown on CampaignCard alongside Delete | ✓ |
| Inside campaign view gear modal | Accessible while playing | |
| Dedicated buttons on campaign list header | Prominent but adds visual weight | |

**User's choice:** Campaign card context menu (3-dot / right-click)

---

### Schema version field

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — version: 1 field | Top-level field for forward-compatibility and error detection | ✓ |
| No version field | Keep simple for v1 | |

**User's choice:** Yes — include version field

---

## Settings surface

### Settings screen location

| Option | Description | Selected |
|--------|-------------|----------|
| New /settings screen via gear icon in title bar | Dedicated full-screen settings page | ✓ |
| Modal from campaign list screen | Gear button opens modal — no navigation | |
| Panel inside each campaign's gear modal | Conflates global and per-campaign settings | |

**User's choice:** New /settings route accessible from title bar gear icon

---

### Font size scaling

| Option | Description | Selected |
|--------|-------------|----------|
| 3-step picker: Small/Normal/Large | CSS custom property --font-scale; stored in electron-store | ✓ |
| Continuous slider | Range input 75%–150%; more control, more layout risk | |
| Electron zoom factor | webContents.setZoomFactor(); scales UI chrome too | |

**User's choice:** 3-step picker via --font-scale CSS custom property

---

### High contrast mode

| Option | Description | Selected |
|--------|-------------|----------|
| High-contrast dark theme | .high-contrast selector; higher WCAG contrast ratios; dark fantasy preserved | ✓ |
| System high contrast pass-through | @media (prefers-contrast: more); automatic but not app-controlled | |
| Full white/black mode | Maximum accessibility; breaks dark fantasy aesthetic | |

**User's choice:** .high-contrast CSS selector with OKLCH token overrides

---

### Data folder migration

| Option | Description | Selected |
|--------|-------------|----------|
| Copy DB + integrity check + restart required | Safe; user-controlled; clear communication | ✓ |
| Move + auto-restart | Faster UX; app disappears and reappears | |
| Symlink approach | Complex; unreliable across OS/permissions | |

**User's choice:** Copy DB to new folder, confirm success, restart required

---

### Global vs. per-campaign settings

| Option | Description | Selected |
|--------|-------------|----------|
| Global: font/contrast/folder; Per-campaign: AI/DM config | Clean separation | ✓ |
| Everything in one /settings with campaign selector | Centralizes but adds complexity | |

**User's choice:** Global settings = font size, high contrast, data folder; per-campaign = AI config, DM personality, strictness, encumbrance, homebrew

---

## Character sheet PDF

### Layout style

| Option | Description | Selected |
|--------|-------------|----------|
| Clean print-friendly two-column layout | White background; black text; WotC-inspired; 1–2 pages | ✓ |
| Mirror app layout | Same section order as CharacterSheetTab; likely 3–4 pages | |
| Minimal 1-page stat block | Name, class, ability scores, AC, HP, speed only | |

**User's choice:** Two-column print-friendly layout, white/black, WotC-inspired

---

### Spell list inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Full spell list + slot counts | All known spells on page 2 for spellcasters | ✓ |
| Slot counts only | No spell names | |
| No spells in PDF | Skip section entirely | |

**User's choice:** Full spell list with slot counts on page 2

---

### PDF export action location

| Option | Description | Selected |
|--------|-------------|----------|
| Export button at top of Character Sheet tab | In-context; user sees sheet and exports from there | ✓ |
| Campaign card context menu | Alongside JSON export; requires leaving campaign view | |
| In the /settings screen | Removed from character sheet context | |

**User's choice:** Export button at top of Character Sheet tab

---

### Party mode PDF export

| Option | Description | Selected |
|--------|-------------|----------|
| Export active character (currently displayed) | Simple; predictable; user switches then exports | ✓ |
| Export all party members as multi-page PDF | Convenient for printing whole party | |
| Character picker popover | Flexible; extra step for solo players | |

**User's choice:** Export whichever character is currently active in the tab switcher

---

## Starter template

### Template fields

| Option | Description | Selected |
|--------|-------------|----------|
| World config + DM style | worldSetupMode, worldBrief, worldDocument, dmPersonality, strictness, partySize, encumbranceEnabled, homebrewContent | ✓ |
| World config only | No DM style fields | |
| World config + DM style + campaign name | Same as option 1 plus suggested title | |

**User's choice:** World config + DM style (campaign name also included per D-18)

---

### Import behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fills the Create Campaign wizard | Familiar flow; player reviews before creating | ✓ |
| Auto-creates a campaign directly | Faster; skips wizard review | |
| Templates library screen (/templates route) | First-class but adds a screen | |

**User's choice:** Pre-fill the Create Campaign wizard

---

### Template export UI location

| Option | Description | Selected |
|--------|-------------|----------|
| Campaign card context menu alongside JSON export | 3-dot menu; "Export as Starter Template" | ✓ |
| Inside campaign view gear modal | Accessible while playing | |
| Separate Import Template button on campaign list | Import prominent but export scattered | |

**User's choice:** Campaign card context menu (same as campaign JSON export)

---

### Campaign name in template

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fill name field (editable) | Importer sees the world's name; can change it | ✓ |
| Leave name blank | Importer always types their own name | |

**User's choice:** Include campaign name as suggested pre-filled title (editable)

---

### Homebrew/reference docs in template

| Option | Description | Selected |
|--------|-------------|----------|
| Include homebrewContent + worldDocument text | World's custom rules travel with the template | ✓ |
| World config and DM style only | Leaner; importer sets up own homebrew | |

**User's choice:** Include homebrewContent text and worldDocument text

---

## Claude's Discretion

- Exact OKLCH token overrides for `.high-contrast` theme (WCAG AA values)
- ARIA live region announcement heuristic for streaming narration (double-newline vs. sentence-end detection)
- PDF component structure (`CharacterSheetPdf.tsx` with sub-components)
- Import error messages (invalid JSON, wrong version, wrong type field)
- `appPrefs` electron-store key names and default values
- Whether `--font-scale` is applied on `<html>` or `<body>` element
- Exact PDF layout measurements (column widths, font sizes, spacing)
- Which tRPC procedure handles PDF generation

## Deferred Ideas

- Journal export (PDF/markdown) — v2 / Phase 9+
- SRD monsters for combat tracker auto-populate — v2
- Player-editable NPC notes — v2
- Named in-world calendar — v2
- Multi-character party PDF (all members in one file) — v2 enhancement
- Templates library screen (`/templates` route) — v2 if demand warrants it
- Auto-restart on data folder change — Phase 9 optional enhancement
- Import validation wizard (step-by-step preview before confirm) — v2
