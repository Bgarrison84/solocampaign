---
phase: 1
plan: "01-06"
title: "Code Review Bug Fixes (CR-01, CR-03, CR-04, CR-05)"
subsystem: main-process
tags: [bug-fix, security, secrets, ipc, database]
dependency_graph:
  requires: ["01-01", "01-02", "01-03", "01-05"]
  provides: ["cr-01-fix", "cr-03-fix", "cr-04-fix", "cr-05-fix"]
  affects: ["src/main/secrets/secretStorageService.ts", "src/main/index.ts"]
tech_stack:
  added: []
  patterns:
    - "lazy getter to defer app.getPath until after app.whenReady"
    - "dialog.showErrorBox for user-visible fatal errors before app.quit"
    - "isDev guard wrapping development-only IPC allowances"
key_files:
  modified:
    - "src/main/secrets/secretStorageService.ts"
    - "src/main/index.ts"
decisions:
  - "Lazy getter chosen over deferred init() assignment — getter guarantees every future access is safe regardless of call order"
  - "dialog.showErrorBox + app.quit() + return chosen for CR-01 — prevents app running with broken DB state while giving user actionable message"
  - "isDev const defined inline in createContext — avoids module-scope variable and is immediately adjacent to the guard it controls"
metrics:
  duration: "10min"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  tests_passing: 34
---

# Phase 1 Plan 06: Code Review Bug Fixes (CR-01, CR-03, CR-04, CR-05) Summary

**One-liner:** Four surgical fixes to secretStorageService.ts and index.ts eliminating two BLOCKERs (lazy dir getter, DB error dialog) and two WARNINGs (ascii B64 decode, isDev IPC guard).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix SecretStorageService — lazy getter (CR-03) and B64 ascii encoding (CR-05) | b20522a | src/main/secrets/secretStorageService.ts |
| 2 | Fix index.ts — DB error dialog (CR-01) and isDev IPC guard (CR-04) | bf91b59 | src/main/index.ts |

## Changes Made

### Task 1 — secretStorageService.ts

**CR-03 (BLOCKER):** Replaced eager class property initialization:
```typescript
// Before (wrong — calls app.getPath at module load time):
private dir = path.join(app.getPath('userData'), 'secrets')

// After (lazy getter — defers until first access inside init()):
private get dir(): string {
  return path.join(app.getPath('userData'), 'secrets')
}
```

**CR-05 (WARNING):** Added explicit `'ascii'` encoding to B64 fallback decrypt:
```typescript
// Before:
return Buffer.from(buf.subarray(4).toString(), 'base64').toString()
// After:
return Buffer.from(buf.subarray(4).toString('ascii'), 'base64').toString()
```

### Task 2 — index.ts

**CR-01 (BLOCKER):** DB init failure now shows user-visible error and quits cleanly:
```typescript
// Before (silently swallowed):
} catch (err) {
  log.error('[main] Failed to initialize database:', err)
}

// After (dialog + quit):
} catch (err) {
  log.error('[main] Failed to initialize database:', err)
  const message = err instanceof Error ? err.message : String(err)
  dialog.showErrorBox(
    'Database Error',
    `SoloCampaign could not initialize the database.\n\n${message}\n\nThe application will now quit.`
  )
  app.quit()
  return
}
```

**CR-04 (WARNING):** localhost IPC allowance gated to development builds only:
```typescript
// Before (unconditional):
!senderUrl.startsWith('http://localhost:')

// After (isDev guard):
const isDev = process.env.NODE_ENV === 'development'
!(isDev && senderUrl.startsWith('http://localhost:'))
```

Also added `dialog` to the electron import.

## Verification Results

```
TypeScript typecheck: PASS (no errors)
Unit tests: 34/34 PASS
  - src/main/secrets/secretStorageService.test.ts  17 tests
  - src/main/trpc/routers/secrets.test.ts          17 tests

Grep checks:
  CR-03: private get dir() — FOUND
  CR-03: private dir = path.join — ABSENT (removed)
  CR-05: .toString('ascii') — FOUND
  CR-01: dialog.showErrorBox — FOUND
  CR-01: app.quit() in catch — FOUND
  CR-04: NODE_ENV === 'development' — FOUND
  Invariant: contextIsolation: true — FOUND
  Invariant: sandbox: true — FOUND
  Invariant: nodeIntegration: false — FOUND
  Invariant: senderFrame — FOUND
  Invariant: secretStorage.init() — FOUND
```

## Deviations from Plan

None — plan executed exactly as written. All four fixes applied as specified in the `<interfaces>` block without any additional changes.

## Known Stubs

None. These were pure bug-fix changes with no stub patterns introduced.

## Threat Flags

No new security surface introduced. All changes reduce attack surface or eliminate crash risk:
- CR-04 tightens the renderer->IPC trust boundary in production
- CR-01 prevents silently broken DB state
- CR-03 eliminates a crash-at-module-load risk
- CR-05 prevents silent secret corruption

## Self-Check: PASSED

- [x] src/main/secrets/secretStorageService.ts exists and modified
- [x] src/main/index.ts exists and modified
- [x] Commit b20522a exists (Task 1)
- [x] Commit bf91b59 exists (Task 2)
- [x] 34/34 tests pass
- [x] TypeScript typecheck clean
