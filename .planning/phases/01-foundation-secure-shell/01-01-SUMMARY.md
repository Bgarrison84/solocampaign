---
phase: 01-foundation-secure-shell
plan: "01"
subsystem: foundation
tags: [electron, react, typescript, sqlite, drizzle, trpc, react-query, tailwind, shadcn, react-router]

requires: []

provides:
  - "Electron app scaffold with secure BrowserWindow (contextIsolation, sandbox, nodeIntegration: false)"
  - "CSP header set on every response via session.defaultSession.webRequest.onHeadersReceived"
  - "senderFrame URL validation in tRPC createContext"
  - "better-sqlite3 + Drizzle campaigns table (id, name, createdAt)"
  - "electron-trpc 0.7.1 + tRPC v10 typed IPC (campaigns list/create/get + empty prefs/secrets/window routers)"
  - "React Query v5 + proxy tRPC client in renderer"
  - "react-router-dom 7 HashRouter with / and /campaign/:id routes"
  - "Campaign list screen with empty state CTA, card grid, create modal"
  - "CampaignViewScreen stub at /campaign/:id"
  - "SoloCampaign dark OKLCH theme (amber gold primary on dark navy background)"

affects:
  - 01-02-drizzle-migrations
  - 01-03-secret-storage
  - 01-04-split-panel
  - 01-05-title-bar
  - all later phases (architecture established here)

tech-stack:
  added:
    - electron@41.7.0
    - electron-vite@3.1.0
    - electron-builder@26.x
    - react@19.x
    - react-router-dom@7.x (HashRouter)
    - better-sqlite3@12.x (prebuilt for Electron ABI 145)
    - drizzle-orm@0.36.x
    - electron-trpc@0.7.1
    - "@trpc/server@10.45.4"
    - "@trpc/client@10.45.4"
    - "@tanstack/react-query@5.x"
    - tailwindcss@4.x
    - "@radix-ui/react-dialog"
    - "@radix-ui/react-slot"
    - "@radix-ui/react-label"
    - superjson@2.x
    - zod@3.x
    - zustand@5.x
    - dayjs@1.x
    - electron-log@5.x
    - electron-store@10.x
  patterns:
    - "tRPC v10 proxy client in renderer — NOT createTRPCReact (incompatible with React Query v5)"
    - "React Query v5 useQuery/useMutation wraps tRPC proxy client calls"
    - "Drizzle ORM in main process only — renderer never imports better-sqlite3"
    - "electron-trpc exposeElectronTRPC in preload + createIPCHandler in main"
    - "HashRouter for Electron renderer routing (file:// URL compatible)"
    - "OKLCH color tokens in globals.css for SoloCampaign dark fantasy theme"
    - "WAL + NORMAL pragmas on SQLite open"
    - "senderFrame URL validation in tRPC createContext"

key-files:
  created:
    - src/main/index.ts
    - src/main/db/schema.ts
    - src/main/db/index.ts
    - src/main/db/campaignsRepo.ts
    - src/main/trpc/_base.ts
    - src/main/trpc/router.ts
    - src/main/trpc/routers/campaigns.ts
    - src/main/trpc/routers/prefs.ts
    - src/main/trpc/routers/secrets.ts
    - src/main/trpc/routers/window.ts
    - src/main/trpc/schemas.ts
    - src/preload/index.ts
    - src/renderer/index.html
    - src/renderer/src/main.tsx
    - src/renderer/src/App.tsx
    - src/renderer/src/lib/trpc.ts
    - src/renderer/src/lib/queryClient.ts
    - src/renderer/src/lib/utils.ts
    - src/renderer/src/screens/CampaignListScreen.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - src/renderer/src/components/CreateCampaignModal.tsx
    - src/renderer/src/components/CampaignCard.tsx
    - src/renderer/src/components/NewCampaignCard.tsx
    - src/renderer/src/components/EmptyState.tsx
    - src/renderer/src/components/ui/button.tsx
    - src/renderer/src/components/ui/dialog.tsx
    - src/renderer/src/components/ui/input.tsx
    - src/renderer/src/components/ui/label.tsx
    - src/renderer/src/styles/globals.css
    - src/renderer/public/placeholder-cover.svg
    - electron.vite.config.ts
    - electron-builder.yml
    - package.json
    - tsconfig.json
  modified: []

key-decisions:
  - "Electron 41 chosen over 42: better-sqlite3 v12 prebuilt binaries exist for ABI 145 (Electron 41); Electron 42 ABI 146 has no prebuilt and MSVC source build fails due to V8 API changes"
  - "tRPC proxy client (createTRPCProxyClient) instead of createTRPCReact: @trpc/react-query@10 requires React Query v4 but plan specifies v5; proxy client + direct useQuery/useMutation is the compatible approach"
  - "Electron-trpc 0.7.1 + tRPC v10 (per RESEARCH): electron-trpc does not support tRPC v11"
  - "react-resizable-panels@^3 pinned (per RESEARCH): shadcn Resizable wrapper broken on v4"
  - "superjson wired as tRPC transformer for Date round-trips across IPC"
  - "CSP pre-allows LLM provider endpoints in connect-src (Phase 3 ready)"
  - "Empty placeholder routers for prefs/secrets/window so 01-03/04/05 can fill without touching router.ts"

patterns-established:
  - "Pattern: React Query v5 + tRPC proxy client — use useQuery({ queryKey, queryFn: () => trpc.X.query() }) pattern throughout"
  - "Pattern: Drizzle in main only — renderer uses tRPC IPC, never imports better-sqlite3/drizzle-orm"
  - "Pattern: All tRPC inputs have Zod schemas from schemas.ts for reuse across procedures"
  - "Pattern: Campaign IDs are UUID v4 server-generated, never user-supplied"

requirements-completed:
  - FOUND-01
  - FOUND-02
  - SESS-01

duration: 85min
completed: 2026-05-22
---

# Phase 1 Plan 01: Walking Skeleton Summary

**Secure Electron app scaffold with better-sqlite3 + Drizzle + electron-trpc v10 + React Query v5, campaign CRUD round-trip from modal to SQLite, dark OKLCH fantasy theme**

## Performance

- **Duration:** ~85 min
- **Started:** 2026-05-22T20:44:52Z
- **Completed:** 2026-05-22T22:10:00Z
- **Tasks:** 3
- **Files modified:** 30+

## Accomplishments

- Electron app scaffold with fully locked security baseline (contextIsolation, sandbox, nodeIntegration: false, CSP, senderFrame validation)
- better-sqlite3 v12 + Drizzle ORM campaigns table with WAL pragmas — create/list/get working end-to-end via tRPC
- Campaign list UI with empty state CTA, card grid (minmax(280px, 1fr)), create modal with Zod validation
- react-router-dom 7 HashRouter routing / and /campaign/:id
- SoloCampaign dark OKLCH theme (amber gold primary on dark navy) applied in globals.css
- tRPC router skeleton with campaigns (implemented) + prefs/secrets/window (empty placeholders for 01-03/04/05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fork boilerplate, install deps, setup routing** - `4edced8` (feat)
2. **Task 2: Secure BrowserWindow, CSP, tRPC router skeleton, Drizzle DB** - `3884fb2` (feat)
3. **Task 3: Campaign list UI, create modal, empty state, campaign view stub** - `956e6b3` (feat)
4. **Chore: package-lock.json** - `17ce392` (chore)

## Files Created/Modified

- `src/main/index.ts` — Secure BrowserWindow + CSP headers + senderFrame IPC validation + electron-trpc handler
- `src/main/db/schema.ts` — Drizzle campaigns table (id, name, createdAt)
- `src/main/db/index.ts` — SQLite open with WAL/NORMAL/foreign_keys pragmas + CREATE TABLE IF NOT EXISTS
- `src/main/db/campaignsRepo.ts` — list/create/get Drizzle queries
- `src/main/trpc/_base.ts` — initTRPC with superjson transformer
- `src/main/trpc/router.ts` — Root router composing campaigns/prefs/secrets/window
- `src/main/trpc/routers/campaigns.ts` — Implemented list/create/get procedures
- `src/main/trpc/routers/prefs.ts` — Empty t.router({}) placeholder for 01-04
- `src/main/trpc/routers/secrets.ts` — Empty t.router({}) placeholder for 01-03
- `src/main/trpc/routers/window.ts` — Empty t.router({}) placeholder for 01-05
- `src/main/trpc/schemas.ts` — campaignNameSchema (trim+min1+max80) + campaignIdSchema (uuid)
- `src/preload/index.ts` — exposeElectronTRPC + platform contextBridge
- `src/renderer/src/main.tsx` — HashRouter + QueryClientProvider root
- `src/renderer/src/App.tsx` — Routes for / and /campaign/:id
- `src/renderer/src/lib/trpc.ts` — createTRPCProxyClient with ipcLink + superjson
- `src/renderer/src/screens/CampaignListScreen.tsx` — Card grid + empty state + modal
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Campaign loaded stub
- `src/renderer/src/components/CreateCampaignModal.tsx` — Radix Dialog, name input, validation
- `src/renderer/src/components/CampaignCard.tsx` — Card with cover + dayjs metadata
- `src/renderer/src/components/EmptyState.tsx` — "Start your first campaign" CTA
- `src/renderer/src/styles/globals.css` — SoloCampaign OKLCH dark theme tokens
- `src/renderer/public/placeholder-cover.svg` — 320x180 fantasy mountain SVG (<2KB)
- `electron.vite.config.ts` — Main build with better-sqlite3 external
- `electron-builder.yml` — ASAR config with asarUnpack for native modules
- `package.json` — All dependencies with version pins

## Decisions Made

1. **Electron 41 over 42**: better-sqlite3 v12 prebuilt binary exists for Electron ABI 145 (Electron 41). Electron 42 (ABI 146) has no prebuilt and MSVC build fails due to V8 API removals (v8::External::Value, v8::Context::GetIsolate). Electron 41.7.0 is the working target.

2. **tRPC proxy client instead of createTRPCReact**: @trpc/react-query@10 declares peerDependency on @tanstack/react-query@^4 but the plan specifies v5. Using createTRPCProxyClient + direct React Query v5 useQuery/useMutation is fully compatible.

3. **OKLCH theme tokens**: Applied SoloCampaign dark fantasy theme directly in globals.css — --primary: oklch(0.78 0.10 78) amber gold, --background: oklch(0.16 0.005 260) dark navy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Electron 42 incompatible with better-sqlite3 v12 on Windows MSVC**
- **Found during:** Task 1 (npm install + electron-rebuild)
- **Issue:** better-sqlite3 v12 uses v8::External::Value() and v8::Context::GetIsolate() which were removed in Electron 42's V8. Build fails with 15+ MSVC C2039/C2660 errors. No prebuilt binary available for ABI 146.
- **Fix:** Downgraded to Electron 41.7.0 (ABI 145). Prebuilt binary `better-sqlite3-v12.10.0-electron-v145-win32-x64.tar.gz` downloaded automatically by electron-rebuild.
- **Files modified:** package.json (electron version pin)
- **Verification:** `npx @electron/rebuild -f -w better-sqlite3` exits with "Rebuild Complete"; better_sqlite3.node present in Release/
- **Committed in:** 4edced8

**2. [Rule 1 - Bug] @trpc/react-query@10 incompatible with React Query v5**
- **Found during:** Task 1 (npm install)
- **Issue:** @trpc/react-query@10 declares peerDependency @tanstack/react-query@^4 (not ^5). Plan specifies both tRPC v10 AND React Query v5, but they cannot be cleanly combined via createTRPCReact.
- **Fix:** Used createTRPCProxyClient (vanilla tRPC client) combined with React Query v5 useQuery/useMutation directly. This is fully type-safe and functionally equivalent for this plan's needs.
- **Files modified:** src/renderer/src/lib/trpc.ts, src/renderer/src/main.tsx (removed tRPC.Provider), all components use useQuery/useMutation from @tanstack/react-query
- **Verification:** TypeScript typecheck passes; build succeeds
- **Committed in:** 3884fb2

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for the app to build on Windows. No scope creep. The proxy client approach is architecturally sound and maintains type safety.

## Issues Encountered

- `__builtin_frame_address` in Electron 42's cppgc/heap.h is GCC-only; MSVC doesn't support it. Patched the header as a debugging step but the deeper V8 API removals required the Electron 41 downgrade.
- Space in project path ("Claude CLI") caused a node-gyp warning about spaces in path. Non-blocking — electron-rebuild completed successfully.

## Known Stubs

- `src/renderer/src/screens/CampaignViewScreen.tsx` — Shows "Campaign loaded: {name}" placeholder. 01-04 replaces with split-panel + 5-tab shell.
- `src/main/trpc/routers/prefs.ts` — Empty router. 01-04 fills with panel size prefs.
- `src/main/trpc/routers/secrets.ts` — Empty router. 01-03 fills with SecretStorageService procedures.
- `src/main/trpc/routers/window.ts` — Empty router. 01-05 fills with minimize/maximize/close.
- SQLite table created via raw `CREATE TABLE IF NOT EXISTS` — 01-02 replaces with Drizzle `migrate()`.

## Next Phase Readiness

- Architecture proven: secure Electron + SQLite + Drizzle + electron-trpc v10 + React Query v5 + react-router-dom 7 all wired and building.
- 01-02 can add Drizzle migrate() startup, WAL integrity check, backup rotation, single-instance lock.
- 01-03 can fill the empty `secretsRouter` with SecretStorageService.
- 01-04 can replace the campaign view stub with the split-panel shell.
- 01-05 can implement the custom frameless title bar.

## Self-Check: PASSED

- src/main/index.ts: FOUND
- src/main/trpc/router.ts: FOUND
- src/main/trpc/routers/secrets.ts: FOUND
- src/main/trpc/routers/prefs.ts: FOUND
- src/main/trpc/routers/window.ts: FOUND
- src/main/db/schema.ts: FOUND
- src/renderer/src/screens/CampaignListScreen.tsx: FOUND
- src/renderer/src/components/CreateCampaignModal.tsx: FOUND
- Commit 4edced8: verified in git log
- Commit 3884fb2: verified in git log
- Commit 956e6b3: verified in git log

---
*Phase: 01-foundation-secure-shell*
*Completed: 2026-05-22*
