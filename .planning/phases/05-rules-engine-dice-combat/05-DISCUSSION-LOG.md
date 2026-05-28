# Phase 5: Rules Engine, Dice & Combat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 5-Rules Engine, Dice & Combat
**Areas discussed:** AI Tool-Call Schema, Combat Tracker — Layout & Entry, Dice Roller Placement, Spell Casting & Concentration, Level-Up Flow, Rest System

---

## AI Tool-Call Schema

### Mutation granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Fine-grained tools | One tool per mutation type | ✓ |
| Single mutateGameState tool | One tool with a patch object | |
| Batched per domain | Two tools: mutateCharacter + mutateCombat | |

**User's choice:** Fine-grained tools — one per mutation type.

---

### JSON-tail fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Parse a trailing JSON block | AI appends fenced JSON block; main process strips before display | ✓ |
| No fallback — tool calls only | No fallback; player manually corrects | |
| Retry with stricter prompt | Re-send with stricter directive on failure | |

**User's choice:** JSON-tail fallback with fenced block pattern.

---

### Phase 5 tool surface

| Option | Description | Selected |
|--------|-------------|----------|
| Character state + combat only | updateHp, applyCondition, removeCondition, deductSpellSlot, restoreSpellSlots, awardXp, updateCurrency, addCombatant, removeCombatant, endCombat | ✓ |
| Character state only, no combat tools | No combat tracker tool calls | |
| Full Phase 5+6 tool set now | Include quests/NPCs/factions/inspiration | |

**User's choice:** Character state + combat only in Phase 5. Phase 6 adds world-state tools.

---

### Mutation application timing

| Option | Description | Selected |
|--------|-------------|----------|
| After stream ends, pre-display | Batch applied in onFinish, single DB write | ✓ |
| Synchronous mid-stream per tool call | Apply as each tool call arrives | |
| Queued, applied on player acknowledgment | Player approves each mutation | |

**User's choice:** After stream ends — batch applied in onFinish.

---

### campaign_events log

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — append-only events table | New table tracking every mutation and dice roll | ✓ |
| No — just apply mutations, no log | No separate log | |
| Log dice rolls only | Only dice_roll events | |

**User's choice:** Append-only campaign_events table for all mutation types + dice rolls + rests.

---

### Tool-call failure surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Silent — log to electron-log, continue | No player-visible failure state | ✓ |
| Inline error badge in chat | Amber badge below AI message | |
| Block message display until resolved | Don't show message until resolved | |

**User's choice:** Silent failure with electron-log logging.

---

### Mutation notification to player

| Option | Description | Selected |
|--------|-------------|----------|
| AI narrates it inline | No separate UI notification | |
| Toast/chip notifications | Chips at top of right panel per mutation | ✓ |
| Animated diff on character sheet | Sheet values animate from old to new | |

**User's choice:** Toast/chip notifications (−6 HP, +150 XP, Poisoned applied).

---

### Tool injection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel AI SDK tools parameter | SDK handles schema injection | ✓ |
| System prompt only — no SDK tools | Manual JSON schema in system prompt | |
| Both paths simultaneously | SDK tools + system prompt schema | |

**User's choice:** Vercel AI SDK tools parameter.

---

## Combat Tracker — Layout & Entry

### Combat start trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Player presses 'Start Combat' button | Explicit player intent | ✓ |
| AI calls startCombat tool automatically | AI-triggered on encounter narration | |
| Both paths work | Either player or AI activates tracker | |

**User's choice:** Player presses 'Start Combat' button.

---

### Enemy entry method

| Option | Description | Selected |
|--------|-------------|----------|
| AI adds via addCombatant tool call | AI populates enemies; player can also add manually | ✓ |
| Player manually enters all enemies | Player fills all entries | |
| Pre-defined enemy templates | SRD monster list picker | |

**User's choice:** AI adds via addCombatant; player manual add also available.

---

### DB persistence

| Option | Description | Selected |
|--------|-------------|----------|
| DB-persisted (new combatants table) | Survives app crashes; cleared on endCombat | ✓ |
| In-memory only (Zustand store) | Lost on app close | |
| DB-persisted on combat end only | Zustand during combat, snapshot at end | |

**User's choice:** DB-persisted combatants table.

---

### Layout style

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical initiative list with expandable rows | Row per combatant, click to expand HP/condition edit | ✓ |
| Card grid layout | Each combatant is a card | |
| Compact table | Dense rows — max info per pixel | |

**User's choice:** Vertical initiative list with expandable rows.

---

### Turn advancement

| Option | Description | Selected |
|--------|-------------|----------|
| AI drives turns via tool calls | AI narrates + calls tool calls for enemy turns | ✓ |
| Player presses 'Next Turn' button | Player controls pacing | |
| Hybrid: player turn + AI enemy turns | Player ends own turn; AI handles enemies | |

**User's choice:** AI drives turns via tool calls.

---

### Combat end

| Option | Description | Selected |
|--------|-------------|----------|
| AI calls endCombat tool | Player can also click 'End Combat' manually | ✓ |
| Player manually clicks 'End Combat' | No AI endCombat tool | |
| Auto-end when all enemies reach 0 HP | Monitor-based auto-clear | |

**User's choice:** AI calls endCombat; manual player button also available.

---

### Manual edit

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — full manual edit | HP stepper + condition picker per expanded row | ✓ |
| AI-only, no manual edit | Read-only tracker | |
| Manual edit on long-press only | Hidden edit mode | |

**User's choice:** Full manual edit for all combatants.

---

### Player in tracker

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — all combatants in one list | Player + companions + enemies in unified list | ✓ |
| Player character shown separately at top | Two sections | |
| Player only on Character Sheet | Separate views | |

**User's choice:** Unified initiative list with all combatants.

---

### Auto-tab-switch on combat start

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — auto-switch to Combat Tracker tab | Immediate combat tracker visibility | ✓ |
| No — player navigates manually | No auto-switch | |
| Show indicator badge, no auto-switch | Badge on tab only | |

**User's choice:** Auto-switch to Combat Tracker tab on Start Combat.

---

## Dice Roller Placement

### Roller location

| Option | Description | Selected |
|--------|-------------|----------|
| Attached to chat input area | Dice icon opens popover next to Send button | ✓ |
| Panel within Combat Tracker tab | Only accessible during combat | |
| Floating panel accessible anywhere | Floating overlay from header button | |

**User's choice:** Attached to chat input area.

---

### Roll-to-chat behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-populates input, player sends | Prefix in chat input, player adds context | ✓ |
| Auto-posts immediately | Fires and posts to chat instantly | |
| Roll appears as system event | Styled chip, not a player message | |

**User's choice:** Auto-populates chat input prefix; player edits and sends.

---

### Roller capability

| Option | Description | Selected |
|--------|-------------|----------|
| Both — die buttons + expression input | d4/d6/.../d100 buttons + expression field | ✓ |
| Die buttons only | 7 die type buttons, no expression | |
| Expression input only | Text field only | |

**User's choice:** Both die type buttons and expression input.

---

### Dice event logging

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — log as dice_roll events | Every roll → campaign_events dice_roll entry | ✓ |
| No — rolls only appear in chat | Ephemeral, no log | |
| Log only during active combat | Only combat rolls logged | |

**User's choice:** All dice rolls logged to campaign_events.

---

### AI visible dice rolls

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — styled chip in chat scroll | showDiceRoll display tool → chip in StoryScrollPanel | ✓ |
| AI just mentions number in narration | Number in text only, no chip | |
| Dedicated dice history panel | Separate section in Combat Tracker | |

**User's choice:** Styled chip via showDiceRoll display tool.

---

### AI roll randomness

| Option | Description | Selected |
|--------|-------------|----------|
| AI reports number via showDiceRoll | AI chooses/calculates number, chip is visual confirmation | ✓ |
| Main process rolls for AI via tool call | rollForMe tool; real randomness | |
| Separate verified roll display | Main process rolls and renders, AI narrates after | |

**User's choice:** AI reports number via showDiceRoll (display only). Real randomness verification is a future feature.

---

## Spell Casting & Concentration

### Spell list location

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Spells' section in Character Sheet tab | Collapsible section in existing sheet column | ✓ |
| Separate 'Spells' tab (6th tab) | New right panel tab | |
| Popover from SpellSlotPips | Compact popover | |

**User's choice:** New 'Spells' section in Character Sheet tab.

---

### Slot deduction timing

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic immediate deduction | Slot deducts on Cast click; 30-second undo | ✓ |
| Deduct only after AI confirms | Slot pending until AI tool call | |
| Player manually deducts from sheet | No app-enforced deduction | |

**User's choice:** Optimistic immediate deduction with 30-second undo window.

---

### Concentration tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Flag on characterResources + warning on second cast | concentratingOn column + confirmation dialog | ✓ |
| Just a condition badge | 'Concentrating: X' in conditions array | |
| No concentration tracking in Phase 5 | Deferred to Phase 7 | |

**User's choice:** concentratingOn (TEXT nullable) on characterResources + warning dialog.

---

### Spell list data source

| Option | Description | Selected |
|--------|-------------|----------|
| Load from class content JSON + character_spells table | character_spells table per character | ✓ |
| Hardcoded from character class only | No per-character table | |
| Player manually enters spells | Free-form list | |

**User's choice:** character_spells table loaded from class content JSON.

---

### Upcast support

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — slot level picker on cast | Only available slots shown | ✓ |
| No upcast — always base level | Defer to Phase 7 | |
| Player specifies in chat text | No picker, text-based | |

**User's choice:** Slot level picker on cast.

---

### Spell descriptions

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — click to expand spell card | Full description, cast time, range, etc. | ✓ |
| Hover tooltip with brief summary | Compact tooltip only | |
| No descriptions in Phase 5 | Just names + level | |

**User's choice:** Click-to-expand spell card with full description.

---

### Cantrips

| Option | Description | Selected |
|--------|-------------|----------|
| Cantrips in spell list, Cast with no slot cost | Level 0 group at top of Spells section | ✓ |
| Cantrips in separate quick-access bar | Row of cantrip buttons above spell list | |
| Cantrips in Phase 7 | Deferred | |

**User's choice:** Cantrips in spell list as level 0, no slot cost on Cast.

---

## Level-Up Flow

### Prompt mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-prompt toast + modal | Amber banner when XP crosses threshold | ✓ |
| Inline chat message | System message in chat scroll | |
| AI narrates it, player manages sheet manually | No automated modal | |

**User's choice:** Auto-prompt amber banner → Level Up modal.

---

### Modal calculations

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-calculate everything, player confirms | HP + slots auto-calculated; player clicks Level Up | ✓ |
| Player rolls HP increase | Roll or take average picker | |
| Show stat increases only, player edits manually | Diff display, no auto-apply | |

**User's choice:** Auto-calculate HP + slots; player chooses roll or take average for HP.

---

### HP roll option

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — roll or take average (player chooses) | Two buttons: Roll [d8] vs Take average [5] | ✓ |
| Always take average | Fixed HP increase | |
| Roll only — no average option | Classic D&D risk/reward | |

**User's choice:** Player chooses roll or take average in Level Up modal.

---

### AI notification of level-up

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — system message in chat after level up | [System: Name reached Level N!] | ✓ |
| Player mentions it to AI themselves | No automatic notification | |
| AI updated via character summary only | Character summary reflects new level | |

**User's choice:** System message in chat scroll after level-up confirmed.

---

### Subclass on level-up

| Option | Description | Selected |
|--------|-------------|----------|
| No — defer subclass to Phase 7 | HP/slots only in Phase 5 modal | ✓ |
| Yes — include subclass picker now | Full subclass selection in Phase 5 | |

**User's choice:** Subclass deferred to Phase 7.

---

## Rest System

### Rest initiation

| Option | Description | Selected |
|--------|-------------|----------|
| Button in campaign header or character sheet | Rest button → short/long picker → context message to AI | ✓ |
| Player types it in chat | Natural language request | |
| Rest options appear after combat ends | Contextual post-combat chips | |

**User's choice:** Rest button in campaign header or Character Sheet tab.

---

### AI rest approval mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| AI calls processRest(type) tool call | App applies recovery only if tool call present | ✓ |
| App always processes rest | Immediate recovery before AI responds | |
| Player confirms after AI narrates | Confirmation button after narration | |

**User's choice:** AI calls processRest tool call to approve rest.

---

### Recovery rules

| Option | Description | Selected |
|--------|-------------|----------|
| RAW recovery | Short rest: roll hit dice; Long rest: full HP/slots + half hit dice back | ✓ |
| Simplified: short = 25% HP, long = full HP + slots | No hit dice mechanic | |
| Long rest only in Phase 5 | Defer short rest hit dice | |

**User's choice:** RAW recovery with hit dice for short rest.

---

### Death saves on rest

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — clear on any rest | Both short and long rest clear counters | ✓ |
| Only on long rest | Stricter interpretation | |
| Claude's discretion | Let planner handle | |

**User's choice:** Clear death saves on any rest.

---

### Hit dice tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Track hit dice count in characterResources | hitDiceCurrent + hitDiceTotal columns | ✓ |
| No hit die tracking — roll and add HP | No explicit count, buttons only | |
| Hit dice tracking in Phase 7 | Simplified rest in Phase 5 | |

**User's choice:** hitDiceCurrent + hitDiceTotal in characterResources.

---

### Rest events log

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — log as rest_taken event | processRest writes campaign_events entry | ✓ |
| No — rests don't need a log entry | Events log for combat only | |
| Log only long rests | Short rests are routine | |

**User's choice:** All rests logged as rest_taken events.

---

### Warlock Pact Magic slots

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pactSlots separate from spellSlots | New pact_slots JSON column, restored on short rest | ✓ |
| No — Warlock slots treated as regular | Simplified, technically wrong | |
| Claude's discretion | Let planner handle | |

**User's choice:** pactSlots separate column in characterResources, restored on short rest.

---

## Claude's Discretion

- Exact Zod schemas for each tool call
- JSON-tail regex/parser implementation details
- Toast chip positioning, animation, and stacking behavior
- Short rest hit die roll UI (modal vs. popover from Rest button)
- Spell section position within Character Sheet tab
- Whether initiative list uses strict initiative order or groups player at bottom
- Character summary update to include concentratingOn field
- Exact wording of the [System: ...] level-up chat message
- rpg-dice-roller vs dice-typescript library selection
- updateCurrency arg structure (absolute patch vs. per-denomination deltas)
- Migration number (0004 or later depending on Phase 4 final migration count)

## Deferred Ideas

- Subclass selection on level-up → Phase 7
- ASI/feat choices on level-up → Phase 7
- Companion/familiar in combat tracker → Phase 7
- Verified main-process dice rolls for AI (rollForMe) → Phase 8+
- Warlock class-specific short-rest recharge features (edge cases) → Phase 7
- Spell list search/filter → Phase 8
- Ritual casting enforcement → Phase 7
