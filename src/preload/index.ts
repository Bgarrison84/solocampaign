import { exposeElectronTRPC } from 'electron-trpc/main'
import { contextBridge } from 'electron'

// Expose electron-trpc bridge
process.once('loaded', () => {
  exposeElectronTRPC()
})

// Expose platform info to renderer (needed for title bar in 01-05)
contextBridge.exposeInMainWorld('platform', process.platform)
