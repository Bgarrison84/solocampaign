/**
 * Shared helper constants and functions for the character sheet.
 * No Electron, no DB, no IPC — pure utility.
 */

/** Convert a slot level number to its ordinal string ('1st', '2nd', ..., '9th'). */
export function ordinal(n: number): string {
  const suffixes: Record<number, string> = {
    1: '1st',
    2: '2nd',
    3: '3rd',
    4: '4th',
    5: '5th',
    6: '6th',
    7: '7th',
    8: '8th',
    9: '9th',
  }
  return suffixes[n] ?? `${n}th`
}

/** Format an ability or skill modifier as '+2', '-1', '+0', etc. */
export function formatModifier(mod: number): string {
  if (mod >= 0) return `+${mod}`
  return `${mod}`
}

/** All 18 D&D 5e skills with governing ability. */
export const SKILLS: {
  key: string
  name: string
  ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
}[] = [
  { key: 'acrobatics', name: 'Acrobatics', ability: 'dexterity' },
  { key: 'animalHandling', name: 'Animal Handling', ability: 'wisdom' },
  { key: 'arcana', name: 'Arcana', ability: 'intelligence' },
  { key: 'athletics', name: 'Athletics', ability: 'strength' },
  { key: 'deception', name: 'Deception', ability: 'charisma' },
  { key: 'history', name: 'History', ability: 'intelligence' },
  { key: 'insight', name: 'Insight', ability: 'wisdom' },
  { key: 'intimidation', name: 'Intimidation', ability: 'charisma' },
  { key: 'investigation', name: 'Investigation', ability: 'intelligence' },
  { key: 'medicine', name: 'Medicine', ability: 'wisdom' },
  { key: 'nature', name: 'Nature', ability: 'intelligence' },
  { key: 'perception', name: 'Perception', ability: 'wisdom' },
  { key: 'performance', name: 'Performance', ability: 'charisma' },
  { key: 'persuasion', name: 'Persuasion', ability: 'charisma' },
  { key: 'religion', name: 'Religion', ability: 'intelligence' },
  { key: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dexterity' },
  { key: 'stealth', name: 'Stealth', ability: 'dexterity' },
  { key: 'survival', name: 'Survival', ability: 'wisdom' },
]

/**
 * XP thresholds to reach each level (1-20).
 * Index 0 = XP required to be level 1 (always 0).
 * Index 19 = XP required to reach level 20.
 */
export const XP_THRESHOLDS: number[] = [
  0,       // level 1
  300,     // level 2
  900,     // level 3
  2700,    // level 4
  6500,    // level 5
  14000,   // level 6
  23000,   // level 7
  34000,   // level 8
  48000,   // level 9
  64000,   // level 10
  85000,   // level 11
  100000,  // level 12
  120000,  // level 13
  140000,  // level 14
  165000,  // level 15
  195000,  // level 16
  225000,  // level 17
  265000,  // level 18
  305000,  // level 19
  355000,  // level 20
]

/** Conditions that show with amber (warning) styling when active. */
export const WARNING_CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'invisible',
  'prone',
  'restrained',
] as const

/** Conditions that show with red (severe) styling when active. */
export const SEVERE_CONDITIONS = [
  'exhaustion',
  'incapacitated',
  'paralyzed',
  'petrified',
  'poisoned',
  'stunned',
] as const

/** All 14 D&D 5e standard conditions, in display order. */
export const ALL_CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
] as const

export type ConditionName = (typeof ALL_CONDITIONS)[number]
