/**
 * CompanionsSection — collapsible section showing all companions for a campaign.
 *
 * Shown below the party switcher chips (even in solo mode, when any companions exist).
 * Each companion row: name, type badge, HP stepper, AC, condition pills, remove with inline confirm.
 * "Add Companion" button opens a Dialog (max-w-[360px]) with Name/Type/HP/AC fields.
 *
 * Companion type stored in characters.subclass (per 07-03 design decision).
 * Type badge colors: Familiar → purple, Animal Companion → green, Summoned Creature → blue.
 *
 * Security: addCompanion tRPC mutation Zod-validates name/type/hpMax/ac server-side (T-07-08-01).
 */
import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Stepper } from './sheet/Stepper'
import { cn } from '../lib/utils'
import type { CharacterWithResources } from '../../../main/db/charactersRepo'

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanionType = 'Familiar' | 'Animal Companion' | 'Summoned Creature'

const COMPANION_TYPES: CompanionType[] = ['Familiar', 'Animal Companion', 'Summoned Creature']

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CompanionsSectionProps {
  campaignId: string
  companions: CharacterWithResources[]
  onUpdateHp: (companionId: string, delta: number) => void
  onRemove: (companionId: string) => void
  /** Called after a companion is successfully added via the dialog (caller should invalidate query). */
  onAdd: () => void
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'Familiar':
      return 'bg-purple-950/60 border-purple-600 text-purple-400'
    case 'Animal Companion':
      return 'bg-green-950/60 border-green-600 text-green-400'
    case 'Summoned Creature':
      return 'bg-blue-950/60 border-blue-600 text-blue-400'
    default:
      return 'bg-secondary border-border text-muted-foreground'
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompanionsSection({
  campaignId,
  companions,
  onUpdateHp,
  onRemove,
  onAdd,
}: CompanionsSectionProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Add companion mutation
  const addCompanionMutation = useMutation({
    mutationFn: (vars: {
      campaignId: string
      name: string
      type: CompanionType
      hpMax: number
      ac: number
    }) => trpc.characters.addCompanion.mutate(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', 'list', campaignId] })
      onAdd()
      setShowAddDialog(false)
    },
  })

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center gap-2 w-full text-sm font-semibold text-foreground py-2 border-b border-border hover:text-muted-foreground transition-colors"
            style={{ minHeight: '40px' }}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            Companions ({companions.length})
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="flex flex-col pt-1 pb-2">
            {companions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">
                No companions yet. The AI can summon familiars, animal companions, and summoned
                creatures, or you can add one manually.
              </p>
            ) : (
              companions.map((companion) => (
                <CompanionRow
                  key={companion.id}
                  companion={companion}
                  onUpdateHp={onUpdateHp}
                  onRemove={onRemove}
                />
              ))
            )}

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Companion
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Add Companion dialog */}
      <AddCompanionDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={(name, type, hpMax, ac) => {
          addCompanionMutation.mutate({ campaignId, name, type, hpMax, ac })
        }}
        isPending={addCompanionMutation.isPending}
      />
    </>
  )
}

// ─── Companion row ────────────────────────────────────────────────────────────

interface CompanionRowProps {
  companion: CharacterWithResources
  onUpdateHp: (companionId: string, delta: number) => void
  onRemove: (companionId: string) => void
}

function CompanionRow({ companion, onUpdateHp, onRemove }: CompanionRowProps) {
  const [confirmRemove, setConfirmRemove] = useState(false)

  // companion type stored in subclass (per 07-03 design decision)
  const companionType = companion.subclass ?? ''
  const hpCurrent = companion.resources.hpCurrent
  const hpMax = companion.resources.hpMax
  const conditions = companion.resources.conditions

  return (
    <div className="flex flex-row items-center gap-3 py-2 border-b border-border last:border-0">
      {/* Name */}
      <span className="text-sm font-semibold text-foreground min-w-0 truncate flex-shrink-0 max-w-[120px]">
        {companion.name}
      </span>

      {/* Type badge */}
      {companionType && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold border shrink-0',
            typeBadgeClass(companionType),
          )}
        >
          {companionType}
        </span>
      )}

      {/* HP stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <Stepper
          value={hpCurrent}
          min={0}
          max={hpMax}
          size="sm"
          label={`${companion.name} HP`}
          onChange={(delta) => onUpdateHp(companion.id, delta)}
        />
        <span className="text-xs text-muted-foreground">/ {hpMax}</span>
      </div>

      {/* AC */}
      <span className="text-sm text-muted-foreground shrink-0">AC: {companion.ac}</span>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {conditions.map((cond) => (
            <span
              key={cond}
              className="rounded-full px-2 py-0.5 text-xs font-semibold border bg-amber-950/60 border-amber-600 text-amber-400"
            >
              {cond}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Remove with inline confirm */}
      {confirmRemove ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground">Remove {companion.name}?</span>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              onRemove(companion.id)
              setConfirmRemove(false)
            }}
          >
            Remove
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setConfirmRemove(false)}
          >
            Keep
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => setConfirmRemove(true)}
          aria-label={`Remove ${companion.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

// ─── Add Companion dialog ─────────────────────────────────────────────────────

interface AddCompanionDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, type: CompanionType, hpMax: number, ac: number) => void
  isPending: boolean
}

function AddCompanionDialog({ open, onClose, onAdd, isPending }: AddCompanionDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<CompanionType>('Familiar')
  const [hpMaxStr, setHpMaxStr] = useState('')
  const [acStr, setAcStr] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleAdd() {
    const hpMax = parseInt(hpMaxStr, 10)
    const ac = parseInt(acStr, 10)

    if (!name.trim() || !Number.isFinite(hpMax) || hpMax < 1 || !Number.isFinite(ac) || ac < 1 || ac > 30) {
      setError('Name, HP, and AC are required.')
      return
    }
    setError(null)
    onAdd(name.trim(), type, hpMax, ac)
  }

  function handleClose() {
    setName('')
    setType('Familiar')
    setHpMaxStr('')
    setAcStr('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Add Companion</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="companion-name">Name</Label>
            <Input
              id="companion-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ember"
              className="h-9"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="companion-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CompanionType)}>
              <SelectTrigger id="companion-type" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* HP Max */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="companion-hp">HP Max</Label>
            <Input
              id="companion-hp"
              type="number"
              min={1}
              value={hpMaxStr}
              onChange={(e) => setHpMaxStr(e.target.value)}
              placeholder="e.g. 18"
              className="h-9"
            />
          </div>

          {/* AC */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="companion-ac">AC</Label>
            <Input
              id="companion-ac"
              type="number"
              min={1}
              max={30}
              value={acStr}
              onChange={(e) => setAcStr(e.target.value)}
              placeholder="e.g. 13"
              className="h-9"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Companion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
