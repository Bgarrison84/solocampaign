/**
 * CharacterSheetPdf — react-pdf Document for character sheet export (DIST-02).
 *
 * IMPORTANT: Import ONLY from @react-pdf/renderer. No DOM imports. No browser globals.
 * No Font.register() — built-in Helvetica/Helvetica-Bold only (ASAR safety, Landmine 7).
 *
 * Two-column A4 layout:
 *   Page 1 — Header + Left col (ability scores, saves, skills) + Right col (HP/AC/initiative,
 *             death saves, conditions, currency) + Bottom (equipment, personality traits)
 *   Page 2 — Spell list (conditional on data.hasSpells — D-12)
 */

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ─── CharacterPdfData ────────────────────────────────────────────────────────

/**
 * All data needed to render the character sheet PDF.
 * Constructed in the tRPC exportPdf procedure from charactersRepo + characterSpellsRepo.
 */
export interface CharacterPdfData {
  // Identity
  name: string
  race: string
  classLabel: string  // e.g. "Wizard" or "Fighter 5 / Rogue 3" for multiclass
  background: string
  level: number
  alignment?: string

  // Ability scores (raw values 1–30)
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number

  // Modifiers (pre-computed)
  strMod: number
  dexMod: number
  conMod: number
  intMod: number
  wisMod: number
  chaMod: number

  // Saving throws (proficiency flags)
  savingThrows: {
    strength: { proficient: boolean; value: number }
    dexterity: { proficient: boolean; value: number }
    constitution: { proficient: boolean; value: number }
    intelligence: { proficient: boolean; value: number }
    wisdom: { proficient: boolean; value: number }
    charisma: { proficient: boolean; value: number }
  }

  // Skills (proficiency + expertise flags, computed bonus)
  skills: Array<{
    name: string
    ability: string
    proficient: boolean
    expertise: boolean
    value: number
  }>

  // Passive perception
  passivePerception: number

  // Combat
  hpCurrent: number
  hpMax: number
  hpTemp: number
  ac: number
  speed: number
  initiative: number
  proficiencyBonus: number
  hasInspiration: boolean

  // Death saves
  deathSaveSuccesses: number
  deathSaveFailures: number

  // Conditions
  conditions: string[]

  // Currency
  cp: number
  sp: number
  ep: number
  gp: number
  pp: number

  // Equipment (truncated to ~20 items in render)
  equipment: Array<{ name: string; quantity: number; isMagic: boolean }>

  // Personality traits
  personality?: string
  ideals?: string
  bonds?: string
  flaws?: string

  // Spells
  hasSpells: boolean
  spellSlots: Record<string, { used: number; max: number }>
  spells: Array<{
    name: string
    level: number
    school?: string
    concentration?: boolean
    ritual?: boolean
    isPrepared: boolean
  }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function formatSlotDots(used: number, max: number): string {
  const filled = max - used
  const empty = used
  return '●'.repeat(Math.max(0, filled)) + '○'.repeat(Math.max(0, empty))
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Pages
  page: {
    backgroundColor: '#ffffff',
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111111',
  },

  // ── Header ──
  header: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1pt solid #cccccc',
  },
  characterName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 2,
  },
  characterSubtitle: {
    fontSize: 9,
    color: '#666666',
  },

  // ── Two-column body ──
  body: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  leftCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  rightCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },

  // ── Section containers ──
  section: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '0.5pt solid #cccccc',
    paddingBottom: 1,
  },

  // ── Ability score boxes (3-column grid) ──
  abilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  abilityBox: {
    width: 52,
    height: 58,
    border: '1pt solid #cccccc',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 4,
  },
  abilityAbbr: {
    fontSize: 7,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  abilityScore: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    lineHeight: 1,
    marginBottom: 1,
  },
  abilityMod: {
    fontSize: 9,
    color: '#444444',
  },

  // ── Saves & Skills rows ──
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1.5,
    gap: 4,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1.5,
    gap: 4,
  },
  profMark: {
    fontSize: 8,
    width: 10,
    textAlign: 'center',
  },
  saveLabel: {
    fontSize: 8,
    color: '#333333',
    flex: 1,
  },
  saveValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    width: 20,
    textAlign: 'right',
  },
  passiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  passiveLabel: {
    fontSize: 8,
    color: '#666666',
    flex: 1,
  },
  passiveValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },

  // ── Combat stat boxes ──
  combatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  statBox: {
    width: 52,
    border: '1pt solid #cccccc',
    borderRadius: 3,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    backgroundColor: '#ffffff',
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    lineHeight: 1,
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 6.5,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  hpBox: {
    width: 72,
    border: '1pt solid #cccccc',
    borderRadius: 3,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    backgroundColor: '#ffffff',
  },

  // ── Death saves ──
  deathSavesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  deathSaveGroup: {
    flex: 1,
  },
  deathSaveTitle: {
    fontSize: 7,
    color: '#666666',
    marginBottom: 1,
  },
  deathSaveDots: {
    fontSize: 9,
    color: '#333333',
  },

  // ── Conditions ──
  conditionBadge: {
    fontSize: 7,
    color: '#333333',
    border: '0.5pt solid #aaaaaa',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginRight: 2,
    marginBottom: 2,
  },
  conditionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  noConditions: {
    fontSize: 8,
    color: '#999999',
    fontStyle: 'italic',
  },

  // ── Currency ──
  currencyRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  currencyItem: {
    alignItems: 'center',
    minWidth: 28,
  },
  currencyValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  currencyLabel: {
    fontSize: 6.5,
    color: '#666666',
    textTransform: 'uppercase',
  },

  // ── Bottom full-width sections ──
  bottomSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: '0.5pt solid #cccccc',
  },
  equipmentItem: {
    fontSize: 8,
    color: '#111111',
    marginBottom: 1,
  },
  equipmentMagic: {
    fontSize: 8,
    color: '#444444',
    fontStyle: 'italic',
    marginBottom: 1,
  },
  traitLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#555555',
    marginBottom: 1,
  },
  traitText: {
    fontSize: 8,
    color: '#333333',
    marginBottom: 4,
  },
  inspirationText: {
    fontSize: 8,
    color: '#444444',
    fontStyle: 'italic',
  },

  // ── Spell page ──
  spellPageHeader: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1pt solid #cccccc',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  slotLevel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    width: 40,
  },
  slotDots: {
    fontSize: 9,
    color: '#333333',
    flex: 1,
  },
  slotNumbers: {
    fontSize: 8,
    color: '#666666',
    width: 40,
    textAlign: 'right',
  },
  spellTableHeader: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #aaaaaa',
    paddingBottom: 2,
    marginBottom: 3,
    marginTop: 8,
  },
  spellHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  spellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottom: '0.3pt solid #eeeeee',
    paddingVertical: 1.5,
  },
  spellName: {
    fontSize: 8,
    color: '#111111',
    flex: 3,
  },
  spellLevel: {
    fontSize: 7,
    color: '#444444',
    width: 30,
    textAlign: 'center',
  },
  spellSchool: {
    fontSize: 7,
    color: '#444444',
    flex: 2,
  },
  spellConc: {
    fontSize: 7,
    color: '#444444',
    width: 24,
    textAlign: 'center',
  },
  spellRitual: {
    fontSize: 7,
    color: '#444444',
    width: 24,
    textAlign: 'center',
  },
  spellLevelGroup: {
    marginTop: 6,
  },
  spellLevelTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 2,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function AbilityBox({ abbr, score, mod }: { abbr: string; score: number; mod: number }) {
  return (
    <View style={styles.abilityBox}>
      <Text style={styles.abilityAbbr}>{abbr}</Text>
      <Text style={styles.abilityScore}>{score}</Text>
      <Text style={styles.abilityMod}>{formatModifier(mod)}</Text>
    </View>
  )
}

function SavingThrowsSection({ data }: { data: CharacterPdfData }) {
  const saves = [
    { label: 'Strength', ...data.savingThrows.strength },
    { label: 'Dexterity', ...data.savingThrows.dexterity },
    { label: 'Constitution', ...data.savingThrows.constitution },
    { label: 'Intelligence', ...data.savingThrows.intelligence },
    { label: 'Wisdom', ...data.savingThrows.wisdom },
    { label: 'Charisma', ...data.savingThrows.charisma },
  ]
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Saving Throws</Text>
      {saves.map((s) => (
        <View key={s.label} style={styles.saveRow}>
          <Text style={styles.profMark}>{s.proficient ? '●' : '◦'}</Text>
          <Text style={styles.saveLabel}>{s.label}</Text>
          <Text style={styles.saveValue}>{formatModifier(s.value)}</Text>
        </View>
      ))}
    </View>
  )
}

function SkillsSection({ data }: { data: CharacterPdfData }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Skills</Text>
      {data.skills.map((sk) => (
        <View key={sk.name} style={styles.skillRow}>
          <Text style={styles.profMark}>
            {sk.expertise ? '◈' : sk.proficient ? '●' : '◦'}
          </Text>
          <Text style={[styles.saveLabel, { flex: 1.5 }]}>{sk.name}</Text>
          <Text style={[styles.saveLabel, { color: '#888888', width: 22 }]}>
            ({sk.ability.slice(0, 3).toUpperCase()})
          </Text>
          <Text style={styles.saveValue}>{formatModifier(sk.value)}</Text>
        </View>
      ))}
      <View style={styles.passiveRow}>
        <Text style={styles.passiveLabel}>Passive Perception</Text>
        <Text style={styles.passiveValue}>{data.passivePerception}</Text>
      </View>
    </View>
  )
}

function CombatStatsSection({ data }: { data: CharacterPdfData }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Combat</Text>
      <View style={styles.combatGrid}>
        <View style={styles.hpBox}>
          <Text style={styles.statValue}>
            {data.hpCurrent}/{data.hpMax}
          </Text>
          <Text style={styles.statLabel}>
            Hit Points{data.hpTemp > 0 ? ` (+${data.hpTemp} temp)` : ''}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.ac}</Text>
          <Text style={styles.statLabel}>Armor Class</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.speed}</Text>
          <Text style={styles.statLabel}>Speed (ft)</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatModifier(data.initiative)}</Text>
          <Text style={styles.statLabel}>Initiative</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>+{data.proficiencyBonus}</Text>
          <Text style={styles.statLabel}>Prof. Bonus</Text>
        </View>
        {data.hasInspiration && (
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { fontSize: 10 }]}>★</Text>
            <Text style={styles.statLabel}>Inspiration</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function DeathSavesSection({ data }: { data: CharacterPdfData }) {
  // Clamp to [0, 3] so .repeat() never receives a negative count (CR-03).
  const successes = Math.min(3, Math.max(0, data.deathSaveSuccesses))
  const failures  = Math.min(3, Math.max(0, data.deathSaveFailures))
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Death Saves</Text>
      <View style={styles.deathSavesRow}>
        <View style={styles.deathSaveGroup}>
          <Text style={styles.deathSaveTitle}>Successes</Text>
          <Text style={styles.deathSaveDots}>
            {'●'.repeat(successes) + '○'.repeat(3 - successes)}
          </Text>
        </View>
        <View style={styles.deathSaveGroup}>
          <Text style={styles.deathSaveTitle}>Failures</Text>
          <Text style={styles.deathSaveDots}>
            {'●'.repeat(failures) + '○'.repeat(3 - failures)}
          </Text>
        </View>
      </View>
    </View>
  )
}

function ConditionsSection({ data }: { data: CharacterPdfData }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Conditions</Text>
      {data.conditions.length === 0 ? (
        <Text style={styles.noConditions}>None</Text>
      ) : (
        <View style={styles.conditionsWrap}>
          {data.conditions.map((c) => (
            <Text key={c} style={styles.conditionBadge}>{c}</Text>
          ))}
        </View>
      )}
    </View>
  )
}

function CurrencySection({ data }: { data: CharacterPdfData }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Currency</Text>
      <View style={styles.currencyRow}>
        {[
          { label: 'CP', value: data.cp },
          { label: 'SP', value: data.sp },
          { label: 'EP', value: data.ep },
          { label: 'GP', value: data.gp },
          { label: 'PP', value: data.pp },
        ].map(({ label, value }) => (
          <View key={label} style={styles.currencyItem}>
            <Text style={styles.currencyValue}>{value}</Text>
            <Text style={styles.currencyLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function EquipmentSection({ data }: { data: CharacterPdfData }) {
  const items = data.equipment.slice(0, 20)
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Equipment{data.equipment.length > 20 ? ` (showing 20 of ${data.equipment.length})` : ''}
      </Text>
      {items.map((item, i) => (
        <Text
          key={i}
          style={item.isMagic ? styles.equipmentMagic : styles.equipmentItem}
        >
          {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
          {item.isMagic ? ' (magic)' : ''}
        </Text>
      ))}
      {items.length === 0 && (
        <Text style={styles.noConditions}>No equipment</Text>
      )}
    </View>
  )
}

function TraitsSection({ data }: { data: CharacterPdfData }) {
  const traits = [
    { label: 'Personality', value: data.personality },
    { label: 'Ideals', value: data.ideals },
    { label: 'Bonds', value: data.bonds },
    { label: 'Flaws', value: data.flaws },
  ].filter((t) => t.value)

  if (traits.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Personality Traits</Text>
      {traits.map(({ label, value }) => (
        <View key={label}>
          <Text style={styles.traitLabel}>{label}</Text>
          <Text style={styles.traitText}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Spell List Page ──────────────────────────────────────────────────────────

function SpellListPage({ data }: { data: CharacterPdfData }) {
  const slotLevels = Object.entries(data.spellSlots)
    .filter(([, slot]) => slot.max > 0)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))

  // Group spells by level
  const spellsByLevel = data.spells.reduce<Record<number, typeof data.spells>>((acc, spell) => {
    const lvl = spell.level
    if (!acc[lvl]) acc[lvl] = []
    acc[lvl].push(spell)
    return acc
  }, {})

  const sortedLevels = Object.keys(spellsByLevel)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.spellPageHeader}>
        {data.name} — Spell List
      </Text>

      {/* Spell slots summary */}
      {slotLevels.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spell Slots</Text>
          {slotLevels.map(([level, slot]) => (
            <View key={level} style={styles.slotRow}>
              <Text style={styles.slotLevel}>Level {level}</Text>
              <Text style={styles.slotDots}>{formatSlotDots(slot.used, slot.max)}</Text>
              <Text style={styles.slotNumbers}>
                {slot.max - slot.used}/{slot.max}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Spells table header */}
      {data.spells.length > 0 && (
        <View>
          <View style={styles.spellTableHeader}>
            <Text style={[styles.spellHeaderCell, { flex: 3 }]}>Spell Name</Text>
            <Text style={[styles.spellHeaderCell, { width: 30, textAlign: 'center' }]}>Lvl</Text>
            <Text style={[styles.spellHeaderCell, { flex: 2 }]}>School</Text>
            <Text style={[styles.spellHeaderCell, { width: 24, textAlign: 'center' }]}>Conc.</Text>
            <Text style={[styles.spellHeaderCell, { width: 24, textAlign: 'center' }]}>Rit.</Text>
          </View>

          {/* Spells grouped by level */}
          {sortedLevels.map((lvl) => (
            <View key={lvl} style={styles.spellLevelGroup}>
              <Text style={styles.spellLevelTitle}>
                {lvl === 0 ? 'Cantrips' : `Level ${lvl}`}
              </Text>
              {spellsByLevel[lvl].map((spell, i) => (
                <View key={i} style={styles.spellRow}>
                  <Text style={styles.spellName}>
                    {spell.name}{!spell.isPrepared ? ' *' : ''}
                  </Text>
                  <Text style={styles.spellLevel}>{lvl === 0 ? '—' : lvl}</Text>
                  <Text style={styles.spellSchool}>{spell.school ?? '—'}</Text>
                  <Text style={styles.spellConc}>{spell.concentration ? 'C' : ''}</Text>
                  <Text style={styles.spellRitual}>{spell.ritual ? 'R' : ''}</Text>
                </View>
              ))}
            </View>
          ))}
          <Text style={{ fontSize: 7, color: '#999999', marginTop: 6 }}>
            * unprepared spells
          </Text>
        </View>
      )}

      {data.spells.length === 0 && (
        <Text style={styles.noConditions}>No spells recorded.</Text>
      )}
    </Page>
  )
}

// ─── Main Document ────────────────────────────────────────────────────────────

export function CharacterSheetPdf({ data }: { data: CharacterPdfData }) {
  return (
    <Document title={`${data.name} — Character Sheet`} author="SoloCampaign">
      {/* ── Page 1: Character sheet ─────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.characterName}>{data.name}</Text>
          <Text style={styles.characterSubtitle}>
            {data.race} {data.classLabel} — Level {data.level}
            {data.background ? `  |  Background: ${data.background}` : ''}
            {data.alignment ? `  |  ${data.alignment}` : ''}
          </Text>
        </View>

        {/* Two-column body */}
        <View style={[styles.body, { flex: 1 }]}>
          {/* ── LEFT COLUMN: Ability scores, saves, skills ── */}
          <View style={styles.leftCol}>
            {/* Ability score boxes in 3×2 grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ability Scores</Text>
              <View style={styles.abilityGrid}>
                <AbilityBox abbr="STR" score={data.strength} mod={data.strMod} />
                <AbilityBox abbr="DEX" score={data.dexterity} mod={data.dexMod} />
                <AbilityBox abbr="CON" score={data.constitution} mod={data.conMod} />
                <AbilityBox abbr="INT" score={data.intelligence} mod={data.intMod} />
                <AbilityBox abbr="WIS" score={data.wisdom} mod={data.wisMod} />
                <AbilityBox abbr="CHA" score={data.charisma} mod={data.chaMod} />
              </View>
            </View>

            <SavingThrowsSection data={data} />
            <SkillsSection data={data} />
          </View>

          {/* ── RIGHT COLUMN: Combat stats, death saves, conditions, currency ── */}
          <View style={styles.rightCol}>
            <CombatStatsSection data={data} />
            <DeathSavesSection data={data} />
            <ConditionsSection data={data} />
            <CurrencySection data={data} />
          </View>
        </View>

        {/* Bottom full-width: Equipment + Personality traits */}
        <View style={styles.bottomSection}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <EquipmentSection data={data} />
            </View>
            <View style={{ flex: 1 }}>
              <TraitsSection data={data} />
            </View>
          </View>
        </View>
      </Page>

      {/* ── Page 2: Spell list (conditional on hasSpells — D-12) ── */}
      {data.hasSpells && <SpellListPage data={data} />}
    </Document>
  )
}
