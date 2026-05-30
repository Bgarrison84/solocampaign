/**
 * MutationChipStack — live toast chip stack for AI-applied mutations (D-07, §S6).
 *
 * Subscribes to the 'ai:mutations-applied' IPC event via window.aiStream.onMutationsApplied.
 * Each chip emitted by the mutation pipeline (05-02) renders as a pill at the top of the
 * right panel. Chips auto-remove after 4000ms. At most 4 are visible at once (FIFO).
 *
 * Container: absolute top-0 left-0 right-0 z-50 pointer-events-none (UI-SPEC §S6).
 * Each chip: role="status" aria-live="polite", rounded-full pill with a type-mapped icon.
 *
 * Icon map (UI-SPEC §S6 table):
 *   hp (damage)      → ArrowDown, text-red-400
 *   hp (heal)        → ArrowUp,   text-green-400
 *   xp               → Star,      text-amber-400
 *   condition        → AlertCircle (applied) / CheckCircle (removed), text-amber-400 / text-green-400
 *   slot (used)      → Zap,       text-sky-400
 *   slot (restored)  → RotateCcw, text-muted-foreground
 *   currency         → Coins,     text-amber-400
 *   combat           → UserPlus / Shield, text-muted-foreground
 *   rest             → Shield,    text-muted-foreground
 */

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle,
  Coins,
  RotateCcw,
  ScrollText,
  Shield,
  Star,
  UserPlus,
  Zap,
} from 'lucide-react'

/** Discriminated chip type as emitted by mutationPipeline.ts */
type ChipType =
  | 'hp'
  | 'xp'
  | 'condition'
  | 'slot'
  | 'currency'
  | 'combat'
  | 'rest'
  | 'quest'
  | 'quest_complete'
  | 'npc'
  | 'inspiration'

interface DisplayChip {
  id: string
  label: string
  type: ChipType
}

const MAX_CHIPS = 4
const CHIP_DURATION_MS = 4000

const VALID_CHIP_TYPES = new Set<ChipType>([
  'hp', 'xp', 'condition', 'slot', 'currency', 'combat', 'rest',
  'quest', 'quest_complete', 'npc', 'inspiration',
])

/**
 * Derive icon and color from chip type + label.
 * The label carries the human-readable delta (e.g. "-6 HP", "+150 XP", "+ Poisoned", "Spell slot used").
 */
function iconFor(type: ChipType, label: string): React.ReactNode {
  const cls = 'h-3.5 w-3.5 shrink-0'

  switch (type) {
    case 'hp': {
      // Negative delta → damage (ArrowDown red); positive → heal (ArrowUp green)
      const isHeal = label.startsWith('+')
      return isHeal
        ? <ArrowUp className={`${cls} text-green-400`} />
        : <ArrowDown className={`${cls} text-red-400`} />
    }
    case 'xp':
      return <Star className={`${cls} text-amber-400`} />
    case 'condition': {
      // "- Poisoned" (removal) → CheckCircle green; "+ Poisoned" (applied) → AlertCircle amber
      const isRemoval = label.startsWith('-')
      return isRemoval
        ? <CheckCircle className={`${cls} text-green-400`} />
        : <AlertCircle className={`${cls} text-amber-400`} />
    }
    case 'slot': {
      // "Spell slot used" → Zap sky; "Spell slots restored" → RotateCcw muted
      const isRestore = label.toLowerCase().includes('restor')
      return isRestore
        ? <RotateCcw className={`${cls} text-muted-foreground`} />
        : <Zap className={`${cls} text-sky-400`} />
    }
    case 'currency':
      return <Coins className={`${cls} text-amber-400`} />
    case 'combat': {
      // "X added to combat" → UserPlus; anything else (removed / ended) → Shield
      const isAdd = label.toLowerCase().includes('added')
      return isAdd
        ? <UserPlus className={`${cls} text-muted-foreground`} />
        : <Shield className={`${cls} text-muted-foreground`} />
    }
    case 'rest':
      return <Shield className={`${cls} text-muted-foreground`} />
    // ─── Phase 6 chip types (UI-SPEC §S4) — strings match the Wave 2 pipeline emit ───
    case 'quest':
      return <ScrollText className={`${cls} text-green-400`} />
    case 'quest_complete':
      return <Check className={`${cls} text-muted-foreground`} />
    case 'npc':
      return <UserPlus className={`${cls} text-muted-foreground`} />
    case 'inspiration':
      return <Star className={`${cls} text-amber-400`} />
    default:
      return <Star className={`${cls} text-muted-foreground`} />
  }
}

export function MutationChipStack() {
  const [chips, setChips] = useState<DisplayChip[]>([])

  useEffect(() => {
    let active = true
    const handler = (payload: {
      campaignId: string
      chips: Array<{ id: string; label: string; type: string }>
    }) => {
      if (!active) return
      const incoming: DisplayChip[] = payload.chips
        .filter((c): c is DisplayChip => VALID_CHIP_TYPES.has(c.type as ChipType))

      setChips((prev) => {
        // Push all incoming chips; keep only the most recent MAX_CHIPS (FIFO drop oldest)
        const next = [...prev, ...incoming].slice(-MAX_CHIPS)
        return next
      })

      // Schedule removal for each incoming chip
      for (const chip of incoming) {
        setTimeout(() => {
          setChips((prev) => prev.filter((c) => c.id !== chip.id))
        }, CHIP_DURATION_MS)
      }
    }

    window.aiStream.onMutationsApplied(handler)

    return () => {
      active = false
      setChips([])
      // Do NOT call removeOnMutationsApplied() — it removes all channel listeners,
      // including those registered by CampaignViewScreen.
    }
  }, [])

  if (chips.length === 0) return null

  return (
    <div
      className="absolute top-0 left-0 right-0 z-50 px-3 py-2 flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {chips.map((chip) => (
        <div
          key={chip.id}
          role="status"
          aria-live="polite"
          className="bg-card border border-border rounded-full px-3 py-1 text-sm text-foreground shadow-md flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 self-start"
        >
          {iconFor(chip.type, chip.label)}
          <span>{chip.label}</span>
        </div>
      ))}
    </div>
  )
}
