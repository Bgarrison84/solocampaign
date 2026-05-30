---
phase: 6
slug: quests-npcs-world-state
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | STATE-01 | — | questsRepo rejects empty name | unit | `npm run test -- --run src/main/db/questsRepo.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 0 | STATE-02 | — | npcsRepo rejects duplicate npcId | unit | `npm run test -- --run src/main/db/npcsRepo.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 0 | STATE-03 | — | factionsRepo upserts on conflict | unit | `npm run test -- --run src/main/db/factionsRepo.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 0 | STATE-04 | — | worldState columns nullable on campaigns | unit | `npm run test -- --run src/main/db/questsRepo.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | STATE-01 | — | addQuest tool creates with status 'Active' | unit | `npm run test -- --run src/main/ai/toolSchemas.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | STATE-02 | — | addNpc tool creates with correct relationship | unit | `npm run test -- --run src/main/ai/toolSchemas.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | STATE-03 | — | updateFaction upserts correctly | unit | `npm run test -- --run src/main/ai/toolSchemas.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-04 | 02 | 1 | WORLD-03 | — | updateWorldTime validates enum values | unit | `npm run test -- --run src/main/ai/toolSchemas.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-05 | 02 | 1 | WORLD-03 | — | updateLocation accepts string[] | unit | `npm run test -- --run src/main/ai/toolSchemas.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-06 | 02 | 1 | PARTY-03 | — | awardInspiration flips hasInspiration | unit | `npm run test -- --run src/main/ai/toolSchemas.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | STATE-01 | — | quests tRPC router list returns campaign quests | unit | `npm run test -- --run src/main/trpc/quests.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | STATE-02 | — | npcs tRPC router list returns campaign NPCs | unit | `npm run test -- --run src/main/trpc/npcs.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/db/questsRepo.test.ts` — stubs for STATE-01
- [ ] `src/main/db/npcsRepo.test.ts` — stubs for STATE-02
- [ ] `src/main/db/factionsRepo.test.ts` — stubs for STATE-03
- [ ] `src/main/ai/toolSchemas.test.ts` — stubs for Phase 6 tool schema validation (STATE-01 through PARTY-03)
- [ ] `src/main/trpc/quests.test.ts` — stubs for quests router (STATE-01)
- [ ] `src/main/trpc/npcs.test.ts` — stubs for npcs router (STATE-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quests tab appears as 6th tab in right panel | STATE-01 | UI rendering requires Electron app | Launch app, open campaign, verify "Quests" tab visible after Session Journal |
| NPC Tracker tab shows NPC list + collapsible Factions section | STATE-02, STATE-03 | UI rendering | Launch app, trigger AI narration that introduces an NPC, verify NPC appears in tracker |
| Campaign header shows calendar strip + location breadcrumb | WORLD-03, STATE-04 | UI rendering | Trigger updateWorldTime + updateLocation tool calls, verify header updates immediately |
| Inspiration chip appears when AI awards inspiration | PARTY-03 | AI tool call integration | Trigger awardInspiration via AI, verify amber chip appears in MutationChipStack |
| AI correctly references quest/NPC IDs in subsequent tool calls | STATE-01, STATE-02 | Requires live AI session | Play session, introduce quest and NPC, then trigger update — verify AI uses correct IDs from system prompt |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
