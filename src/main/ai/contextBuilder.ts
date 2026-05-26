/**
 * ContextBuilder v1 — assembles the system prompt and message history for AI calls.
 * D-20: System prompt order: preamble + strictness + personality + character summary + reference docs.
 * D-21: Character summary format (verbatim from AI-SPEC §4b).
 * D-20: Last 20 messages from messages table, mapped to CoreMessage[].
 *
 * The assembled context is passed to llmProvider.streamChat().
 * The renderer never sees the system prompt.
 */

import type { ModelMessage } from 'ai'
import { charactersRepo } from '../db/charactersRepo'
import type { CharacterWithResources } from '../db/charactersRepo'
import { messagesRepo } from '../db/messagesRepo'
import { readReferenceDocs } from './referenceDocLoader'
import log from 'electron-log'

// ─── Strictness Directives (AI-SPEC §4b) ──────────────────────────────────────

const STRICTNESS_DIRECTIVES: Record<'strict' | 'balanced' | 'narrative', string> = {
  strict:
    'Apply all D&D 5e rules-as-written exactly. Reference specific rule pages if a player asks.',
  balanced:
    'Be rules-aware but prioritize story and fun over strict RAW adherence.',
  narrative:
    'Rules are flavor. Prioritize dramatic storytelling, player enjoyment, and narrative logic over mechanical accuracy.',
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface BuildContextArgs {
  campaignId: string
  config: {
    strictness: 'strict' | 'balanced' | 'narrative'
    dmPersonality?: string | null
    referenceDocs?: string[] // relative paths from campaigns.reference_docs
  }
}

export interface BuiltContext {
  systemPrompt: string
  messages: ModelMessage[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute D&D ability modifier: floor((score - 10) / 2).
 * Format with sign: "+3" or "-1" or "+0".
 */
function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

/**
 * Format the D-21 character summary block from CharacterWithResources.
 */
function formatCharacterSummary(char: CharacterWithResources): string {
  const { resources } = char

  // Line 1: Character name, level, race, class (+ subclass if present)
  const classLine = char.subclass
    ? `${char.class} (${char.subclass})`
    : char.class
  const raceLine = char.subrace ? `${char.race} (${char.subrace})` : char.race

  const line1 = `Character: ${char.name}, Level ${char.level} ${raceLine} ${classLine}`

  // Line 2: HP / AC / Speed / Initiative
  const initiative = char.initiativeBonus >= 0
    ? `+${char.initiativeBonus}`
    : `${char.initiativeBonus}`
  const line2 = `HP: ${resources.hpCurrent}/${resources.hpMax} | AC: ${char.ac} | Speed: ${char.speed} ft | Initiative: ${initiative}`

  // Line 3: Stats
  const line3 = [
    `STR ${char.strength} (${abilityMod(char.strength)})`,
    `DEX ${char.dexterity} (${abilityMod(char.dexterity)})`,
    `CON ${char.constitution} (${abilityMod(char.constitution)})`,
    `INT ${char.intelligence} (${abilityMod(char.intelligence)})`,
    `WIS ${char.wisdom} (${abilityMod(char.wisdom)})`,
    `CHA ${char.charisma} (${abilityMod(char.charisma)})`,
  ].join(' | ')
  const statsLine = `Stats: ${line3}`

  // Line 4: Proficiency bonus
  const line4 = `Proficiency Bonus: +${char.proficiencyBonus}`

  // Line 5: Spell slots (omit if empty — D-21)
  const spellSlotEntries = Object.entries(resources.spellSlots)
  let spellSlotsLine: string | null = null
  if (spellSlotEntries.length > 0) {
    const ordinals: Record<string, string> = {
      '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th',
      '6': '6th', '7': '7th', '8': '8th', '9': '9th',
    }
    const slots = spellSlotEntries
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([level, slot]) => `${ordinals[level] ?? level}: ${slot.used}/${slot.max}`)
      .join(' | ')
    spellSlotsLine = `Spell Slots: ${slots}`
  }

  // Line 6: Active conditions
  const conditionsText =
    resources.conditions.length > 0
      ? resources.conditions.join(', ')
      : 'None'
  const conditionsLine = `Active Conditions: ${conditionsText}`

  // Line 7: Inspiration
  const inspirationLine = `Inspiration: ${resources.hasInspiration ? 'Yes' : 'No'}`

  const lines = [line1, line2, statsLine, line4]
  if (spellSlotsLine) lines.push(spellSlotsLine)
  lines.push(conditionsLine, inspirationLine)

  return lines.join('\n')
}

// ─── ContextBuilder ────────────────────────────────────────────────────────────

/**
 * Assemble the full context (system prompt + message history) for an AI call.
 *
 * System prompt assembly order (D-20 / AI-SPEC §4b):
 *   1. Fixed preamble
 *   2. Strictness directive
 *   3. DM personality (or generic fallback)
 *   4. Character summary (D-21 format)
 *   5. Reference documents (one labelled section per doc)
 *
 * Messages: last 20 from messagesRepo (D-20), mapped to CoreMessage[].
 */
export function buildContext(args: BuildContextArgs): BuiltContext {
  const { campaignId, config } = args

  // Retrieve character (may be undefined if campaign has no character yet)
  const character = charactersRepo.getByCampaignId(campaignId)

  // --- Preamble ---
  const preamble =
    'You are a Dungeon Master running a D&D 5e campaign. Your role is to narrate the world, portray NPCs, describe consequences, and facilitate the story. The player is the sole protagonist.'

  // --- Strictness directive ---
  const strictnessKey = config.strictness in STRICTNESS_DIRECTIVES
    ? config.strictness
    : 'balanced'
  const strictnessDirective = `Rules approach: ${STRICTNESS_DIRECTIVES[strictnessKey]}`

  // --- DM personality ---
  const personality = config.dmPersonality?.trim()
    ? `DM style: ${config.dmPersonality.trim()}`
    : 'DM style: Classic adventure DM — balanced tone, fair challenges, memorable moments.'

  // --- Character summary ---
  let characterSummaryBlock = ''
  if (character) {
    characterSummaryBlock = '\n' + formatCharacterSummary(character)
  }

  // --- Reference documents ---
  const referenceDocs = config.referenceDocs ?? []
  let referenceDocBlock = ''
  if (referenceDocs.length > 0) {
    const docs = readReferenceDocs(referenceDocs)
    if (docs.length > 0) {
      referenceDocBlock =
        '\n' +
        docs
          .map((doc) => `\n=== ${doc.title} ===\n${doc.content}`)
          .join('\n')
    }
  }

  // --- Assemble system prompt ---
  const systemPrompt = [preamble, strictnessDirective, personality, characterSummaryBlock]
    .filter((part) => part.length > 0)
    .join('\n\n')
    + referenceDocBlock

  // --- Message history (last 20, D-20) ---
  const rawMessages = messagesRepo.getLastN(campaignId, 20)
  // Map DB messages to ModelMessage union — role is stored as 'user' | 'assistant'
  const messages: ModelMessage[] = rawMessages.map((msg) => {
    if (msg.role === 'assistant') {
      return { role: 'assistant' as const, content: msg.content }
    }
    return { role: 'user' as const, content: msg.content }
  })

  log.debug('[contextBuilder] buildContext', {
    campaignId,
    systemPromptLength: systemPrompt.length,
    messageCount: messages.length,
    hasCharacter: !!character,
    referenceDocCount: referenceDocs.length,
  })

  return { systemPrompt, messages }
}

/**
 * Re-export ModelMessage as CoreMessage for convenience.
 * AI SDK v6 renamed CoreMessage to ModelMessage.
 */
export type CoreMessage = ModelMessage

// Export for testing
export { STRICTNESS_DIRECTIVES, formatCharacterSummary, abilityMod }
