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

/**
 * Exported accessor bundle — the Map itself is not exported to prevent
 * external mutation that bypasses the clearFallback cleanup path.
 */
export const sessionFallbackMap = {
  setFallbackActive,
  isFallbackActive,
  clearFallback,
} as const
