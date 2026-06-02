# Phase 8: Polish, Export & Accessibility — Research

**Researched:** 2026-06-01
**Domain:** Campaign data export/import, PDF generation, CSS theming, ARIA accessibility
**Confidence:** HIGH (codebase patterns verified directly; library APIs verified via npm registry and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Campaign JSON Export / Import (DIST-01):**
- D-01: Full message history in export — all 12+ tables, no truncation
- D-02: Include AI provider config, exclude API keys (keys are in secretStorageService, not SQLite)
- D-03: Regenerate all UUIDs on import with FK remapping
- D-04: 3-dot dropdown on CampaignCard for "Export Campaign (JSON)" and "Export as Starter Template"; "Import Campaign…" button on CampaignListScreen header
- D-05: Schema version field (`"version": 1`) at top level; version mismatch shows error dialog

**Global Settings Screen (DIST-04, A11Y-01):**
- D-06: New `/settings` route via gear icon in TitleBar.tsx; same React Router pattern as `/library`; back arrow uses `navigate(-1)`
- D-07: Font size 3-step picker (Small=0.875 / Normal=1.0 / Large=1.125) via `--font-scale` CSS custom property on `<html>`; all Tailwind `text-` classes in rem; persisted in `appPrefs` electron-store
- D-08: `.high-contrast` class on `<html>` overrides OKLCH theme tokens; WCAG AA minimum (4.5:1 normal, 3:1 large); persisted in `appPrefs` electron-store
- D-09: Data folder migration: copy SQLite to new path using `.backup()`, run `PRAGMA integrity_check`, update `appPrefs.dataFolder`, show "restart required" banner
- D-10: `/settings` = global prefs only; per-campaign settings stay in existing AiSettingsModal

**Character Sheet PDF (DIST-02):**
- D-11: White background, black text, two-column layout; @react-pdf/renderer renderToBuffer() in main process
- D-12: Full spell list on page 2 for spellcasters; omit for martials (1 page vs 2 pages)
- D-13: "PDF" button in CharacterSheetTab header; triggers tRPC → main process → OS save dialog
- D-14: Export whichever character is `activeCharacterId` in campaignViewStore

**Starter Templates (DIST-03):**
- D-15: Template JSON fields: name, worldSetupMode, worldBrief, worldDocument, dmPersonality, strictness, partySize, encumbranceEnabled, homebrewContent; `type: "starterTemplate"`, `version: 1`
- D-16: Import pre-fills CreateCampaignModal; user reviews and edits before creating
- D-17: "Export as Starter Template" in campaign card 3-dot menu
- D-18: Campaign name pre-filled (editable) in wizard
- D-19: homebrewContent and worldDocument text embedded in template JSON

**Accessibility (A11Y-01, A11Y-02, A11Y-03):**
- D-20: ARIA labels on all interactive elements; Radix primitives have built-in ARIA
- D-21: aria-live="polite" + paragraph-boundary announcement (not per-token) for streaming narration
- D-22: Tab/arrow key navigation; modal focus trapping; Escape closes all

### Claude's Discretion

- Exact OKLCH token overrides for `.high-contrast` theme (researcher/planner selects WCAG AA values)
- ARIA live region announcement heuristic (double-newline vs. sentence-end logic)
- PDF component library structure (CharacterSheetPdf.tsx sub-components)
- Import dialog error messages (invalid JSON, wrong version, wrong type field)
- `appPrefs` electron-store key names and default values
- Whether `--font-scale` is applied via CSS variable on `<html>` or `body` style injection
- Exact PDF layout measurements (column widths, font sizes, spacing)
- Which tRPC procedure handles PDF generation

### Deferred Ideas (OUT OF SCOPE)

- Journal export (PDF/markdown)
- SRD monsters for combat tracker
- Player-editable NPC notes
- Named in-world calendar
- Search/filter in spell list
- Multi-character party PDF
- Templates library screen (`/templates` route)
- Auto-restart on data folder change
- Import validation wizard (step-by-step UI)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIST-01 | User can export a complete campaign as a JSON file (full backup and portability) | §Campaign JSON Export/Import — UUID remapping strategy, better-sqlite3 SELECT pattern, schema version |
| DIST-02 | User can export their character sheet as a print-friendly PDF | §@react-pdf/renderer v4 — renderToBuffer, ESM dynamic import, two-column layout |
| DIST-03 | User can import a campaign file; export world setup as starter template | §Campaign JSON Export/Import — type discriminant pattern, CreateCampaignModal pre-fill |
| DIST-04 | User can change the folder where campaign data is stored | §Electron-store & Data Folder Migration — .backup() API, startup path resolution |
| A11Y-01 | User can increase or decrease text size; high contrast mode | §CSS Font Scaling + High Contrast — --font-scale CSS var, .high-contrast OKLCH overrides |
| A11Y-02 | All interactive elements have ARIA labels and are fully keyboard-navigable | §ARIA & Accessibility — Radix built-in ARIA, focus trapping, Escape handling |
| A11Y-03 | Streaming narration accessible to screen readers | §ARIA & Accessibility — off-screen live region, paragraph-boundary detection |
</phase_requirements>

---

## Summary

Phase 8 delivers five capabilities: campaign data portability (JSON export/import with UUID remapping), character PDF export via @react-pdf/renderer, world starter templates, global app settings (font scale + high contrast + data folder migration), and a baseline accessibility pass (ARIA, keyboard nav, screen reader live regions). All capabilities integrate with the existing Electron + better-sqlite3 + electron-store + tRPC + shadcn/ui stack.

The biggest technical risk is `@react-pdf/renderer` v4's ESM-only output conflicting with electron-vite's CJS bundling for the main process. The safe path is a **dynamic `import()`** at call-site, which the project already uses for `unpdf` in `pdfExtractor.ts` — same pattern applies. The main process (Node.js context) handles PDF generation with `renderToBuffer()`, which returns a Promise resolving to a Node.js Buffer; the result is written to disk via OS save dialog.

The second landmine is using `fs.copyFile()` for the data folder migration. SQLite WAL mode leaves `.db-wal` and `.db-shm` files that `copyFile` will miss, causing immediate corruption in the new location. The fix is `sqlite.backup(destPath)` from better-sqlite3, which handles all three files atomically. The project's existing `backupRotation.ts` uses `copyFile` (acceptable for the startup pre-open case where WAL is inactive) but the migration must use `.backup()`.

**Primary recommendation:** Use dynamic `import('@react-pdf/renderer')` in a new `src/main/services/pdfService.ts`; use `sqlite.backup()` not `fs.copyFile()` for data folder migration; apply `--font-scale` and `.high-contrast` in `src/renderer/src/main.tsx` before `ReactDOM.createRoot()`; use an off-screen `aria-live` div (separate from the story scroll area) for streaming narration announcements.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Campaign JSON serialization (SELECT all tables) | Main process (Node.js) | — | Direct SQLite access; file I/O via Node; never expose raw DB data to renderer |
| UUID remapping on import | Main process (Node.js) | — | Needs direct DB transaction; never send the full JSON blob back to renderer |
| PDF generation (renderToBuffer) | Main process (Node.js) | — | @react-pdf/renderer Node API; renderer cannot write files |
| OS file open/save dialogs | Main process (Node.js) | — | `dialog` API only available in main process |
| `appPrefs` electron-store read/write | Main process (Node.js) | tRPC procedures expose to renderer | electron-store is a main-process module |
| Data folder migration (.backup + integrity_check) | Main process (Node.js) | — | SQLite connection lives in main process |
| `/settings` screen UI | Renderer (React) | — | Pure UI; data fetched via tRPC |
| Font scale + high contrast application | Renderer entry point (main.tsx) | CSS (globals.css) | CSS custom property on `<html>` before React mounts |
| ARIA live region management | Renderer (React) | — | DOM manipulation; paragraph-boundary detection in React component |
| Campaign card 3-dot menu | Renderer (React) | — | UI concern; triggers tRPC mutations |
| Template pre-fill (CreateCampaignModal) | Renderer (React) | — | Modal state pre-population from imported JSON |

---

## Standard Stack

### Core (all already installed — no new packages required)

| Library | Version Installed | Purpose | Verification |
|---------|-----------------|---------|--------------|
| `@react-pdf/renderer` | 4.5.1 (latest) | PDF generation | [VERIFIED: npm registry] — published 2026-04-15 |
| `electron-store` | 10.0.2 (installed) | `appPrefs` store for font/contrast/dataFolder | [VERIFIED: npm registry] — published 2017, 11.x latest |
| `better-sqlite3` | 12.x (installed) | `.backup()` for data folder migration | [VERIFIED: npm registry] |
| `lucide-react` | installed | Gear icon (Settings), DownloadCloud icon (PDF export) | [VERIFIED: npm registry] |
| `@radix-ui/react-dropdown-menu` | not yet installed | 3-dot CampaignCard context menu | [ASSUMED] — shadcn DropdownMenu component; needs install |

**Note on @radix-ui/react-dropdown-menu:** CampaignCard needs a shadcn `DropdownMenu` for the 3-dot menu. This Radix primitive is not yet in package.json. It follows the same install pattern as other Radix UI packages already in the project (`@radix-ui/react-dialog`, etc.). [ASSUMED: shadcn CLI adds it with `npx shadcn add dropdown-menu`]

### No New Packages

All core capabilities can be built with already-installed packages:
- PDF: `@react-pdf/renderer` already in package.json
- electron-store: already installed (v10.0.0)
- Dialogs: `dialog` from Electron (built-in)
- UUID generation: `crypto.randomUUID()` from Node.js built-in
- File I/O: Node.js `fs/promises` (built-in)

---

## Package Legitimacy Audit

> Both packages requiring verification were already installed in the project. New addition is only `@radix-ui/react-dropdown-menu`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@react-pdf/renderer` | npm | 8 yrs (2018) | High | github.com/diegomura/react-pdf | [OK] | Approved |
| `electron-store` | npm | 9 yrs (2017) | High | github.com/sindresorhus/electron-store | [OK] | Approved |
| `@radix-ui/react-dropdown-menu` | npm | 4+ yrs | High | github.com/radix-ui/primitives | [ASSUMED] — not slopcheck verified; follows same pattern as 10 other Radix packages already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User Action                Main Process (Node.js)              Renderer (React)
─────────────────────────────────────────────────────────────────────────────
"Export Campaign" click ──► campaigns.export(id) tRPC ─────────────────────►
                              │ SELECT all 12 tables
                              │ JSON.stringify(payload)
                              │ dialog.showSaveDialog()
                              │ fs.writeFile(path, json)
                              └────────────────────────► { success: true }

"Import Campaign" click ──► File picker (renderer IPC) ─────────────────────►
                              └─► dialog.showOpenDialog() (main)
                                    │ fs.readFile(picked)
                                    │ validate version/type
                                    │ remapAllUUIDs(json)
                                    │ db.transaction(insertAll)
                                    └────────────────────► { campaignId: newId }

"Export PDF" click ──────► characters.exportPdf(id) tRPC ───────────────────►
                              │ renderToBuffer(<CharacterSheetPdf data={...} />)
                              │ dialog.showSaveDialog()
                              │ fs.writeFile(path, buffer)
                              └────────────────────────► { success: true }

"Change Data Folder" ────► appPrefs.setDataFolder(path) tRPC ───────────────►
                              │ sqlite.backup(newPath)
                              │ PRAGMA integrity_check on new copy
                              │ appPrefs.set('dataFolder', newPath)
                              └────────────────────────► { pending: true }
Next app launch:
app.whenReady() ─────────► read appPrefs.dataFolder
                              │ initDatabase(customPath ?? defaultPath)

Settings screen ─────────► appPrefs.set('fontSize', 'large') tRPC ─────────►
                              └─► renderer: document.documentElement
                                    .style.setProperty('--font-scale', '1.125')

                             appPrefs.set('highContrast', true) tRPC ────────►
                              └─► renderer: document.documentElement
                                    .classList.toggle('high-contrast', true)

Streaming narration ─────────────────────────────────────────────────────────►
                              └─► StoryScrollPanel accumulates tokens
                                    │ detect paragraph boundary (\n\n or sentence-end)
                                    │ append chunk to off-screen aria-live div
                                    └─► screen reader announces paragraph
```

### Recommended Project Structure

New files for Phase 8:

```
src/
├── main/
│   ├── services/
│   │   └── pdfService.ts          # renderToBuffer() + Font.register() (NEW)
│   ├── db/
│   │   └── exportImport.ts        # serialize/deserialize all 12 tables (NEW)
│   └── trpc/
│       └── routers/
│           └── appPrefs.ts        # appPrefs electron-store tRPC router (NEW)
└── renderer/
    └── src/
        ├── screens/
        │   └── SettingsScreen.tsx  # /settings route (NEW)
        ├── components/
        │   └── pdf/
        │       └── CharacterSheetPdf.tsx  # React PDF component tree (NEW)
        └── styles/
            └── globals.css         # add .high-contrast overrides (MODIFY)
```

---

## Section 1: @react-pdf/renderer v4 — API, Electron Main Process, Two-Column Layout

### Current Version and API

`@react-pdf/renderer` is at **4.5.1** (published 2026-04-15). [VERIFIED: npm registry]

**v4 Breaking Change:** v4.0.0 dropped CommonJS (CJS) support — the package is **ESM-only**. [CITED: github.com/diegomura/react-pdf CHANGELOG.md]

### Critical Electron/electron-vite Compatibility Issue

electron-vite bundles the main process as CJS by default. A top-level `import ... from '@react-pdf/renderer'` in main process TypeScript will fail at runtime because the bundler emits CJS `require()` but the package ships ESM-only.

**The fix** — use a dynamic `import()` at call-site, which the project already does in `pdfExtractor.ts` for `unpdf`:

```typescript
// Source: pdfExtractor.ts — project established pattern
const { getDocumentProxy, extractText } = await import('unpdf')
```

Apply the same pattern in `pdfService.ts`:

```typescript
// src/main/services/pdfService.ts
export async function generateCharacterPdf(data: CharacterPdfData): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { CharacterSheetPdf } = await import('./CharacterSheetPdf') // local React component
  const element = React.createElement(CharacterSheetPdf, { data })
  const buffer = await renderToBuffer(element)
  return buffer
}
```

**Electron-vite config update needed:** Add `@react-pdf/renderer` to the `externalizeDepsPlugin` exclude list OR simply rely on dynamic import. The dynamic import approach requires no config change and is already the project pattern.

### Node.js API

[CITED: react-pdf.org/node]

| Function | Signature | Returns |
|----------|-----------|---------|
| `renderToBuffer` | `(document: React.ReactElement) => Promise<Buffer>` | Promise resolving to Node.js Buffer |
| `renderToStream` | `(document: React.ReactElement) => Promise<NodeJS.ReadableStream>` | Readable stream |
| `renderToFile` | `(document: React.ReactElement, path: string) => Promise<void>` | Promise |
| `renderToString` | `(document: React.ReactElement) => Promise<string>` | String |

**Use `renderToBuffer` then `fs.writeFile`** — this gives the most control. After `renderToBuffer`, the Buffer is passed to `dialog.showSaveDialog()` for the destination path, then written with `fs.writeFile`.

### Components Available

[CITED: react-pdf.org/components]

| Component | Purpose |
|-----------|---------|
| `<Document>` | Root; props: title, author, subject |
| `<Page>` | Single page; props: `size` (default A4), `orientation`, `style` |
| `<View>` | Box model container; the flexbox layout primitive |
| `<Text>` | Text content; supports nested `<Text>` and `<Link>` |
| `<Image>` | JPG/PNG images from path, URL, or Buffer |

### Two-Column Layout Pattern

[CITED: react-pdf.org/styling — flexbox docs]

```typescript
// Source: react-pdf.org/styling
import { StyleSheet, View, Text, Page, Document } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 40, fontFamily: 'Helvetica' },
  body: { flexDirection: 'row', gap: 20, flex: 1 },
  leftCol: { flex: 1, flexDirection: 'column' },
  rightCol: { flex: 1, flexDirection: 'column' },
  sectionHeader: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  label: { fontSize: 8, color: '#666' },
  value: { fontSize: 10, color: '#111' },
})

export function CharacterSheetPdf({ data }: { data: CharacterPdfData }) {
  return (
    <Document title={`${data.name} — Character Sheet`}>
      <Page size="A4" style={styles.page}>
        {/* Header row */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{data.name}</Text>
          <Text style={{ fontSize: 10, color: '#666' }}>
            {data.race} {data.class} — Level {data.level}
          </Text>
        </View>
        {/* Two-column body */}
        <View style={styles.body}>
          <View style={styles.leftCol}>
            {/* Ability scores, saves, skills */}
          </View>
          <View style={styles.rightCol}>
            {/* HP, AC, initiative, conditions */}
          </View>
        </View>
      </Page>
      {/* Page 2: Spells (conditional) */}
      {data.hasSpells && (
        <Page size="A4" style={styles.page}>
          {/* Spell slots + spell list */}
        </Page>
      )}
    </Document>
  )
}
```

### Font Registration

[CITED: react-pdf.org/fonts]

For an Electron app, use built-in PDF fonts (no registration required) to avoid file-system path issues inside ASAR:

```typescript
// Built-in fonts — no Font.register() needed:
// 'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'
// 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'
// 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'
```

**Recommendation:** Use `Helvetica` for body text and `Helvetica-Bold` for headers. No `Font.register()` call, no ASAR issues. If custom fonts are needed later, embed them as base64 data URIs in the source file.

### Conditional Page Rendering

React conditional expressions work identically in react-pdf as in regular React. Use `{condition && <Page ...>}` or a ternary. The `data.hasSpells` flag (derived from whether `character_spells` rows exist for the exported character) controls page 2.

---

## Section 2: Campaign JSON Export/Import — UUID Remapping Strategy

### Export Strategy

The export collects all rows for a campaign from 12+ tables using the synchronous better-sqlite3 API. Since each table has a `campaignId` FK, the pattern is:

```typescript
// src/main/db/exportImport.ts
import Database from 'better-sqlite3'
import { getDb } from './index'

export function exportCampaign(campaignId: string): CampaignExportPayload {
  const sqlite = getDb().$client // raw better-sqlite3 instance
  
  const campaign = sqlite.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId)
  const sessions = sqlite.prepare('SELECT * FROM sessions WHERE campaign_id = ?').all(campaignId)
  const messages = sqlite.prepare('SELECT * FROM messages WHERE campaign_id = ?').all(campaignId)
  const characters = sqlite.prepare('SELECT * FROM characters WHERE campaign_id = ?').all(campaignId)
  // ... all tables

  return {
    version: 1,
    type: 'campaignExport',
    exportedAt: new Date().toISOString(),
    data: { campaign, sessions, messages, characters, /* ... */ },
  }
}
```

**Tables to export (all 12 identified in D-01):**
campaigns, characters, character_resources, character_items, character_spells, character_feats, custom_feats, sessions, messages, combatants, campaign_events, quests, npcs, factions, campaign_reference_docs

**Exclusion:** The `coverImagePath` and `portraitPath` file paths are included as strings but the actual image files are not copied. On import, these will resolve to `null`/missing images — acceptable behavior per D-01 (full data snapshot; binary blobs not in scope).

**API key exclusion:** `secretStorageService` stores keys outside SQLite entirely. The campaigns row has no `api_key` column (confirmed in `schema.ts`). No special exclusion logic needed.

### Import UUID Remapping Strategy

The import builds an in-memory ID map before any database writes. All UUIDs are pre-generated, then a single transaction inserts all rows with new IDs and updated FK references.

```typescript
// Source: established pattern for bulk relational import
export function importCampaign(payload: CampaignExportPayload): string {
  const sqlite = getDb().$client
  
  // Step 1: Validate version and type
  if (payload.version !== 1) {
    throw new Error(`Unsupported export version: ${payload.version}`)
  }
  if (payload.type !== 'campaignExport') {
    throw new Error(`Expected campaignExport, got: ${payload.type}`)
  }

  // Step 2: Build UUID remap table
  // Every old ID maps to a fresh crypto.randomUUID()
  const idMap = new Map<string, string>()
  const newId = () => crypto.randomUUID()
  
  const remap = (oldId: string | null | undefined): string | null => {
    if (!oldId) return null
    if (!idMap.has(oldId)) idMap.set(oldId, newId())
    return idMap.get(oldId)!
  }

  // Pre-generate all IDs for the primary entities
  const newCampaignId = newId()
  idMap.set(payload.data.campaign.id, newCampaignId)
  
  for (const session of payload.data.sessions ?? []) {
    idMap.set(session.id, newId())
  }
  for (const character of payload.data.characters ?? []) {
    idMap.set(character.id, newId())
  }
  // ... repeat for all tables that are referenced by FK
  
  // Step 3: Single transaction — all-or-nothing
  const doImport = sqlite.transaction(() => {
    // Insert campaign (remapped)
    sqlite.prepare(`INSERT INTO campaigns (...) VALUES (...)`).run({
      ...payload.data.campaign,
      id: newCampaignId,
      coverImagePath: null,  // binary not portable
    })
    
    // Insert sessions (campaign_id remapped)
    for (const session of payload.data.sessions ?? []) {
      sqlite.prepare(`INSERT INTO sessions (...) VALUES (...)`).run({
        ...session,
        id: remap(session.id),
        campaignId: newCampaignId,
      })
    }
    
    // Insert characters (campaign_id remapped)
    for (const char of payload.data.characters ?? []) {
      sqlite.prepare(`INSERT INTO characters (...) VALUES (...)`).run({
        ...char,
        id: remap(char.id),
        campaignId: newCampaignId,
        portraitPath: null,  // binary not portable
      })
    }
    
    // Insert character_resources (character_id FK remapped)
    for (const res of payload.data.characterResources ?? []) {
      sqlite.prepare(`INSERT INTO character_resources (...) VALUES (...)`).run({
        ...res,
        id: remap(res.id),
        characterId: remap(res.characterId),
      })
    }
    
    // Continue for all tables...
    // messages.sessionId → remap(msg.sessionId)  (nullable FK)
    // combatants.sessionId → remap(comb.sessionId)  (nullable FK)
    // characterFeats.customFeatId → remap(feat.customFeatId)  (nullable FK)
    // etc.
  })
  
  doImport()
  return newCampaignId
}
```

**FK dependency insertion order (critical — foreign_keys = ON):**

1. `campaigns` (no campaign-level FK)
2. `custom_feats` (FK → campaigns)
3. `sessions` (FK → campaigns)
4. `characters` (FK → campaigns)
5. `character_resources` (FK → characters)
6. `character_items` (FK → characters)
7. `character_spells` (FK → characters)
8. `character_feats` (FK → characters; nullable FK → custom_feats)
9. `messages` (FK → campaigns; nullable FK → sessions)
10. `combatants` (FK → campaigns; nullable FK → sessions)
11. `campaign_events` (FK → campaigns; nullable FK → sessions)
12. `quests` (FK → campaigns)
13. `npcs` (FK → campaigns)
14. `factions` (FK → campaigns — unique constraint on campaign_id+name; safe on new campaignId)
15. `campaign_reference_docs` (FK → campaigns)

**Nullable FKs:** `messages.sessionId`, `combatants.sessionId`, `campaign_events.sessionId`, `characterFeats.customFeatId` — all use `remap()` which returns `null` when the source value is null.

**Transaction safety:** better-sqlite3 `sqlite.transaction()` wraps all inserts. If any row fails (constraint violation, schema mismatch), the entire import rolls back — no partial state.

### Starter Template Export

Template export is a subset of campaign export — only the campaign-level fields specified in D-15, with `type: "starterTemplate"` instead of `"campaignExport"`.

```typescript
export function exportStarterTemplate(campaignId: string): StarterTemplatePayload {
  const sqlite = getDb().$client
  const campaign = sqlite.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId)
  
  return {
    version: 1,
    type: 'starterTemplate',
    exportedAt: new Date().toISOString(),
    name: campaign.name,
    worldSetupMode: campaign.worldSetupMode,
    worldBrief: campaign.worldBrief,
    worldDocument: campaign.worldDocument,
    dmPersonality: campaign.dmPersonality,
    strictness: campaign.strictness,
    partySize: campaign.partySize,
    encumbranceEnabled: campaign.encumbranceEnabled,
    homebrewContent: campaign.homebrewContent,
  }
}
```

Template import: detected by `type: "starterTemplate"` in the imported JSON. No UUID remapping needed (no IDs in template). Passed as an `initialTemplate` prop to `CreateCampaignModal` which pre-fills its state. No DB write at import time — the DB write happens only when the user confirms campaign creation.

### Type Discriminant Check at Import Entry Point

The renderer picks a file, reads it as text, sends the JSON string via tRPC to the main process. The main process parses + validates:

```typescript
const parsed = JSON.parse(jsonString)

if (parsed.version !== 1) {
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'This export was created with a newer version of SoloCampaign.' })
}

if (parsed.type === 'campaignExport') {
  return { kind: 'campaign', campaignId: importCampaign(parsed) }
}
if (parsed.type === 'starterTemplate') {
  return { kind: 'template', template: parsed }
}
throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unrecognized file type. Expected a SoloCampaign export.' })
```

---

## Section 3: Electron-store & Data Folder Migration

### startup Path Resolution

The current `initDatabase()` in `src/main/db/index.ts` hardcodes `app.getPath('userData')`. Phase 8 adds a custom path override from `appPrefs`. The `appPrefs` store must be initialized **before** `initDatabase()` is called.

```typescript
// src/main/index.ts — modified startup sequence
import Store from 'electron-store'

const appPrefs = new Store<AppPrefs>({ name: 'appPrefs' })

app.whenReady().then(async () => {
  // Read data folder BEFORE initDatabase()
  const customDataFolder = appPrefs.get('dataFolder', null)
  
  try {
    await initDatabase(customDataFolder) // pass custom path
  } catch (err) { /* ... */ }
})
```

```typescript
// src/main/db/index.ts — add optional path parameter
export async function initDatabase(customPath?: string | null) {
  const userData = customPath ?? app.getPath('userData')
  const dbPath = path.join(userData, 'solocampaign.db')
  // ... rest unchanged
}
```

### Data Folder Migration — CRITICAL: Use .backup() Not fs.copyFile()

**The landmine:** `fs.copyFile()` on a SQLite database in WAL mode copies only the `.db` file, leaving `.db-wal` and `.db-shm` behind. The new location has a corrupted database. [CITED: scottspence.com/posts/sqlite-corruption-fs-copyfile-issue]

**The fix:** better-sqlite3's `.backup(destination)` method handles WAL atomically and creates a clean copy. [CITED: better-sqlite3 API docs]

Note: The existing `backupRotation.ts` uses `copyFile` — this is acceptable because it runs **before** `new Database(dbPath)` is called, so WAL is not active at that point. The migration runs while the DB is open and WAL-active, requiring `.backup()`.

```typescript
// src/main/trpc/routers/appPrefs.ts
import Database from 'better-sqlite3'
import { getDb } from '../../db/index'

changeDataFolder: t.procedure
  .input(z.object({ folderPath: z.string().min(1) }))
  .mutation(async ({ input }) => {
    const newDbPath = path.join(input.folderPath, 'solocampaign.db')
    
    // Step 1: Use .backup() for WAL-safe copy (CRITICAL — not fs.copyFile)
    const sqlite = getDb().$client // raw better-sqlite3 instance
    await sqlite.backup(newDbPath)
    
    // Step 2: Verify integrity of the new copy
    const newDb = new Database(newDbPath, { readonly: true })
    const result = newDb.prepare("PRAGMA integrity_check").get() as { integrity_check: string }
    newDb.close()
    
    if (result.integrity_check !== 'ok') {
      // Clean up corrupted copy
      await fs.unlink(newDbPath).catch(() => {})
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Integrity check failed on new database copy.' })
    }
    
    // Step 3: Persist the new path — takes effect on next launch
    appPrefs.set('dataFolder', input.folderPath)
    
    return { success: true, pendingRestart: true }
  }),
```

### appPrefs Store Definition

```typescript
// src/main/trpc/routers/appPrefs.ts
import Store from 'electron-store'

interface AppPrefs {
  fontSize: 'small' | 'normal' | 'large'
  highContrast: boolean
  dataFolder: string | null
}

const DEFAULT_APP_PREFS: AppPrefs = {
  fontSize: 'normal',
  highContrast: false,
  dataFolder: null,
}

const appPrefsStore = new Store<AppPrefs>({ name: 'appPrefs' })
```

**Key names (Claude's discretion — resolved here):** `fontSize`, `highContrast`, `dataFolder`.

---

## Section 4: CSS Font Scaling + High Contrast

### Font Scale: --font-scale CSS Custom Property

The `--font-scale` CSS custom property is set on `<html>`. All Tailwind `text-*` classes use rem, and rem resolves relative to the `<html>` font-size. However, `--font-scale` is not a browser-native multiplier — it must be applied as a direct `font-size` override:

```css
/* globals.css addition */
html {
  font-size: calc(1rem * var(--font-scale, 1));
}
```

Or applied directly in `main.tsx` via JavaScript (simpler — no CSS change needed):

```typescript
// src/renderer/src/main.tsx — before ReactDOM.createRoot()
// D-07: Apply font scale before React mounts to prevent FOUC
const FONT_SCALE_MAP = { small: '0.875', normal: '1', large: '1.125' }

async function applyPrefsBeforeMount() {
  // Fetch appPrefs synchronously via a tRPC query is not possible before React mounts.
  // Instead, use a dedicated IPC channel or pass through preload script.
  // See Section 8 (Landmines) for the timing challenge.
}
```

**Timing challenge:** `main.tsx` runs before React mounts, but tRPC requires the React context. The solution is to read `appPrefs` via a dedicated synchronous IPC call exposed through the preload script, OR use a `ipcRenderer.invoke` call in `main.tsx` before calling `ReactDOM.createRoot()`.

```typescript
// src/preload/index.ts — add narrow surface for prefs read-before-mount
contextBridge.exposeInMainWorld('appPrefsSync', {
  getInitialPrefs: () => ipcRenderer.invoke('appPrefs:getInitial'),
})
```

```typescript
// src/main/index.ts — add handler that returns initial prefs
ipcMain.handle('appPrefs:getInitial', () => {
  return appPrefs.store // returns the entire store as plain object
})
```

```typescript
// src/renderer/src/main.tsx — apply before mount
const initialPrefs = await (window as any).appPrefsSync.getInitialPrefs()
const scale = { small: '0.875', normal: '1', large: '1.125' }[initialPrefs.fontSize] ?? '1'
document.documentElement.style.setProperty('--font-scale', scale)
if (initialPrefs.highContrast) {
  document.documentElement.classList.add('high-contrast')
}
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

**On settings change (after mount):** Update the CSS property/class directly from the SettingsScreen React component via a tRPC mutation that also triggers the DOM update:

```typescript
// In SettingsScreen — no page reload needed
const handleFontChange = (value: 'small' | 'normal' | 'large') => {
  const scaleMap = { small: '0.875', normal: '1', large: '1.125' }
  document.documentElement.style.setProperty('--font-scale', scaleMap[value])
  setFontSizeMutation.mutate({ fontSize: value })
}
```

### High Contrast Theme: .high-contrast CSS Class

The existing `globals.css` uses OKLCH theme tokens defined in `:root` and `.dark`. A `.high-contrast` block overrides the same token names with higher-contrast values:

**Current dark theme analysis (from `globals.css`):**
- `--background`: `oklch(0.16 0.005 260)` ≈ very dark gray-blue
- `--foreground`: `oklch(0.93 0.005 260)` ≈ near-white

**Estimated contrast (foreground on background):** ~12:1 — already passes WCAG AA. The problem is muted content:
- `--muted-foreground`: `oklch(0.60 0.010 260)` — needs verification against `--background`

For `.high-contrast`, the goal is to ensure even muted text meets 4.5:1:

```css
/* globals.css addition — at end of file */
.high-contrast {
  /* Boost contrast for all semantic tokens */
  --foreground: oklch(0.98 0.002 260);        /* near-white */
  --muted-foreground: oklch(0.82 0.005 260);   /* brighter muted */
  --primary: oklch(0.90 0.12 78);              /* brighter gold */
  --border: oklch(0.45 0.012 260);             /* more visible borders */
  --destructive: oklch(0.70 0.25 27);          /* brighter red */
  --card: oklch(0.12 0.003 260);               /* darker card for contrast */
  --secondary: oklch(0.22 0.006 260);          /* darker secondary */
  --muted: oklch(0.18 0.004 260);              /* darker muted bg */
}
```

[ASSUMED: Exact OKLCH values need validation with a contrast checker (webaim.org/resources/contrastchecker). The values above are estimates based on the existing palette. Planner should note that a verification task is needed.]

**Integration with Tailwind v4's `.dark` variant:**

The existing `@custom-variant dark (&:is(.dark *))` in `globals.css` means `.dark` class on `<html>` activates dark mode. The `.high-contrast` class overrides tokens on top of the dark base. The app always runs in dark mode (`.dark` is always present or the default tokens are dark). The `.high-contrast` class adds an additional override layer:

```
Default tokens (:root) → .dark override → .high-contrast override
```

The `.high-contrast` block in CSS cascades after `.dark` naturally if placed after it in the file.

---

## Section 5: ARIA & Accessibility

### Pattern 1: Off-Screen Live Region for Streaming Narration (D-21)

[CITED: MDN ARIA Live Regions docs]

The current `StoryScrollPanel.tsx` has `aria-live="polite"` directly on the scroll area div. This causes the screen reader to announce every small DOM change — including history loads and streaming tokens. The improved pattern uses an **off-screen live region** as a separate announcement buffer:

```typescript
// StoryScrollPanel.tsx addition
const liveRegionRef = useRef<HTMLDivElement>(null)
const paragraphBufferRef = useRef('')

// Called on each streaming token
const handleStreamToken = (token: string) => {
  paragraphBufferRef.current += token
  
  // Announce when a paragraph boundary is detected
  const text = paragraphBufferRef.current
  const boundaryIdx = findParagraphBoundary(text)
  
  if (boundaryIdx > -1) {
    const announcement = text.slice(0, boundaryIdx).trim()
    paragraphBufferRef.current = text.slice(boundaryIdx).trimStart()
    
    if (announcement && liveRegionRef.current) {
      // Clear then set — some screen readers only fire on DOM change
      liveRegionRef.current.textContent = ''
      requestAnimationFrame(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = announcement
        }
      })
    }
  }
}

// Paragraph boundary detection heuristic (Claude's discretion — resolved here)
function findParagraphBoundary(text: string): number {
  // Double newline is the canonical paragraph boundary
  const doubleNewline = text.indexOf('\n\n')
  if (doubleNewline > 20) return doubleNewline + 2 // minimum 20 chars to avoid tiny announcements
  
  // Sentence-end fallback: period/!/? followed by space or newline
  const sentenceEnd = text.search(/[.!?][\s\n]/)
  if (sentenceEnd > 60) return sentenceEnd + 2 // minimum 60 chars for sentence boundary
  
  return -1 // no boundary yet
}

// In JSX:
return (
  <>
    {/* Off-screen live region — screen readers announce here; sighted users see nothing */}
    <div
      ref={liveRegionRef}
      aria-live="polite"
      aria-atomic="false"
      className="sr-only"  // or absolute, clip to 1px, etc.
      aria-label="Story narration"
    />
    
    {/* Visible scroll area — NO aria-live on the scroll area (remove current attribute) */}
    <div ref={scrollAreaRef} onScroll={handleScroll} /* ... */ >
      {/* ... */}
    </div>
  </>
)
```

**Remove `aria-live="polite"` from the scroll area div** — it currently sits on the outer scrollable div, which means every history load, message append, and streaming token fires the screen reader. The off-screen pattern isolates announcements.

**`aria-atomic="false"`** — announces only changed content (the new paragraph), not the entire live region.

**`aria-live="polite"`** — waits until the user is idle before announcing. Appropriate for narration (not emergency-level).

**`aria-live` region must be empty on initial load** — this is satisfied by the ref pattern (ref starts as null, region starts empty).

### Pattern 2: Radix Built-In ARIA (D-20)

[CITED: shadcn/ui docs — Dialog, Tabs, Popover components]

Radix primitives already handle:
- **Dialog**: `role="dialog"`, `aria-modal`, `aria-labelledby` pointing to DialogTitle
- **Tabs**: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, arrow key navigation
- **DropdownMenu**: `role="menu"`, `role="menuitem"`, `aria-haspopup`
- **Select**: `role="combobox"`, `aria-expanded`, keyboard navigation
- **Popover**: `aria-haspopup="dialog"`, focus management

For custom interactive elements (buttons without visible text, icon-only buttons), explicit `aria-label` is required:

```typescript
// Example — 3-dot menu trigger (icon-only button)
<DropdownMenuTrigger asChild>
  <Button variant="ghost" size="icon" aria-label="Campaign options">
    <MoreHorizontal className="h-4 w-4" />
  </Button>
</DropdownMenuTrigger>
```

**Audit target areas for D-20:**
- TitleBar window control buttons (Minimize, Maximize, Close) — add `aria-label`
- DiceRollerPopover trigger button
- CampaignCard cover image buttons
- PDF export button in CharacterSheetTab header
- Gear icon in TitleBar for /settings

### Pattern 3: Keyboard Navigation (D-22)

Existing Radix components handle:
- Tab key navigation between elements
- Arrow key navigation within Tabs (`@radix-ui/react-tabs`)
- `Escape` closes Dialog, Popover, DropdownMenu (Radix default behavior)
- Focus trapping in Dialog (Radix default via `FocusTrap`)

**No custom keyboard handling needed for Radix components.** The gap is icon-only buttons and custom focusable elements that need `tabIndex={0}` and key handlers for `Enter`/`Space`.

`CampaignCard` already sets `tabIndex={0}` and handles `Enter`/` ` — this is the established pattern.

**Tab order:** The TitleBar is at the top of the visual hierarchy but may not be in tab order. Consider `tabIndex` management for the gear icon and window controls.

---

## Section 6: Existing Codebase Patterns to Extend

### 6.1 Electron-store Pattern (from prefs.ts)

```typescript
// Established pattern (src/main/trpc/routers/prefs.ts):
const store = new Store<Record<string, { leftSize: number; rightSize: number }>>({ name: 'prefs' })
```

Phase 8 adds `appPrefs` store in a **new file** `src/main/trpc/routers/appPrefs.ts` following the exact same structure. Register `appPrefsRouter` in `src/main/trpc/router.ts`.

### 6.2 LibraryScreen Pattern (for /settings route)

`LibraryScreen.tsx` exports a named component, is registered as `<Route path="/library" element={<LibraryScreen />} />` in `App.tsx`, and uses `useNavigate()` with `navigate(-1)` for the back button. `SettingsScreen.tsx` follows the same scaffold.

```typescript
// App.tsx addition:
import { SettingsScreen } from './screens/SettingsScreen'

<Route path="/settings" element={<SettingsScreen />} />
```

### 6.3 IPC File Dialog Pattern (from imageService.ts)

`campaigns.importCoverImage` in `campaigns.ts` calls `dialog.showOpenDialog()` in the main process. For export, `dialog.showSaveDialog()` is used. The pattern is:

```typescript
// Main process (tRPC mutation):
const { canceled, filePath } = await dialog.showSaveDialog({
  defaultPath: `${campaignName}-export.json`,
  filters: [{ name: 'JSON', extensions: ['json'] }],
})
if (canceled || !filePath) return { canceled: true }
await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
return { canceled: false }
```

For import (read), the renderer cannot call `dialog.showOpenDialog()` directly (sandbox: true). The existing pattern is to call a tRPC mutation that opens the dialog in main:

```typescript
// campaigns.importJson tRPC mutation:
const { canceled, filePaths } = await dialog.showOpenDialog({
  properties: ['openFile'],
  filters: [{ name: 'JSON', extensions: ['json'] }],
})
if (canceled || !filePaths[0]) return { canceled: true }
const jsonContent = await fs.readFile(filePaths[0], 'utf-8')
const result = importCampaignOrTemplate(JSON.parse(jsonContent))
return result
```

### 6.4 CampaignCard 3-Dot Menu Integration

Current `CampaignCard.tsx` has no context menu. The DropdownMenu component needs to be added. Key considerations:
- The outer `<div role="button">` handles clicks to navigate to the campaign
- The 3-dot button must call `e.stopPropagation()` to prevent triggering navigation
- Confirmation dialog before delete (existing pattern can be reused)

```typescript
// CampaignCard.tsx addition sketch:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => e.stopPropagation()}
      aria-label="Campaign options"
      className="absolute top-2 right-2"
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
    <DropdownMenuItem onSelect={() => handleExportJson()}>
      Export Campaign (JSON)
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={() => handleExportTemplate()}>
      Export as Starter Template
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={() => handleDelete()} className="text-destructive">
      Delete Campaign
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 6.5 StoryScrollPanel Streaming Narration Integration

The current `StoryScrollPanel.tsx` already has `aria-live="polite"` on the scroll area (line 152). D-21 requires moving this to an off-screen buffer approach. The component receives `streamingContent: string` as a prop from `CampaignViewScreen` — the paragraph-boundary detection logic runs inside `StoryScrollPanel` on the accumulated `streamingContent`.

The `useEffect` that watches `[streamingContent, isStreaming, scrollToBottom]` is the anchor point for injecting the paragraph-boundary detection logic.

### 6.6 Dynamic Import Pattern (from pdfExtractor.ts)

The established ESM/CJS interop pattern for the main process:

```typescript
// src/main/services/pdfExtractor.ts line 28-29:
const { getDocumentProxy, extractText } = await import('unpdf')
```

This exact pattern applies to `@react-pdf/renderer` in `pdfService.ts`.

### 6.7 TitleBar Gear Icon Integration

`TitleBar.tsx` uses `style={{ WebkitAppRegion: 'no-drag' }}` on the button container. The gear icon button goes in the right zone, left of the window controls:

```typescript
// Between left zone and right zone (window controls):
<div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
  <button
    onClick={() => navigate('/settings')}
    aria-label="Settings"
    className="..."
    style={{ height: tbHeight }}
  >
    <Settings size={14} />
  </button>
</div>
```

Note: `TitleBar.tsx` uses `trpc.window.minimize.mutate()` — it does not use `useNavigate()`. The navigate function must be added or passed as a prop. Using `useNavigate()` inside TitleBar is straightforward since TitleBar renders inside the Router context.

---

## Section 7: Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF layout engine | Custom canvas/SVG rendering | `@react-pdf/renderer` | Flexbox layout, text flow, pagination already handled |
| PDF font metrics | Character width tables, text wrap | Built-in PDF fonts (Helvetica) | react-pdf handles font metrics automatically |
| CSV/ZIP for export | Custom serialization format | JSON with schema version | Already decided (D-05); simpler for import |
| SQLite backup | `fs.copyFile()` | `sqlite.backup(dest)` | copyFile corrupts WAL-mode databases |
| UUID generation | Any custom UUID library | `crypto.randomUUID()` | Built into Node.js 19+; no import needed |
| Focus trapping | Custom focus management | Radix Dialog FocusTrap | Already handles edge cases (portals, dynamically added elements) |
| Escape key handler | Custom keydown listener | Radix Dialog/Popover default | Already closes on Escape |
| Live region debouncing | Custom announcement throttle | Paragraph boundary detection | Simpler than timers; meaningful semantic unit |
| High contrast detection | `prefers-contrast` media query | Manual toggle | User wants explicit control (D-08); media query is advisory, not mandatory |

---

## Section 8: Implementation Risks & Landmines

### Landmine 1: @react-pdf/renderer v4 ESM + electron-vite CJS bundling

**Risk:** Top-level `import { renderToBuffer } from '@react-pdf/renderer'` in main process TypeScript causes a runtime `ERR_REQUIRE_ESM` error because electron-vite bundles main as CJS.

**Prevention:** Use `const { renderToBuffer } = await import('@react-pdf/renderer')` (dynamic import). Already established project pattern from `pdfExtractor.ts`.

**Verification:** The `externalizeDepsPlugin` in `electron.vite.config.ts` externalizes most deps. If `@react-pdf/renderer` is externalized, Node.js itself loads it — and Node.js can load ESM packages natively. Either way (bundled with dynamic import OR externalized), the dynamic import is safe.

**Confidence:** MEDIUM — the dynamic import pattern works, but `@react-pdf/renderer` bundles `yoga-layout` which uses `__dirname` internally. If yoga-layout is bundled, it may fail. Testing in the actual Electron build is required before declaring success. [CITED: GitHub issue discussions about yoga-layout and __dirname]

### Landmine 2: fs.copyFile() for SQLite Migration = Corruption

**Risk:** Using `fs.copyFile()` for data folder migration copies only the `.db` file, leaving WAL checkpointing incomplete. Result: corrupted database at the new location.

**Prevention:** Use `sqlite.backup(newPath)` from better-sqlite3. [CITED: scottspence.com, better-sqlite3 API docs]

### Landmine 3: appPrefs Read Before Electron API is Available

**Risk:** `appPrefs` store initialization requires `app` from Electron. The store cannot be accessed from the renderer without IPC.

**Prevention:** The `appPrefs:getInitial` IPC handler must be registered in `ipcMain.handle` **before** the BrowserWindow is created. This ensures the preload bridge and renderer can call it at startup.

**Timing order in `src/main/index.ts`:**
1. `const appPrefs = new Store(...)` — top-level, before `app.whenReady()`
2. `ipcMain.handle('appPrefs:getInitial', ...)` — before `new BrowserWindow(...)`
3. `await initDatabase(appPrefs.get('dataFolder'))` — after ipcMain handler, before BrowserWindow

### Landmine 4: ARIA Live Region DOM Ordering

**Risk:** `aria-live` regions must exist in the DOM **before** their first content update. If the live region div is conditionally rendered or mounted after content has already started streaming, some screen readers will not announce it.

**Prevention:** The off-screen live region `<div>` is always rendered (not conditionally). It starts empty and is updated when paragraphs complete. The `className="sr-only"` hides it visually but keeps it in DOM.

**`sr-only` class:** shadcn/ui/Tailwind provides `.sr-only` as `position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0)`. Verify it exists in the Tailwind v4 build or add it manually to `globals.css`.

### Landmine 5: FK Insertion Order During Import

**Risk:** better-sqlite3 has `foreign_keys = ON` (set in `initDatabase`). Inserting rows in the wrong order causes FK constraint violations.

**Prevention:** Follow the exact insertion order documented in Section 2 (campaigns → custom_feats → sessions → characters → child tables). `custom_feats` must precede `character_feats` because `characterFeats.customFeatId` is an optional FK to `customFeats`.

### Landmine 6: factions Unique Constraint on Import

**Risk:** The `factions` table has `unique('factions_campaign_name_unique').on(campaignId, name)`. With the new `campaignId`, this constraint is satisfied (new campaign, same faction names are fine). But if importing twice (duplicate import), the second import creates a second campaign with a new `campaignId` — no collision.

**No issue** — the unique constraint is scoped to `(campaign_id, name)`. Each import creates a new `campaign_id`, so duplicate faction names across imports are safe.

### Landmine 7: PDF React Component in Node.js Context (no DOM)

**Risk:** The `CharacterSheetPdf.tsx` component is a React tree but uses react-pdf primitives (`<Document>`, `<Page>`, `<View>`, `<Text>`), not DOM elements. However, if it accidentally imports any renderer-specific code (e.g., browser globals like `window`, `document`), it will fail in Node.js.

**Prevention:** The PDF component must only import from `@react-pdf/renderer` and use pure data (no browser APIs). Keep `CharacterSheetPdf.tsx` in `src/main/services/` or a shared location that the main process can import. Do NOT import from `src/renderer/src` in the PDF component.

### Landmine 8: react-pdf/renderer and React Version Compatibility

**Verification from npm:** `@react-pdf/renderer` peer dependency: `react: '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0'`. The project uses React 19.2.1. [VERIFIED: npm registry peerDependencies] — React 19 is explicitly supported.

However, react-pdf uses its own internal React reconciler (`@react-pdf/reconciler`). React 19 changed the reconciler API. GitHub issue #2966 reports reconciler issues with React 19 in production builds (Vercel). [CITED: GitHub issue #2966]

**Mitigation:** Test the PDF generation in a packaged Electron build (not just dev mode) before considering it done. The dynamic import pattern means the reconciler is loaded lazily, which reduces risk from build-time bundler issues.

---

## Section 9: Wave/Plan Decomposition Recommendation

Phase 8 has 22 locked decisions and touches 12+ files across main and renderer. The natural wave structure follows data dependencies and risk:

### Wave 0: Foundation (blocking everything else)
- **Plan 08-01:** `appPrefs` electron-store + tRPC router + `/settings` route scaffold + TitleBar gear icon
  - New file: `src/main/trpc/routers/appPrefs.ts`
  - Modify: `src/main/trpc/router.ts`, `src/main/index.ts` (startup path resolution + IPC handler), `src/renderer/src/App.tsx` (add route), `src/renderer/src/components/TitleBar.tsx` (gear icon + navigate)
  - New file: `src/renderer/src/screens/SettingsScreen.tsx` (scaffold only)
  - New file: `src/preload/index.ts` addition (appPrefsSync.getInitialPrefs)
  - Modify: `src/main/db/index.ts` (accept custom path)

### Wave 1: Settings Screen + CSS Theme
- **Plan 08-02:** Font scale + high contrast implementation (complete SettingsScreen UI)
  - Modify: `src/renderer/src/styles/globals.css` (add `.high-contrast` block, `--font-scale` variable)
  - Modify: `src/renderer/src/main.tsx` (apply prefs before mount)
  - Complete: SettingsScreen font picker + high contrast toggle UI
  - Depends on: 08-01 (appPrefs tRPC router)

### Wave 2: Data Export/Import (parallel after Wave 0)
- **Plan 08-03:** Campaign JSON export/import (DIST-01, partial DIST-03)
  - New file: `src/main/db/exportImport.ts`
  - Modify: `src/main/trpc/routers/campaigns.ts` (add export/import procedures)
  - Modify: `src/renderer/src/components/CampaignCard.tsx` (3-dot menu + DropdownMenu install)
  - Modify: `src/renderer/src/screens/CampaignListScreen.tsx` (Import button)
  - Depends on: 08-01 (establishes tRPC pattern for new procedures)

- **Plan 08-04:** Starter template export/import (DIST-03)
  - Modify: `src/main/db/exportImport.ts` (add exportStarterTemplate)
  - Modify: `src/main/trpc/routers/campaigns.ts` (add exportTemplate procedure)
  - Modify: `src/renderer/src/components/CreateCampaignModal.tsx` (initialTemplate prop)
  - Depends on: 08-03 (share exportImport.ts)

### Wave 3: PDF Export
- **Plan 08-05:** Character sheet PDF (DIST-02)
  - New file: `src/main/services/pdfService.ts` (dynamic import + renderToBuffer)
  - New file: `src/main/services/CharacterSheetPdf.tsx` (react-pdf component tree)
  - Modify: `src/main/trpc/routers/characters.ts` (add exportPdf procedure)
  - Modify: `src/renderer/src/components/CharacterSheetTab.tsx` (PDF export button)
  - Depends on: Wave 0 (tRPC pattern)

### Wave 4: Data Folder Migration
- **Plan 08-06:** Data folder migration (DIST-04)
  - Modify: `src/main/trpc/routers/appPrefs.ts` (add changeDataFolder + getCurrentDataFolder procedures)
  - Complete: SettingsScreen Data section (path display + Change button + restart banner)
  - Depends on: 08-01 (appPrefs router), 08-02 (SettingsScreen scaffold)

### Wave 5: Accessibility
- **Plan 08-07:** ARIA labels + keyboard navigation audit (A11Y-02, A11Y-03)
  - Modify: `src/renderer/src/components/StoryScrollPanel.tsx` (off-screen live region + paragraph-boundary detection)
  - Modify: All components needing `aria-label` (TitleBar buttons, CampaignCard buttons, CharacterSheetTab PDF button, etc.)
  - Depends on: All other plans (final polish pass)

---

## Section 10: Environment Availability

> Phase 8 is code + CSS changes only. No external services or databases beyond what the project already uses.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `crypto.randomUUID()` | UUID generation on import | Yes | Built into Node 19+ (project uses Node 24.15) | — |
| `@react-pdf/renderer` | PDF generation | Yes (in package.json) | 4.5.1 | — |
| `electron-store` | appPrefs | Yes (in package.json) | 10.0.0 | — |
| `dialog` (Electron built-in) | File open/save dialogs | Yes | Electron 41.7.0 | — |
| `better-sqlite3 .backup()` | Data folder migration | Yes | 12.x | — |
| WCAG contrast checker | Verify .high-contrast tokens | External (webaim.org) | N/A | Manual calculation |

**Missing dependencies with no fallback:** None. All required dependencies are installed.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | vitest.config.ts (inherited from electron-vite; uses default vitest discovery) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |
| Existing test files | `src/main/trpc/routers/ai.test.ts`, `characters.test.ts`, `secrets.test.ts`, `sessions.test.ts`, `services/pdfExtractor.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-01 | exportCampaign() serializes all 12 tables | unit | `npm run test -- --run --reporter=verbose exportImport` | ❌ Wave 0 |
| DIST-01 | importCampaign() remaps all UUIDs correctly | unit | same | ❌ Wave 0 |
| DIST-01 | importCampaign() rolls back on FK violation | unit | same | ❌ Wave 0 |
| DIST-01 | Version mismatch throws error | unit | same | ❌ Wave 0 |
| DIST-02 | exportPdf() returns Buffer (non-empty) | unit | `npm run test -- --run --reporter=verbose pdfService` | ❌ Wave 0 |
| DIST-03 | exportStarterTemplate() includes correct fields, excludes save state | unit | `npm run test -- --run --reporter=verbose exportImport` | ❌ Wave 0 |
| DIST-04 | changeDataFolder() uses .backup() not copyFile | unit (mock) | `npm run test -- --run --reporter=verbose appPrefs` | ❌ Wave 0 |
| DIST-04 | initDatabase() uses custom path from appPrefs | unit | same | ❌ Wave 0 |
| A11Y-01 | appPrefs stores/retrieves fontSize correctly | unit | `npm run test -- --run --reporter=verbose appPrefs` | ❌ Wave 0 |
| A11Y-01 | appPrefs stores/retrieves highContrast correctly | unit | same | ❌ Wave 0 |
| A11Y-02 | aria-label present on all icon-only buttons | manual + axe-core audit | — | manual |
| A11Y-03 | Screen reader announces at paragraph boundaries (not per-token) | manual (NVDA/VoiceOver) | — | manual |

### Sampling Rate

- **Per task commit:** `npm run test -- --run` (all existing tests still pass)
- **Per wave merge:** `npm run test -- --run` (full suite)
- **Phase gate:** Full suite green + manual ARIA audit before `/gsd:verify-work`

### Wave 0 Gaps (Test Files to Create)

- [ ] `src/main/db/exportImport.test.ts` — covers DIST-01 (export serialization, import UUID remapping, FK ordering, transaction rollback, version validation)
- [ ] `src/main/services/pdfService.test.ts` — covers DIST-02 (renderToBuffer returns non-empty Buffer; spellcaster gets 2 pages; martial gets 1 page)
- [ ] `src/main/trpc/routers/appPrefs.test.ts` — covers DIST-04, A11Y-01 (store get/set, data folder change uses backup, fontSize persistence)

---

## Common Pitfalls

### Pitfall 1: Using fs.copyFile() for Data Folder Migration

**What goes wrong:** The SQLite database at the new location is immediately corrupted on first open.
**Why it happens:** WAL mode uses three files (`.db`, `.db-wal`, `.db-shm`). `copyFile` only copies `.db`.
**How to avoid:** Use `sqlite.backup(destPath)` from better-sqlite3.
**Warning signs:** "Database disk image is malformed" error on next launch after migration.

### Pitfall 2: @react-pdf/renderer Top-Level Import in Main Process

**What goes wrong:** Runtime `ERR_REQUIRE_ESM` error when PDF export is triggered.
**Why it happens:** v4 is ESM-only; electron-vite bundles main as CJS.
**How to avoid:** Use `await import('@react-pdf/renderer')` at call-site in pdfService.ts.
**Warning signs:** Error only appears after `electron-vite build`, not in dev mode (Vite may handle it transparently in dev).

### Pitfall 3: ARIA Live Region Added Too Late

**What goes wrong:** Screen reader does not announce streaming content.
**Why it happens:** The live region was added to the DOM after content was already inserted.
**How to avoid:** Render the `aria-live` div unconditionally (always in DOM, just visually hidden).
**Warning signs:** Test with NVDA or VoiceOver; no announcements during streaming.

### Pitfall 4: FK Insertion Order Violation on Import

**What goes wrong:** SQLite `FOREIGN KEY constraint failed` error during import; entire transaction rolls back.
**Why it happens:** `character_feats` inserted before `custom_feats`, or `messages` before `sessions`.
**How to avoid:** Follow the exact insertion order: campaigns → custom_feats → sessions → characters → character_resources → character_items → character_spells → character_feats → messages → combatants → campaign_events → quests → npcs → factions → campaign_reference_docs.
**Warning signs:** Import fails with "FOREIGN KEY constraint failed" in the error message.

### Pitfall 5: appPrefs Read Timing (Before vs. After App Ready)

**What goes wrong:** Font scale and high contrast are not applied on first render (FOUC — Flash of Unstyled Content).
**Why it happens:** tRPC queries run after React mounts and after the first paint.
**How to avoid:** Use the `appPrefs:getInitial` IPC handler pattern in `main.tsx` before `ReactDOM.createRoot()`.
**Warning signs:** Brief flash of default font size or standard contrast on app startup.

### Pitfall 6: Accordion and CampaignCard Click Propagation

**What goes wrong:** Clicking the 3-dot menu opens the campaign instead of the menu.
**Why it happens:** The outer `<div role="button">` handles all click events including bubbled events from the DropdownMenuTrigger.
**How to avoid:** `e.stopPropagation()` on the DropdownMenuTrigger `onClick` AND on the DropdownMenuContent `onClick` (Radix DropdownMenuContent portals outside the card div, so this may not be needed for the content, but the trigger is inside the card div).
**Warning signs:** Clicking the DropdownMenuTrigger button navigates to the campaign.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer for PDF | @react-pdf/renderer | 2022+ | 200MB installer removed; pure Node.js |
| React Reconciler v1 API | React 19 reconciler API | React 19 (2024) | react-pdf v4.1+ needed for React 19 compat |
| CJS-only @react-pdf | ESM-only v4 | v4.0.0 (2024) | Requires dynamic import in CJS contexts |
| fs.copyFile() for SQLite backup | better-sqlite3 .backup() | Known since WAL mode was introduced | Eliminates corruption risk |
| Manual ARIA roles | Radix UI built-in ARIA | 2022+ | No custom role management needed |

**Deprecated/outdated:**
- `@react-pdf/renderer` v3 `pdf()` API: In v3, the `pdf()` function returned a blob-provider. v4 uses `renderToBuffer` as the primary Node.js API. [CITED: CHANGELOG]
- CommonJS import of `@react-pdf/renderer`: Removed in v4.0.0. Dynamic import required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@radix-ui/react-dropdown-menu` follows the same shadcn install pattern as other Radix packages in this project | Standard Stack | Low — all other Radix UI packages are installed via npm; same pattern applies |
| A2 | Dynamic `import('@react-pdf/renderer')` in main process successfully loads the ESM package in the built Electron app | Section 1 (ESM/CJS) | HIGH — if yoga-layout's `__dirname` usage causes issues in the Electron bundle, PDF export fails entirely. Requires build-time smoke test. |
| A3 | OKLCH values proposed for `.high-contrast` meet WCAG AA 4.5:1 | Section 4 | MEDIUM — values are estimates from palette analysis. A verification task using webaim.org checker is required before ship. |
| A4 | `sqlite.backup()` is available on the `getDb().$client` raw better-sqlite3 instance | Section 3 | Low — Drizzle wraps better-sqlite3 and exposes `$client` as the raw Database instance; `.backup()` is a standard better-sqlite3 API method |
| A5 | `window.appPrefsSync.getInitialPrefs()` IPC call completes before `ReactDOM.createRoot()` in main.tsx | Section 4 | LOW — IPC is synchronous from the renderer's perspective (`ipcRenderer.invoke` is awaitable); the async/await chain in main.tsx ensures ordering |
| A6 | Tailwind v4 includes `.sr-only` as a built-in utility | Section 5 | LOW — Tailwind v4 retains `.sr-only` from v3; confirmed in Tailwind docs. If missing, add to `globals.css` manually. |

---

## Open Questions

1. **React 19 + react-pdf reconciler compatibility in packaged build**
   - What we know: GitHub issue #2966 reports reconciler errors with React 19 in Vercel production builds. The issue is open.
   - What's unclear: Whether this affects Electron's main-process Node.js context (not a browser renderer).
   - Recommendation: Include a Wave 3 verification task that runs PDF generation in a packaged Electron build (not dev mode) before finalizing Plan 08-05.

2. **`sr-only` class availability in Tailwind v4**
   - What we know: Tailwind v4 changed utility class generation from static to dynamic. `sr-only` was in v3.
   - What's unclear: Whether `sr-only` requires explicit opt-in in Tailwind v4 config.
   - Recommendation: Add `sr-only` styles to `globals.css` explicitly for the live region, rather than relying on Tailwind to generate it.

3. **FOUC risk on startup for font scale + high contrast**
   - What we know: `ipcRenderer.invoke` is async; there will be a frame between HTML load and the IPC response.
   - What's unclear: Whether Electron's `show: false` → `ready-to-show` window lifecycle prevents the FOUC (the window is hidden until ready-to-show, so the first frame users see is post-mount).
   - Recommendation: The `show: false` + `once('ready-to-show', () => mainWindow.show())` pattern in `index.ts` means the window is never visible until React has mounted and the IPC call has completed. FOUC is unlikely but verify with a slow IPC call test.

---

## Sources

### Primary (HIGH confidence)
- `src/main/trpc/routers/prefs.ts` — existing electron-store pattern (directly read)
- `src/renderer/src/components/StoryScrollPanel.tsx` — current aria-live implementation (directly read)
- `src/renderer/src/styles/globals.css` — OKLCH token values (directly read)
- `src/main/db/schema.ts` — all 12 tables confirmed for export scope (directly read)
- `src/main/db/index.ts` — initDatabase pattern to extend (directly read)
- `src/main/index.ts` — startup sequence and ipcMain.handle patterns (directly read)
- `src/preload/index.ts` — contextBridge pattern for new IPC surface (directly read)
- `src/renderer/src/main.tsx` — pre-mount insertion point (directly read)
- `package.json` — installed versions confirmed (directly read)
- [npm registry: @react-pdf/renderer 4.5.1](https://www.npmjs.com/package/@react-pdf/renderer) — VERIFIED version and publish date
- [npm registry: electron-store 10.x](https://www.npmjs.com/package/electron-store) — VERIFIED
- [better-sqlite3 .backup() API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) — CITED
- [react-pdf.org/node — Node.js API](https://react-pdf.org/node) — CITED (renderToBuffer, renderToFile, renderToStream)
- [react-pdf.org/fonts — Font.register()](https://react-pdf.org/fonts) — CITED (built-in fonts, path support)
- [react-pdf.org/styling — Flexbox layout](https://react-pdf.org/styling) — CITED (two-column pattern)
- [react-pdf.org/components — Document, Page, View, Text, Image](https://react-pdf.org/components) — CITED
- [MDN: ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions) — CITED (polite vs assertive, aria-atomic, off-screen pattern)

### Secondary (MEDIUM confidence)
- [github.com/diegomura/react-pdf CHANGELOG.md](https://github.com/diegomura/react-pdf/blob/master/packages/renderer/CHANGELOG.md) — v4 breaking change: ESM-only
- [scottspence.com: SQLite WAL corruption with fs.copyFile](https://scottspence.com/posts/sqlite-corruption-fs-copyfile-issue) — WAL mode backup landmine
- [WCAG AA contrast requirements (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Perceivable/Color_contrast) — 4.5:1 and 3:1 ratios

### Tertiary (LOW confidence — training data, needs build verification)
- react-pdf v4 + React 19 reconciler compatibility — flagged in GitHub issue #2966; not fully resolved [LOW]
- OKLCH high-contrast token values proposed in Section 4 — estimates, need contrast checker validation [LOW — see A3 in Assumptions Log]
- yoga-layout `__dirname` issue in electron-vite bundled builds — mentioned in search results, needs empirical verification [LOW — see A2]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified via npm registry; all codebase patterns read directly
- Architecture: HIGH — integration points traced through actual source files
- @react-pdf/renderer v4 API: HIGH for API surface; MEDIUM for Electron compatibility (dynamic import mitigation needed)
- SQLite migration: HIGH — .backup() pattern confirmed via official docs; WAL corruption risk documented
- CSS theming: HIGH for pattern; LOW for exact OKLCH contrast values
- ARIA patterns: HIGH — MDN-cited; patterns follow established Radix/shadcn baseline
- Pitfalls: HIGH — all landmines traced to concrete code paths in the codebase

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (30 days — packages stable, architecture decisions locked)
