import React from 'react'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { formatModifier } from './sheetHelpers'

interface CombatStatsSectionProps {
  character: CharacterWithResources
}

export function CombatStatsSection({ character }: CombatStatsSectionProps) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Combat</h2>
      <div className="flex flex-row justify-around items-center py-2">
        {/* Armor Class */}
        <div className="flex flex-col items-center gap-0">
          <span className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">
            AC
          </span>
          <span className="text-4xl font-semibold leading-tight">{character.ac}</span>
          <span className="text-sm text-muted-foreground">Armor Class</span>
        </div>

        {/* Initiative */}
        <div className="flex flex-col items-center gap-0">
          <span className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">
            Initiative
          </span>
          <span className="text-4xl font-semibold leading-tight">
            {formatModifier(character.initiativeBonus)}
          </span>
          <span className="text-sm text-muted-foreground">DEX mod</span>
        </div>

        {/* Speed */}
        <div className="flex flex-col items-center gap-0">
          <span className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">
            Speed
          </span>
          <span className="text-4xl font-semibold leading-tight">{character.speed} ft</span>
          <span className="text-sm text-muted-foreground">Walking</span>
        </div>
      </div>
    </section>
  )
}
