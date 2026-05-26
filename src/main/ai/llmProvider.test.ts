/**
 * Wave 0 test stubs for llmProvider (plan 03-02).
 * These tests verify the intended behavior contract but are skipped until
 * the implementation lands in plan 03-02.
 *
 * Mock pattern: vi.mock('ai') with async-generator textStream (from 03-VALIDATION.md).
 */

import { describe, it, expect, vi } from 'vitest'

// Mock the ai module for unit tests — implemented in plan 03-02
vi.mock('ai', () => ({
  streamText: vi.fn().mockResolvedValue({
    textStream: (async function* () {
      yield 'Hello, '
      yield 'adventurer.'
    })(),
  }),
}))

describe('llmProvider', () => {
  it.skip('streamChat delivers tokens via onToken callback — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    // const { llmProvider } = await import('./llmProvider')
    // const tokens: string[] = []
    // const config = { providerType: 'openai-compatible', endpointUrl: 'http://localhost:1234/v1', modelName: 'test', apiKey: '' }
    // await llmProvider.streamChat(config, [], 'You are a DM.', {
    //   onToken: (t) => tokens.push(t),
    //   onDone: () => {},
    //   onError: () => {},
    // })
    // expect(tokens).toContain('Hello, ')
    // expect(tokens).toContain('adventurer.')
    expect(true).toBe(true)
  })

  it.skip('streamChat calls onError after provider throws — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    // const { streamText } = await import('ai')
    // vi.mocked(streamText).mockRejectedValueOnce(new Error('Provider unreachable'))
    // const { llmProvider } = await import('./llmProvider')
    // let errorCalled = false
    // await llmProvider.streamChat({}, [], '', {
    //   onToken: () => {},
    //   onDone: () => {},
    //   onError: () => { errorCalled = true },
    // })
    // expect(errorCalled).toBe(true)
    expect(true).toBe(true)
  })

  it.skip('streamChat calls onDone after all tokens delivered — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })

  it.skip('streamChat with Gemini provider uses @ai-sdk/google — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })

  it.skip('streamChat with openai-compatible provider uses createOpenAICompatible — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })
})
