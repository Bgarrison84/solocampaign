import React from 'react'
import { cn } from '../../lib/utils'
import { ordinal } from './sheetHelpers'

interface SpellSlotPipsProps {
  slotLevel: number
  used: number
  max: number
  onUse: () => void
  onRecover: () => void
}

export function SpellSlotPips({ slotLevel, used, max, onUse, onRecover }: SpellSlotPipsProps) {
  const available = max - used
  const allExpended = used >= max

  return (
    <div className="flex flex-row items-center gap-2">
      <span className="text-sm text-muted-foreground w-8 flex-shrink-0">{ordinal(slotLevel)}</span>
      <div className={cn('flex flex-row gap-1', allExpended && 'opacity-60')}>
        {Array.from({ length: max }).map((_, i) => {
          // Pips rendered left to right: index 0 is leftmost.
          // Available pips: indices 0 to (available - 1).
          // Expended pips: indices available to (max - 1).
          const isAvailable = i < available

          return (
            <button
              key={i}
              type="button"
              onClick={isAvailable ? onUse : onRecover}
              aria-label={isAvailable ? `Use ${ordinal(slotLevel)} spell slot` : `Recover ${ordinal(slotLevel)} spell slot`}
              className={cn(
                'w-4 h-4 rounded-full border transition-opacity hover:opacity-80 cursor-pointer',
                isAvailable
                  ? 'bg-accent-gold/80 border-accent-gold'
                  : 'bg-surface border-border',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
