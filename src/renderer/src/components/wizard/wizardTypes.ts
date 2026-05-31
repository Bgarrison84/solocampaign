import type { Race, DndClass, Background, EquipmentPackageOption } from '../../../../main/db/contentTypes'
import type { NegativeTraits } from '../../lib/pointBuy'

/** The four ability score generation methods available in the wizard. */
export type AbilityScoreMethod = 'standard-array' | '4d6-roll' | 'point-buy' | 'manual'

/**
 * The full in-progress state of the character creation wizard.
 * Held in CreateCharacterWizard's local useState.
 */
export interface WizardState {
  step: number // 0-5
  // Step 1 — Race
  characterName: string
  backstory: string
  selectedRace: Race | null
  selectedSubrace: string | null
  // Step 2 — Class
  selectedClass: DndClass | null
  selectedSubclass: string | null
  // Step 3 — Ability Scores
  abilityScoreMethod: AbilityScoreMethod
  negativeTraits: NegativeTraits
  abilityScores: {
    strength: number | null
    dexterity: number | null
    constitution: number | null
    intelligence: number | null
    wisdom: number | null
    charisma: number | null
  }
  // Manual overrides per ability (bypasses standard array)
  abilityOverrides: {
    strength: boolean
    dexterity: boolean
    constitution: boolean
    intelligence: boolean
    wisdom: boolean
    charisma: boolean
  }
  selectedSkillProficiencies: string[]
  selectedSaveProficiencies: string[]
  // Step 4 — Background
  selectedBackground: Background | null
  selectedLanguage: string | null
  personalityTrait: string
  ideal: string
  bond: string
  flaw: string
  // Step 5 — Equipment
  selectedEquipmentPackage: EquipmentPackageOption | null
}

export const TOTAL_STEPS = 6

export const STEP_NAMES: string[] = [
  'Race',
  'Class',
  'Ability Scores',
  'Background',
  'Equipment',
  'Review',
]

export const initialWizardState: WizardState = {
  step: 0,
  characterName: '',
  backstory: '',
  selectedRace: null,
  selectedSubrace: null,
  selectedClass: null,
  selectedSubclass: null,
  abilityScoreMethod: 'standard-array',
  negativeTraits: { presetFlaws: [], freeFormFlaws: ['', ''] },
  abilityScores: {
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  },
  abilityOverrides: {
    strength: false,
    dexterity: false,
    constitution: false,
    intelligence: false,
    wisdom: false,
    charisma: false,
  },
  selectedSkillProficiencies: [],
  selectedSaveProficiencies: [],
  selectedBackground: null,
  selectedLanguage: null,
  personalityTrait: '',
  ideal: '',
  bond: '',
  flaw: '',
  selectedEquipmentPackage: null,
}

// Standard array values used in Step 3
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'

export const ABILITY_NAMES: AbilityName[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
]

export const ABILITY_ABBREVIATIONS: Record<AbilityName, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
}

export const ALL_LANGUAGES = [
  'Common',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Orc',
  'Abyssal',
  'Celestial',
  'Deep Speech',
  'Draconic',
  'Infernal',
  'Primordial',
  'Sylvan',
  'Undercommon',
] as const
