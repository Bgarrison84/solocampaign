import { BrowserWindow } from 'electron'
import { t } from '../_base'

/**
 * tRPC router for window control IPC surface.
 *
 * All procedures use BrowserWindow.getFocusedWindow() — idiomatic for
 * single-window Electron apps. When the renderer's title bar buttons call
 * these procedures, the focused window is always mainWindow. This avoids
 * circular imports with src/main/index.ts.
 *
 * Threat model (01-05):
 *   T-01-05-01: close over IPC — accepted (legitimate user action)
 *   T-01-05-02: maximize IPC — accepted (zero-input, cannot be injected)
 */
export const windowRouter = t.router({
  minimize: t.procedure.mutation(() => {
    BrowserWindow.getFocusedWindow()?.minimize()
  }),

  maximize: t.procedure.mutation(() => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  }),

  close: t.procedure.mutation(() => {
    BrowserWindow.getFocusedWindow()?.close()
  }),

  isMaximized: t.procedure.query(() => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false
  }),
})
