import React from 'react'
import { cn } from '../../lib/utils'

interface ProficiencyDotProps {
  state: 'none' | 'proficient' | 'expertise'
  size?: number
}

const stateTooltip = {
  none: 'Not proficient',
  proficient: 'Proficient',
  expertise: 'Expertise',
}

export function ProficiencyDot({ state, size = 10 }: ProficiencyDotProps) {
  return (
    <span
      title={stateTooltip[state]}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className={cn(
        'inline-block rounded-full flex-shrink-0',
        state === 'none' && 'border border-muted-foreground bg-transparent',
        state === 'proficient' && 'bg-accent-gold',
        state === 'expertise' && 'bg-accent-gold ring-1 ring-background',
      )}
    />
  )
}
