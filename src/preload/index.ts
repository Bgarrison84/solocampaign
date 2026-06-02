import { exposeElectronTRPC } from 'electron-trpc/main'
import { contextBridge, ipcRenderer } from 'electron'

// Expose electron-trpc bridge
process.once('loaded', () => {
  exposeElectronTRPC()
})

// Expose platform info to renderer (needed for title bar in 01-05)
contextBridge.exposeInMainWorld('platform', process.platform)

/**
 * window.appPrefsSync — narrow contextBridge surface for reading app preferences
 * before React mounts (D-07, D-08 — font scale and high contrast must apply before
 * the first render to avoid flash).
 *
 * Read-only: no write surface here. Writes go through tRPC (appPrefs.setFontSize,
 * appPrefs.setHighContrast). The handler is registered in main/index.ts before
 * BrowserWindow creation (Landmine 3 compliance).
 *
 * T-08-02: The returned object contains only fontSize, highContrast, dataFolder —
 * no secrets, no API keys (those live in secretStorageService, never in appPrefs).
 */
contextBridge.exposeInMainWorld('appPrefsSync', {
  getInitialPrefs: (): Promise<{ fontSize: string; highContrast: boolean; dataFolder: string | null }> =>
    ipcRenderer.invoke('appPrefs:getInitial'),
})

/**
 * window.aiStream — narrow contextBridge surface for the AI streaming IPC channel.
 *
 * Architecture: tRPC v10 cannot stream over contextBridge (no subscription support),
 * so streaming uses a dedicated custom IPC channel alongside tRPC.
 * Reference: AI-SPEC §3 "IPC Streaming Pattern" + RESEARCH.md Pattern 1.
 *
 * Security:
 * - sendMessage invokes 'ai:send-message' via ipcRenderer.invoke (request/response)
 * - onToken/onFinish/onError add listeners for 'ai:token'/'ai:finish'/'ai:error'
 * - removeAllListeners cleans up all three channels (call in React useEffect cleanup)
 * - No plaintext API key is ever passed through this surface (D-23)
 *
 * Anti-pattern to avoid (RESEARCH.md Pitfall 2):
 *   Always call removeAllListeners() in useEffect cleanup to prevent listener stacking
 *   when StoryScrollPanel re-mounts.
 */
contextBridge.exposeInMainWorld('aiStream', {
  /**
   * Send a message to the AI and initiate streaming.
   * Returns { started: true } when the stream has been initiated.
   * Register onToken/onFinish/onError callbacks BEFORE calling sendMessage.
   */
  sendMessage: (payload: { campaignId: string; content: string; useFallback?: boolean }) =>
    ipcRenderer.invoke('ai:send-message', payload),

  /**
   * Register a callback to receive streamed tokens.
   * Called with each batched token chunk as it arrives from the LLM.
   */
  onToken: (cb: (token: string) => void) => {
    ipcRenderer.on('ai:token', (_, t) => cb(t))
  },

  /**
   * Register a callback fired when the stream completes successfully.
   * meta is optional — may include isL1Overflow flag (D-14 context overflow warning).
   */
  onFinish: (cb: (meta?: { isL1Overflow?: boolean }) => void) => {
    ipcRenderer.on('ai:finish', (_, meta) => cb(meta))
  },

  /**
   * Register a callback fired when the stream fails after retries.
   * err.message is a generic string — no API key, stack trace, or provider body.
   */
  onError: (cb: (err: { message: string }) => void) => {
    ipcRenderer.on('ai:error', (_, m) => {
      const message = typeof m === 'object' && m !== null ? String((m as { message?: unknown }).message ?? m) : String(m)
      cb({ message })
    })
  },

  /**
   * Remove all listeners for ai:token, ai:finish, ai:error.
   * MUST be called in React useEffect cleanup to prevent listener stacking.
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:token')
    ipcRenderer.removeAllListeners('ai:finish')
    ipcRenderer.removeAllListeners('ai:error')
    ipcRenderer.removeAllListeners('ai:mutations-applied')
  },

  /**
   * Register a callback fired when the main process finishes applying mutation tool calls.
   * Payload includes campaignId and the array of mutation chips (one per tool call applied).
   * Used by the rest system (PROG-02, D-35): detect 'Short rest taken' chip to open
   * ShortRestHitDiceModal automatically after the AI grants the processRest short call.
   */
  onMutationsApplied: (
    cb: (payload: {
      campaignId: string
      chips: Array<{ id: string; label: string; type: string }>
    }) => void,
  ) => {
    ipcRenderer.on('ai:mutations-applied', (_, payload) => cb(payload))
  },

  /**
   * Remove all listeners for the ai:mutations-applied channel.
   * Call in useEffect cleanup for components that register onMutationsApplied
   * independently of useAiStream (e.g. MutationChipStack, CampaignViewScreen).
   */
  removeOnMutationsApplied: () => {
    ipcRenderer.removeAllListeners('ai:mutations-applied')
  },
})

/**
 * window.sessionRecap — narrow contextBridge surface for streaming session recap generation.
 *
 * Architecture: Mirrors window.aiStream but uses dedicated 'ai:recap-*' channels.
 * The recap stream is initiated by 'ai:recap-start' and delivers tokens via 'ai:recap-token'.
 *
 * Security:
 * - startStream invokes 'ai:recap-start' via ipcRenderer.invoke (senderFrame validated in main)
 * - No API key ever passes through this surface (T-04-03-03)
 * - removeAllListeners cleans up all three recap channels
 */
contextBridge.exposeInMainWorld('sessionRecap', {
  /**
   * Initiate recap streaming for a session.
   * Returns { started: true } when the stream has been initiated.
   */
  startStream: (payload: { campaignId: string; sessionId: string }) =>
    ipcRenderer.invoke('ai:recap-start', payload),

  /**
   * Register a callback to receive streamed recap tokens.
   */
  onToken: (cb: (token: string) => void) => {
    ipcRenderer.on('ai:recap-token', (_, t) => cb(t))
  },

  /**
   * Register a callback fired when the recap stream completes successfully.
   * finalText is the full accumulated recap text.
   */
  onFinish: (cb: (finalText: string) => void) => {
    ipcRenderer.on('ai:recap-finish', (_, text) => cb(text))
  },

  /**
   * Register a callback fired when the recap stream fails.
   */
  onError: (cb: (err: { message: string }) => void) => {
    ipcRenderer.on('ai:recap-error', (_, m) => cb(m))
  },

  /**
   * Remove all listeners for ai:recap-token, ai:recap-finish, ai:recap-error.
   * MUST be called in React useEffect cleanup.
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:recap-token')
    ipcRenderer.removeAllListeners('ai:recap-finish')
    ipcRenderer.removeAllListeners('ai:recap-error')
  },
})
