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
import { ALL_TOOLS } from './ai/toolSchemas'
import { applyMutationBatch, stripAndParseJsonTail } from './ai/mutationPipeline'
import { withRetry } from './ai/retryHandler'
import { sessionFallbackMap, sessionAbortMap, sessionActiveMap } from './ai/aiSessionState'
import type { LLMProviderConfig } from './ai/llmProvider'
import { sessionsRepo } from './db/sessionsRepo'
import { generateSessionRecap, RECAP_SYSTEM_PROMPT } from './ai/recapGenerator'
import { getDb } from './db/index'
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

// App-global preferences store (font size, high contrast, custom data folder — D-07, D-08, D-09)
// Instantiated at module scope so the appPrefs:getInitial IPC handler can close over it.
// Must be created BEFORE app.whenReady so the handler can register before BrowserWindow (Landmine 3).
const appPrefs = new Store<{ fontSize: string; highContrast: boolean; dataFolder: string | null }>({
  name: 'appPrefs',
  defaults: { fontSize: 'normal', highContrast: false, dataFolder: null },
})

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
    // Initialize database before creating the window.
    // Read custom data folder from appPrefs (DIST-04: data folder migration, D-09).
    // If appPrefs.dataFolder is set, the DB opens from that path instead of userData.
    const customDataFolder = appPrefs.get('dataFolder', null)
    try {
      await initDatabase(customDataFolder)
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

    // Register appPrefs:getInitial IPC handler BEFORE creating BrowserWindow (Landmine 3).
    // The preload bridge calls this synchronously during window load — the handler must
    // exist before the window is created so the preload's ipcRenderer.invoke can resolve.
    // Returns plain { fontSize, highContrast, dataFolder } object (T-08-02: no secrets).
    ipcMain.handle('appPrefs:getInitial', () => appPrefs.store)

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

      // ── Step 4: Persist user message (with session FK if a session is active — D-20) ──
      // Note: activeSessionId resolved in Step 5 after buildContext call.
      // Here we resolve it early so it's available at insert time.
      const userSessionId = sessionActiveMap.get(campaignId)
      messagesRepo.insert({ campaignId, role: 'user', content, sessionId: userSessionId })

      // ── Step 5: Build context (system prompt + message history) ───────────────
      let referenceDocs: string[] = []
      try {
        referenceDocs = JSON.parse(campaign.referenceDocs ?? '[]')
      } catch {
        referenceDocs = []
      }

      // 04-03: Wire sessionActiveMap — get active session ID for L1 memory (D-14)
      const activeSessionId = sessionActiveMap.get(campaignId)

      // Load session context (location, goal, contextNotes) for system prompt injection (D-17 item 5)
      const activeSession = activeSessionId ? sessionsRepo.getById(activeSessionId) : undefined
      const sessionContext = activeSession
        ? {
            location: activeSession.location ?? null,
            goal: activeSession.goal ?? null,
            contextNotes: activeSession.contextNotes ?? null,
          }
        : undefined

      const { systemPrompt, messages, isL1Overflow } = buildContext({
        campaignId,
        sessionId: activeSessionId,
        sessionContext,
        config: {
          strictness: (campaign.strictness as 'strict' | 'balanced' | 'narrative') ?? 'balanced',
          dmPersonality: campaign.dmPersonality,
          referenceDocs,
          rollingSummary: campaign.rollingSummary ?? null,
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
      // Phase 5 (D-02): track whether native tool calls fired this attempt so the
      // JSON-tail fallback is applied ONLY when no native calls were received.
      let nativeToolCallsApplied = false

      try {
        await withRetry(
          () => {
            // CR-05: reset buffer and token count at the start of each attempt
            assistantBuffer = ''
            tokenCount = 0
            nativeToolCallsApplied = false
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
                // Phase 5 (D-02): strip the JSON-tail fenced block before display.
                const { cleanText, mutations: tailMutations } =
                  stripAndParseJsonTail(assistantBuffer)
                // Persist the CLEAN assistant text (no tail), with session FK (D-20).
                messagesRepo.insert({
                  campaignId,
                  role: 'assistant',
                  content: cleanText,
                  sessionId: activeSessionId,
                })
                // JSON-tail is a fallback only — skip it if native tool calls already
                // applied this turn's mutations (D-02), so they never double-apply.
                if (!nativeToolCallsApplied && tailMutations && tailMutations.length > 0) {
                  void applyMutationBatch(tailMutations, campaignId, activeSessionId).then(
                    ({ chips, diceRolls }) => {
                      for (const d of diceRolls) {
                        messagesRepo.insert({
                          campaignId,
                          role: 'dice_roll',
                          content: JSON.stringify(d),
                          sessionId: activeSessionId,
                        })
                      }
                      safeSend('ai:mutations-applied', { campaignId, chips })
                    },
                  )
                }
                // AI-SPEC §7 metric: ai.stream.total_tokens_received
                logTokensReceived(tokenCount)
                sessionAbortMap.clearAbortController(campaignId)
                // Pass isL1Overflow flag so renderer can show context-window warning (D-14)
                safeSend('ai:finish', { isL1Overflow })
              },
              onError: (err) => {
                // Re-throw so withRetry can catch and retry
                throw err
              },
            }, {
              abortSignal: abortController.signal,
              tools: ALL_TOOLS,
              onToolCallsFinish: async (toolCalls) => {
                if (toolCalls.length === 0) return
                // Native tool calls take priority over the JSON-tail fallback (D-02).
                nativeToolCallsApplied = true
                const { chips, diceRolls } = await applyMutationBatch(
                  toolCalls,
                  campaignId,
                  activeSessionId,
                )
                for (const d of diceRolls) {
                  messagesRepo.insert({
                    campaignId,
                    role: 'dice_roll',
                    content: JSON.stringify(d),
                    sessionId: activeSessionId,
                  })
                }
                safeSend('ai:mutations-applied', { campaignId, chips })
              },
            })
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

    // ─── AI Recap Streaming IPC Handler ──────────────────────────────────────────
    //
    // Streams a session recap into the end-session modal.
    // Uses streamText (not generateText) so tokens appear incrementally in the modal.
    //
    // Security contract:
    //   T-04-03-01: senderFrame validation (verbatim copy from ai:send-message)
    //   T-04-03-03: API key decrypted in main process only — never sent to renderer
    ipcMain.handle('ai:recap-start', async (event, payload) => {
      // ── Step 1: senderFrame validation (T-04-03-01) ──────────────────────────
      const senderUrl = (event as any).senderFrame?.url ?? ''
      const isDev = process.env.NODE_ENV === 'development'
      if (
        !senderUrl.startsWith('file://') &&
        !senderUrl.startsWith('app://') &&
        !(isDev && senderUrl.startsWith('http://localhost:'))
      ) {
        throw new Error('IPC sender frame URL not allowed')
      }

      // ── Step 2: Validate IPC payload ─────────────────────────────────────────
      const { z } = await import('zod')
      const recapStartSchema = z.object({
        campaignId: z.string().uuid(),
        sessionId: z.string().uuid(),
      })
      const { campaignId, sessionId } = recapStartSchema.parse(payload)

      // ── Step 3: Load campaign config (primary provider only — Pitfall 4) ─────
      const campaign = campaignsRepo.get(campaignId)
      if (!campaign) {
        event.sender.send('ai:recap-error', { message: 'Campaign not found' })
        return { started: false }
      }

      const primaryKey = await secretStorage.decrypt('ai-key-' + campaignId)
      const providerConfig: LLMProviderConfig = {
        type: (campaign.providerType as 'openai-compatible' | 'gemini') ?? 'openai-compatible',
        endpointUrl: campaign.endpointUrl ?? undefined,
        modelName: campaign.modelName ?? '',
        apiKey: primaryKey ?? undefined,
      }

      // ── Step 4: Load session messages — map to ModelMessage shape ────────────
      // CR-06: filter to only user/assistant — dice_roll/system roles cause 400 errors
      const rawMessages = messagesRepo.getBySessionId(sessionId)
      const sessionMessages: import('ai').ModelMessage[] = rawMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      // ── Step 5: safeSend helper (guard against destroyed WebContents) ─────────
      const safeSend = (channel: string, ...args: unknown[]): void => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(channel, ...args)
        }
      }

      // ── Step 6: Stream recap using streamText ─────────────────────────────────
      // Using streamText (not generateText) so the modal can show tokens as they arrive.
      const { streamText } = await import('ai')
      const { buildModel } = await import('./ai/llmProvider')

      let fullRecapText = ''

      try {
        log.debug('[ai:recap-start] Starting recap stream', {
          campaignId,
          sessionId,
          messageCount: sessionMessages.length,
        })

        const model = buildModel(providerConfig)

        const result = await streamText({
          model,
          system: RECAP_SYSTEM_PROMPT,
          messages: sessionMessages,
          temperature: 0.3,
        })

        for await (const chunk of result.textStream) {
          fullRecapText += chunk
          safeSend('ai:recap-token', chunk)
        }

        safeSend('ai:recap-finish', fullRecapText)
        log.debug('[ai:recap-start] Recap stream complete', { sessionId, length: fullRecapText.length })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Recap generation failed'
        log.error('[ai:recap-start] Stream error:', message)
        safeSend('ai:recap-error', { message })
      }

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

  // D-06: Auto-end any active sessions on app close.
  // Uses a synchronous raw better-sqlite3 UPDATE to ensure the write completes before
  // the process exits. Do NOT call any async LLM functions here (Pitfall 6 in RESEARCH.md).
  // Sessions with isSummarized=false will have rolling summary generated on next session start.
  app.on('before-quit', () => {
    try {
      // getDb().$client is the underlying better-sqlite3 Database instance
      getDb().$client.prepare('UPDATE sessions SET ended_at = ? WHERE ended_at IS NULL').run(Date.now())
      log.info('[main] before-quit: ended all active sessions')
    } catch (err) {
      log.error('[main] before-quit: failed to end active sessions:', err instanceof Error ? err.message : String(err))
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
