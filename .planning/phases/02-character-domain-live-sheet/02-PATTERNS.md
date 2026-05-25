# Phase 2: Character Domain & Live Sheet - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 35 (main process: 10, renderer: 25)
**Analogs found:** 33 / 35

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/db/schema.ts` (modify) | model | CRUD | `src/main/db/schema.ts` (existing) | exact |
| `src/main/db/charactersRepo.ts` (new) | service | CRUD | `src/main/db/campaignsRepo.ts` | exact |
| `src/main/db/contentLoader.ts` (new) | utility | file-I/O | `src/main/db/migrate.ts` | role-match |
| `src/main/trpc/routers/characters.ts` (new) | route | request-response | `src/main/trpc/routers/campaigns.ts` | exact |
| `src/main/trpc/routers/content.ts` (new) | route | request-response | `src/main/trpc/routers/prefs.ts` | role-match |
| `src/main/trpc/router.ts` (modify) | config | request-response | `src/main/trpc/router.ts` (existing) | exact |
| `src/main/imageService.ts` (new) | service | file-I/O | `src/main/db/migrate.ts` | partial-match |
| `src/main/characters/calculations.ts` (new) | utility | transform | `src/main/db/campaignsRepo.ts` | partial-match |
| `resources/migrations/0001_characters.sql` (new) | migration | CRUD | `resources/migrations/0000_absent_thunderball.sql` | exact |
| `resources/races.json` (new) | config | file-I/O | — | no-analog |
| `resources/classes.json` (new) | config | file-I/O | — | no-analog |
| `resources/backgrounds.json` (new) | config | file-I/O | — | no-analog |
| `resources/equipment.json` (new) | config | file-I/O | — | no-analog |
| `resources/spells-by-class.json` (new) | config | file-I/O | — | no-analog |
| `src/renderer/src/screens/CampaignViewScreen.tsx` (modify) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` (existing) | exact |
| `src/renderer/src/components/CharacterSheetTab.tsx` (new) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` | role-match |
| `src/renderer/src/components/CreateCharacterWizard.tsx` (new) | component | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | exact |
| `src/renderer/src/components/CampaignCard.tsx` (modify) | component | request-response | `src/renderer/src/components/CampaignCard.tsx` (existing) | exact |
| `src/renderer/src/components/wizard/StepRace.tsx` (new) | component | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | role-match |
| `src/renderer/src/components/wizard/StepClass.tsx` (new) | component | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | role-match |
| `src/renderer/src/components/wizard/StepAbilityScores.tsx` (new) | component | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | role-match |
| `src/renderer/src/components/wizard/StepBackground.tsx` (new) | component | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | role-match |
| `src/renderer/src/components/wizard/StepEquipment.tsx` (new) | component | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | role-match |
| `src/renderer/src/components/wizard/StepReview.tsx` (new) | component | request-response | `src/renderer/src/components/CreateCampaignModal.tsx` | role-match |
| `src/renderer/src/components/wizard/WizardProgress.tsx` (new) | component | transform | — | no-analog |
| `src/renderer/src/components/sheet/SheetHeader.tsx` (new) | component | request-response | `src/renderer/src/components/CampaignCard.tsx` | role-match |
| `src/renderer/src/components/sheet/AbilityScoresSection.tsx` (new) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/SavingThrowsSection.tsx` (new) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/SkillsSection.tsx` (new) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/CombatStatsSection.tsx` (new) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/ResourcesSection.tsx` (new) | component | CRUD | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/CurrencySection.tsx` (new) | component | CRUD | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/EquipmentSection.tsx` (new) | component | CRUD | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/ProficienciesSection.tsx` (new) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/TraitsSection.tsx` (new) | component | request-response | `src/renderer/src/screens/CampaignViewScreen.tsx` | partial-match |
| `src/renderer/src/components/sheet/Stepper.tsx` (new) | component | event-driven | — | no-analog |
| `src/renderer/src/components/sheet/ProficiencyDot.tsx` (new) | component | transform | — | no-analog |
| `src/renderer/src/components/sheet/ConditionBadge.tsx` (new) | component | event-driven | — | no-analog |
| `src/renderer/src/components/sheet/SpellSlotPips.tsx` (new) | component | event-driven | — | no-analog |
| `src/renderer/src/components/sheet/PortraitSlot.tsx` (new) | component | event-driven | `src/renderer/src/components/CampaignCard.tsx` | role-match |
| `src/renderer/src/stores/characterStore.ts` (new) | store | event-driven | `src/renderer/src/stores/panelSizeStore.ts` | exact |

---

## Pattern Assignments

### `src/main/db/schema.ts` (model, CRUD — modify)

**Analog:** `src/main/db/schema.ts` (existing)

**Imports pattern** (lines 1–3):
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
```

For Phase 2, expand the import to include `real` and `unique`:
```typescript
import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
```

**Core table definition pattern** (lines 4–13):
```typescript
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
```

**Pattern rules to copy:**
- `integer('col', { mode: 'timestamp_ms' })` for all timestamp columns
- `sql\`(unixepoch() * 1000)\`` as the default expression
- Export `type X = typeof table.$inferSelect` and `type NewX = typeof table.$inferInsert` for every table
- Add `coverImagePath: text('cover_image_path')` to the existing `campaigns` table (nullable — no `.notNull()`)
- For the `characters` table unique constraint use: `(table) => ({ uniqueCampaign: unique().on(table.campaignId) })`
- JSON array columns use `text('col').notNull().default('[]')` — Drizzle has no native JSON type for SQLite
- Boolean columns use `integer('col', { mode: 'boolean' }).notNull().default(false)`
- Foreign keys: `.references(() => campaigns.id, { onDelete: 'cascade' })`

---

### `src/main/db/charactersRepo.ts` (service, CRUD — new)

**Analog:** `src/main/db/campaignsRepo.ts`

**Imports pattern** (lines 1–5):
```typescript
import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { campaigns } from './schema'
import type { Campaign } from './schema'
```

For `charactersRepo.ts`, extend to:
```typescript
import { eq, asc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from './index'
import { characters, characterResources, characterItems } from './schema'
import type { Character, CharacterResources, CharacterItem } from './schema'
```

**Core CRUD pattern** (lines 7–38):
```typescript
export const campaignsRepo = {
  list(): Campaign[] {
    const db = getDb()
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).all()
  },

  create({ name }: { name: string }): Campaign {
    const db = getDb()
    const id = randomUUID()
    const now = Date.now()

    db.insert(campaigns)
      .values({ id, name, createdAt: new Date(now) })
      .run()

    const created = db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .get()

    if (!created) {
      throw new Error('Failed to create campaign')
    }

    return created
  },

  get(id: string): Campaign | undefined {
    const db = getDb()
    return db.select().from(campaigns).where(eq(campaigns.id, id)).get()
  },
}
```

**Transaction pattern** — better-sqlite3 transactions are SYNCHRONOUS. Copy this structure exactly:
```typescript
// The outer function is synchronous — no async/await
createWithResources(input: CreateCharacterInput): CharacterWithResources {
  const db = getDb()
  const charId = randomUUID()
  const resId = randomUUID()

  // db.transaction() takes a synchronous callback — NEVER use async (tx) => here
  db.transaction((tx) => {
    tx.insert(characters).values({ id: charId, ... }).run()
    tx.insert(characterResources).values({ id: resId, characterId: charId, ... }).run()
    for (const item of input.startingItems) {
      tx.insert(characterItems).values({ id: randomUUID(), characterId: charId, ...item }).run()
    }
  })

  return this.getWithResources(charId)!
},
```

**Error pattern** (lines 27–31):
```typescript
if (!created) {
  throw new Error('Failed to create campaign')
}
```
Apply same null-guard after every `db.select().get()` that is expected to exist.

**JSON column parse rule:** Parse JSON text columns before returning from repo — renderer never receives a raw JSON string:
```typescript
// In getWithResources(), parse all JSON columns:
return {
  ...char,
  savingThrowProficiencies: JSON.parse(char.savingThrowProficiencies) as string[],
  skillProficiencies: JSON.parse(char.skillProficiencies) as string[],
  skillExpertise: JSON.parse(char.skillExpertise) as string[],
  languages: JSON.parse(char.languages) as string[],
  toolProficiencies: JSON.parse(char.toolProficiencies) as string[],
  armorProficiencies: JSON.parse(char.armorProficiencies) as string[],
  weaponProficiencies: JSON.parse(char.weaponProficiencies) as string[],
  resources: {
    ...res,
    conditions: JSON.parse(res.conditions) as string[],
    spellSlots: JSON.parse(res.spellSlots) as SpellSlotMap,
  },
  items,
}
```

---

### `src/main/db/contentLoader.ts` (utility, file-I/O — new)

**Analog:** `src/main/db/migrate.ts`

**Path resolution pattern** (lines 26–29 of migrate.ts):
```typescript
const migrationsFolder = app.isPackaged
  ? path.join(process.resourcesPath, 'migrations')
  : path.join(__dirname, '../../resources/migrations')
```

Apply the same two-branch pattern for content JSON:
```typescript
function resourcesPath(): string {
  return app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '../../resources')
}
```

**Imports pattern** (lines 1–8 of migrate.ts):
```typescript
import { app } from 'electron'
import path from 'node:path'
import log from 'electron-log'
```

For contentLoader.ts, extend to:
```typescript
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'
```

**Error handling pattern** (lines 32–40 of migrate.ts):
```typescript
try {
  migrate(db, { migrationsFolder })
  log.info('[db] Migrations complete')
} catch (err) {
  log.error('[db] Migration failed — cannot continue with a partial schema:', err)
  throw err
}
```

Apply same try/catch + `log.error` + rethrow pattern in `loadContent()` for file read failures.

---

### `src/main/trpc/routers/characters.ts` (route, request-response — new)

**Analog:** `src/main/trpc/routers/campaigns.ts`

**Full file pattern** (lines 1–22):
```typescript
import { z } from 'zod'
import { t } from '../_base'
import { campaignsRepo } from '../../db/campaignsRepo'
import { campaignNameSchema, campaignIdSchema } from '../schemas'

export const campaignsRouter = t.router({
  list: t.procedure.query(() => {
    return campaignsRepo.list()
  }),

  create: t.procedure
    .input(z.object({ name: campaignNameSchema }))
    .mutation(({ input }) => {
      return campaignsRepo.create({ name: input.name })
    }),

  get: t.procedure
    .input(z.object({ id: campaignIdSchema }))
    .query(({ input }) => {
      return campaignsRepo.get(input.id)
    }),
})
```

For characters.ts:
- Import from `'../../db/charactersRepo'` and `'../../characters/calculations'`
- Use `t.procedure.input(z.object({...})).query(...)` for reads
- Use `t.procedure.input(z.object({...})).mutation(...)` for writes
- Shared Zod schemas go in `src/main/trpc/schemas.ts` alongside `campaignIdSchema`
- Delta-based HP mutation input: `z.object({ campaignId: campaignIdSchema, delta: z.number().int().min(-9999).max(9999) })`
- Character name: `z.string().trim().min(1).max(100)`
- Backstory: `z.string().max(2000)`
- Ability score: `z.number().int().min(1).max(30)`

---

### `src/main/trpc/routers/content.ts` (route, request-response — new)

**Analog:** `src/main/trpc/routers/prefs.ts`

**Nested router pattern** (lines 31–53 of prefs.ts):
```typescript
export const prefsRouter = t.router({
  panelSize: t.router({
    get: t.procedure
      .input(z.object({ campaignId: z.string().uuid() }))
      .query(({ input }) => {
        return store.get(input.campaignId) ?? { leftSize: 60, rightSize: 40 }
      }),

    set: t.procedure
      .input(panelSizeSchema)
      .mutation(({ input }) => {
        store.set(input.campaignId, { leftSize: input.leftSize, rightSize: input.rightSize })
      }),
  }),
})
```

For content.ts, use nested routers per content type (`t.router({ races: t.router({...}), classes: t.router({...}) })`). All procedures are `.query()` — no mutations. Input validated with Zod inline where needed (e.g., `z.object({ className: z.string() })`).

---

### `src/main/trpc/router.ts` (config, request-response — modify)

**Analog:** `src/main/trpc/router.ts` (existing, lines 1–14)

**Full file pattern:**
```typescript
import { t } from './_base'
import { campaignsRouter } from './routers/campaigns'
import { prefsRouter } from './routers/prefs'
import { secretsRouter } from './routers/secrets'
import { windowRouter } from './routers/window'

export const router = t.router({
  campaigns: campaignsRouter,
  prefs: prefsRouter,
  secrets: secretsRouter,
  window: windowRouter,
})

export type AppRouter = typeof router
```

Add two new lines to the import block and two new keys to `t.router({})`:
```typescript
import { charactersRouter } from './routers/characters'
import { contentRouter } from './routers/content'

export const router = t.router({
  campaigns: campaignsRouter,
  characters: charactersRouter,   // ADD
  content: contentRouter,         // ADD
  prefs: prefsRouter,
  secrets: secretsRouter,
  window: windowRouter,
})
```

---

### `src/main/imageService.ts` (service, file-I/O — new)

**Analog:** `src/main/db/migrate.ts` (partial — only the path resolution and electron import patterns apply)

**Electron import pattern** (line 1–2 of migrate.ts):
```typescript
import { app } from 'electron'
import path from 'node:path'
```

For imageService.ts:
```typescript
import { app, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import log from 'electron-log'
```

**userData path pattern** (from db/index.ts lines 13–14):
```typescript
const userData = app.getPath('userData')
const dbPath = path.join(userData, 'solocampaign.db')
```

Apply same pattern for images:
```typescript
const destDir = path.join(app.getPath('userData'), 'images', campaignId)
```

**No codebase analog for jimp.** Follow RESEARCH.md Pattern 4 exactly for the jimp resize logic and the `@jimp/wasm-webp` dynamic import approach. Return value is a relative path string (e.g., `images/{campaignId}/{filename}`) stored in DB. Image is served back to renderer as base64 data URL via a separate tRPC query — never as a `file://` path.

---

### `src/main/characters/calculations.ts` (utility, transform — new)

**No direct analog** — pure math functions, no DB or IPC involvement.

**Pattern:** Export named pure functions. No class, no state, no imports from electron or drizzle. Follow RESEARCH.md Pattern 7 exactly:
```typescript
export function calcAbilityModifier(score: number): number { ... }
export function calcHP(hitDie: number, constitutionScore: number): number { ... }
export function calcAC(dexterityScore: number, armorBase?: number): number { ... }
export function buildSpellSlots(className, level, spellSlotsByClass): Record<...> { ... }
```

These are called inside the `characters.create` tRPC mutation handler — before the `db.transaction()` call.

---

### `resources/migrations/0001_characters.sql` (migration — new)

**Analog:** `resources/migrations/0000_absent_thunderball.sql`

**Full DDL pattern:**
```sql
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
```

**Rules to copy:**
- Backtick-quoted table and column names
- `integer DEFAULT (unixepoch() * 1000)` for timestamp columns (no `NOT NULL` on the DEFAULT line — it follows separately)
- `text` for all string/JSON columns
- `integer` for booleans and timestamps
- `real` for decimal numbers (item weight)
- Foreign key syntax: `REFERENCES \`parent_table\`(\`id\`) ON DELETE CASCADE`
- Unique constraint syntax: `UNIQUE(\`campaign_id\`)`
- This file is generated by `npm run db:generate` — do NOT hand-author the journal. Run the generate command after updating schema.ts.

---

### `src/renderer/src/screens/CampaignViewScreen.tsx` (component — modify)

**Analog:** `src/renderer/src/screens/CampaignViewScreen.tsx` (existing)

**Integration point** (lines 137–144):
```typescript
<TabsContent value="character-sheet" className="flex-1 overflow-auto p-6">
  <div className="flex flex-col items-center max-w-[400px] mx-auto" style={{ paddingTop: '30%' }}>
    <h2 className="text-xl font-semibold text-foreground mb-2">Character Sheet</h2>
    <p className="text-sm text-muted-foreground text-center">
      Your character sheet will appear here after character creation (Phase 2).
    </p>
  </div>
</TabsContent>
```

Replace the inner `<div>` content with `<CharacterSheetTab campaignId={id} />`. Keep the `TabsContent` wrapper and its className unchanged.

**Query pattern** (lines 16–20):
```typescript
const campaignQuery = useQuery({
  queryKey: ['campaigns', 'get', id],
  queryFn: () => trpc.campaigns.get.query({ id: id! }),
  enabled: !!id,
})
```

All tRPC query calls in the renderer follow this exact shape. Character sheet query:
```typescript
const characterQuery = useQuery({
  queryKey: ['characters', 'getByCampaignId', campaignId],
  queryFn: () => trpc.characters.getByCampaignId.query({ campaignId: campaignId! }),
  enabled: !!campaignId,
})
```

**Loading/error guard pattern** (lines 65–79):
```typescript
if (campaignQuery.isLoading || !store.isLoaded) {
  return (
    <div className="flex items-center justify-center h-full bg-background">
      <p className="text-muted-foreground">Loading campaign...</p>
    </div>
  )
}

if (!campaignQuery.data) {
  return (
    <div className="flex items-center justify-center h-full bg-background">
      <p className="text-muted-foreground">Campaign not found.</p>
    </div>
  )
}
```

Apply same loading/null guard pattern in `CharacterSheetTab.tsx`.

---

### `src/renderer/src/components/CharacterSheetTab.tsx` (component, request-response — new)

**Analog:** `src/renderer/src/screens/CampaignViewScreen.tsx`

This is the orchestrator component that:
1. Runs `useQuery(trpc.characters.getByCampaignId)` with `campaignId` prop
2. If data is `null` → renders `<CreateCharacterWizard>` (auto-launched per D-04)
3. If data exists → renders the full sheet section components

**Imports pattern** — copy from CampaignViewScreen.tsx lines 1–8:
```typescript
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
```

**Null → wizard branch:**
```typescript
if (!characterQuery.data) {
  return <CreateCharacterWizard campaignId={campaignId} onCreated={() => characterQuery.refetch()} />
}
```

No dismiss/close prop on the wizard — per D-04 it cannot be dismissed (cancel navigates away).

---

### `src/renderer/src/components/CreateCharacterWizard.tsx` (component, request-response — new)

**Analog:** `src/renderer/src/components/CreateCampaignModal.tsx`

**Full imports pattern** (lines 1–14):
```typescript
import React, { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
```

**State management pattern** (lines 22–26):
```typescript
const [name, setName] = useState('')
const [error, setError] = useState<string | null>(null)
```

For wizard, extend to:
```typescript
const [step, setStep] = useState(0)
const [wizardState, setWizardState] = useState<WizardState>(initialWizardState)
const [error, setError] = useState<string | null>(null)
```

**useMutation pattern** (lines 26–37):
```typescript
const createMutation = useMutation({
  mutationFn: (data: { name: string }) => trpc.campaigns.create.mutate(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
    setName('')
    setError(null)
    onClose()
  },
  onError: () => {
    setError("Couldn't create the campaign. ...")
  },
})
```

**Validation pattern** (lines 51–52):
```typescript
const trimmedName = name.trim()
const isValid = trimmedName.length >= 1 && trimmedName.length <= 80
```

Per D-14, each wizard step exposes its own `isValid` derived boolean. Next button is `disabled={!isStepValid || createMutation.isPending}`.

**Dialog wrapper pattern** (lines 67–68):
```typescript
<Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
  <DialogContent className="sm:max-w-[425px]">
```

Wizard needs wider content: `className="sm:max-w-[700px]"`.

**Error display pattern** (lines 90–92):
```typescript
{error && (
  <p className="text-sm text-destructive">{error}</p>
)}
```

**Footer navigation pattern** (lines 96–112):
```typescript
<DialogFooter>
  <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
    Cancel
  </Button>
  <Button type="submit" disabled={!isValid || createMutation.isPending}>
    {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
  </Button>
</DialogFooter>
```

For wizard, replace Cancel with Back (when step > 0), and Create with Next / Confirm on final step.

---

### `src/renderer/src/components/CampaignCard.tsx` (component — modify)

**Analog:** `src/renderer/src/components/CampaignCard.tsx` (existing)

**Cover image slot** (lines 29–36):
```typescript
{/* Cover image slot */}
<div className="w-full h-40 overflow-hidden bg-muted">
  <img
    src="/placeholder-cover.svg"
    alt=""
    className="w-full h-full object-cover"
  />
</div>
```

Replace `src="/placeholder-cover.svg"` with a conditional: use the base64 data URL from `campaigns.getCoverDataUrl` query when available, fall back to placeholder. Add a click handler on the cover area (or an overlay button) to trigger `campaigns.importCoverImage` mutation.

**Import pattern** (lines 1–7):
```typescript
import React from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { Campaign } from '../../../main/db/schema'
```

Add `useMutation, useQuery, useQueryClient` from `@tanstack/react-query` and `trpc` from `'../lib/trpc'`.

---

### Wizard Step Components (StepRace, StepClass, StepAbilityScores, StepBackground, StepEquipment, StepReview)

**Analog:** `src/renderer/src/components/CreateCampaignModal.tsx`

All step components share these patterns:

**Props interface pattern:**
```typescript
interface StepRaceProps {
  value: Race | null
  characterName: string
  onRaceChange: (race: Race | null) => void
  onNameChange: (name: string) => void
}
```

**Content query pattern** — inside each step, use `useQuery` from the wizard's parent (or pass data as props from `CreateCharacterWizard`). Prefer passing content data as props to avoid redundant queries — the wizard fetches content once on mount.

**Validation export pattern:**
```typescript
// Step exposes isValid so the wizard can enable/disable Next
export function isStepRaceValid(state: Pick<WizardState, 'selectedRace' | 'characterName'>): boolean {
  return state.selectedRace !== null && state.characterName.trim().length >= 1
}
```

**Label + Input pattern** (lines 75–88 of CreateCampaignModal.tsx):
```typescript
<div className="grid gap-2">
  <Label htmlFor="campaign-name">Campaign name</Label>
  <Input
    id="campaign-name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="e.g. The Lost Mines of Phandelver"
    maxLength={80}
    disabled={createMutation.isPending}
  />
</div>
```

---

### `src/renderer/src/stores/characterStore.ts` (store, event-driven — new)

**Analog:** `src/renderer/src/stores/panelSizeStore.ts`

**Full file pattern** (lines 1–43):
```typescript
import { create } from 'zustand'
import { trpc } from '../lib/trpc'

interface PanelSizeState {
  sizes: { leftSize: number; rightSize: number }
  isLoaded: boolean
  load: (campaignId: string) => Promise<void>
  save: (campaignId: string, leftSize: number, rightSize: number) => Promise<void>
  setLocalSizes: (leftSize: number, rightSize: number) => void
}

export const usePanelSizeStore = create<PanelSizeState>()((set) => ({
  sizes: { leftSize: 60, rightSize: 40 },
  isLoaded: false,

  load: async (campaignId: string) => {
    const saved = await trpc.prefs.panelSize.get.query({ campaignId })
    set({ sizes: saved, isLoaded: true })
  },

  save: async (campaignId: string, leftSize: number, rightSize: number) => {
    set({ sizes: { leftSize, rightSize } })
    await trpc.prefs.panelSize.set.mutate({ campaignId, leftSize, rightSize })
  },

  setLocalSizes: (leftSize: number, rightSize: number) => {
    set({ sizes: { leftSize, rightSize } })
  },
}))
```

For `characterStore.ts`, hold **wizard draft state** (the in-progress form before confirmation) and any optimistic UI state that lives outside TanStack Query (e.g., pending ability score edits):

```typescript
import { create } from 'zustand'

interface CharacterStoreState {
  // Wizard draft (cleared on close or confirm)
  wizardDraft: WizardState | null
  setWizardDraft: (draft: WizardState | null) => void
  updateWizardStep: (partial: Partial<WizardState>) => void
}

export const useCharacterStore = create<CharacterStoreState>()((set) => ({
  wizardDraft: null,
  setWizardDraft: (draft) => set({ wizardDraft: draft }),
  updateWizardStep: (partial) =>
    set((s) => ({ wizardDraft: s.wizardDraft ? { ...s.wizardDraft, ...partial } : null })),
}))
```

Note: Live-resource mutations (HP, conditions, currency) use TanStack Query optimistic updates — they do NOT go through Zustand. Only wizard draft state and any persistent UI state (e.g., collapsed sections) belong in the store.

---

### Test Files (calculations.test.ts, charactersRepo.test.ts, characters router test, imageService.test.ts, contentLoader.test.ts)

**Analog:** `src/main/trpc/routers/secrets.test.ts`

**Full test file structure** (lines 1–25):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Must be set before electron mock closes over it
let testDir = ''

// Mock electron before any imports
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
  },
  ...
}))
```

**tRPC v10 caller pattern** (lines 43–64):
```typescript
async function makeRouter() {
  vi.resetModules()
  // ... build the router ...
  // tRPC v10 API: router.createCaller(ctx) — NOT createCallerFactory (that's v11)
  return theRouter.createCaller({})
}
```

**Temp directory cleanup pattern** (lines 22–31):
```typescript
beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'solocampaign-trpc-test-'))
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
  vi.resetModules()
})
```

**Assertion patterns** (lines 66–87):
```typescript
it('returns false for an unknown key', async () => {
  const caller = await makeRouter()
  const result = await caller.exists({ key: 'test-key' })
  expect(result).toBe(false)
})

it('rejects invalid input (Zod validation)', async () => {
  const caller = await makeRouter()
  await expect(caller.set({ key: '', value: '' })).rejects.toThrow()
})
```

For `calculations.test.ts` — no electron mock needed (pure functions):
```typescript
import { describe, it, expect } from 'vitest'
import { calcHP, calcAC, calcAbilityModifier, buildSpellSlots } from '../calculations'

describe('calcHP', () => {
  it('returns hit die + CON modifier', () => {
    expect(calcHP(10, 16)).toBe(13) // d10 + 3 (CON 16 = +3)
  })
})
```

For `charactersRepo.test.ts` — needs a real in-memory SQLite:
```typescript
// Use better-sqlite3 in-memory DB, apply migrations from resources/migrations/
// vi.mock('electron') to point app.getPath to tmpdir
// vi.mock('./index', ...) to inject in-memory db instance
```

---

## Shared Patterns

### tRPC `t` Instance
**Source:** `src/main/trpc/_base.ts` (lines 1–10)
**Apply to:** All new router files (`characters.ts`, `content.ts`)
```typescript
import { t } from '../_base'
```
Always import `t` from `../_base`, never call `initTRPC` again in a router file.

### Zod Input Validation
**Source:** `src/main/trpc/schemas.ts` + inline in `prefs.ts`
**Apply to:** All new tRPC procedures — every `.input()` call must have a Zod schema

Shared schemas to add to `src/main/trpc/schemas.ts`:
```typescript
export const campaignIdSchema = z.string().uuid()  // already exists
export const characterNameSchema = z.string().trim().min(1).max(100)
export const backstorySchema = z.string().max(2000)
export const abilityScoreSchema = z.number().int().min(1).max(30)
export const hpDeltaSchema = z.number().int().min(-9999).max(9999)
```

### TanStack Query Key Convention
**Source:** `src/renderer/src/screens/CampaignViewScreen.tsx` (line 17) + `src/renderer/src/components/CreateCampaignModal.tsx` (line 29)
**Apply to:** All renderer query and mutation calls

Convention: `[routerName, procedureName, ...args]`
```typescript
// Query
queryKey: ['campaigns', 'get', id]
// Invalidation
queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
```

For characters:
```typescript
queryKey: ['characters', 'getByCampaignId', campaignId]
queryKey: ['characters', 'getPortraitDataUrl', characterId]
```

### Error Display
**Source:** `src/renderer/src/components/CreateCampaignModal.tsx` (lines 34–36, 90–92)
**Apply to:** All modal/wizard components
```typescript
onError: () => {
  setError("Human-readable message. ...")
},
// ...
{error && (
  <p className="text-sm text-destructive">{error}</p>
)}
```

### Loading / Not-Found Guards
**Source:** `src/renderer/src/screens/CampaignViewScreen.tsx` (lines 65–79)
**Apply to:** `CharacterSheetTab.tsx` and any component that depends on async data
```typescript
if (query.isLoading) {
  return <div className="flex items-center justify-center h-full bg-background">
    <p className="text-muted-foreground">Loading...</p>
  </div>
}
if (!query.data) {
  return <div className="flex items-center justify-center h-full bg-background">
    <p className="text-muted-foreground">Not found.</p>
  </div>
}
```

### Button Disabled While Pending
**Source:** `src/renderer/src/components/CreateCampaignModal.tsx` (lines 103–111)
**Apply to:** All form submit buttons and wizard navigation buttons
```typescript
<Button type="submit" disabled={!isValid || mutation.isPending}>
  {mutation.isPending ? 'Saving...' : 'Save'}
</Button>
```

### electron-log in Main Process
**Source:** `src/main/db/migrate.ts` (lines 1, 10, 34–39)
**Apply to:** `imageService.ts`, `contentLoader.ts`, `charactersRepo.ts`
```typescript
import log from 'electron-log'
// ...
log.info('[characters] ...')
log.error('[characters] ...', err)
```

Prefix every log message with `[moduleName]` for grep-ability.

### Optimistic Mutation (zero-debounce resource updates)
**No direct codebase analog** — follow RESEARCH.md Pattern 5 exactly.
**Apply to:** `ResourcesSection.tsx`, `CurrencySection.tsx`, `EquipmentSection.tsx` (attunement toggle)

Key points:
- `onMutate`: `cancelQueries` + `setQueryData` with optimistic value
- `onError`: roll back with `setQueryData(context.prev)`
- `onSettled`: `invalidateQueries` to sync with DB
- Use delta-based mutations (`delta: +1 / -1`) not absolute value (`SET hp = 14`)

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md schemas/patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `resources/races.json` | config | file-I/O | No JSON data files exist yet; schema defined in RESEARCH.md |
| `resources/classes.json` | config | file-I/O | Same |
| `resources/backgrounds.json` | config | file-I/O | Same |
| `resources/equipment.json` | config | file-I/O | Same |
| `resources/spells-by-class.json` | config | file-I/O | Same |
| `src/renderer/src/components/wizard/WizardProgress.tsx` | component | transform | Step indicator UI — no multi-step progress component exists; design from scratch using Tailwind |
| `src/renderer/src/components/sheet/Stepper.tsx` | component | event-driven | No +/- stepper control exists; pure presentational component with `onIncrement`/`onDecrement` props |
| `src/renderer/src/components/sheet/ProficiencyDot.tsx` | component | transform | No dot/pip visual exists; tiny SVG or div with filled/empty variants |
| `src/renderer/src/components/sheet/ConditionBadge.tsx` | component | event-driven | No badge toggle component exists; use shadcn `Badge` variant as base |
| `src/renderer/src/components/sheet/SpellSlotPips.tsx` | component | event-driven | No pip-row component exists; render N circles, click toggles used/unused |

---

## Metadata

**Analog search scope:** `src/main/db/`, `src/main/trpc/`, `src/renderer/src/components/`, `src/renderer/src/screens/`, `src/renderer/src/stores/`, `resources/migrations/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-24
