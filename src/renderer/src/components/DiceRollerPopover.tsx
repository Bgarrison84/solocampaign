/**
 * DiceRollerPopover — In-app dice roller attached to the chat input (UI-SPEC §S3 / COMB-01).
 *
 * Renders a popover with 7 die-type quick buttons (d4–d100) plus a free-form
 * expression input (e.g. `2d6+3`, `4d6kh3`). Clicking a die or submitting a
 * valid expression computes the roll via the 05-01 dice wrapper and calls
 * `onRoll` with a formatted prefix like `[d20: 14] `, then closes the popover.
 *
 * The trigger button is supplied by the CALLER (ChatInputArea) via `children`
 * and wrapped in PopoverTrigger here. Roll evaluation runs entirely in the
 * renderer — no IPC, no DB write (player-roll logging is a message-send concern;
 * the prefix carries the result into the message text). See D-19, D-21.
 *
 * Security (T-05-04-02): `isValidExpression` gates the Roll button; rpg-dice-roller
 * bounds the notation it will evaluate. Evaluation is local and side-effect-free.
 */

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { rollExpression, isValidExpression } from '../lib/dice'

const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const

export interface DiceRollerPopoverProps {
  /** Controlled open state of the popover */
  open: boolean
  /** Called when the popover requests an open-state change */
  onOpenChange: (open: boolean) => void
  /** Called with a formatted roll prefix like `[d20: 14] ` */
  onRoll: (prefix: string) => void
  /** The trigger element (the dice button) rendered by the caller */
  children: React.ReactNode
}

export function DiceRollerPopover({
  open,
  onOpenChange,
  onRoll,
  children,
}: DiceRollerPopoverProps) {
  const [expression, setExpression] = useState('')

  const handleDie = (die: string) => {
    const r = rollExpression(die)
    onRoll(`[${die}: ${r.result}] `)
    onOpenChange(false)
  }

  const handleExpression = () => {
    if (!expression || !isValidExpression(expression)) return
    const r = rollExpression(expression)
    onRoll(`[${expression}: ${r.result}] `)
    setExpression('')
    onOpenChange(false)
  }

  const expressionInvalid = expression.length > 0 && !isValidExpression(expression)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-[280px] p-3"
        role="dialog"
        aria-label="Dice roller"
      >
        {/* Die-type quick buttons (7) */}
        <div className="flex flex-wrap gap-2 justify-center">
          {DIE_TYPES.map((die) => (
            <Button
              key={die}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 text-xs font-semibold"
              onClick={() => handleDie(die)}
              aria-label={`Roll ${die}`}
            >
              {die}
            </Button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 my-3">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          <span className="text-xs text-muted-foreground shrink-0">or enter expression</span>
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>

        {/* Expression input row */}
        <div className="flex gap-2">
          <Input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="2d6+3"
            className="flex-1 h-8 text-sm font-mono bg-secondary border-border"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleExpression()
              }
            }}
            aria-label="Dice expression"
          />
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={handleExpression}
            disabled={!isValidExpression(expression) || !expression}
          >
            Roll
          </Button>
        </div>

        {/* Helper text + inline error */}
        <p className="text-xs text-muted-foreground mt-1">e.g. 4d6kh3, d20+5</p>
        {expressionInvalid && (
          <span className="text-xs text-destructive">Invalid expression</span>
        )}
      </PopoverContent>
    </Popover>
  )
}
