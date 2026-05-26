/**
 * Tests for llmProvider.
 * Uses vi.mock('ai') to control streamText behavior without real LLM calls.
 * Mock pattern: async-generator textStream from 03-VALIDATION.md.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the AI SDK modules — no real network calls
vi.mock('ai', () => ({
  streamText: vi.fn(),
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => vi.fn(() => 'mock-openai-model')),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => 'mock-gemini-model')),
}))

vi.mock('electron-log', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { streamText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamChat, buildModel } from './llmProvider'
import type { LLMProviderConfig, StreamCallbacks } from './llmProvider'

const openaiConfig: LLMProviderConfig = {
  type: 'openai-compatible',
  endpointUrl: 'http://localhost:1234/v1',
  modelName: 'test-model',
  apiKey: undefined,
}

const geminiConfig: LLMProviderConfig = {
  type: 'gemini',
  modelName: 'gemini-2.0-flash',
  apiKey: 'test-api-key',
}

function makeTextStream(tokens: string[]) {
  return (async function* () {
    for (const t of tokens) yield t
  })()
}

describe('llmProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('streamChat delivers tokens via onToken callback', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(streamText).mockResolvedValue({
      textStream: makeTextStream(['Hello, ', 'adventurer.']),
    } as any)

    const tokens: string[] = []
    const callbacks: StreamCallbacks = {
      onToken: (t) => tokens.push(t),
      onFinish: vi.fn(),
      onError: vi.fn(),
    }

    await streamChat(openaiConfig, [], 'You are a DM.', callbacks)

    // Tokens are batched in 16ms windows — joined result must contain both parts
    const joined = tokens.join('')
    expect(joined).toContain('Hello, ')
    expect(joined).toContain('adventurer.')
    expect(callbacks.onFinish).toHaveBeenCalledTimes(1)
    expect(callbacks.onError).not.toHaveBeenCalled()
  })

  it('streamChat calls onError after provider throws', async () => {
    vi.mocked(streamText).mockRejectedValue(new Error('Provider unreachable'))

    const callbacks: StreamCallbacks = {
      onToken: vi.fn(),
      onFinish: vi.fn(),
      onError: vi.fn(),
    }

    await streamChat(openaiConfig, [], 'You are a DM.', callbacks)

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    const errorArg = vi.mocked(callbacks.onError).mock.calls[0][0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toContain('Provider unreachable')
    expect(callbacks.onFinish).not.toHaveBeenCalled()
  })

  it('streamChat calls onFinish after all tokens delivered', async () => {
    vi.mocked(streamText).mockResolvedValue({
      textStream: makeTextStream(['token1', 'token2']),
    } as ReturnType<typeof streamText> extends Promise<infer T> ? T : never)

    const onFinish = vi.fn()
    const callbacks: StreamCallbacks = {
      onToken: vi.fn(),
      onFinish,
      onError: vi.fn(),
    }

    await streamChat(openaiConfig, [], 'System', callbacks)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(callbacks.onError).not.toHaveBeenCalled()
  })

  it('buildModel with Gemini provider calls createGoogleGenerativeAI', () => {
    buildModel(geminiConfig)
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' })
    expect(createOpenAICompatible).not.toHaveBeenCalled()
  })

  it('buildModel with openai-compatible and no apiKey passes apiKey "none" to createOpenAICompatible', () => {
    const configNoKey: LLMProviderConfig = {
      type: 'openai-compatible',
      endpointUrl: 'http://localhost:1234/v1',
      modelName: 'local-model',
      apiKey: undefined,
    }
    buildModel(configNoKey)
    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'none' }),
    )
    expect(createGoogleGenerativeAI).not.toHaveBeenCalled()
  })

  it('streamChat fires onError with timeout message if no token arrives within 15s', async () => {
    vi.useFakeTimers()

    // streamText resolves but textStream is a generator that blocks on a promise
    // we control via fake timers — never resolves without time advancing
    const unblock = { fn: () => { /* placeholder */ } }
    const blockingPromise = new Promise<void>((resolve) => {
      unblock.fn = resolve
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(streamText).mockResolvedValue({
      textStream: (async function* () {
        await blockingPromise
        yield 'too late'
      })(),
    } as any)

    const callbacks: StreamCallbacks = {
      onToken: vi.fn(),
      onFinish: vi.fn(),
      onError: vi.fn(),
    }

    const chatPromise = streamChat(openaiConfig, [], 'System', callbacks)

    // Advance past the 15s timeout — this fires the setTimeout(15000) in streamChat
    await vi.advanceTimersByTimeAsync(15001)

    // Unblock the generator so the for-await can proceed and observe streamAborted
    unblock.fn()

    await chatPromise

    vi.useRealTimers()

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    const err = vi.mocked(callbacks.onError).mock.calls[0][0]
    expect(err.message).toContain('did not respond in time')
    expect(callbacks.onFinish).not.toHaveBeenCalled()
  })
})
