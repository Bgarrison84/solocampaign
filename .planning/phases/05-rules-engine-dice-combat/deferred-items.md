# Deferred Items — Phase 5

Out-of-scope discoveries logged during execution. NOT fixed by the discovering plan.

## From 05-01 (Wave 0 foundation)

- **Pre-existing typecheck error: `src/renderer/src/components/ui/scroll-area.tsx(4,20)` — `Cannot find module '@/lib/utils'`.**
  - The file imports `cn` from `@/lib/utils`, but `tsconfig.json` only defines the `~/*` path alias, not `@/*`.
  - Confirmed pre-existing: both `scroll-area.tsx` and `tsconfig.json` are unchanged from the phase base commit `cb72e20`, and neither is in 05-01's scope.
  - Note: the main checkout has an uncommitted modification to `tsconfig.json` (visible in session-start git status); a future plan that touches the build/tsconfig should add the `@/*` alias (mapping to `./src/renderer/src/*`) to resolve this.
