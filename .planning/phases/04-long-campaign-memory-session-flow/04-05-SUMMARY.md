---
phase: "04"
plan: "05"
subsystem: renderer-session-ui
tags: [session-flow, zustand, ui, modal, streaming, react]
dependency_graph:
  requires: ["04-04"]
  provides: ["renderer-session-ui", "sessionStore", "useRecapStream", "SessionStartModal", "EndSessionModal"]
  affects: ["CampaignViewScreen", "ChatInputArea", "StoryScrollPanel"]
tech_stack:
  added: []
  patterns:
    - "Zustand store following windowStore pattern (state fields first, actions last)"
    - "IPC streaming hook mirroring useAiStream (useEffect listener registration + cleanup)"
    - "Two-phase modal (streaming read-only div → editable Textarea after onFinish)"
    - "prevIsSessionActive ref guard for D-04 auto-narration (prevents re-fire on refresh)"
    - "Fragment root on StoryScrollPanel to render warning bar as sibling to scroll area"
key_files:
  created:
    - src/renderer/src/stores/sessionStore.ts
    - src/renderer/src/hooks/useRecapStream.ts
    - src/renderer/src/components/SessionStartModal.tsx
    - src/renderer/src/components/EndSessionModal.tsx
  modified:
    - src/renderer/src/components/ChatInputArea.tsx
    - src/renderer/src/components/StoryScrollPanel.tsx
    - src/renderer/src/screens/CampaignViewScreen.tsx
    - src/renderer/src/types/aiStream.d.ts
decisions:
  - "getLastLocation tRPC returns string|null directly (not { location: string|null }) — adjusted lastLocationQuery.data access accordingly"
  - "messagesQuery reuses ['ai', 'getMessages', id] key (same as StoryScrollPanel) to avoid double-fetching — D-04 guard reads from this shared cache"
  - "L1Overflow listener registered separately from useAiStream's onFinish — both fire on same event; useAiStream cleanup handles removeAllListeners"
  - "onFinish type extended to meta?: { isL1Overflow?: boolean } in aiStream.d.ts — backward-compatible (existing callers pass no-arg callback)"
metrics:
  duration: "25min"
  completed_date: "2026-05-28"
  tasks: 3
  files: 8
---

# Phase 4 Plan 05: Renderer Session UI Summary

Complete renderer-side session lifecycle wired: Zustand store, IPC recap hook, start/end modals with streaming, chat locked state, L1 overflow warning, and D-04 auto-narration trigger.

## What Was Built

### Task 1: sessionStore + useRecapStream (commit 2cf3270)

**`src/renderer/src/stores/sessionStore.ts`** — Zustand store with 5 state fields and 3 actions following `windowStore` pattern exactly.

- `startSession(sessionId, sessionNumber, context)` — called on `sessions.start` success; sets `isSessionActive: true`, clears `isL1Overflow`
- `endSession()` — called on `sessions.saveRecap` success; resets all fields
- `setL1Overflow(overflow)` — called from `ai:finish` meta handler in `CampaignViewScreen`

**`src/renderer/src/hooks/useRecapStream.ts`** — IPC streaming hook mirroring `useAiStream` structure.

- `recapText`: accumulated tokens (for streaming display)
- `finalText`: set by `onFinish` callback (seeds editable textarea)
- `startRecap()`: resets state and calls `window.sessionRecap.startStream`
- Window type augmentation for `window.sessionRecap` API included inline

### Task 2: SessionStartModal + EndSessionModal (commit b9f32f7)

**`SessionStartModal`** — Three optional fields (location, goal, notes). Location pre-filled from `lastLocationQuery`. Enter key advances focus field-to-field. `sessions.start` mutation → `sessionStore.startSession` → close.

**`EndSessionModal`** — Two-phase recap display:
- Phase A (streaming): read-only `aria-live` div with blinking cursor
- Phase B (done): `useEffect([recap.isStreaming, recap.finalText])` transitions to editable Textarea
- Player notes textarea, Ctrl+Enter hotkey, `sessions.saveRecap` mutation → `sessionStore.endSession` → query invalidation → close

### Task 3: UI integration (commit ab1e2d6)

**`ChatInputArea`** — `isSessionActive` prop (default `true`). When `false`, renders Play-icon locked banner instead of textarea/send. `useEffect` autofocuses textarea on session start. Hotkey `enabled` condition includes `!!isSessionActive`.

**`StoryScrollPanel`** — `isL1Overflow` prop. Component now returns a Fragment: existing scroll div + conditional amber `AlertTriangle` warning bar below scroll area. Warning bar uses `role="alert" aria-live="assertive"`.

**`CampaignViewScreen`** — Complete integration:
- Imports: `Play`, `Square`, `useSessionStore`, `SessionStartModal`, `EndSessionModal`
- Session queries: `sessions.getActive` (D-05 restore), `sessions.getLastLocation` (D-07 pre-fill), `ai.getMessages` (D-04 guard)
- D-05 restore effect: `activeSessionQuery.data` → `startSession`, `isSuccess && !data` → `endSession`
- L1Overflow effect: `window.aiStream.onFinish(handler)` registered on mount
- D-04 auto-narration: `prevIsSessionActive` ref + `useEffect` sends `[Begin session narration]` when session just activated and message count is 0
- Action bar: Start Session (`Play` icon) / End Session (`Square` icon, destructive styling) button between AI Settings and Delete Campaign
- Props: `isL1Overflow={sessionStore.isL1Overflow}` on `StoryScrollPanel`, `isSessionActive={sessionStore.isSessionActive}` on `ChatInputArea`
- Modals: `SessionStartModal` and `EndSessionModal` rendered in fragment alongside `AiSettingsModal`
- Tab label: "Session Journal" → "Journal"

**`aiStream.d.ts`** — `onFinish` extended to `(cb: (meta?: { isL1Overflow?: boolean }) => void) => void` (backward-compatible).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getLastLocation returns string|null, not { location: string|null }**
- **Found during:** Task 3 implementation
- **Issue:** Plan documents `sessions.getLastLocation.query()` returns `{ location: string | null }` but the actual tRPC router returns `sessionsRepo.getLastLocation(campaignId)` which is `string | null` directly
- **Fix:** Used `lastLocationQuery.data ?? null` instead of `lastLocationQuery.data?.location ?? null` in `CampaignViewScreen` and `SessionStartModal.lastLocation` prop
- **Files modified:** `CampaignViewScreen.tsx` (pass-through to `SessionStartModal`)
- **Commit:** ab1e2d6

## Known Stubs

None. All session UI fields connect to real tRPC procedures and DB-backed data.

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers. All inputs validated by Zod at the tRPC boundary (sessions router, plan 04-03).

## Self-Check

Files confirmed created/modified:
- [x] src/renderer/src/stores/sessionStore.ts — exists
- [x] src/renderer/src/hooks/useRecapStream.ts — exists
- [x] src/renderer/src/components/SessionStartModal.tsx — exists
- [x] src/renderer/src/components/EndSessionModal.tsx — exists
- [x] src/renderer/src/components/ChatInputArea.tsx — modified
- [x] src/renderer/src/components/StoryScrollPanel.tsx — modified
- [x] src/renderer/src/screens/CampaignViewScreen.tsx — modified
- [x] src/renderer/src/types/aiStream.d.ts — modified

Commits confirmed:
- [x] 2cf3270 — sessionStore + useRecapStream
- [x] b9f32f7 — SessionStartModal + EndSessionModal
- [x] ab1e2d6 — ChatInputArea + StoryScrollPanel + CampaignViewScreen integration

TypeScript: `npx tsc --noEmit` exits 0 after all tasks.

## Self-Check: PASSED
