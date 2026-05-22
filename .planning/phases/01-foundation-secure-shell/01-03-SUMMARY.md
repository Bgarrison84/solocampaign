---
phase: 01-foundation-secure-shell
plan: "03"
subsystem: secrets
tags: [electron, safestorage, encryption, trpc, zod, vitest, tdd, security]

requires:
  - 01-01 (tRPC base + empty secretsRouter placeholder)

provides:
  - "SecretStorageService class — encrypt/decrypt/exists/remove with safeStorage + B64 fallback + key normalization"
  - "secretStorage module-level singleton (src/main/secrets/index.ts)"
  - "secrets tRPC router: exists/set/delete procedures (NO get — T-KEY-01 IPC safety contract)"
  - "secretStorage.init() called at startup in app.whenReady after DB open, before BrowserWindow"
  - "Zod key validation schema: min(1)/max(64)/regex([a-zA-Z0-9_.-]) for defense-in-depth path traversal prevention"
  - "Vitest unit tests: 34 tests across SecretStorageService + tRPC router (full TDD RED/GREEN cycle)"
  - "vitest.config.ts — node environment, globals, all src/**/*.test.ts included"

affects:
  - 01-04 (unchanged — secrets are parallel, not blocking)
  - Phase 3 AI Engine (imports secretStorage singleton for per-campaign API key storage)
  - All phases: TypeScript AppRouter type now reflects populated secrets procedures

tech-stack:
  added:
    - vitest.config.ts (first vitest config in project)
  patterns:
    - "SecretStorageService: isSecure() checks BOTH isEncryptionAvailable() AND getSelectedStorageBackend() !== 'basic_text' (Pitfall #10)"
    - "B64: magic prefix discriminates fallback ciphertexts from real safeStorage payloads"
    - "Key normalization: /[^a-zA-Z0-9_.-]/g replaces illegal chars BEFORE filesystem path concatenation"
    - "One-time fallback warning: module-scope boolean prevents log spam on repeated encrypt calls"
    - "Zod + service normalization: two-layer defense — Zod rejects at IPC boundary, service normalizes at filesystem layer"
    - "tRPC v10 router.createCaller({}) API (not createCallerFactory — that is v11)"
    - "vi.resetModules() + dynamic imports for per-test fresh module state with Electron mocks"

key-files:
  created:
    - src/main/secrets/secretStorageService.ts
    - src/main/secrets/index.ts
    - src/main/secrets/secretStorageService.test.ts
    - src/main/trpc/routers/secrets.test.ts
    - vitest.config.ts
  modified:
    - src/main/trpc/routers/secrets.ts (replaced empty placeholder with full router)
    - src/main/index.ts (added secretStorage.init() call + import)

key-decisions:
  - "tRPC v10 test caller: router.createCaller({}) not createCallerFactory (which is v11 API)"
  - "Zod regex does not reject '..dangerous' (leading dots are valid key chars) — only slashes/special chars are excluded; path traversal via pure-dot names is blocked by path.join semantics"
  - "Fallback warning logged once per process (module-scope boolean) — avoids log spam while still informing operators"
  - "init() creates directory via mkdir({ recursive: true }) — no throw on repeated calls"

requirements-completed:
  - FOUND-04

duration: 65min
completed: 2026-05-22
---

# Phase 1 Plan 03: SecretStorageService + Secrets tRPC IPC Surface Summary

**SecretStorageService wraps Electron safeStorage with headless-Linux B64 fallback, key normalization, and a zero-get-over-IPC tRPC surface — FOUND-04 architecture complete; Phase 3 imports for UI**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-05-22T20:35:00Z
- **Completed:** 2026-05-22T21:39:00Z
- **Tasks:** 2
- **Files modified:** 7 (created 5, modified 2)

## Accomplishments

- `SecretStorageService` class with `init`, `isSecure`, `encrypt`, `decrypt`, `exists`, `remove`
- `isSecure()` checks BOTH `isEncryptionAvailable()` AND `getSelectedStorageBackend() !== 'basic_text'` (Pitfall #10 double-check pattern)
- B64 magic prefix fallback path: when safeStorage is unavailable, writes `B64:<base64-value>` and logs WARN once
- Key normalization via `/[^a-zA-Z0-9_.-]/g` before filesystem path concatenation — prevents path traversal T-KEY-03
- `secretStorage` singleton exported from `src/main/secrets/index.ts`
- `secretsRouter` tRPC router: `exists` (query), `set` (mutation), `delete` (mutation) — NO `get` procedure (T-KEY-01)
- Zod input schemas: key min(1)/max(64)/regex, value min(1)/max(2048) — T-KEY-04
- `secretStorage.init()` wired in `src/main/index.ts` inside `app.whenReady`, after DB init, before BrowserWindow
- `vitest.config.ts` created (project's first test config)
- 34 unit tests passing across both TDD cycles

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: Failing tests for SecretStorageService** — `19078c8` (test)
2. **Task 1 GREEN: Implement SecretStorageService** — `ff92a86` (feat)
3. **Task 2 RED: Failing tests for secrets tRPC router** — `669a760` (test)
4. **Task 2 GREEN: Wire secrets router + startup init** — `f3fdb32` (feat)

## Files Created/Modified

- `src/main/secrets/secretStorageService.ts` — SecretStorageService class (encrypt/decrypt/exists/remove + isSecure + init + filepath normalization)
- `src/main/secrets/index.ts` — `export const secretStorage = new SecretStorageService()`
- `src/main/trpc/routers/secrets.ts` — Full router replacing empty placeholder: exists/set/delete with Zod schemas
- `src/main/index.ts` — Added `import { secretStorage } from './secrets'` + `await secretStorage.init()` in app.whenReady
- `src/main/secrets/secretStorageService.test.ts` — 17 tests covering init, round-trip, exists/remove lifecycle, key normalization, B64 fallback, isSecure
- `src/main/trpc/routers/secrets.test.ts` — 17 tests covering IPC lifecycle, Zod validation, no-get contract
- `vitest.config.ts` — Node environment test config

## Decisions Made

1. **tRPC v10 test caller API**: Used `router.createCaller({})` instead of `createCallerFactory` — `createCallerFactory` is the v11 API. The v10 `router.createCaller` returns a callable object where procedures are accessible directly as `caller.procedureName()`.

2. **Zod allows `'..dangerous'` as a valid key**: Leading dots are in the allowed character set `[a-zA-Z0-9_.-]`. Path traversal requires slashes (`/`). `path.join(dir, '..dangerous.enc')` resolves safely within the directory. The test was adjusted to reflect the correct security model.

3. **One-time fallback warning**: A module-scope `_fallbackWarningLogged` boolean prevents log spam when `encrypt` is called repeatedly in the fallback path. The warning fires exactly once per process.

4. **No `..dangerous` test in Zod**: Removed a test expecting `'..dangerous'` to throw — it's actually a valid key (dots are allowed). The security protection is `../etc/passwd` style keys which DO throw because `/` is not in the character set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tRPC v10 caller API mismatch in tests**
- **Found during:** Task 2 (RED→GREEN test runner output)
- **Issue:** Test initially used `createCallerFactory` from `@trpc/server` — this is the v11 API. In v10, `createCallerFactory` exists but returns a factory where the resulting caller does not expose procedures as direct methods (returns `undefined` for all calls).
- **Fix:** Switched to `router.createCaller({})` which is the v10 API. Also changed from `caller.secrets.exists` (nested router pattern) to building a flat router in tests, avoiding the double-nesting complexity.
- **Files modified:** `src/main/trpc/routers/secrets.test.ts`
- **Commit:** f3fdb32

**2. [Rule 1 - Bug] Incorrect test assumption about Zod `'..dangerous'` key**
- **Found during:** Task 2 (test failure analysis)
- **Issue:** Test expected `'..dangerous'` to be rejected by Zod's regex. However `[a-zA-Z0-9_.-]+` allows dots, so `..dangerous` is a valid key per the schema (and is safe — `path.join` doesn't traverse for non-slash names).
- **Fix:** Updated the test to use `'../../etc/passwd'` which contains `/` and correctly fails validation.
- **Files modified:** `src/main/trpc/routers/secrets.test.ts`
- **Commit:** f3fdb32

### Plan Notes

- TDD gate compliance: all four commits follow RED→GREEN order (test commit precedes feat commit for each task).
- The plan's `<verify>` block grep commands all pass.
- TypeScript typecheck (`tsc --noEmit`) passes cleanly after all changes.

## Known Stubs

None — all behavioral requirements of FOUND-04 at the architecture level are implemented. The UI surface (provider config screen, isSecure() warning display) is Phase 3's job per D-15.

## Threat Surface Scan

All five threats from the plan's threat model are mitigated:

| Flag | File | Status |
|------|------|--------|
| T-KEY-01: Plaintext over IPC | secrets.ts | MITIGATED — no get procedure |
| T-KEY-02: basic_text backend | secretStorageService.ts | MITIGATED — isSecure() checks both conditions |
| T-KEY-03: Path traversal via key | secretStorageService.ts + secrets.ts | MITIGATED — Zod regex + filepath normalization |
| T-KEY-04: Disk exhaustion | secrets.ts | MITIGATED — Zod max(64)/max(2048) |
| T-KEY-05: Value logged accidentally | Both files | MITIGATED — verified no log call references value argument |

No new unmodeled threat surface introduced.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED (test) | 19078c8 | PASS — test commit before feat |
| Task 1 GREEN (feat) | ff92a86 | PASS — feat commit after test |
| Task 2 RED (test) | 669a760 | PASS — test commit before feat |
| Task 2 GREEN (feat) | f3fdb32 | PASS — feat commit after test |

## Self-Check: PASSED

- src/main/secrets/secretStorageService.ts: FOUND (contains isEncryptionAvailable, getSelectedStorageBackend, basic_text, B64:, /[^a-zA-Z0-9_.-]/g)
- src/main/secrets/index.ts: FOUND (contains new SecretStorageService)
- src/main/trpc/routers/secrets.ts: FOUND (contains exists:, set:, delete:, no get:)
- src/main/index.ts: FOUND (contains secretStorage.init())
- vitest.config.ts: FOUND
- Commit 19078c8: verified in git log
- Commit ff92a86: verified in git log
- Commit 669a760: verified in git log
- Commit f3fdb32: verified in git log
- 34 unit tests: PASSED

---
*Phase: 01-foundation-secure-shell*
*Completed: 2026-05-22*
