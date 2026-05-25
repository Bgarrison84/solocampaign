---
phase: 02-character-domain-live-sheet
plan: "04"
subsystem: image-service
tags: [imageService, jimp, tRPC, portrait, cover-image, tdd, base64]
dependency_graph:
  requires: [02-02]
  provides: [imageService, characters.importPortrait, campaigns.importCoverImage, campaigns.getCoverDataUrl]
  affects: [02-05, 02-06, 02-07]
tech_stack:
  added:
    - "jimp@1.6.1 (forced reinstall — 0.16.13 transitive from electron-icon-builder was resolving instead of ^1.6.1)"
  patterns:
    - "imageService.importImage: dialog -> jimp resize -> fs.mkdir + write -> relative path"
    - "imageService.getImageDataUrl: readFile -> base64 data URL (null on ENOENT)"
    - "WEBP: dynamic import('@jimp/wasm-webp').default pattern (ESM-only, Pitfall 3)"
    - "write() cast to any to resolve TS2349 union-type incompatibility (Jimp vs JimpWithWebp)"
    - "TDD: RED commit (test) -> GREEN commit (feat) gate sequence followed"
    - "campaignsRepo.updateCoverImagePath: campaign-domain ownership (W4 fix)"
key_files:
  created:
    - src/main/imageService.ts
    - src/main/imageService.test.ts
  modified:
    - src/main/db/campaignsRepo.ts
    - src/main/trpc/routers/characters.ts
    - src/main/trpc/routers/campaigns.ts
decisions:
  - "write() cast to any: TS2349 union-type incompatibility between Jimp.read() and JimpWithWebp.read() return types; cast is safe at runtime since both have identical write() behavior"
  - "jimp@1.6.1 reinstall required: npm had resolved to 0.16.13 (transitive from electron-icon-builder); forced reinstall with --legacy-peer-deps"
  - "webp module default export: @jimp/wasm-webp exports default not named webp; use webpModule.default"
  - "pre-existing test failures: charactersRepo.test.ts and characters.test.ts fail with better-sqlite3 ABI mismatch (NODE_MODULE_VERSION 145 vs 137) — pre-existing from Plan 02, out-of-scope for this plan"
metrics:
  duration: "12 minutes"
  completed_date: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 02 Plan 04: Image Service Summary

**One-liner:** imageService with Electron dialog + jimp resize + fs write for portrait and cover import, base64 data URL helper for CSP-safe renderer display, wired into characters.importPortrait and campaigns.importCoverImage/getCoverDataUrl tRPC procedures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Add failing imageService tests | 083e6c4 | src/main/imageService.test.ts (7 tests) |
| 1 GREEN | Implement imageService | 50bd2ba | src/main/imageService.ts, imageService.test.ts (mock fix) |
| 2 | Wire imageService into routers + campaignsRepo | 6ac1997 | campaignsRepo.ts, characters.ts, campaigns.ts |

## Verification Results

- `npm test -- src/main/imageService.test.ts` — 7/7 pass
- `npm run typecheck` — exits 0 (all tasks)
- imageService.ts exports `importImage` and `getImageDataUrl` — confirmed
- imageService.ts contains `await import('@jimp/wasm-webp')` — confirmed (dynamic import per Pitfall 3)
- imageService.ts contains `MAX_DIMENSION = 1024` — confirmed
- imageService.ts contains `dialog.showOpenDialog` — confirmed
- No static `import { webp } from '@jimp/wasm-webp'` at module top level — confirmed
- characters.ts no longer contains `NOT_IMPLEMENTED` — confirmed
- characters.ts contains `await importImage(input.campaignId, 'portrait')` — confirmed
- campaigns.ts contains `importCoverImage: t.procedure` — confirmed
- campaigns.ts contains `getCoverDataUrl: t.procedure` — confirmed
- campaigns.ts does NOT import charactersRepo — confirmed
- campaignsRepo.ts contains `updateCoverImagePath` method — confirmed

## TDD Gate Compliance

- RED gate: commit `083e6c4` (test(02-04): add failing imageService tests)
- GREEN gate: commit `50bd2ba` (feat(02-04): implement imageService)
- REFACTOR: not required — implementation was clean on first pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jimp@0.16.13 resolving instead of ^1.6.1**
- **Found during:** Task 1, typecheck phase
- **Issue:** `npm install jimp@^1.6.1` (from Plan 02) had been resolved to 0.16.13 via the `electron-icon-builder` transitive dependency. The v0 API has no `{ Jimp }` named export and no `bitmap.width/height` on the jimp instance.
- **Fix:** Forced `npm install jimp@1.6.1 --legacy-peer-deps` to resolve to the correct version; v1.6.1 exports `{ Jimp }` as a named export.
- **Files modified:** package.json, package-lock.json (in main repo, not worktree-specific)
- **Commit:** 50bd2ba

**2. [Rule 1 - Bug] @jimp/wasm-webp default export (not named export)**
- **Found during:** Task 1, typecheck phase (TS2339)
- **Issue:** The plan's `<action>` block showed `const { webp } = await import('@jimp/wasm-webp')` but the package exports a default function, not a named `webp` export.
- **Fix:** Changed to `const webpModule = await import('@jimp/wasm-webp'); const webp = webpModule.default`
- **Files modified:** src/main/imageService.ts
- **Commit:** 50bd2ba

**3. [Rule 1 - Bug] write() TypeScript union-type incompatibility (TS2349)**
- **Found during:** Task 1, typecheck phase
- **Issue:** `readImage()` returns `Jimp.read()` or `JimpWithWebp.read()` union type; TypeScript reports TS2349 ("none of the signatures are compatible") on `.write()` call because the two Jimp instances have different type parameter constraints.
- **Fix:** Cast to `any` on `.write()` call with explanatory comment. Runtime behavior is identical.
- **Files modified:** src/main/imageService.ts
- **Commit:** 50bd2ba

**4. [Rule 1 - Bug] Test mock: jimp must be set up in beforeEach after vi.resetModules()**
- **Found during:** Task 1 GREEN phase (2/7 tests failing with "Cannot read properties of undefined (reading 'bitmap')")
- **Issue:** The initial test had the jimp mock's `mockResolvedValue` set in the `vi.mock` factory. After `vi.resetModules()` in `beforeEach`, the mock factory re-ran but `mockResolvedValue(fakeImage)` was lost because the factory only returned `vi.fn()`.
- **Fix:** Moved fakeImage creation and `jimpMock.Jimp.read.mockResolvedValue(fakeImage)` into the `beforeEach` block so it runs fresh after each `vi.resetModules()`. Changed `afterEach` from `vi.restoreAllMocks()` to `vi.clearAllMocks()` to preserve mock state.
- **Files modified:** src/main/imageService.test.ts
- **Commit:** 50bd2ba

### Pre-existing Issues (Out of Scope)

**characters.test.ts and charactersRepo.test.ts** — 31 tests failing with `NODE_MODULE_VERSION 145 vs 137` (better-sqlite3 ABI mismatch). These were already failing before this plan ran (confirmed via git stash + test run). The mismatch is because the test runner uses the system Node.js (v137 ABI) while better-sqlite3 was compiled against Electron 41's embedded Node.js (ABI 145). Deferred to `deferred-items.md`.

## Known Stubs

None — the `importPortrait` stub from Plan 02 was replaced by a real implementation in this plan.

## Threat Flags

None — all new surface was specified in the plan's threat model (T-02-09 through T-02-12):
- T-02-09: Path traversal — source path from OS dialog only, destination derived from userData
- T-02-10: Arbitrary file read — renderer passes characterId/campaignId, not path; main reads stored relative path
- T-02-11: DoS via huge image — jimp resize to MAX_DIMENSION=1024 enforced
- T-02-12: CSP bypass via file:// — base64 data URL only, no file:// anywhere

## Self-Check: PASSED

Files exist:
- src/main/imageService.ts — FOUND
- src/main/imageService.test.ts — FOUND
- src/main/db/campaignsRepo.ts (modified) — FOUND
- src/main/trpc/routers/characters.ts (modified) — FOUND
- src/main/trpc/routers/campaigns.ts (modified) — FOUND

Commits exist:
- 083e6c4 — FOUND (test: RED phase)
- 50bd2ba — FOUND (feat: GREEN phase)
- 6ac1997 — FOUND (feat: router wiring)

Test suite: 7/7 imageService tests pass; 69/100 overall pass (31 failures are pre-existing better-sqlite3 ABI mismatch — out-of-scope for this plan)
Typecheck: exits 0
