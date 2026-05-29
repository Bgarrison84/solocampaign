import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 fill percentage */
  value?: number
  /** className applied to the moving indicator (fill) — used for semantic HP colors */
  indicatorClassName?: string
}

/**
 * Minimal progress bar (shadcn-equivalent, no Radix dependency).
 *
 * The track is the outer div; the fill width is driven by `value` (0–100).
 * `indicatorClassName` lets callers set the fill color (e.g. semantic HP colors
 * green/amber/red by percent — UI-SPEC §S2b). Fill color transitions over 300ms.
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value))
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn('relative w-full overflow-hidden rounded-full bg-muted', className)}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width,background-color] duration-300',
            indicatorClassName ?? 'bg-primary',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    )
  },
)
Progress.displayName = 'Progress'

export { Progress }
