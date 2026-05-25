---
phase: 2
slug: character-domain-live-sheet
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-24
updated: 2026-05-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-xx-01 | TBD | 1 | CHAR-01 | — | `calcHP` returns hit die + CON mod | unit | `npm test -- src/main/characters/calculations.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-02 | TBD | 1 | CHAR-01 | — | `calcAC` returns 10 + DEX mod (unarmored) | unit | `npm test -- src/main/characters/calculations.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-03 | TBD | 1 | CHAR-01 | — | `buildSpellSlots` returns correct slot map for Cleric level 1 | unit | `npm test -- src/main/characters/calculations.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-04 | TBD | 1 | CHAR-01 | — | `charactersRepo.createWithResources` atomically inserts 3 rows | unit | `npm test -- src/main/db/charactersRepo.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-05 | TBD | 1 | CHAR-01 | T-IPC | `characters.create` tRPC procedure writes character to DB; Zod rejects malformed input | unit | `npm test -- src/main/trpc/routers/characters.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-06 | TBD | 2 | CHAR-07 | T-IPC | delta-based HP mutation clamps at 0 and hpMax; rejects out-of-range delta | unit | `npm test -- src/main/trpc/routers/characters.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-07 | TBD | 2 | CHAR-07 | T-JSON | conditions JSON roundtrip (parse/stringify) through repo layer | unit | `npm test -- src/main/db/charactersRepo.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-08 | TBD | 2 | CHAR-09 | — | `characterItems` isAttuned toggle mutation | unit | `npm test -- src/main/trpc/routers/characters.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-09 | TBD | 3 | WORLD-02 / CHAR-06 | T-PATH | `importImage` returns relative path; file exists in userData; rejects renderer-supplied path | unit (fs mock) | `npm test -- src/main/imageService.test.ts` | ❌ Wave 0 | ⬜ pending |
| 2-xx-10 | TBD | 1 | CHAR-01 | — | `contentLoader.loadContent` returns races/classes arrays (content JSON in resources/) | unit | `npm test -- src/main/db/contentLoader.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/main/characters/calculations.test.ts` — stubs for CHAR-01 auto-calc (calcHP, calcAC, buildSpellSlots)
- [x] `src/main/db/charactersRepo.test.ts` — stubs for CHAR-01 persistence + CHAR-07 JSON roundtrip
- [x] `src/main/trpc/routers/characters.test.ts` — stubs for CHAR-01, CHAR-07, CHAR-09 tRPC mutations
- [x] `src/main/imageService.test.ts` — stubs for WORLD-02 / CHAR-06 image import
- [x] `src/main/db/contentLoader.test.ts` — stubs for content loading

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 6-step wizard renders each step correctly and blocks Next on missing required fields | CHAR-01 | UI rendering — vitest runs in node environment | Open app, navigate to a campaign with no character, verify wizard auto-launches; verify each step blocks Next when required fields are empty |
| Full character sheet renders all 10 sections after wizard completion | CHAR-01 | UI rendering | Complete the wizard; verify Header, Ability Scores, Saving Throws, Skills, Combat Stats, Resources, Currency, Equipment, Proficiencies, Traits all appear |
| Stepper +/- buttons persist HP/spell slots/currency immediately | CHAR-07 | Real-time UI interaction | Click +/- on HP; close and re-open app; verify value persisted |
| Condition badges toggle and persist | CHAR-07 | UI state interaction | Toggle a condition badge; restart app; verify condition state persisted |
| Portrait import shows resized image in 80×80px header slot | CHAR-06 | File system + UI | Click portrait area; import a >1024px image; verify it appears in header and file exists in userData |
| Cover image import wires to CampaignCard | WORLD-02 | UI interaction + file system | Import cover image; return to campaign list; verify CampaignCard shows the image |
| Attunement toggle updates count (1/3 attuned) | CHAR-09 | UI interaction | Toggle attunement on items; verify count updates |

---

## Threat Model

| Threat ID | Pattern | STRIDE | Mitigation in Plan |
|-----------|---------|--------|-------------------|
| T-IPC | Large/malformed backstory or name over IPC | Tampering | Zod schema: `name: z.string().min(1).max(100)`, `backstory: z.string().max(2000)`, `delta: z.number().int().min(-9999).max(9999)` |
| T-PATH | Path traversal via image import | Tampering | `dialog.showOpenDialog` in main process — user picks file via OS dialog; renderer never supplies raw path |
| T-JSON | JSON column injection via conditions/proficiencies | Tampering | Validate via Zod before serializing to JSON column — never `JSON.parse(userInput)` directly |
| T-FK | Foreign key violation (campaignId not in campaigns) | Tampering | `PRAGMA foreign_keys = ON` (Phase 1); Drizzle `.references()` generates FK constraint |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 06 Tasks 1+2 use typecheck-only by design — renderer components cannot be meaningfully tested in vitest Node env; covered by manual verification table)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-05-25
