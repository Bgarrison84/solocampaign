import React from 'react'
import { cn } from '../../lib/utils'
import type { ConditionName } from './sheetHelpers'
import { WARNING_CONDITIONS, SEVERE_CONDITIONS } from './sheetHelpers'

interface ConditionBadgeProps {
  condition: ConditionName
  active: boolean
  onToggle: () => void
}

function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ConditionBadge({ condition, active, onToggle }: ConditionBadgeProps) {
  const isWarning = (WARNING_CONDITIONS as readonly string[]).includes(condition)
  const isSevere = (SEVERE_CONDITIONS as readonly string[]).includes(condition)

  return (
    <span
      role="button"
      tabIndex={0}
      className={cn(
        'rounded-full px-2 py-1 text-sm font-semibold border cursor-pointer select-none transition-colors',
        !active && 'bg-surface border-border text-muted-foreground hover:border-muted-foreground',
        active && isWarning && 'bg-amber-950/60 border-amber-600 text-amber-400',
        active && isSevere && 'bg-red-950/60 border-red-600 text-red-400',
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      aria-pressed={active}
      aria-label={toTitleCase(condition)}
    >
      {toTitleCase(condition)}
    </span>
  )
}
