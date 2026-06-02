/**
 * Tests for pdfService (DIST-02).
 *
 * Validates: non-empty Buffer output, spellcaster produces 2-page PDF, martial produces 1-page PDF.
 *
 * NOTE — Packaged-build smoke test required before ship:
 * React 19 reconciler compatibility (Open Question 1) and yoga-layout __dirname resolution
 * (Assumption A2) can ONLY be verified in an electron-vite packaged build, not in dev/vitest.
 * Before shipping DIST-02, manually run:
 *   npm run compile:app && electron out/main/index.js
 * then export a martial character (expect 1-page PDF) and a spellcaster (expect 2-page PDF).
 * Verify white background + readable two-column layout in both cases.
 */

import { describe, it, expect, vi } from 'vitest'
import type { CharacterPdfData } from './CharacterSheetPdf'

// ─── Electron mock ────────────────────────────────────────────────────────────
// pdfService uses electron-log which requires electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test'),
    isPackaged: false,
  },
}))

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const MARTIAL_DATA: CharacterPdfData = {
  name: 'Thorin Ironfist',
  race: 'Dwarf',
  classLabel: 'Fighter',
  background: 'Soldier',
  level: 5,
  alignment: 'Lawful Good',

  strength: 18,
  dexterity: 14,
  constitution: 16,
  intelligence: 10,
  wisdom: 12,
  charisma: 8,

  strMod: 4,
  dexMod: 2,
  conMod: 3,
  intMod: 0,
  wisMod: 1,
  chaMod: -1,

  savingThrows: {
    strength: { proficient: true, value: 7 },
    dexterity: { proficient: false, value: 2 },
    constitution: { proficient: true, value: 6 },
    intelligence: { proficient: false, value: 0 },
    wisdom: { proficient: false, value: 1 },
    charisma: { proficient: false, value: -1 },
  },

  skills: [
    { name: 'Athletics', ability: 'strength', proficient: true, expertise: false, value: 7 },
    { name: 'Intimidation', ability: 'charisma', proficient: true, expertise: false, value: 2 },
    { name: 'Perception', ability: 'wisdom', proficient: false, expertise: false, value: 1 },
    { name: 'Stealth', ability: 'dexterity', proficient: false, expertise: false, value: 2 },
  ],

  passivePerception: 11,

  hpCurrent: 45,
  hpMax: 52,
  hpTemp: 0,
  ac: 18,
  speed: 25,
  initiative: 2,
  proficiencyBonus: 3,
  hasInspiration: false,

  deathSaveSuccesses: 0,
  deathSaveFailures: 0,

  conditions: [],

  cp: 0,
  sp: 10,
  ep: 0,
  gp: 75,
  pp: 0,

  equipment: [
    { name: 'Plate Armor', quantity: 1, isMagic: false },
    { name: 'Battleaxe', quantity: 1, isMagic: false },
    { name: 'Handaxe', quantity: 2, isMagic: false },
    { name: 'Shield', quantity: 1, isMagic: false },
    { name: 'Backpack', quantity: 1, isMagic: false },
    { name: 'Rations (1 day)', quantity: 10, isMagic: false },
  ],

  personality: 'I judge people by their actions, not their words.',
  ideals: 'Responsibility. I do what I must.',
  bonds: 'My honor is my life.',
  flaws: 'I made a terrible mistake in battle that cost many lives.',

  hasSpells: false,
  spellSlots: {},
  spells: [],
}

const SPELLCASTER_DATA: CharacterPdfData = {
  ...MARTIAL_DATA,
  name: 'Lyra Moonwhisper',
  race: 'High Elf',
  classLabel: 'Wizard',
  background: 'Sage',
  level: 5,

  intelligence: 18,
  intMod: 4,

  savingThrows: {
    ...MARTIAL_DATA.savingThrows,
    intelligence: { proficient: true, value: 7 },
    wisdom: { proficient: true, value: 4 },
  },

  skills: [
    { name: 'Arcana', ability: 'intelligence', proficient: true, expertise: false, value: 7 },
    { name: 'History', ability: 'intelligence', proficient: true, expertise: false, value: 7 },
    { name: 'Investigation', ability: 'intelligence', proficient: false, expertise: false, value: 4 },
    { name: 'Perception', ability: 'wisdom', proficient: true, expertise: false, value: 4 },
  ],

  hasSpells: true,

  spellSlots: {
    '1': { used: 1, max: 4 },
    '2': { used: 0, max: 3 },
    '3': { used: 0, max: 2 },
  },

  spells: [
    { name: 'Fire Bolt', level: 0, school: 'Evocation', concentration: false, ritual: false, isPrepared: true },
    { name: 'Light', level: 0, school: 'Evocation', concentration: false, ritual: false, isPrepared: true },
    { name: 'Mage Hand', level: 0, school: 'Conjuration', concentration: false, ritual: false, isPrepared: true },
    { name: 'Magic Missile', level: 1, school: 'Evocation', concentration: false, ritual: false, isPrepared: true },
    { name: 'Shield', level: 1, school: 'Abjuration', concentration: false, ritual: false, isPrepared: true },
    { name: 'Detect Magic', level: 1, school: 'Divination', concentration: true, ritual: true, isPrepared: true },
    { name: 'Misty Step', level: 2, school: 'Conjuration', concentration: false, ritual: false, isPrepared: true },
    { name: 'Fireball', level: 3, school: 'Evocation', concentration: false, ritual: false, isPrepared: true },
    { name: 'Counterspell', level: 3, school: 'Abjuration', concentration: false, ritual: false, isPrepared: true },
  ],
}

// ─── Helper: count PDF pages ──────────────────────────────────────────────────

/**
 * Count pages in a PDF buffer by counting /Type /Page entries (excluding /Pages).
 * This avoids a PDF parser dependency while being reasonably accurate for react-pdf output.
 */
function countPdfPages(buffer: Buffer): number {
  const str = buffer.toString('latin1')
  // Match '/Type /Page' but not '/Type /Pages'
  const matches = str.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 0
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('pdfService', () => {
  it('generateCharacterPdf with a martial character returns a non-empty Buffer', async () => {
    const { generateCharacterPdf } = await import('./pdfService')
    const buffer = await generateCharacterPdf(MARTIAL_DATA)

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('generateCharacterPdf with a spellcaster produces a 2-page PDF', async () => {
    const { generateCharacterPdf } = await import('./pdfService')
    const buffer = await generateCharacterPdf(SPELLCASTER_DATA)

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)

    const pageCount = countPdfPages(buffer)
    expect(pageCount).toBe(2)
  })

  it('generateCharacterPdf with a martial character produces a 1-page PDF', async () => {
    const { generateCharacterPdf } = await import('./pdfService')
    const buffer = await generateCharacterPdf(MARTIAL_DATA)

    expect(buffer).toBeInstanceOf(Buffer)
    const pageCount = countPdfPages(buffer)
    expect(pageCount).toBe(1)
  })
})
