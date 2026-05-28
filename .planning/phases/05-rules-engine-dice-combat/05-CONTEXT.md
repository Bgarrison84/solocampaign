# Phase 5: Rules Engine, Dice & Combat - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can run a full D&D combat encounter — roll dice in-app, the AI manages enemy turns with visible rolls, conditions and HP track for all combatants, spell slots deduct on cast, the AI awards XP and prompts level-up, rests recover resources (including hit dice), and currency moves in/out via AI tool calls. This phase locks in the AI mutation contract (tool calls + JSON-tail fallback) for all future phases.

**In scope:** AI tool-call schema + JSON-tail fallback, campaign_events log table, dice roller (chat input attachment), combat tracker tab (combatants table, initiative list), spell list section in character sheet (character_spells table), spell casting with optimistic slot deduction + concentration tracking, level-up modal (HP + slots only), rest system (short/long with hit dice), processRest tool, showDiceRoll display tool.

**Out of scope:** Quest/NPC/faction tool calls (Phase 6), subclass selection in level-up (Phase 7), multiclass spell slot rules (Phase 7), companion party members in combat tracker (Phase 7), feat/ASI on level-up (Phase 7), advanced ability score generation (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### AI Tool-Call Schema

- **D-01:** **Fine-grained tools** — one tool per mutation type. Phase 5 tool surface:
  1. `updateHp` — delta (positive or negative) + characterId + source string (for events log)
  2. `applyCondition` — characterId + condition string
  3. `removeCondition` — characterId + condition string
  4. `deductSpellSlot` — characterId + slotLevel + count
  5. `restoreSpellSlots` — characterId + slots map (for Warlock mid-combat / short-rest restoration)
  6. `awardXp` — campaignId + amount
  7. `updateCurrency` — campaignId + delta values per denomination (cp/sp/ep/gp/pp)
  8. `addCombatant` — name + hpMax + ac + initiative + initiativeOrder + isPlayer bool
  9. `removeCombatant` — combatantId
  10. `endCombat` — no args; clears active combatants (is_active = false)
  11. `processRest` — type ('short' | 'long')
  12. `showDiceRoll` — label + expression + result + breakdown array (display-only, no mutation)

- **D-02:** **JSON-tail fallback** — when the AI doesn't use native tool calls, it appends a fenced block at message end: ` ```json\n{"mutations":[...]}\n``` `. Main process strips this block before displaying text to the player, parses it, and applies the same mutation pipeline as tool calls. The JSON structure mirrors the tool-call schemas.

- **D-03:** **Phase 5 only** — no quest/NPC/faction/inspiration tools. Those land in Phase 6 when the full world-state mutation contract ships.

- **D-04:** **Mutations applied after stream ends** — all tool calls are collected during streaming; the mutation batch is applied in the `onFinish` callback as a single DB transaction. The rendered message appears after mutations are committed. No mid-stream partial state.

- **D-05:** **campaign_events append-only table** — new table: `id`, `campaign_id`, `session_id` (FK nullable), `event_type` (text: `hp_change | condition_applied | condition_removed | spell_slot_deducted | xp_awarded | currency_changed | combat_started | combat_ended | combatant_added | combatant_removed | dice_roll | rest_taken | level_up`), `payload` (JSON, event-specific data), `created_at`. Written for every mutation and every dice roll.

- **D-06:** **Tool-call failures are silent** — if a tool call fails Zod validation or the mutation throws, log the error to electron-log and continue. The AI narration still displays. Player can correct state manually via the sheet.

- **D-07:** **Toast/chip notifications** per mutation after apply — small chips slide in at the top of the right panel: `−6 HP`, `+150 XP`, `Poisoned applied`, `3rd level slot used`. Each chip shows for ~4 seconds then fades. Stacks up to 4 visible at once.

- **D-08:** **Vercel AI SDK `tools` parameter** — pass the Phase 5 tool schemas via the `tools` option to `streamText`. The SDK injects the schema into the provider request. System prompt mentions tool-call usage in natural language (e.g., "Use `updateHp` when the player takes damage"). No manual schema injection in system prompt.

### Combat Tracker

- **D-09:** **Player starts combat** — a "Start Combat" button in the Combat Tracker tab (or campaign header). Player clicks it, the tab auto-focuses (`activeTab` in campaignViewStore switches to `'combat-tracker'`). The AI is not required to call a tool to activate the tracker.

- **D-10:** **AI adds enemies via `addCombatant`** — the AI's first response after "Start Combat" calls `addCombatant` for each enemy. Player can also manually add a combatant via a form in the Combat Tracker tab (name, HP, AC, initiative). Both paths are valid.

- **D-11:** **DB-persisted combatants table** — schema: `id`, `campaign_id` (FK), `session_id` (FK nullable), `name`, `hp_current`, `hp_max`, `ac`, `initiative` (raw roll), `initiative_order` (integer sort key), `conditions` (JSON array of strings), `is_player` (bool — player characters are mirrored here during combat), `is_active` (bool — set false by `endCombat`). Auto-cleared (is_active = false) when `endCombat` fires or when a new session starts.

- **D-12:** **Vertical initiative list with expandable rows** — each combatant = a row: initiative order number | name | HP bar (current/max) | condition badge chips. Active turn highlighted. Click row to expand: HP stepper (+ / −) and condition picker (shadcn multi-select). Player character rows are visually distinct (e.g., amber/gold accent vs. gray for enemies).

- **D-13:** **AI drives turn advancement** — AI narrates enemy turns and calls tool calls for their actions. `addCombatant` / `updateHp` / etc. The tracker highlights the current combatant based on a `current_turn_order` integer on a combat state record (same table or a separate `combat_state` row per campaign). No "Next Turn" button in Phase 5 — the AI controls pacing.

- **D-14:** **AI calls `endCombat`** to close out an encounter. The player can also click "End Combat" manually (button appears when combat is active). On `endCombat`: mark all active combatants `is_active = false`, write a `combat_ended` campaign_events entry. XP award follows immediately via the AI's `awardXp` call in the same response.

- **D-15:** **Full manual edit** — expanded row shows HP stepper (direct +/− with current/max display) and a condition picker. Player can adjust any combatant's HP or conditions at any time, independent of AI tool calls.

- **D-16:** **Unified initiative list** — player character and all enemies appear in the same sorted list. Player character `is_player = true` rows are mirrored from characterResources (HP sync both ways). Companions (Phase 7) will slot into the same list when they ship.

- **D-17:** **Auto-switch to Combat Tracker tab** when the player clicks "Start Combat". Implemented by setting `activeTab = 'combat-tracker'` in the campaignViewStore (Zustand).

### Dice Roller

- **D-18:** **Dice roller attached to chat input area** — a d20 icon button sits next to the Send button in ChatInputArea. Clicking it opens a shadcn Popover containing: 7 die-type buttons (d4, d6, d8, d10, d12, d20, d100) + a free-form expression input (e.g., `2d6+3`). Clicking a button or submitting the expression rolls immediately.

- **D-19:** **Auto-populates chat input** — roll result is prepended to the chat input field as a prefix string (e.g., `[d20: 14] `). Player adds context ("I attack the goblin!") and sends. If player clears the prefix and sends without the roll, no dice event is logged.

- **D-20:** **Both die buttons and expression input** — uses `rpg-dice-roller` or `dice-typescript` (both in stack recommendation). Expression input supports notation like `2d6+3`, `4d6kh3` (keep highest 3), `d20+5`.

- **D-21:** **Dice rolls logged to campaign_events** — every roll writes a `dice_roll` event: `{expression: '2d6+3', result: 11, breakdown: [4, 4, 3]}`. Logged when the player sends the chat message that contains the roll prefix.

- **D-22:** **AI visible dice rolls as chat chips** — when the AI narrates an enemy action, it calls `showDiceRoll({label:'Goblin attack', expression:'1d20+3', result:14, breakdown:[11,3]})`. This is a display-only tool (no mutation). A styled chip renders in the StoryScrollPanel: 🎲 Goblin attack — 1d20+3 = **14** (breakdown: [11]+3). Fulfills success criterion 3 (no hidden AI rolls).

### Spell Casting & Concentration

- **D-23:** **New "Spells" section in Character Sheet tab** — collapsible section in the scrollable character sheet column. Sits below the Resources section (spell slots pips already there). Shows spell list grouped by level (0 = Cantrips, then 1st, 2nd, …). The existing SpellSlotPips component stays in the Resources section as-is; the new Spells section shows the actual spell list.

- **D-24:** **Optimistic immediate slot deduction** — clicking Cast immediately deducts the slot from characterResources (via a mutation to SQLite and an update to TanStack Query cache). The cast is added to the chat input as context prefix: `[Casting Fireball — 3rd level slot] `. If the player deletes the prefix from the input without sending, a "Restore slot?" undo chip appears for 30 seconds. Matches D&D Beyond behavior.

- **D-25:** **Concentration tracking** — `concentratingOn` (TEXT nullable) added to characterResources. When a concentration spell is cast: set `concentratingOn = spellName`. If player attempts to cast a second concentration spell: show a warning dialog: "You are concentrating on [X]. Casting [Y] will drop [X]. Continue?" Confirm = drop old concentration and cast new. `concentratingOn` is included in the character summary injected into the AI system prompt.

- **D-26:** **character_spells table** — new table: `id`, `character_id` (FK), `spell_name`, `spell_level` (integer 0–9), `is_prepared` (bool). Phase 5 populates this from the class content JSON at character load time (for classes that know all their class spells) or from a prepared-spells picker for classes like Wizards/Clerics. Researcher decides which classes get auto-populated vs. a picker.

- **D-27:** **Upcast support** — when the player clicks Cast on a leveled spell, a slot level picker appears (popover or inline buttons): only slots the player actually has available are shown. Player selects a level; the selected level is passed as context to the AI in the chat prefix (`[Casting Fireball — at 4th level]`). Slot deducted at the selected level.

- **D-28:** **Click-to-expand spell card** — each spell row in the list is expandable. Click the name to reveal: cast time, range, duration, components, concentration flag, and full description from content JSON. The Cast button (and upcast picker) is inside the expanded card.

- **D-29:** **Cantrips in spell list (level 0)** — listed at the top of the Spells section. Cast button present but triggers no slot deduction. No slot level picker for cantrips.

### Level-Up Flow

- **D-30:** **Auto-prompt on XP threshold** — when `awardXp` causes total XP to cross a level threshold, an amber banner appears in the chat area: "Level up available — reach Level [N]! [Level Up]". Clicking opens the Level Up modal.

- **D-31:** **Auto-calculate HP + slots, player chooses HP roll or average** — Level Up modal shows: new level number, HP gain options ("Roll [d8]" or "Take average [5]"), new spell slots table (auto-calculated from class content JSON). Player clicks "Level Up" to apply. No subclass/feat choices in Phase 5 — those are Phase 7.

- **D-32:** **System message in chat after level-up** — after the player confirms, a styled system event appears in the StoryScrollPanel: `[System: [Name] reached Level [N]!]`. The AI sees this in the next message context and can narrate the milestone.

- **D-33:** **Subclass selection deferred to Phase 7** — when a character reaches a subclass-granting level (e.g., Fighter level 3), the modal shows HP/slots only. A note appears: "Subclass selection will be available in a future update." Level still advances.

### Rest System

- **D-34:** **"Rest" button** in the campaign header (or at the top of Character Sheet tab). Clicking opens a picker: "Short Rest" or "Long Rest". Selecting sends a context message to the AI (e.g., `[Player requests a long rest]`) and the rest request is sent to the AI for narration.

- **D-35:** **AI approves rest via `processRest` tool call** — if the AI grants the rest, it calls `processRest({type: 'short'|'long'})`. The app applies recovery on that tool call. If no tool call is present in the response, no resources are recovered (AI denied the rest narratively).

- **D-36:** **RAW recovery** — short rest: player rolls hit dice (app shows a hit die roller UI: roll individual dice up to remaining count, each adds die result + CON mod to HP). Long rest: HP to max, all spell slots restored, pact slots restored, hit dice restored to half total (min 1), death saves cleared.

- **D-37:** **Death saves clear on any rest** (short or long) — consistent with RAW (regaining HP via hit dice clears them).

- **D-38:** **hitDiceCurrent + hitDiceTotal added to characterResources** — hitDiceTotal = character level (for single-class), hitDiceCurrent starts = hitDiceTotal. Decrements when a hit die is rolled during short rest. Restored to half total (min 1) on long rest.

- **D-39:** **processRest logs rest_taken event** to campaign_events: `{type: 'short'|'long', hp_recovered: N, slots_restored: {...}, hit_dice_spent: N}`.

- **D-40:** **Warlock pactSlots** — separate from spellSlots in characterResources. New `pact_slots` JSON column (same structure as `spell_slots`). Short rest restores pactSlots to max. Non-Warlocks have `pact_slots = {}`. `deductSpellSlot` + `restoreSpellSlots` tools handle both pactSlots and spellSlots (distinguished by a `slotType: 'normal'|'pact'` arg).

### Claude's Discretion

- Exact Zod schemas for each tool call (argument shapes, required vs. optional fields)
- JSON-tail regex/parser implementation details (strip the fenced block before render)
- Toast chip positioning and animation (top of right panel, stack limit 4, fade duration)
- Short rest hit die roll UI (modal or popover in Character Sheet tab)
- Spell section position within Character Sheet tab (above or below which sections)
- Whether initiative list uses strict initiative order or groups player at bottom
- Exact character summary update to include `concentratingOn` field
- Exact wording of the `[System: ...]` level-up chat message
- `rpg-dice-roller` vs `dice-typescript` library selection (evaluate during planning)
- How `updateCurrency` args are structured (absolute patch vs. per-denomination deltas)
- Campaign_events schema migration number (this is migration 0004 or 0005 depending on what Phase 4 used last)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — Core value, constraints ("AI mutates state only via tool calls"), player-rolls-dice paradigm
- `.planning/REQUIREMENTS.md` — Phase 5 requirements: COMB-01, COMB-02, COMB-03, COMB-04, CHAR-08, PROG-01, PROG-02, PROG-04, STATE-05
- `.planning/ROADMAP.md` § "Phase 5: Rules Engine, Dice & Combat" — Goal, success criteria, notes (tool-call contract, LM Studio/Jan AI/Ollama reliability testing cross-phase todo)

### Prior Phase Context (critical integration)
- `.planning/phases/04-long-campaign-memory-session-flow/04-CONTEXT.md` — D-17 (system prompt injection order — Phase 5 adds tool definitions to the LLMProvider call), D-05 (campaign_events sits alongside sessions in the DB), D-19 (session_id FK to add to campaign_events), LLMProvider interface (`streamChat` → `streamText` with `tools` option)
- `.planning/phases/03-ai-engine-provider-abstraction/03-CONTEXT.md` — D-22 (LLMProvider.streamChat interface), D-23 (security contract: renderer never sees API keys), D-20 (ContextBuilder v1 injection order)
- `.planning/phases/02-character-domain-live-sheet/02-CONTEXT.md` — characterResources schema (spellSlots JSON, conditions array, currency columns), SpellSlotPips.tsx, character sheet section components, content JSON loader
- `.planning/phases/01-foundation-secure-shell/01-CONTEXT.md` — tRPC v10 + electron-trpc pattern, Drizzle migration pattern

### Existing Code — Critical Integration Points
- `src/main/db/schema.ts` — Current schema. Phase 5 adds: campaign_events, combatants, character_spells tables; characterResources gets: concentratingOn, hitDiceCurrent, hitDiceTotal, pactSlots columns. New migration required.
- `src/main/ai/contextBuilder.ts` (v2) — Phase 5 adds tool definitions to `BuildContextArgs` and passes them to the LLMProvider call. `formatCharacterSummary()` updated to include concentratingOn.
- `src/main/ai/llmProvider.ts` — `streamText` call needs `tools` parameter added. Vercel AI SDK `streamText` natively supports tools; researcher confirms the TypeScript signature.
- `src/renderer/src/screens/CampaignViewScreen.tsx` — Combat Tracker tab placeholder at `value="combat-tracker"` — Phase 5 replaces the placeholder. Also the location for "Start Combat" / "Rest" buttons in campaign header or tab.
- `src/renderer/src/components/CharacterSheetTab.tsx` — Add Spells section (new collapsible SpellListSection component) and level-up banner.
- `src/renderer/src/components/ChatInputArea.tsx` — Add dice roller icon/popover attachment.
- `src/renderer/src/components/StoryScrollPanel.tsx` — Add dice roll chip rendering (for showDiceRoll events) and system message rendering (for level-up).

### Technology Stack
- `CLAUDE.md` § "AI Provider Abstraction" — Vercel AI SDK `ai` v4 `streamText` function's `tools` parameter
- `CLAUDE.md` § "Supporting Libraries" → `dice-typescript` or `rpg-dice-roller` — researcher evaluates and picks one
- `CLAUDE.md` § "State Management" — Zustand for combat state (activeTab, isCombatActive), TanStack Query for IPC calls to combatants repo

### Cross-Phase Todo (STATE.md)
- `Test structured tool-call reliability against LM Studio + Jan AI + Ollama before exit` — mandatory before Phase 5 UAT sign-off

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/src/components/sheet/ConditionBadge.tsx` — Reuse for condition display in combat tracker rows
- `src/renderer/src/components/sheet/SpellSlotPips.tsx` — Already in CharacterSheetTab; Phase 5's Spells section sits below it
- `src/renderer/src/components/sheet/ResourcesSection.tsx` — Pattern for the hit die roll UI during short rest
- `src/renderer/src/components/ui/dialog.tsx` (shadcn Dialog) — Level Up modal, short rest hit die modal
- `src/renderer/src/components/ui/popover.tsx` (shadcn Popover) — Dice roller popover, upcast slot picker
- `src/renderer/src/components/StoryScrollPanel.tsx` — Streaming render pattern for showDiceRoll chips and system events
- `src/renderer/src/components/ChatInputArea.tsx` — Add dice icon attachment to existing input area
- `src/renderer/src/components/EndSessionModal.tsx` — Pattern for the "multi-step modal action" flow (reference for Level Up modal)
- `src/main/db/sessionsRepo.ts` — Pattern for new campaignEventsRepo and combatantsRepo

### Established Patterns
- **Drizzle migration:** New migration SQL file in `resources/migrations/` (currently 0000–0003). Phase 5 = migration 0004. Adds: campaign_events, combatants, character_spells tables + ALTER TABLE character_resources ADD COLUMN × 4.
- **tRPC router:** New `combat.ts` router and `spells.ts` router following `sessions.ts` and `ai.ts` patterns. Register in `src/main/trpc/router.ts`.
- **TanStack Query:** Wrap all new tRPC calls following `campaignQuery` / `sessionsQuery` patterns in CampaignViewScreen.
- **Zustand store:** Add combatStore (isCombatActive, activeCombatId, currentTurnOrder) following sessionStore pattern from Phase 4.
- **IPC streaming:** `ai:send-message` handler already exists; Phase 5 extends it with `tools` option passed to LLMProvider.

### Integration Points
- **LLMProvider.streamChat** → extend to accept `tools` option, pass to `streamText({..., tools})`
- **ContextBuilder v2** → extend BuildContextArgs to include `tools: ToolDefinition[]`; add tool descriptions to system prompt preamble ("Use updateHp when the player takes damage from enemies.")
- **CampaignViewScreen campaign header** → "Start Combat" + "Rest" buttons alongside "End Session" button
- **CampaignViewScreen activeTab state** → auto-switch to 'combat-tracker' on Start Combat
- **CharacterSheetTab** → level-up XP threshold check on every characterResources update; amber banner when threshold crossed

</code_context>

<specifics>
## Specific Ideas

- **showDiceRoll chip style:** In the StoryScrollPanel, dice roll chips should look like inline callouts — a subtle background (dark amber/gold tint), 🎲 icon, bold result, muted breakdown. Distinct from player messages and AI narration paragraphs but readable in the story flow.
- **Toast notification anchor:** Top of the right panel, just below the tab list. Chips slide down from above and stack vertically. Use shadcn `sonner` or a custom positioned container — not a full-screen toast.
- **Hit die roll UI during short rest:** A mini modal or popover from the Rest button. Shows: "You have [N] hit dice remaining. Roll how many?" with a stepper (1 to N). App rolls the dice (using the dice library), shows each result (e.g., "d8 → 5 + CON mod +2 = 7 HP recovered"). Running total shown. "Done" applies the total HP gain.
- **Level-up banner placement:** Below the existing HP tracker section in CharacterSheetTab (or as a floating chip at the top of the sheet tab content area). Persistent until the player dismisses or levels up.
- **AI system prompt tool descriptions:** A short natural-language section in the system prompt: "Game mechanics you control:\n- Use `updateHp` when a creature takes damage or is healed. Delta is negative for damage.\n- Use `applyCondition`/`removeCondition` for status effects (Poisoned, Stunned, etc.)\n- Use `awardXp` after encounters. Typical encounter = 50–500 XP depending on difficulty.\n- Use `showDiceRoll` whenever you make an attack or saving throw roll — always show your dice so the player can see."

</specifics>

<deferred>
## Deferred Ideas

- **Subclass selection on level-up** — deferred to Phase 7 (CHAR-04/CHAR-05)
- **ASI / feat choices on level-up** — deferred to Phase 7
- **Companion/familiar tracking in combat tracker** — Phase 7 (PARTY-01/PARTY-02)
- **Verified main-process dice rolls for AI (rollForMe tool)** — considered but deferred; `showDiceRoll` (AI-reported number) is sufficient for Phase 5 immersion. Cryptographic roll verification is a Phase 8+ feature.
- **Warlock Hexblade's Curse / other class-specific short-rest recharge features** — Claude handles common cases; edge-case class features tracked as player-managed until Phase 7
- **Search/filter in spell list** — Phase 5 is scrollable grouped by level only; search is Phase 8
- **Ritual casting** — Phase 5 shows ritual spells in the list but doesn't enforce the 10-minute ritual time mechanically; player narratively describes ritual to AI; full ritual tracking deferred to Phase 7

</deferred>

---

*Phase: 5-Rules Engine, Dice & Combat*
*Context gathered: 2026-05-28*
