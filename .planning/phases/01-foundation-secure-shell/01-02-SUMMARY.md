---
phase: 01-foundation-secure-shell
plan: "02"
subsystem: database
tags: [sqlite, drizzle, migrations, backup-rotation, single-instance-lock, electron, wal]

requires:
  - 01-01 (better-sqlite3 + Drizzle campaigns schema + electron app scaffold)

provides:
  - "Drizzle migrate() auto-runs at startup replacing raw CREATE TABLE"
  - "ASAR-safe migration path resolution (app.isPackaged ? process.resourcesPath : __dirname)"
  - "PRAGMA integrity_check logged on every launch (D-16)"
  - "Backup rotation: solocampaign-backup-{timestamp}.db, keeps last 10 (D-16)"
  - "Single-instance lock BEFORE app.whenReady, second-instance focuses window (D-18)"
  - "resources/migrations/0000_absent_thunderball.sql generated from schema"
  - "electron-builder.yml extraResources + asarUnpack for migration files and native modules"

affects:
  - 01-03-secret-storage (inherits DB init pattern)
  - all later phases that open the DB (will use initDatabase which now uses migrate())

tech-stack:
  added:
    - drizzle-orm/better-sqlite3/migrator (migrate() function — was a dep, now used)
    - drizzle.config.ts (drizzle-kit configuration)
  patterns:
    - "ASAR-safe migration path: app.isPackaged ? process.resourcesPath/migrations : __dirname/../../resources/migrations"
    - "Backup rotation: copy before open, keep last 10, lexicographic sort = chronological order"
    - "Single-instance lock pattern: requestSingleInstanceLock BEFORE app.whenReady, second-instance event focuses+restores"
    - "integrity_check: sqlite.pragma('integrity_check', { simple: true }) — log ERROR if non-ok, do not throw (Phase 1)"
    - "Migration sequence: rotateBackups → new Database → pragmas → drizzle() → applyMigrations"

key-files:
  created:
    - drizzle.config.ts
    - resources/migrations/0000_absent_thunderball.sql
    - resources/migrations/meta/_journal.json
    - resources/migrations/meta/0000_snapshot.json
    - src/main/db/migrate.ts
    - src/main/db/backupRotation.ts
  modified:
    - src/main/db/index.ts (replaced raw CREATE TABLE with proper init sequence)
    - package.json (added db:generate and db:studio scripts)

key-decisions:
  - "applyMigrations accepts BetterSQLite3Database<any> to avoid TypeScript schema-type incompatibility — the schema type is wider than Record<string,never> when the DB is opened with a schema object"
  - "integrity_check placed AFTER migrate() not before: running migrations on a fresh DB creates the schema tables first, then checking integrity validates the result of the migration"
  - "Backup runs BEFORE Database() constructor per Pitfall #8 order: lock → backup → open → pragmas → migrate"
  - "rotateBackups is non-fatal on copy failure: logs ERROR and returns (failed backup is worse than no backup but must not prevent app start)"
  - "Backup rotation via lexicographic sort: ISO timestamps replace :./ with - making them naturally sortable by filename"

requirements-completed:
  - FOUND-02

duration: 35min
completed: 2026-05-22
---

# Phase 1 Plan 02: Drizzle Migrations, SQLite Safety Stack & Single-Instance Lock Summary

**Drizzle migrate() auto-runs at startup with ASAR-safe path resolution; WAL integrity_check logged on every launch; backup rotation keeps last 10 snapshots; single-instance lock prevents WAL corruption race**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-22T22:20:00Z
- **Completed:** 2026-05-22T22:55:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Drizzle config created, `drizzle-kit generate` run → `resources/migrations/0000_absent_thunderball.sql` with the campaigns table DDL
- Migration journal (`meta/_journal.json`) and snapshot (`meta/0000_snapshot.json`) committed to source control
- `electron-builder.yml` already had `extraResources` and `asarUnpack` from 01-01; verified correct for packaged build ASAR resolution
- `src/main/db/migrate.ts`: `applyMigrations()` with ASAR-safe path resolution + PRAGMA integrity_check logging
- `src/main/db/backupRotation.ts`: `rotateBackups()` copies DB before open, rotates to max 10 backups
- `src/main/db/index.ts`: raw `CREATE TABLE IF NOT EXISTS` replaced by proper init sequence (rotateBackups → open → pragmas → drizzle → applyMigrations)
- `src/main/index.ts`: single-instance lock already in place from 01-01 (requestSingleInstanceLock before app.whenReady, second-instance focuses window)
- TypeScript typecheck passes cleanly after fixing type signature on applyMigrations

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate Drizzle migration files + wire electron-builder** - `63c7fb3` (feat)
2. **Task 2: Replace raw CREATE TABLE with migrate() + integrity_check + backup rotation** - `8d00c94` (feat)

## Files Created/Modified

- `drizzle.config.ts` — drizzle-kit config: schema → `./src/main/db/schema.ts`, out → `./resources/migrations`, dialect: sqlite
- `resources/migrations/0000_absent_thunderball.sql` — Generated CREATE TABLE for campaigns table
- `resources/migrations/meta/_journal.json` — Drizzle migration journal with one entry (tag: `0000_absent_thunderball`)
- `resources/migrations/meta/0000_snapshot.json` — Drizzle schema snapshot
- `src/main/db/migrate.ts` — `applyMigrations(db, sqlite)` with ASAR-safe resolution + integrity_check
- `src/main/db/backupRotation.ts` — `rotateBackups(dbPath, userData)` — copy + keep last 10
- `src/main/db/index.ts` — Replaced raw CREATE TABLE; full init sequence with rotateBackups + applyMigrations
- `package.json` — Added `db:generate` and `db:studio` scripts

## Decisions Made

1. **applyMigrations uses BetterSQLite3Database<any>**: When Drizzle's `drizzle()` is called with a schema object (`drizzle(sqlite, { schema })`), the return type is `BetterSQLite3Database<typeof schema>`, not `BetterSQLite3Database<Record<string, never>>`. Accepting `any` avoids a TypeScript type incompatibility while remaining functionally correct — the migrator only uses the underlying SQLite connection, not the schema.

2. **integrity_check AFTER migrate()**: Running PRAGMA integrity_check after migrations validates the state post-schema-creation. On a fresh DB, the check confirms the migration ran cleanly. On an existing DB, it validates the existing state.

3. **Single-instance lock already complete from 01-01**: The lock pattern was implemented ahead of schedule in 01-01. The 01-02 plan confirmed it is in place and correctly positioned (line 11 < line 22 in src/main/index.ts). No changes needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type mismatch in applyMigrations signature**
- **Found during:** Task 2 (typecheck after implementation)
- **Issue:** `BetterSQLite3Database<Record<string, never>>` does not accept a schema-typed Drizzle instance. TypeScript error: "Types of '_.schema' are incompatible — 'campaigns' property is incompatible with index signature requiring dbName: never"
- **Fix:** Changed parameter type to `BetterSQLite3Database<any>` — functionally equivalent since the migrator only uses the underlying SQLite connection
- **Files modified:** `src/main/db/migrate.ts`
- **Commit:** `8d00c94`

### Plan Notes

- Migration file was named `0000_absent_thunderball.sql` (drizzle-kit auto-generates random names). The plan's acceptance criteria expected `0000_create_campaigns` in the journal — drizzle-kit does not use schema-derived names. The acceptance criteria check for `CREATE TABLE` + `campaigns` content still passes.
- The awk line-order check in the plan's `<verify>` block produces a false negative because the comment on line 10 of `src/main/index.ts` reads "Single-instance lock MUST run before app.whenReady()" — the word "whenReady" in the comment triggers the awk pattern before `requestSingleInstanceLock` is seen at line 11. Actual code ordering is correct: lock at line 11, `app.whenReady()` call at line 22.
- TDD tests for this plan's behavioral requirements (backup file creation on second launch, migration no-op on existing DB, single-instance focus behavior) are deferred to 01-07 per the plan's own acceptance criteria: "automated coverage in 01-07".

## Known Stubs

None — all behavioral requirements of D-16, D-17, D-18 are implemented.

## Threat Surface Scan

No new security-relevant surface beyond what the threat model documents. All five threats (T-DB-01 through T-DB-05) are mitigated:
- T-DB-01: Single-instance lock in place
- T-DB-02: ASAR-safe extraResources path resolution
- T-DB-03: PRAGMA integrity_check logged at ERROR level
- T-DB-04: Drizzle migrate() runs all pending migrations idempotently
- T-DB-05: Backup rotation hard cap at 10 files

## Self-Check: PASSED

- drizzle.config.ts: FOUND
- resources/migrations/0000_absent_thunderball.sql: FOUND (contains CREATE TABLE campaigns)
- resources/migrations/meta/_journal.json: FOUND (contains 0000_absent_thunderball entry)
- src/main/db/migrate.ts: FOUND (contains isPackaged + process.resourcesPath + migrate() + integrity_check)
- src/main/db/backupRotation.ts: FOUND (contains solocampaign-backup- + MAX_BACKUPS = 10)
- src/main/db/index.ts: FOUND (no raw CREATE TABLE, rotateBackups + applyMigrations present)
- src/main/index.ts: FOUND (requestSingleInstanceLock line 11 < app.whenReady line 22)
- Commit 63c7fb3: verified in git log
- Commit 8d00c94: verified in git log
- TypeScript typecheck: PASSED

---
*Phase: 01-foundation-secure-shell*
*Completed: 2026-05-22*
