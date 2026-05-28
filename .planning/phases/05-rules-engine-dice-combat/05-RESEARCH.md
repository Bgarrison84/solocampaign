# Phase 5: Rules Engine, Dice & Combat - Research

**Researched:** 2026-05-28
**Domain:** D&D 5e mechanics, AI tool-call schema, Vercel AI SDK v6, Drizzle migration 0004, dice library selection, combat tracker Zustand, spell casting, level-up flow, rest system
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AI Tool-Call Schema (D-01 to D-08)**
- D-01: Fine-grained tools — 12 tools: updateHp, applyCondition, removeCondition, deductSpellSlot, restoreSpellSlots, awardXp, updateCurrency, addCombatant, removeCombatant, endCombat, processRest, showDiceRoll
- D-02: JSON-tail fallback — ` ```json\n{"mutations":[...]}\n``` ` appended at message end; main process strips before display, applies same mutation pipeline
- D-03: Phase 5 tools only — no quest/NPC/faction/inspiration tools
- D-04: Mutations applied in onFinish callback as single DB transaction — no mid-stream partial state
- D-05: campaign_events append-only table — id, campaign_id, session_id (FK nullable), event_type (text enum), payload (JSON), created_at
- D-06: Tool-call failures are silent — log + continue; AI narration still displays
- D-07: Toast/chip notifications per mutation — chips slide in at top of right panel, ~4s, stack up to 4
- D-08: Vercel AI SDK tools parameter — pass Phase 5 tool schemas via tools option to streamText; system prompt uses natural language tool descriptions (no manual schema injection)

**Combat Tracker (D-09 to D-17)**
- D-09: Player starts combat via "Start Combat" button — auto-focuses Combat Tracker tab
- D-10: AI adds enemies via addCombatant; player can also add manually
- D-11: DB-persisted combatants table — id, campaign_id, session_id (nullable), name, hp_current, hp_max, ac, initiative, initiative_order, conditions (JSON array), is_player (bool), is_active (bool)
- D-12: Vertical initiative list with expandable rows — HP bar, condition badges, HP stepper + condition picker on expand
- D-13: AI drives turn advancement — no "Next Turn" button in Phase 5
- D-14: AI calls endCombat; player can also click "End Combat"
- D-15: Full manual edit — HP stepper and condition picker in expanded row
- D-16: Unified initiative list — player character and enemies in same sorted list
- D-17: Auto-switch to Combat Tracker tab when Start Combat is clicked

**Dice Roller (D-18 to D-22)**
- D-18: Dice roller attached to chat input area — d20 icon button, opens Popover
- D-19: Auto-populates chat input with roll prefix — e.g. `[d20: 14] `
- D-20: Both die buttons (d4/d6/d8/d10/d12/d20/d100) and expression input (2d6+3, 4d6kh3)
- D-21: Dice rolls logged to campaign_events on message send
- D-22: AI visible dice rolls as chat chips — showDiceRoll tool renders inline chip in StoryScrollPanel

**Spell Casting (D-23 to D-29)**
- D-23: New "Spells" section in Character Sheet tab — collapsible, grouped by level
- D-24: Optimistic immediate slot deduction on cast + chat prefix + undo chip (30s window)
- D-25: concentratingOn (TEXT nullable) added to characterResources; warning dialog on second concentration spell
- D-26: character_spells table — id, character_id (FK), spell_name, spell_level (int 0-9), is_prepared (bool)
- D-27: Upcast support — slot level picker shows only available levels
- D-28: Click-to-expand spell card with cast time, range, duration, components, description, Cast button
- D-29: Cantrips at level 0 — Cast button present but no slot deduction

**Level-Up Flow (D-30 to D-33)**
- D-30: Auto-prompt on XP threshold — amber banner in CharacterSheetTab
- D-31: Level Up modal — HP gain (roll or average) + new spell slots table; no subclass/feat in Phase 5
- D-32: System message in chat after level-up: `[System: {Name} reached Level {N}!]`
- D-33: Subclass selection deferred to Phase 7

**Rest System (D-34 to D-40)**
- D-34: "Rest" button in campaign header — opens Short/Long Rest picker
- D-35: AI approves rest via processRest tool call — no recovery if tool call absent
- D-36: RAW recovery — short rest: player rolls hit dice (UI shows per-die results); long rest: HP to max, all slots restored, hit dice to half (min 1), death saves cleared
- D-37: Death saves clear on any rest
- D-38: hitDiceCurrent + hitDiceTotal added to characterResources
- D-39: processRest logs rest_taken event to campaign_events
- D-40: Warlock pactSlots — separate JSON column; short rest restores to max; deductSpellSlot/restoreSpellSlots handle both (slotType: 'normal'|'pact' arg)

### Claude's Discretion
- Exact Zod schemas for each tool call (argument shapes, required vs. optional fields)
- JSON-tail regex/parser implementation details
- Toast chip positioning and animation
- Short rest hit die roll UI (modal or popover)
- Spell section position within Character Sheet tab
- Whether initiative list uses strict initiative order or groups player at bottom
- Exact character summary update to include concentratingOn field
- Exact wording of [System: ...] level-up chat message
- rpg-dice-roller vs dice-typescript library selection
- How updateCurrency args are structured (absolute patch vs. per-denomination deltas)
- campaign_events schema migration number (0004 confirmed — see below)

### Deferred Ideas (OUT OF SCOPE)
- Subclass selection on level-up (Phase 7)
- ASI/feat choices on level-up (Phase 7)
- Companion/familiar tracking in combat tracker (Phase 7)
- Verified main-process dice rolls (rollForMe tool) — Phase 8+
- Warlock Hexblade's Curse and edge-case short-rest recharge features (Phase 7)
- Search/filter in spell list (Phase 8)
- Ritual casting enforcement (Phase 7)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMB-01 | User can roll any standard D&D dice plus custom expressions via in-app dice roller; results surfaced to AI | rpg-dice-roller supports full notation; rolls prepended to chat textarea |
| COMB-02 | Combat tracker displays initiative order, current HP, and active conditions for all combatants | combatants table (D-11) + CombatTrackerTab component (S2 in UI-SPEC) |
| COMB-03 | AI manages enemy initiative, turn order, actions, and visible dice rolls in chat | addCombatant tool + showDiceRoll tool; system prompt instructs AI to use both |
| COMB-04 | Conditions can be applied by AI in narrative or toggled manually by player | applyCondition/removeCondition tools + ConditionBadge in expanded combatant row |
| CHAR-08 | User can manage full spell list — click to cast, auto-deduct slots, track concentration, AI aware of prepared spells | character_spells table + SpellListSection + D-24 optimistic deduction + D-25 concentratingOn in character summary |
| PROG-01 | AI awards XP after encounters; app tracks total XP and auto-prompts level-up at threshold | awardXp tool + XP threshold check in CharacterSheetTab + LevelUpModal |
| PROG-02 | Player can request short or long rest; AI narrates; app auto-recovers resources on approval | processRest tool + Rest picker dialog + Short Rest Hit Die modal |
| PROG-04 | User can configure death/permadeath rules per campaign | Not directly in Phase 5 scope — death saves already tracked in characterResources; this is NOTED as partially out of Phase 5 (permadeath configuration is Phase 7) |
| STATE-05 | App tracks full currency (CP/SP/EP/GP/PP); AI auto-updates from loot/purchases | updateCurrency tool + existing currency columns in characterResources |
</phase_requirements>

---

## Summary

Phase 5 is the largest single architectural addition in the project: it wires the AI's output to the game's state through a formal tool-call schema, adds three new DB tables, extends characterResources with four new columns, introduces two new Zustand stores, five new tRPC routers (combat, spells, campaignEvents), and ships eight new UI surfaces. The existing codebase is well-structured for this — the patterns from Phases 1–4 (Drizzle migrations, tRPC routers, Zustand stores, TanStack Query, shadcn components) are all reusable.

The most critical architectural decision has already been locked: mutations only happen in the `onFinish` callback of `streamText` (D-04). This avoids all mid-stream state races. The installed AI SDK is **v6.0.191** (not "v4" as documented in CLAUDE.md — the CLAUDE.md version name is the major series name "Vercel AI SDK v4 lineage" but the installed npm package is `ai@6.x`). This matters because `streamText` in v6 accepts `tools` as `ToolSet` (a record of `tool()` objects), the `onFinish` callback receives `OnFinishEvent<TOOLS>` which includes `toolCalls: Array<TypedToolCall<TOOLS>>` and `steps: StepResult<TOOLS>[]`, and the `tool()` helper function is exported directly from the `ai` package.

The dice library decision leans to **rpg-dice-roller** (slopcheck [OK], GitHub source confirmed, supports `4d6kh3` and full notation) over `dice-typescript` (last updated 2022, 239 weekly downloads). The JSON-tail fallback regex is straightforward with one non-obvious edge case (the fenced block must be at the very end of the message text, after all narrative content). The migration is confirmed as **0004** — migrations 0000 through 0003 are in use.

**Primary recommendation:** Implement the 12 AI tools using the `tool()` helper from `ai` package, collect all tool calls in `onFinish` `event.toolCalls` array, apply them in a single `db.transaction()` call. For the dice library use `rpg-dice-roller@5.0.0`. Migration 0004 adds three tables plus four ALTER TABLE ADD COLUMN statements.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI tool-call schema definition | API/Backend (main process) | — | Tools defined server-side, never exposed to renderer; Zod validation at tRPC/IPC boundary |
| Tool call mutation execution | API/Backend (main process) | — | DB writes must happen in main process via better-sqlite3; renderer is untrusted |
| JSON-tail fallback parsing | API/Backend (main process) | — | Parsing happens on the complete message text before DB write and before renderer display |
| campaign_events append-only log | Database/Storage | — | Written by main process after each mutation |
| Combat tracker UI | Browser/Renderer | — | Reads combatants via tRPC query; writes HP/conditions via tRPC mutation |
| Dice rolling (player) | Browser/Renderer | — | Roll evaluation runs client-side; only the result crosses IPC when message is sent |
| Dice rolling (AI visible rolls) | API/Backend (main process) | Browser/Renderer | showDiceRoll tool fires in main; result stored in messages; renderer reads from messages |
| Spell list display + cast optimistic update | Browser/Renderer | — | Optimistic TanStack Query mutation; tRPC mutation confirms |
| Level-up XP threshold detection | Browser/Renderer | — | useEffect in CharacterSheetTab watches characterResources.xp vs. threshold table |
| Rest resource recovery | API/Backend (main process) | — | processRest tool call handler writes all resource updates in a single transaction |
| Toast/chip notification dispatch | Browser/Renderer | — | React state (queue of chips); each tool call response triggers chip push from query cache diff |
| Concentration tracking | Database/Storage + Browser | — | concentratingOn column in DB; renderer reads optimistically and writes on cast |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | 6.0.191 (installed) | streamText + tool() + onFinish | Already in project; tools parameter is native |
| `zod` | 3.x (installed) | Tool argument schemas, IPC validation | Already established pattern throughout project |
| `better-sqlite3` | 12.x (installed) | Synchronous DB writes in onFinish | Native driver; established in Phase 1 |
| `drizzle-orm` | 0.36.x (installed) | Type-safe queries for combatants, campaign_events, character_spells | Already established |
| `zustand` | 5.x (installed) | combatStore, campaignViewStore activeTab | Already established |
| `@tanstack/react-query` | 5.x (installed) | Wrap tRPC combat/spells queries | Already established |
| `@trpc/server` / `@trpc/client` | 10.x pinned (installed) | New combat.ts and spells.ts routers | Locked to v10 (electron-trpc 0.7.1 compatibility) |
| `lucide-react` | 0.556.x (installed) | Swords, Moon, Dice6, Star, ArrowDown, Zap, etc. icons | Already established |
| `shadcn/ui` components | per component | popover, progress, badge, sonner | Official shadcn registry only |

### New Dependency Required

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `rpg-dice-roller` | 5.0.0 | Parse and roll dice expressions including `4d6kh3`, `2d6+3`, `d20+5` | slopcheck [OK]; GitHub source confirmed; supports advanced notation; better maintained than dice-typescript |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `rpg-dice-roller` | `dice-typescript` | dice-typescript is smaller but last updated 2022 (June), only 239 weekly downloads vs rpg-dice-roller's 787. rpg-dice-roller has active GitHub and supports identical notation. |
| Custom toast container | `sonner` (shadcn) | sonner is available (v2.0.7 on npm), in the shadcn official registry. The UI-SPEC approved it with a noted caveat: sonner portals to `<body>` so scoping to the right panel requires using the custom container approach if positional alignment is wrong. Phase 5 can ship with the custom `MutationChipStack` container per UI-SPEC S6 spec. |

**Installation (new packages only):**
```bash
npm install rpg-dice-roller
npx shadcn@latest add popover progress badge sonner
```

**Version verification (confirmed against npm registry):**
```
rpg-dice-roller: 5.0.0 (2022-05-16 last published)
dice-typescript: 1.6.1 (2022-06-15 last published)
sonner: 2.0.7 (npm registry, confirmed)
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `rpg-dice-roller` | npm | 2018 (7+ yrs) | github.com/GreenImp/rpg-dice-roller | [OK] | Approved |
| `dice-typescript` | npm | 2017 (8+ yrs) | github.com/trwolfe13/dice-typescript | [OK] | Not selected — see Alternatives |
| `sonner` | npm | n/a | github.com/emilkowalski/sonner | [OK] | Approved (shadcn official registry) |

No postinstall scripts on rpg-dice-roller, dice-typescript, or sonner. `[VERIFIED: npm registry + slopcheck]`

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Player Input (ChatInputArea)
  → [dice roll prefix prepended if dice roller used]
  → window.aiStream.sendMessage() [IPC]
    ↓
Main Process: ai:send-message handler
  → buildContext() [ContextBuilder v2 + tools block in system prompt preamble]
  → streamChat() → streamText({ model, system, messages, tools: PHASE5_TOOLS })
    ↓ streaming tokens → onToken → IPC → StoryScrollPanel (renders markdown)
    ↓ onFinish(event) → event.toolCalls[] + JSON-tail fallback parsing
      ↓ applyMutationBatch(toolCalls) [single db.transaction()]
        → campaignEventsRepo.insert() for each mutation
        → combatantsRepo.upsert() / updateHp() / addCondition() etc.
        → characterResourcesRepo.updateSpellSlot() / updateHp() / updateXp() etc.
      ↓ trpc query invalidation signal → renderer
        ↓ TanStack Query refetches → UI updates
        ↓ toast chip dispatch (mutation chip per tool call applied)
        ↓ XP threshold check → amber level-up banner if crossed

AI visible dice rolls (showDiceRoll tool call):
  onFinish event.toolCalls → find showDiceRoll calls
  → write to messages table as special dice_roll message type
  → StoryScrollPanel reads messages list → renders showDiceRoll chip inline
```

### Recommended Project Structure (new files)

```
src/main/
├── db/
│   ├── schema.ts              [MODIFY — add 3 tables + 4 columns to characterResources]
│   ├── combatantsRepo.ts      [NEW]
│   ├── campaignEventsRepo.ts  [NEW]
│   ├── characterSpellsRepo.ts [NEW]
├── ai/
│   ├── llmProvider.ts         [MODIFY — add tools parameter to streamChat signature]
│   ├── contextBuilder.ts      [MODIFY — add tool definitions block to system prompt + concentratingOn]
│   ├── toolSchemas.ts         [NEW — Zod schemas + tool() definitions for all 12 Phase 5 tools]
│   ├── mutationPipeline.ts    [NEW — applyMutationBatch(); JSON-tail parser; single transaction]
├── trpc/routers/
│   ├── combat.ts              [NEW — addCombatant, updateCombatantHp, endCombat, getCombatants]
│   ├── spells.ts              [NEW — getCharacterSpells, castSpell, undoCast, seedSpells]
│   ├── campaignEvents.ts      [NEW — list events for campaign (for display/debug)]
│   ├── router.ts              [MODIFY — register combat, spells, campaignEvents routers]
resources/migrations/
│   ├── 0004_phase5_rules_engine.sql  [NEW — campaign_events, combatants, character_spells + ALTER TABLE]
src/renderer/src/
├── components/
│   ├── CombatTrackerTab.tsx            [NEW — replaces placeholder in CampaignViewScreen]
│   ├── DiceRollerPopover.tsx           [NEW]
│   ├── LevelUpModal.tsx                [NEW]
│   ├── MutationChipStack.tsx           [NEW — toast chip notification system]
│   ├── RestPickerDialog.tsx            [NEW]
│   ├── ShortRestHitDiceModal.tsx       [NEW]
│   ├── sheet/SpellListSection.tsx      [NEW]
│   ├── CharacterSheetTab.tsx           [MODIFY — add SpellListSection, level-up banner]
│   ├── ChatInputArea.tsx               [MODIFY — add DiceRollerPopover]
│   ├── StoryScrollPanel.tsx            [MODIFY — add showDiceRoll chip + system event rendering]
│   ├── CampaignViewScreen.tsx          [MODIFY — add Start Combat / Rest / End Combat buttons; controlled Tabs]
├── stores/
│   ├── combatStore.ts                  [NEW — isCombatActive, activeCombatId, currentTurnOrder]
│   ├── campaignViewStore.ts            [NEW or MODIFY sessionStore — add activeTab controlled state]
```

### Pattern 1: AI Tool Definition with tool() helper (Vercel AI SDK v6)

**What:** Define each mutation as a typed `tool()` object with Zod parameter schema. No `execute` function needed (D-04: mutations applied in onFinish, not mid-stream).

**When to use:** For all 12 Phase 5 tools.

```typescript
// Source: ai package v6 — verified from node_modules/ai/dist/index.d.ts
import { tool } from 'ai'
import { z } from 'zod'

export const updateHpTool = tool({
  description: 'Apply HP change to a combatant. Use negative delta for damage, positive for healing.',
  parameters: z.object({
    characterId: z.string().uuid().optional(), // null = player character
    combatantId: z.string().optional(),        // for non-player combatants
    delta: z.number().int(),                   // negative = damage, positive = heal
    source: z.string().max(100).optional(),    // e.g. "Goblin attack", "Cure Wounds"
  }),
  // No execute: mutations are batch-applied in onFinish
})

export const PHASE5_TOOLS = {
  updateHp: updateHpTool,
  applyCondition: applyConditionTool,
  removeCondition: removeConditionTool,
  deductSpellSlot: deductSpellSlotTool,
  restoreSpellSlots: restoreSpellSlotsTool,
  awardXp: awardXpTool,
  updateCurrency: updateCurrencyTool,
  addCombatant: addCombatantTool,
  removeCombatant: removeCombatantTool,
  endCombat: endCombatTool,
  processRest: processRestTool,
  showDiceRoll: showDiceRollTool,
} as const satisfies import('ai').ToolSet
```

### Pattern 2: streamText with tools — Extended streamChat Signature

**What:** Extend the existing `streamChat` function to accept an optional `tools` parameter. Pass to `streamText`. Collect tool calls in `onFinish`.

```typescript
// Source: node_modules/ai/dist/index.d.ts — verified streamText signature
import type { ToolSet } from 'ai'

export interface StreamOptions {
  abortSignal?: AbortSignal
  tools?: ToolSet  // NEW Phase 5 — passed directly to streamText({ tools })
}

// In streamChat():
const result = await streamText({
  model,
  system: systemPrompt,
  messages,
  tools: options?.tools,
  toolChoice: 'auto',  // model decides whether to call tools
  temperature: 0.8,
  abortSignal: options?.abortSignal,
  onFinish: async (event) => {
    // event.toolCalls: Array<TypedToolCall<TOOLS>> — all tool calls from this response
    // event.text: string — the full narrative text (already streamed token by token)
    await applyMutationBatch(event.toolCalls, campaignId, sessionId)
  },
})
```

**Critical note:** When `tools` are passed, `streamText` may return BOTH text tokens AND tool calls in a single response (the model streams text narration and also emits tool calls). The `result.textStream` still yields text tokens. Tool calls are available after completion via `event.toolCalls` in `onFinish`. This is the correct behavior for D-04.

### Pattern 3: JSON-tail Fallback Parser

**What:** Strip the ` ```json\n{...}\n``` ` block from the end of AI text before rendering. Parse and apply the same mutation pipeline as tool calls.

```typescript
// Claude's discretion implementation — verified edge cases listed in Pitfalls section
const JSON_TAIL_REGEX = /\n*```json\n([\s\S]+?)\n```\s*$/

export function stripAndParseJsonTail(text: string): {
  cleanText: string
  mutations: MutationPayload[] | null
} {
  const match = text.match(JSON_TAIL_REGEX)
  if (!match) return { cleanText: text, mutations: null }
  
  const cleanText = text.slice(0, text.length - match[0].length).trimEnd()
  try {
    const parsed = JSON.parse(match[1])
    const mutations = Array.isArray(parsed.mutations) ? parsed.mutations : null
    return { cleanText, mutations }
  } catch {
    // Malformed JSON — treat as no tail; log warning
    return { cleanText: text, mutations: null }
  }
}
```

### Pattern 4: Drizzle Migration 0004 Pattern

**What:** Migration 0004 creates three new tables and adds four columns to character_resources.

```sql
-- resources/migrations/0004_phase5_rules_engine.sql
-- campaign_events: append-only audit log for all mutations
CREATE TABLE `campaign_events` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `session_id` text,
  `event_type` text NOT NULL,
  `payload` text NOT NULL DEFAULT '{}',
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- combatants: DB-persisted initiative list (D-11)
CREATE TABLE `combatants` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `session_id` text,
  `name` text NOT NULL,
  `hp_current` integer NOT NULL,
  `hp_max` integer NOT NULL,
  `ac` integer NOT NULL DEFAULT 10,
  `initiative` integer NOT NULL DEFAULT 0,
  `initiative_order` integer NOT NULL DEFAULT 0,
  `conditions` text NOT NULL DEFAULT '[]',
  `is_player` integer DEFAULT false NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- character_spells: spell list per character (D-26)
CREATE TABLE `character_spells` (
  `id` text PRIMARY KEY NOT NULL,
  `character_id` text NOT NULL,
  `spell_name` text NOT NULL,
  `spell_level` integer NOT NULL DEFAULT 0,
  `is_prepared` integer DEFAULT true NOT NULL,
  FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Extend character_resources (D-25, D-38, D-40)
ALTER TABLE `character_resources` ADD `concentrating_on` text;
--> statement-breakpoint
ALTER TABLE `character_resources` ADD `hit_dice_current` integer;
--> statement-breakpoint
ALTER TABLE `character_resources` ADD `hit_dice_total` integer;
--> statement-breakpoint
ALTER TABLE `character_resources` ADD `pact_slots` text NOT NULL DEFAULT '{}';
```

**Note:** ALTER TABLE ADD COLUMN in SQLite cannot set NOT NULL without a DEFAULT for existing rows. `concentrating_on` and `hit_dice_current/total` are nullable (existing rows get NULL). The migration runner (`applyMigrations`) already handles the `-->  statement-breakpoint` separator pattern used in 0000–0003.

### Pattern 5: combatStore — Zustand store for combat state

Following the sessionStore pattern exactly:

```typescript
// Source: existing sessionStore.ts pattern — [VERIFIED: project codebase]
import { create } from 'zustand'

interface CombatState {
  isCombatActive: boolean
  activeCombatId: string | null   // could be campaignId (one combat per campaign)
  currentTurnOrder: number        // initiative_order of the current combatant
  startCombat: (campaignId: string) => void
  endCombat: () => void
  setCurrentTurn: (order: number) => void
}

export const useCombatStore = create<CombatState>()((set) => ({
  isCombatActive: false,
  activeCombatId: null,
  currentTurnOrder: 0,
  startCombat: (campaignId) => set({ isCombatActive: true, activeCombatId: campaignId }),
  endCombat: () => set({ isCombatActive: false, activeCombatId: null, currentTurnOrder: 0 }),
  setCurrentTurn: (order) => set({ currentTurnOrder: order }),
}))
```

**Controlled Tabs:** `CampaignViewScreen` must switch from `<Tabs defaultValue="character-sheet">` to `<Tabs value={activeTab} onValueChange={setActiveTab}>`. The `activeTab` state lives in CampaignViewScreen component state (useState) or a campaignViewStore. When Start Combat fires: `setActiveTab('combat-tracker')`.

### Pattern 6: tRPC Router Registration

```typescript
// src/main/trpc/router.ts — add new routers
import { combatRouter } from './routers/combat'
import { spellsRouter } from './routers/spells'
import { campaignEventsRouter } from './routers/campaignEvents'

export const router = t.router({
  ai: aiRouter,
  campaigns: campaignsRouter,
  characters: charactersRouter,
  combat: combatRouter,          // NEW
  content: contentRouter,
  prefs: prefsRouter,
  secrets: secretsRouter,
  sessions: sessionsRouter,
  spells: spellsRouter,          // NEW
  campaignEvents: campaignEventsRouter, // NEW
  window: windowRouter,
})
```

### Pattern 7: rpg-dice-roller Usage in Renderer

```typescript
// Source: [ASSUMED based on rpg-dice-roller v5 docs — verify at import time]
// rpg-dice-roller is an ES module; may need dynamic import or bundler configuration
import { DiceRoller } from 'rpg-dice-roller'

const roller = new DiceRoller()

function rollExpression(expression: string): { result: number; breakdown: number[] } {
  const roll = roller.roll(expression)
  return {
    result: roll.total,
    breakdown: roll.rolls.flatMap(r => 
      Array.isArray(r.rolls) ? r.rolls.map(d => d.value) : [r.value]
    ),
  }
}
```

**Bundler note:** rpg-dice-roller 5.0.0 ships as ESM. Vite handles ESM in the renderer naturally. For the main process, if dice rolling is needed there, add to `optimizeDeps` or use a dynamic import. In Phase 5, dice rolling runs in the renderer only — no main process import needed.

### Anti-Patterns to Avoid

- **Mid-stream mutation:** Never apply DB mutations during `result.textStream` iteration. D-04 requires all mutations in `onFinish`. Race conditions and partial state will result from early application.
- **Putting tool definitions in the renderer:** Tools must be defined in the main process. The renderer must never see the tool schema objects (security boundary D-23).
- **Validating tool call inputs with a try/catch only:** Use Zod `.safeParse()` for each tool call input before applying. Log failures but continue (D-06).
- **Using Drizzle `async` sqlite calls:** `better-sqlite3` is synchronous. Do not use `await` on Drizzle queries in main process — they return synchronously.
- **Using `tool()` with an `execute` function for mutations:** Phase 5 uses D-04 (batch in onFinish). Adding `execute` functions would cause double-application.
- **Relying on tRPC for the streaming path:** The `ai:send-message` is a custom IPC channel, NOT tRPC (tRPC v10 can't stream over contextBridge). Tools must be defined and applied inside the IPC handler, not in a tRPC router.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dice expression parsing | Custom regex/parser for `2d6+3`, `4d6kh3` | `rpg-dice-roller` | Handles drop/keep modifiers, exploding dice, complex math — hundreds of edge cases |
| Toast notification system | Custom animation queue | Tailwind `animate-in slide-in-from-top-2` + `MutationChipStack` component | Tailwind animate utilities handle this with 5 lines; shadcn sonner is an alternative |
| Spell slot tables | Hardcoded slot arrays | `resources/spells-by-class.json` (already exists, fully populated) | The file has every class slot table from level 1–20 |
| XP threshold table | Hardcoded level array | D&D 5e SRD XP thresholds (embed as constant) | Only 20 values; no library needed |
| Ordinal number formatting | `if level === 1 return '1st'` chain | Simple ordinal function | 5-line implementation; no library needed |
| DB transaction management | Manual BEGIN/COMMIT | Drizzle `db.transaction(() => {...})` | Handles rollback, nesting, error semantics |
| Zod schema validation on tool inputs | `JSON.parse` + manual checks | `schema.safeParse(input)` | Type-safe with full error context |

**Key insight:** The project already has the spell slot tables and content JSON. The most tempting hand-roll trap is the dice expression parser — rpg-dice-roller prevents re-inventing drop/keep/exploding dice edge cases.

---

## Common Pitfalls

### Pitfall 1: AI SDK v6 — tools parameter requires no execute for D-04 pattern

**What goes wrong:** Adding `execute` functions to tools causes the SDK to try to invoke them during the stream and then call onFinish — mutations would run twice.

**Why it happens:** The AI SDK v6 `tool()` helper accepts an optional `execute` property. If provided, the SDK auto-executes and passes results back to the model for multi-turn tool use. D-04 explicitly says to apply mutations only in `onFinish`.

**How to avoid:** Define tools with `description` and `parameters` only. No `execute` property. Collect via `event.toolCalls` in `onFinish`.

**Warning signs:** DB rows appearing before the AI message is written to the messages table.

### Pitfall 2: streamText with tools changes the textStream behavior

**What goes wrong:** When a model emits tool calls, some providers don't emit text tokens in the same chunk. The `result.textStream` may be empty if the model ONLY emits tool calls (no narration text).

**Why it happens:** Some models (especially local LLMs) may respond with only tool call JSON and no narrative text. The existing streaming display logic assumes every AI response has text.

**How to avoid:** Guard against empty `textStream` in the `iterateStream` loop. If no text tokens arrive after the stream completes, the `onFinish` text will contain the tool calls (or be empty). Check `event.text` length in `onFinish` before writing the assistant message to the DB — if empty and tool calls exist, write a minimal placeholder or omit the message row.

**Warning signs:** Story panel shows a blank AI message bubble followed by mutation chips.

### Pitfall 3: JSON-tail regex false positive on embedded code blocks in AI narration

**What goes wrong:** The AI writes markdown with a code block BEFORE the actual mutation JSON block. The regex matches the wrong block.

**Why it happens:** The regex `\n*```json\n...\n```\s*$` anchors to the END of the string. But if the AI writes ` ```python\n...\n``` ` mid-text and then the mutation block, the match is correct. The false positive only occurs if the regex is too greedy (not anchored at `$`).

**How to avoid:** Always anchor the regex to `$` (end of string). Only the LAST ` ```json...``` ` block at the very end of the message qualifies as the mutation tail. Any code blocks earlier in the narrative are ignored.

**Warning signs:** Player sees mutation chips for a spell that was only narratively described, not cast.

### Pitfall 4: SQLite ALTER TABLE ADD COLUMN with NOT NULL without DEFAULT

**What goes wrong:** Migration 0004 fails on existing DBs because SQLite rejects `ADD COLUMN ... NOT NULL` on tables with existing rows unless a DEFAULT is provided.

**Why it happens:** `pact_slots` is intended as NOT NULL, but existing character_resources rows have no value for it.

**How to avoid:** Provide `DEFAULT '{}'` for `pact_slots` (text column, empty JSON object string). For nullable columns (`concentrating_on`, `hit_dice_current`, `hit_dice_total`), omit NOT NULL — they default to NULL for existing rows.

**Warning signs:** Migration fails with "NOT NULL constraint failed" on startup.

### Pitfall 5: Drizzle schema type mismatch after adding columns

**What goes wrong:** After adding columns to `characterResources` in schema.ts, existing CharacterWithResources type references break because TypeScript picks up the new columns.

**Why it happens:** Drizzle infers types directly from the schema. Adding `concentratingOn`, `hitDiceCurrent`, `hitDiceTotal`, `pactSlots` columns changes the inferred type.

**How to avoid:** Add columns to schema.ts AND to the migration SQL simultaneously. After adding, run `npm run typecheck` to catch all call sites that need updating (mainly `charactersRepo.ts`, `contextBuilder.ts`, `CharacterSheetTab.tsx`).

**Warning signs:** TypeScript errors about missing `concentratingOn` property.

### Pitfall 6: rpg-dice-roller ESM import in Electron renderer

**What goes wrong:** `import { DiceRoller } from 'rpg-dice-roller'` fails at build time if Vite doesn't know how to handle the package.

**Why it happens:** rpg-dice-roller v5 ships as pure ESM. Vite in Electron projects may have quirks with certain ESM packages.

**How to avoid:** Test the import immediately in Wave 0 (foundation plan). If Vite fails, add `rpg-dice-roller` to `vite.config` `optimizeDeps.include`. The electron-vite setup already handles most ESM packages natively.

**Warning signs:** `TypeError: Failed to resolve module specifier "rpg-dice-roller"` in the renderer.

### Pitfall 7: updateCurrency args — absolute vs. delta confusion

**What goes wrong:** If `updateCurrency` sends absolute values (`{gp: 50}` meaning "set GP to 50"), the AI that says "+50 GP" would actually SET the currency to 50, wiping the existing balance.

**Why it happens:** The decision (Claude's discretion) could go either way. The wrong choice causes currency corruption.

**How to avoid (RECOMMENDATION):** Use **per-denomination deltas**. Schema: `{cp: 0, sp: 0, ep: 0, gp: 50, pp: 0}` means "add 50 GP". Negative values deduct. The mutation handler does `resources.gp += delta.gp` etc. This is more robust against LLM errors and matches the physical metaphor of coins changing hands.

**Warning signs:** Player's currency jumps to unexpected values after loot is awarded.

### Pitfall 8: concentratingOn ContextBuilder injection

**What goes wrong:** The AI casts a concentration spell but doesn't know the character is already concentrating on something, so it double-concentrates.

**Why it happens:** `formatCharacterSummary()` in contextBuilder.ts doesn't include `concentratingOn` yet.

**How to avoid:** Add a line to `formatCharacterSummary()`:
```typescript
if (resources.concentratingOn) {
  lines.push(`Concentrating on: ${resources.concentratingOn}`)
}
```
This informs the AI so it can narrate appropriately when concentration is already active.

### Pitfall 9: Controlled Tabs — `defaultValue` vs `value` in CampaignViewScreen

**What goes wrong:** The auto-switch to Combat Tracker tab on "Start Combat" doesn't work because the Tabs component uses `defaultValue` (uncontrolled) instead of `value` (controlled).

**Why it happens:** The existing `<Tabs defaultValue="character-sheet">` is uncontrolled — changing state won't switch tabs.

**How to avoid:** Convert to controlled: `const [activeTab, setActiveTab] = useState('character-sheet')` → `<Tabs value={activeTab} onValueChange={setActiveTab}>`. Then `handleStartCombat` calls `setActiveTab('combat-tracker')`.

### Pitfall 10: Spell class detection — which classes get auto-populated vs prepared picker

**What goes wrong:** Phase 5 populates `character_spells` from class content JSON, but Wizards and Clerics have much larger spell lists (prepared spells differ from known spells).

**Why it happens:** The SRD spell list is large; auto-populating all Wizard spells would give them all 200+ spells.

**How to avoid (RECOMMENDATION per D-26 "Researcher decides"):**
- **Auto-populated (known spells — fixed list):** Bard, Sorcerer, Warlock, Ranger, Paladin — these classes know a specific set of spells at each level
- **Prepared-spell picker (chooses from full class list):** Wizard, Cleric, Druid — these classes prepare from their full class list daily
- **Phase 5 simplification:** For Phase 5, treat ALL spellcasters as "known spells" seeded from a starter list (e.g., the spells granted by their class at level 1 from the content JSON). The prepared-spell picker is a Phase 7 refinement. This avoids needing a full picker UI in Phase 5 while still populating the spell list for play.

---

## Spell Data: Class-Auto-Population Decision

### What exists in the codebase

The project already has:
- `resources/spells-by-class.json` — spell **slot tables** per class/level (not spell names)
- `resources/classes.json` — class definitions including `spellcaster: boolean` and `spellcastingAbility`
- No file containing actual spell data (name, description, components, range, etc.)

### Critical gap: Spell content data

The `character_spells` table stores `spell_name` and `spell_level`. The UI-SPEC's SpellListSection shows cast time, range, duration, components, description, concentration flag, ritual flag. These fields must come from somewhere.

**Options:**
1. **Add a `spells.json` resource file** with SRD spell data (names, descriptions, components, etc.) — the Phase 2 executor created class, background, equipment, races JSON. A `spells.json` file following the same pattern is the natural extension. [RECOMMENDED]
2. Store all spell metadata in the `character_spells` table at seed time — simpler queries but larger DB rows.

**Recommendation:** Create `resources/spells.json` with the SRD spells (roughly 200+ spells for the full SRD). `character_spells` stores `spell_name` as the FK-equivalent key. The renderer looks up spell details from the content JSON via a `content.getSpell` tRPC procedure or by bundling the spells JSON and reading it client-side. The `character_spells` table does NOT duplicate the full spell metadata.

**Classes that are spellcasters (from classes.json):** `bard`, `cleric`, `druid`, `paladin`, `ranger`, `sorcerer`, `warlock`, `wizard`

**Non-spellcasters:** `barbarian`, `fighter`, `monk`, `rogue` — `SpellListSection` does not render for these.

**Warlock pact magic slot structure (from spells-by-class.json):** Already uses the same `{ "level": count }` format as other classes. The existing `spellSlots` JSON column can store pact slots IF they're at a single slot level. D-40 adds a separate `pact_slots` column to keep them distinct.

### D&D 5e XP Threshold Table (embed as constant)

```typescript
// [CITED: D&D 5e SRD — verified against SRD 5.1]
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000,
}
// Level for a given XP: find the highest level where xp >= XP_THRESHOLDS[level]
```

### Hit Die per Class (embed as constant)

```typescript
// [VERIFIED: resources/classes.json — hitDie field]
export const HIT_DIE_BY_CLASS: Record<string, number> = {
  barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  sorcerer: 6, wizard: 6,
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.ts` (or vite.config shared) |
| Quick run command | `npm test -- --reporter=verbose src/main/ai/toolSchemas.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMB-01 | rpg-dice-roller rolls d20, 2d6+3, 4d6kh3 correctly | unit | `npm test -- src/renderer/src/lib/dice.test.ts` | Wave 0 |
| COMB-02 | combatantsRepo CRUD — add, update HP, conditions, end combat | unit | `npm test -- src/main/db/combatantsRepo.test.ts` | Wave 0 |
| COMB-03 | showDiceRoll tool Zod schema validates correctly | unit | `npm test -- src/main/ai/toolSchemas.test.ts` | Wave 0 |
| COMB-04 | applyCondition/removeCondition tools validate and mutate | unit | `npm test -- src/main/ai/toolSchemas.test.ts` | Wave 0 |
| CHAR-08 | characterSpellsRepo seed + deductSpellSlot mutation | unit | `npm test -- src/main/db/characterSpellsRepo.test.ts` | Wave 0 |
| PROG-01 | awardXp tool mutation + XP threshold crossing detection | unit | `npm test -- src/main/ai/toolSchemas.test.ts` | Wave 0 |
| PROG-02 | processRest({type:'long'}) restores HP to max + all slots | unit | `npm test -- src/main/ai/mutationPipeline.test.ts` | Wave 0 |
| PROG-02 | processRest({type:'short'}) decrements hitDiceCurrent | unit | `npm test -- src/main/ai/mutationPipeline.test.ts` | Wave 0 |
| STATE-05 | updateCurrency delta mutation applies correctly | unit | `npm test -- src/main/ai/toolSchemas.test.ts` | Wave 0 |

### Sampling Rate

- Per task commit: `npm test -- src/main/ai/toolSchemas.test.ts src/main/ai/mutationPipeline.test.ts`
- Per wave merge: `npm test`
- Phase gate: full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/main/ai/toolSchemas.test.ts` — Zod validation for all 12 tool schemas; REQ COMB-01 through STATE-05
- [ ] `src/main/ai/mutationPipeline.test.ts` — applyMutationBatch(), JSON-tail parser, long rest recovery
- [ ] `src/main/db/combatantsRepo.test.ts` — CRUD: add, updateHp, updateConditions, endCombat
- [ ] `src/main/db/characterSpellsRepo.test.ts` — seed from JSON, deductSpellSlot, undoCast
- [ ] `src/main/db/campaignEventsRepo.test.ts` — insert, list by campaignId
- [ ] `src/renderer/src/lib/dice.test.ts` — rollExpression wrapper around rpg-dice-roller (4d6kh3, 2d6+3, d20)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Main process | Yes | 24.15 (bundled with Electron 41) | — |
| npm | Package install | Yes | Project's npm | — |
| `rpg-dice-roller` | Dice rolling | Not installed | 5.0.0 (to install) | — |
| shadcn popover, progress, badge, sonner | UI components | Not installed | latest via shadcn CLI | Custom implementation |

**Missing dependencies with no fallback:** rpg-dice-roller (must install before dice roller implementation).

**Missing dependencies with fallback:** shadcn components (could implement custom, but shadcn official is cleaner).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — local app, no auth |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A — single user |
| V5 Input Validation | Yes | Zod on all tool call inputs at IPC boundary; tRPC Zod schemas on all new router inputs |
| V6 Cryptography | No | N/A for Phase 5 tools |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed tool call JSON from AI poisoning DB | Tampering | Zod `.safeParse()` on every tool call input; invalid calls are silently dropped (D-06) |
| Tool call args exceeding expected ranges (negative HP_max, infinite XP) | Tampering | Zod `.number().int().min(0).max(99999)` style bounds on all numeric fields |
| JSON-tail payload injecting extra mutations | Tampering | JSON-tail is only parsed when no native tool calls exist; apply the same Zod pipeline |
| Renderer crafting fake tool call results over IPC | Tampering | Tool calls never originate from the renderer — they come from AI response processing in main process |

---

## Code Examples

### Complete Zod Schemas for All 12 Tools

```typescript
// Source: Claude's discretion — Zod 3.x syntax [VERIFIED from node_modules/zod]

// updateHp: positive = heal, negative = damage
const updateHpSchema = z.object({
  characterId: z.string().optional(),    // player character characterId
  combatantId: z.string().optional(),    // non-player combatant row id
  delta: z.number().int(),               // −24 = 24 damage; +8 = heal 8
  source: z.string().max(100).optional(),
})

// applyCondition / removeCondition
const conditionSchema = z.object({
  characterId: z.string().optional(),
  combatantId: z.string().optional(),
  condition: z.string().max(50),         // 'Poisoned', 'Stunned', etc.
})

// deductSpellSlot
const deductSpellSlotSchema = z.object({
  characterId: z.string(),
  slotLevel: z.number().int().min(1).max(9),
  count: z.number().int().min(1).max(4).default(1),
  slotType: z.enum(['normal', 'pact']).default('normal'),  // D-40 Warlock
})

// restoreSpellSlots: pass a partial map of levels to restore
const restoreSpellSlotsSchema = z.object({
  characterId: z.string(),
  slots: z.record(z.string(), z.number().int().min(0)), // {"1":2,"3":1} = restore 2×1st, 1×3rd
  slotType: z.enum(['normal', 'pact']).default('normal'),
})

// awardXp
const awardXpSchema = z.object({
  campaignId: z.string(),
  amount: z.number().int().min(0).max(1000000),
})

// updateCurrency — deltas (positive = gain, negative = spend)
const updateCurrencySchema = z.object({
  campaignId: z.string(),
  cp: z.number().int().default(0),
  sp: z.number().int().default(0),
  ep: z.number().int().default(0),
  gp: z.number().int().default(0),
  pp: z.number().int().default(0),
})

// addCombatant
const addCombatantSchema = z.object({
  campaignId: z.string(),
  sessionId: z.string().optional(),
  name: z.string().max(100),
  hpMax: z.number().int().min(1).max(9999),
  ac: z.number().int().min(1).max(99).default(10),
  initiative: z.number().int().default(0),
  initiativeOrder: z.number().int().default(0),
  isPlayer: z.boolean().default(false),
})

// removeCombatant
const removeCombatantSchema = z.object({
  combatantId: z.string(),
})

// endCombat — no args (clears all active combatants for this campaign)
const endCombatSchema = z.object({
  campaignId: z.string(),
})

// processRest
const processRestSchema = z.object({
  type: z.enum(['short', 'long']),
})

// showDiceRoll — display only, no mutation
const showDiceRollSchema = z.object({
  label: z.string().max(100),         // 'Goblin attack'
  expression: z.string().max(50),     // '1d20+3'
  result: z.number().int(),           // 14
  breakdown: z.array(z.number()).max(20), // [11, 3]
})
```

### ContextBuilder Update — Tool Descriptions in System Prompt

```typescript
// Append to systemPrompt in buildContext() after the preamble block:
const toolDescriptionsBlock = `
Game mechanics you control (use these tool calls during play):
- Use \`updateHp\` when a creature takes damage or is healed. Delta is negative for damage, positive for healing.
- Use \`applyCondition\`/\`removeCondition\` for status effects (Poisoned, Stunned, Blinded, etc.)
- Use \`showDiceRoll\` whenever you make an attack, saving throw, or skill check — always show your dice so the player can see. Call it for every roll.
- Use \`addCombatant\` at the start of combat to add enemies to the initiative tracker. Include their HP, AC, and initiative order.
- Use \`endCombat\` when all enemies are defeated or the encounter ends.
- Use \`awardXp\` after encounters. Typical encounter = 50–500 XP depending on difficulty.
- Use \`deductSpellSlot\` when the player casts a leveled spell.
- Use \`updateCurrency\` when the party finds loot or spends money. Values are deltas (positive = gain).
- Use \`processRest\` to grant the player's rest request if narratively appropriate.
`
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| AI SDK v4 `CoreMessage` | AI SDK v6 `ModelMessage` — renamed type (already handled in project via `export type CoreMessage = ModelMessage`) | No change needed; alias already in place |
| `tools` parameter not in project | `streamText({ tools: PHASE5_TOOLS })` via AI SDK v6's native `ToolSet` type | Locks in the AI mutation contract |
| Manual HP/currency tracking by player | Tool call contract — AI calls updateHp/updateCurrency automatically | Game state stays consistent without player manual tracking |

**Deprecated/outdated:**
- `@google/generative-ai`: Deprecated August 2025. Project already uses `@ai-sdk/google`. [CITED: CLAUDE.md]
- AI SDK v4 naming: The installed package is `ai@6.x` — the "v4 API lineage" is how Vercel brands the major API series, not the npm version number. Code uses `ai@6.x` imports.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | rpg-dice-roller v5.0.0 ESM works cleanly in Vite/Electron renderer without extra config | Standard Stack / Pitfall 6 | May need `optimizeDeps.include` or dynamic import workaround |
| A2 | The `showDiceRoll` tool call result stored as a special message type in the messages table is the right persistence model | Architecture Patterns | May prefer a separate dice_rolls table or deriving from campaign_events |
| A3 | Spell content data (description, components, etc.) will be added as a new `resources/spells.json` in Phase 5 | Spell Data section | If skipped, SpellListSection can only show spell name and level — not the full expanded card |
| A4 | All classes treat Phase 5 spell seeding as "known spells" (simplified) rather than "prepared spells" (picker UI) | Spell class detection section | Wizard/Cleric players may find the spell list limited if important spells aren't in the starter list |
| A5 | `updateCurrency` uses per-denomination deltas (not absolute values) | Zod schemas section | If the AI interprets the arg as absolute, existing currency is overwritten |

---

## Open Questions

1. **spells.json content source**
   - What we know: The project has class content JSON but no spell content JSON (descriptions, components, etc.)
   - What's unclear: How large the SRD spell list needs to be for Phase 5 usability (full 200+ spells vs. starter list per class)
   - Recommendation: Include a `spells.json` authoring task in Wave 0/1 of Phase 5 planning, similar to how 02-03-PLAN.md authored the 5 content JSON files. This is a mechanical authoring task, not a code task.

2. **PROG-04 (death/permadeath configuration) scoping**
   - What we know: PROG-04 is assigned to Phase 5 in REQUIREMENTS.md but the CONTEXT.md for Phase 5 doesn't mention permadeath configuration
   - What's unclear: Whether Phase 5 needs a permadeath settings toggle or just the existing death saves tracking
   - Recommendation: Phase 5 ships death save clearing on rest (D-37). The per-campaign permadeath configuration (checkbox: permadeath enabled/disabled, resurrection rules, soft consequences) is a settings field that can land in Phase 5 as a campaigns table column addition with a UI toggle in AiSettingsModal — low implementation cost, satisfies PROG-04.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/ai/dist/index.d.ts` — streamText signature, ToolSet type, OnFinishEvent, tool() helper — `[VERIFIED: project codebase]`
- `resources/spells-by-class.json` — slot tables for all 8 spellcasting classes — `[VERIFIED: project codebase]`
- `resources/classes.json` — spellcaster bool, hitDie, spellcastingAbility per class — `[VERIFIED: project codebase]`
- `resources/migrations/0003_slippery_carnage.sql` — confirms migration 0003 is the last; next is 0004 — `[VERIFIED: project codebase]`
- `src/main/db/schema.ts` — current characterResources schema (no concentratingOn, hitDice, pactSlots yet) — `[VERIFIED: project codebase]`
- `src/main/ai/llmProvider.ts` — current streamChat signature to extend — `[VERIFIED: project codebase]`
- `src/main/ai/contextBuilder.ts` — formatCharacterSummary to update — `[VERIFIED: project codebase]`
- `src/renderer/src/stores/sessionStore.ts` — Zustand store pattern for combatStore — `[VERIFIED: project codebase]`
- `src/renderer/src/components/ChatInputArea.tsx` — existing input row layout for dice roller attachment — `[VERIFIED: project codebase]`
- `package.json` — installed versions of all dependencies; tRPC v10 pin confirmed — `[VERIFIED: project codebase]`
- npm registry: `rpg-dice-roller@5.0.0`, `dice-typescript@1.6.1`, `sonner@2.0.7` — `[VERIFIED: npm registry]`
- slopcheck: all three packages rated [OK] — `[VERIFIED: slopcheck 0.6.1]`

### Secondary (MEDIUM confidence)
- D&D 5e SRD XP thresholds (embed as constant) — `[CITED: D&D 5e SRD 5.1 — common knowledge, well-established]`
- D&D 5e hit die by class — `[CITED: resources/classes.json — verified in project]`
- Warlock pact magic structure — `[VERIFIED: resources/spells-by-class.json]`

### Tertiary (LOW confidence)
- rpg-dice-roller v5 ESM bundler behavior in Vite/Electron — `[ASSUMED — tag A1]`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm + slopcheck; AI SDK types read directly from node_modules
- Architecture: HIGH — patterns derived directly from existing Phase 1–4 code; no speculation
- Migration: HIGH — confirmed 0003 is last migration, 0004 schema derived from D-05/D-11/D-26/D-25/D-38/D-40 locked decisions
- Dice library: MEDIUM-HIGH — both packages confirmed [OK] by slopcheck; rpg-dice-roller chosen for maintenance and notation support; bundler behavior is [ASSUMED]
- Spell content: MEDIUM — gap identified (no spells.json exists yet); recommendation made but requires plan author to include authoring task

**Research date:** 2026-05-28
**Valid until:** 2026-07-28 (stable stack; rpg-dice-roller 5.0.0 last published 2022 — stable)
