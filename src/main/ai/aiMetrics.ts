/**
 * AI-SPEC §7 Metrics — structured logging helpers for the five monitored signals.
 *
 * Security: T-03-06-01
 *   logAiMetric accepts ONLY numeric, boolean, or coarse error-type values.
 *   No parameter accepts an API key, provider URL, or message content.
 *   Never add an 'apiKey', 'key', 'token', 'url', 'content', or 'message' parameter.
 *
 * Metric names (canonical):
 *   ai.stream.latency_to_first_token_ms — ms from start to first token arriving
 *   ai.stream.total_tokens_received     — token chunks received for a completed stream
 *   ai.stream.error_count               — incremented by 1 per final failure (after retries)
 *   ai.fallback.activated               — true when the session switches to fallback provider
 *   ai.context.system_prompt_length     — character length of the assembled system prompt
 */

import log from 'electron-log'

/** Coarse error classification — never includes provider message body or key */
export type AiErrorType = 'timeout' | 'api' | 'network' | 'unknown'

/** The five canonical AI-SPEC §7 metric names */
export type AiMetricName =
  | 'ai.stream.latency_to_first_token_ms'
  | 'ai.stream.total_tokens_received'
  | 'ai.stream.error_count'
  | 'ai.fallback.activated'
  | 'ai.context.system_prompt_length'

/** Extra metadata allowed on specific metrics — numeric/boolean/string only, no secrets */
export interface AiMetricExtra {
  type?: AiErrorType
}

/**
 * Write a structured [ai-metric] electron-log line.
 *
 * SECURITY: This function must NEVER receive an API key, decrypted credential,
 * provider URL, or raw message content. Only pass numeric values, booleans,
 * or coarse string tags (e.g. error type).
 */
export function logAiMetric(
  name: AiMetricName,
  value: number | boolean,
  extra?: AiMetricExtra,
): void {
  if (extra) {
    log.info('[ai-metric]', name, value, extra)
  } else {
    log.info('[ai-metric]', name, value)
  }
}

// ── Named wrappers for each metric (convenience + call-site readability) ──────

/** Log latency from stream start to the first token arriving (ms). */
export function logLatencyToFirstToken(ms: number): void {
  logAiMetric('ai.stream.latency_to_first_token_ms', ms)
}

/** Log total token chunks received after a stream completes. */
export function logTokensReceived(count: number): void {
  logAiMetric('ai.stream.total_tokens_received', count)
}

/**
 * Log a stream error after all retries have been exhausted.
 * @param errorType - Coarse classification only; never the actual error message body.
 */
export function logStreamError(errorType: AiErrorType = 'unknown'): void {
  logAiMetric('ai.stream.error_count', 1, { type: errorType })
}

/** Log when a session activates the fallback provider. */
export function logFallbackActivated(): void {
  logAiMetric('ai.fallback.activated', true)
}

/** Log the character length of the assembled system prompt (not its content). */
export function logSystemPromptLength(length: number): void {
  logAiMetric('ai.context.system_prompt_length', length)
}
