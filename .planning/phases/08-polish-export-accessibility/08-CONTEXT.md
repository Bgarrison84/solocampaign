# Phase 8: Polish, Export & Accessibility - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can export a full campaign as a versioned JSON file (all tables, full message history, provider config sans keys), import a campaign JSON from another player with all state restored and new IDs, export their active character's sheet as a print-friendly two-column PDF via @react-pdf/renderer, export a campaign world as a sharable starter template (world config + DM style + homebrew, no save state) that pre-fills the Create Campaign wizard for the importer, change the app's data folder from a new global /settings screen (copy + integrity check + restart), scale text size (Small/Normal/Large) and toggle a high-contrast dark theme that both persist across launches, and navigate the entire app via keyboard with ARIA labels on every interactive element and streamed narration announced to screen readers at paragraph boundaries.

**In scope:** Campaign JSON export/import (DIST-01), character sheet PDF (DIST-02), sharable starter templates (DIST-03), custom data folder (DIST-04), font size scaling (A11Y-01), high contrast mode (A11Y-01), ARIA/keyboard navigation (A11Y-02), screen reader support for streaming narration (A11Y-03).

**Out of scope:** Signed/notarized installers (Phase 9), GitHub release update notifications (Phase 9), any new gameplay features, multiplayer, TTS/audio, AI-generated art.

</domain>

<decisions>
## Implementation Decisions

### Campaign JSON Export / Import (DIST-01)

- **D-01:** **Full message history in export.** The campaign JSON includes every row from all tables: campaigns, characters, character_resources, character_items, character_spells, character_feats, custom_feats, sessions, messages, combatants, campaign_events, quests, npcs, factions, campaign_reference_docs, and world-state columns. No truncation — the export is a complete faithful snapshot.

- **D-02:** **Include AI provider config, exclude API keys.** The export includes `providerType`, `endpointUrl`, `modelName`, `fallbackEndpointUrl`, `fallbackModelName`, `dmPersonality`, `strictness` from the campaigns row. API keys are never in SQLite (stored in `secretStorageService`) and are excluded. The importer must enter their own key.

- **D-03:** **Regenerate all IDs on import.** Every UUID in the imported JSON — campaign ID, character IDs, session IDs, message IDs, quest IDs, NPC IDs, etc. — is regenerated as a fresh UUID. Internal FK references are remapped to the new IDs before insert. Prevents collisions with existing campaigns.

- **D-04:** **Export/Import in the campaign card context menu.** The `CampaignCard` gets a 3-dot (⋯) dropdown menu with: "Export Campaign (JSON)", "Export as Starter Template", and existing actions (Delete). A separate "Import Campaign…" button appears on the `CampaignListScreen` header (or within the same area), triggering an OS file picker for `.json` files.

- **D-05:** **Schema version field.** The export JSON has a top-level `"version": 1` field. The importer checks this field before processing; a version mismatch shows a clear error ("This export was created with a newer version of SoloCampaign").

### Global Settings Screen (DIST-04, A11Y-01)

- **D-06:** **New `/settings` route.** A gear icon button in `TitleBar.tsx` navigates to `/settings`. The settings screen uses the same React Router page pattern as `/library` (Phase 7). A back arrow returns to wherever the user came from (`navigate(-1)`).

- **D-07:** **Font size: 3-step picker (Small / Normal / Large).** A segmented control (3 buttons) in the settings screen. Applies a CSS custom property `--font-scale` to the `<html>` element: Small = 0.875, Normal = 1.0, Large = 1.125. All Tailwind `text-` classes are expressed in `rem` so they respond to this multiplier. Persisted in a new `appPrefs` electron-store (`{name: 'appPrefs'}`). Applied at app startup before first render.

- **D-08:** **High contrast: `.high-contrast` dark theme.** A toggle in the settings screen adds or removes a `.high-contrast` class on `<html>`. A second CSS block in `globals.css` overrides the OKLCH theme tokens to higher-contrast values (WCAG AA minimum: 4.5:1 for normal text, 3:1 for large text) while keeping the dark fantasy palette. Persisted in `appPrefs` electron-store.

- **D-09:** **Data folder: copy + integrity check + restart required.** The settings screen has a "Data Folder" section showing the current path (from `app.getPath('userData')` or the custom path in `appPrefs`). A "Change…" button opens an OS folder picker. On confirm: copy the SQLite file to the new path, run `PRAGMA integrity_check` on the copy, update `appPrefs.dataFolder`, show "Restart required to apply" banner. On next launch, `initDatabase()` opens from `appPrefs.dataFolder` if set.

- **D-10:** **Global vs. per-campaign settings separation.** The `/settings` screen holds only app-global prefs: font size, high contrast, data folder. Per-campaign settings (AI config, DM personality, strictness, encumbrance, homebrew) remain in the existing `AiSettingsModal.tsx` within the campaign view. No mixing.

### Character Sheet PDF (DIST-02)

- **D-11:** **Clean print-friendly two-column PDF layout.** White background, black text — dark theme stripped entirely for print. Left column: ability scores (boxes with modifier), saving throws, skills, passive perception. Right column: HP/AC/speed/initiative, proficiency bonus, death saves, conditions, currency. Bottom sections (or page 2): equipment list, personality/traits/bonds/flaws. Spells on a second page for spellcasters. Layout inspired by the official WotC sheet but lighter (not a pixel-perfect copy — app-branded).

- **D-12:** **Full spell list on PDF page 2 for spellcasters.** Spell slots by level (current/max), then a compact list of known spells: name, level, school, concentration flag. Non-spellcasters omit the spells page entirely. The PDF is 1 page for martial characters, 2 pages for spellcasters.

- **D-13:** **PDF export button at the top of the Character Sheet tab.** A small "⬇ PDF" or printer icon button in the `CharacterSheetTab` header row (alongside any other controls). Clicking triggers the PDF generation in the main process (via tRPC) and opens an OS save-as dialog.

- **D-14:** **Export active character in party mode.** The PDF export button always exports whichever character is currently displayed in the tab switcher (tracked by `activeCharacterId` in `campaignViewStore`). For solo campaigns (partySize = 1) this is always the only character.

### Starter Templates (DIST-03)

- **D-15:** **Template fields.** A starter template JSON contains: `name` (campaign name as suggested title), `worldSetupMode`, `worldBrief`, `worldDocument` (full text if present), `dmPersonality`, `strictness`, `partySize`, `encumbranceEnabled`, `homebrewContent`. No characters, sessions, messages, quests, NPCs, factions, or any save state. A `type: "starterTemplate"` discriminant distinguishes it from a campaign export. Also a `version: 1` field.

- **D-16:** **Import pre-fills the Create Campaign wizard.** When the user imports a `.json` file identified as a starter template (by the `type: "starterTemplate"` field), the `CreateCampaignModal` opens with all template fields pre-populated (campaign name, world setup mode, brief/document, DM personality, strictness, party size, encumbrance). The player reviews and edits before confirming — they still need to enter their own AI key.

- **D-17:** **Template export in campaign card 3-dot menu.** "Export as Starter Template" appears alongside "Export Campaign (JSON)" in the CampaignCard context menu. Both write `.json` files via OS save-as dialog.

- **D-18:** **Campaign name pre-filled (editable).** The template includes the originating campaign's name as the suggested title. The importer sees it pre-filled in the name field of the Create Campaign wizard and can edit it freely before creating.

- **D-19:** **homebrewContent and worldDocument text travel with the template.** The homebrew textarea content and the worldDocument extracted text (if present) are embedded in the template JSON so the world's custom rules and imported world document context travel intact to the importer.

### Accessibility (A11Y-01, A11Y-02, A11Y-03)

- **D-20:** **ARIA labels on every interactive element.** All buttons, inputs, selects, checkboxes, dialogs, tabs, and custom controls get explicit `aria-label` or `aria-labelledby` attributes. Radix UI (via shadcn) provides built-in ARIA for its primitives (Dialog, Tabs, Popover, Select) — no custom ARIA needed for those, but visible labels must be present.

- **D-21:** **Streaming narration announces at paragraph boundaries via ARIA live region.** The `StoryScrollPanel` wraps the narrative area in an `aria-live="polite"` container. Announcements fire when a paragraph boundary is detected in the streaming token stream (double-newline or sentence-end heuristic), not on every token. This prevents screen reader flood while maintaining timely updates.

- **D-22:** **Keyboard navigation for all paths.** Tab order is logical (left panel → right panel → tab triggers → tab content). The 5-tab right panel responds to arrow keys (Radix Tabs already provides this). Modal dialogs trap focus. `Escape` closes all modals and popovers. The `CombatTrackerTab` action buttons are reachable via Tab.

### Claude's Discretion

- Exact OKLCH token overrides for the `.high-contrast` theme (researcher/planner selects values that achieve WCAG AA)
- ARIA live region announcement heuristic (exact double-newline vs. sentence-end logic)
- PDF component library structure (`CharacterSheetPdf.tsx` with sub-components for each section)
- Import dialog error messages (invalid JSON, wrong version, wrong type field)
- `appPrefs` electron-store key names and default values
- Whether `--font-scale` is applied via a CSS variable on `<html>` or via `body` style injection at startup (either works; planner decides)
- Exact layout measurements in the PDF (column widths, font sizes, spacing)
- Which tRPC procedure handles PDF generation (new `characters.exportPdf` or a standalone IPC channel)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` § "Phase 8: Polish, Export & Accessibility" — Goal, 6 success criteria, requirements list (DIST-01 through DIST-04, A11Y-01 through A11Y-03)
- `.planning/REQUIREMENTS.md` — DIST-01, DIST-02, DIST-03, DIST-04, A11Y-01, A11Y-02, A11Y-03

### Prior Phase Context (critical integration)
- `.planning/phases/07-content-depth-advanced-character/07-CONTEXT.md` — D-38 (`campaign_reference_docs` table — included in campaign JSON export); D-36 (`homebrewContent` column on campaigns — in template export); D-31 (`worldDocument` column — in template export); D-29 (`worldBrief` column); D-28 (`worldSetupMode`); D-17 (`partySize`); D-26 (`encumbranceEnabled`); D-08 (multiclass `classes` JSON column — in character export); D-21 (`isCompanion` flag on characters — export includes companions)
- `.planning/phases/06-quests-npcs-world-state/06-CONTEXT.md` — D-14 (quests, npcs, factions tables — all included in campaign export); world-state columns on campaigns
- `.planning/phases/05-rules-engine-dice-combat/05-CONTEXT.md` — `combatants` table, `campaign_events` table, `character_spells` table, `character_items` table (all exported); `permadeathMode` on campaigns
- `.planning/phases/03-ai-engine-provider-abstraction/03-CONTEXT.md` — API key storage in `secretStorageService` (NOT in SQLite — must not be exported); `referenceDocs` JSON column on campaigns
- `.planning/phases/01-foundation-secure-shell/01-CONTEXT.md` — electron-store pattern for UI prefs; `better-sqlite3` integrity_check for DB migration validation

### Existing Code — Critical Integration Points
- `src/main/index.ts` — `electron-store` import and `boundsStore` instantiation; `initDatabase()` call on startup (add data folder path resolution here); `app.getPath('userData')` for default DB location
- `src/main/trpc/routers/prefs.ts` — existing `prefs` electron-store; new `appPrefs` store for font/contrast/dataFolder goes here (same file or new `appPrefs.ts` router)
- `src/main/db/index.ts` — `initDatabase()` must accept a custom path from `appPrefs` for data folder migration
- `src/main/db/schema.ts` — all tables for export/import serialization; no new schema changes required for Phase 8
- `src/renderer/src/App.tsx` — add `/settings` route
- `src/renderer/src/components/TitleBar.tsx` — add gear icon linking to `/settings`
- `src/renderer/src/components/CampaignCard.tsx` — add 3-dot context menu with "Export Campaign (JSON)" and "Export as Starter Template"
- `src/renderer/src/components/CreateCampaignModal.tsx` — add template pre-fill path (optional `initialTemplate` prop or store-driven)
- `src/renderer/src/screens/CampaignListScreen.tsx` — add "Import…" button for campaign JSON and template JSON import
- `src/renderer/src/components/CharacterSheetTab.tsx` — add Export PDF button in tab header
- `src/renderer/src/components/StoryScrollPanel.tsx` — add `aria-live="polite"` region + paragraph-boundary announcement logic

### Technology Stack
- `CLAUDE.md` § "PDF Generation (Character Sheet Export)" — `@react-pdf/renderer` v4 for PDF; `<Page>`, `<Text>`, `<View>` primitives; sub-400ms generation; runs in main or renderer
- `CLAUDE.md` § "Supporting Libraries" → `electron-store` v10 for `appPrefs` (font, contrast, dataFolder)
- `CLAUDE.md` § "UI Component Library" — Tailwind v4 with OKLCH theme tokens; `.dark` selector pattern reused for `.high-contrast` override block

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/trpc/routers/prefs.ts` — Existing electron-store pattern (`new Store({name: 'prefs'})`). The new `appPrefs` store follows the exact same pattern. Register new procedures in the same router or a new `appPrefsRouter` wired into `router.ts`.
- `src/renderer/src/screens/LibraryScreen.tsx` — Pattern for a full-screen React Router page with back navigation. The `/settings` screen follows the same scaffold.
- `src/renderer/src/components/AiSettingsModal.tsx` — The existing per-campaign settings modal; Phase 8 does NOT change this, only supplements with the global `/settings` screen.
- `src/renderer/src/components/ui/dialog.tsx`, `src/renderer/src/components/ui/tabs.tsx` — shadcn Radix primitives already have built-in ARIA (no extra aria attributes needed for the primitives themselves).
- `src/renderer/src/components/CampaignCard.tsx` — Add a 3-dot button (shadcn `DropdownMenu` or similar) for the context menu.

### Established Patterns
- **Electron-store:** `new Store<T>({ name: 'storeName' })` in the main process; exposed via tRPC procedure; queried from renderer via TanStack Query. All three existing stores (`windowBounds`, `prefs`) follow this. `appPrefs` follows the same.
- **React Router navigation:** `useNavigate()` from `react-router-dom`; routes declared in `App.tsx`. `/settings` is the third route (after `/library`).
- **IPC file dialogs:** `dialog.showSaveDialog()` / `dialog.showOpenDialog()` in the main process, called via an IPC channel. Follow the image import pattern from `imageService.ts` / `02-04-PLAN.md`.
- **Drizzle export:** `better-sqlite3` synchronous API means the full DB export can run in-process: `db.prepare('SELECT * FROM campaigns').all()` etc., then `JSON.stringify`. No streaming needed.
- **PDF in main process:** `@react-pdf/renderer`'s `renderToBuffer()` runs in Node.js (main process). The result is a Buffer that can be piped to `dialog.showSaveDialog()` then `fs.writeFile`.

### Integration Points
- **Campaign JSON export** → new `campaigns.export(campaignId)` tRPC procedure reads all 12+ tables for a campaign, returns serialized JSON; main process calls `dialog.showSaveDialog()` then writes file
- **Campaign JSON import** → new `campaigns.import(jsonString)` tRPC procedure validates version + type, remaps IDs, inserts all rows; triggered from renderer after user picks a file
- **Template export** → new `campaigns.exportTemplate(campaignId)` tRPC procedure; same 3-dot menu action
- **Template import** → pre-fills `CreateCampaignModal` state (detect `type: "starterTemplate"` from the imported JSON)
- **PDF export** → new `characters.exportPdf(characterId)` tRPC procedure; calls `renderToBuffer()` from `@react-pdf/renderer`
- **Font scale + high contrast** → applied at renderer startup from `appPrefs` values; CSS custom property on `<html>` element; re-applied on settings change without reload
- **Data folder migration** → `appPrefs.dataFolder` read in `src/main/index.ts` before `initDatabase()`; migration copies the SQLite file, not the entire userData folder

</code_context>

<specifics>
## Specific Ideas

- **Campaign card 3-dot menu:** Use shadcn `DropdownMenu` component (Radix-based, already available). Three items: "Export Campaign (JSON)", "Export as Starter Template", "Delete Campaign". The existing delete confirmation pattern applies to delete; the two export items trigger OS save dialogs.
- **Settings screen layout:** Two sections: "Appearance" (font size segmented control + high contrast toggle) and "Data" (data folder path display + "Change…" button + restart banner). Clean minimal layout matching the existing dark theme. No fantasy flavor needed in settings.
- **Font scale application timing:** Read `appPrefs.fontSize` in the renderer's entry point (`main.tsx`) and set `document.documentElement.style.setProperty('--font-scale', value)` before the React tree mounts.
- **High contrast class application:** Same entry point — if `appPrefs.highContrast === true`, add class `'high-contrast'` to `document.documentElement` before mount.
- **Restart-required banner:** A dismissible `Alert` component (shadcn) at the top of the `/settings` screen, shown only when `pendingDataFolderChange` is truthy in the appPrefs store. "Changes to the data folder take effect after restart."
- **Export file naming:** Campaign JSON → `{campaignName}-export.json`. Template → `{campaignName}-template.json`. Character PDF → `{characterName}-sheet.pdf`. All lowercase, spaces replaced with hyphens.
- **ARIA live region for streaming:** Wrap the scroll area content in a `<div aria-live="polite" aria-atomic="false">`. Append paragraph chunks (not tokens) to a separate off-screen `<div>` (the live region) so screen readers announce completed paragraphs without interrupting reading of earlier content.

</specifics>

<deferred>
## Deferred Ideas

- **Journal export (PDF/markdown)** — session journal export to PDF or markdown was mentioned in Phase 7 deferred. Still Phase 9+ or a v2 feature; not in Phase 8 scope.
- **SRD monsters for combat tracker** (auto-populate combatant stats from monster DB) — deferred from Phase 7, still Phase 8+ but NOT in this phase's scope.
- **Player-editable NPC notes** — deferred from Phase 6, not in Phase 8 scope.
- **Named in-world calendar** (month/day names) — deferred from Phase 6, not in Phase 8 scope.
- **Search/filter in spell list** — deferred from Phase 7, not in Phase 8 scope.
- **Multi-character party PDF** (all party members as a single multi-page PDF) — user chose "export active character only"; multi-party PDF is a v2 enhancement.
- **Templates library screen** (`/templates` route) — user chose wizard pre-fill approach; a dedicated templates library screen is a v2 enhancement.
- **Auto-restart on data folder change** — user chose "restart required" (not auto-restart); auto-restart could be added in Phase 9 if user feedback requests it.
- **Import validation wizard** — a step-by-step UI showing what will be imported before confirming. Useful for large files but not required for v1.

</deferred>

---

*Phase: 8-Polish, Export & Accessibility*
*Context gathered: 2026-06-01*
