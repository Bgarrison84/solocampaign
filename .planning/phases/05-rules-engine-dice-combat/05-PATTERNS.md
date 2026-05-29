# Phase 5: Rules Engine, Dice & Combat — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 24 (15 new + 9 modified)
**Analogs found:** 22 / 24

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/db/campaignEventsRepo.ts` | repo | append-only CRUD | `src/main/db/messagesRepo.ts` | role-match |
| `src/main/db/combatantsRepo.ts` | repo | CRUD | `src/main/db/sessionsRepo.ts` | exact |
| `src/main/db/characterSpellsRepo.ts` | repo | CRUD | `src/main/db/sessionsRepo.ts` | exact |
| `src/main/ai/toolSchemas.ts` | utility | transform | `src/main/trpc/schemas.ts` | role-match |
| `src/main/ai/mutationPipeline.ts` | service | batch transform | `src/main/index.ts` onFinish block | partial |
| `src/main/trpc/routers/combat.ts` | router | CRUD request-response | `src/main/trpc/routers/sessions.ts` | exact |
| `src/main/trpc/routers/spells.ts` | router | CRUD request-response | `src/main/trpc/routers/sessions.ts` | exact |
| `src/main/trpc/routers/campaignEvents.ts` | router | request-response (read-only) | `src/main/trpc/routers/ai.ts` | role-match |
| `src/renderer/src/stores/combatStore.ts` | store | event-driven | `src/renderer/src/stores/sessionStore.ts` | exact |
| `src/renderer/src/components/CombatTrackerTab.tsx` | component | CRUD | `src/renderer/src/components/CharacterSheetTab.tsx` | role-match |
| `src/renderer/src/components/DiceRollerPopover.tsx` | component | event-driven | `src/renderer/src/components/ChatInputArea.tsx` | partial |
| `src/renderer/src/components/sheet/SpellListSection.tsx` | component | CRUD | `src/renderer/src/components/sheet/ResourcesSection.tsx` | exact |
| `src/renderer/src/components/LevelUpModal.tsx` | component | request-response | `src/renderer/src/components/EndSessionModal.tsx` | exact |
| `src/renderer/src/components/MutationChipStack.tsx` | component | event-driven | `src/renderer/src/components/StoryScrollPanel.tsx` (L1 warning bar) | partial |
| `src/renderer/src/components/RestPickerDialog.tsx` | component | request-response | `src/renderer/src/components/EndSessionModal.tsx` | role-match |
| `src/renderer/src/components/ShortRestHitDiceModal.tsx` | component | request-response | `src/renderer/src/components/EndSessionModal.tsx` | role-match |
| `src/renderer/src/lib/dice.ts` | utility | transform | `src/main/trpc/schemas.ts` | partial |
| `resources/migrations/0004_phase5_rules_engine.sql` | migration | — | `resources/migrations/0003_slippery_carnage.sql` | exact |
| `src/main/db/schema.ts` (modify) | schema | — | existing self | exact |
| `src/main/ai/llmProvider.ts` (modify) | service | streaming | existing self | exact |
| `src/main/ai/contextBuilder.ts` (modify) | service | transform | existing self | exact |
| `src/renderer/src/screens/CampaignViewScreen.tsx` (modify) | screen | request-response | existing self | exact |
| `src/renderer/src/components/CharacterSheetTab.tsx` (modify) | component | CRUD | existing self | exact |
| `src/renderer/src/components/ChatInputArea.tsx` (modify) | component | event-driven | existing self | exact |
| `src/renderer/src/components/StoryScrollPanel.tsx` (modify) | component | streaming | existing self | exact |
| `src/main/trpc/router.ts` (modify) | config | — | existing self | exact |
| `src/main/index.ts` (modify) | entrypoint | streaming | existing self | exact |

---

## Pattern Assignments

### `src/main/db/campaignEventsRepo.ts` (repo, append-only CRUD)

**Analog:** `src/main/db/messagesRepo.ts`

**Imports pattern** (lines 1–10 of messagesRepo.ts):
```typescript
import { asc, desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { messages } from './schema'
import type { Message } from './schema'
```
Swap `messages` for `campaignEvents` and `Message` for `CampaignEvent`.

**Insert pattern** (messagesRepo.ts lines 27–52):
```typescript
insert(input: InsertMessageInput): Message {
  const db = getDb()
  const id = randomUUID()
  db.insert(messages).values({ id, campaignId: input.campaignId, role: input.role, content: input.content, sessionId: input.sessionId ?? null }).run()
  const created = db.select().from(messages).where(eq(messages.id, id)).get()
  if (!created) throw new Error('[messages] Failed to retrieve message after insert')
  return created
},
```
For `campaignEventsRepo.insert`, the payload is `{ campaignId, sessionId?, eventType, payload }`. No retrieval after insert needed — just `.run()`. Return void.

**List-by-campaign pattern:** Copy `messagesRepo.getLastN` replacing table + adding `eq(campaignEvents.campaignId, campaignId)` filter ordered by `desc(campaignEvents.createdAt)`.

---

### `src/main/db/combatantsRepo.ts` (repo, CRUD)

**Analog:** `src/main/db/sessionsRepo.ts`

**Imports pattern** (sessionsRepo.ts lines 1–13):
```typescript
import { asc, desc, eq, sql, and, isNull, isNotNull, lt } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { sessions } from './schema'
import type { Session } from './schema'
```
Swap `sessions` for `combatants`, `Session` for `Combatant`.

**Create pattern** (sessionsRepo.ts lines 20–56):
```typescript
create(input: { campaignId: string; sessionId?: string | null; name: string; hpMax: number; ac: number; initiative: number; initiativeOrder: number; isPlayer: boolean }): Combatant {
  const db = getDb()
  const id = randomUUID()
  db.insert(combatants).values({ id, ...input, hpCurrent: input.hpMax, conditions: '[]', isActive: true }).run()
  const created = db.select().from(combatants).where(eq(combatants.id, id)).get()
  if (!created) throw new Error('[combatants] Failed to retrieve combatant after insert')
  return created
},
```

**Update pattern** (sessionsRepo.ts `end` method lines 137–151):
```typescript
updateHp(id: string, hpCurrent: number): void {
  const db = getDb()
  db.update(combatants).set({ hpCurrent }).where(eq(combatants.id, id)).run()
},
```

**List active pattern:**
```typescript
listActive(campaignId: string): Combatant[] {
  const db = getDb()
  return db.select().from(combatants)
    .where(and(eq(combatants.campaignId, campaignId), eq(combatants.isActive, true)))
    .orderBy(asc(combatants.initiativeOrder))
    .all()
},
```

**End combat pattern** (bulk update):
```typescript
endCombat(campaignId: string): void {
  const db = getDb()
  db.update(combatants).set({ isActive: false })
    .where(and(eq(combatants.campaignId, campaignId), eq(combatants.isActive, true)))
    .run()
},
```

**JSON columns:** `conditions` is stored as a JSON string. Parse on read — same pattern as `charactersRepo.ts` which parses `conditions` via `JSON.parse(resources.conditions)`.

---

### `src/main/db/characterSpellsRepo.ts` (repo, CRUD)

**Analog:** `src/main/db/sessionsRepo.ts` (structure) + `src/main/db/charactersRepo.ts` (JSON/array patterns)

**Imports pattern:** Same as sessionsRepo.ts lines 1–13, swapping `sessions` for `characterSpells`.

**Seed pattern** (bulk insert from JSON):
```typescript
seed(characterId: string, spells: Array<{ spellName: string; spellLevel: number; isPrepared: boolean }>): void {
  const db = getDb()
  // Delete existing spells for this character before re-seeding
  db.delete(characterSpells).where(eq(characterSpells.characterId, characterId)).run()
  for (const spell of spells) {
    db.insert(characterSpells).values({ id: randomUUID(), characterId, ...spell }).run()
  }
},
```

**List by character:**
```typescript
listByCharacter(characterId: string): CharacterSpell[] {
  const db = getDb()
  return db.select().from(characterSpells)
    .where(eq(characterSpells.characterId, characterId))
    .orderBy(asc(characterSpells.spellLevel))
    .all()
},
```

---

### `src/main/ai/toolSchemas.ts` (utility, transform)

**Analog:** `src/main/trpc/schemas.ts` (Zod schema patterns) + RESEARCH.md Pattern 1

**Imports pattern** (from RESEARCH.md — verified against `node_modules/ai/dist/index.d.ts`):
```typescript
import { tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'
```

**Zod schema pattern** (trpc/schemas.ts lines 1–15):
```typescript
// trpc/schemas.ts style — named schema constants, exported for reuse
export const campaignIdSchema = z.string().uuid()
export const hpDeltaSchema = z.number().int().min(-9999).max(9999)
export const conditionNameSchema = z.enum(['blinded', 'charmed', ...])
```
Apply same naming and bounding pattern to the 12 tool schemas. Key schemas (from RESEARCH.md):

```typescript
export const updateHpSchema = z.object({
  characterId: z.string().optional(),
  combatantId: z.string().optional(),
  delta: z.number().int(),
  source: z.string().max(100).optional(),
})

export const addCombatantSchema = z.object({
  campaignId: z.string(),
  sessionId: z.string().optional(),
  name: z.string().max(100),
  hpMax: z.number().int().min(1).max(9999),
  ac: z.number().int().min(1).max(99).default(10),
  initiative: z.number().int().default(0),
  initiativeOrder: z.number().int().default(0),
  isPlayer: z.boolean().default(false),
})

export const showDiceRollSchema = z.object({
  label: z.string().max(100),
  expression: z.string().max(50),
  result: z.number().int(),
  breakdown: z.array(z.number()).max(20),
})
```

**tool() registration pattern** (RESEARCH.md Pattern 1):
```typescript
export const updateHpTool = tool({
  description: 'Apply HP change to a combatant. Use negative delta for damage, positive for healing.',
  parameters: updateHpSchema,
  // NO execute property — D-04: mutations applied in onFinish only
})

export const PHASE5_TOOLS = {
  updateHp: updateHpTool,
  // ... all 12 tools
} as const satisfies ToolSet
```

**Critical:** Do NOT add `execute` functions to any tool. RESEARCH.md Pitfall 1: execute causes double-application with onFinish batch.

---

### `src/main/ai/mutationPipeline.ts` (service, batch transform)

**Analog:** `src/main/index.ts` `onFinish` callback block (lines 322–334) + RESEARCH.md Pattern 3

**Imports pattern:**
```typescript
import { getDb } from '../db/index'
import { combatantsRepo } from '../db/combatantsRepo'
import { campaignEventsRepo } from '../db/campaignEventsRepo'
import { charactersRepo } from '../db/charactersRepo'
import log from 'electron-log'
import { z } from 'zod'
import {
  updateHpSchema, applyConditionSchema, /* ... all 12 schemas */
} from './toolSchemas'
```

**Drizzle transaction pattern** (from RESEARCH.md "Don't Hand-Roll" table):
```typescript
export async function applyMutationBatch(
  toolCalls: Array<{ toolName: string; args: unknown }>,
  campaignId: string,
  sessionId: string | null,
): Promise<void> {
  const db = getDb()
  db.transaction(() => {
    for (const call of toolCalls) {
      try {
        applyOneTool(call.toolName, call.args, campaignId, sessionId)
      } catch (err) {
        // D-06: silent — log and continue
        log.error('[mutationPipeline] tool call failed:', call.toolName, err instanceof Error ? err.message : String(err))
      }
    }
  })
}
```

**JSON-tail parser pattern** (RESEARCH.md Pattern 3):
```typescript
const JSON_TAIL_REGEX = /\n*```json\n([\s\S]+?)\n```\s*$/

export function stripAndParseJsonTail(text: string): {
  cleanText: string
  mutations: Array<{ toolName: string; args: unknown }> | null
} {
  const match = text.match(JSON_TAIL_REGEX)
  if (!match) return { cleanText: text, mutations: null }
  const cleanText = text.slice(0, text.length - match[0].length).trimEnd()
  try {
    const parsed = JSON.parse(match[1])
    const mutations = Array.isArray(parsed.mutations) ? parsed.mutations : null
    return { cleanText, mutations }
  } catch {
    return { cleanText: text, mutations: null }
  }
}
```

**Zod safeParse validation per tool** (per-tool dispatch):
```typescript
function applyOneTool(toolName: string, args: unknown, campaignId: string, sessionId: string | null): void {
  switch (toolName) {
    case 'updateHp': {
      const result = updateHpSchema.safeParse(args)
      if (!result.success) { log.warn('[mutationPipeline] invalid updateHp args', result.error); return }
      // apply mutation...
      break
    }
    // ... 11 more cases
  }
}
```

---

### `src/main/trpc/routers/combat.ts` (router, CRUD request-response)

**Analog:** `src/main/trpc/routers/sessions.ts`

**Imports pattern** (sessions.ts lines 1–39):
```typescript
import { z } from 'zod'
import { t } from '../_base'
import { sessionsRepo } from '../../db/sessionsRepo'
import { campaignsRepo } from '../../db/campaignsRepo'
import log from 'electron-log'
import { campaignIdSchema, sessionIdSchema } from '../schemas'
```
Swap `sessionsRepo` for `combatantsRepo`, add `campaignEventsRepo`.

**Query procedure pattern** (sessions.ts `list` lines 275–279):
```typescript
getCombatants: t.procedure
  .input(z.object({ campaignId: campaignIdSchema }))
  .query(({ input }) => {
    return combatantsRepo.listActive(input.campaignId)
  }),
```

**Mutation procedure pattern** (sessions.ts `end` lines 158–169):
```typescript
addCombatant: t.procedure
  .input(z.object({
    campaignId: campaignIdSchema,
    sessionId: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    hpMax: z.number().int().min(1).max(9999),
    ac: z.number().int().min(1).max(99).default(10),
    initiative: z.number().int().default(0),
    initiativeOrder: z.number().int().default(0),
    isPlayer: z.boolean().default(false),
  }))
  .mutation(({ input }) => {
    const combatant = combatantsRepo.create(input)
    log.debug('[combat] addCombatant', { campaignId: input.campaignId, name: input.name })
    return combatant
  }),
```

**Error logging pattern** (sessions.ts lines 105–117):
```typescript
log.error('[combat] endCombat failed:', err instanceof Error ? err.message : String(err))
```

---

### `src/main/trpc/routers/spells.ts` (router, CRUD request-response)

**Analog:** `src/main/trpc/routers/sessions.ts` (structure) + `src/main/trpc/routers/characters.ts` (mutation patterns)

**Key mutation pattern** (characters.ts `updateSpellSlot` style):
```typescript
castSpell: t.procedure
  .input(z.object({
    characterId: z.string().uuid(),
    spellName: z.string().min(1).max(100),
    slotLevel: z.number().int().min(0).max(9),
    campaignId: campaignIdSchema,
  }))
  .mutation(({ input }) => {
    if (input.slotLevel > 0) {
      // Optimistic deduction — already done in renderer; confirm server-side
      charactersRepo.updateSpellSlot(input.characterId, String(input.slotLevel), 1)
    }
    log.debug('[spells] castSpell', { characterId: input.characterId, spellName: input.spellName })
    return { cast: true }
  }),
```

---

### `src/main/trpc/routers/campaignEvents.ts` (router, read-only request-response)

**Analog:** `src/main/trpc/routers/ai.ts`

**Query-only pattern** (ai.ts `getMessages` lines 40–48):
```typescript
export const campaignEventsRouter = t.router({
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema, limit: z.number().int().min(1).max(200).default(50) }))
    .query(({ input }) => {
      return campaignEventsRepo.listByCampaign(input.campaignId, input.limit)
    }),
})
```

---

### `src/renderer/src/stores/combatStore.ts` (store, event-driven)

**Analog:** `src/renderer/src/stores/sessionStore.ts`

**Exact copy-and-modify pattern** (sessionStore.ts lines 1–71):
```typescript
import { create } from 'zustand'

interface CombatState {
  isCombatActive: boolean
  activeCampaignId: string | null
  currentTurnOrder: number
  startCombat: (campaignId: string) => void
  endCombat: () => void
  setCurrentTurn: (order: number) => void
}

export const useCombatStore = create<CombatState>()((set) => ({
  isCombatActive: false,
  activeCampaignId: null,
  currentTurnOrder: 0,
  startCombat: (campaignId) => set({ isCombatActive: true, activeCampaignId: campaignId }),
  endCombat: () => set({ isCombatActive: false, activeCampaignId: null, currentTurnOrder: 0 }),
  setCurrentTurn: (order) => set({ currentTurnOrder: order }),
}))
```

**Pattern notes from sessionStore.ts:**
- `create<State>()(...)` double-call syntax (Zustand 5.x)
- Interface separated from the `create` call
- Actions use `set` only (no `get` needed in Phase 5)
- Export named `useCombatStore` (matches `useSessionStore` naming convention)

---

### `src/renderer/src/components/CombatTrackerTab.tsx` (component, CRUD)

**Analog:** `src/renderer/src/components/CharacterSheetTab.tsx`

**Imports + TanStack Query pattern** (CharacterSheetTab.tsx lines 1–33):
```typescript
import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import { useCombatStore } from '../stores/combatStore'
import { ConditionBadge } from './sheet/ConditionBadge'
import { Stepper } from './sheet/Stepper'
```

**Query pattern** (CharacterSheetTab.tsx lines 29–34):
```typescript
const combatantsQuery = useQuery({
  queryKey: ['combat', 'getCombatants', campaignId],
  queryFn: () => trpc.combat.getCombatants.query({ campaignId }),
  enabled: !!campaignId,
  refetchInterval: isCombatActive ? 2000 : false, // poll during active combat
})
```

**Optimistic mutation pattern** (ResourcesSection.tsx lines 22–48 — copy the `onMutate`/`onError`/`onSettled` triple):
```typescript
const updateHpMutation = useMutation({
  mutationFn: ({ combatantId, delta }: { combatantId: string; delta: number }) =>
    trpc.combat.updateCombatantHp.mutate({ combatantId, delta }),
  onMutate: async ({ combatantId, delta }) => {
    await queryClient.cancelQueries({ queryKey: QUERY_KEY })
    const prev = queryClient.getQueryData(QUERY_KEY)
    // optimistic update...
    return { prev }
  },
  onError: (_err, _vars, context) => {
    if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
})
```

**ConditionBadge reuse** (already importable from `./sheet/ConditionBadge`):
```typescript
// Each combatant row: condition badges already handle active/inactive states
{conditions.map((cond) => (
  <ConditionBadge key={cond} condition={cond as ConditionName} active={true} onToggle={() => removeCondition(cond)} />
))}
```

**Stepper reuse for HP** (Stepper.tsx — exact component):
```typescript
<Stepper value={combatant.hpCurrent} min={0} max={combatant.hpMax} size="sm" label={`${combatant.name} HP`} onChange={(delta) => updateHpMutation.mutate({ combatantId: combatant.id, delta })} />
```

---

### `src/renderer/src/components/DiceRollerPopover.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/ChatInputArea.tsx` (button row pattern) + shadcn Popover

**Button row pattern** (ChatInputArea.tsx lines 118–148):
```typescript
<div className="flex flex-row items-end gap-2">
  {/* dice icon button sits here, before the Textarea */}
  <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Open dice roller" className="h-9 w-9 shrink-0">
    <Dice6 className="h-4 w-4" />
  </Button>
  {/* existing Textarea */}
</div>
```

**Popover shell pattern** (shadcn component — use `Popover`, `PopoverTrigger`, `PopoverContent` from `./ui/popover`):
```typescript
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'

<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm" ...>
      <Dice6 className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-64 p-3" side="top" align="start">
    {/* 7 die buttons + expression input */}
  </PopoverContent>
</Popover>
```

**Callback pattern** — `onRoll: (prefix: string) => void` prop mirrors `onSend` callback shape from ChatInputArea.

---

### `src/renderer/src/lib/dice.ts` (utility, transform)

**No direct analog** — new file wrapping `rpg-dice-roller`. Pattern from RESEARCH.md Pattern 7:

```typescript
// Thin wrapper — renderer only (rpg-dice-roller is ESM, Vite handles it natively)
import { DiceRoller } from 'rpg-dice-roller'

const roller = new DiceRoller()

export interface RollResult {
  expression: string
  result: number
  breakdown: number[]
}

export function rollExpression(expression: string): RollResult {
  const roll = roller.roll(expression)
  return {
    expression,
    result: roll.total,
    breakdown: roll.rolls.flatMap(r =>
      Array.isArray(r.rolls) ? r.rolls.map((d: { value: number }) => d.value) : [r.value]
    ),
  }
}
```

**Vite config fallback** (RESEARCH.md Pitfall 6): If ESM import fails, add to `vite.config` `optimizeDeps.include: ['rpg-dice-roller']`.

---

### `src/renderer/src/components/sheet/SpellListSection.tsx` (component, CRUD)

**Analog:** `src/renderer/src/components/sheet/ResourcesSection.tsx`

**Section header pattern** (ResourcesSection.tsx line 228–229):
```typescript
<section>
  <h2 className="text-xl font-semibold mb-3">Spells</h2>
```

**Spell slot mutation (optimistic)** — copy the entire `spellSlotMutation` pattern from ResourcesSection.tsx lines 133–170:
```typescript
const castSpellMutation = useMutation({
  mutationFn: ({ spellName, slotLevel }: { spellName: string; slotLevel: number }) =>
    trpc.spells.castSpell.mutate({ characterId: character.id, spellName, slotLevel, campaignId: character.campaignId }),
  onMutate: async ({ slotLevel }) => {
    await queryClient.cancelQueries({ queryKey: QUERY_KEY })
    const prev = queryClient.getQueryData<CharacterWithResources>(QUERY_KEY)
    if (prev && slotLevel > 0) {
      const slot = prev.resources.spellSlots[String(slotLevel)]
      if (slot) {
        queryClient.setQueryData(QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            spellSlots: {
              ...prev.resources.spellSlots,
              [String(slotLevel)]: { ...slot, used: Math.min(slot.max, slot.used + 1) },
            },
          },
        })
      }
    }
    return { prev }
  },
  onError: (_err, _vars, context) => {
    if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
})
```

**Collapsible row pattern** — use `useState` per spell row for expanded/collapsed (no shadcn Accordion needed — simpler):
```typescript
const [expandedSpell, setExpandedSpell] = useState<string | null>(null)
// row onClick: setExpandedSpell(spell.spellName === expandedSpell ? null : spell.spellName)
```

**spellcaster guard** (mirroring ResourcesSection.tsx `isSpellcaster` check lines 222–225):
```typescript
const isSpellcaster = Object.keys(character.resources.spellSlots).length > 0
if (!isSpellcaster) return null // SpellListSection renders nothing for non-spellcasters
```

---

### `src/renderer/src/components/LevelUpModal.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/EndSessionModal.tsx`

**Dialog shell pattern** (EndSessionModal.tsx lines 118–126):
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'

<Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !isSaving) onClose() }}>
  <DialogContent className="max-w-[480px] w-full max-h-[85vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle>Level Up — Level {newLevel}</DialogTitle>
    </DialogHeader>
    <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
      {/* HP options + new spell slots */}
    </div>
    <DialogFooter>
      <Button variant="default" onClick={handleLevelUp} disabled={isSaving}>
        Level Up!
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**useMutation pattern** (EndSessionModal.tsx lines 74–90):
```typescript
const levelUpMutation = useMutation({
  mutationFn: (input: { characterId: string; hpGain: number }) =>
    trpc.characters.levelUp.mutate(input),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['characters', 'getByCampaignId', campaignId] })
    onClose()
  },
  onError: () => setError('Level up failed. Try again.'),
})
```

**Loading spinner pattern** (EndSessionModal.tsx lines 210–224):
```typescript
<Button variant="default" onClick={handleLevelUp} disabled={levelUpMutation.isPending}>
  {levelUpMutation.isPending ? (
    <><Loader2 className="h-4 w-4 animate-spin mr-1" />Leveling up…</>
  ) : (
    'Level Up!'
  )}
</Button>
```

---

### `src/renderer/src/components/MutationChipStack.tsx` (component, event-driven)

**Analog:** `src/renderer/src/components/StoryScrollPanel.tsx` L1 overflow warning bar (lines 251–265)

**Warning bar pattern to adapt** (StoryScrollPanel.tsx lines 252–265):
```typescript
{isL1Overflow && (
  <div role="alert" aria-live="assertive"
    className="bg-amber-950/30 border-y border-amber-900/40 px-4 py-2 flex items-start gap-2 shrink-0">
    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
    <span className="text-sm text-amber-400">...</span>
  </div>
)}
```

**Chip stack pattern** — positioned container below the tab list, using `useState<MutationChip[]>` + `useEffect` timeout per chip:
```typescript
interface MutationChip { id: string; label: string; type: 'hp' | 'xp' | 'condition' | 'slot' | 'currency' }

// Tailwind animate-in:
// className="animate-in slide-in-from-top-2 duration-200"
// After 4s: removeChip(chip.id)
```

---

### `src/renderer/src/components/RestPickerDialog.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/EndSessionModal.tsx` (Dialog shell)

**Minimal dialog pattern** — simpler than EndSessionModal: just two buttons (Short Rest / Long Rest), no streaming. Use Dialog + two Button variants.

```typescript
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="max-w-[360px]">
    <DialogHeader><DialogTitle>Take a Rest</DialogTitle></DialogHeader>
    <div className="p-6 flex flex-col gap-3">
      <Button variant="outline" onClick={() => onSelectRest('short')}>Short Rest</Button>
      <Button variant="outline" onClick={() => onSelectRest('long')}>Long Rest</Button>
    </div>
  </DialogContent>
</Dialog>
```

**Callback:** `onSelectRest: (type: 'short' | 'long') => void` prepends `[Player requests a short/long rest]` to chat input, then closes.

---

### `src/renderer/src/components/ShortRestHitDiceModal.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/EndSessionModal.tsx` (Dialog shell) + `src/renderer/src/components/sheet/Stepper.tsx` (stepper within)

**Dialog shell:** Same as RestPickerDialog but with a Stepper for dice count + running total display.
**Stepper reuse:** `<Stepper value={diceToRoll} min={0} max={hitDiceRemaining} size="md" label="Hit dice to roll" onChange={(d) => setDiceToRoll(prev => prev + d)} />`

---

### `resources/migrations/0004_phase5_rules_engine.sql` (migration)

**Analog:** `resources/migrations/0003_slippery_carnage.sql`

**Migration format** (0003_slippery_carnage.sql — full file):
```sql
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  ...
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `rolling_summary` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `session_id` text REFERENCES sessions(id);
```

**Statement-breakpoint separator:** `--> statement-breakpoint` between each DDL statement (verbatim — the migrate runner splits on this string).

**SQLite ALTER TABLE rules** (RESEARCH.md Pitfall 4):
- `ADD COLUMN ... NOT NULL DEFAULT 'x'` — required for columns that must be NOT NULL on existing rows
- `ADD COLUMN ...` nullable — no DEFAULT needed (existing rows get NULL)
- `pact_slots` needs `NOT NULL DEFAULT '{}'`; `concentrating_on`, `hit_dice_current`, `hit_dice_total` are nullable

---

## Modifications — Key Patterns

### `src/main/db/schema.ts` — Add 3 tables + 4 columns

**Pattern for new table** (schema.ts lines 28–48, sessions table):
```typescript
export const combatants = sqliteTable('combatants', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id),
  name: text('name').notNull(),
  hpCurrent: integer('hp_current').notNull(),
  hpMax: integer('hp_max').notNull(),
  ac: integer('ac').notNull().default(10),
  initiative: integer('initiative').notNull().default(0),
  initiativeOrder: integer('initiative_order').notNull().default(0),
  conditions: text('conditions').notNull().default('[]'),
  isPlayer: integer('is_player', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})
export type Combatant = typeof combatants.$inferSelect
```

**Pattern for adding nullable columns** (schema.ts `characterResources` lines 134–161):
```typescript
// Add to characterResources sqliteTable:
concentratingOn: text('concentrating_on'),       // nullable — existing rows → NULL
hitDiceCurrent: integer('hit_dice_current'),      // nullable — existing rows → NULL
hitDiceTotal: integer('hit_dice_total'),          // nullable — existing rows → NULL
pactSlots: text('pact_slots').notNull().default('{}'), // NOT NULL with default
```

---

### `src/main/ai/llmProvider.ts` — Add tools parameter

**Existing StreamOptions interface** (llmProvider.ts lines 30–33):
```typescript
export interface StreamOptions {
  abortSignal?: AbortSignal
}
```

**Extended pattern:**
```typescript
import type { ToolSet } from 'ai'

export interface StreamOptions {
  abortSignal?: AbortSignal
  tools?: ToolSet   // Phase 5 — passed to streamText({ tools })
}
```

**streamText call extension** (llmProvider.ts lines 89–95):
```typescript
const result = await streamText({
  model,
  system: systemPrompt,
  messages,
  tools: options?.tools,          // NEW
  toolChoice: options?.tools ? 'auto' : undefined,  // NEW
  temperature: 0.8,
  abortSignal: options?.abortSignal,
})
```

**onFinish callback extension** — the current `streamChat` does NOT have an `onFinish` parameter in the `streamText` call. Phase 5 needs to add it to collect tool calls. Pattern from RESEARCH.md Pattern 2:
```typescript
onFinish: async (event) => {
  // event.toolCalls: all tool calls from this response
  // event.text: the full narrative text
  if (options?.onToolCallsFinish) {
    await options.onToolCallsFinish(event.toolCalls ?? [], event.text)
  }
},
```
Add `onToolCallsFinish?: (toolCalls: ToolCall[], text: string) => Promise<void>` to `StreamOptions`.

---

### `src/main/ai/contextBuilder.ts` — Add tool descriptions + concentratingOn

**Existing formatCharacterSummary** (contextBuilder.ts lines 74–135):
Add after the `inspirationLine` push (line 131):
```typescript
// Phase 5: concentrating_on (D-25, Pitfall 8)
if (resources.concentratingOn) {
  lines.push(`Concentrating on: ${resources.concentratingOn}`)
}
// Phase 5: hit dice remaining
if (resources.hitDiceCurrent != null && resources.hitDiceTotal != null) {
  lines.push(`Hit Dice: ${resources.hitDiceCurrent}/${resources.hitDiceTotal}`)
}
```

**System prompt tool descriptions block** (RESEARCH.md Code Examples section):
```typescript
// Add to buildContext() just before assembling systemPrompt:
const toolDescriptionsBlock = `
Game mechanics you control (use these tool calls during play):
- Use \`updateHp\` when a creature takes damage or is healed. Delta is negative for damage, positive for healing.
- Use \`applyCondition\`/\`removeCondition\` for status effects (Poisoned, Stunned, Blinded, etc.)
- Use \`showDiceRoll\` whenever you make an attack, saving throw, or skill check — always show your dice.
- Use \`addCombatant\` at the start of combat to add enemies to the initiative tracker.
- Use \`endCombat\` when all enemies are defeated or the encounter ends.
- Use \`awardXp\` after encounters. Typical encounter = 50–500 XP depending on difficulty.
- Use \`deductSpellSlot\` when the player casts a leveled spell.
- Use \`updateCurrency\` when the party finds loot or spends money. Values are deltas (positive = gain).
- Use \`processRest\` to grant the player's rest request if narratively appropriate.
`.trim()
```
Insert `toolDescriptionsBlock` into the system prompt assembly (contextBuilder.ts line 244) after the main block, before `referenceDocBlock`.

---

### `src/renderer/src/screens/CampaignViewScreen.tsx` — Controlled Tabs + buttons

**Uncontrolled → controlled** (current line 354, RESEARCH.md Pitfall 9):
```typescript
// BEFORE (line 354):
<Tabs defaultValue="character-sheet" className="flex flex-col h-full">

// AFTER:
const [activeTab, setActiveTab] = useState<string>('character-sheet')
// ...
<Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
```

**Start Combat button pattern** — copy the existing "End Session" button pattern (CampaignViewScreen.tsx shows Button + useSessionStore pattern). Place "Start Combat" and "Rest" buttons in the campaign header alongside the existing "End Session" button.

**Auto-switch on startCombat:**
```typescript
const handleStartCombat = useCallback(() => {
  useCombatStore.getState().startCombat(id!)
  setActiveTab('combat-tracker')
}, [id])
```

---

### `src/renderer/src/components/StoryScrollPanel.tsx` — Dice roll chip + system events

**Message type extension** — the messages query returns `{ id, role, content, createdAt }`. System events use `role: 'system'` (new message type) and dice roll chips use `role: 'dice_roll'` or are embedded in assistant message content via `showDiceRoll` tool.

**Inline chip render pattern** (after the assistant message block, lines 166–220):
```typescript
// After AI message content rendering, check if role === 'system':
if (msg.role === 'system') {
  return (
    <div key={msg.id} className="my-3 flex items-center justify-center">
      <span className="text-xs text-muted-foreground italic border border-border/40 rounded px-3 py-1 bg-surface">
        {msg.content}
      </span>
    </div>
  )
}

// showDiceRoll chip (inline in story flow):
if (msg.role === 'dice_roll') {
  const data = JSON.parse(msg.content) // { label, expression, result, breakdown }
  return (
    <div key={msg.id} className="my-2 flex items-center gap-2 rounded bg-amber-950/30 border border-amber-900/40 px-3 py-2 text-sm">
      <span>🎲</span>
      <span className="text-amber-400 font-semibold">{data.label}</span>
      <span className="text-muted-foreground">— {data.expression} =</span>
      <span className="font-bold text-foreground">{data.result}</span>
      <span className="text-muted-foreground text-xs">({data.breakdown.join(', ')})</span>
    </div>
  )
}
```

---

### `src/renderer/src/components/CharacterSheetTab.tsx` — SpellListSection + level-up banner

**Section addition pattern** (current CharacterSheetTab.tsx lines 52–65 — add after ResourcesSection):
```typescript
// Add import at top:
import { SpellListSection } from './sheet/SpellListSection'

// In the rendered character sheet div, after <ResourcesSection character={character} />:
<SpellListSection character={character} />
```

**Level-up XP threshold banner** — amber banner pattern copied from StoryScrollPanel.tsx L1 overflow bar (lines 252–265):
```typescript
{isLevelUpAvailable && (
  <div role="alert" aria-live="polite"
    className="bg-amber-950/30 border border-amber-900/40 rounded-md px-4 py-3 flex items-center gap-3 mb-4">
    <Star className="h-4 w-4 text-amber-500 shrink-0" />
    <span className="text-sm text-amber-400 flex-1">
      Level {nextLevel} available — you have enough XP to level up!
    </span>
    <Button size="sm" variant="outline" onClick={() => setShowLevelUp(true)}>
      Level Up
    </Button>
  </div>
)}
```

**XP threshold check:**
```typescript
// XP thresholds from RESEARCH.md
const XP_THRESHOLDS: Record<number, number> = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000,
}
const nextLevel = character.level + 1
const isLevelUpAvailable = nextLevel <= 20 && character.xp >= (XP_THRESHOLDS[nextLevel] ?? Infinity)
```

---

### `src/main/index.ts` — Extend ai:send-message for tools

**Existing stream call** (index.ts lines 310–340):
```typescript
return streamChat(providerConfig, messages, systemPrompt, {
  onToken: (chunk) => { ... },
  onFinish: () => { /* existing: insert assistant message, send ai:finish */ },
  onError: (err) => { throw err },
}, { abortSignal: abortController.signal })
```

**Extended call with tools:**
```typescript
return streamChat(providerConfig, messages, systemPrompt, {
  onToken: (chunk) => { ... assistantBuffer += chunk ... },
  onFinish: () => {
    // strip JSON-tail from assistantBuffer before saving
    const { cleanText, mutations: tailMutations } = stripAndParseJsonTail(assistantBuffer)
    // save clean text to messages table
    messagesRepo.insert({ campaignId, role: 'assistant', content: cleanText, sessionId: activeSessionId })
    safeSend('ai:finish', { isL1Overflow })
  },
  onError: (err) => { throw err },
  onToolCallsFinish: async (toolCalls, text) => {
    // Apply native tool calls in a single transaction
    await applyMutationBatch(toolCalls, campaignId, activeSessionId)
    // Signal renderer to invalidate combatants + character queries
    safeSend('ai:mutations-applied', { campaignId })
  },
}, { abortSignal: abortController.signal, tools: PHASE5_TOOLS })
```

---

### `src/main/trpc/router.ts` — Register new routers

**Exact registration pattern** (router.ts lines 1–22):
```typescript
import { combatRouter } from './routers/combat'
import { spellsRouter } from './routers/spells'
import { campaignEventsRouter } from './routers/campaignEvents'

export const router = t.router({
  ai: aiRouter,
  campaigns: campaignsRouter,
  campaignEvents: campaignEventsRouter,  // NEW
  characters: charactersRouter,
  combat: combatRouter,                  // NEW
  content: contentRouter,
  prefs: prefsRouter,
  secrets: secretsRouter,
  sessions: sessionsRouter,
  spells: spellsRouter,                  // NEW
  window: windowRouter,
})
```

---

## Shared Patterns

### Drizzle Synchronous API — ALL main-process DB calls
**Source:** `src/main/db/sessionsRepo.ts` (entire file)
**Apply to:** `campaignEventsRepo.ts`, `combatantsRepo.ts`, `characterSpellsRepo.ts`, all tRPC routers
```typescript
// CORRECT — synchronous
db.insert(table).values({...}).run()
const row = db.select().from(table).where(eq(table.id, id)).get()

// WRONG — do NOT use await
await db.insert(table).values({...})  // better-sqlite3 is sync; await is a no-op here
```

### Zod safeParse for AI tool inputs — tool call handlers
**Source:** `src/main/trpc/schemas.ts` (schema pattern) + RESEARCH.md Security section
**Apply to:** `mutationPipeline.ts` applyOneTool() for all 12 tool cases
```typescript
const result = myToolSchema.safeParse(rawArgs)
if (!result.success) {
  log.warn('[mutationPipeline] invalid tool args', { tool: toolName, error: result.error })
  return  // D-06: silent failure
}
// use result.data safely
```

### TanStack Query QUERY_KEY convention
**Source:** `src/renderer/src/components/sheet/ResourcesSection.tsx` lines 19–20
**Apply to:** All new renderer components with tRPC queries
```typescript
const QUERY_KEY = ['combat', 'getCombatants', campaignId] as const
// Invalidation: queryClient.invalidateQueries({ queryKey: QUERY_KEY })
```

### electron-log prefix convention
**Source:** `src/main/db/sessionsRepo.ts` error messages, `src/main/trpc/routers/sessions.ts` debug calls
**Apply to:** All new main-process files
```typescript
log.debug('[combat] addCombatant', { ... })   // info-level events
log.error('[combatantsRepo] update failed:', err.message)  // errors only
// Never log apiKey, stack traces, or raw provider response bodies
```

### shadcn Dialog close guard pattern
**Source:** `src/renderer/src/components/EndSessionModal.tsx` lines 119–122
**Apply to:** `LevelUpModal.tsx`, `RestPickerDialog.tsx`, `ShortRestHitDiceModal.tsx`
```typescript
<Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !mutation.isPending) onClose() }}>
```

### Optimistic mutation triple (onMutate + onError + onSettled)
**Source:** `src/renderer/src/components/sheet/ResourcesSection.tsx` lines 22–48
**Apply to:** All CombatTrackerTab mutations, SpellListSection castSpell mutation
```typescript
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: QUERY_KEY })
  const prev = queryClient.getQueryData(QUERY_KEY)
  // optimistic update to queryClient cache
  return { prev }
},
onError: (_err, _vars, context) => {
  if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
},
onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/renderer/src/lib/dice.ts` | utility | transform | No dice library wrapper exists; rpg-dice-roller is new; RESEARCH.md Pattern 7 provides the template |
| `resources/spells.json` | content | — | Content authoring task; no spell metadata file exists in codebase; follow `resources/classes.json` structure pattern |

---

## Metadata

**Analog search scope:** `src/main/db/`, `src/main/ai/`, `src/main/trpc/`, `src/renderer/src/stores/`, `src/renderer/src/components/`, `src/renderer/src/screens/`, `resources/migrations/`
**Files scanned:** 27 source files read directly
**Pattern extraction date:** 2026-05-28
