/**
 * Tests for recapGenerator.ts
 * Verifies that generateSessionRecap and generateRollingSummary call generateText
 * with the correct system prompts and parameters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ModelMessage } from 'ai'

// Mock the 'ai' module so generateText doesn't make real LLM calls
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'mocked-recap-text' }),
}))

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock llmProvider's buildModel
vi.mock('./llmProvider', () => ({
  buildModel: vi.fn().mockReturnValue('mock-model'),
}))

import { generateText } from 'ai'
import {
  generateSessionRecap,
  generateRollingSummary,
  RECAP_SYSTEM_PROMPT,
  ROLLING_SUMMARY_SYSTEM_PROMPT,
} from './recapGenerator'
import type { LLMProviderConfig } from './llmProvider'

const mockConfig: LLMProviderConfig = {
  type: 'openai-compatible',
  endpointUrl: 'http://localhost:1234/v1',
  modelName: 'test-model',
  apiKey: 'test-key',
}

describe('recapGenerator', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockResolvedValue({ text: 'mocked-recap-text' } as Awaited<ReturnType<typeof generateText>>)
    vi.clearAllMocks()
  })

  describe('generateSessionRecap()', () => {
    it('calls generateText with RECAP_SYSTEM_PROMPT', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'I attack the goblin' },
        { role: 'assistant', content: 'The goblin falls' },
      ]

      vi.mocked(generateText).mockResolvedValue({ text: 'session recap text' } as Awaited<ReturnType<typeof generateText>>)

      await generateSessionRecap(mockConfig, messages)

      expect(generateText).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(generateText).mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.system).toBe(RECAP_SYSTEM_PROMPT)
    })

    it('passes all session messages as the conversation context', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'I cast fireball' },
        { role: 'assistant', content: 'The trolls scatter' },
        { role: 'user', content: 'I search for loot' },
      ]

      vi.mocked(generateText).mockResolvedValue({ text: 'recap' } as Awaited<ReturnType<typeof generateText>>)

      await generateSessionRecap(mockConfig, messages)

      const callArgs = vi.mocked(generateText).mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.messages).toEqual(messages)
    })

    it('returns the generated recap text string', async () => {
      const messages: ModelMessage[] = []
      vi.mocked(generateText).mockResolvedValue({ text: 'expected-recap' } as Awaited<ReturnType<typeof generateText>>)

      const result = await generateSessionRecap(mockConfig, messages)

      expect(result).toBe('expected-recap')
    })

    it('uses temperature 0.3 for the recap call (D-12)', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: 'recap' } as Awaited<ReturnType<typeof generateText>>)

      await generateSessionRecap(mockConfig, [])

      const callArgs = vi.mocked(generateText).mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.temperature).toBe(0.3)
    })
  })

  describe('generateRollingSummary()', () => {
    it('calls generateText with ROLLING_SUMMARY_SYSTEM_PROMPT', async () => {
      const olderSessions = [
        { sessionNumber: 1, aiRecap: 'Session 1 recap' },
        { sessionNumber: 2, aiRecap: 'Session 2 recap' },
      ]

      vi.mocked(generateText).mockResolvedValue({ text: 'rolling summary' } as Awaited<ReturnType<typeof generateText>>)

      await generateRollingSummary(mockConfig, olderSessions)

      expect(generateText).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(generateText).mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.system).toBe(ROLLING_SUMMARY_SYSTEM_PROMPT)
    })

    it('concatenates older session recaps as input context', async () => {
      const olderSessions = [
        { sessionNumber: 1, aiRecap: 'Session 1 recap text' },
        { sessionNumber: 2, aiRecap: 'Session 2 recap text' },
      ]

      vi.mocked(generateText).mockResolvedValue({ text: 'summary' } as Awaited<ReturnType<typeof generateText>>)

      await generateRollingSummary(mockConfig, olderSessions)

      const callArgs = vi.mocked(generateText).mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.prompt).toContain('Session 1:')
      expect(callArgs.prompt).toContain('Session 1 recap text')
      expect(callArgs.prompt).toContain('Session 2:')
      expect(callArgs.prompt).toContain('Session 2 recap text')
    })

    it('returns a summary string within the L3 token cap (1000 tokens, D-16)', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: 'the rolling summary result' } as Awaited<ReturnType<typeof generateText>>)

      const result = await generateRollingSummary(mockConfig, [
        { sessionNumber: 1, aiRecap: 'Some recap' },
      ])

      expect(typeof result).toBe('string')
      expect(result).toBe('the rolling summary result')
    })

    it('uses maxOutputTokens=1000 for the rolling summary call (D-16 L3 cap)', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: 'summary' } as Awaited<ReturnType<typeof generateText>>)

      await generateRollingSummary(mockConfig, [{ sessionNumber: 1, aiRecap: 'recap' }])

      const callArgs = vi.mocked(generateText).mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.maxOutputTokens).toBe(1000)
    })

    it('handles empty session list gracefully', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: 'empty summary' } as Awaited<ReturnType<typeof generateText>>)

      const result = await generateRollingSummary(mockConfig, [])

      expect(result).toBe('empty summary')
      // generateText should still be called (with empty prompt string)
      expect(generateText).toHaveBeenCalledOnce()
    })
  })
})
