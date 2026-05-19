# Phase 1: Foundation & Secure Shell — Research

**Researched:** 2026-05-19
**Domain:** Electron desktop app foundation (cross-platform shell, SQLite persistence, typed IPC, secure-by-default baseline)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fork `daltonmenezes/electron-app` boilerplate. Ships React 19 + TS + Tailwind v4 + shadcn/ui + electron-vite + GitHub Actions release pipeline pre-configured.
- **D-02:** Strip all demo pages and placeholder components in the first task before building anything. Clean baseline from the start.
- **D-03:** No code signing, ever. Ship unsigned installers. README documents bypass steps: Windows ("More info > Run anyway" for SmartScreen); macOS ("right-click > Open" for Gatekeeper). No Apple Developer ID or Azure Trusted Signing required.
- **D-04:** Campaign list uses a card grid (2–3 columns). Each card shows generic fantasy placeholder image, campaign name, "Created X days ago." Phase 2 fills the image slot.
- **D-05:** "Create New Campaign" uses a modal dialog — just a name field + Create button.
- **D-06:** Navigation uses React Router 7 (`react-router-dom 7.x`) with named routes: `/` = list, `/campaign/:id` = view. Hash-based or memory router for Electron (no server-side routing).
- **D-07:** Empty state on first launch: card grid with a large "Start your first campaign" CTA (NOT auto-open modal).
- **D-08:** All 5 right-panel tabs render as empty shells from day one: Character Sheet, Combat Tracker, NPC Tracker, Session Journal, Inventory. Each shows "Content coming in Phase X" placeholder. Tab structure is permanent.
- **D-09:** Default active tab when entering a campaign: **Character Sheet**.
- **D-10:** Left panel (chat) shows centered placeholder: "AI narration appears here." NO skeleton bubbles.
- **D-11:** Default split ratio: **60/40** (chat/right). User-resizable via react-resizable-panels v4.
- **D-12:** Frameless window (`titleBarStyle: 'hidden'` on macOS, `frame: false` on Windows/Linux). App renders its own title bar.
- **D-13:** Title bar content: app name "SoloCampaign" + campaign name on left (campaign name only inside a campaign). Custom close/minimize/maximize on right for Win/Linux; macOS keeps native traffic lights but title area is themed.
- **D-14:** Default window size on first launch: **1280 × 800**. Size and position persist (electron-store or settings.json in userData).
- **D-15:** Phase 1 ships full `SecretStorageService` — `encrypt`, `decrypt`, `exists` around `safeStorage.encryptString`/`decryptString` — with Vitest unit tests. Phase 3 imports it. Headless Linux fallback: when `safeStorage.isEncryptionAvailable()` is false, log warning, fall back to base64 (UI warning is Phase 3's job).
- **D-16:** Full SQLite safety stack: WAL mode (`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`), `PRAGMA integrity_check` on launch, backup rotation (copy `solocampaign.db` to `solocampaign-backup-{timestamp}.db` before each session open, keep last 10).
- **D-17:** Migrations auto-run at startup via Drizzle's `migrate()`. Migration SQL files in `asarUnpack` so they're accessible at packaged runtime.
- **D-18:** `app.requestSingleInstanceLock()`. On second-instance attempt: focus and bring existing window to front (`mainWindow.focus()`). No secondary notification.
- **D-19:** Vitest unit tests for: SQLite repository CRUD round-trips, `SecretStorageService` encrypt/decrypt (mocked safeStorage), Zod schemas for all IPC payloads. Plus packaged smoke builds (CI matrix: windows-latest, macos-latest, ubuntu-latest) that verify the app launches and the DB file is created.
- **D-20:** Generate placeholder icon set using `electron-icon-builder` (or equivalent) from a dark-themed PNG source. Outputs `.icns` / `.ico` / `.png`, stored in `build/icons/`. Replaceable later.

### Claude's Discretion

- Exact electron-trpc setup pattern (router structure, link layering, React Query integration)
- Exact BrowserWindow webPreferences object beyond what's required
- Exact backup rotation scheduling (per-session-open vs other triggers)
- Exact campaign schema columns beyond {id, name, createdAt}
- File/folder layout inside `src/main/`, `src/preload/`, `src/renderer/`
- Whether to use `electron-store` or a plain `settings.json` for window-size persistence (D-14 allows either)
- Test framework configuration details (Vitest config, mocks)
- CI workflow YAML structure (one job per OS vs matrix)
- Whether `superjson` is wired into electron-trpc transformer

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | User can install and launch SoloCampaign on Windows (.exe), macOS, and Linux | electron-builder 26 targets (NSIS / DMG / AppImage), CI matrix smoke-test pattern documented below |
| FOUND-02 | All campaign data persists locally in SQLite with versioned schema migrations | better-sqlite3 11 + Drizzle 0.45 + auto-run `migrate()` at startup; ASAR resolution pattern documented below |
| FOUND-04 | API keys are stored encrypted via Electron safeStorage (never plaintext) | `SecretStorageService` wrapper around `safeStorage.encryptString`/`decryptString`, headless Linux fallback handling documented below |
| SESS-01 | User can play in a split-panel layout (narrative left, 5-tab panel right) | react-resizable-panels v4 + shadcn `Resizable` wrapper (with v4-compat patch documented below); all 5 tabs are empty shells per D-08 |

</phase_requirements>

## Executive Summary

Phase 1 is the **architectural spine** of SoloCampaign — every later phase will write code on top of these foundations. Three of the six critical risks from `research/SUMMARY.md` are addressed here: insecure Electron config (#1), better-sqlite3 native module rebuild (#4), and SQLite WAL corruption (#6). API key leakage (#5) is also pre-emptively addressed via the `SecretStorageService` wrapper landing now even though it's not wired into UI until Phase 3.

The recommended path is unusually well-trodden. The `daltonmenezes/electron-app` boilerplate (v3.0.3, Dec 2025) ships React 19 + TypeScript 5 + Tailwind v4 + shadcn/ui + electron-vite + electron-builder + a GitHub Actions release workflow — so 80% of the scaffold is already correct on day one. The remaining work is wiring the SoloCampaign-specific bits onto that base: SQLite + Drizzle, electron-trpc, the secure BrowserWindow config, the split-panel shell, and the campaign list/create flow.

**The single biggest planner-must-decide question** surfaced by this research: **tRPC version pinning.** The original `electron-trpc@0.7.1` (Dec 2024) only supports tRPC v10.x. tRPC v11 is the current `latest` tag on npm — but the only v11-compatible electron-trpc integration is a community fork (`trpc-electron` by mat-sz, last published Dec 2024, no GitHub source repo linked from the npm record) or an alpha experimental package. **Pragmatic recommendation: pin `@trpc/server@10.x` and use stock `electron-trpc@0.7.1`.** This is the boring, low-risk choice for a Phase 1 foundation. The whole industry that uses electron-trpc is on this combo. Revisit when the original electron-trpc adds v11 support.

The second planner-must-decide question: **react-resizable-panels v4 + shadcn `Resizable` compatibility.** v4 renamed `PanelGroup`→`Group` and `PanelResizeHandle`→`Separator`. The shadcn/ui `Resizable` wrapper (which the boilerplate uses) was authored against v3 and was broken at the time of research [CITED: github.com/shadcn-ui/ui/issues/9197 — issue is open, no official patch]. **Recommendation: pin `react-resizable-panels@3.x` for Phase 1** to avoid hand-patching shadcn's `Resizable.tsx`. Migrate to v4 when shadcn ships the upgrade.

**Primary recommendation:** Fork the boilerplate, strip the demo content in the very first task, then build the Walking Skeleton (campaign-list → create-modal → split-view) before adding any safety stack or test infrastructure. Land the secure baseline + IPC plumbing + DB migration on top of the Walking Skeleton. Land tests last. Smoke-builds in CI come at phase exit.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Campaign persistence (CRUD) | Main (better-sqlite3 + Drizzle) | — | Renderer must NEVER import `better-sqlite3` or `fs`. Synchronous DB driver lives in main only. Three of six critical pitfalls map to this. |
| IPC typing & validation | Main (tRPC router + Zod) | Preload (exposeElectronTRPC) | tRPC router is THE only IPC surface. Every procedure has a Zod schema. Preload exposes the bridge; renderer consumes via ipcLink. |
| Window chrome & BrowserWindow security | Main (`app.whenReady`, `BrowserWindow` ctor) | Preload (contextBridge) | Locked secure baseline — contextIsolation true, sandbox true, nodeIntegration false — set at BrowserWindow construction. Renderer is treated as untrusted. |
| Title bar UI (frameless) | Renderer (React) | Main (window controls IPC) | macOS uses native traffic lights via `titleBarStyle: 'hidden'`. Windows/Linux: custom buttons in React, IPC calls `mainWindow.minimize/maximize/close`. CSS `-webkit-app-region: drag` on the bar. |
| Split-panel layout | Renderer (react-resizable-panels v3 + shadcn Resizable) | Main (persist sizes via electron-store IPC) | Pure UI primitive. Sizes persist per-campaign via a small `prefs` tRPC procedure. |
| Routing | Renderer (`react-router-dom` 7, HashRouter / MemoryRouter) | — | Hash routing avoids file:// URL issues in packaged Electron. No server-side routing needed. |
| safeStorage encrypt/decrypt | Main (`SecretStorageService` wrapping `safeStorage`) | — | `safeStorage` lives in main only. Renderer never sees a plaintext key. tRPC procedure exposes the verbs, not the storage. |
| Migrations | Main (Drizzle `migrate()` at app start) | electron-builder (`asarUnpack`) | Migrations folder ships as `extraResources` or under `asarUnpack`; resolve path differently in dev vs packaged. |
| WAL pragmas, integrity check, backup rotation | Main (run once after DB opens, before any write) | — | Pure main-process startup hook. No renderer involvement. |
| Single-instance lock | Main (`app.requestSingleInstanceLock` + `second-instance` event) | — | Must run BEFORE `app.whenReady()`. If lock not acquired, `app.quit()` immediately. |
| Build + package + sign | electron-builder (`build/` config in package.json) | GitHub Actions matrix | All three OSes build their own native installers. No code signing per D-03. |

## Standard Stack

### Core (all packages [VERIFIED: slopcheck OK + npm registry + Context7/official docs path])

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` | **42.2.0** (latest; pin to 41.x per STACK.md guidance for one-major-behind stability) | Chromium + Node runtime | The shell. STACK.md pins 41.x for "second-newest major"; 42 is current `latest`. Planner picks pin. |
| `electron-vite` | **5.0.0** | Build orchestrator for main/preload/renderer with Vite | The 2025–2026 consensus build framework. Already in the boilerplate. |
| `electron-builder` | **26.8.1** | Cross-platform packaging | Already in the boilerplate. Outputs NSIS / DMG / AppImage / deb. |
| `@electron/rebuild` | **4.0.4** | Rebuild native modules against Electron's Node ABI | Required for better-sqlite3 to load in packaged builds. `electron-rebuild` (no scope) is the deprecated old name. |
| `react` | **19.2.6** (use 19.x) | UI | First-class shadcn/ui + Vercel AI SDK hooks support. |
| `react-dom` | **19.2.6** | DOM bindings | Pair with react@19. |
| `react-router-dom` | **7.15.1** | In-app navigation | Use `HashRouter` for Electron (avoids `file://` path issues). [CITED: react-router.com] |
| `better-sqlite3` | **12.10.0** | Native synchronous SQLite | Synchronous API is the right shape on local disk. 30ms cold-start vs ~450ms Prisma. Already standardized across Electron ecosystem. |
| `drizzle-orm` | **0.45.2** | Type-safe SQL builder | Lightweight, zero-runtime overhead, type inference from schema. |
| `drizzle-kit` | **0.31.10** | Migration authoring CLI | Generates SQL migration files from schema. Dev dependency only. |
| `electron-trpc` | **0.7.1** | Typed IPC over Electron's contextBridge | **Pin tRPC v10**; see Pitfalls. The only mature option. |
| `@trpc/server` | **10.45.4** (v10 line; latest in v10 dist-tag) | tRPC core | v11 is incompatible with electron-trpc 0.7.1. **Use v10.** |
| `@trpc/client` | **10.45.x** (match server) | tRPC client | Match server major. |
| `zod` | **4.4.3** | Schema validation at every boundary | Used in every tRPC procedure input. Non-negotiable per security baseline. |
| `zustand` | **5.0.13** | UI state | Per STACK.md. Phase 1 stores: ui slice (window dims, active campaign). |
| `@tanstack/react-query` | **5.100.11** | Async IPC state | Wraps tRPC client. Cache invalidation, loading/error states. |
| `@tanstack/react-query-devtools` | **5.100.11** | Dev-only React Query inspector | Dev dependency. Helps debug IPC during phase. |
| `react-resizable-panels` | **3.x** (pin — see Pitfall #1) | Split-panel layout | shadcn's `Resizable` wrapper is broken on v4. Pin to v3 for now. |
| `tailwindcss` | **4.1.6** | Styling | Already in boilerplate. v4 OKLCH tokens drive the UI-SPEC theme. |
| `lucide-react` | **11.1.8** (use latest) | Icon set | Used by shadcn components and the custom title bar. |
| `electron-store` | **11.0.2** | Small JSON store in userData | App prefs only (window size/pos, panel sizes). NOT campaign data. |
| `electron-log` | **5.4.4** | Structured logging to userData | Essential for debugging public unsigned builds. |
| `dayjs` | **1.11.20** | Date math | "Created X days ago" on campaign cards. |
| `vitest` | **4.1.6** (slopcheck flagged as SUS — false positive; vitest is the canonical Vite test runner, >12M weekly downloads) | Unit testing | Per D-19. Mocks for safeStorage. |
| `superjson` | **2.2.6** (optional) | Transformer for tRPC over IPC | Lets you pass `Date` and `Map` through IPC. Worth adding now. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `electron-icon-builder` | **2.0.1** | Generate `.icns` / `.ico` / `.png` set from one PNG | Per D-20. One-time icon generation step. |
| `@doyensec/electronegativity` | **1.10.3** | CLI security linter for Electron config | Per STACK.md / Critical Pitfall #1. Add as a CI step that runs after build. |
| `@electron/notarize` | **3.1.1** | macOS notarization | NOT used per D-03 (no signing). Listed only for awareness — keep out of dependencies. |
| `immer` | **11.1.0** (optional) | Ergonomic deep updates in Zustand | Optional; Phase 1 state is shallow. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `electron-trpc@0.7.1` + tRPC v10 | `trpc-electron@0.1.2` (mat-sz fork) + tRPC v11 | Fork is 1 year old, no source repo linked on npm, smaller community. Stick with v10. |
| `electron-trpc@0.7.1` + tRPC v10 | `electron-trpc-experimental@1.0.0-alpha.1` + tRPC v11 | Alpha is alpha. Don't bet a foundation on it. |
| `react-resizable-panels@3.x` + shadcn Resizable | `react-resizable-panels@4.x` + hand-patched shadcn Resizable | Have to maintain a fork of shadcn's `Resizable.tsx`. Pin v3 instead, migrate when shadcn updates. |
| `HashRouter` for Electron | `MemoryRouter` | Hash router preserves URL on reload; memory router does not. Hash router is the better fit. |
| Drizzle `migrate()` at startup | `prebuild` migration script | Per D-17, in-app `migrate()` is the locked decision. Don't change. |
| `electron-store` for window prefs | Plain `settings.json` in userData | Either works per D-14. electron-store has typed schema support — pick it. |
| `@electron/rebuild` postinstall | `electron-builder --rebuild` flag at package time | Postinstall keeps dev builds and packaged builds consistent. Recommended. |

**Installation (run after `npx degit daltonmenezes/electron-app solocampaign && cd solocampaign && npm install`):**

```bash
# Strip demo first (per D-02), then add SoloCampaign deps.
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit @electron/rebuild

npm install electron-trpc@0.7.1 @trpc/server@10 @trpc/client@10 zod
npm install zustand @tanstack/react-query
npm install -D @tanstack/react-query-devtools

# Pin v3 to match shadcn's Resizable wrapper
npm install react-resizable-panels@^3

npm install react-router-dom electron-store electron-log dayjs superjson lucide-react

npm install -D vitest @doyensec/electronegativity electron-icon-builder

# Rebuild native modules against Electron ABI — must run after every electron upgrade
npx @electron/rebuild -f -w better-sqlite3
```

**Version verification (npm view, 2026-05-19):** electron 42.2.0, electron-vite 5.0.0, electron-builder 26.8.1, @electron/rebuild 4.0.4, electron-trpc 0.7.1 (latest stable, Dec 2024), @trpc/server 11.17.0 latest / 10.45.4 v10 dist-tag, react 19.2.6, react-router-dom 7.15.1, react-resizable-panels 4.11.1 latest / 3.x stable, better-sqlite3 12.10.0, drizzle-orm 0.45.2, drizzle-kit 0.31.10, zod 4.4.3, zustand 5.0.13, @tanstack/react-query 5.100.11, tailwindcss 4.1.6, lucide-react 11.1.8, electron-store 11.0.2, electron-log 5.4.4, vitest 4.1.6, @doyensec/electronegativity 1.10.3, dayjs 1.11.20, electron-icon-builder 2.0.1.

## Package Legitimacy Audit

slopcheck (v0.6.1) ran on 30 npm packages on 2026-05-19. All 29 of the critical-path packages came back `[OK]`. One false positive — `vitest` flagged `[SUS]` ("close to 'vite'") which is a documented false positive; vitest is the canonical Vite-native test runner with >12M weekly downloads on npm.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| electron | npm | 11+ yrs | github.com/electron/electron | [OK] | Approved |
| electron-vite | npm | 3+ yrs | github.com/alex8088/electron-vite | [OK] | Approved |
| electron-builder | npm | 9+ yrs | github.com/electron-userland/electron-builder | [OK] | Approved |
| react / react-dom | npm | 13+ yrs | github.com/facebook/react | [OK] | Approved |
| react-router-dom | npm | 11+ yrs | github.com/remix-run/react-router | [OK] | Approved |
| tailwindcss | npm | 8+ yrs | github.com/tailwindlabs/tailwindcss | [OK] | Approved |
| better-sqlite3 | npm | 8+ yrs | github.com/WiseLibs/better-sqlite3 | [OK] | Approved |
| drizzle-orm / drizzle-kit | npm | 3+ yrs | github.com/drizzle-team/drizzle-orm | [OK] | Approved |
| @electron/rebuild | npm | 8+ yrs (renamed from electron-rebuild) | github.com/electron/rebuild | [OK] | Approved |
| electron-trpc | npm | 3 yrs | github.com/jsonnull/electron-trpc | [OK] | Approved (note: low recent activity — last publish Dec 2024) |
| @trpc/server / @trpc/client | npm | 4+ yrs | github.com/trpc/trpc | [OK] | Approved |
| zod | npm | 5+ yrs | github.com/colinhacks/zod | [OK] | Approved |
| zustand | npm | 6+ yrs | github.com/pmndrs/zustand | [OK] | Approved |
| @tanstack/react-query | npm | 5+ yrs | github.com/TanStack/query | [OK] | Approved |
| react-resizable-panels | npm | 2+ yrs | github.com/bvaughn/react-resizable-panels | [OK] | Approved |
| electron-store | npm | 9+ yrs | github.com/sindresorhus/electron-store | [OK] | Approved |
| electron-log | npm | 9+ yrs | github.com/megahertz/electron-log | [OK] | Approved |
| dayjs | npm | 7+ yrs | github.com/iamkun/dayjs | [OK] | Approved |
| lucide-react | npm | 3+ yrs | github.com/lucide-icons/lucide | [OK] | Approved |
| immer | npm | 8+ yrs | github.com/immerjs/immer | [OK] | Approved |
| superjson | npm | 5+ yrs | github.com/flightcontrolhq/superjson | [OK] | Approved |
| @doyensec/electronegativity | npm | 6+ yrs | github.com/doyensec/electronegativity | [OK] | Approved |
| electron-icon-builder | npm | 5+ yrs | github.com/safu9/electron-icon-builder | [OK] | Approved |
| @electron/notarize | npm | 5+ yrs | github.com/electron/notarize | [OK] | Approved (unused per D-03) |
| vitest | npm | 3+ yrs | github.com/vitest-dev/vitest | [SUS] (false positive — typosquat-close-to-`vite` heuristic) | Approved with note |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `vitest` — false positive (slopcheck heuristic flags name-similarity to `vite`; vitest is the canonical Vite test runner with >12M weekly downloads). **Approved.** Planner does NOT need to gate this behind a checkpoint.

**Note on `trpc-electron` fork (mat-sz):** slopcheck rates this `[OK]` but warns "No source repository linked. Harder to verify what this code actually does." Since the stack uses original `electron-trpc` + tRPC v10, the fork is NOT installed. If the planner later decides to use it, gate behind a `checkpoint:human-verify` task.

## Walking Skeleton

> The smallest end-to-end slice that proves the architecture works.

**The Walking Skeleton for Phase 1 is:**

1. **Fork + strip** the daltonmenezes boilerplate. Confirm `npm run dev` opens an empty window.
2. **Add the secure BrowserWindow config** (contextIsolation/sandbox true, nodeIntegration false, custom CSP). Confirm `npm run dev` still opens.
3. **Open a SQLite database** in `app.getPath('userData') + '/solocampaign.db'` from main, apply WAL pragmas, create a `campaigns` table directly (no migrations yet — that comes later in the phase). Confirm the file appears on disk.
4. **Wire one tRPC procedure** end-to-end: `campaigns.list()` returns rows from SQLite. Renderer calls it via tRPC client + React Query. Confirm an empty array renders.
5. **Wire one mutation**: `campaigns.create({name})` inserts a row and returns it. Renderer calls it from a basic button. Confirm the new campaign appears in the next `campaigns.list()` call.
6. **Add the router**: `/` shows the (empty) campaign list with a "+ New Campaign" button that triggers `campaigns.create`. Navigate to `/campaign/:id` shows a placeholder.

That's the skeleton. **At this point the architecture is proven** — secure Electron + SQLite + Drizzle + tRPC + React Query + react-router are all working together. Everything else in Phase 1 is hardening (migrations, safety stack, safeStorage wrapper, custom title bar, split-panel UI, tests, CI) layered on top of a proven slice.

**Walking-skeleton acceptance criteria:**
- `npm run dev` launches a window
- The window shows an empty campaign list at `/`
- Clicking "+ New Campaign" inserts a row and the row appears in the list
- Killing and restarting `npm run dev` shows the campaign persisted
- BrowserWindow `webPreferences` has `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`

The Walking Skeleton is the **first wave** of the plan. Every other deliverable in Phase 1 is downstream of this.

## Implementation Approach

### 1. Boilerplate Fork Procedure

[VERIFIED: github.com/daltonmenezes/electron-app via WebFetch + repo description]

**Action:** `npx degit daltonmenezes/electron-app solocampaign` (NOT `git clone` — degit avoids inheriting the boilerplate's git history).

**Current state (verified 2026-05-19):**
- v3.0.3 released Dec 7, 2025
- React 19 + TS 5 + Tailwind v4 + shadcn/ui + electron-vite + electron-builder
- Uses **Biome** for linting/formatting (not Prettier — call this out in the plan; user may want to swap to standard ESLint+Prettier, or keep Biome)
- Pre-configured GitHub Actions release pipeline (Win + Mac + Linux binaries)
- Latest activity is recent (137 commits in main)

**Strip checklist (first task of the phase, per D-02):**
- [ ] Delete `src/renderer/src/screens/` demo pages (Home, About, etc.)
- [ ] Delete demo components in `src/renderer/src/components/` that are not generic shadcn primitives
- [ ] Delete demo IPC handlers in `src/main/` (electron-router-dom routes that come pre-wired)
- [ ] Delete demo `src/preload/` exports
- [ ] Replace `package.json` `name`, `productName`, `description`, `author`, `repository.url` with SoloCampaign values
- [ ] Replace `build/icons/` placeholder icons with SoloCampaign placeholder (per D-20 — generate via electron-icon-builder)
- [ ] Replace `electron-builder.yml` `appId`, `productName`, `directories.output` with SoloCampaign values
- [ ] Keep the GitHub Actions workflow but update artifact names

**Gotchas:**
- The boilerplate ships an in-app router called `electron-router-dom` (NOT react-router-dom). Per D-06 the project uses react-router-dom 7. **Action: replace `electron-router-dom` with `react-router-dom`** in the first task.
- Biome lint config may conflict with team preferences. Decision is out of CONTEXT.md scope — planner should ask the user, OR keep Biome (default).

### 2. electron-trpc Setup

[VERIFIED: github.com/jsonnull/electron-trpc README + WebFetch on electron-trpc.dev]

**Pin combo: `electron-trpc@0.7.1` + `@trpc/server@10.x` + `@trpc/client@10.x`.** Do NOT use tRPC v11 — electron-trpc 0.7.1 does not support it. The mat-sz `trpc-electron` fork that supports v11 is 1 year stale and has no source repo linked on npm.

**Required BrowserWindow webPreferences:**

```typescript
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,        // REQUIRED by electron-trpc
    sandbox: true,                 // safe — electron-trpc works with sandbox
    nodeIntegration: false,
    preload: path.join(__dirname, '../preload/index.js'),
  },
})
```

**Main process (`src/main/trpc/router.ts`):**

```typescript
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import superjson from 'superjson'

const t = initTRPC.create({ transformer: superjson })

export const router = t.router({
  campaigns: t.router({
    list: t.procedure.query(() => campaignsRepo.list()),
    create: t.procedure
      .input(z.object({ name: z.string().trim().min(1).max(80) }))
      .mutation(({ input }) => campaignsRepo.create(input)),
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => campaignsRepo.get(input.id)),
  }),
  prefs: t.router({
    getWindowSize: t.procedure.query(() => store.get('windowSize')),
    setWindowSize: t.procedure
      .input(z.object({ width: z.number(), height: z.number() }))
      .mutation(({ input }) => store.set('windowSize', input)),
    getPanelSizes: t.procedure
      .input(z.object({ campaignId: z.string() }))
      .query(({ input }) => store.get(`panelSizes.${input.campaignId}`)),
    setPanelSizes: t.procedure
      .input(z.object({ campaignId: z.string(), sizes: z.array(z.number()) }))
      .mutation(({ input }) => store.set(`panelSizes.${input.campaignId}`, input.sizes)),
  }),
  secrets: t.router({
    // Phase 1 ships the verbs even though the UI lives in Phase 3.
    exists: t.procedure.input(z.object({ key: z.string() })).query(({ input }) => secretStorage.exists(input.key)),
    set: t.procedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(({ input }) => secretStorage.encrypt(input.key, input.value)),
    delete: t.procedure
      .input(z.object({ key: z.string() }))
      .mutation(({ input }) => secretStorage.remove(input.key)),
    // Note: NO `get` procedure that returns plaintext over IPC. Phase 3 will add a per-request scoped use pattern.
  }),
})

export type AppRouter = typeof router
```

**Main process (`src/main/index.ts` — after `app.whenReady()`):**

```typescript
import { createIPCHandler } from 'electron-trpc/main'
createIPCHandler({ router, windows: [mainWindow] })
```

**Preload (`src/preload/index.ts`):**

```typescript
import { exposeElectronTRPC } from 'electron-trpc/main'
process.once('loaded', () => { exposeElectronTRPC() })
```

**Renderer (`src/renderer/src/lib/trpc.ts`):**

```typescript
import { createTRPCProxyClient } from '@trpc/client'
import { ipcLink } from 'electron-trpc/renderer'
import superjson from 'superjson'
import type { AppRouter } from '../../../main/trpc/router'

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
  transformer: superjson,
})
```

**IPC channel count for Phase 1: ~11 procedures total** (3 campaigns + 4 prefs + 3 secrets + 1 window control — counted above). All MUST have Zod input schemas. The contextBridge attack surface is a single channel (`electron-trpc`) — that's the whole point of using tRPC.

### 3. better-sqlite3 + @electron/rebuild + asarUnpack

[VERIFIED: WebSearch + better-sqlite3 troubleshooting docs + multiple medium articles 2024-2026]

**package.json scripts:**

```json
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps",
    "rebuild:sqlite": "electron-rebuild -f -w better-sqlite3"
  }
}
```

`electron-builder install-app-deps` is the standard postinstall — it rebuilds all native deps against Electron's ABI. The explicit `electron-rebuild -f -w better-sqlite3` is a manual fallback for when CI is misbehaving.

**electron-builder.yml (asarUnpack):**

```yaml
asar: true
asarUnpack:
  - "**/node_modules/better-sqlite3/**"
  - "resources/migrations/**"   # see Drizzle section below
```

**Why asarUnpack matters:** Native `.node` binaries can fail to load from inside an ASAR archive on some platforms. Unpacking them puts the binary on the filesystem where the OS can load it cleanly. Migration SQL files unpack for the same reason — Drizzle's `migrate()` reads them via `fs`.

**Smoke test for packaged builds (per D-19):** in CI, after `npm run build`, install the artifact, launch the binary headless, and verify `app.getPath('userData') + '/solocampaign.db'` is created. Concrete approach:
- **Windows:** GitHub Actions `windows-latest` runner, `Start-Process` the built `.exe` with `--no-sandbox` flag, wait 5s, check the file exists, kill the process.
- **macOS:** `macos-latest`, `open` the `.app`, wait, check, kill. Note: unsigned apps on macos-latest require `xattr -d com.apple.quarantine`.
- **Linux:** `ubuntu-latest`, run the AppImage with `xvfb-run -a` (no display server), check file, kill.

A reference Playwright-electron approach is also possible (more thorough), but adds dependency surface. For Phase 1, a shell-script smoke is sufficient.

### 4. Drizzle ORM + auto-run migrate()

[CITED: drizzle-team/drizzle-orm discussion #1891 — ASAR migration footgun] [VERIFIED: drizzle docs + community workaround]

**The ASAR footgun:** Drizzle's `migrate()` reads `meta/_journal.json` and `*.sql` files from disk. Inside an ASAR archive, file paths are different — and Drizzle's migrator does not auto-resolve into asar mode. Without `asarUnpack`, packaged builds throw `Can't find meta/_journal.json file at readMigrationFiles`.

**Solution (per discussion #1891 and community consensus):**

1. Put migration files in a **dedicated folder**, e.g. `resources/migrations/`, NOT under `src/`.
2. Add to `electron-builder.yml` `extraResources` (preferred — explicit) OR `asarUnpack` (works too):

   ```yaml
   extraResources:
     - from: resources/migrations
       to: migrations
   ```
3. **Resolve the path differently in dev vs packaged:**

   ```typescript
   import { app } from 'electron'
   import { join } from 'path'

   const migrationsFolder = app.isPackaged
     ? join(process.resourcesPath, 'migrations')
     : join(__dirname, '../../resources/migrations')
   ```
4. Call `migrate()` at startup, BEFORE any other DB access:

   ```typescript
   import { drizzle } from 'drizzle-orm/better-sqlite3'
   import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
   import Database from 'better-sqlite3'

   const sqlite = new Database(dbPath)
   sqlite.pragma('journal_mode = WAL')
   sqlite.pragma('synchronous = NORMAL')

   const db = drizzle(sqlite)
   migrate(db, { migrationsFolder })
   ```

**Initial campaigns schema (Phase 1 only — keep minimal):**

```typescript
// src/main/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),                              // UUID v4 string
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
})
```

**Generate migration once with `drizzle-kit`:**
```bash
npx drizzle-kit generate --schema=./src/main/db/schema.ts --out=./resources/migrations --dialect=sqlite
```

That's the entire Phase 1 schema. Phase 2 will add characters, parties, etc.

### 5. Secure BrowserWindow Config + CSP + electronegativity

[CITED: electronjs.org/docs/latest/tutorial/security]

**The locked baseline (must appear EXACTLY in `BrowserWindow` ctor):**

```typescript
new BrowserWindow({
  width: 1280, height: 800,                  // D-14
  minWidth: 1024, minHeight: 700,
  titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',  // D-12
  frame: process.platform === 'darwin',      // D-12: false on Win/Linux, true on macOS (titleBarStyle handles macOS chrome)
  backgroundColor: '#1f2126',                // UI-SPEC dominant color, prevents white flash
  show: false,                               // show after ready-to-show event
  icon: path.join(__dirname, '../../build/icons/icon.png'),
  webPreferences: {
    contextIsolation: true,                  // CRITICAL: default since Electron 12, never disable
    sandbox: true,                           // CRITICAL: default since Electron 20, never disable
    nodeIntegration: false,                  // CRITICAL: default since Electron 5, never enable
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    preload: path.join(__dirname, '../preload/index.js'),
  },
})
```

**CSP header (set on every response in main):**

```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +   // Tailwind v4 emits inline styles for OKLCH custom properties
        "img-src 'self' data: blob:; " +         // data: for placeholder cover SVG
        "font-src 'self'; " +
        "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com http://localhost:* http://127.0.0.1:*; " +  // Phase 3 needs cloud + local LLM connect-src
        "object-src 'none'; base-uri 'none'; form-action 'none';"
      ],
    },
  })
})
```

Phase 1 strictly doesn't need the LLM hosts in `connect-src`, but locking the CSP here saves a Phase 3 amendment.

**senderFrame validation on every IPC handler:** electron-trpc wraps `ipcMain.handle` internally. Add a global sender-frame check in the tRPC context creator:

```typescript
createIPCHandler({
  router,
  windows: [mainWindow],
  createContext: ({ event }) => {
    const senderUrl = event.senderFrame?.url ?? ''
    if (!senderUrl.startsWith('file://') && !senderUrl.startsWith('app://') && !senderUrl.startsWith('http://localhost:')) {
      throw new Error('IPC sender frame URL not allowed')
    }
    return {}
  },
})
```

**electronegativity in CI:** after `npm run build`, run `npx electronegativity -i dist/` — fails the CI job if any HIGH-severity finding appears.

### 6. SecretStorageService (safeStorage wrapper)

[CITED: electronjs.org/docs/latest/api/safe-storage]

**Encryption backends (per platform):**
- **Windows:** DPAPI (only the logged-in user can decrypt)
- **macOS:** Keychain (`safeStorage`'s key is stored in Keychain; the cipher uses AES-128-GCM)
- **Linux:** prefers `kwallet6` / `kwallet5` / `kwallet` / `gnome-libsecret` in that order. On headless Linux, falls back to a hard-coded plaintext password — `safeStorage.getSelectedStorageBackend()` returns `'basic_text'`.

**`SecretStorageService` API (matches D-15):**

```typescript
// src/main/secrets/secretStorageService.ts
import { safeStorage, app } from 'electron'
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export class SecretStorageService {
  private dir = path.join(app.getPath('userData'), 'secrets')

  async init() {
    if (!existsSync(this.dir)) await mkdir(this.dir, { recursive: true })
  }

  private filepath(key: string) {
    // Restrict key to safe filesystem chars; never let a key escape the dir
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, '_')
    return path.join(this.dir, `${safe}.enc`)
  }

  isSecure(): boolean {
    return safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend() !== 'basic_text'
  }

  async encrypt(key: string, value: string): Promise<void> {
    if (this.isSecure()) {
      const buf = safeStorage.encryptString(value)
      await writeFile(this.filepath(key), buf)
    } else {
      // Headless Linux fallback — D-15 says base64 with a warning
      console.warn('[SecretStorage] safeStorage unavailable; using base64 fallback. Keys are NOT encrypted.')
      await writeFile(this.filepath(key), Buffer.from('B64:' + Buffer.from(value).toString('base64')))
    }
  }

  async decrypt(key: string): Promise<string | null> {
    const fp = this.filepath(key)
    if (!existsSync(fp)) return null
    const buf = await readFile(fp)
    if (buf.subarray(0, 4).toString() === 'B64:') {
      return Buffer.from(buf.subarray(4).toString(), 'base64').toString()
    }
    return safeStorage.decryptString(buf)
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.filepath(key))
  }

  async remove(key: string): Promise<void> {
    const fp = this.filepath(key)
    if (existsSync(fp)) await unlink(fp)
  }
}
```

**Vitest mock (per D-19):**

```typescript
// __mocks__/electron.ts (or vi.mock in the test file)
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/solocampaign-test' },
  safeStorage: {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'gnome-libsecret',
    encryptString: (s: string) => Buffer.from('ENC:' + s),
    decryptString: (b: Buffer) => b.toString().replace(/^ENC:/, ''),
  },
}))
```

**Required tests:** round-trip (encrypt then decrypt returns same), exists() returns true after write, exists() returns false after delete, base64 fallback when `isEncryptionAvailable()` returns false (separate test with different mock), keys with special characters get normalized safely.

### 7. react-resizable-panels v3 + shadcn Resizable

**Pin to v3.x.** v4 renamed exports (`PanelGroup`→`Group`, `PanelResizeHandle`→`Separator`) and shadcn's `Resizable.tsx` wrapper has NOT been updated [CITED: github.com/shadcn-ui/ui/issues/9197].

**Usage in the campaign view:**

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { trpc } from '@/lib/trpc'
import { useQuery, useMutation } from '@tanstack/react-query'

export function CampaignView({ campaignId }: { campaignId: string }) {
  const { data: sizes } = useQuery({
    queryKey: ['panelSizes', campaignId],
    queryFn: () => trpc.prefs.getPanelSizes.query({ campaignId }),
  })
  const setSizes = useMutation({
    mutationFn: (s: number[]) => trpc.prefs.setPanelSizes.mutate({ campaignId, sizes: s }),
  })

  return (
    <ResizablePanelGroup
      direction="horizontal"
      onLayout={(s) => setSizes.mutate(s)}
      autoSaveId={`campaign-${campaignId}`}  // v3 built-in persistence — backs up tRPC persistence
    >
      <ResizablePanel defaultSize={sizes?.[0] ?? 60} minSize={30}>
        <ChatPanel />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={sizes?.[1] ?? 40} minSize={25}>
        <TabPanel campaignId={campaignId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
```

**Note:** v3's `autoSaveId` writes to `localStorage` — that works fine in Electron's renderer. The tRPC-persisted sizes are belt-and-suspenders (also survive `localStorage` wipes).

### 8. Custom Frameless Window + Title Bar

[CITED: UI-SPEC § Title Bar + electronjs.org TitleBarStyle docs]

**macOS:** `titleBarStyle: 'hidden'` (Electron auto-renders traffic lights at left; the title bar area is themed; click-through works because `-webkit-app-region: drag` covers the bar). No custom min/max/close buttons. macOS 32px title bar height to clear traffic lights.

**Windows/Linux:** `frame: false`. App renders its own min/max/close icons on the right. 36px title bar height. Use lucide-react `Minus`/`Square`/`X` icons. Each button calls a tRPC `window.minimize/maximize/close` procedure that resolves to `mainWindow.minimize()`/etc.

**CSS for drag region:**

```css
.titlebar {
  -webkit-app-region: drag;
  height: 36px;          /* 32px on macOS — set dynamically based on platform */
}
.titlebar button,
.titlebar .app-name {
  -webkit-app-region: no-drag;
}
```

**Platform detection in renderer:** since the renderer has no Node access, expose `process.platform` via the preload context bridge:

```typescript
// src/preload/index.ts
import { contextBridge } from 'electron'
contextBridge.exposeInMainWorld('platform', process.platform)
```

Then in React: `if (window.platform === 'darwin') ...`.

**Traffic light positioning** (only relevant for macOS, but worth pinning): default position is fine for 32px title bar. If a custom position is wanted later, use `trafficLightPosition: { x: 12, y: 8 }` in BrowserWindow ctor.

### 9. Single-Instance Lock

[CITED: electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata]

**Pattern (must run BEFORE `app.whenReady()`):**

```typescript
import { app, BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    mainWindow = new BrowserWindow({ /* ... */ })
    // ...
  })
}
```

D-18 explicitly says no secondary notification — just focus the existing window.

### 10. SQLite Safety Stack (D-16)

**Run all of this at startup, AFTER opening the SQLite connection and BEFORE running migrations:**

```typescript
// src/main/db/init.ts
import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { copyFile, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'

export async function openDatabase() {
  const userData = app.getPath('userData')
  const dbPath = path.join(userData, 'solocampaign.db')

  // 1. Backup rotation: copy current DB before opening (if it exists).
  if (existsSync(dbPath)) {
    await backupRotate(dbPath, userData)
  }

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')

  // 2. Integrity check (fast for small DBs).
  const result = sqlite.pragma('integrity_check', { simple: true })
  if (result !== 'ok') {
    console.error('[DB] integrity_check failed:', result)
    // Phase 1 logs only; Phase 2 may add a UI surface for this.
  }

  return sqlite
}

async function backupRotate(dbPath: string, userData: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(userData, `solocampaign-backup-${stamp}.db`)
  await copyFile(dbPath, backupPath)

  // Delete oldest beyond 10.
  const files = (await readdir(userData))
    .filter((f) => f.startsWith('solocampaign-backup-') && f.endsWith('.db'))
    .sort()
  while (files.length > 10) {
    const oldest = files.shift()
    if (oldest) await unlink(path.join(userData, oldest))
  }
}
```

**"Before each session open" in D-16** is interpreted as: before the SQLite connection is opened at app launch. Phase 4 (session lifecycle) may add per-session backups; Phase 1 backs up on app launch.

### 11. Campaign Schema (Phase 1)

The only Phase 1 table:

```typescript
campaigns: {
  id: string (primary key, UUID v4)
  name: string (not null, 1–80 chars validated in Zod)
  createdAt: number (unix timestamp ms, default unixepoch() * 1000)
}
```

Phase 2 will add: `characters`, `parties`, `campaigns.cover_image_path` column, etc.

### 12. CI/CD Packaged Smoke Builds (D-19)

**GitHub Actions matrix (`.github/workflows/release.yml` extension or `smoke.yml`):**

```yaml
jobs:
  smoke:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: npx electron-builder install-app-deps
      - run: npm run build         # electron-vite build + electron-builder
      - run: npm run smoke:${{ matrix.os }}   # OS-specific smoke script
```

**Smoke scripts (in `scripts/smoke/`):**
- `smoke.win.ps1`: `Start-Process .\dist\SoloCampaign.exe`; sleep 5; check `$env:APPDATA\SoloCampaign\solocampaign.db` exists; kill process.
- `smoke.mac.sh`: `xattr -d com.apple.quarantine ./dist/mac/SoloCampaign.app 2>/dev/null || true`; `open ./dist/mac/SoloCampaign.app`; sleep 5; check `~/Library/Application Support/SoloCampaign/solocampaign.db`; `pkill -f SoloCampaign`.
- `smoke.linux.sh`: `chmod +x ./dist/SoloCampaign*.AppImage`; `xvfb-run -a ./dist/SoloCampaign*.AppImage --no-sandbox &`; sleep 5; check `~/.config/SoloCampaign/solocampaign.db`; `pkill -f SoloCampaign`.

Failure on any platform fails the workflow.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 (boilerplate ships with it; verify on fork) |
| Config file | `vitest.config.ts` (Wave 0 task) |
| Quick run command | `npm run test` (unit tests only, <10s) |
| Full suite command | `npm run test && npm run smoke` (unit + packaged smoke on local OS only; full matrix is CI-only) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FOUND-01 | App launches on Windows, packaged | smoke (packaged) | `pwsh scripts/smoke/smoke.win.ps1` | ❌ Wave 0 |
| FOUND-01 | App launches on macOS, packaged | smoke (packaged) | `bash scripts/smoke/smoke.mac.sh` | ❌ Wave 0 |
| FOUND-01 | App launches on Linux, packaged | smoke (packaged) | `bash scripts/smoke/smoke.linux.sh` | ❌ Wave 0 |
| FOUND-02 | Campaign persists to SQLite | unit | `vitest run src/main/db/campaignsRepo.test.ts` | ❌ Wave 0 |
| FOUND-02 | Drizzle migrations run cleanly on fresh DB | unit | `vitest run src/main/db/migrate.test.ts` | ❌ Wave 0 |
| FOUND-02 | Drizzle migrations idempotent (second run = no-op) | unit | `vitest run src/main/db/migrate.test.ts -t "idempotent"` | ❌ Wave 0 |
| FOUND-04 | safeStorage encrypt/decrypt round-trips | unit (mocked safeStorage) | `vitest run src/main/secrets/secretStorageService.test.ts` | ❌ Wave 0 |
| FOUND-04 | safeStorage falls back to base64 on headless | unit (mocked isEncryptionAvailable=false) | `vitest run src/main/secrets/secretStorageService.test.ts -t "fallback"` | ❌ Wave 0 |
| FOUND-04 | safeStorage keys with special chars are normalized | unit | `vitest run src/main/secrets/secretStorageService.test.ts -t "key normalization"` | ❌ Wave 0 |
| FOUND-04 | secrets tRPC procedure never returns plaintext over IPC by accident | unit (snapshot tRPC schemas) | `vitest run src/main/trpc/secrets.contract.test.ts` | ❌ Wave 0 |
| SESS-01 | Split panel renders 60/40 by default | unit (renderer, jsdom) | `vitest run src/renderer/src/screens/CampaignView.test.tsx` | ❌ Wave 0 |
| SESS-01 | All 5 tabs render as empty shells | unit (renderer, jsdom) | `vitest run src/renderer/src/components/TabPanel.test.tsx` | ❌ Wave 0 |
| SESS-01 | Character Sheet tab is active by default | unit (renderer) | `vitest run src/renderer/src/components/TabPanel.test.tsx -t "default tab"` | ❌ Wave 0 |
| All IPC | Every Zod schema accepts valid + rejects invalid | unit | `vitest run src/main/trpc/schemas.test.ts` | ❌ Wave 0 |
| Window | Single-instance lock test | manual-only | (open two instances, second one focuses first, no DB corruption) | n/a |
| Security | electronegativity finds no HIGH issues | CI step | `npx electronegativity -i dist/ -s` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test` (unit only, fast)
- **Per wave merge:** `npm run test && npm run lint && npx electronegativity -i .` (no packaged build — too slow)
- **Phase gate:** Full matrix smoke in CI before `/gsd:verify-work` runs

### Wave 0 Gaps

- [ ] `vitest.config.ts` — verify boilerplate ships one; if so, extend it with main/preload/renderer test environments
- [ ] `src/main/db/campaignsRepo.test.ts` — covers FOUND-02 CRUD round-trip
- [ ] `src/main/db/migrate.test.ts` — covers FOUND-02 migration run
- [ ] `src/main/secrets/secretStorageService.test.ts` — covers FOUND-04
- [ ] `src/main/trpc/schemas.test.ts` — covers all IPC Zod schemas
- [ ] `src/main/trpc/secrets.contract.test.ts` — covers FOUND-04 IPC surface
- [ ] `src/renderer/src/screens/CampaignView.test.tsx` — covers SESS-01 layout
- [ ] `src/renderer/src/components/TabPanel.test.tsx` — covers SESS-01 tabs
- [ ] `scripts/smoke/smoke.win.ps1`, `smoke.mac.sh`, `smoke.linux.sh` — covers FOUND-01 packaged smoke
- [ ] `.github/workflows/smoke.yml` — runs the smoke scripts on the matrix
- [ ] Mock files (`__mocks__/electron.ts` or `vi.mock` setup) — required for safeStorage unit tests

## Pitfalls & Gotchas

### Pitfall 1: react-resizable-panels v4 breaks shadcn Resizable

**What goes wrong:** `npm install react-resizable-panels` pulls v4.x. shadcn's `Resizable.tsx` (which the boilerplate uses) imports `PanelGroup` and `PanelResizeHandle` — neither exists in v4 (renamed to `Group` and `Separator`). Build fails or runtime fails with `undefined is not a constructor`.

**Why it happens:** v4 renamed exports to align with ARIA roles. shadcn's wrapper has not been updated as of 2026-05 [CITED: github.com/shadcn-ui/ui/issues/9197].

**How to avoid:** Pin `"react-resizable-panels": "^3"` in package.json. **Do NOT use the `latest` tag** for this package until shadcn updates its wrapper.

**Warning signs:** Build errors mentioning `PanelGroup`, `PanelResizeHandle`, or `Group is not exported`.

### Pitfall 2: electron-trpc only supports tRPC v10

**What goes wrong:** Install electron-trpc + `@trpc/server@latest` (which is 11.17.0). Build fails or types become `any`.

**Why it happens:** electron-trpc@0.7.1 was published Dec 2024 against tRPC v10. The maintainer has not landed v11 support [CITED: github.com/jsonnull/electron-trpc/pull/194 — open].

**How to avoid:** Pin `"@trpc/server": "^10"` and `"@trpc/client": "^10"`. Use the `v10` dist-tag to pick the latest in the 10.x line. Document this pin in the package.json with a comment.

**Warning signs:** `Property 'createTRPCProxyClient' does not exist on type ...` or runtime "router has no procedures" errors.

### Pitfall 3: Drizzle's `migrate()` can't find migration files in packaged builds

**What goes wrong:** App works in dev. Packaged app crashes at startup with `Can't find meta/_journal.json file at readMigrationFiles` [CITED: drizzle-team/drizzle-orm discussion #1891].

**Why it happens:** Migration files are inside the ASAR archive at packaged-runtime. Drizzle's migrator uses `fs.readFileSync` which doesn't resolve into ASAR paths cleanly across all OSes.

**How to avoid:** Per D-17, put migrations in `extraResources` (preferred) or `asarUnpack`, and resolve the path via `app.isPackaged ? process.resourcesPath : __dirname`. Smoke-test the packaged build in CI from day one.

**Warning signs:** Works in `npm run dev` but fails in `npm run build` + run.

### Pitfall 4: better-sqlite3 NODE_MODULE_VERSION mismatch

**What goes wrong:** `npm install` succeeds, then `npm run dev` crashes with `The module ... was compiled against a different Node.js version using NODE_MODULE_VERSION ...`.

**Why it happens:** better-sqlite3's `.node` binary is compiled against the local Node.js's ABI. Electron uses its own bundled Node, which has a different ABI.

**How to avoid:** Add `"postinstall": "electron-builder install-app-deps"` to package.json. Run `npx @electron/rebuild -f -w better-sqlite3` manually after every electron version upgrade.

**Warning signs:** `NODE_MODULE_VERSION` error message in console at app startup.

### Pitfall 5: Renderer accidentally imports `better-sqlite3` or `fs`

**What goes wrong:** A developer puts a `import Database from 'better-sqlite3'` in a renderer file. Vite tries to bundle it, fails or produces a broken bundle.

**Why it happens:** Easy mistake. TypeScript autocomplete doesn't know about process boundaries.

**How to avoid:** Add an ESLint rule `no-restricted-imports` in the renderer config blocking `better-sqlite3`, `fs`, `path` (except as types). Add an electron-vite config rule to mark these as external in renderer.

**Warning signs:** Vite warnings during build about external modules in renderer.

### Pitfall 6: Windows path separators in CSP `connect-src`

**What goes wrong:** CSP works on macOS/Linux but blocks LM Studio on Windows because of how Electron normalizes localhost URLs.

**Why it happens:** Some Windows network stacks return `127.0.0.1` while macOS returns `localhost`. The CSP needs both.

**How to avoid:** Include both `http://localhost:*` and `http://127.0.0.1:*` in the `connect-src` directive (already in the CSP example above).

### Pitfall 7: macOS Gatekeeper "damaged" message for unsigned builds (D-03)

**What goes wrong:** User downloads the unsigned `.dmg`, double-clicks, gets "SoloCampaign is damaged and can't be opened. You should move it to the Trash."

**Why it happens:** macOS quarantines downloaded files. Without notarization, the OS treats them as untrusted.

**How to avoid:** Per D-03, the README documents `xattr -cr /Applications/SoloCampaign.app` OR right-click → Open. The phase plan should include a `README.md` task that captures this instruction.

**Warning signs:** Users will report "damaged" errors on macOS. The fix is documentation, not code.

### Pitfall 8: WAL mode + multi-process access

**What goes wrong:** A second SoloCampaign launches (lock fails, but the second-instance event handler runs). Both processes briefly touch the WAL file. Corruption is possible.

**Why it happens:** Even though `requestSingleInstanceLock` prevents two instances from running, there's a race window between the second process opening the DB and getting denied the lock.

**How to avoid:** Open the SQLite connection AFTER the single-instance lock is confirmed. The lock check runs FIRST, before any DB code. (See section 9 above — the lock check gates `app.whenReady`.)

**Warning signs:** Rare DB corruption reports under heavy launch-spam testing.

### Pitfall 9: integrity_check on a corrupted WAL

**What goes wrong:** `PRAGMA integrity_check` returns a string like `*** in database main *** Page 5: ...` instead of `'ok'`. App boots with a corrupted DB.

**How to avoid:** Check the result. If not `'ok'`, write to electron-log at ERROR level, restore from the most recent backup (Phase 1 logs only; Phase 2+ may add UI to surface this).

### Pitfall 10: Headless Linux safeStorage returns `basic_text`

**What goes wrong:** On a CI Linux VM or a server-side Linux user with no keyring, `safeStorage.isEncryptionAvailable()` returns `true` but `getSelectedStorageBackend()` returns `'basic_text'` — meaning the key is encrypted with a HARD-CODED PLAINTEXT PASSWORD.

**Why it happens:** Electron's API contract on Linux is "encryption is available" even when the backend is the trivial fallback. [CITED: electronjs.org/docs/latest/api/safe-storage]

**How to avoid:** Check BOTH `isEncryptionAvailable()` AND that `getSelectedStorageBackend() !== 'basic_text'`. The `SecretStorageService.isSecure()` method in section 6 above does this. When backend is `basic_text`, use the base64 fallback path (which honestly logs a warning) — don't pretend `safeStorage` provided real protection.

### Pitfall 11: Boilerplate uses `electron-router-dom`, not `react-router-dom`

**What goes wrong:** D-06 says React Router 7. Boilerplate has electron-router-dom (a different package).

**How to avoid:** First task replaces electron-router-dom with react-router-dom 7. Use `HashRouter` (NOT `BrowserRouter`) for Electron — file:// URLs don't play with browser router.

### Pitfall 12: Vite externalizes better-sqlite3 — but only with explicit config

**What goes wrong:** electron-vite's default config may try to bundle better-sqlite3 into the main bundle. The native `.node` binary doesn't bundle.

**How to avoid:** In `electron.vite.config.ts`, add to the main config: `build: { rollupOptions: { external: ['better-sqlite3'] } }`. (electron-vite usually handles this, but verify on the boilerplate fork.)

### Pitfall 13: `process.platform` doesn't reach the renderer cleanly

**What goes wrong:** Title bar needs to know whether to render custom controls (Win/Linux) or not (macOS). `process` isn't available in a sandboxed renderer.

**How to avoid:** Expose `process.platform` via contextBridge in preload (see section 8). Or expose it via a tRPC `system.platform` query. ContextBridge is simpler.

## Open Questions

1. **Pinned Electron version: 41 or 42?**
   - What we know: STACK.md and STATE.md say "Electron 41" (one major behind 42). npm registry shows 42.2.0 is latest.
   - What's unclear: Is the planner free to bump to 42, or does the user want 41?
   - Recommendation: Default to 41 per STATE.md, but flag for user review. 42 is fine if user accepts the "newest stable" risk.

2. **Should `superjson` be wired in as the tRPC transformer?**
   - What we know: superjson lets `Date` and `Map` flow through IPC; without it, dates round-trip as strings.
   - What's unclear: Whether Phase 1 needs Date objects in IPC (campaigns.createdAt could just stay as a number).
   - Recommendation: Wire it in. The marginal cost is one dependency and 4 lines of config; the benefit is no surprise serialization issues across phases.

3. **Biome (boilerplate default) vs ESLint + Prettier (most common elsewhere)?**
   - What we know: Boilerplate ships with Biome.
   - What's unclear: User preference.
   - Recommendation: Keep Biome (avoid wasting a task on a swap). If user prefers ESLint+Prettier later, it's a 1-task migration.

4. **Backup rotation trigger: per session-open or per app-launch?**
   - What we know: D-16 says "before each session open." Phase 1 doesn't have sessions yet.
   - What's unclear: Does "session open" mean opening a campaign, or starting an in-game session (Phase 4)?
   - Recommendation: Phase 1 backs up on app launch (the only meaningful trigger that exists). Phase 4 adds per-session backups. Document in code comment.

5. **Should the Phase 1 placeholder cover image be SVG or PNG?**
   - What we know: UI-SPEC mentions `/assets/placeholder-cover.svg`.
   - What's unclear: Whether Phase 2's user-imported images will need PNG/JPG, requiring the same `<img>` element to handle both.
   - Recommendation: SVG for Phase 1 (small, scalable). The `<img>` tag handles both — no architectural concern.

6. **Where do `npm run test` and the renderer tests live?**
   - What we know: Vitest is the framework.
   - What's unclear: Should renderer tests use jsdom or happy-dom?
   - Recommendation: jsdom (more mature, matches React Testing Library defaults).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, dev | ✓ | 24.15.0 (matches Electron 42's Node) | — |
| npm | Install | ✓ | 11.12.1 | — |
| pnpm | (alternative) | ✗ | — | npm is fine |
| yarn | (alternative) | ✗ | — | npm is fine |
| git | Boilerplate fork via degit, commits | ✓ | 2.45.1 | — |
| Python | better-sqlite3 native build (node-gyp) | ⚠ unknown | — (planner must verify) | If absent: `npm install --build-from-source=false` may use prebuilt binaries; verify before assuming |
| Visual Studio Build Tools (Windows) | better-sqlite3 native build | ⚠ unknown | — | If absent on Windows dev machine: install Build Tools OR use prebuilt-binaries (better-sqlite3 ships them) |
| GitHub Actions runners | CI matrix | ✓ (assumed — public repo gets free tier) | windows-latest, macos-latest, ubuntu-latest | — |

**Missing dependencies with no fallback:** none verified-missing.

**Missing dependencies with fallback:** Native build tools (Python + VS Build Tools on Windows, Xcode CLT on macOS, build-essential on Linux) — better-sqlite3 ships prebuilt binaries for common Node ABIs and the most recent Electron releases, so building from source is the fallback path, not the primary one. **Action: planner should add a Wave 0 task to verify `npm install` succeeds on the dev machine before committing to the path.**

## Security Domain

> Required (security_enforcement defaults to enabled in config — no explicit `false`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (Phase 1) | n/a — no user accounts; Phase 3 introduces API key handling |
| V3 Session Management | no (Phase 1) | n/a — no sessions yet (Phase 4) |
| V4 Access Control | yes (process boundaries) | senderFrame URL check in tRPC context; contextIsolation true; sandbox true |
| V5 Input Validation | **yes (every IPC procedure)** | Zod schema on every tRPC procedure input; `.trim()` + length bounds on all string inputs |
| V6 Cryptography | yes (safeStorage) | Use Electron's `safeStorage` API; NEVER hand-roll a cipher. `SecretStorageService` is a thin wrapper, not a re-implementation. |
| V7 Error Handling & Logging | yes | `electron-log` to userData; never log secret values or DB paths in production |
| V8 Data Protection | yes | safeStorage; backup files have same OS permissions as the DB (user-readable only); WAL file in userData |
| V9 Communication | no (Phase 1 — no network) | Phase 3 adds HTTPS to LLM providers |
| V14 Configuration | yes | Locked BrowserWindow config; CSP; electronegativity scan in CI |

### Known Threat Patterns for Electron + SQLite + tRPC

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer XSS → RCE via nodeIntegration | Elevation of Privilege | contextIsolation true + sandbox true + nodeIntegration false (Pitfall 1 of project research) |
| Path traversal in user-supplied campaign name → arbitrary file write | Tampering | Zod regex/length validation; never use raw user input in filesystem paths; `SecretStorageService` already normalizes keys |
| SQL injection via campaign name | Tampering | Drizzle ORM uses parameterized queries by default — NEVER use raw SQL with template literals on user input |
| Untrusted file in `connect-src` (Phase 3, but locked now) | Information Disclosure | Restrictive CSP `connect-src`; no `*` wildcards |
| `safeStorage` keychain unlock prompt confusion (macOS) | Repudiation | App icon set correctly; macOS Keychain prompt shows "SoloCampaign wants to use the safe storage key" |
| Second-instance race writes to DB | Tampering (DB corruption) | `requestSingleInstanceLock` BEFORE any DB code (Pitfall 8) |
| ASAR archive tampering | Tampering | Out of scope per D-03 (no signing); risk accepted by user |
| Plaintext API key in OS clipboard or logs (Phase 3) | Information Disclosure | `SecretStorageService` only — `electron-log` scrubs any value matching a known secret key by name (Phase 3 task) |
| Local DB file readable by other apps on shared machine | Information Disclosure | Default Electron `app.getPath('userData')` permissions are user-only on Win/Mac; on Linux respects user umask. Document this in README. |

**Phase 1 explicitly locks these from day one:**
- contextIsolation = true (Critical Pitfall #1 from SUMMARY.md)
- sandbox = true (Critical Pitfall #1)
- nodeIntegration = false (Critical Pitfall #1)
- CSP header set on every response (Critical Pitfall #1)
- electronegativity CI step (Critical Pitfall #1)
- single-instance lock BEFORE DB open (Critical Pitfall #6)
- WAL + integrity_check + backup rotation (Critical Pitfall #6)
- Zod validation on every IPC procedure (Critical Pitfall — generalized V5)
- safeStorage wrapper with secure-backend check (Critical Pitfall #5, pre-emptive for Phase 3)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `daltonmenezes/electron-app` v3.0.3 (Dec 2025) is still the current main; planner should re-verify before forking | Boilerplate Fork | Low — degit picks latest main; if there's a v3.1 by now it's fine |
| A2 | The boilerplate ships Vitest in devDependencies | Validation Architecture | Low — if not, add it in Wave 0 (cost: 1 line in package.json) |
| A3 | The boilerplate's electron-vite config externalizes native modules from the main bundle | Pitfall 12 | Medium — if not, add `external: ['better-sqlite3']` in `electron.vite.config.ts` |
| A4 | `electron-trpc@0.7.1`'s `senderFrame.url` is accessible via `event.senderFrame.url` inside `createContext` | Section 5 (senderFrame check) | Medium — verify with a runtime test in Wave 0; fallback is to use `BrowserWindow.fromWebContents(event.sender).webContents.getURL()` |
| A5 | macOS notarization is genuinely not required for users willing to right-click → Open | D-03 / Pitfall 7 | Low — explicitly user-confirmed in D-03 |
| A6 | `process.resourcesPath` resolves correctly for packaged apps on all 3 OSes | Section 4 (Drizzle migrations) | Low — standard Electron API; documented to work cross-platform |
| A7 | `xvfb-run -a` works on `ubuntu-latest` for headless Electron smoke tests | Section 12 (CI) | Medium — common pattern; if it fails, swap to `dbus-launch` or run with `--headless` flag |
| A8 | GitHub Actions free tier covers the CI matrix size for a solo public repo | Section 12 (CI) | Low — public repos get unlimited free minutes on standard runners |
| A9 | The user prefers HashRouter over MemoryRouter for routing | D-06 / Section 1 | Low — both work; HashRouter has the URL-on-reload benefit |
| A10 | Native build tools (Python, MSVS Build Tools on Windows) are either installed OR better-sqlite3 prebuilt binaries cover the Electron 41/42 + platform combos in use | Environment Availability | Medium — first `npm install` task should be a no-op smoke that catches this early |
| A11 | The chosen tRPC v10 line will receive critical security patches for the duration of Phase 1–9 (~6-12 months) | Section 2 (electron-trpc) | Medium — v10 is in maintenance mode; if a CVE drops, may need emergency migration to v11 + trpc-electron fork. Acceptable risk for now. |

## Code Examples

### Verified pattern: Single-instance lock
[CITED: electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata]
See section 9 above.

### Verified pattern: electron-trpc setup
[CITED: electron-trpc.dev + github.com/jsonnull/electron-trpc README]
See section 2 above.

### Verified pattern: Secure BrowserWindow
[CITED: electronjs.org/docs/latest/tutorial/security]
See section 5 above.

### Verified pattern: Drizzle ASAR migration resolution
[CITED: github.com/drizzle-team/drizzle-orm/discussions/1891]
See section 4 above.

### Verified pattern: safeStorage with backend check
[CITED: electronjs.org/docs/latest/api/safe-storage]
See section 6 above.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `electron-rebuild` (unscoped) | `@electron/rebuild` | 2022 (renamed) | Use the scoped name in new projects |
| Webpack-based Electron boilerplates (electron-react-boilerplate) | electron-vite | 2024 consensus | Faster HMR, faster cold start |
| Prisma in Electron | Drizzle + better-sqlite3 | 2024-2025 consensus | Smaller installer, faster queries |
| Custom contextBridge methods | electron-trpc | 2023+ | Type safety + Zod validation by default |
| `PanelGroup` / `PanelResizeHandle` (rrp v3) | `Group` / `Separator` (rrp v4) | 2025 | shadcn wrapper not yet caught up — pin v3 |
| tRPC v10 | tRPC v11 | 2025 | electron-trpc not yet caught up — pin v10 |

**Deprecated/outdated:**
- `electron-rebuild` package (unscoped) — use `@electron/rebuild`
- `nodeIntegration: true` patterns — RCE-via-XSS vector
- `remote` module — removed entirely from Electron
- `webContents.printToPDF` for character sheet export — use `@react-pdf/renderer` (Phase 5)

## Sources

### Primary (HIGH confidence)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security) — WebFetch confirmed BrowserWindow flags
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — WebFetch confirmed backends + `basic_text` fallback
- [Electron app.requestSingleInstanceLock](https://www.electronjs.org/docs/latest/api/app) — Pattern confirmed via WebSearch and official docs
- [electron-trpc GitHub](https://github.com/jsonnull/electron-trpc) — WebFetch confirmed setup pattern + version
- [Drizzle Electron Migration Discussion #1891](https://github.com/drizzle-team/drizzle-orm/discussions/1891) — ASAR footgun + workaround
- [shadcn/ui Resizable v4 Bug #9197](https://github.com/shadcn-ui/ui/issues/9197) — v4 incompatibility confirmed
- [react-resizable-panels v4 changelog](https://github.com/bvaughn/react-resizable-panels/blob/v4/CHANGELOG.md) — export rename confirmed via WebSearch
- [daltonmenezes/electron-app](https://github.com/daltonmenezes/electron-app) — current state confirmed via WebFetch
- [electron-builder asarUnpack docs](https://www.electron.build/configuration/configuration) — config pattern
- [tRPC v11 announcement](https://trpc.io/blog/announcing-trpc-v11) — version semantics

### Secondary (MEDIUM confidence)
- [Medium: electron + electron-builder + better-sqlite3 universal Mac builds](https://medium.com/@andreialex.patru/electron-electron-builder-node-sqlite3-and-universal-mac-builds-x64-and-arm64-fb7c50e1fff4) — postinstall + asarUnpack pattern
- [trpc-electron fork](https://github.com/mat-sz/trpc-electron) — fork status (1 year stale, no source repo on npm)
- [electron-trpc-experimental](https://github.com/makp0/electron-trpc-experimental) — alpha v11 alternative

### Tertiary (LOW confidence)
- Exact `xvfb-run` flag for ubuntu-latest smoke tests — pattern is common but specific flags vary
- Exact Windows path for `solocampaign.db` userData on win-latest CI runner — uses `$env:APPDATA\SoloCampaign\` but worth verifying

### Tool Outputs
- npm registry (`npm view`) — all listed versions verified live on 2026-05-19
- slopcheck (`python -m slopcheck install --ecosystem npm ...`) — 29 OK, 1 SUS (vitest, false positive)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package verified via npm + slopcheck on 2026-05-19; cross-referenced with SUMMARY.md/STACK.md
- Architecture: HIGH — standard Electron patterns; renderer-vs-main tier boundaries are textbook
- Pitfalls: HIGH — pitfalls 1, 2, 3 are recent (2025–2026) and explicitly verified via GitHub issues/discussions; pitfalls 4–13 are well-documented community knowledge
- IPC choice (electron-trpc + tRPC v10): MEDIUM (one-major-behind is a deliberate stability choice, but the v10 line is in maintenance) — Assumption A11
- Boilerplate currency: HIGH — verified v3.0.3, Dec 2025, React 19 + Tailwind v4 via WebFetch

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (30 days — stable stack, but Electron and tRPC ecosystems do shift; re-verify before any Phase 1 re-plan after that date)

---

## RESEARCH COMPLETE
