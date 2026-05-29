/**
 * SpellListSection — Spell list in the Character Sheet tab (CHAR-08).
 *
 * Renders only for spellcasters (characters with at least one spell slot level).
 * Spells are grouped by level (0 = Cantrips, 1st, 2nd, …) with per-level slot counts.
 * Each spell row is expandable to show a card with full metadata from listAllSpells.
 * Cast flow:
 *   - Cantrips: click Cast → no deduction, prepend prefix to chat input
 *   - Leveled: slot level picker (available slots only) → castSpell → optimistic deduction → prefix
 * Concentration: if casting a second concentration spell, show ConcentrationWarningDialog.
 *
 * UI-SPEC §S5 / D-23 through D-29.
 */

import React, { useRef, useState } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { trpc } from '../../lib/trpc'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import type { SpellEntry } from '../../../../main/trpc/routers/spells'
import { ordinal } from './sheetHelpers'
import { Button } from '../ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog'
import { cn } from '../../lib/utils'

interface SpellListSectionProps {
  character: CharacterWithResources
  onCastPrefix?: (prefix: string) => void
}

// ─── ConcentrationWarningDialog ───────────────────────────────────────────────

interface ConcentrationWarningDialogProps {
  open: boolean
  existingSpell: string
  newSpell: string
  onKeep: () => void
  onCast: () => void
}

function ConcentrationWarningDialog({
  open,
  existingSpell,
  newSpell,
  onKeep,
  onCast,
}: ConcentrationWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onKeep() }}>
      <DialogContent className="max-w-[360px] border-amber-600/40">
        <DialogHeader>
          <DialogTitle>Drop Concentration?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">
          You are concentrating on {existingSpell}. Casting {newSpell} will end your
          concentration on {existingSpell} and you will lose its effects.
        </p>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onKeep}>
            Keep {existingSpell}
          </Button>
          <Button variant="default" onClick={onCast}>
            Cast {newSpell}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── SpellListSection ─────────────────────────────────────────────────────────

export function SpellListSection({ character, onCastPrefix }: SpellListSectionProps) {
  const queryClient = useQueryClient()
  const CHAR_QUERY_KEY = ['characters', 'getByCampaignId', character.campaignId] as const
  const SPELLS_QUERY_KEY = ['spells', 'listByCharacter', character.id] as const

  // Spellcaster guard — mirror ResourcesSection.tsx
  const isSpellcaster = Object.keys(character.resources.spellSlots).length > 0
  if (!isSpellcaster) return null

  // Track whether we've seeded spells for this character in this session
  const seededRef = useRef(false)

  // ─── Queries ───────────────────────────────────────────────────────────────

  const spellsQuery = useQuery({
    queryKey: SPELLS_QUERY_KEY,
    queryFn: () => trpc.spells.listByCharacter.query({ characterId: character.id }),
  })

  const allSpellsQuery = useQuery({
    queryKey: ['spells', 'listAllSpells'],
    queryFn: () => trpc.spells.listAllSpells.query(),
    staleTime: Infinity, // static content
  })

  // Build name → metadata map for fast lookups
  const spellMetaMap: Record<string, SpellEntry> = {}
  if (allSpellsQuery.data) {
    for (const s of allSpellsQuery.data) {
      spellMetaMap[s.name] = s
    }
  }

  // ─── Seed on first load ────────────────────────────────────────────────────

  const seedMutation = useMutation({
    mutationFn: () =>
      trpc.spells.seedFromJson.mutate({
        characterId: character.id,
        className: character.class,
        campaignId: character.campaignId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SPELLS_QUERY_KEY })
    },
  })

  // Seed once if the list is loaded but empty
  if (
    !seededRef.current &&
    spellsQuery.data &&
    spellsQuery.data.length === 0 &&
    !seedMutation.isPending
  ) {
    seededRef.current = true
    seedMutation.mutate()
  }

  // ─── Optimistic castSpell mutation ────────────────────────────────────────
  // (mirrors ResourcesSection spellSlotMutation pattern — T-05-05-02)

  const castSpellMutation = useMutation({
    mutationFn: (args: { spellName: string; slotLevel: number }) =>
      trpc.spells.castSpell.mutate({
        characterId: character.id,
        spellName: args.spellName,
        slotLevel: args.slotLevel,
        campaignId: character.campaignId,
      }),
    onMutate: async ({ slotLevel }) => {
      if (slotLevel === 0) return { prev: undefined }
      await queryClient.cancelQueries({ queryKey: CHAR_QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(CHAR_QUERY_KEY)
      if (prev) {
        const levelKey = String(slotLevel)
        const slot = prev.resources.spellSlots[levelKey]
        if (slot) {
          queryClient.setQueryData(CHAR_QUERY_KEY, {
            ...prev,
            resources: {
              ...prev.resources,
              spellSlots: {
                ...prev.resources.spellSlots,
                [levelKey]: {
                  ...slot,
                  used: Math.max(0, Math.min(slot.max, slot.used + 1)),
                },
              },
            },
          })
        }
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(CHAR_QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CHAR_QUERY_KEY })
    },
  })

  // ─── Optimistic updateConcentration mutation ──────────────────────────────

  const concentrationMutation = useMutation({
    mutationFn: (spellName: string | null) =>
      trpc.spells.updateConcentration.mutate({
        characterId: character.id,
        spellName,
      }),
    onMutate: async (spellName) => {
      await queryClient.cancelQueries({ queryKey: CHAR_QUERY_KEY })
      const prev = queryClient.getQueryData<CharacterWithResources>(CHAR_QUERY_KEY)
      if (prev) {
        queryClient.setQueryData(CHAR_QUERY_KEY, {
          ...prev,
          resources: {
            ...prev.resources,
            concentratingOn: spellName,
          },
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(CHAR_QUERY_KEY, context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CHAR_QUERY_KEY })
    },
  })

  // ─── Concentration warning dialog state ───────────────────────────────────

  const [concWarning, setConcWarning] = useState<{
    existingSpell: string
    newSpell: string
    level: number
    isConcentration: boolean
  } | null>(null)

  // ─── Expanded spell state ─────────────────────────────────────────────────

  const [expandedSpell, setExpandedSpell] = useState<string | null>(null)

  // ─── Cast handlers ────────────────────────────────────────────────────────

  function handleCastCantrip(name: string) {
    const prefix = `[Casting ${name}] `
    if (onCastPrefix) {
      onCastPrefix(prefix)
    } else {
      window.dispatchEvent(new CustomEvent('campaign:chat-prefix', { detail: prefix }))
    }
  }

  function doCast(spellName: string, level: number, isConcentration: boolean) {
    castSpellMutation.mutate({ spellName, slotLevel: level })
    if (isConcentration) {
      concentrationMutation.mutate(spellName)
    }
    const prefix =
      level > 0
        ? `[Casting ${spellName} — ${ordinal(level)} level slot] `
        : `[Casting ${spellName}] `
    if (onCastPrefix) {
      onCastPrefix(prefix)
    } else {
      window.dispatchEvent(new CustomEvent('campaign:chat-prefix', { detail: prefix }))
    }
  }

  function handleCast(name: string, level: number, isConcentration: boolean) {
    const concentratingOn = character.resources.concentratingOn
    if (isConcentration && concentratingOn && concentratingOn !== name) {
      setConcWarning({ existingSpell: concentratingOn, newSpell: name, level, isConcentration })
      return
    }
    doCast(name, level, isConcentration)
  }

  // ─── Slot helpers ─────────────────────────────────────────────────────────

  function getSlotsRemaining(level: number): number | null {
    const slot = character.resources.spellSlots[String(level)]
    if (!slot) return null
    return Math.max(0, slot.max - slot.used)
  }

  function getAvailableSlotLevels(spellLevel: number): number[] {
    return Object.entries(character.resources.spellSlots)
      .map(([key]) => parseInt(key))
      .filter((lvl) => {
        if (lvl < spellLevel) return false
        const remaining = getSlotsRemaining(lvl)
        return remaining !== null && remaining > 0
      })
      .sort((a, b) => a - b)
  }

  // ─── Group spells by level ────────────────────────────────────────────────

  const spellsByLevel: Record<number, { spellName: string; spellLevel: number }[]> = {}
  if (spellsQuery.data) {
    for (const spell of spellsQuery.data) {
      if (!spellsByLevel[spell.spellLevel]) {
        spellsByLevel[spell.spellLevel] = []
      }
      spellsByLevel[spell.spellLevel].push(spell)
    }
  }
  const levelGroups = Object.keys(spellsByLevel)
    .map((k) => parseInt(k))
    .sort((a, b) => a - b)

  const concentratingOn = character.resources.concentratingOn

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section>
      <Collapsible defaultOpen>
        {/* Section header */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-row items-center gap-2 w-full mb-3 group"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=closed]:hidden" />
            <ChevronRight className="h-4 w-4 text-muted-foreground hidden group-data-[state=closed]:block" />
            <h2 className="text-xl font-semibold">Spells</h2>
            {concentratingOn && (
              <span className="ml-auto text-xs font-semibold text-amber-400 bg-amber-950/40 px-2 py-1 rounded-full">
                Concentrating: {concentratingOn}
              </span>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {spellsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground italic">Loading spells…</p>
          ) : levelGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No spells seeded yet. Spells will appear here for spellcasting classes.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {levelGroups.map((level) => {
                const spells = spellsByLevel[level]
                const slotsRemaining = level > 0 ? getSlotsRemaining(level) : null
                const slotLabel =
                  slotsRemaining !== null
                    ? ` (${slotsRemaining} slot${slotsRemaining !== 1 ? 's' : ''} remaining)`
                    : ''

                return (
                  <div key={level}>
                    {/* Level group header */}
                    <p className="text-sm font-semibold text-muted-foreground mb-1">
                      {level === 0 ? 'Cantrips' : `${ordinal(level)} Level`}
                      {level > 0 && (
                        <span className="font-normal text-xs ml-1">{slotLabel}</span>
                      )}
                    </p>

                    {/* Spell rows */}
                    <div className="flex flex-col gap-1">
                      {spells.map((spell) => {
                        const meta = spellMetaMap[spell.spellName]
                        const isExpanded = expandedSpell === spell.spellName

                        return (
                          <div
                            key={spell.spellName}
                            className="rounded-md border border-border overflow-hidden"
                          >
                            {/* Collapsed row */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSpell(isExpanded ? null : spell.spellName)
                              }
                              className="flex flex-row items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-semibold flex-1">{spell.spellName}</span>
                              <span className="flex gap-1 items-center">
                                {meta?.concentration && (
                                  <span
                                    className="text-[10px] font-semibold text-amber-400 border border-amber-600/40 rounded px-1"
                                    title="Concentration"
                                  >
                                    C
                                  </span>
                                )}
                                {meta?.ritual && (
                                  <span
                                    className="text-[10px] font-semibold text-sky-400 border border-sky-600/40 rounded px-1"
                                    title="Ritual"
                                  >
                                    R
                                  </span>
                                )}
                              </span>
                              {meta && (
                                <span className="text-xs text-muted-foreground ml-1 shrink-0">
                                  {meta.castTime}
                                </span>
                              )}
                            </button>

                            {/* Expanded card */}
                            {isExpanded && (
                              <div className="px-4 py-3 border-t border-border bg-muted/20">
                                {meta ? (
                                  <>
                                    {/* Metadata row */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                                      <span>
                                        <span className="font-semibold text-foreground">Cast:</span>{' '}
                                        {meta.castTime}
                                      </span>
                                      <span>
                                        <span className="font-semibold text-foreground">Range:</span>{' '}
                                        {meta.range}
                                      </span>
                                      <span>
                                        <span className="font-semibold text-foreground">Duration:</span>{' '}
                                        {meta.duration}
                                      </span>
                                      <span>
                                        <span className="font-semibold text-foreground">Components:</span>{' '}
                                        {meta.components}
                                      </span>
                                      {meta.concentration && (
                                        <span className="text-amber-400 font-semibold">
                                          Concentration
                                        </span>
                                      )}
                                      {meta.ritual && (
                                        <span className="text-sky-400 font-semibold">Ritual</span>
                                      )}
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-foreground mb-3">
                                      {meta.description}
                                    </p>

                                    {/* Cast controls */}
                                    <div className="flex flex-row flex-wrap gap-2 items-center">
                                      {level === 0 ? (
                                        // Cantrip — no slot deduction
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="h-8"
                                          onClick={() => handleCastCantrip(spell.spellName)}
                                        >
                                          Cast
                                        </Button>
                                      ) : (
                                        // Leveled — slot picker (available levels only, D-27)
                                        <>
                                          <span className="text-xs text-muted-foreground">
                                            Cast at:
                                          </span>
                                          {getAvailableSlotLevels(level).map((slotLvl) => (
                                            <Button
                                              key={slotLvl}
                                              variant="outline"
                                              className={cn('h-7 px-2 text-xs')}
                                              onClick={() =>
                                                handleCast(
                                                  spell.spellName,
                                                  slotLvl,
                                                  meta.concentration,
                                                )
                                              }
                                            >
                                              {ordinal(slotLvl)}
                                            </Button>
                                          ))}
                                          {getAvailableSlotLevels(level).length === 0 && (
                                            <span className="text-xs text-muted-foreground italic">
                                              No slots remaining
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    Spell metadata not available.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Concentration Warning Dialog */}
      {concWarning && (
        <ConcentrationWarningDialog
          open={!!concWarning}
          existingSpell={concWarning.existingSpell}
          newSpell={concWarning.newSpell}
          onKeep={() => setConcWarning(null)}
          onCast={() => {
            if (concWarning) {
              doCast(concWarning.newSpell, concWarning.level, true)
              setConcWarning(null)
            }
          }}
        />
      )}
    </section>
  )
}
