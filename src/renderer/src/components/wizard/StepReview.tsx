import React from 'react'
import {
  calcHP,
  calcAC,
  calcInitiativeBonus,
  calcAbilityModifier,
  buildSpellSlots,
} from '../../../../main/characters/calculations'
import type { WizardState, AbilityName } from './wizardTypes'
import { ABILITY_ABBREVIATIONS } from './wizardTypes'
// The forClass query returns SpellSlotsByClass[className] — a per-class level table
type ClassSpellSlotTable = {
  [level: number]: { [slotLevel: string]: number }
}

interface StepReviewProps {
  wizardState: WizardState
  spellSlotsData: ClassSpellSlotTable | null
}

/**
 * Step 6 — Review / Summary.
 * Per UI-SPEC §3.7: read-only single-column summary with computed preview stats.
 * Uses pure calculation functions imported from main process (no electron deps).
 */
export function StepReview({ wizardState, spellSlotsData }: StepReviewProps) {
  const s = wizardState

  const baseScores = {
    strength: s.abilityScores.strength ?? 8,
    dexterity: s.abilityScores.dexterity ?? 8,
    constitution: s.abilityScores.constitution ?? 8,
    intelligence: s.abilityScores.intelligence ?? 8,
    wisdom: s.abilityScores.wisdom ?? 8,
    charisma: s.abilityScores.charisma ?? 8,
  }

  // Apply racial ASI bonuses for preview (same logic as server, approximate for preview)
  const previewScores = { ...baseScores }
  if (s.selectedRace) {
    for (const asi of s.selectedRace.abilityScoreIncreases) {
      const ability = asi.ability.toLowerCase() as AbilityName
      if (ability in previewScores) {
        previewScores[ability] = Math.min(30, previewScores[ability] + asi.bonus)
      }
    }
  }

  const hitDie = s.selectedClass?.hitDie ?? 8
  const hp = calcHP(hitDie, previewScores.constitution)

  // Determine armor base from equipment package
  let armorBaseAc: number | undefined
  const armorItem = s.selectedEquipmentPackage?.items.find((item) => {
    const n = item.name.toLowerCase()
    return (
      n.includes('chain mail') ||
      n.includes('leather armor') ||
      n.includes('scale mail') ||
      n.includes('ring mail') ||
      n.includes('hide armor') ||
      n.includes('studded leather') ||
      n.includes('breastplate') ||
      n.includes('half plate') ||
      n.includes('splint') ||
      n.includes('plate armor')
    )
  })
  if (armorItem) {
    const n = armorItem.name.toLowerCase()
    if (n.includes('chain mail')) armorBaseAc = 16
    else if (n.includes('plate')) armorBaseAc = 18
    else if (n.includes('splint')) armorBaseAc = 17
    else if (n.includes('half plate')) armorBaseAc = 15
    else if (n.includes('breastplate')) armorBaseAc = 14
    else if (n.includes('scale mail') || n.includes('ring mail')) armorBaseAc = 14
    else if (n.includes('hide')) armorBaseAc = 12
    else if (n.includes('studded leather')) armorBaseAc = 12
    else if (n.includes('leather')) armorBaseAc = 11
  }

  const ac = calcAC(previewScores.dexterity, armorBaseAc)
  const initiative = calcInitiativeBonus(previewScores.dexterity)
  const speed = s.selectedRace?.speed ?? 30

  // Build spell slots for preview
  // Wrap the per-class data back into the SpellSlotsByClass shape for buildSpellSlots
  const spellSlots = spellSlotsData && s.selectedClass
    ? buildSpellSlots(
        s.selectedClass.name.toLowerCase(),
        1,
        { [s.selectedClass.name.toLowerCase()]: spellSlotsData },
      )
    : {}

  const hasSpellSlots = Object.keys(spellSlots).length > 0

  // Languages: race + background + chosen
  const raceLanguages = s.selectedRace?.languages ?? []
  const bgLanguages = s.selectedBackground?.languages ?? []
  const chosenLanguage = s.selectedLanguage ? [s.selectedLanguage] : []
  const allLanguages = [...new Set([...raceLanguages, ...bgLanguages, ...chosenLanguage])]

  // Skills: wizard selected + background
  const bgSkills = s.selectedBackground?.skillProficiencies ?? []
  const allSkills = [...new Set([...s.selectedSkillProficiencies, ...bgSkills])]

  // Armor proficiencies from class
  const armorProfs = s.selectedClass?.armorProficiencies ?? []
  const weaponProfs = s.selectedClass?.weaponProficiencies ?? []
  const toolProfs = [
    ...(s.selectedClass?.toolProficiencies ?? []),
    ...(s.selectedBackground?.toolProficiencies ?? []),
  ]

  // Equipment items
  const pkgItems = s.selectedEquipmentPackage?.items ?? []

  function fmtModifier(score: number): string {
    const mod = calcAbilityModifier(score)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  function ordinal(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0])
  }

  const headerClass = 'text-sm uppercase tracking-widest font-semibold text-muted-foreground mb-1'
  const blockClass = 'mb-6'

  return (
    <div className="overflow-y-auto h-full p-6">
      <h2 className="text-xl font-semibold mb-4">Review Your Character</h2>

      {/* IDENTITY */}
      <div className={blockClass}>
        <h3 className={headerClass}>Identity</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            <span className="font-semibold">Name: </span>
            {s.characterName || '—'}
          </div>
          <div>
            <span className="font-semibold">Level: </span>1
          </div>
          <div>
            <span className="font-semibold">Race: </span>
            {s.selectedRace?.name ?? '—'}
            {s.selectedSubclass && s.selectedClass?.choosesSubclassAtLevel1
              ? ''
              : ''}
          </div>
          <div>
            <span className="font-semibold">Class: </span>
            {s.selectedClass?.name ?? '—'}
            {s.selectedSubclass ? ` (${s.selectedSubclass})` : ''}
          </div>
          <div>
            <span className="font-semibold">Background: </span>
            {s.selectedBackground?.name ?? '—'}
          </div>
        </div>
      </div>

      {/* ABILITY SCORES */}
      <div className={blockClass}>
        <h3 className={headerClass}>Ability Scores</h3>
        <div className="grid grid-cols-3 gap-2 text-sm mb-2">
          {(Object.entries(previewScores) as [AbilityName, number][]).map(([ability, score]) => (
            <div key={ability} className="text-center">
              <span className="font-semibold">{ABILITY_ABBREVIATIONS[ability]} </span>
              {score} ({fmtModifier(score)})
            </div>
          ))}
        </div>
        <div className="text-sm">
          <span className="font-semibold">Saving Throws: </span>
          {(s.selectedClass?.savingThrowProficiencies ?? []).join(', ')} (class)
        </div>
        {allSkills.length > 0 && (
          <div className="text-sm mt-1">
            <span className="font-semibold">Skills: </span>
            {allSkills.join(', ')}
          </div>
        )}
      </div>

      {/* COMBAT */}
      <div className={blockClass}>
        <h3 className={headerClass}>Combat</h3>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div>
            <span className="font-semibold">HP: </span>
            {hp}
          </div>
          <div>
            <span className="font-semibold">AC: </span>
            {ac}
          </div>
          <div>
            <span className="font-semibold">Initiative: </span>
            {initiative >= 0 ? `+${initiative}` : `${initiative}`}
          </div>
          <div>
            <span className="font-semibold">Speed: </span>
            {speed} ft
          </div>
        </div>
        <div className="text-sm mt-1">
          <span className="font-semibold">Prof. Bonus: </span>+2
        </div>
      </div>

      {/* SPELL SLOTS */}
      <div className={blockClass}>
        <h3 className={headerClass}>Spell Slots</h3>
        {hasSpellSlots ? (
          <div className="text-sm space-y-1">
            {Object.entries(spellSlots).map(([level, { max }]) => (
              <div key={level}>
                <span className="font-semibold">{ordinal(parseInt(level, 10))}: </span>
                {max} slot{max !== 1 ? 's' : ''}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {s.selectedClass
              ? 'Not a spellcaster — spell slots are tracked here when available.'
              : 'Select a class to see spell slots.'}
          </p>
        )}
      </div>

      {/* EQUIPMENT */}
      {pkgItems.length > 0 && (
        <div className={blockClass}>
          <h3 className={headerClass}>Equipment</h3>
          <p className="text-sm">{s.selectedEquipmentPackage?.label}</p>
          <p className="text-sm text-muted-foreground">
            {pkgItems.map((i) => `${i.name} (×${i.quantity})`).join(', ')}
          </p>
        </div>
      )}

      {/* LANGUAGES & PROFICIENCIES */}
      <div className={blockClass}>
        <h3 className={headerClass}>Languages & Proficiencies</h3>
        <div className="text-sm space-y-1">
          <div>
            <span className="font-semibold">Languages: </span>
            {allLanguages.length > 0 ? allLanguages.join(', ') : 'None'}
          </div>
          <div>
            <span className="font-semibold">Armor: </span>
            {armorProfs.length > 0 ? armorProfs.join(', ') : 'None'}
          </div>
          <div>
            <span className="font-semibold">Weapons: </span>
            {weaponProfs.length > 0 ? weaponProfs.join(', ') : 'None'}
          </div>
          <div>
            <span className="font-semibold">Tools: </span>
            {toolProfs.length > 0 ? toolProfs.join(', ') : 'None'}
          </div>
        </div>
      </div>

      {/* Confirm note */}
      <p className="text-sm text-muted-foreground italic mt-4">
        This creates your character. You can edit stats on the sheet after creation.
      </p>
    </div>
  )
}
