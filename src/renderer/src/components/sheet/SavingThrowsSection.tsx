import React from 'react'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { calcAbilityModifier } from '../../../../main/characters/calculations'
import { formatModifier } from './sheetHelpers'
import { ProficiencyDot } from './ProficiencyDot'

interface SavingThrowsSectionProps {
  character: CharacterWithResources
}

type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'

const ABILITIES: { key: AbilityName; abbr: string }[] = [
  { key: 'strength', abbr: 'STR' },
  { key: 'dexterity', abbr: 'DEX' },
  { key: 'constitution', abbr: 'CON' },
  { key: 'intelligence', abbr: 'INT' },
  { key: 'wisdom', abbr: 'WIS' },
  { key: 'charisma', abbr: 'CHA' },
]

export function SavingThrowsSection({ character }: SavingThrowsSectionProps) {
  const profBonus = character.proficiencyBonus

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Saving Throws</h2>
      <div className="flex flex-col gap-2">
        {ABILITIES.map(({ key, abbr }) => {
          const isProficient = character.savingThrowProficiencies.includes(key)
          const abilityMod = calcAbilityModifier(character[key])
          const saveMod = abilityMod + (isProficient ? profBonus : 0)

          return (
            <div key={key} className="flex flex-row items-center gap-2">
              <ProficiencyDot state={isProficient ? 'proficient' : 'none'} size={10} />
              <span className="text-sm font-semibold w-10">{abbr}</span>
              <span className="text-sm font-semibold">{formatModifier(saveMod)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
