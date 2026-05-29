/**
 * Thin wrapper around rpg-dice-roller (renderer-only).
 *
 * rpg-dice-roller is ESM; Vite resolves it natively. If the build ever fails
 * with "Failed to resolve module specifier" (RESEARCH.md Pitfall 6), add
 * `optimizeDeps: { include: ['rpg-dice-roller'] }` to the renderer block of
 * electron.vite.config.ts.
 *
 * v5 `roll.rolls` shape (verified against rpg-dice-roller@5.0.0):
 * For an expression like `2d6+3`, `roll.rolls` is a mixed array:
 *   - dice groups   → objects with a `.rolls` array of `{ value }` die entries
 *   - operators     → plain strings (e.g. '+')
 *   - modifiers     → plain numbers (e.g. 3)
 * The breakdown is the flattened list of individual die `value`s from the dice
 * groups only — operators and modifiers are excluded. For `4d6kh3` every rolled
 * die value is included (even dropped dice), so breakdown.length === 4.
 */
import { DiceRoller } from 'rpg-dice-roller'

const roller = new DiceRoller()

export interface RollResult {
  expression: string
  result: number
  breakdown: number[]
}

interface DieEntry {
  value: number
}

interface DiceGroup {
  rolls: DieEntry[]
}

function isDiceGroup(entry: unknown): entry is DiceGroup {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'rolls' in entry &&
    Array.isArray((entry as { rolls: unknown }).rolls)
  )
}

/**
 * Roll a dice-notation expression (e.g. 'd20', '2d6+3', '4d6kh3').
 * Returns the total and the flattened individual die values.
 * Throws if the expression is invalid.
 */
export function rollExpression(expression: string): RollResult {
  const roll = roller.roll(expression)
  // `roll` is a DiceRoll; `.rolls` is the mixed array described above.
  const groups = (roll as { rolls: unknown[] }).rolls
  const breakdown: number[] = []
  for (const entry of groups) {
    if (isDiceGroup(entry)) {
      for (const die of entry.rolls) {
        if (typeof die.value === 'number') {
          breakdown.push(die.value)
        }
      }
    }
  }
  return {
    expression,
    result: (roll as { total: number }).total,
    breakdown,
  }
}

/**
 * Returns true if the expression is valid dice notation, false otherwise.
 */
export function isValidExpression(expression: string): boolean {
  try {
    roller.roll(expression)
    return true
  } catch {
    return false
  }
}
