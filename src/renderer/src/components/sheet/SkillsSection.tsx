import React from 'react'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { calcAbilityModifier } from '../../../../main/characters/calculations'
import { SKILLS, formatModifier } from './sheetHelpers'
import { ProficiencyDot } from './ProficiencyDot'

interface SkillsSectionProps {
  character: CharacterWithResources
}

const ABILITY_ABBR: Record<string, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
}

export function SkillsSection({ character }: SkillsSectionProps) {
  const profBonus = character.proficiencyBonus

  // Compute Perception modifier for Passive Perception footer
  const perceptionSkill = SKILLS.find((s) => s.key === 'perception')!
  const perceptionAbilityScore = character[perceptionSkill.ability]
  const perceptionAbilityMod = calcAbilityModifier(perceptionAbilityScore)
  const perceptionProfState = character.skillExpertise.includes(perceptionSkill.key)
    ? 'expertise'
    : character.skillProficiencies.includes(perceptionSkill.key)
    ? 'proficient'
    : 'none'
  const perceptionMod =
    perceptionAbilityMod +
    (perceptionProfState === 'expertise' ? profBonus * 2 : perceptionProfState === 'proficient' ? profBonus : 0)
  const passivePerception = 10 + perceptionMod

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Skills</h2>
      <div className="flex flex-col gap-2">
        {SKILLS.map((skill) => {
          const abilityScore = character[skill.ability]
          const abilityMod = calcAbilityModifier(abilityScore)
          const profState = character.skillExpertise.includes(skill.key)
            ? 'expertise'
            : character.skillProficiencies.includes(skill.key)
            ? 'proficient'
            : 'none'
          const skillMod =
            abilityMod +
            (profState === 'expertise' ? profBonus * 2 : profState === 'proficient' ? profBonus : 0)

          return (
            <div key={skill.key} className="flex flex-row items-center gap-2">
              <ProficiencyDot state={profState} size={10} />
              <span className="text-sm w-32">{skill.name}</span>
              <span className="text-sm text-muted-foreground w-8">
                {ABILITY_ABBR[skill.ability]}
              </span>
              <span className="text-sm font-semibold">{formatModifier(skillMod)}</span>
            </div>
          )
        })}
      </div>
      <div className="border-t border-border mt-2 pt-2">
        <p className="text-sm text-muted-foreground">
          Passive Perception: {passivePerception}
        </p>
      </div>
    </section>
  )
}
