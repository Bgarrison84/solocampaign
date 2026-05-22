import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import { createIPCHandler } from 'electron-trpc/main'
import log from 'electron-log'
import { router } from './trpc/router'
import { initDatabase } from './db/index'

let mainWindow: BrowserWindow | null = null

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
    }

    // Set CSP on every response
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

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 700,
      backgroundColor: '#1f2126',
      show: false,
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
    })

    // Wire tRPC IPC handler with senderFrame validation
    createIPCHandler({
      router,
      windows: [mainWindow],
      createContext: async ({ event }: { event: Electron.IpcMainInvokeEvent }) => {
        const senderUrl = (event as any).senderFrame?.url ?? ''
        if (
          !senderUrl.startsWith('file://') &&
          !senderUrl.startsWith('app://') &&
          !senderUrl.startsWith('http://localhost:')
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
