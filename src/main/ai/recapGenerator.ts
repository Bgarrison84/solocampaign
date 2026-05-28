/**
 * Recap generator for SoloCampaign session summaries.
 *
 * Provides generateText wrappers for:
 * - generateSessionRecap: produces a concise DM-record-style summary of a session
 * - generateRollingSummary: synthesizes older session summaries into a single Layer 3 summary
 *
 * Design decisions:
 * - D-12: Fixed hardcoded system prompts; DM personality/strictness NOT applied (this is a summarization task)
 * - D-16: Rolling summary uses maxTokens=1000 to respect Layer 3 cap
 * - Pitfall 4: Always uses primary provider config (not fallback) for recap/summary generation
 * - T-04-03-03: apiKey intentionally omitted from all log calls
 */

import { generateText } from 'ai'
import type { ModelMessage } from 'ai'
import { buildModel } from './llmProvider'
import type { LLMProviderConfig } from './llmProvider'
import log from 'electron-log'

/**
 * System prompt for session recap generation (D-12).
 * Produces a factual, concise DM-record summary used for Layer 2 memory injection.
 */
export const RECAP_SYSTEM_PROMPT =
  'You are a Dungeon Master\'s record-keeper. Summarize the following D&D 5e session in ' +
  'concise, third-person prose suitable for a DM\'s session notes. Include: key events in ' +
  'order, significant NPC interactions, decisions the player made, any combat outcomes, and ' +
  'where the session ended. Be factual and specific. Omit flavor prose — this is a reference ' +
  'record, not narrative. Aim for 3-6 paragraphs.'

/**
 * System prompt for rolling campaign summary generation (D-16).
 * Synthesizes session summaries into a single Layer 3 campaign summary.
 */
export const ROLLING_SUMMARY_SYSTEM_PROMPT =
  'You are a Dungeon Master\'s campaign archivist. The following are session summaries from ' +
  'earlier in a D&D 5e campaign. Synthesize them into a single cohesive campaign summary of ' +
  'no more than 800 words. Capture: the overall story arc, key NPCs and their relationships ' +
  'to the player, major plot points resolved or ongoing, and the current state of the world. ' +
  'This summary will be injected into future AI context windows, so be precise and ' +
  'information-dense. Use past tense.'

/**
 * Generate a session recap from all messages in the session.
 * Uses generateText (not streamText) since this is a summarization task, not live gameplay.
 * Temperature 0.3 for consistent, factual output.
 *
 * Security: apiKey is intentionally not logged (T-04-03-03).
 * Pitfall 4: Always uses primary provider config.
 */
export async function generateSessionRecap(
  providerConfig: LLMProviderConfig,
  sessionMessages: ModelMessage[],
): Promise<string> {
  log.debug('[recapGenerator] generateSessionRecap', {
    messageCount: sessionMessages.length,
    providerType: providerConfig.type,
    // apiKey intentionally omitted — T-04-03-03
  })

  try {
    const model = buildModel(providerConfig)

    const result = await generateText({
      model,
      system: RECAP_SYSTEM_PROMPT,
      messages: sessionMessages,
      temperature: 0.3,
    })

    return result.text
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[recapGenerator] generateSessionRecap failed:', message)
    throw err
  }
}

/**
 * Generate a rolling campaign summary from older session recaps (Layer 3).
 * Synthesizes sessions 1..N-3 into a single summary for long-campaign memory.
 * maxTokens=1000 respects the Layer 3 cap (D-16).
 *
 * Security: apiKey is intentionally not logged (T-04-03-03).
 * Pitfall 4: Always uses primary provider config.
 */
export async function generateRollingSummary(
  providerConfig: LLMProviderConfig,
  olderSessions: Array<{ sessionNumber: number; aiRecap: string }>,
): Promise<string> {
  log.debug('[recapGenerator] generateRollingSummary', {
    sessionCount: olderSessions.length,
    // apiKey intentionally omitted — T-04-03-03
  })

  const historyText = olderSessions
    .map((s) => `Session ${s.sessionNumber}: ${s.aiRecap}`)
    .join('\n\n')

  try {
    const model = buildModel(providerConfig)

    const result = await generateText({
      model,
      system: ROLLING_SUMMARY_SYSTEM_PROMPT,
      prompt: historyText,
      temperature: 0.3,
      maxOutputTokens: 1000,
    })

    return result.text
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[recapGenerator] generateRollingSummary failed:', message)
    throw err
  }
}
