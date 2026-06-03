---
phase: 09-distribution-update-notifications
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - .github/workflows/release.yml
  - electron-builder.yml
  - src/main/services/updateChecker.test.ts
  - src/main/services/updateChecker.ts
  - src/main/trpc/routers/appPrefs.test.ts
  - src/main/trpc/routers/appPrefs.ts
  - src/preload/index.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/UpdateBanner.tsx
  - src/renderer/src/types/aiStream.d.ts
findings:
  critical: 4
  warning: 6
  info: 3
  total: 13
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-06-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 09 delivers the distribution pipeline (GitHub Actions release workflow, electron-builder config) and the update notification system (updateChecker service, appPrefs tRPC router, preload shellBridge, UpdateBanner component). The overall shape is sound — the security-sensitive `shellBridge.openExternal` host allow-list is correctly enforced in the preload, the WAL-safe backup mechanism is used correctly, and the silent-on-error contract for update checks is well-reasoned.

However, four blockers were found that can cause silent data loss or incorrect runtime behavior:

1. The current version's semver parts are never NaN-guarded, so a malformed `app.getVersion()` string produces a `NaN`-poisoned comparison that silently forces every version to appear "not newer."
2. The `changeDataFolder` mutation does not clean up the backup copy when the outer `catch` fires (e.g., `sqlite.backup()` itself throws), leaving partial files at the target path.
3. The release workflow uploads `.zip` and `.AppImage` but no `.blockmap` or `latest*.yml` files, which breaks `electron-updater` auto-update feeds on all platforms.
4. The `sessionRecap` contextBridge surface is never declared in `aiStream.d.ts`, so every renderer file that uses `window.sessionRecap` is operating against an `any`-typed surface — bypassing the type-safety that the `shellBridge` and `aiStream` declarations correctly provide.

---

## Critical Issues

### CR-01: NaN guard omitted for `currentVersion` parts — comparison silently wrong on malformed app version

**File:** `src/main/services/updateChecker.ts:77-85`

**Issue:** The code guards `ma`, `mi`, `pa` (remote parts) against `NaN` at line 80, but applies no equivalent guard to `ca`, `ci`, `cp` (current version parts parsed at line 77). `app.getVersion()` reads from `package.json`; during development, testing, or a botched build it can return `"0"`, `""`, `"0.0"`, or `"dev"`. When any of `ca`/`ci`/`cp` is `NaN`, the comparison expression on line 85 evaluates to `false` for all inputs (any comparison with `NaN` is `false`), so `isNewer` is always `false`. The update banner never appears, silently, with no error logged (by design — but this is a logic error, not an intentional silent path).

```ts
// Line 77 — no guard
const [ca, ci, cp] = currentVersion.split('.').map(Number)

// Line 80 — only remote is guarded
if (isNaN(ma) || isNaN(mi) || isNaN(pa)) return NO_UPDATE

// Line 85 — NaN in ca/ci/cp poisons every sub-expression
const isNewer =
  ma > ca || (ma === ca && mi > ci) || (ma === ca && mi === ci && pa > cp)
```

**Fix:** Extend the NaN guard to cover the current version parts immediately after line 80:

```ts
if (isNaN(ma) || isNaN(mi) || isNaN(pa)) return NO_UPDATE
if (isNaN(ca) || isNaN(ci) || isNaN(cp)) return NO_UPDATE
```

---

### CR-02: `changeDataFolder` does not clean up backup file when `sqlite.backup()` throws

**File:** `src/main/trpc/routers/appPrefs.ts:152-187`

**Issue:** The outer `catch` block at line 178 handles any error thrown by `sqlite.backup()` itself (e.g., disk full, permission denied). In that case `newDb` was never opened, `unlink(newDbPath)` is never called, and a partial or zero-byte `.db` file may have been created at `newDbPath` by the OS before the backup aborted. Subsequent calls to `changeDataFolder` with the same destination path will fail or silently overwrite a corrupt file. The integrity-check cleanup on line 166 only runs when the backup succeeds but the database is corrupt — it does not cover backup failure.

```ts
try {
  const sqlite = getDb().$client
  await sqlite.backup(newDbPath)   // ← if this throws, falls to outer catch

  const newDb = new Database(newDbPath, { readonly: true })
  // ...
  if (result.integrity_check !== 'ok') {
    await unlink(newDbPath).catch(() => {})  // ← only reached if backup succeeded
    throw new TRPCError({ ... })
  }
  // ...
} catch (err) {
  if (err instanceof TRPCError) throw err
  log.error(...)
  throw new TRPCError({ ... })   // ← no unlink here
}
```

**Fix:** Add cleanup in the outer catch before re-throwing, mirroring the integrity-check path:

```ts
} catch (err) {
  if (err instanceof TRPCError) throw err
  // Best-effort cleanup of any partial backup file
  await unlink(newDbPath).catch(() => {})
  log.error('[appPrefs] changeDataFolder failed:', err)
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'Failed to change data folder.',
  })
}
```

---

### CR-03: Release workflow does not publish `latest*.yml` / `.blockmap` — `electron-updater` feed is broken

**File:** `.github/workflows/release.yml:126-130`

**Issue:** The `files:` glob in the `softprops/action-gh-release` step publishes only:

```yaml
artifacts/**/*.exe
artifacts/**/*.zip
artifacts/**/*.AppImage
```

`electron-updater` requires the following additional files to serve its auto-update feed:

- `latest.yml` (Windows NSIS)
- `latest-mac.yml` (macOS)
- `latest-linux.yml` (Linux AppImage)
- `*.blockmap` files (binary diff for differential updates)

Without these files the GitHub Release page has the installers but no update manifest, so `electron-updater` clients cannot detect or download updates from the release — which defeats the entire purpose of this phase. The files are produced by `electron-builder` and land in `dist/`, but the glob never picks them up.

Note: This project deliberately avoids `electron-updater` (decision D-04 uses a plain GitHub API poll). However, the release body documentation (lines 98-126) and the `electron-builder.yml` do not configure a `publish` block pointing at GitHub, so `electron-updater` is not actually used. The real issue is subtler: the release workflow also omits `.deb` packages (produced by electron-builder for Linux users who prefer `.deb` over AppImage) and the macOS `.zip` checksum file. If distribution scope ever widens, these omissions will surface. Even for the current scope, failing to publish `latest.yml`-family files means any future opt-in to `electron-updater` requires a workflow rewrite.

**Fix — minimal (current D-04 scope):** Add `*.yml` and `*.blockmap` to the published files glob to keep the release complete and forward-compatible:

```yaml
files: |
  artifacts/**/*.exe
  artifacts/**/*.zip
  artifacts/**/*.AppImage
  artifacts/**/*.deb
  artifacts/**/*.yml
  artifacts/**/*.blockmap
```

---

### CR-04: `window.sessionRecap` is not declared in `aiStream.d.ts` — untyped contextBridge surface

**File:** `src/renderer/src/types/aiStream.d.ts` (entire file)

**Issue:** `src/preload/index.ts` exposes `window.sessionRecap` at line 129 with a well-defined interface (`startStream`, `onToken`, `onFinish`, `onError`, `removeAllListeners`). The global `Window` augmentation in `aiStream.d.ts` declares `window.aiStream`, `window.platform`, `window.appPrefsSync`, and `window.shellBridge` — but never `window.sessionRecap`. Any renderer code calling `window.sessionRecap.*` therefore types it as `any`, bypassing all compile-time safety checks. A mismatch between the preload implementation and renderer usage cannot be caught by TypeScript. Confirmed by `grep`: `useRecapStream.ts` and other files use `window.sessionRecap`.

**Fix:** Add the `sessionRecap` declaration to the `Window` interface in `aiStream.d.ts`:

```ts
sessionRecap: {
  startStream(payload: { campaignId: string; sessionId: string }): Promise<{ started: boolean }>
  onToken(cb: (token: string) => void): void
  onFinish(cb: (finalText: string) => void): void
  onError(cb: (err: { message: string }) => void): void
  removeAllListeners(): void
}
```

---

## Warnings

### WR-01: macOS build targets only `arm64` — Intel Mac users get no native binary

**File:** `electron-builder.yml:38-41`

**Issue:** The `mac` target specifies `arch: arm64` only. Intel Mac users (still a meaningful share in 2026) receive no native binary in the GitHub Release. The `.zip` for arm64 will not run natively on x86_64 Macs (Rosetta may or may not be available depending on macOS version and user configuration).

```yaml
mac:
  target:
    - target: zip
      arch: arm64
```

**Fix:** Add `x64` (or use `universal` to produce a fat binary) if Intel Mac support is intended:

```yaml
mac:
  target:
    - target: zip
      arch:
        - arm64
        - x64
```

The GitHub Actions macOS runner (`macos-latest`) is arm64; add a second matrix entry with `macos-13` (x64) if separate builds are preferred over a universal binary.

---

### WR-02: Node.js 20 used in CI but CLAUDE.md specifies Node 24 (bundled with Electron 41)

**File:** `.github/workflows/release.yml:22-31`

**Issue:** The matrix sets `node: 20` for all three platforms. The project's CLAUDE.md specifies `Node.js 24.15 (shipped with Electron 41)` as the runtime. Building native addons (notably `better-sqlite3`) against Node 20 when the packaged app runs under Electron 41's bundled Node 24 creates an ABI mismatch risk. `@electron/rebuild` (run in the workflow at line 49) re-compiles against Electron's Node ABI, so the runtime binary is correct — but build-time type checking and any Node-version-specific behavior in the build scripts run under the wrong Node version.

**Fix:** Align CI Node version with the project standard:

```yaml
node: 24
```

---

### WR-03: `updateChecker.test.ts` uses dynamic `import()` inside each `it` block — module cache bypass relies on undocumented Vitest behavior

**File:** `src/main/services/updateChecker.test.ts:55,76,99,115,132,151`

**Issue:** Every test case calls `await import('./updateChecker')` after stubbing `global.fetch`. This pattern works only if Vitest clears the module registry between `it` blocks, which it does when `vi.resetModules()` is called in `beforeEach`. However, `beforeEach` here calls `vi.stubGlobal` but never `vi.resetModules()`. Without a module reset, the second and subsequent tests re-use the already-cached module, meaning the `fetch` stub set in `beforeEach` of one test may or may not be visible inside the cached closure. In practice Vitest's default module isolation per `describe` means this likely works, but it is fragile — adding `isolate: true` to the vitest config or a `beforeEach(() => vi.resetModules())` would make the intent explicit and prevent future regressions.

**Fix:**

```ts
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn())
})
```

---

### WR-04: `UpdateBanner` calls `trpc.appPrefs.checkForUpdate.query()` directly outside a tRPC React hook — bypasses error boundary

**File:** `src/renderer/src/components/UpdateBanner.tsx:25-28`

**Issue:** `queryFn: () => trpc.appPrefs.checkForUpdate.query()` calls the tRPC vanilla client directly. If the tRPC client is not initialized or returns an error, `useQuery` will enter an error state. No `onError` callback, no `retry: false`, and no error UI is present in the component. TanStack Query's default behavior retries failed queries 3 times with exponential back-off — against a GitHub API endpoint this means up to 3 extra outbound requests on startup whenever the API is unavailable (GitHub rate-limiting, no network). The update check is supposed to be fire-and-forget per D-04, but the TanStack Query retry behavior contradicts that.

**Fix:** Set `retry: false` on the update check query to match the intended silent-fail contract:

```ts
const { data } = useQuery({
  queryKey: ['appPrefs', 'checkForUpdate'],
  queryFn: () => trpc.appPrefs.checkForUpdate.query(),
  staleTime: 10 * 60 * 1000,
  retry: false,
})
```

---

### WR-05: `changeDataFolder` does not verify target directory exists or is writable before backup

**File:** `src/main/trpc/routers/appPrefs.ts:150-155`

**Issue:** `path.join(input.folderPath, 'solocampaign.db')` is constructed and passed directly to `sqlite.backup()`. If `input.folderPath` refers to a non-existent directory, the backup call will throw with a native SQLite error whose message is opaque to end users (e.g., `"unable to open database file"`). The Zod validator only enforces `z.string().min(1)` — it does not verify the path is an accessible directory. A pre-flight `fs.access(input.folderPath, fs.constants.W_OK)` would give a clear error message before attempting the backup.

**Fix:**

```ts
import { access, constants } from 'node:fs/promises'

// Before sqlite.backup():
await access(input.folderPath, constants.W_OK)
```

Wrap in a `TRPCError` with `code: 'BAD_REQUEST'` and a user-readable message on failure.

---

### WR-06: `removeAllListeners` in `aiStream` removes `ai:mutations-applied` but `removeOnMutationsApplied` does not — asymmetric cleanup

**File:** `src/preload/index.ts:87-90, 112-115`

**Issue:** `removeAllListeners` clears four channels including `ai:mutations-applied` (line 90). `removeOnMutationsApplied` (line 113) clears only `ai:mutations-applied`. A component that registers `onMutationsApplied` and then calls `removeAllListeners` (e.g., via `useAiStream`) will clear the `ai:mutations-applied` listener correctly. But a component that registers `onMutationsApplied` and calls only `removeOnMutationsApplied` does NOT clear `ai:token`, `ai:finish`, or `ai:error` — those leak if not also cleaned up separately. The JSDoc on `removeOnMutationsApplied` says "Use in component cleanup when not relying on removeAllListeners," which implies the caller is responsible for the other channels, but this asymmetry is a footgun. There is no enforcement that callers who use `removeOnMutationsApplied` are also calling `removeAllListeners` for the remaining channels.

**Fix:** Document explicitly in the JSDoc which other cleanup must accompany `removeOnMutationsApplied`, or redesign to a per-channel `removeListener` API so callers can compose cleanup precisely.

---

## Info

### IN-01: `electron-builder.yml` references `"Reference Documents/Converted"` — path with spaces may fail on some CI environments

**File:** `electron-builder.yml:29-32`

**Issue:** The `extraResources` stanza includes `from: "Reference Documents/Converted"`. Directory names containing spaces are legal but can cause subtle escaping issues in shell scripts or CI matrix steps that invoke electron-builder via `npm run build` without explicit quoting. The CI workflow does not reference this path directly, but any ad-hoc `electron-builder --config` invocation from a script without proper quoting will break.

**Fix:** Rename the directory to `reference-documents/converted` (no spaces) and update both `electron-builder.yml` and any other references.

---

### IN-02: `aiStream.d.ts` file name does not match its scope — it also declares `shellBridge`, `appPrefsSync`, `platform`

**File:** `src/renderer/src/types/aiStream.d.ts:1`

**Issue:** The file is named `aiStream.d.ts` but contains declarations for `window.shellBridge`, `window.appPrefsSync`, and `window.platform` in addition to `window.aiStream`. This makes the file difficult to discover when looking for shell bridge or preferences sync types and makes the missing `sessionRecap` declaration (CR-04) harder to notice.

**Fix:** Rename to `window.d.ts` or `preload.d.ts` to reflect that it augments all preload-exposed globals.

---

### IN-03: `generate_release_notes: false` with static body loses structured release notes

**File:** `.github/workflows/release.yml:90`

**Issue:** `generate_release_notes: false` disables GitHub's automatic changelog generation. The static `body:` block on lines 91-126 provides installation instructions but no changelog. Users have no way to see what changed between versions from the release page without reading commit history manually.

**Fix:** Either set `generate_release_notes: true` (and remove/shrink the static body so it becomes a preamble), or adopt a `CHANGELOG.md`-driven approach (e.g., `conventional-changelog` in CI) to populate the release body with actual changes.

---

_Reviewed: 2026-06-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
