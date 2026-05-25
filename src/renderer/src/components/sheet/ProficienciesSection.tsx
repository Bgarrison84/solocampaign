import React from 'react'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'

interface ProficienciesSectionProps {
  character: CharacterWithResources
}

function joinOrNone(arr: string[]): string {
  if (arr.length === 0) return 'None'
  return arr.join(', ')
}

export function ProficienciesSection({ character }: ProficienciesSectionProps) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Proficiencies &amp; Languages</h2>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-4">
          <span className="text-base font-semibold w-24 flex-shrink-0">Armor</span>
          <span className="text-sm text-muted-foreground">
            {joinOrNone(character.armorProficiencies)}
          </span>
        </div>
        <div className="flex flex-row gap-4">
          <span className="text-base font-semibold w-24 flex-shrink-0">Weapons</span>
          <span className="text-sm text-muted-foreground">
            {joinOrNone(character.weaponProficiencies)}
          </span>
        </div>
        <div className="flex flex-row gap-4">
          <span className="text-base font-semibold w-24 flex-shrink-0">Tools</span>
          <span className="text-sm text-muted-foreground">
            {joinOrNone(character.toolProficiencies)}
          </span>
        </div>
        <div className="flex flex-row gap-4">
          <span className="text-base font-semibold w-24 flex-shrink-0">Languages</span>
          <span className="text-sm text-muted-foreground">
            {joinOrNone(character.languages)}
          </span>
        </div>
      </div>
    </section>
  )
}
