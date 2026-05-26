import { exposeElectronTRPC } from 'electron-trpc/main'
import { contextBridge, ipcRenderer } from 'electron'

// Expose electron-trpc bridge
process.once('loaded', () => {
  exposeElectronTRPC()
})

// Expose platform info to renderer (needed for title bar in 01-05)
contextBridge.exposeInMainWorld('platform', process.platform)

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
   */
  onFinish: (cb: () => void) => {
    ipcRenderer.on('ai:finish', () => cb())
  },

  /**
   * Register a callback fired when the stream fails after retries.
   * msg is a generic string — no API key, stack trace, or provider body.
   */
  onError: (cb: (msg: string) => void) => {
    ipcRenderer.on('ai:error', (_, m) => cb(typeof m === 'object' ? m.message : m))
  },

  /**
   * Remove all listeners for ai:token, ai:finish, ai:error.
   * MUST be called in React useEffect cleanup to prevent listener stacking.
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:token')
    ipcRenderer.removeAllListeners('ai:finish')
    ipcRenderer.removeAllListeners('ai:error')
  },
})
