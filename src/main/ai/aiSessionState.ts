/**
 * In-memory session state for AI streaming.
 *
 * D-19: "Switch to fallback" swaps the active endpoint for the current session
 * (in memory only — the campaign's primary config is not permanently changed).
 * The map is cleared on app restart (in-memory only).
 *
 * The ipcMain.handle('ai:send-message') handler checks isFallbackActive(campaignId)
 * to determine which provider config to use for the current request.
 */

/**
 * Map<campaignId, boolean> — true when the user clicked "Switch to fallback"
 * this session (D-19). In-memory only; not persisted to disk.
 */
const _fallbackMap = new Map<string, boolean>()

/**
 * Map<campaignId, AbortController> — one controller per active stream.
 * Replaced each time a new stream starts; deleted when the stream ends or is cancelled.
 */
const _abortMap = new Map<string, AbortController>()

/**
 * Map<campaignId, sessionId> — active game session per campaign (D-04).
 * In-memory only; cleared on app restart.
 */
const _activeSessionMap = new Map<string, string>()

/**
 * Mark that the user wants to use the fallback provider for this session.
 */
function setFallbackActive(campaignId: string): void {
  _fallbackMap.set(campaignId, true)
}

/**
 * Check if fallback is active for this session.
 */
function isFallbackActive(campaignId: string): boolean {
  return _fallbackMap.get(campaignId) === true
}

/**
 * Clear the fallback flag for a campaign (called after switching back to primary
 * or when the session resets).
 */
function clearFallback(campaignId: string): void {
  _fallbackMap.delete(campaignId)
}

/** Register an AbortController for the active stream of a campaign. */
function setAbortController(campaignId: string, controller: AbortController): void {
  _abortMap.set(campaignId, controller)
}

/** Abort and remove the active stream controller for a campaign. */
function abortStream(campaignId: string): void {
  _abortMap.get(campaignId)?.abort()
  _abortMap.delete(campaignId)
}

/** Remove the abort controller without aborting (call when stream finishes normally). */
function clearAbortController(campaignId: string): void {
  _abortMap.delete(campaignId)
}

/**
 * Exported accessor bundle — the Maps themselves are not exported to prevent
 * external mutation that bypasses the cleanup paths.
 */
export const sessionFallbackMap = {
  setFallbackActive,
  isFallbackActive,
  clearFallback,
} as const

export const sessionAbortMap = {
  setAbortController,
  abortStream,
  clearAbortController,
} as const

/**
 * Map<campaignId, sessionId> — active game session per campaign (D-04).
 * In-memory only; cleared on app restart.
 */
export const sessionActiveMap = {
  set: (campaignId: string, sessionId: string) => _activeSessionMap.set(campaignId, sessionId),
  get: (campaignId: string): string | null => _activeSessionMap.get(campaignId) ?? null,
  clear: (campaignId: string) => _activeSessionMap.delete(campaignId),
} as const
