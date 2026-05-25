/**
 * TypeScript interfaces for the bundled D&D 5e content JSON files.
 * These match the schemas defined in RESEARCH.md §Content JSON Schema.
 */

export interface Race {
  id: string
  name: string
  subrace?: string
  parentRace?: string
  size: 'Tiny' | 'Small' | 'Medium' | 'Large'
  speed: number
  abilityScoreIncreases: { ability: string; bonus: number }[]
  darkvision?: number
  traits: { name: string; description: string }[]
  languages: string[]
  freeLanguageChoices?: number
  availableSubraces?: string[]
  source: string
}

export interface Subclass {
  id: string
  name: string
  features: { name: string; description: string }[]
}

export interface EquipmentPackageOption {
  id: string
  label: string
  items: { name: string; quantity: number; weight: number; isMagic?: boolean }[]
  startingGold?: number
}

export interface DndClass {
  id: string
  name: string
  hitDie: number
  primaryAbility: string[]
  savingThrowProficiencies: string[]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  toolProficiencies: string[]
  skillChoiceCount: number
  skillChoices: string[]
  startingEquipmentPackages: EquipmentPackageOption[]
  level1Features: { name: string; description: string }[]
  spellcaster: boolean
  spellcastingAbility?: string
  choosesSubclassAtLevel1: boolean
  subclasses?: Subclass[]
  source: string
}

export interface Background {
  id: string
  name: string
  skillProficiencies: string[]
  toolProficiencies: string[]
  languages: string[]
  freeLanguageChoices?: number
  feature: { name: string; description: string }
  suggestedPersonalityTraits: string[]
  suggestedIdeals: string[]
  suggestedBonds: string[]
  suggestedFlaws: string[]
  startingEquipment: { name: string; quantity: number; weight: number }[]
  startingGold: number
  source: string
}

/**
 * Spell slot map for a character's current slot state.
 * Keys are slot levels ("1" through "9"), values track used/max counts.
 */
export type SpellSlotMap = Record<string, { used: number; max: number }>

/**
 * Spell slots by class and level.
 * SpellSlotsByClass[className][level] = { slotLevel: maxSlots }
 * Example: { "cleric": { 1: { "1": 2 }, 2: { "1": 3 }, 3: { "1": 4, "2": 2 } } }
 */
export type SpellSlotsByClass = {
  [className: string]: {
    [level: number]: {
      [slotLevel: string]: number
    }
  }
}
