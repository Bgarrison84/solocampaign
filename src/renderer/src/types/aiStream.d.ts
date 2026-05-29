/**
 * Window interface augmentation for window.aiStream and window.platform.
 *
 * window.aiStream is the narrow contextBridge surface for the AI streaming IPC channel.
 * See src/preload/index.ts for the implementation and security notes.
 *
 * Security (D-23):
 *   - sendMessage transmits only campaignId + content (no API key)
 *   - onToken/onFinish/onError receive only tokens and generic error strings
 *   - removeAllListeners MUST be called in useEffect cleanup to prevent listener stacking (Pitfall 2)
 */

export {}

declare global {
  interface Window {
    /**
     * Narrow IPC surface for AI streaming.
     * Exposed by preload/index.ts via contextBridge.exposeInMainWorld('aiStream', ...).
     */
    aiStream: {
      /**
       * Send a message to the AI and initiate streaming.
       * Register onToken/onFinish/onError BEFORE calling sendMessage.
       * Returns { started: true } when the stream has been initiated.
       */
      sendMessage(payload: {
        campaignId: string
        content: string
        useFallback?: boolean
      }): Promise<{ started: boolean }>

      /**
       * Register a callback to receive streamed token chunks.
       */
      onToken(cb: (token: string) => void): void

      /**
       * Register a callback fired when the stream completes successfully.
       * meta.isL1Overflow is set by plan 04-04 when the AI context window overflowed L1.
       */
      onFinish(cb: (meta?: { isL1Overflow?: boolean }) => void): void

      /**
       * Register a callback fired when the stream fails after retries.
       * err.message is a generic string — no API key, stack trace, or provider body.
       */
      onError(cb: (err: { message: string }) => void): void

      /**
       * Remove all listeners for ai:token, ai:finish, ai:error, ai:mutations-applied.
       * MUST be called in React useEffect cleanup to prevent listener stacking.
       */
      removeAllListeners(): void

      /**
       * Register a callback fired when the main process applies mutation tool calls.
       * Payload: { campaignId, chips[] }. Used to detect short-rest grants (PROG-02, D-35):
       * a chip with type 'rest' and label 'Short rest taken' means processRest was called
       * with type 'short' and the renderer should open ShortRestHitDiceModal.
       */
      onMutationsApplied(
        cb: (payload: {
          campaignId: string
          chips: Array<{ id: string; label: string; type: string }>
        }) => void,
      ): void
    }

    /**
     * Current process platform, exposed by preload for title-bar rendering.
     * Consolidates the previously untyped window.platform reference.
     */
    platform: NodeJS.Platform
  }
}
