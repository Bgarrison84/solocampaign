---
phase: 05-rules-engine-dice-combat
verified: 2026-05-29T21:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the in-app dice roller, click d20, verify the prefix [d20: N] appears in the chat textarea. Then type '4d6kh3' in the expression field, click Roll, and verify the prefix appears with a result and the Roll button was disabled for invalid expressions."
    expected: "Die click inserts prefix, expression roll inserts prefix, invalid expression disables Roll button and shows 'Invalid expression'."
    why_human: "Cannot programmatically test the popover DOM interaction and textarea value injection in the running Electron app."
  - test: "Start a session, trigger the AI to apply combat. Verify: (a) the combat tracker auto-switches to the Combat tab, (b) combatant rows show HP bar with green/amber/red thresholds, (c) expanding a row shows the HP stepper and condition picker, and (d) the AI's dice rolls (showDiceRoll tool) render as amber chips in the story scroll."
    expected: "Combat tab auto-switches on Start Combat, HP bars use color thresholds, expanded rows show stepper+conditions, AI dice rolls render as amber chips."
    why_human: "Requires a live LLM to emit tool calls; UI interactions and visual HP-bar colors cannot be verified by static code inspection."
  - test: "Cast a leveled spell from the spell list, verify the slot pip decrements optimistically in the UI. Then cast a concentration spell (e.g. Bless) and attempt to cast a second concentration spell — confirm the 'Drop Concentration?' dialog appears."
    expected: "Slot deducts visually on cast; concentration warning dialog appears with 'Drop Concentration?' title and correct spell names."
    why_human: "Requires UI interaction in the running Electron app."
  - test: "Award enough XP to cross a level threshold (e.g. 300 XP for level 2). Verify the amber 'Level up available' banner appears. Open the Level Up modal, roll or choose average HP, confirm, and verify the [System: …] message appears in the story scroll."
    expected: "Banner appears at top of character sheet, modal shows HP choice and spell slot table, [System: Name reached Level N!] appears in story as italic amber text."
    why_human: "Requires triggering the AI awardXp tool and verifying UI state changes across multiple components."
  - test: "Click the Rest button, select Short Rest, then have the AI grant the rest (processRest short tool call). Verify the Short Rest Hit Dice modal opens automatically. Roll hit dice and click Done — confirm HP increases."
    expected: "Rest picker opens on Rest click, sending '[Player requests a short rest]' to AI. On AI grant, ShortRestHitDiceModal opens, dice are rollable, Done applies HP."
    why_human: "Requires a live AI to trigger the processRest tool call and the subsequent IPC event chain to open the modal."
  - test: "Trigger the AI to update currency (e.g. loot +50 GP). Verify: (a) a '+50 GP' chip slides in at the top-right chip stack and fades after ~4s, and (b) the character sheet currency section updates without a manual refresh."
    expected: "Currency chip appears with Coins icon and amber color, fades after 4s, character sheet GP value updates."
    why_human: "Requires a live LLM to fire the updateCurrency tool call; chip animation and cache invalidation timing cannot be verified statically."
  - test: "Open AI Settings for a campaign, toggle Permadeath mode on, save, close, and reopen. Verify the checkbox persists as checked."
    expected: "Permadeath toggle persists across modal close/reopen and across app restart."
    why_human: "Requires UI interaction and persistence verification."
---

# Phase 5: Rules Engine, Dice & Combat — Verification Report

**Phase Goal:** A user can run a full D&D combat encounter — roll dice in-app, the AI manages enemy turns with visible rolls, conditions and HP track for all combatants, spell slots deduct on cast, the AI awards XP and prompts level-up, rests recover resources, and currency moves in/out automatically.
**Verified:** 2026-05-29T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can roll d4/d6/d8/d10/d12/d20/d100 and custom expressions in-app; results appear in chat for the AI to narrate | VERIFIED | `DiceRollerPopover.tsx` renders all 7 die buttons and expression input using `rollExpression`/`isValidExpression` from `dice.ts`; `handleRoll` in `ChatInputArea.tsx` prepends `[die: N]` prefix; `StoryScrollPanel.tsx` renders `dice_roll` role messages as amber chips. `dice.ts` wraps rpg-dice-roller@5.0.0 (installed, in `package.json`). |
| 2 | Combat tracker shows initiative order, current HP, and active conditions for player, party, companions, and enemies in one view | VERIFIED | `CombatTrackerTab.tsx` (396 lines) queries `trpc.combat.listActive`, renders Collapsible rows per combatant with Progress HP bar (green/amber/red thresholds), condition Badge chips, initiative order, HP fraction. `combatStore.ts` drives controlled Tabs with `activeTab='combat-tracker'` on `startCombat`. |
| 3 | AI manages enemy initiative, turn order, actions, and visible dice rolls; user never sees a hidden AI roll | VERIFIED (wiring only — live LLM needed for full test) | `PHASE5_TOOLS` in `toolSchemas.ts` provides `addCombatant`, `updateHp`, `showDiceRoll`, `endCombat` tools. `mutationPipeline.ts` applies them in a `db.transaction()`. `index.ts` passes `tools: PHASE5_TOOLS` to `streamChat`. `showDiceRoll` pushes to `diceRolls` accumulator and persists as `role: 'dice_roll'` message. `contextBuilder.ts` injects the tool-usage prompt block. Live LLM reliability is human-only. |
| 4 | User can cast a spell from their spell list — the slot deducts automatically, concentration tracks, and the AI is aware the spell was cast | VERIFIED | `SpellListSection.tsx` (513 lines) renders grouped spell list for spellcasters; `castSpell` mutation deducts optimistically; `ConcentrationWarningDialog` gates double-concentration casts; `CharacterSheetTab.tsx` dispatches `campaign:chat-prefix` CustomEvent; `ChatInputArea.tsx` listens and prepends casting prefix; `spells.ts` tRPC router registered with `castSpell`, `undoCast`, `updateConcentration`; `contextBuilder.ts` injects `Concentrating on:` summary line. |
| 5 | After an encounter the AI awards XP, the app totals it, and the user is auto-prompted to level up at the threshold; short/long rests restore appropriate resources after AI narration | VERIFIED | `awardXp` tool in pipeline calls `charactersRepo.updateXp`; `LevelUpBanner.tsx` renders when `xp >= XP_THRESHOLDS[nextLevel]` in `CharacterSheetTab.tsx`; `LevelUpModal.tsx` (324 lines) offers HP-roll/average choice, spell slot table, and calls `trpc.characters.levelUp` + `recordSystemMessage`; `processRest` in `mutationPipeline.ts` applies long-rest (HP to max, all slots) and short-rest (pact slots + death saves); `ShortRestHitDiceModal.tsx` (210 lines) handles hit-dice rolling; `RestPickerDialog.tsx` (90 lines) sends exact `[Player requests a short/long rest]` message; `CampaignViewScreen.tsx` detects `Short rest taken` chip via `onMutationsApplied` to open modal. |
| 6 | Currency (CP/SP/EP/GP/PP) auto-updates from loot and purchases via AI tool calls | VERIFIED | `updateCurrency` case in `mutationPipeline.ts` iterates all 5 denominations, calls `charactersRepo.updateCurrency` per non-zero delta, pushes currency chips; `MutationChipStack.tsx` renders `Coins` icon for type `currency`; `CampaignViewScreen.tsx` `useEffect` invalidates `['characters','getByCampaignId',id]` on `ai:mutations-applied` so character sheet refetches. |

**Score:** 6/6 truths verified (automated evidence)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `resources/migrations/0004_phase5_rules_engine.sql` | Migration creating 3 tables + 5 ALTER TABLE columns | VERIFIED | File exists with `CREATE TABLE combatants`, `CREATE TABLE campaign_events`, `CREATE TABLE character_spells`, and 5 ALTER TABLE statements for character_resources + campaigns |
| `resources/spells.json` | SRD spell metadata (>=40 spells) | VERIFIED | 46 spells validated; 13 cantrips (level 0), 13 concentration spells; all required fields present with real descriptions |
| `src/main/db/combatantsRepo.ts` | Combatant CRUD | VERIFIED | Exports `combatantsRepo` with create, listActive, updateHp, updateConditions, remove, endCombat, clearForCampaign |
| `src/main/db/campaignEventsRepo.ts` | Append-only event log CRUD | VERIFIED | Exports `campaignEventsRepo` with insert, listByCampaign |
| `src/main/db/characterSpellsRepo.ts` | Character spell list CRUD | VERIFIED | Exports `characterSpellsRepo` with seed, listByCharacter, removeAll |
| `src/renderer/src/lib/dice.ts` | rpg-dice-roller wrapper | VERIFIED | Exports `rollExpression`, `isValidExpression`, `RollResult`; uses `DiceRoller` from rpg-dice-roller@5.0.0 |
| `src/main/ai/toolSchemas.ts` | 12 tool definitions + PHASE5_TOOLS | VERIFIED | 12 `tool()` registrations confirmed (grep count); `PHASE5_TOOLS` exported as const satisfies ToolSet; no `execute` property (only in comments) |
| `src/main/ai/mutationPipeline.ts` | applyMutationBatch + stripAndParseJsonTail | VERIFIED | Both functions exported; `db.transaction()` wraps the batch loop; per-tool `safeParse` dispatch; 12 `logEvent` calls (one per tool); long/short rest `applyRest` implementation present |
| `src/renderer/src/stores/combatStore.ts` | Zustand combat state + controlled activeTab | VERIFIED | `startCombat` sets `isCombatActive: true` and `activeTab: 'combat-tracker'`; `endCombat` clears combat but leaves activeTab |
| `src/main/trpc/routers/combat.ts` | combat tRPC router (6 procedures) | VERIFIED | listActive, startCombat, endCombat, updateHp, updateConditions, addCombatant — all present, all logging to campaign_events |
| `src/renderer/src/components/CombatTrackerTab.tsx` | Combat Tracker tab UI | VERIFIED | 396 lines; queries trpc.combat.listActive; Collapsible rows with Progress HP bar; ConditionBadge picker; Add Combatant form; optimistic mutations |
| `src/renderer/src/components/DiceRollerPopover.tsx` | Dice roller popover | VERIFIED | Exports `DiceRollerPopover`; 7 die buttons (d4-d100); expression input; `rollExpression`/`isValidExpression` from `../lib/dice`; `onRoll` called with `[die: N] ` prefix |
| `src/renderer/src/components/StoryScrollPanel.tsx` | dice_roll chip + system event rendering | VERIFIED | `msg.role === 'dice_roll'` branch with defensive JSON.parse (try/catch); amber chip with `role="note"`; `msg.role === 'system'` branch with `text-sm italic text-amber-400` |
| `src/main/trpc/routers/spells.ts` | spells tRPC router (6 procedures) | VERIFIED | listAllSpells, listByCharacter, seedFromJson, castSpell, undoCast, updateConcentration present; spells.json loaded via `getResourcesPath()` |
| `src/renderer/src/components/sheet/SpellListSection.tsx` | Spell list UI | VERIFIED | 513 lines; spellcaster guard; grouped by level; expandable cards with metadata from listAllSpells; cantrip/leveled cast; upcast picker; ConcentrationWarningDialog |
| `src/renderer/src/components/sheet/LevelUpBanner.tsx` | Amber XP-threshold banner | VERIFIED | 39 lines; `role="status" aria-live="polite"`; text "Level up available — reach Level {nextLevel}!"; Star icon; Level Up button |
| `src/renderer/src/components/LevelUpModal.tsx` | Level-up modal | VERIFIED | 324 lines; XP_THRESHOLDS + HIT_DIE_BY_CLASS exported; HP roll/average choice; slot table; subclass deferred note; calls trpc.characters.levelUp + recordSystemMessage |
| `src/renderer/src/components/RestPickerDialog.tsx` | Short/Long rest picker | VERIFIED | 90 lines; Short Rest + Long Rest options; cancel button; sends exact copywriting messages |
| `src/renderer/src/components/ShortRestHitDiceModal.tsx` | Hit-dice roll modal | VERIFIED | 210 lines; `rollExpression` per-die; CON modifier; per-die result rows; calls trpc.characters.applyShortRestHp |
| `src/renderer/src/components/MutationChipStack.tsx` | Toast/chip notification stack | VERIFIED | 151 lines; `window.aiStream.onMutationsApplied` subscription; max 4 chips (FIFO); 4000ms auto-remove; `iconFor` maps all 7 chip types; `absolute top-0 left-0 right-0 z-50 pointer-events-none` container |
| `src/main/trpc/routers/campaigns.ts` | setPermadeath procedure | VERIFIED | `setPermadeath` procedure with `campaignId: campaignIdSchema` + `permadeathMode: z.boolean()`; calls `campaignsRepo.setPermadeath` |
| `src/renderer/src/components/AiSettingsModal.tsx` | Permadeath toggle UI | VERIFIED | `permadeath` state; pre-filled from `campaign.permadeathMode`; Checkbox with "Permadeath mode" label; `setPermadeathMutation` fires on Save |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/index.ts` ai:send-message handler | `src/main/ai/mutationPipeline.ts applyMutationBatch` | `onToolCallsFinish` callback + tail fallback | WIRED | `applyMutationBatch` called in both paths; `nativeToolCallsApplied` flag prevents double-apply |
| `src/main/ai/llmProvider.ts streamChat` | streamText tools option | `options?.tools` passed through | WIRED | `tools: options?.tools` confirmed at line 102 of llmProvider.ts |
| `src/main/ai/mutationPipeline.ts` | `src/main/db/charactersRepo.ts + combatantsRepo + campaignEventsRepo` | per-tool mutation dispatch | WIRED | All 3 repos imported; 12 `logEvent` calls confirmed; repo methods called in each case |
| `src/renderer/src/screens/CampaignViewScreen.tsx` | `src/renderer/src/stores/combatStore.ts` | `startCombat` sets `activeTab='combat-tracker'` | WIRED | `handleStartCombat` calls `useCombatStore.getState().startCombat(id!)` confirmed |
| `src/renderer/src/components/CombatTrackerTab.tsx` | `src/main/trpc/routers/combat.ts` | `trpc.combat.listActive` query + mutations | WIRED | `trpc.combat.listActive.query`, `trpc.combat.updateHp.mutate`, `trpc.combat.updateConditions.mutate`, `trpc.combat.addCombatant.mutate` confirmed |
| `src/main/trpc/router.ts` | `combatRouter` + `spellsRouter` | alphabetical registration | WIRED | `combat: combatRouter` and `spells: spellsRouter` both present in router.ts |
| `src/renderer/src/components/sheet/SpellListSection.tsx` | `src/main/trpc/routers/spells.ts` | `trpc.spells.*` calls | WIRED | SpellListSection calls listByCharacter, listAllSpells, castSpell, undoCast, updateConcentration |
| `src/renderer/src/components/CharacterSheetTab.tsx` | `src/renderer/src/components/sheet/SpellListSection.tsx` + `LevelUpBanner.tsx` + `LevelUpModal.tsx` | rendered after ResourcesSection | WIRED | All three imported and rendered; XP threshold check gates banner |
| `src/renderer/src/components/ChatInputArea.tsx` | `src/renderer/src/components/DiceRollerPopover.tsx` | `onRoll` callback + `campaign:chat-prefix` event | WIRED | `DiceRollerPopover` rendered with `Dice6` trigger; `handleRoll` prepends prefix; `campaign:chat-prefix` listener reuses `handleRoll` |
| `src/renderer/src/components/MutationChipStack.tsx` | `window 'ai:mutations-applied' IPC event` | `window.aiStream.onMutationsApplied` | WIRED | Bridge method confirmed in `src/preload/index.ts`; cleanup via `removeOnMutationsApplied` |
| `src/renderer/src/screens/CampaignViewScreen.tsx` | TanStack Query caches (combat + characters + messages) | `ai:mutations-applied` handler invalidates queryKeys | WIRED | `useEffect` confirms invalidation of `['combat','listActive',id]`, `['characters','getByCampaignId',id]`, `['ai','getMessages',id]` |
| `src/renderer/src/components/AiSettingsModal.tsx` | `src/main/trpc/routers/campaigns.ts` | `trpc.campaigns.setPermadeath` | WIRED | `setPermadeathMutation` calls `trpc.campaigns.setPermadeath.mutate` on Save |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `CombatTrackerTab.tsx` | `combatants` from `combatantsQuery` | `trpc.combat.listActive` → `combatantsRepo.listActive(campaignId)` DB query | Yes — Drizzle query with `where isActive=true` | FLOWING |
| `StoryScrollPanel.tsx` dice_roll chips | `msg.content` (JSON) | `messagesRepo` DB row with `role='dice_roll'` written by `mutationPipeline.ts` | Yes — persisted by `applyMutationBatch` via `messagesRepo.insert` | FLOWING |
| `SpellListSection.tsx` | `spellsQuery.data` | `trpc.spells.listByCharacter` → `characterSpellsRepo.listByCharacter(characterId)` | Yes — DB query; seeded from `spells.json` | FLOWING |
| `SpellListSection.tsx` | `allSpellsQuery.data` | `trpc.spells.listAllSpells` → static `SPELLS_JSON` loaded from `resources/spells.json` | Yes — static content, 46 spells | FLOWING |
| `LevelUpBanner` visibility | `character.xp >= XP_THRESHOLDS[nextLevel]` | `trpc.characters.getByCampaignId` → `charactersRepo.getByCampaignId(campaignId)` | Yes — DB query | FLOWING |
| `MutationChipStack.tsx` | `chips` state | `window.aiStream.onMutationsApplied` → `applyMutationBatch` return value → `safeSend('ai:mutations-applied')` | Yes — chips array from real AI tool calls | FLOWING |
| `AiSettingsModal.tsx` | `permadeath` state | `trpc.campaigns.get` → `campaignsRepo.get(id)` → `campaigns.permadeathMode` column | Yes — DB read | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| spells.json parses with >=40 entries, all fields valid | `node -e "const s=require('./resources/spells.json'); console.log('count='+s.length)"` | count=46 | PASS |
| Migration 0004 journal entry present | `node -e "const j=require('./resources/migrations/meta/_journal.json'); console.log(j.entries.find(x=>x.tag==='0004_phase5_rules_engine'))"` | `{idx:4, tag:'0004_phase5_rules_engine', breakpoints:true}` | PASS |
| PHASE5_TOOLS has 12 tool registrations | `grep -c "Tool = tool(" src/main/ai/toolSchemas.ts` | 12 | PASS |
| No `execute` property on any tool | `grep -n "execute" src/main/ai/toolSchemas.ts` (all comment-only) | 4 lines, all comments | PASS |
| `db.transaction()` wraps mutation batch | `grep "db.transaction" src/main/ai/mutationPipeline.ts` | Present | PASS |
| cleanText saved (not raw buffer) | `grep "cleanText" src/main/index.ts` | `nativeToolCallsApplied` flag; `content: cleanText` saved | PASS |
| `campaign:chat-prefix` listener in ChatInputArea | `grep "campaign:chat-prefix" src/renderer/src/components/ChatInputArea.tsx` | Present, reuses `handleRoll` | PASS |
| `onMutationsApplied` exposed in preload | `grep "onMutationsApplied" src/preload/index.ts` | IPC bridge present, `ipcRenderer.on('ai:mutations-applied', ...)` | PASS |
| All 3 TanStack Query caches invalidated on mutation | `grep "invalidateQueries" CampaignViewScreen.tsx` | `combat/listActive`, `characters/getByCampaignId`, `ai/getMessages` all confirmed | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes defined for this phase. The VALIDATION.md documents all live-LLM items as manual-only. Step 7c: SKIPPED (no probe files defined; live LLM required for integration tests).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| COMB-01 | 05-01, 05-04 | User can roll d4/d6/d8/d10/d12/d20/d100 plus custom expressions; results surfaced to AI | SATISFIED | `dice.ts` + `DiceRollerPopover.tsx` + `ChatInputArea.tsx` prefix prepend |
| COMB-02 | 05-01, 05-03 | Combat tracker shows initiative order, HP, conditions for all combatants | SATISFIED | `CombatTrackerTab.tsx` with Progress bars, ConditionBadge, Collapsible rows |
| COMB-03 | 05-02, 05-04 | AI manages enemy turns; rolls shown visibly in chat | SATISFIED (wiring) | `showDiceRoll` tool → `dice_roll` messages → StoryScrollPanel amber chips; live LLM required for full test |
| COMB-04 | 05-02, 05-03 | Conditions applied by AI or toggled manually on any combatant | SATISFIED | `applyCondition`/`removeCondition` tools + manual `ConditionBadge` picker in CombatTrackerTab |
| CHAR-08 | 05-01, 05-02, 05-05 | User can manage spell list — cast, auto-deduct slots, track concentration | SATISFIED | `SpellListSection.tsx` + `spells.ts` router + optimistic deduction + `ConcentrationWarningDialog` |
| PROG-01 | 05-02, 05-06 | AI awards XP; app tracks and auto-prompts level-up at threshold | SATISFIED | `awardXp` tool → `charactersRepo.updateXp`; `LevelUpBanner` + `LevelUpModal` with XP_THRESHOLDS check |
| PROG-02 | 05-02, 05-06 | Player can request rest; AI narrates; resources auto-recovered | SATISFIED | `RestPickerDialog` + `handleRest` sends exact message; `processRest` tool applies long/short rest; `ShortRestHitDiceModal` for short rest hit dice |
| PROG-04 | 05-01, 05-07 | User can configure permadeath rules per campaign | SATISFIED | `campaigns.permadeath_mode` column (migration 0004); `setPermadeath` tRPC procedure; `AiSettingsModal` Checkbox |
| STATE-05 | 05-01, 05-02, 05-07 | App tracks full currency; AI auto-awards/deducts | SATISFIED | `updateCurrency` tool → `charactersRepo.updateCurrency` per denomination; currency chips in `MutationChipStack` |

All 9 required requirements satisfied. No orphaned requirements found (COMB-01/02/03/04, CHAR-08, PROG-01/02/04, STATE-05 all addressed in plans for Phase 5).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/src/components/sheet/SpellListSection.tsx` | 479 | `"Spell metadata not available."` fallback | Info | Graceful fallback for spell names in DB with no spells.json match — NOT a stub; data path for valid spells is fully wired |

No TBD, FIXME, or XXX markers found in any Phase 5 files. No unreferenced debt markers.

### Human Verification Required

1. **Dice Roller Popover — COMB-01**

   **Test:** Open the in-app dice roller, click d20, verify the prefix `[d20: N]` appears in the chat textarea. Type `4d6kh3` in the expression field, click Roll, verify prefix appears. Type garbage (e.g. `zzz`) and verify Roll is disabled with "Invalid expression" shown.
   **Expected:** Die click inserts prefix, expression roll inserts prefix, invalid expression disables Roll and shows error.
   **Why human:** Cannot programmatically test popover DOM interaction and textarea value injection in the running Electron app.

2. **Combat Tracker Visual + AI Enemy Management — COMB-02, COMB-03**

   **Test:** Start a session with a combat encounter. Verify (a) Start Combat switches the panel to Combat tab, (b) combatant rows show HP bar with correct color thresholds (green >50%, amber 25-50%, red <25%), (c) expanding a row shows the HP stepper and condition picker wired, and (d) AI dice rolls (showDiceRoll tool) appear as amber chips in the story scroll.
   **Expected:** Auto-tab switch, semantic HP colors, expandable stepper/conditions, AI dice chips in story.
   **Why human:** Requires a live LLM; visual HP-bar colors and combat flow cannot be verified by static code inspection.

3. **Spell Casting + Concentration Warning — CHAR-08**

   **Test:** For a spellcaster character, open the spell list. Cast a leveled spell and verify the slot pip decrements. Cast Bless (concentration), then attempt to cast Hold Person (concentration) — confirm the "Drop Concentration?" dialog appears with the exact spell names.
   **Expected:** Slot deducts on cast; concentration dialog appears with "Drop Concentration?" title.
   **Why human:** Requires UI interaction in the running Electron app.

4. **Level-Up Banner and Modal — PROG-01**

   **Test:** Award enough XP to cross the level 2 threshold (300 XP). Verify the amber "Level up available — reach Level 2!" banner appears at the top of the Character Sheet. Click Level Up, roll or choose average HP, confirm, and verify (a) character level increments, and (b) `[System: CharacterName reached Level 2!]` appears in the story scroll as italic amber text.
   **Expected:** Banner appears, modal shows HP choice and spell slot table, system message appears in story.
   **Why human:** Requires triggering the AI awardXp tool and verifying UI state changes across multiple components.

5. **Rest System + Hit Dice Modal — PROG-02**

   **Test:** Click the Rest button, select Short Rest (AI receives `[Player requests a short rest]`). Have the AI grant the rest. Verify the Short Rest Hit Dice modal opens automatically. Roll hit dice and click Done — verify HP increases and hit dice spent decrements.
   **Expected:** Rest picker sends correct message; AI processRest triggers modal via `ai:mutations-applied`; modal rolls dice and applies HP.
   **Why human:** Requires a live AI to trigger the processRest tool call and the subsequent IPC event chain.

6. **Currency Mutation Chips + Cache Invalidation — STATE-05**

   **Test:** Trigger the AI to award 50 GP (updateCurrency tool). Verify (a) a "+50 GP" chip with Coins icon slides in at the top-right of the panel and fades after ~4 seconds, and (b) the character sheet GP value updates without a manual refresh.
   **Expected:** Currency chip appears and fades; character sheet updates automatically.
   **Why human:** Requires a live LLM to fire updateCurrency; chip animation cannot be verified statically.

7. **Permadeath Toggle Persistence — PROG-04**

   **Test:** Open AI Settings, toggle Permadeath mode on, click Save. Close and reopen AI Settings. Verify the Permadeath checkbox remains checked.
   **Expected:** Toggle persists across modal open/close.
   **Why human:** Requires UI interaction and persistence verification in the running app.

### Gaps Summary

No automated gaps found. All 6 success criteria are verifiable by static code inspection and confirmed wired end-to-end. The 7 human verification items above represent live-LLM integration and interactive UI behaviors that cannot be confirmed without running the application against an actual LLM provider.

**Key architectural observations:**

- The AI mutation contract (D-04) is correctly implemented: `PHASE5_TOOLS` has exactly 12 tools, none with `execute`, batch-applied in `onFinish` via `applyMutationBatch` in a single `db.transaction()`.
- Double-apply protection (D-02) is correctly wired: `nativeToolCallsApplied` flag gates the JSON-tail fallback in `index.ts`.
- All code review fixes (CR-01 through CR-06, WR-01 through WR-09) have been applied per the git log, including the critical `tc.args` fix (CR-02 for AI SDK v6), combatant HP TOCTOU fix (CR-05), and listener leak fixes (WR-01, WR-02).
- The `build` was confirmed green (Vite renderer bundle 3,205 modules) per the 05-07-SUMMARY.md.

---

_Verified: 2026-05-29T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
