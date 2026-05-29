/**
 * ContextBuilder v2 — session-aware three-layer memory assembly for AI calls.
 *
 * D-17: System prompt injection order:
 *   preamble + strictness + personality + character summary + reference docs
 *   + L3 (rolling campaign summary) + L2 (recent session recaps) + sessionContext
 *
 * D-14 (L1): Current session messages via getBySessionId.
 *   Overflow (>24000 chars) triggers fallback to last 30 messages.
 * D-15 (L2): Last 3 completed session recaps, truncated to 8000 chars.
 * D-16 (L3): campaigns.rollingSummary, truncated to 4000 chars.
 *
 * The assembled context is passed to llmProvider.streamChat().
 * The renderer never sees the system prompt.
 */

import type { ModelMessage } from 'ai'
import { charactersRepo } from '../db/charactersRepo'
import type { CharacterWithResources } from '../db/charactersRepo'
import { messagesRepo } from '../db/messagesRepo'
import { sessionsRepo } from '../db/sessionsRepo'
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

// ─── Input Types (v2) ─────────────────────────────────────────────────────────

export interface BuildContextArgs {
  campaignId: string
  sessionId: string | null   // null = no active session (graceful degradation)
  sessionContext?: {
    location: string | null
    goal: string | null
    contextNotes: string | null
  }
  config: {
    strictness: 'strict' | 'balanced' | 'narrative'
    dmPersonality?: string | null
    referenceDocs?: string[] // relative paths from campaigns.reference_docs
    rollingSummary?: string | null // campaigns.rolling_summary (L3)
  }
}

export interface BuiltContext {
  systemPrompt: string
  messages: ModelMessage[]
  isL1Overflow: boolean // flag for renderer warning banner
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

  // Phase 5: concentration (D-25, Pitfall 8) — informs the AI it's already concentrating.
  if (resources.concentratingOn) {
    lines.push(`Concentrating on: ${resources.concentratingOn}`)
  }
  // Phase 5: hit dice remaining (D-38) — for short-rest decisions.
  if (resources.hitDiceCurrent != null && resources.hitDiceTotal != null) {
    lines.push(`Hit Dice: ${resources.hitDiceCurrent}/${resources.hitDiceTotal}`)
  }

  return lines.join('\n')
}

// ─── Phase 5: Tool-usage system prompt block (D-02, D-08) ─────────────────────

/**
 * Natural-language description of the game-mechanics tools the AI controls, plus
 * the JSON-tail fallback format (D-02) so providers WITHOUT native tool calling
 * can still drive mutations by appending a fenced block at the very end of the
 * message. The fenced block must be the last thing in the message.
 */
const toolDescriptionsBlock = `
Game mechanics you control (use these tool calls during play):
- Use \`updateHp\` when a creature takes damage or is healed. Delta is negative for damage, positive for healing.
- Use \`applyCondition\`/\`removeCondition\` for status effects (Poisoned, Stunned, Blinded, etc.)
- Use \`showDiceRoll\` whenever you make an attack, saving throw, or skill check — always show your dice so the player can see. Call it for every roll.
- Use \`addCombatant\` at the start of combat to add enemies to the initiative tracker. Include their HP, AC, and initiative order.
- Use \`endCombat\` when all enemies are defeated or the encounter ends.
- Use \`awardXp\` after encounters. Typical encounter = 50-500 XP depending on difficulty.
- Use \`deductSpellSlot\` when the player casts a leveled spell.
- Use \`updateCurrency\` when the party finds loot or spends money. Values are deltas (positive = gain).
- Use \`processRest\` to grant the player's rest request if narratively appropriate.

If your provider does not support native tool calls, append a single fenced block at the VERY END of your message (after all narration), in this exact form:
\`\`\`json
{"mutations":[{"toolName":"updateHp","args":{"delta":-6,"source":"Goblin"}}]}
\`\`\`
Only include the block when there are mutations to apply, and never place it mid-message.
`.trim()

// ─── ContextBuilder v2 ────────────────────────────────────────────────────────

// Token estimation: 4 chars ≈ 1 token (D-18 — best-effort estimate)
const CHARS_L1_OVERFLOW = 6000 * 4 // 24,000 chars
const CHARS_L2_CAP = 2000 * 4      // 8,000 chars
const CHARS_L3_CAP = 1000 * 4      // 4,000 chars

/**
 * Assemble the full context (system prompt + message history) for an AI call.
 *
 * System prompt assembly order (D-17):
 *   1. Preamble + strictness + personality + character summary
 *   2. Reference documents
 *   3. L3: rolling campaign summary (campaigns.rollingSummary)
 *   4. L2: up to 3 recent completed session recaps
 *   5. Session start context (location, goal, contextNotes)
 *
 * Messages (L1): current session messages via getBySessionId.
 *   Overflow (>CHARS_L1_OVERFLOW) falls back to getLastNForSession(30).
 */
export function buildContext(args: BuildContextArgs): BuiltContext {
  const { campaignId, sessionId, sessionContext, config } = args

  // --- L1: current session messages (D-14) ---
  let sessionMessages = sessionId ? messagesRepo.getBySessionId(sessionId) : []
  let isL1Overflow = false
  if (sessionMessages.length > 0) {
    const totalChars = sessionMessages.reduce((sum, m) => sum + m.content.length, 0)
    if (totalChars > CHARS_L1_OVERFLOW) {
      isL1Overflow = true
      sessionMessages = messagesRepo.getLastNForSession(sessionId!, 30)
    }
  }

  // --- L2: 3 most recent completed session recaps (D-15) ---
  const recentSessions = sessionsRepo.getLastNCompleted(campaignId, 3)
  let l2Block = ''
  let l2CharCount = 0
  // recentSessions is oldest-first; iterate newest-first so most-recent sessions
  // get included when cap is tight
  for (const session of [...recentSessions].reverse()) {
    const label = `\nPrevious Sessions — Session ${session.sessionNumber}:\n`
    const content = session.aiRecap ?? ''
    const candidate = label + content
    if (l2CharCount + candidate.length > CHARS_L2_CAP) {
      const remaining = CHARS_L2_CAP - l2CharCount
      if (remaining > 0) {
        l2Block += candidate.substring(0, remaining)
      }
      break
    }
    l2Block += candidate
    l2CharCount += candidate.length
  }

  // --- L3: rolling campaign summary (D-16) ---
  const rollingSummary = config.rollingSummary
    ? config.rollingSummary.substring(0, CHARS_L3_CAP)
    : null
  const l3Block = rollingSummary ? `\nCampaign History So Far:\n${rollingSummary}` : ''

  // --- Session start context block (D-17 item 5) ---
  let sessionContextBlock = ''
  if (sessionContext) {
    const parts: string[] = ['\nCurrent Session:']
    if (sessionContext.location) parts.push(`Location: ${sessionContext.location}`)
    if (sessionContext.goal) parts.push(`Goal: ${sessionContext.goal}`)
    if (sessionContext.contextNotes) parts.push(`Notes: ${sessionContext.contextNotes}`)
    sessionContextBlock = parts.join('\n')
  }

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
  const character = charactersRepo.getByCampaignId(campaignId)
  const characterSummaryBlock = character ? '\n' + formatCharacterSummary(character) : ''

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

  // --- Assemble system prompt (D-17 order) ---
  // preamble + strictness + personality + character, then the Phase 5 tool block,
  // then referenceDocBlock, then l3Block, then l2Block, then sessionContextBlock
  const systemPrompt =
    [preamble, strictnessDirective, personality, characterSummaryBlock]
      .filter((part) => part.length > 0)
      .join('\n\n')
    + '\n\n' + toolDescriptionsBlock
    + referenceDocBlock
    + l3Block
    + l2Block
    + sessionContextBlock

  // --- Messages array: L1 (current session — NOT in system prompt) ---
  const messages: ModelMessage[] = sessionMessages.map((msg) => {
    if (msg.role === 'assistant') {
      return { role: 'assistant' as const, content: msg.content }
    }
    return { role: 'user' as const, content: msg.content }
  })

  log.debug('[contextBuilder] buildContext v2', {
    campaignId,
    sessionId,
    systemPromptLength: systemPrompt.length,
    messageCount: messages.length,
    isL1Overflow,
    l2Sessions: recentSessions.length,
    hasL3: !!rollingSummary,
  })

  return { systemPrompt, messages, isL1Overflow }
}

/**
 * Re-export ModelMessage as CoreMessage for convenience.
 * AI SDK v6 renamed CoreMessage to ModelMessage.
 */
export type CoreMessage = ModelMessage

// Export for testing
export { STRICTNESS_DIRECTIVES, formatCharacterSummary, abilityMod }
