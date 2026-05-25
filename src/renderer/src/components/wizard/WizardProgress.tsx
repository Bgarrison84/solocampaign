import React from 'react'
import { cn } from '../../lib/utils'

interface WizardProgressProps {
  totalSteps: number
  currentStep: number
  completedUpTo: number
  stepLabels: string[]
  onStepClick: (step: number) => void
}

/**
 * Numbered step dots at the top of the wizard dialog.
 * Per UI-SPEC §2.1: row of 6 circles with 3 states — future, completed, active.
 */
export function WizardProgress({
  totalSteps,
  currentStep,
  completedUpTo,
  stepLabels,
  onStepClick,
}: WizardProgressProps) {
  return (
    <div className="flex flex-row items-start justify-center gap-4 mt-2 relative">
      {/* Connector line behind circles */}
      <div className="absolute top-4 left-8 right-8 border-t border-border" />
      {Array.from({ length: totalSteps }, (_, i) => {
        const isCompleted = i <= completedUpTo && i !== currentStep
        const isActive = i === currentStep
        const isFuture = i > completedUpTo && i !== currentStep

        return (
          <div key={i} className="flex flex-col items-center gap-1 z-10">
            <button
              type="button"
              onClick={() => {
                if (isCompleted) onStepClick(i)
              }}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-opacity',
                isCompleted &&
                  'bg-accent-gold text-background border border-accent-gold cursor-pointer hover:opacity-80',
                isActive &&
                  'bg-accent-gold/20 border-2 border-accent-gold text-accent-gold cursor-default',
                isFuture &&
                  'bg-surface border border-border text-muted-foreground cursor-not-allowed opacity-50',
              )}
              disabled={!isCompleted}
              aria-label={`Step ${i + 1}: ${stepLabels[i]}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {i + 1}
            </button>
            <span
              className={cn(
                'text-sm',
                isActive ? 'text-accent-gold font-semibold' : 'text-muted-foreground',
              )}
            >
              {stepLabels[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
