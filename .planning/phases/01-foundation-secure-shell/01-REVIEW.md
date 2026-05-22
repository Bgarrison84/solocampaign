---
phase: 01-foundation-secure-shell
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
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
  - resources/migrations/0000_absent_thunderball.sql
  - resources/migrations/meta/_journal.json
  - resources/migrations/meta/0000_snapshot.json
  - src/main/db/migrate.ts
  - src/main/db/backupRotation.ts
  - src/main/secrets/secretStorageService.ts
  - src/main/secrets/index.ts
  - src/main/secrets/secretStorageService.test.ts
  - src/main/trpc/routers/secrets.test.ts
findings:
  critical: 5
  warning: 7
  info: 4
  total: 16
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 1 built a working Electron walking skeleton: secure BrowserWindow, SQLite+Drizzle migrations, electron-trpc IPC, campaign CRUD, and a SecretStorageService backed by Electron safeStorage. The security posture is generally strong — contextIsolation/sandbox/nodeIntegration are all correct, there is no `get` procedure on the secrets router, and the Zod validation at the IPC boundary is solid.

However, five blockers were found: the app continues to start (and accept IPC) even after a database initialization failure; `log.initialize()` runs before the single-instance lock check, producing orphaned log noise in the losing process; the `SecretStorageService` constructs its directory path at class instantiation time (before `app.getPath` is reliable on some platforms); the IPC senderFrame validation explicitly whitelists `http://localhost:*` in production, meaning any locally-served page can call your main process; and the B64 fallback storage silently truncates values that contain the NUL byte when decoded via `.toString()` without a charset guard.

Seven warnings and four informational items round out the report.

---

## Critical Issues

### CR-01: App continues running after database init failure — IPC is live with a broken DB

**File:** `src/main/index.ts:25-29`
**Issue:** `initDatabase()` is called inside a `try/catch` that swallows the error and lets the app continue. The tRPC IPC handler is then wired up (line 83) against a fully initialised `router`, which will call `getDb()` and throw an unhandled rejection on every query — but only after the window is visible and the user tries to use it. The `getDb()` error is not surfaced to the user; they see a blank crash or a frozen UI depending on how electron-trpc handles an unhandled rejection from a handler.

The correct behaviour for a fatal startup failure is to call `app.quit()` (or show a dialog and then quit). Silently starting up with a broken database is worse than refusing to start.

**Fix:**
```typescript
try {
  await initDatabase()
} catch (err) {
  log.error('[main] Fatal: failed to initialize database:', err)
  // Show a native error dialog so the user knows what happened,
  // then exit cleanly instead of leaving a zombie window.
  const { dialog } = await import('electron')
  await dialog.showMessageBox({
    type: 'error',
    title: 'SoloCampaign — startup error',
    message: 'Could not open the campaign database.',
    detail: String(err),
  })
  app.quit()
  return
}
```

The same pattern should be applied to the `secretStorage.init()` block on lines 34–38.

---

### CR-02: `log.initialize()` runs before the single-instance lock — side-effectful call in the losing process

**File:** `src/main/index.ts:124-125`
**Issue:** `log.initialize()` is called at module scope (line 124), unconditionally, before the `if (!gotLock)` branch has a chance to exit. In the "second instance" code path the process calls `app.quit()` on line 14 and returns, but `log.initialize()` has already run and may have opened a log file handle or appended a startup entry. This is minor for logging but establishes the wrong pattern: side-effectful initialisation that touches the filesystem should be gated behind the single-instance lock.

More concretely, the `log.info('[main] SoloCampaign starting up')` on line 125 is *outside* the `else` block entirely — it runs in **both** instances, so every rejected second-instance attempt writes a misleading "starting up" log entry.

**Fix:**
Move both `log.initialize()` and the startup log entry inside the `else` block, before `app.whenReady()`:
```typescript
} else {
  log.initialize()
  log.info('[main] SoloCampaign starting up')

  app.on('second-instance', () => { ... })
  app.whenReady().then(async () => { ... })
  ...
}
```

---

### CR-03: `SecretStorageService` calls `app.getPath()` at class construction time

**File:** `src/main/secrets/secretStorageService.ts:11`
**Issue:** The `dir` field is initialised as a class property:
```typescript
private dir = path.join(app.getPath('userData'), 'secrets')
```
This runs `app.getPath('userData')` the moment `new SecretStorageService()` is called. The singleton is created at module load time in `src/main/secrets/index.ts`, which means it runs whenever the module is first `import`-ed — which may be before `app.whenReady()` has fired. Electron's `app.getPath('userData')` is documented to throw if called before the app is ready on some platforms, and the path it returns can be the wrong value if called before Electron has fully initialised the user-data directory.

The correct approach is to lazily evaluate `app.getPath('userData')` only when methods are first called (or inside `init()`), not at construction time.

**Fix:**
```typescript
export class SecretStorageService {
  private _dir: string | null = null

  private get dir(): string {
    if (!this._dir) {
      this._dir = path.join(app.getPath('userData'), 'secrets')
    }
    return this._dir
  }
  // ...
}
```

---

### CR-04: IPC senderFrame validation whitelists `http://localhost:*` globally — allows any local HTTP server to call the main process

**File:** `src/main/index.ts:88-94`
**Issue:** The `createContext` validator for electron-trpc accepts any sender whose URL starts with `http://localhost:`. This is intentional for the Vite dev server in development, but there is no production guard: the same whitelist applies when the app is packaged. In a packaged app the renderer loads from `file://`, so the `localhost` branch is unreachable — but only by accident. If a future code path causes the packaged renderer to load a local HTTP resource (a local LLM UI, a debugging tool, etc.) the IPC surface is fully open to it.

The fix is to restrict the `localhost` allowance to development mode:

**Fix:**
```typescript
createContext: async ({ event }) => {
  const senderUrl = (event as any).senderFrame?.url ?? ''
  const isDev = process.env.NODE_ENV === 'development'
  const allowed =
    senderUrl.startsWith('file://') ||
    senderUrl.startsWith('app://') ||
    (isDev && senderUrl.startsWith('http://localhost:'))
  if (!allowed) {
    throw new Error('IPC sender frame URL not allowed')
  }
  return {}
},
```

---

### CR-05: B64 fallback path in `decrypt()` silently corrupts binary-looking values via `.toString()` without explicit encoding

**File:** `src/main/secrets/secretStorageService.ts:77-79`
**Issue:** In the fallback (non-safeStorage) decrypt path:
```typescript
return Buffer.from(buf.subarray(4).toString(), 'base64').toString()
```
The outer `.toString()` call uses the default `'utf8'` encoding, which is correct, but `buf.subarray(4).toString()` also uses default `'utf8'`. If the base64 payload stored on disk contains any bytes that are not valid UTF-8 characters (which can happen if the `enc` file was written by a version of the app that had a bug or was manually corrupted), this silently produces a garbled string rather than throwing. The result is a subtly wrong secret being handed to the AI provider, which fails at the API call with a cryptic auth error rather than a clear "corrupt secret" message.

More concretely: `buf.subarray(4).toString()` should be `buf.subarray(4).toString('ascii')` (or `'latin1'`) since the base64 alphabet is ASCII-only. Using `'utf8'` here is technically safe for valid base64 but is semantically wrong and will silently mis-decode any corrupted file.

**Fix:**
```typescript
if (buf.subarray(0, 4).toString('utf8') === 'B64:') {
  const b64str = buf.subarray(4).toString('ascii')  // base64 is always ASCII
  return Buffer.from(b64str, 'base64').toString('utf8')
}
```

---

## Warnings

### WR-01: Database module exports a mutable `_db` alias — external callers can read `null` without going through `getDb()`

**File:** `src/main/db/index.ts:51`
**Issue:** The module exports `export { _db as db }`. This is a live binding to the module-scope `let _db` variable, which starts as `null`. Any code that imports `db` directly instead of calling `getDb()` will receive `null` before `initDatabase()` completes, and the TypeScript type `ReturnType<typeof drizzle> | null` forces a null check that callers may skip with a `!` assertion. The `getDb()` guard is the correct pattern; the re-export undermines it and adds a second, unguarded access path.

**Fix:** Remove the direct export:
```typescript
// Remove this line:
export { _db as db }
// Callers must use getDb() exclusively.
```

---

### WR-02: `campaignsRepo.create()` re-fetches after insert — window for a phantom read if the DB is shared

**File:** `src/main/db/campaignsRepo.ts:18-31`
**Issue:** `create()` inserts the record and then immediately does a separate `SELECT ... WHERE id = ?` to return the created row. This two-statement pattern has a race window: if another thread/process deleted or modified the record between the `INSERT` and the `SELECT`, the returned object would not match what was inserted. In the current single-user, synchronous better-sqlite3 context this is unlikely to cause a bug, but the pattern is fragile.

The safer pattern for better-sqlite3 (synchronous, WAL mode) is to return the record by constructing it from the known inputs — the `id` and `name` were provided by the caller, and `createdAt` can be captured before the insert:

**Fix:**
```typescript
create({ name }: { name: string }): Campaign {
  const db = getDb()
  const id = randomUUID()
  const createdAt = new Date(Date.now())

  db.insert(campaigns).values({ id, name, createdAt }).run()

  return { id, name, createdAt }
},
```

---

### WR-03: `CampaignViewScreen` uses non-null assertion on `id` from `useParams` without validating it is a UUID

**File:** `src/renderer/src/screens/CampaignViewScreen.tsx:11`
**Issue:** The query fires with `id: id!`, bypassing Zod's `campaignIdSchema` (UUID format) validation that the tRPC router enforces. A malformed route like `/campaign/not-a-uuid` will pass the `!!id` guard and send an invalid UUID to the server, causing a tRPC ZodError. This is caught and shown as "Campaign not found" (line 31–36) rather than a useful message, and the error is silently swallowed by the component's non-error state logic: `campaignQuery.isError` is never checked in this screen, only `.isLoading` and `!data`.

**Fix:**
```typescript
import { z } from 'zod'
const idValidation = z.string().uuid().safeParse(id)
if (!idValidation.success) {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <p className="text-muted-foreground">Invalid campaign ID.</p>
    </div>
  )
}
```
Also add an `isError` branch analogous to `CampaignListScreen`.

---

### WR-04: `CreateCampaignModal` has a duplicate-submit race — `handleKeyDown` and `handleSubmit` can both fire on Enter

**File:** `src/renderer/src/components/CreateCampaignModal.tsx:60-65`
**Issue:** The `Input` receives both an `onKeyDown` handler (line 60–64) that calls `createMutation.mutate(...)` directly, and is placed inside a `<form>` whose `onSubmit` also calls `createMutation.mutate(...)`. Pressing Enter inside the input fires *both* the `keydown` event and the native form `submit` event. The `isPending` guard on the second call prevents a second network request (because the mutation is already pending), but the guard is checked before the first call completes its synchronous setup — creating a subtle timing dependency. The `handleKeyDown` handler is entirely redundant given the form's `onSubmit`. Remove it.

**Fix:** Delete the `handleKeyDown` prop and the `onKeyDown` handler function entirely. The `<form onSubmit={handleSubmit}>` with `<Button type="submit">` already handles Enter submission correctly.

---

### WR-05: `backupRotation.ts` reads the entire `userData` directory to find backups — can be confused by other files matching the pattern

**File:** `src/main/db/backupRotation.ts:43-48`
**Issue:** The rotation logic lists *all* files in `userData` and filters by `startsWith('solocampaign-backup-')`. The `userData` directory is shared with electron-store, electron-log, and other Electron internals. If any other tool or the user manually places a file matching that prefix in `userData`, it will be incorrectly counted and rotated by SoloCampaign. This is a correctness issue, not just a style issue — a user could lose data they intentionally placed there.

**Fix:** Store backups in a dedicated `backups/` subdirectory under `userData`, then list only that directory:
```typescript
const backupDir = path.join(userDataDir, 'backups')
await mkdir(backupDir, { recursive: true })
const backupPath = path.join(backupDir, backupFilename)
// ...
const allFiles = await readdir(backupDir)
const backups = allFiles.filter(f => f.endsWith('.db')).sort()
```

---

### WR-06: `SecretStorageService.exists()` and `remove()` use synchronous `existsSync` inside async methods inconsistently

**File:** `src/main/secrets/secretStorageService.ts:89, 97-98`
**Issue:** `exists()` and `remove()` both use the synchronous `existsSync()` inside otherwise async functions. The `encrypt()` method uses `writeFile` (async); `decrypt()` uses `readFile` (async). The mixed sync/async pattern is inconsistent and will block the Node.js event loop in the main process on the sync calls. For a secrets directory with a small number of files this is unlikely to cause measurable problems today, but it will scale poorly if the number of stored secrets grows or if the directory is on a slow network share.

**Fix:** Replace `existsSync` with the async `access` call (or `stat`) throughout:
```typescript
import { access, constants } from 'node:fs/promises'

async exists(key: string): Promise<boolean> {
  try {
    await access(this.filepath(key), constants.F_OK)
    return true
  } catch {
    return false
  }
}
```

---

### WR-07: No `name` uniqueness constraint in the database schema

**File:** `src/main/db/schema.ts:4-10`
**Issue:** The `campaigns` table has no `UNIQUE` constraint on `name`. The tRPC `create` mutation's `onError` handler in `CreateCampaignModal` tells the user "Check that the name isn't already in use", implying a uniqueness expectation — but the schema allows duplicate names without error. The UI message is misleading: duplicate names are permitted at the DB layer, and the error message will never appear for that reason (only for a genuine DB write failure).

Either enforce the constraint in the schema and migration, or remove the misleading hint from the error message.

**Fix (schema approach):**
```typescript
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})
```
And generate a new Drizzle migration.

---

## Info

### IN-01: `activate` handler on macOS is a no-op — window is never re-created

**File:** `src/main/index.ts:117-121`
**Issue:** The `activate` handler (dock click on macOS when all windows are closed) contains only a comment:
```typescript
app.on('activate', () => {
  if (!mainWindow) {
    // Re-create window on macOS
  }
})
```
On macOS, clicking the dock icon when the window has been closed does nothing — the app stays in the background but cannot be recovered without quitting and relaunching. This is a UX defect that will be noticed immediately by macOS users.

**Fix:** Extract window creation into a `createWindow()` function and call it from both `app.whenReady()` and the `activate` handler.

---

### IN-02: `preload/index.ts` imports `exposeElectronTRPC` from `electron-trpc/main` rather than the preload entry point

**File:** `src/preload/index.ts:1`
**Issue:** `exposeElectronTRPC` is imported from `'electron-trpc/main'`. The electron-trpc package exposes a separate `electron-trpc/preload` entry point specifically for preload scripts. Using the `/main` import in a preload script pulls in the full main-process module (which has access to `ipcMain` etc.) into the preload sandbox, which may include more code than intended in the preload bundle and contradicts the package's design intent.

**Fix:**
```typescript
import { exposeElectronTRPC } from 'electron-trpc/preload'
```

---

### IN-03: `campaignIdSchema` only validates UUID format but not that it is version 4

**File:** `src/main/trpc/schemas.ts:4`
**Issue:** `z.string().uuid()` accepts any UUID version (v1–v5). `campaignsRepo.create()` uses `randomUUID()` from `node:crypto`, which generates v4 UUIDs. A client could supply a valid v1 or v3 UUID that passes schema validation but would never match a row in the database (since all IDs are v4). This is a minor correctness gap; it is not a security issue because the tRPC query simply returns `undefined` for an unknown ID, which the UI handles.

**Fix (optional hardening):**
```typescript
export const campaignIdSchema = z.string().uuid().refine(
  (v) => v[14] === '4',
  { message: 'ID must be a v4 UUID' }
)
```

---

### IN-04: Duplicate CSS variable declarations — `:root` and `.dark` blocks are identical

**File:** `src/renderer/src/styles/globals.css:7-51`
**Issue:** The `:root` block (lines 7–28) and the `.dark` block (lines 30–51) are byte-for-byte identical. Since the `<html>` element always has `class="dark"` (set in `src/renderer/index.html:2`) and the `:root` block is the "light" theme, the light theme is set to dark colours. This means there is no light mode, the `:root` block is dead code, and any attempt to implement a light/dark toggle in the future will be silently broken because the "light" theme has dark values.

**Fix:** Replace the `:root` block with the intended light-mode colour tokens, or remove it if the app is intentionally dark-only (and document that decision).

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
