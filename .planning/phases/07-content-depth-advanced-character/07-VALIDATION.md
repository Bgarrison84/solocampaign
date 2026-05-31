---
phase: 7
slug: content-depth-advanced-character
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --reporter=dot` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~35 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=dot`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 35 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | CHAR-02 | — | `calcPointBuyCost` returns correct totals for scores 8–15 | unit | `npm run test -- src/main/characters/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 0 | CHAR-02 | — | `calcPointBuyBudget` adds 27 + flaw points correctly | unit | `npm run test -- src/main/characters/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 0 | CHAR-04 | — | `calcMulticlassSpellSlots` returns correct slot table for Fighter 5 / Wizard 3 | unit | `npm run test -- src/main/characters/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 0 | CHAR-04 | — | `calcMulticlassCasterLevel` correctly applies half-caster division for Paladin | unit | `npm run test -- src/main/characters/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 0 | CHAR-05 | — | `characterFeatsRepo.add` and `list` persist feats correctly | unit | `npm run test -- src/main/db/characterFeatsRepo.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-06 | 01 | 0 | PROG-03 | — | Level-up past 20 increments level and resolves epic boon picker | unit | `npm run test -- src/main/characters/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-07 | 01 | 0 | RULES-04 | path traversal | `extractTextFromFile` returns non-empty string for test PDF | unit | `npm run test -- src/main/services/pdfExtractor.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-08 | 01 | 0 | RULES-04 | DoS | `campaignReferenceDocsRepo.create` stores content capped at 50,000 chars | unit | `npm run test -- src/main/db/campaignReferenceDocsRepo.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-09 | 01 | 0 | WORLD-01 | content injection | `contextBuilder.buildContext` includes `worldBrief` in system prompt | unit | `npm run test -- src/main/ai/contextBuilder.test.ts` | extends existing | ⬜ pending |
| 07-01-10 | 01 | 0 | STATE-06 | — | `contextBuilder.formatCharacterSummary` includes encumbrance when enabled | unit | `npm run test -- src/main/ai/contextBuilder.test.ts` | extends existing | ⬜ pending |
| 07-01-11 | 01 | 0 | PARTY-01 | party-size bypass | `charactersRepo.create` enforces `partySize` limit | unit | `npm run test -- src/main/db/charactersRepo.test.ts` | extends existing | ⬜ pending |
| 07-01-12 | 01 | 0 | PARTY-02 | companion abuse | `mutationPipeline.apply` with `addCompanion` creates `isCompanion = true` character | unit | `npm run test -- src/main/ai/mutationPipeline.test.ts` | extends existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/characters/calculations.test.ts` — extend with point buy (`calcPointBuyCost`, `calcPointBuyBudget`) and multiclass spell slot tests (`calcMulticlassSpellSlots`, `calcMulticlassCasterLevel`) and level > 20 behavior
- [ ] `src/main/services/pdfExtractor.test.ts` — new file; requires a small test PDF fixture in `src/main/services/fixtures/test.pdf`
- [ ] `src/main/db/characterFeatsRepo.test.ts` — new file; stubs for CHAR-05
- [ ] `src/main/db/customFeatsRepo.test.ts` — new file
- [ ] `src/main/db/campaignReferenceDocsRepo.test.ts` — new file; stubs for RULES-04 (50,000-char cap)
- [ ] Extend `src/main/ai/contextBuilder.test.ts` — World Overview injection, extended character summary (feats, negative traits, companions, multiclass, encumbrance)
- [ ] Extend `src/main/db/charactersRepo.test.ts` — `partySize` enforcement, `isCompanion` creation
- [ ] Extend `src/main/ai/mutationPipeline.test.ts` — `addCompanion` and `removeCompanion` pipeline tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Point buy UI shows live budget counter + negative traits section | CHAR-02, CHAR-03 | React UI rendering | Launch app, create character, select Point Buy, verify 27-pt counter + flaw checkboxes |
| Per-stat reroll button disappears after use | CHAR-02 | UI interaction state | Roll all, click reroll on one stat, verify button shows "✓ used" and is disabled |
| Multiclass option appears in Level Up modal | CHAR-04 | UI + Electron app | Level up a character, verify "Add multiclass" option appears alongside main class option |
| Feat picker appears at ASI levels (4, 8, 12, 16, 19) | CHAR-05 | UI + level-up flow | Level up to 4, verify "ASI or Feat" choice appears; select Feat, verify SRD feat list with search |
| Subclass picker appears at correct class level | CHAR-04 | UI + class-specific level | Level Fighter to 3, verify subclass dropdown; verify Cleric subclass picker at level 1 |
| Epic Boon picker replaces ASI/feat section at level 21 | PROG-03 | UI + level > 20 | Set character to level 20 manually, trigger level up, verify Epic Boon picker |
| Party character switcher chips appear for multi-character campaign | PARTY-01 | UI rendering | Create campaign with partySize=3, add 3 characters, verify chips in Character Sheet tab |
| Companions collapsible section appears below character switcher | PARTY-02 | UI rendering | Trigger `addCompanion` tool call, verify companion appears in Companions section |
| World Setup "AI Generates" produces a world brief at campaign creation | WORLD-01 | Requires live AI + Electron | Create campaign with AI-generate mode, confirm modal shows generated brief; verify `worldBrief` injected at session start |
| PDF import extracts text from a real PDF file | RULES-04 | Electron file dialog + filesystem | Use document import in world setup or homebrew import, pick a PDF, verify extracted text preview |
| SRD reference screen browses all 4 sections (Spells/Items/Rules/Monsters) | RULES-01, RULES-02 | UI navigation | Click Rules icon in campaign header, verify 4 tabs with search; click a spell, magic item, rule, monster |
| Homebrew tab in settings modal saves and reloads content | RULES-03 | UI + persistence | Open gear modal → Homebrew, write text, save, reload app, verify text persists |
| Encumbrance badges appear at 5× and 10× STR thresholds in inventory | STATE-06 | UI + weight math | Enable encumbrance, add items totaling 5× STR, verify "Encumbered" badge in inventory header |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 35s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
