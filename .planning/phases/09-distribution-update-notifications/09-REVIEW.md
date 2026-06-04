---
phase: 09-distribution-update-notifications
reviewed: 2026-06-04T00:00:00Z
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
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 09 delivers the distribution pipeline (GitHub Actions release workflow, electron-builder config) and the update notification system (updateChecker service, appPrefs tRPC router, preload shellBridge, UpdateBanner component). The overall shape is sound — the security-sensitive `shellBridge.openExternal` host allow-list is correctly enforced in the preload, the WAL-safe backup mechanism is used correctly, and the silent-on-error contract for update checks is well-reasoned.

The original four critical findings (CR-01 through CR-04) and WR-04 have all been resolved (confirmed by source inspection on 2026-06-04). Five warnings remain open.

---

## WR-04 Resolution

**Resolved 2026-06-04.** `retry: false` was added to the `checkForUpdate` useQuery in `src/renderer/src/components/UpdateBanner.tsx` (line 28). Verified:

- `retry: false` is on the correct query — `queryKey: ['appPrefs', 'checkForUpdate']` (lines 24-29).
- The second useQuery (`appPrefs.get`, `queryKey: ['appPrefs']`, lines 32-35) intentionally does NOT carry `retry: false`, which is correct — user preferences should retry normally.
- No new issues were found in `UpdateBanner.tsx` during the targeted re-review.

---

## Resolved Critical Issues (reference)

The following four criticals were confirmed resolved by source inspection on 2026-06-04 and are retained here for audit traceability only.

### CR-01 (RESOLVED): NaN guard omitted for `currentVersion` parts

**File:** `src/main/services/updateChecker.ts:77-85`

NaN guard extended to cover current version parts (`ca`/`ci`/`cp`) alongside the already-present remote parts guard. Fix confirmed present in source.

---

### CR-02 (RESOLVED): `changeDataFolder` does not clean up backup file when `sqlite.backup()` throws

**File:** `src/main/trpc/routers/appPrefs.ts:152-187`

`await unlink(newDbPath).catch(() => {})` added in the outer `catch` block before re-throwing. Fix confirmed present in source.

---

### CR-03 (RESOLVED): Release workflow does not publish `latest*.yml` / `.blockmap`

**File:** `.github/workflows/release.yml:126-130`

Published files glob extended to include `*.yml` and `*.blockmap` artifacts. Fix confirmed present in source.

---

### CR-04 (RESOLVED): `window.sessionRecap` not declared in `aiStream.d.ts`

**File:** `src/renderer/src/types/aiStream.d.ts`

`sessionRecap` surface added to the `Window` interface augmentation. Fix confirmed present in source.

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

**Issue:** The file is named `aiStream.d.ts` but contains declarations for `window.shellBridge`, `window.appPrefsSync`, and `window.platform` in addition to `window.aiStream`. This makes the file difficult to discover when looking for shell bridge or preferences sync types and makes the missing `sessionRecap` declaration (now resolved as CR-04) harder to notice.

**Fix:** Rename to `window.d.ts` or `preload.d.ts` to reflect that it augments all preload-exposed globals.

---

### IN-03: `generate_release_notes: false` with static body loses structured release notes

**File:** `.github/workflows/release.yml:90`

**Issue:** `generate_release_notes: false` disables GitHub's automatic changelog generation. The static `body:` block on lines 91-126 provides installation instructions but no changelog. Users have no way to see what changed between versions from the release page without reading commit history manually.

**Fix:** Either set `generate_release_notes: true` (and remove/shrink the static body so it becomes a preamble), or adopt a `CHANGELOG.md`-driven approach (e.g., `conventional-changelog` in CI) to populate the release body with actual changes.

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
