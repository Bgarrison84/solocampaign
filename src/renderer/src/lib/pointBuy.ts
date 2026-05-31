/**
 * Point Buy helpers — renderer-side mirror of main-process calculations.
 * Renderer cannot import main-process code directly; these are pure functions
 * duplicated here for the ability score wizard step.
 *
 * D&D 5e SRD RAW point buy cost table (verified from 5thsrd.org).
 */

export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

export const BASE_POINT_BUY_BUDGET = 27

/**
 * Preset negative flaws (D-04). 10 entries, each with:
 *   id     — stable identifier saved to characters.negativeTraits
 *   name   — display name
 *   penalty — short mechanical penalty description shown in UI
 *   points — how many extra point-buy points the flaw awards
 */
export interface PresetFlaw {
  id: string
  name: string
  penalty: string
  points: number
}

export const PRESET_FLAWS: PresetFlaw[] = [
  {
    id: 'frail',
    name: 'Frail',
    penalty: '−2 to max HP per level (min 1 HP/level)',
    points: 2,
  },
  {
    id: 'clumsy',
    name: 'Clumsy',
    penalty: '−2 AC',
    points: 2,
  },
  {
    id: 'dim',
    name: 'Dim',
    penalty: '−2 passive Perception; −2 passive Investigation',
    points: 1,
  },
  {
    id: 'weak',
    name: 'Weak',
    penalty: '−2 to all Strength checks and Strength saving throws',
    points: 2,
  },
  {
    id: 'unlucky',
    name: 'Unlucky',
    penalty: 'Disadvantage on one saving throw type chosen at creation',
    points: 3,
  },
  {
    id: 'slow',
    name: 'Slow',
    penalty: '−10 ft movement speed (minimum 20 ft)',
    points: 2,
  },
  {
    id: 'sickly',
    name: 'Sickly',
    penalty: 'Disadvantage on saving throws vs. disease and poison',
    points: 1,
  },
  {
    id: 'timid',
    name: 'Timid',
    penalty: '−2 to initiative rolls',
    points: 1,
  },
  {
    id: 'fumbling',
    name: 'Fumbling',
    penalty: 'Once per session (DM\'s choice), disadvantage on one attack roll',
    points: 2,
  },
  {
    id: 'cursed',
    name: 'Cursed',
    penalty: 'When rolling 1 on a d20, the DM may narrate an extra complication',
    points: 2,
  },
]

/**
 * Total point cost of a set of six ability scores.
 * Scores outside 8–15 are clamped to 0 cost (shouldn't happen in Point Buy mode).
 */
export function calcPointBuyCost(scores: Record<string, number | null>): number {
  return Object.values(scores).reduce<number>((sum, score) => {
    if (score === null) return sum
    return sum + (POINT_BUY_COST[score] ?? 0)
  }, 0)
}

/**
 * Available point budget given selected preset flaws + free-form flaw strings.
 *   base 27
 *   + sum of points for each selected preset flaw id
 *   + min(count of non-empty free-form flaws, 2) * 2
 */
export function calcPointBuyBudget(
  selectedPresetIds: string[],
  freeFormFlaws: [string, string],
): number {
  const presetBonus = PRESET_FLAWS.filter((f) =>
    selectedPresetIds.includes(f.id),
  ).reduce((sum, f) => sum + f.points, 0)

  const filledFreeForm = freeFormFlaws.filter((s) => s.trim().length > 0).length
  const freeFormBonus = Math.min(filledFreeForm, 2) * 2

  return BASE_POINT_BUY_BUDGET + presetBonus + freeFormBonus
}

/** Shape persisted to characters.negativeTraits JSON column */
export interface NegativeTraits {
  presetFlaws: string[]
  freeFormFlaws: [string, string]
}
