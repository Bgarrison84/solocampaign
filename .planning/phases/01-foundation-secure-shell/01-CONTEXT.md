# Phase 1: Foundation & Secure Shell - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can install SoloCampaign on Windows/macOS/Linux, launch it, create a new campaign that persists across restarts, and see the split-panel layout shell — on a secure-by-default Electron baseline backed by SQLite.

**In scope:** Electron app scaffold, secure BrowserWindow config, SQLite + Drizzle schema + auto-run migrations, electron-trpc typed IPC, campaign list/create/open flow, split-panel shell (react-resizable-panels), all 5 right-panel tabs as empty shells, custom frameless title bar, safeStorage encrypt/decrypt wrapper + unit tests, single-instance lock, WAL + integrity check + backup rotation, packaged builds + smoke tests on all 3 platforms.

**Out of scope:** AI chat (Phase 3), character builder content (Phase 2), all tab content beyond empty shells (respective phases), code signing (removed entirely), Apple Developer ID / Azure Trusted Signing (not required).

</domain>

<decisions>
## Implementation Decisions

### Scaffold

- **D-01:** Fork `daltonmenezes/electron-app` boilerplate. It ships React 19 + TS + Tailwind v4 + shadcn/ui + electron-vite + GitHub Actions release pipeline pre-configured.
- **D-02:** Strip all demo pages and placeholder components in the first task before building anything. Clean baseline from the start.
- **D-03:** No code signing, ever. Ship unsigned installers. README documents bypass steps: Windows: "More info > Run anyway" (SmartScreen); macOS: "right-click > Open" (Gatekeeper bypass). No Apple Developer ID or Azure Trusted Signing required.

### Campaign Home Screen

- **D-04:** Campaign list uses a card grid (2–3 columns). Each card shows a generic fantasy placeholder image, campaign name, and "Created X days ago." When Phase 2 ships cover images, the card slot is already there.
- **D-05:** "Create New Campaign" uses a modal dialog — just a name field + Create button. Minimal Phase 1 scope.
- **D-06:** Navigation uses React Router 7 (`react-router-dom 7.x`) with named routes: `/` = campaign list, `/campaign/:id` = campaign view (split panel). Hash-based or memory router for Electron compatibility (no server-side routing needed).
- **D-07:** Empty state on first launch: campaign card grid with a large "Start your first campaign" CTA button (not auto-open modal). User learns the pattern they'll repeat.

### Split-Panel Layout

- **D-08:** All 5 right-panel tabs render as empty shells from day one: Character Sheet, Combat Tracker, NPC Tracker, Session Journal, Inventory. Each shows a minimal "Content coming in Phase X" placeholder. No tab is hidden or added later — the structure is permanent.
- **D-09:** Default active tab on entering a campaign: **Character Sheet**.
- **D-10:** Left panel (narrative chat area) shows a simple centered placeholder: "AI narration appears here." No skeleton bubbles.
- **D-11:** Default split ratio: **60/40** (chat/right panel). User-resizable via react-resizable-panels v3 (v3 installed in 01-01; v4 breaks shadcn Resizable wrapper per 01-RESEARCH.md Pitfall #1).

### Window Chrome

- **D-12:** Custom frameless window (`titleBarStyle: 'hidden'` on macOS, `frame: false` on Windows/Linux). App renders its own title bar inside the dark theme.
- **D-13:** Title bar content: app name ("SoloCampaign") + campaign name on the left (campaign name shows only when inside a campaign, not on the home screen). Custom close/minimize/maximize buttons on the right for Windows/Linux; macOS keeps native traffic lights but the title area is themed.
- **D-14:** Default window size on first launch: **1280 × 800**. Window size and position persist in user preferences (Electron `store` or `settings.json` in userData).

### safeStorage Wrapper

- **D-15:** Phase 1 ships the full `SecretStorageService` — `encrypt(key, value)`, `decrypt(key)`, `exists(key)` wrapper around `safeStorage.encryptString()` / `decryptString()` — with Vitest unit tests. Phase 3 imports it and adds the provider config UI. On headless Linux where `safeStorage.isEncryptionAvailable()` returns false, log a clear warning and fall back to base64 (with warning shown in the UI settings screen — Phase 3 responsibility).

### SQLite Safety Stack

- **D-16:** Full safety stack in Phase 1:
  - WAL mode: `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`
  - `PRAGMA integrity_check` on every app launch (fast for small DBs)
  - Backup rotation: copy `solocampaign.db` to `solocampaign-backup-{timestamp}.db` before each session open, keep last 10 copies, delete oldest beyond 10.
- **D-17:** Migrations auto-run at startup via Drizzle's `migrate()`. Migration SQL files are in the `asarUnpack` list in electron-builder config so they're accessible at packaged runtime.

### Single-Instance Lock

- **D-18:** `app.requestSingleInstanceLock()` enforces single instance. On second-instance attempt: focus and bring the existing window to front (`mainWindow.focus()`). No secondary notification.

### Unit Testing

- **D-19:** Phase 1 includes Vitest unit tests for:
  - SQLite repository CRUD round-trips (create/read campaign, persist + retrieve across connection close)
  - `SecretStorageService` encrypt/decrypt (mocked `safeStorage`)
  - Zod schemas for all IPC payloads (parse valid + reject invalid input)
  - Plus packaged smoke builds (CI matrix: `windows-latest`, `macos-latest`, `ubuntu-latest`) that verify the app launches and the DB file is created.

### App Icon

- **D-20:** Planner generates a placeholder icon set using `electron-icon-builder` (or equivalent) from a simple dark-themed PNG source. Outputs `.icns` (macOS), `.ico` (Windows), `.png` (Linux). Stored in `build/icons/`. Can be replaced with real art at any time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Core value, constraints, key decisions (Electron, SQLite, AI provider abstraction, offline-first)
- `.planning/REQUIREMENTS.md` — 53 v1 REQ-IDs; Phase 1 requirements: FOUND-01, FOUND-02, FOUND-04, SESS-01
- `.planning/ROADMAP.md` § "Phase 1: Foundation & Secure Shell" — Goal, success criteria, phase notes, dependencies

### Research & Stack
- `.planning/research/SUMMARY.md` — Stack rationale, architecture approach, critical pitfalls 1/3/4/5/6 (insecure Electron config, native module rebuild, WAL corruption, key leakage), boilerplate recommendation

### No external ADRs or specs — decisions fully captured in this CONTEXT.md and the planning files above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — green field. daltonmenezes/electron-app boilerplate will be the starting point.

### Established Patterns
- The daltonmenezes/electron-app boilerplate establishes: electron-vite multi-process build (main/preload/renderer), shadcn/ui component structure, Tailwind v4 theming baseline.
- Drizzle ORM with better-sqlite3: synchronous driver in main process only; renderer never touches the DB directly.
- electron-trpc pattern: tRPC router in main process, typed client in renderer via `ipcMain`/`ipcRenderer` — all IPC goes through this, no raw `contextBridge` calls.

### Integration Points
- Phase 2 fills: Character Sheet tab content, cover image slot on campaign cards, character creation flow.
- Phase 3 fills: Left chat panel, AI provider config UI (uses `SecretStorageService` from D-15).
- All later phases add content to the right-panel tabs without changing the tab structure.

</code_context>

<specifics>
## Specific Ideas

- **App name in UI:** "SoloCampaign" (matches project name exactly)
- **Theme direction:** "Subtle fantasy" dark UI — Tailwind v4 dark palette, muted gold/amber accents, no neon; consistent with shadcn/ui OKLCH theme tokens
- **Placeholder tab content:** Minimal, honest. e.g., Character Sheet tab: "Your character sheet will appear here after character creation (Phase 2)." Not decorative skeletons.
- **Boilerplate:** `daltonmenezes/electron-app` — planner should verify the current main branch is still React 19 + Tailwind v4 before forking (research was conducted 2026-05-19).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope creep surfaced.

</deferred>

---

*Phase: 1-Foundation & Secure Shell*
*Context gathered: 2026-05-19*
