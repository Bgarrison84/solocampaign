---
phase: 5
slug: rules-engine-dice-combat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- src/main/ai/toolSchemas.test.ts src/main/ai/mutationPipeline.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/main/ai/toolSchemas.test.ts src/main/ai/mutationPipeline.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01 | foundation | 0 | COMB-01–04, CHAR-08, PROG-01–02, STATE-05 | T-5-01 | Zod bounds on all numeric tool args | unit | `npm test -- src/main/ai/toolSchemas.test.ts` | ⬜ Wave 0 | ⬜ pending |
| 5-02 | combatantsRepo | 0 | COMB-02 | T-5-02 | N/A | unit | `npm test -- src/main/db/combatantsRepo.test.ts` | ⬜ Wave 0 | ⬜ pending |
| 5-03 | characterSpellsRepo | 0 | CHAR-08 | — | N/A | unit | `npm test -- src/main/db/characterSpellsRepo.test.ts` | ⬜ Wave 0 | ⬜ pending |
| 5-04 | campaignEventsRepo | 0 | STATE-05 | — | N/A | unit | `npm test -- src/main/db/campaignEventsRepo.test.ts` | ⬜ Wave 0 | ⬜ pending |
| 5-05 | mutationPipeline | 1 | PROG-02, COMB-03 | T-5-01 | JSON-tail Zod same pipeline as tool calls | unit | `npm test -- src/main/ai/mutationPipeline.test.ts` | ⬜ Wave 0 | ⬜ pending |
| 5-06 | diceRoller | 1 | COMB-01 | — | N/A | unit | `npm test -- src/renderer/src/lib/dice.test.ts` | ⬜ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/ai/toolSchemas.test.ts` — Zod validation stubs for all 12 tool schemas (COMB-01 through STATE-05)
- [ ] `src/main/ai/mutationPipeline.test.ts` — applyMutationBatch(), JSON-tail parser, long rest recovery, short rest
- [ ] `src/main/db/combatantsRepo.test.ts` — CRUD: addCombatant, updateHp, updateConditions, endCombat
- [ ] `src/main/db/characterSpellsRepo.test.ts` — seed from JSON, deductSpellSlot, undoCast
- [ ] `src/main/db/campaignEventsRepo.test.ts` — insert, listByCampaignId
- [ ] `src/renderer/src/lib/dice.test.ts` — rollExpression wrapper (4d6kh3, 2d6+3, d20)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI calls `updateHp` tool in LM Studio response | COMB-03 | Requires live LLM inference | Configure LM Studio in app, start combat, have AI attack player, verify HP chip appears |
| AI calls `showDiceRoll` for enemy attack | COMB-03 | Requires live LLM inference | Verify dice chip renders in StoryScrollPanel with breakdown |
| `processRest` tool fires on AI rest grant | PROG-02 | Requires live LLM inference | Click Rest → Short Rest, verify AI narrates and `processRest` fires |
| Level-up amber banner appears at XP threshold | PROG-01 | UI + state integration | Award XP manually in dev, verify banner appears at 300 XP (Level 2) |
| Concentration warning dialog on second conc. spell | CHAR-08 | UI interaction | Cast Bless (concentration), then try to cast Hold Person, verify warning dialog |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
