/**
 * LLM provider abstraction — wraps Vercel AI SDK streamText for Phase 3.
 * D-22: Clean LLMProvider interface so Phase 4 can slot in three-layer memory
 * without touching call sites.
 *
 * Security:
 * - T-03-02-02: apiKey is never passed to log.*; only systemPrompt.length and token counts are logged.
 * - T-03-02-03: 15s first-token timeout cancels stream, emits onError.
 */

import { streamText } from 'ai'
import type { ModelMessage, ToolSet } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import log from 'electron-log'

export interface LLMProviderConfig {
  type: 'openai-compatible' | 'gemini'
  endpointUrl?: string   // openai-compatible only
  modelName: string
  apiKey?: string        // optional for local LLMs
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onFinish: () => void
  onError: (error: Error) => void
}

export interface StreamOptions {
  abortSignal?: AbortSignal
  // Phase 5 — tool set passed directly to streamText({ tools }) (D-08).
  tools?: ToolSet
  // Phase 5 — invoked from onFinish with the native tool calls + final text (D-04).
  // toolCalls are normalized to { toolName, args } so the mutation pipeline can
  // consume native calls and JSON-tail calls through the same shape.
  onToolCallsFinish?: (
    toolCalls: Array<{ toolName: string; args: unknown }>,
    text: string,
  ) => Promise<void>
}

/**
 * Re-export ModelMessage as CoreMessage for backwards-compatible usage.
 * In AI SDK v6 CoreMessage was renamed to ModelMessage.
 */
export type CoreMessage = ModelMessage
export type { ModelMessage }

/**
 * Build the provider model from config.
 * Pitfall 1: createOpenAICompatible throws if apiKey is undefined — pass 'none' for local LLMs.
 */
export function buildModel(config: LLMProviderConfig) {
  if (config.type === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: config.apiKey })
    return google(config.modelName)
  }
  // openai-compatible: LM Studio, Jan AI, Ollama, OpenRouter, OpenAI, etc.
  if (!config.endpointUrl) {
    throw new Error('endpointUrl is required for openai-compatible provider')
  }
  const openai = createOpenAICompatible({
    name: 'custom',
    baseURL: config.endpointUrl,
    apiKey: config.apiKey ?? 'none', // local LLMs ignore auth but SDK requires a value
  })
  return openai(config.modelName)
}

/**
 * Stream a chat completion from the configured provider.
 * Tokens are batched in 16ms windows before invoking onToken (Pitfall 5 / IPC buffer guard).
 *
 * First-token timeout: if no token arrives within 15000ms of streamText() call,
 * onError fires with "did not respond in time" (T-03-02-03 / D-18 / AI-SPEC §4b).
 *
 * Pitfall 3: Use `for await` over result.textStream — never await the full text first.
 */
export async function streamChat(
  config: LLMProviderConfig,
  messages: ModelMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
  options?: StreamOptions,
): Promise<void> {
  log.debug('[llmProvider] streamChat starting', {
    systemPromptLength: systemPrompt.length,
    messageCount: messages.length,
    providerType: config.type,
    modelName: config.modelName,
    // apiKey intentionally omitted — T-03-02-02
  })

  const model = buildModel(config)

  try {
    const result = await streamText({
      model,
      system: systemPrompt,
      messages,
      tools: options?.tools,
      toolChoice: options?.tools ? 'auto' : undefined,
      temperature: 0.8,
      abortSignal: options?.abortSignal,
    })

    // First-token timeout (T-03-02-03 / AI-SPEC §4b "Cost/Latency"):
    // Start a 15s timer after streamText resolves. Clear on first token.
    // If it fires before a token arrives, mark aborted and call onError.
    let firstTokenReceived = false
    let streamAborted = false
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        streamAborted = true
        reject(new Error('Provider did not respond in time'))
      }, 15000)
    })

    // 16ms IPC batching (Pitfall 5)
    let batchBuffer = ''
    let batchTimer: ReturnType<typeof setTimeout> | null = null

    const flushBatch = (): void => {
      if (batchBuffer.length > 0) {
        const toSend = batchBuffer
        batchBuffer = ''
        callbacks.onToken(toSend)
      }
      batchTimer = null
    }

    // Iterate the stream, racing against the timeout for the first token
    const iterateStream = async (): Promise<void> => {
      for await (const textPart of result.textStream) {
        if (streamAborted) break

        // Clear timeout on first token
        if (!firstTokenReceived) {
          firstTokenReceived = true
          if (timeoutHandle) {
            clearTimeout(timeoutHandle)
            timeoutHandle = null
          }
        }

        // Batch tokens in 16ms windows
        batchBuffer += textPart
        if (batchTimer === null) {
          batchTimer = setTimeout(flushBatch, 16)
        }
      }

      // Flush any remaining buffered tokens
      if (batchTimer !== null) {
        clearTimeout(batchTimer)
      }
      flushBatch()
    }

    // Race the stream iteration against the timeout
    await Promise.race([iterateStream(), timeoutPromise])

    // Clean up timeout if still pending
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }

    if (!streamAborted) {
      // Phase 5 (D-04): surface native tool calls BEFORE onFinish so the IPC
      // handler can decide whether to skip the JSON-tail fallback (D-02). Awaiting
      // result.toolCalls here guarantees deterministic ordering: native calls are
      // applied first, then onFinish runs the tail-fallback decision.
      if (options?.onToolCallsFinish) {
        const [toolCalls, text] = await Promise.all([result.toolCalls, result.text])
        const normalized = (toolCalls ?? []).map((tc) => ({
          toolName: tc.toolName as string,
          args: tc.args,
        }))
        await options.onToolCallsFinish(normalized, text ?? '')
      }

      log.debug('[llmProvider] streamChat finished')
      callbacks.onFinish()
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    log.error('[llmProvider] streamChat error:', error.message)
    callbacks.onError(error)
  }
}
