import { app, BrowserWindow, session, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { createIPCHandler } from 'electron-trpc/main'
import log from 'electron-log'
import Store from 'electron-store'
import { router } from './trpc/router'
import { initDatabase } from './db/index'
import { secretStorage } from './secrets'
import { sendMessageSchema } from './trpc/schemas'
import { campaignsRepo } from './db/campaignsRepo'
import { messagesRepo } from './db/messagesRepo'
import { buildContext } from './ai/contextBuilder'
import { streamChat } from './ai/llmProvider'
import { withRetry } from './ai/retryHandler'
import { sessionFallbackMap, sessionAbortMap } from './ai/aiSessionState'
import type { LLMProviderConfig } from './ai/llmProvider'
import {
  logLatencyToFirstToken,
  logTokensReceived,
  logStreamError,
  logFallbackActivated,
  logSystemPromptLength,
} from './ai/aiMetrics'

let mainWindow: BrowserWindow | null = null

// Window bounds persistence — saved on resize/move, restored on next launch (D-14)
const boundsStore = new Store<{ windowBounds: { width: number; height: number; x?: number; y?: number } }>({ name: 'windowBounds' })

// Single-instance lock MUST run before app.whenReady()
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    // Initialize database before creating the window
    try {
      await initDatabase()
    } catch (err) {
      log.error('[main] Failed to initialize database:', err)
      const message = err instanceof Error ? err.message : String(err)
      dialog.showErrorBox(
        'Database Error',
        `SoloCampaign could not initialize the database.\n\n${message}\n\nThe application will now quit.`
      )
      app.quit()
      return
    }

    // Initialize secret storage (creates {userData}/secrets/ directory)
    // Must run after DB init, before BrowserWindow creation so the directory
    // exists before any IPC handler could be called.
    try {
      await secretStorage.init()
    } catch (err) {
      log.error('[main] Failed to initialize secret storage:', err)
    }

    // Set CSP on every response — skip in dev so Vite HMR inline scripts aren't blocked
    if (process.env.NODE_ENV !== 'development') {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              // NOTE (Pitfall 8 / AI-SPEC §3 / T-03-06-02):
              // connect-src intentionally does NOT include arbitrary user-configured LLM endpoints
              // (e.g. http://192.168.1.x:*, https://openrouter.ai, etc.).
              //
              // ALL provider HTTP calls are made from the MAIN process (Node.js fetch, not the
              // sandboxed renderer). The renderer never contacts LLM providers directly —
              // it only talks to ipcMain via contextBridge. Therefore, connect-src does NOT
              // gate those calls and must NOT be broadened to '*' (which would weaken the
              // renderer's network posture for zero benefit).
              //
              // Known limitation: a user running a remote LAN Ollama (e.g. 192.168.1.100:11434)
              // will not be blocked by CSP — the call works fine via main-process fetch.
              // Do not "fix" this by adding '*' or broad CIDR ranges to connect-src.
              "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self'; " +
              "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com http://localhost:* http://127.0.0.1:*; " +
              "object-src 'none'; base-uri 'none'; form-action 'none';"
            ],
          },
        })
      })
    }

    // Restore saved bounds from previous session (D-14: 1280×800 default, persist bounds)
    const savedBounds = boundsStore.get('windowBounds', { width: 1280, height: 800 })

    mainWindow = new BrowserWindow({
      ...savedBounds,
      minWidth: 1024,
      minHeight: 700,
      backgroundColor: '#1f2126',
      show: false,
      // D-12: Frameless window — titleBarStyle: 'hidden' on macOS (native traffic lights),
      // frame: false on Windows/Linux (custom title bar buttons rendered by TitleBar.tsx)
      ...(process.platform === 'darwin'
        ? { titleBarStyle: 'hidden' as const }
        : { frame: false }),
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        preload: path.join(__dirname, '../preload/index.js'),
      },
    })

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show()
      if (process.env.NODE_ENV === 'development') {
        mainWindow?.webContents.openDevTools({ mode: 'detach' })
      }
    })

    // Persist window bounds on resize and move with 1s debounce (D-14)
    let boundsDebounce: ReturnType<typeof setTimeout> | null = null
    const saveBounds = () => {
      if (boundsDebounce) clearTimeout(boundsDebounce)
      boundsDebounce = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          boundsStore.set('windowBounds', mainWindow.getBounds())
        }
      }, 1000)
    }
    mainWindow.on('resize', saveBounds)
    mainWindow.on('move', saveBounds)

    // Wire tRPC IPC handler with senderFrame validation
    createIPCHandler({
      router,
      windows: [mainWindow],
      createContext: async ({ event }: { event: Electron.IpcMainInvokeEvent }) => {
        const senderUrl = (event as any).senderFrame?.url ?? ''
        const isDev = process.env.NODE_ENV === 'development'
        if (
          !senderUrl.startsWith('file://') &&
          !senderUrl.startsWith('app://') &&
          !(isDev && senderUrl.startsWith('http://localhost:'))
        ) {
          throw new Error('IPC sender frame URL not allowed')
        }
        return {}
      },
    })

    // ─── AI Streaming IPC Handler (AFTER createIPCHandler — required order) ────────
    //
    // tRPC v10 cannot stream over contextBridge, so streaming uses a dedicated channel.
    // Reference: AI-SPEC §3 "IPC Streaming Pattern", RESEARCH.md Pattern 1.
    //
    // Security contract:
    //   T-03-03-01: API key decrypted in main process only — never sent to renderer
    //   T-03-03-02: senderFrame.url allow-list (same logic as createIPCHandler above)
    //   T-03-03-03: sendMessageSchema.parse validates campaignId (uuid) + content (max 10000)
    //   T-03-03-04: ai:error payload is a generic string — no stack trace, key, or provider body
    ipcMain.handle('ai:send-message', async (event, payload) => {
      // ── Step 1: senderFrame validation (T-03-03-02) ──────────────────────────
      const senderUrl = (event as any).senderFrame?.url ?? ''
      const isDev = process.env.NODE_ENV === 'development'
      if (
        !senderUrl.startsWith('file://') &&
        !senderUrl.startsWith('app://') &&
        !(isDev && senderUrl.startsWith('http://localhost:'))
      ) {
        throw new Error('IPC sender frame URL not allowed')
      }

      // ── Step 2: Validate IPC payload (T-03-03-03) ────────────────────────────
      const { campaignId, content } = sendMessageSchema.parse(payload)
      // useFallback is an optional boolean flag outside the Zod schema
      const useFallback = typeof payload?.useFallback === 'boolean'
        ? payload.useFallback
        : false

      // ── Step 3: Load campaign config + decide provider ────────────────────────
      const campaign = campaignsRepo.get(campaignId)
      if (!campaign) {
        event.sender.send('ai:error', 'Campaign not found')
        return { started: false }
      }

      // Determine whether to use fallback this request (D-19)
      const shouldUseFallback =
        useFallback ||
        sessionFallbackMap.isFallbackActive(campaignId)

      // Decrypt key in main process only — never sent to renderer (D-23, T-03-03-01)
      let apiKey: string | undefined
      let providerConfig: LLMProviderConfig

      if (shouldUseFallback && campaign.fallbackEndpointUrl && campaign.fallbackModelName) {
        // Use fallback provider
        const fallbackKey = await secretStorage.decrypt('ai-fallback-' + campaignId)
        apiKey = fallbackKey ?? undefined
        providerConfig = {
          type: 'openai-compatible', // fallback is always URL-based (schema has no fallbackProviderType)
          endpointUrl: campaign.fallbackEndpointUrl ?? undefined,
          modelName: campaign.fallbackModelName ?? '',
          apiKey,
        }
        // Mark fallback as active for this session (D-19)
        if (useFallback) {
          sessionFallbackMap.setFallbackActive(campaignId)
        }
      } else {
        // Use primary provider
        const primaryKey = await secretStorage.decrypt('ai-key-' + campaignId)
        apiKey = primaryKey ?? undefined
        providerConfig = {
          type: (campaign.providerType as 'openai-compatible' | 'gemini') ?? 'openai-compatible',
          endpointUrl: campaign.endpointUrl ?? undefined,
          modelName: campaign.modelName ?? '',
          apiKey,
        }
      }
      // apiKey is intentionally not logged — T-03-03-01

      // ── Step 4: Persist user message ──────────────────────────────────────────
      messagesRepo.insert({ campaignId, role: 'user', content })

      // ── Step 5: Build context (system prompt + message history) ───────────────
      let referenceDocs: string[] = []
      try {
        referenceDocs = JSON.parse(campaign.referenceDocs ?? '[]')
      } catch {
        referenceDocs = []
      }

      const { systemPrompt, messages } = buildContext({
        campaignId,
        config: {
          strictness: (campaign.strictness as 'strict' | 'balanced' | 'narrative') ?? 'balanced',
          dmPersonality: campaign.dmPersonality,
          referenceDocs,
        },
      })

      // AI-SPEC §7 metric: ai.context.system_prompt_length (character count, not content)
      logSystemPromptLength(systemPrompt.length)

      // AI-SPEC §7 metric: ai.fallback.activated — logged once when session switches to fallback
      if (shouldUseFallback) {
        logFallbackActivated()
      }

      // ── Step 6: Stream with retry ─────────────────────────────────────────────
      // AI-SPEC §7 metrics: track latency_to_first_token and error_count

      // CR-06: helper to guard against sending on a destroyed WebContents
      const safeSend = (channel: string, ...args: unknown[]): void => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(channel, ...args)
        }
      }

      // CR-02: create an AbortController so cancelStream can abort the active stream
      const abortController = new AbortController()
      sessionAbortMap.setAbortController(campaignId, abortController)

      const streamStartMs = Date.now()
      let firstTokenMs: number | null = null
      let tokenCount = 0
      let assistantBuffer = ''

      try {
        await withRetry(
          () => {
            // CR-05: reset buffer and token count at the start of each attempt
            assistantBuffer = ''
            tokenCount = 0
            return streamChat(providerConfig, messages, systemPrompt, {
              onToken: (chunk) => {
                if (firstTokenMs === null) {
                  firstTokenMs = Date.now() - streamStartMs
                  // AI-SPEC §7 metric: ai.stream.latency_to_first_token_ms
                  logLatencyToFirstToken(firstTokenMs)
                }
                tokenCount++
                assistantBuffer += chunk
                safeSend('ai:token', chunk)
              },
              onFinish: () => {
                // Persist assistant message
                messagesRepo.insert({ campaignId, role: 'assistant', content: assistantBuffer })
                // AI-SPEC §7 metric: ai.stream.total_tokens_received
                logTokensReceived(tokenCount)
                sessionAbortMap.clearAbortController(campaignId)
                safeSend('ai:finish')
              },
              onError: (err) => {
                // Re-throw so withRetry can catch and retry
                throw err
              },
            }, { abortSignal: abortController.signal })
          },
          { maxAttempts: 3, baseDelayMs: 1000 },
        )
      } catch (err) {
        sessionAbortMap.clearAbortController(campaignId)
        // Classify error coarsely — never log key or provider body (T-03-03-04)
        const errMsg = err instanceof Error ? err.message : ''
        const errorType = errMsg.includes('time') ? 'timeout'
          : errMsg.includes('network') || errMsg.includes('fetch') ? 'network'
          : 'api'
        // AI-SPEC §7 metric: ai.stream.error_count
        logStreamError(errorType)
        log.error('[ai:send-message] Stream failed after retries', {
          errorType,
          // No stack trace / key / provider body logged — T-03-03-04
        })
        // Generic error message to renderer (T-03-03-04: no stack, no key leak)
        const genericMessage = err instanceof Error
          ? err.message
          : 'AI provider request failed'
        safeSend('ai:error', { message: genericMessage })
      }

      // AI-SPEC §3 Async-First Design: return { started: true } so renderer knows
      // the stream has been initiated (the actual tokens come via event.sender.send)
      return { started: true }
    })
    // ─────────────────────────────────────────────────────────────────────────────

    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:5173')
    } else {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (!mainWindow) {
      // Re-create window on macOS
    }
  })
}

log.initialize()
log.info('[main] SoloCampaign starting up')
