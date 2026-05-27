---
phase: 4
slug: long-campaign-memory-session-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.0.0 |
| **Config file** | `vitest.config.ts` (electron-vite generated) |
| **Quick run command** | `npx vitest run src/main/ai/contextBuilder.test.ts src/main/db/sessionsRepo.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

**Note on pre-existing failures:** 4 test files fail with `ERR_DLOPEN_FAILED` (better-sqlite3 native binding in Vitest's Node process — not Electron's Node). This is a known Phase 3 carry-over. Phase 4 DB tests (`sessionsRepo.test.ts`) will have the same issue in local dev but pass in CI. The 111+ non-DB unit tests are the reliable local baseline.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/main/ai/contextBuilder.test.ts src/main/db/sessionsRepo.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green (111 existing + new Phase 4 tests)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Schema migration + sessionsRepo CRUD | 01 | 1 | SESS-03, SESS-04 | — | session_id FK is nullable; no ON DELETE SET NULL | unit | `npx vitest run src/main/db/sessionsRepo.test.ts` | ❌ W0 | ⬜ pending |
| messagesRepo.getBySessionId() | 01 | 1 | SESS-02, SESS-03 | — | null sessionId returns empty array (not all null-session messages) | unit | `npx vitest run src/main/db/sessionsRepo.test.ts` | ❌ W0 | ⬜ pending |
| ContextBuilder v2 — L1 assembly | 02 | 2 | SESS-02 | — | L1 overflow triggers isL1Overflow=true + fallback to last 30 msgs | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ W0 | ⬜ pending |
| ContextBuilder v2 — L2 injection | 02 | 2 | SESS-02 | — | L2 block truncated at CHARS_L2_CAP (8000 chars) | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ W0 | ⬜ pending |
| ContextBuilder v2 — L3 injection | 02 | 2 | SESS-02 | — | L3 block truncated at CHARS_L3_CAP (4000 chars) | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ W0 | ⬜ pending |
| ContextBuilder v2 — injection order | 02 | 2 | SESS-02 | — | System prompt order matches D-17 | unit | `npx vitest run src/main/ai/contextBuilder.test.ts` | ❌ W0 | ⬜ pending |
| sessions tRPC procedures | 03 | 3 | SESS-03, SESS-04 | — | Zod validates input lengths (location ≤200, notes ≤1000) | unit | `npx vitest run src/main/trpc/routers/sessions.test.ts` | ❌ W0 | ⬜ pending |
| sessions.start sets activeSessionMap | 03 | 3 | SESS-03 | — | Main process tracks session ID independently of renderer | unit | `npx vitest run src/main/trpc/routers/sessions.test.ts` | ❌ W0 | ⬜ pending |
| recapGenerator — generateSessionRecap | 04 | 4 | SESS-04 | — | Uses RECAP_SYSTEM_PROMPT; primary provider (not fallback) | unit | `npx vitest run src/main/ai/recapGenerator.test.ts` | ❌ W0 | ⬜ pending |
| recapGenerator — generateRollingSummary | 04 | 4 | SESS-04 | — | Uses all sessions older than L2 window | unit | `npx vitest run src/main/ai/recapGenerator.test.ts` | ❌ W0 | ⬜ pending |
| IPC ai:send-message session_id tagging | 04 | 4 | SESS-02, SESS-03 | — | Messages tagged with active session_id from main-process map | manual | Launch app, start session, send message, inspect DB | — | ⬜ pending |
| SessionStartModal — all fields optional | 05 | 5 | SESS-03 | — | Begin Session works with empty location/goal/notes | manual | Open modal, click Begin Session with no fields filled | — | ⬜ pending |
| EndSessionModal — recap streams then editable | 05 | 5 | SESS-04 | — | Recap textarea editable after streaming; Save Session enabled | manual | End session, watch stream, verify textarea editable | — | ⬜ pending |
| Chat input locked until session active | 05 | 5 | SESS-03 | — | Textarea + Send replaced by locked banner | manual | Open campaign, verify locked state; start session, verify unlock | — | ⬜ pending |
| L1 overflow warning bar | 05 | 5 | SESS-02 | — | Warning shows only after 24000+ chars in current session | manual | (difficult to trigger manually — verify via unit test) | — | ⬜ pending |
| SessionJournalTab — session cards | 06 | 6 | SESS-04 | — | Newest-first order; expand/collapse; notes editable; save fires mutation | manual | End multiple sessions, open Journal tab, verify cards | — | ⬜ pending |
| Player notes save (Ctrl+Enter + button) | 06 | 6 | SESS-04 | — | Both save paths fire updatePlayerNotes mutation | manual | Expand journal card, edit notes, Ctrl+Enter, verify save | — | ⬜ pending |
| Session N+1 references earlier events | all | all | SESS-03 (success criteria 3) | — | System prompt inspection shows L2/L3 blocks | manual | Play 2 sessions; verify second session opening mentions first | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/db/sessionsRepo.test.ts` — stubs for SESS-03, SESS-04 DB layer (create, end, saveRecap, getLastNCompleted, getLastLocation)
- [ ] Update `src/main/ai/contextBuilder.test.ts` — add SESS-02 test stubs for v2 behavior (L1/L2/L3 assembly, injection order, overflow)
- [ ] `src/main/ai/recapGenerator.test.ts` — stubs for SESS-04 recap + rolling summary generation
- [ ] `src/main/trpc/routers/sessions.test.ts` — stubs for session tRPC procedure validation
- [ ] `src/renderer/src/components/ui/scroll-area.tsx` — install via `npx shadcn@latest add scroll-area`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI references earlier sessions in narration | SESS-02 (success criteria 3) | Requires live LLM + 2 completed sessions | Play 2 sessions, start session 3, verify opening narration references session 1-2 events |
| Context window token overflow does not crash | SESS-02 (success criteria 4) | Requires 10+ long sessions | Run 10+ sessions, verify no ERR_CONTENT_OVERFLOW or context error |
| App-close mid-session auto-ends session | SESS-03 (D-06) | Requires Electron app lifecycle | Start session, force-close app, reopen — verify session ended + summary generates |
| Rolling summary injected in session N+1 | SESS-02 (D-17) | Requires 4+ completed sessions for L3 | Play 4 sessions, start session 5, inspect system prompt via logging |
| recap streams correctly into EndSessionModal | SESS-04 (D-09) | Live streaming UX | End session, watch streaming cursor appear, text populate, then textarea activate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
