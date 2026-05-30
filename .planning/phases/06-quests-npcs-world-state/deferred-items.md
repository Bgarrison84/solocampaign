# Phase 6 — Deferred Items

Out-of-scope discoveries logged during execution. Not fixed (outside the touching plan's scope).

## Pre-existing TypeScript errors (discovered during 06-01)

These 7 `tsc --noEmit` errors exist on the phase base commit and are unrelated to
plan 06-01's files (migration/schema/repos). Logged, not fixed — they belong to
AI-streaming and CampaignView wiring touched by other plans/phases.

- `src/main/ai/llmProvider.ts(181,20)`: TS2339 Property 'args' does not exist on type 'TypedToolCall<ToolSet>' (AI SDK v6 type change).
- `src/renderer/src/screens/CampaignViewScreen.tsx(217,26)`: TS2339 Property 'campaignId' ...
- `src/renderer/src/screens/CampaignViewScreen.tsx(218,36)`: TS2339 Property 'chips' ...
- `src/renderer/src/screens/CampaignViewScreen.tsx(219,10)`: TS7006 Parameter 'c' implicitly 'any'.
- `src/renderer/src/screens/CampaignViewScreen.tsx(225,40)`: TS2345 onMutationsApplied arg mismatch.
- `src/renderer/src/screens/CampaignViewScreen.tsx(243,26)`: TS2339 Property 'campaignId' ...
- `src/renderer/src/screens/CampaignViewScreen.tsx(248,40)`: TS2345 onMutationsApplied arg mismatch.

## Environment: better-sqlite3 ABI mismatch (blocks vitest in this sandbox)

`node_modules/better-sqlite3` (resolved from the main repo) is compiled for Electron's
ABI 145, while the worktree's vitest runs under system Node ABI 137. Every SQLite-backed
test in the repo (e.g. the pre-existing `combatantsRepo.test.ts`) currently fails with
`NODE_MODULE_VERSION 145 ... requires 137`. Not fixed here: rebuilding the shared native
module for Node would break the main repo's Electron runtime, and is out of this plan's
scope. Logic was instead verified via Node's built-in `node:sqlite` (ABI-independent).
Re-run `npm run test` after `npm run rebuild:sqlite` (electron-rebuild) in an environment
where the binary targets the test runtime to capture the formal green run.
