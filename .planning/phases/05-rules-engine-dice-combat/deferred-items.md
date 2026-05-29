# Deferred Items — Phase 5

Out-of-scope discoveries logged during execution. NOT fixed by the discovering plan.

## From 05-01 (Wave 0 foundation)

- **Pre-existing typecheck error: `src/renderer/src/components/ui/scroll-area.tsx(4,20)` — `Cannot find module '@/lib/utils'`.**
  - The file imports `cn` from `@/lib/utils`, but `tsconfig.json` only defines the `~/*` path alias, not `@/*`.
  - Confirmed pre-existing: both `scroll-area.tsx` and `tsconfig.json` are unchanged from the phase base commit `cb72e20`, and neither is in 05-01's scope.
  - Note: the main checkout has an uncommitted modification to `tsconfig.json` (visible in session-start git status); a future plan that touches the build/tsconfig should add the `@/*` alias (mapping to `./src/renderer/src/*`) to resolve this.

## From 05-02 (Wave 1 AI-mutation contract)

- **Environment: `better-sqlite3` native binding ABI mismatch breaks all DB-backed vitest suites.**
  - `npm test` against any DB-backed test (e.g. `combatantsRepo.test.ts` from 05-01, and the new `mutationPipeline.test.ts` applyMutationBatch cases) fails with: `The module 'better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 145. This version of Node.js requires NODE_MODULE_VERSION 137.`
  - Root cause: the installed `better-sqlite3@12.10.0` binding is compiled for Electron's Node ABI (145, via `@electron/rebuild`), but vitest runs under system Node v24.15.0 (ABI 137). The two ABIs are mutually exclusive for one compiled `.node` file.
  - Pre-existing: the same failure reproduces on 05-01's `combatantsRepo.test.ts`, which 05-02 did not touch.
  - NOT fixed here: a `node_modules` rebuild is a global side-effect on the shared dependency tree (shared with the main checkout and parallel worktree agents) and would break the Electron app build. A future infra plan should provide a vitest-time rebuild (e.g. a separate `better-sqlite3` build for the test runner, or a `pretest` step that rebuilds for system Node and a `postbuild` that rebuilds for Electron).
  - Impact on 05-02 verification: the pure `stripAndParseJsonTail` tests (4) pass under vitest; the 5 DB-backed `applyMutationBatch` tests are correctly authored against the real schema and will pass once the binding ABI matches the test runner. `npm run typecheck` passes for all main-process files.
