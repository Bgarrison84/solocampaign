---
phase: 1
slug: foundation-secure-shell
type: walking-skeleton
mode: mvp
created: 2026-05-19
---

# Phase 1 — Walking Skeleton

> The thinnest possible end-to-end slice that proves the SoloCampaign architecture is wired correctly. **Plan 01-01 ships exactly this slice.** Plans 01-02 through 01-08 layer hardening, polish, tests, and CI on top of a proven foundation.

---

## Goal of the Skeleton

Prove these six load-bearing technologies cooperate, end-to-end, in a single user-visible interaction (create a campaign):

1. **Secure-by-default Electron** (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP)
2. **better-sqlite3** opened from the main process with WAL pragmas
3. **Drizzle ORM** with a single `campaigns` table created directly via raw SQL (full migrations are added in 01-02)
4. **electron-trpc 0.7.1 + tRPC v10** typed IPC over `exposeElectronTRPC`/`ipcLink`
5. **React Query** wrapping tRPC client in the renderer
6. **react-router-dom 7 HashRouter** for routing (`electron-router-dom` from the boilerplate is replaced)

If `npm run dev` opens, the campaign list renders an empty grid, the "+ New Campaign" card opens a modal that inserts a row, the row appears in the list, and the row survives a restart — the architecture works. Everything else in Phase 1 is hardening.

---

## Skeleton Scope (Plan 01-01 only)

| Concern | What ships in skeleton | What is DEFERRED to a later 01-NN plan |
|---------|------------------------|----------------------------------------|
| Boilerplate fork | `npx degit daltonmenezes/electron-app solocampaign`; strip demo per D-02; replace `electron-router-dom` → `react-router-dom@7`; replace package.json metadata for SoloCampaign | — |
| BrowserWindow security | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`, CSP header on `session.defaultSession.webRequest.onHeadersReceived` | Frameless window + title bar chrome → 01-05; window size persistence → 01-05 |
| SQLite | Open `solocampaign.db` in `app.getPath('userData')`; `PRAGMA journal_mode=WAL; synchronous=NORMAL; foreign_keys=ON`; create `campaigns` table inline with `CREATE TABLE IF NOT EXISTS` (raw) | Real Drizzle migrations + integrity_check + backup rotation + single-instance lock → 01-02 |
| Drizzle | `drizzle-orm` + schema file declaring `campaigns` table; campaignsRepo uses Drizzle query builder | drizzle-kit migration files + `migrate()` at startup → 01-02 |
| tRPC router skeleton | `src/main/trpc/router.ts` composes routers from `routers/campaigns.ts`, `routers/prefs.ts`, `routers/secrets.ts`, `routers/window.ts`. Campaigns router fully implemented (list, create, get). Prefs/secrets/window routers exported as **empty `t.router({})` placeholders** so plans 01-03/04/05 can fill them without touching `router.ts`. | secrets procedures → 01-03; prefs procedures → 01-04; window procedures → 01-05 |
| Renderer routing | `HashRouter`, routes `/` (CampaignListScreen) and `/campaign/:id` (CampaignViewScreen stub) | — |
| Campaign list UI | Card grid (`repeat(auto-fill, minmax(280px, 1fr))`), "+ New Campaign" card, empty-state "Start your first campaign" CTA per D-04/D-07; Create modal per D-05 (name field, validation, Esc/Enter); cards show name + `dayjs.fromNow()` per UI-SPEC | Final dark theme + UI-SPEC color tokens already applied here (the design system is part of the boilerplate fork + shadcn add) — but split-panel layout, tab shell, and title bar all defer |
| Campaign view stub | `/campaign/:id` renders a placeholder "Campaign loaded" text — proves routing works | Split panel + 5-tab shell → 01-04 |
| `superjson` transformer | Wired in tRPC create + ipcLink so Date round-trips correctly | — |
| Sender-frame validation | `createIPCHandler({ createContext: ({event}) => {…check senderFrame.url…} })` per RESEARCH §5 | — |

**Skeleton explicitly does NOT include:** Drizzle migrate() at startup, backup rotation, integrity_check, single-instance lock, SecretStorageService, split-panel layout, 5-tab shell, custom title bar, window size persistence, real app icons (placeholder boilerplate icons stay), unit tests, packaged smoke builds, CI matrix.

---

## Acceptance Criteria (Skeleton)

The Walking Skeleton plan (01-01) is **done** when ALL of the following are observably true on a developer machine running `npm run dev`:

1. `npm run dev` opens an Electron window without errors in the main or renderer console
2. The window renders the campaign list at `/` (hash route `#/`)
3. With zero campaigns in the DB, the empty-state CTA "Start your first campaign" is visible (per D-07 — modal does NOT auto-open)
4. Clicking the empty-state CTA OR the "+ New Campaign" card opens the Create modal (per D-05)
5. Submitting the modal with a valid name (1–80 chars, trimmed) closes the modal and the new card appears in the list with `Created today` metadata
6. Navigating to `/campaign/:id` (via clicking the card) renders the campaign view stub
7. Killing `npm run dev` and relaunching shows the campaign still present (proves SQLite persistence)
8. `BrowserWindow` `webPreferences` literally contains `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` (grep assertion against `src/main/index.ts`)
9. `session.defaultSession.webRequest.onHeadersReceived` sets a CSP header containing `default-src 'self'` (grep assertion)
10. `package.json` declares `@trpc/server@^10` and `@trpc/client@^10` (NOT `^11`)
11. `package.json` declares `react-resizable-panels@^3` (NOT `^4`) — pinned now even though the Resizable component isn't wired until 01-04
12. `src/main/trpc/routers/secrets.ts`, `prefs.ts`, `window.ts` each export an empty `t.router({})` so downstream plans can add procedures without editing `router.ts`

---

## What Each Subsequent Plan Adds On Top

| Plan | Wave | Adds | Validates |
|------|------|------|-----------|
| **01-02 Drizzle Migrations & SQLite Safety Stack** | 2 | Replaces raw `CREATE TABLE IF NOT EXISTS` with proper Drizzle migration via `drizzle-kit generate`; calls `migrate()` at startup; adds WAL + integrity_check + backup rotation (D-16, D-17); single-instance lock BEFORE DB open (D-18); `asarUnpack`/`extraResources` for migrations in `electron-builder.yml` | FOUND-02 fully (versioned migrations + safety stack) |
| **01-03 SecretStorageService + Secrets IPC** | 2 | Adds `src/main/secrets/secretStorageService.ts` with safeStorage wrapper + base64 fallback (D-15); fills the empty `secrets` tRPC router with `exists/set/delete` (NO `get`) | FOUND-04 |
| **01-04 Split-Panel UI & 5-Tab Shell** | 2 | Replaces `/campaign/:id` stub with `ResizablePanelGroup` 60/40 (D-11); 5-tab strip with Character Sheet default (D-08, D-09); all 5 placeholder tab bodies per UI-SPEC Copywriting Contract; fills `prefs` router with panel-size getters/setters; chat-panel placeholder (D-10) | SESS-01 layout |
| **01-05 Custom Frameless Title Bar + Window Persistence** | 2 | Switches BrowserWindow to `titleBarStyle: 'hidden'`/`frame: false` (D-12); renders custom `TitleBar.tsx` with app name + campaign name + Win/Linux controls (D-13); CSS `-webkit-app-region: drag`; fills `window` router with `minimize/maximize/close/isMaximized`; exposes `process.platform` via contextBridge; persists 1280×800 default + window size/position via `electron-store` (D-14) | SESS-01 chrome |
| **01-06 Placeholder App Icons** | 2 | Generates `.icns` / `.ico` / `.png` set via `electron-icon-builder` from a dark-themed source PNG (D-20); stores in `build/icons/`; updates BrowserWindow `icon:` path | FOUND-01 (icons present for packaged builds) |
| **01-07 Unit Test Suite** | 3 | `vitest.config.ts`; all Wave 0 test files from VALIDATION.md (campaignsRepo, migrate, secretStorageService, schemas, secrets contract, CampaignView, TabPanel); `__mocks__/electron.ts` for safeStorage mock | D-19 unit tests; all four REQ IDs gain automated coverage |
| **01-08 Packaged Smoke Builds, electronegativity & CI** | 3 | `scripts/smoke/smoke.win.ps1`, `smoke.mac.sh`, `smoke.linux.sh`; `.github/workflows/smoke.yml` matrix (windows-latest/macos-latest/ubuntu-latest); `npx electronegativity -i dist/` CI step; README documents D-03 macOS/Windows unsigned-bypass instructions | FOUND-01 fully (packaged binaries on all 3 OSes) |

---

## Why This Order

1. **Skeleton first (01-01)** — Proves the riskiest unknowns (tRPC v10 pin, react-router-dom replacement, sandbox+contextIsolation+CSP not breaking renderer, better-sqlite3 native rebuild via `electron-builder install-app-deps`) are real before investing in safety stack, UI polish, or tests.
2. **Wave 2 hardens in parallel** — Once the skeleton works, 01-02 through 01-06 touch disjoint file sets (db/, secrets/, screens+components for split panel, components for title bar + main window config, build/icons + electron-builder.yml). All can execute concurrently.
3. **Wave 3 validates** — Unit tests (01-07) cover the now-existing source files; packaged smoke + CI (01-08) closes FOUND-01 by proving the artifacts work on all three OSes.

---

## Out of Scope (Even For Walking Skeleton)

- Light theme, font scaling, high contrast (Phase 8 — A11Y)
- Delete-campaign action (no plan in Phase 1; UI-SPEC declares destructive surface but no Phase 1 surface uses it)
- Cover image import (Phase 2 — placeholder SVG only)
- Real character sheet, combat tracker, NPC tracker, session journal, inventory content (later phases — Phase 1 ships empty shells only)
- Apple Developer ID / Azure Trusted Signing (D-03: explicitly no code signing, ever)

---

*Last updated: 2026-05-19*
