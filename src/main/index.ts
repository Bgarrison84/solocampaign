import { app, BrowserWindow, session, dialog } from 'electron'
import path from 'node:path'
import { createIPCHandler } from 'electron-trpc/main'
import log from 'electron-log'
import Store from 'electron-store'
import { router } from './trpc/router'
import { initDatabase } from './db/index'
import { secretStorage } from './secrets'

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
