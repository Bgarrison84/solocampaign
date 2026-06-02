import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Swords, ChevronDown } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { useCombatStore } from '../stores/combatStore'
import type { Combatant } from '../../../main/db/schema'
import { Stepper } from './sheet/Stepper'
import { ConditionBadge } from './sheet/ConditionBadge'
import { ALL_CONDITIONS, type ConditionName } from './sheet/sheetHelpers'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible'
import { ScrollArea } from './ui/scroll-area'
import { Progress } from './ui/progress'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { cn } from '../lib/utils'

interface CombatTrackerTabProps {
  campaignId: string
}

/**
 * Combat Tracker tab (COMB-02, COMB-04 manual half).
 *
 * Two states (UI-SPEC §S2):
 * - S2a Empty state: rendered when no combat is active OR there are no combatants.
 * - S2b Initiative list: one Collapsible row per active combatant (asc initiativeOrder),
 *   each expandable to an HP stepper + condition picker; plus an Add Combatant form.
 *
 * Reads useCombatStore.isCombatActive to (a) branch empty vs list and (b) poll listActive
 * every 2s during combat (PATTERNS.md). All mutations use the optimistic onMutate/onError/
 * onSettled triple (ResourcesSection.tsx pattern).
 */
export function CombatTrackerTab({ campaignId }: CombatTrackerTabProps) {
  const queryClient = useQueryClient()
  const isCombatActive = useCombatStore((s) => s.isCombatActive)
  const currentTurnOrder = useCombatStore((s) => s.currentTurnOrder)

  const QUERY_KEY = ['combat', 'listActive', campaignId] as const

  const combatantsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => trpc.combat.listActive.query({ campaignId }),
    enabled: !!campaignId,
    refetchInterval: isCombatActive ? 2000 : false,
  })

  const combatants = combatantsQuery.data ?? []

  // ─── HP mutation (optimistic) ────────────────────────────────────────────
  const updateHpMutation = useMutation({
    mutationFn: (vars: { combatantId: string; hpCurrent: number }) =>
      trpc.combat.updateHp.mutate(vars),
    onMutate: async ({ combatantId, hpCurrent }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<Combatant[]>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData<Combatant[]>(
          QUERY_KEY,
          prev.map((c) => (c.id === combatantId ? { ...c, hpCurrent } : c)),
        )
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ─── Conditions mutation (optimistic) ────────────────────────────────────
  const updateConditionsMutation = useMutation({
    mutationFn: (vars: { combatantId: string; conditions: string[] }) =>
      trpc.combat.updateConditions.mutate(vars),
    onMutate: async ({ combatantId, conditions }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<Combatant[]>(QUERY_KEY)
      if (prev) {
        queryClient.setQueryData<Combatant[]>(
          QUERY_KEY,
          prev.map((c) =>
            c.id === combatantId ? { ...c, conditions: JSON.stringify(conditions) } : c,
          ),
        )
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(QUERY_KEY, context.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ─── Add combatant mutation (no optimistic — id comes from server) ────────
  const addCombatantMutation = useMutation({
    mutationFn: (vars: {
      campaignId: string
      name: string
      hpMax: number
      ac: number
      initiative: number
      initiativeOrder: number
    }) => trpc.combat.addCombatant.mutate(vars),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ─── Add Combatant form state ────────────────────────────────────────────
  const [addName, setAddName] = useState('')
  const [addHp, setAddHp] = useState('')
  const [addAc, setAddAc] = useState('')
  const [addInit, setAddInit] = useState('')

  function handleAdd() {
    const name = addName.trim()
    const hpMax = parseInt(addHp, 10)
    if (!name || !Number.isFinite(hpMax) || hpMax < 1) return
    const ac = parseInt(addAc, 10)
    const initiative = parseInt(addInit, 10)
    const safeAc = Number.isFinite(ac) && ac >= 1 ? ac : 10
    const safeInit = Number.isFinite(initiative) ? initiative : 0
    addCombatantMutation.mutate({
      campaignId,
      name,
      hpMax,
      ac: safeAc,
      initiative: safeInit,
      // use initiative as initiativeOrder so manual rows sort by their roll
      initiativeOrder: safeInit,
    })
    setAddName('')
    setAddHp('')
    setAddAc('')
    setAddInit('')
  }

  // ─── Empty state (S2a) ───────────────────────────────────────────────────
  if (!isCombatActive || combatants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
        <Swords className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-semibold text-muted-foreground">No active combat</p>
        <p className="text-sm text-muted-foreground/70">
          Click "Start Combat" in the header to begin tracking initiative and HP.
        </p>
      </div>
    )
  }

  // ─── Combat active list (S2b) ────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 p-3">
        <div className="flex flex-col gap-2">
          {combatants.map((c) => (
            <CombatantRow
              key={c.id}
              combatant={c}
              isActiveTurn={c.initiativeOrder === currentTurnOrder}
              onHpChange={(delta) =>
                updateHpMutation.mutate({
                  combatantId: c.id,
                  hpCurrent: clamp(c.hpCurrent + delta, 0, c.hpMax),
                })
              }
              onToggleCondition={(condition, parsed) =>
                updateConditionsMutation.mutate({
                  combatantId: c.id,
                  conditions: toggle(parsed, condition),
                })
              }
            />
          ))}

          {/* Add Combatant form */}
          <div className="bg-secondary border border-border rounded-lg p-3 mt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Add Combatant
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <Label className="text-xs" htmlFor="add-name">
                  Name
                </Label>
                <Input
                  id="add-name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Goblin"
                  className="h-8 w-32 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs" htmlFor="add-hp">
                  Max HP
                </Label>
                <Input
                  id="add-hp"
                  type="number"
                  min={1}
                  value={addHp}
                  onChange={(e) => setAddHp(e.target.value)}
                  className="h-8 w-16 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs" htmlFor="add-ac">
                  AC
                </Label>
                <Input
                  id="add-ac"
                  type="number"
                  min={1}
                  value={addAc}
                  onChange={(e) => setAddAc(e.target.value)}
                  className="h-8 w-14 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs" htmlFor="add-init">
                  Initiative
                </Label>
                <Input
                  id="add-init"
                  type="number"
                  value={addInit}
                  onChange={(e) => setAddInit(e.target.value)}
                  className="h-8 w-16 text-sm"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 self-end"
                onClick={handleAdd}
                disabled={addCombatantMutation.isPending}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Combatant row ──────────────────────────────────────────────────────────

interface CombatantRowProps {
  combatant: Combatant
  isActiveTurn: boolean
  onHpChange: (delta: number) => void
  onToggleCondition: (condition: ConditionName, parsed: string[]) => void
}

function CombatantRow({
  combatant,
  isActiveTurn,
  onHpChange,
  onToggleCondition,
}: CombatantRowProps) {
  const parsed = parseConditions(combatant.conditions)
  const hpPercent = combatant.hpMax > 0 ? Math.round((combatant.hpCurrent / combatant.hpMax) * 100) : 0

  const rowClassName = isActiveTurn
    ? 'bg-primary/10 border border-primary/40 rounded-lg cursor-pointer transition-colors'
    : combatant.isPlayer
      ? 'bg-card border border-border border-l-2 border-l-primary/60 rounded-lg cursor-pointer hover:bg-secondary transition-colors'
      : 'bg-card border border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors'

  return (
    <Collapsible className={rowClassName}>
      <CollapsibleTrigger asChild>
        <div
          className="px-3 py-2 flex items-center gap-3 w-full"
          role="button"
          tabIndex={0}
          aria-label={`${combatant.name} — view details`}
        >
          {/* Initiative order */}
          <span className="text-sm font-semibold text-muted-foreground w-5 text-right shrink-0">
            {combatant.initiativeOrder}
          </span>

          {/* Active-turn pulse dot (or invisible spacer) */}
          {isActiveTurn ? (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          ) : (
            <div className="w-2 h-2 shrink-0" />
          )}

          {/* Name */}
          <span
            className={cn(
              'text-sm text-foreground flex-1 truncate',
              combatant.isPlayer ? 'font-semibold' : 'font-normal',
            )}
          >
            {combatant.name}
          </span>

          {/* Condition badges (first ≤ 2) */}
          {parsed.length > 0 && (
            <div className="flex gap-1">
              {parsed.slice(0, 2).map((cond) => (
                <Badge key={cond} variant="outline" className="text-xs px-1 py-0 h-5">
                  {cond}
                </Badge>
              ))}
            </div>
          )}

          {/* HP bar */}
          <div className="w-16 shrink-0">
            <Progress value={hpPercent} className="h-2" indicatorClassName={hpColor(hpPercent)} />
          </div>

          {/* HP text */}
          <span className="text-sm font-semibold text-foreground w-16 text-right shrink-0">
            {combatant.hpCurrent}{' '}
            <span className="text-muted-foreground font-normal">/ {combatant.hpMax}</span>
          </span>

          {/* Chevron */}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 data-[state=open]:rotate-180 shrink-0" />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-border px-4 py-3 bg-secondary flex flex-col gap-3 rounded-b-lg">
          {/* HP stepper row */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground w-8">HP</span>
            <Stepper
              value={combatant.hpCurrent}
              min={0}
              max={combatant.hpMax}
              size="sm"
              label={`Adjust HP for ${combatant.name}`}
              onChange={onHpChange}
            />
            <span className="text-sm text-muted-foreground">/ {combatant.hpMax}</span>
          </div>

          {/* AC display */}
          <span className="text-sm text-muted-foreground">AC {combatant.ac}</span>

          {/* Condition picker */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Conditions
            </span>
            <div
              role="group"
              aria-label={`Conditions for ${combatant.name}`}
              className="flex flex-wrap gap-1"
            >
              {ALL_CONDITIONS.map((condition) => (
                <ConditionBadge
                  key={condition}
                  condition={condition}
                  active={parsed.includes(condition)}
                  onToggle={() => onToggleCondition(condition, parsed)}
                />
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Parse a combatant.conditions JSON string into a string array; default [] on failure (T-05-03-02). */
function parseConditions(json: string): string[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : []
  } catch {
    return []
  }
}

/** Toggle a condition in/out of the list, returning a new array. */
function toggle(list: string[], condition: string): string[] {
  return list.includes(condition) ? list.filter((c) => c !== condition) : [...list, condition]
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Semantic HP-bar fill color by percent (UI-SPEC §S2b): green > 50, amber 25–50, red < 25. */
function hpColor(percent: number): string {
  if (percent > 50) return 'bg-green-700'
  if (percent >= 25) return 'bg-amber-500'
  return 'bg-red-600'
}
