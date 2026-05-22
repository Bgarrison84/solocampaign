---
phase: 01-foundation-secure-shell
verified: 2026-05-22T17:00:00Z
status: gaps_found
score: 5/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User sees a split-panel layout (narrative chat on left, tabbed right panel) immediately on entering a campaign (ROADMAP SC-3 / SESS-01)"
    status: failed
    reason: "Plans 01-04 (split-panel shell) and 01-05 (custom title bar) are in-scope for Phase 1 per ROADMAP but have NOT been executed. CampaignViewScreen is a confirmed stub rendering 'Campaign loaded: {name}' with no panels, no tabs, and no resizable layout."
    artifacts:
      - path: "src/renderer/src/screens/CampaignViewScreen.tsx"
        issue: "Stub — renders centered heading 'Campaign loaded: {name}' only. No react-resizable-panels, no tab structure."
    missing:
      - "Execute plan 01-04: react-resizable-panels v3 split layout (60/40), 5-tab right panel shell (Character Sheet, Combat Tracker, NPC Tracker, Session Journal, Inventory)"
      - "Execute plan 01-05: custom frameless title bar, window size/position persistence via electron-store"

  - truth: "User can install and launch on Windows/macOS/Linux from a packaged build without manual dependency setup (ROADMAP SC-1 / FOUND-01 packaged-build clause)"
    status: failed
    reason: "No packaged build has been created or smoke-tested. The smoke test scripts (scripts/smoke/smoke.win.ps1, smoke.mac.sh, smoke.linux.sh) and CI matrix (.github/workflows/smoke.yml) are listed in VALIDATION.md Wave 0 requirements but none exist in the repository. FOUND-01 requires install+launch from a packaged build — dev-mode launch is insufficient evidence."
    artifacts:
      - path: "scripts/smoke/"
        issue: "Directory does not exist"
      - path: ".github/workflows/smoke.yml"
        issue: "File does not exist"
    missing:
      - "Packaged build smoke tests per VALIDATION.md Wave 0"
      - "Verify better-sqlite3 native module is correctly ASAR-unpacked in the packaged output"
      - "Verify Drizzle migrations load from process.resourcesPath in packaged mode"

  - truth: "Calling secrets.set then secrets.exists returns true; calling secrets.delete then secrets.exists returns false (FOUND-04 must-have)"
    status: failed
    reason: "SecretStorageService calls app.getPath('userData') at class property initialisation time (line 11 of secretStorageService.ts: 'private dir = path.join(app.getPath(userData), secrets)'). The singleton is created at module load in src/main/secrets/index.ts, which may execute before app.whenReady() fires on some platforms, making app.getPath() unreliable or throwing. This is CR-03 from the code review and constitutes a startup crash risk on affected platforms."
    artifacts:
      - path: "src/main/secrets/secretStorageService.ts"
        issue: "Line 11: 'private dir = path.join(app.getPath(userData), secrets)' — app.getPath called at construction time before app is ready"
    missing:
      - "Lazy-evaluate app.getPath('userData') inside a getter or inside init() rather than at class construction time"

  - truth: "IPC sender frame validation prevents any non-renderer frame from calling the main process in production builds (ROADMAP SC-4 security clause)"
    status: failed
    reason: "createContext in src/main/index.ts explicitly allows any URL starting with 'http://localhost:' regardless of whether the build is development or production. In a packaged build the renderer loads from file://, so localhost is unreachable by accident — but the validation code contains no production guard. CR-04 from the code review documents this as a security gap."
    artifacts:
      - path: "src/main/index.ts"
        issue: "Lines 88-94: senderFrame validation allows http://localhost:* unconditionally — no isDev guard"
    missing:
      - "Restrict localhost IPC access to process.env.NODE_ENV === 'development' only"
---

# Phase 1: Foundation & Secure Shell — Verification Report

**Phase Goal:** A user can install SoloCampaign on Windows/macOS/Linux, launch it, create a new campaign that persists across restarts, and see the split-panel layout shell — on a secure-by-default Electron baseline backed by SQLite.
**Verified:** 2026-05-22T17:00:00Z
**Status:** GAPS_FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### ROADMAP Success Criteria

The ROADMAP defines four success criteria for Phase 1. These are the verification contract.

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC-1 | User can install and launch on Win/Mac/Linux from packaged build without manual dep setup | FAILED | No packaged build produced; smoke scripts missing; dev-mode launch only |
| SC-2 | User can create a new campaign, close, reopen, and see data intact | VERIFIED | Drizzle migrate() + WAL + SQLite persist across app lifecycle; code wiring confirmed |
| SC-3 | User sees split-panel layout (narrative chat left, tabbed right panel) on entering campaign | FAILED | 01-04 not executed; CampaignViewScreen is a confirmed stub |
| SC-4 | Electron renderer: contextIsolation enabled, nodeIntegration disabled, all IPC via Zod | VERIFIED (with WARNING) | Flags confirmed in code; Zod schemas wired; localhost IPC gap noted (CR-04) |

### Observable Truths (Merged from ROADMAP + Plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T-1 | User can install and launch from a packaged build on Win/Mac/Linux | FAILED | No packaged build; smoke test infrastructure missing |
| T-2 | User can create a new campaign, restart, see data intact | VERIFIED | Drizzle + migrate() + backupRotation + WAL confirmed in code |
| T-3 | User sees split-panel layout on entering campaign | FAILED | CampaignViewScreen is a stub; 01-04 not yet executed |
| T-4 | contextIsolation: true, sandbox: true, nodeIntegration: false are literal in BrowserWindow | VERIFIED | src/main/index.ts lines 66-68 confirmed |
| T-5 | User can launch, see empty-state CTA, create campaign via modal, see card | VERIFIED | CampaignListScreen + CreateCampaignModal + EmptyState — all substantive and wired |
| T-6 | tRPC router skeleton composes campaigns + prefs + secrets + window sub-routers | VERIFIED | router.ts confirmed; prefs/window are empty t.router({}); secrets is populated |
| T-7 | Calling secrets.set then secrets.exists returns true; delete then exists returns false | FAILED | SecretStorageService CR-03: app.getPath called at construction time (startup crash risk) |
| T-8 | Drizzle migrations auto-run at startup; campaigns table exists on fresh DB | VERIFIED | applyMigrations() confirmed; ASAR-safe path resolution present; 0000_absent_thunderball.sql exists |

**Score: 5/8 truths verified**

### Deferred Items

None — all failed items are within the scope of Phase 1 per the ROADMAP.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/index.ts` | Secure BrowserWindow + CSP + senderFrame validation | VERIFIED | contextIsolation/sandbox/nodeIntegration flags present; CSP via onHeadersReceived; senderFrame check present |
| `src/main/trpc/router.ts` | Root tRPC router composing 4 sub-routers + AppRouter type | VERIFIED | Imports and composes all 4 routers; AppRouter exported |
| `src/main/trpc/routers/secrets.ts` | exists/set/delete — NO get | VERIFIED | All three procedures present; no get procedure |
| `src/main/trpc/routers/prefs.ts` | Empty placeholder | VERIFIED | Contains `t.router({})` |
| `src/main/trpc/routers/window.ts` | Empty placeholder | VERIFIED | Contains `t.router({})` |
| `src/main/db/schema.ts` | Drizzle campaigns table (id, name, createdAt) | VERIFIED | sqliteTable('campaigns') with all three columns |
| `src/main/db/migrate.ts` | applyMigrations + ASAR-safe path + integrity_check | VERIFIED | app.isPackaged ternary present; migrate() called; integrity_check logged |
| `src/main/db/backupRotation.ts` | rotateBackups — copy + keep last 10 | VERIFIED | solocampaign-backup- prefix; MAX_BACKUPS = 10 |
| `src/main/db/campaignsRepo.ts` | list/create/get Drizzle queries | VERIFIED | All three methods implemented with real Drizzle queries |
| `src/main/secrets/secretStorageService.ts` | SecretStorageService with safeStorage + B64 fallback + key normalization | VERIFIED (WARN) | Class present; isSecure() checks both conditions; B64: prefix; normalization regex — but CR-03 startup risk |
| `src/main/secrets/index.ts` | secretStorage singleton | VERIFIED | `new SecretStorageService()` exported |
| `src/renderer/src/screens/CampaignListScreen.tsx` | Card grid + empty state + modal | VERIFIED | useQuery wired to campaigns.list; modal state not auto-open; EmptyState renders |
| `src/renderer/src/components/CreateCampaignModal.tsx` | Create modal with Zod-validated name input | VERIFIED | Calls campaigns.create.mutate; invalidates query; disabled when empty |
| `src/renderer/src/screens/CampaignViewScreen.tsx` | Campaign view screen | STUB | Confirmed stub — shows "Campaign loaded: {name}" placeholder only |
| `resources/migrations/0000_absent_thunderball.sql` | Generated CREATE TABLE for campaigns | VERIFIED | Contains CREATE TABLE campaigns with all columns |
| `resources/migrations/meta/_journal.json` | Drizzle migration manifest | VERIFIED | Tag 0000_absent_thunderball present |
| `drizzle.config.ts` | drizzle-kit config | VERIFIED | Points to src/main/db/schema.ts and resources/migrations |
| `electron-builder.yml` | extraResources + asarUnpack | VERIFIED | Both blocks present and correctly configured |
| `src/renderer/public/placeholder-cover.svg` | SVG < 2KB | VERIFIED | 1218 bytes |
| `src/renderer/src/styles/globals.css` | OKLCH dark theme tokens | VERIFIED | --primary: oklch(0.78 0.10 78) and --background: oklch(0.16 0.005 260) present |
| `src/preload/index.ts` | exposeElectronTRPC | VERIFIED | Called via electron-trpc/main (see IN-02 in review for minor concern) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| CreateCampaignModal.tsx | trpc.campaigns.create | tRPC mutation | WIRED | useMutation with mutationFn: trpc.campaigns.create.mutate |
| CampaignListScreen.tsx | trpc.campaigns.list | useQuery | WIRED | queryFn: () => trpc.campaigns.list.query() |
| campaigns.ts router | campaignsRepo | function calls | WIRED | campaignsRepo.list/create/get all called from procedures |
| preload/index.ts | renderer (contextBridge) | exposeElectronTRPC | WIRED | process.once('loaded', exposeElectronTRPC) |
| src/main/db/index.ts | src/main/db/migrate.ts | applyMigrations call | WIRED | applyMigrations(db, sqlite) called after pragmas |
| src/main/db/index.ts | src/main/db/backupRotation.ts | rotateBackups call | WIRED | rotateBackups(dbPath, userData) called first |
| src/main/index.ts | src/main/db/index.ts | openDatabase / initDatabase | WIRED | initDatabase() called in app.whenReady |
| src/main/trpc/routers/secrets.ts | src/main/secrets/index.ts | import secretStorage | WIRED | secretStorage.exists/encrypt/remove called |
| src/main/index.ts | src/main/secrets/index.ts | secretStorage.init() | WIRED | await secretStorage.init() in app.whenReady |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| CampaignListScreen.tsx | campaigns (from useQuery) | trpc.campaigns.list.query() → campaignsRepo.list() → Drizzle SELECT | Yes — db.select().from(campaigns).orderBy(desc) | FLOWING |
| CreateCampaignModal.tsx | (mutation result) | trpc.campaigns.create.mutate → campaignsRepo.create → Drizzle INSERT+SELECT | Yes — real insert with UUID and timestamp | FLOWING |
| CampaignViewScreen.tsx | campaignQuery.data | trpc.campaigns.get.query → campaignsRepo.get → Drizzle SELECT WHERE id | Yes — real query, but screen is a stub anyway | FLOWING (stub screen) |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | Zero errors or output | PASS |
| 34 unit tests pass (TDD cycle) | `npx vitest run` | 34/34 passing in 1.49s | PASS |
| contextIsolation flag present | grep in src/main/index.ts | Found at line 66 | PASS |
| No renderer imports of better-sqlite3/drizzle-orm/electron | grep under src/renderer/ | Zero matches | PASS |
| senderFrame validation present | grep 'senderFrame' in index.ts | Found at line 87 | PASS |
| Drizzle migration file present | File check | resources/migrations/0000_absent_thunderball.sql confirmed | PASS |
| Backup rotation limit in code | grep 'MAX_BACKUPS' in backupRotation.ts | MAX_BACKUPS = 10 confirmed | PASS |
| No TBD/FIXME/XXX debt markers in src/ | grep across src/ | Zero matches | PASS |
| CampaignViewScreen is a stub | Read file | "Campaign loaded: {name}" confirmed | FAIL (known/expected) |
| Split-panel shell present | Glob for react-resizable-panels usage in screens/ | Not found — 01-04 not yet executed | FAIL |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FOUND-01 | 01-01, 01-02 | Install and launch on Win/Mac/Linux | PARTIAL | Dev-mode launch works; packaged build unverified (no smoke scripts) |
| FOUND-02 | 01-01, 01-02 | Campaign data persists in SQLite with versioned migrations | SATISFIED | Drizzle migrate() + WAL + backup rotation fully wired |
| FOUND-04 | 01-03 | API keys stored encrypted via safeStorage | PARTIAL | Architecture complete; CR-03 startup crash risk from app.getPath at construction time |
| SESS-01 | Not yet addressed | Split-panel layout with narrative chat and tabbed panels | BLOCKED | Plans 01-04 and 01-05 not yet executed |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/index.ts` | 26-29 | DB init failure swallowed — app continues with broken DB | BLOCKER (CR-01) | IPC is live but every query throws unhandled rejection; user sees broken/frozen UI instead of a clear error |
| `src/main/index.ts` | 124-125 | log.initialize() and startup log run outside the gotLock else block — fire in the losing process | WARNING (CR-02) | Log noise in second-instance process; misleading startup entry |
| `src/main/secrets/secretStorageService.ts` | 11 | app.getPath('userData') called at class property init time (module load) | BLOCKER (CR-03) | Potential startup crash on platforms where app.getPath() is unreliable before app.whenReady() |
| `src/main/index.ts` | 88-94 | http://localhost:* whitelisted in senderFrame validation without isDev guard | WARNING (CR-04) | In production, any locally-served HTTP page can invoke the main process IPC surface |
| `src/main/secrets/secretStorageService.ts` | 79 | B64 fallback: buf.subarray(4).toString() uses default utf-8 instead of ascii for base64 content | WARNING (CR-05) | Silently corrupts on non-UTF8 bytes; should be .toString('ascii') for base64 alphabet |
| `src/main/db/index.ts` | 51 | export { _db as db } exposes mutable null-initialized variable alongside getDb() guard | WARNING (WR-01) | Two access paths to DB; callers that skip getDb() receive null |
| `src/renderer/src/styles/globals.css` | 7-51 | :root and .dark blocks are byte-for-byte identical | INFO (IN-04) | No light mode; future toggle implementation silently broken |
| `src/renderer/src/components/CreateCampaignModal.tsx` | 60-64 | handleKeyDown calls createMutation.mutate AND form onSubmit does the same on Enter | WARNING (WR-04) | Duplicate-submit race on Enter; handleKeyDown is redundant given the form onSubmit |

No `TBD`, `FIXME`, or `XXX` debt markers found in any source file.

---

## Human Verification Required

### 1. Split-Panel Layout (01-04/01-05 pending)

**Test:** After plans 01-04 and 01-05 execute: navigate to /campaign/:id and verify the split-panel is visible — narrative chat panel on the left, right panel with tabs (Character Sheet, Combat Tracker, NPC Tracker, Session Journal, Inventory). Verify the 60/40 default size ratio. Verify the panel is resizable by dragging the divider.
**Expected:** react-resizable-panels renders with two panes; right pane shows 5 named tabs; Character Sheet tab is active by default; divider is draggable.
**Why human:** Visual layout and drag interaction cannot be verified by grep.

### 2. Campaign persists across restart (manual confirmation)

**Test:** Run `npm run dev`. Create a campaign named "Verification Test". Kill the dev process with Ctrl+C. Relaunch `npm run dev`. Verify "Verification Test" card is still visible.
**Expected:** Campaign card present after restart with the correct name and approximate "Created just now" or date metadata.
**Why human:** Requires running the app and restarting it; behavioral persistence across process boundaries is not statically verifiable.

### 3. SecretStorageService round-trip (non-test environment)

**Test:** In DevTools console of the running app: `await window.electronTRPC?.request({method:'mutation', path:'secrets.set', input:{key:'verify-test',value:'sk-test-123'}})` then `await window.electronTRPC?.request({method:'query',path:'secrets.exists',input:{key:'verify-test'}})`. Verify the exists call returns true.
**Expected:** exists returns true after set; {userData}/secrets/verify-test.enc file exists on disk.
**Why human:** Requires running Electron with a real safeStorage backend; unit tests mock safeStorage.

### 4. Single-instance lock (FOUND-01 behavioral)

**Test:** Run `npm run dev`. While the first instance is running, open a second terminal and run `npm run dev` again.
**Expected:** Second process exits immediately without opening a window; first window gains focus (or is restored if minimized).
**Why human:** Requires OS-level process interaction; cannot be verified statically.

### 5. packaged build install and launch (FOUND-01 full satisfaction)

**Test:** Run `npm run build` on Windows, macOS, and Linux. Install the resulting package. Launch the installed app. Create a campaign.
**Expected:** App launches without "manual dependency setup"; solocampaign.db created in userData; campaign list visible.
**Why human:** Requires platform-native packaging and install; no smoke scripts exist yet (VALIDATION.md Wave 0 gap).

---

## Gaps Summary

Four gaps prevent the Phase 1 goal from being fully achieved:

**Gap 1 — Split-panel layout shell not delivered (ROADMAP SC-3, SESS-01):** The most visible gap. Plans 01-04 (react-resizable-panels split layout + 5-tab right panel) and 01-05 (custom frameless title bar + window size persistence) appear in the ROADMAP as Phase 1 scope but have not been executed. The CampaignViewScreen is a confirmed stub. This directly contradicts the phase goal ("see the split-panel layout shell") and ROADMAP Success Criterion 3.

**Gap 2 — No packaged build or smoke test verification (ROADMAP SC-1, FOUND-01 packaged clause):** FOUND-01 requires launching from a packaged build without manual dependency setup. All evidence gathered is for dev-mode execution only. The VALIDATION.md Wave 0 requirements list smoke scripts that do not exist in the repository. The ASAR-safe migration path and asarUnpack for better-sqlite3 are correctly configured in code but have never been exercised in a real packaged build.

**Gap 3 — SecretStorageService CR-03 startup crash risk (FOUND-04):** `app.getPath('userData')` is called at class property initialization (module load time), before `app.whenReady()` has fired. On some platforms this throws or returns the wrong path. The fix (lazy getter or init()-time resolution) is straightforward but the current code is a verified crash risk per the code review.

**Gap 4 — IPC localhost whitelist in production (ROADMAP SC-4 security):** The senderFrame validation in createContext unconditionally allows `http://localhost:*` requests to reach the main process. This should be gated behind `process.env.NODE_ENV === 'development'`. In production this is technically unreachable by accident (renderer loads from file://), but the validation code provides no explicit guarantee.

**Root cause grouping:** Gaps 1 and 2 are scope completion issues (01-04/01-05 and smoke infrastructure are simply not done). Gaps 3 and 4 are implementation quality issues flagged in the code review that have not been resolved.

---

## Code Review Issues Status

The code review (01-REVIEW.md) identified 5 critical issues. Their status as verified in the codebase:

| CR# | Description | Verified in Code | Severity for Verification |
|-----|-------------|-----------------|--------------------------|
| CR-01 | DB init failure swallowed; app continues with broken DB | CONFIRMED at index.ts:26-29 | BLOCKER |
| CR-02 | log.initialize() fires before single-instance lock | CONFIRMED at index.ts:124-125 | WARNING |
| CR-03 | SecretStorageService app.getPath at construction time | CONFIRMED at secretStorageService.ts:11 | BLOCKER |
| CR-04 | IPC localhost allowed in production | CONFIRMED at index.ts:88-94 | WARNING |
| CR-05 | B64 fallback decrypt uses wrong string encoding | CONFIRMED at secretStorageService.ts:79 | WARNING |

CR-01 and CR-03 are both BLOCKER severity for launch on a production machine (crash risk or silent data loss). CR-04 is a security concern. None of the critical issues have been fixed since the review.

---

_Verified: 2026-05-22T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Phase 1 plans executed: 01-01, 01-02, 01-03 (3/5 plans; 01-04 and 01-05 pending)_
