import React from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

interface StepperProps {
  value: number
  min?: number
  max?: number
  onChange: (delta: number) => void
  step?: number
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizeConfig = {
  sm: {
    button: 'h-5 w-5 p-0 min-w-0',
    value: 'text-sm font-semibold min-w-[2rem] text-center',
  },
  md: {
    button: 'h-7 w-7 p-0 min-w-0',
    value: 'text-base font-semibold min-w-[2.5rem] text-center',
  },
  lg: {
    button: 'h-9 w-9 p-0 min-w-0',
    value: 'text-xl font-semibold min-w-[3rem] text-center',
  },
}

export function Stepper({
  value,
  min = 0,
  max = Infinity,
  onChange,
  step = 1,
  disabled = false,
  size = 'md',
  label,
}: StepperProps) {
  const cfg = sizeConfig[size]

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-row items-center gap-1', disabled && 'opacity-40 pointer-events-none')}
    >
      <Button
        type="button"
        variant="outline"
        className={cfg.button}
        disabled={disabled || value <= min}
        onClick={() => onChange(-step)}
        aria-label={label ? `Decrease ${label}` : 'Decrease'}
      >
        −
      </Button>
      <span className={cfg.value}>{value}</span>
      <Button
        type="button"
        variant="outline"
        className={cfg.button}
        disabled={disabled || value >= max}
        onClick={() => onChange(step)}
        aria-label={label ? `Increase ${label}` : 'Increase'}
      >
        +
      </Button>
    </div>
  )
}
