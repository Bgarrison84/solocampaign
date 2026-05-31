/**
 * FeatPicker — Reusable searchable feat picker (CHAR-05, UI-SPEC §Feat Picker).
 *
 * Displays SRD feats + campaign custom feats in a searchable ScrollArea.
 * Below a Separator, exposes an inline "Create custom feat" editor.
 *
 * Props:
 *   campaignId      — scopes custom feat queries and creation
 *   selectedFeatName — currently selected feat name (null = none)
 *   onSelect        — called with { featName, featSource, customFeatId? }
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FeatSelection {
  featName: string
  featSource: 'srd' | 'custom' | 'epic_boon'
  customFeatId?: string
}

interface FeatPickerProps {
  campaignId: string
  selectedFeatName: string | null
  onSelect: (sel: FeatSelection) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function FeatPicker({ campaignId, selectedFeatName, onSelect }: FeatPickerProps) {
  const queryClient = useQueryClient()

  // ── Queries ──
  const { data: srdFeats = [] } = useQuery({
    queryKey: ['feats', 'listSrd'],
    queryFn: () => trpc.feats.listSrd.query(),
  })

  const { data: customFeats = [] } = useQuery({
    queryKey: ['feats', 'listCustomByCampaign', campaignId],
    queryFn: () => trpc.feats.listCustomByCampaign.query({ campaignId }),
  })

  // ── Search ──
  const [search, setSearch] = useState('')

  const filteredSrd = srdFeats.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredCustom = customFeats.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  )

  // ── Inline custom feat editor ──
  const [showCreate, setShowCreate] = useState(false)
  const [newFeatName, setNewFeatName] = useState('')
  const [newFeatDesc, setNewFeatDesc] = useState('')

  const createMutation = useMutation({
    mutationFn: (vars: { name: string; description: string }) =>
      trpc.feats.createCustom.mutate({ campaignId, name: vars.name, description: vars.description }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: ['feats', 'listCustomByCampaign', campaignId],
      })
      // Pre-select the newly created feat
      onSelect({ featName: created.name, featSource: 'custom', customFeatId: created.id })
      setNewFeatName('')
      setNewFeatDesc('')
      setShowCreate(false)
    },
  })

  const handleSaveCustom = useCallback(() => {
    const name = newFeatName.trim()
    const desc = newFeatDesc.trim()
    if (!name) return
    createMutation.mutate({ name, description: desc })
  }, [newFeatName, newFeatDesc, createMutation])

  // ── Keyboard navigation ──
  const listRef = useRef<HTMLDivElement>(null)

  const allItems = [
    ...filteredCustom.map((f) => ({ id: f.id, name: f.name, source: 'custom' as const, prerequisites: '' })),
    ...filteredSrd.map((f) => ({ id: f.id, name: f.name, source: 'srd' as const, prerequisites: (f as { prerequisites?: string }).prerequisites ?? '' })),
  ]

  const selectedIdx = allItems.findIndex((f) => f.name === selectedFeatName)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (allItems.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(selectedIdx + 1, allItems.length - 1)
        const item = allItems[next]
        if (item) {
          if (item.source === 'custom') {
            const cf = customFeats.find((f) => f.id === item.id)
            onSelect({ featName: item.name, featSource: 'custom', customFeatId: cf?.id })
          } else {
            onSelect({ featName: item.name, featSource: 'srd' })
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max(selectedIdx - 1, 0)
        const item = allItems[prev]
        if (item) {
          if (item.source === 'custom') {
            const cf = customFeats.find((f) => f.id === item.id)
            onSelect({ featName: item.name, featSource: 'custom', customFeatId: cf?.id })
          } else {
            onSelect({ featName: item.name, featSource: 'srd' })
          }
        }
      } else if (e.key === 'Enter') {
        // Enter selects focused item — handled by onClick
      }
    },
    [allItems, selectedIdx, customFeats, onSelect],
  )

  // Focus list on mount so keyboard nav works immediately
  useEffect(() => {
    listRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col gap-2">
      {/* Search input */}
      <Input
        className="h-8 text-sm"
        placeholder="Search feats…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search feats"
      />

      {/* Feat list */}
      <ScrollArea className="h-[200px] rounded-md border border-border">
        <div
          ref={listRef}
          role="listbox"
          aria-label="Feat list"
          tabIndex={0}
          className="p-1 outline-none"
          onKeyDown={handleKeyDown}
        >
          {allItems.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No feats found.</p>
          )}
          {allItems.map((feat) => {
            const isSelected = feat.name === selectedFeatName
            return (
              <div
                key={`${feat.source}-${feat.id}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                className={[
                  'flex flex-col px-2 py-1.5 rounded-sm cursor-pointer select-none transition-colors',
                  isSelected
                    ? 'bg-secondary border-l-2 border-accent-gold'
                    : 'hover:bg-accent/50',
                ].join(' ')}
                onClick={() => {
                  if (feat.source === 'custom') {
                    const cf = customFeats.find((f) => f.id === feat.id)
                    onSelect({ featName: feat.name, featSource: 'custom', customFeatId: cf?.id })
                  } else {
                    onSelect({ featName: feat.name, featSource: 'srd' })
                  }
                }}
              >
                <span className="text-[14px] font-semibold leading-tight text-foreground">
                  {feat.name}
                  {feat.source === 'custom' && (
                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">(custom)</span>
                  )}
                </span>
                {feat.prerequisites && (
                  <span className="text-[12px] text-muted-foreground truncate leading-tight">
                    Requires: {feat.prerequisites}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Custom feat creator */}
      <Separator />
      {!showCreate ? (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground text-left transition-colors py-0.5"
          onClick={() => setShowCreate(true)}
        >
          + Create custom feat
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-foreground">New Custom Feat</p>
          <Input
            className="h-9 text-sm"
            placeholder="Feat name"
            value={newFeatName}
            onChange={(e) => setNewFeatName(e.target.value.slice(0, 100))}
            aria-label="Custom feat name"
          />
          <Textarea
            rows={3}
            placeholder="Description (optional)"
            value={newFeatDesc}
            onChange={(e) => setNewFeatDesc(e.target.value.slice(0, 2000))}
            className="text-sm resize-none"
            aria-label="Custom feat description"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!newFeatName.trim() || createMutation.isPending}
              onClick={handleSaveCustom}
            >
              {createMutation.isPending ? 'Saving…' : 'Save Custom Feat'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false)
                setNewFeatName('')
                setNewFeatDesc('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
