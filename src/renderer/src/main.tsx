import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { App } from './App'
import './styles/globals.css'

/**
 * Font scale map: maps appPrefs fontSize value to CSS --font-scale value.
 * Applied to documentElement before React mounts to prevent FOUC (D-07, A11Y-01).
 * Source: 08-UI-SPEC.md §appPrefs Store Contract
 */
const FONT_SCALE_MAP: Record<string, string> = {
  small: '0.875',
  normal: '1',
  large: '1.125',
}

/**
 * Async IIFE: apply saved appearance prefs (font scale + high contrast) before
 * ReactDOM.createRoot() so the document reflects user settings on first paint
 * (FOUC prevention — 08-RESEARCH.md §Section 4, Pitfall 5).
 *
 * The try/catch is intentional: if the IPC call fails (e.g. during unit tests or
 * before the Electron main process registers the handler), defaults apply silently
 * (--font-scale unset → falls back to 1 via CSS var default; no .high-contrast class).
 *
 * T-08-04 (Tampering): FONT_SCALE_MAP is a fixed enum lookup; arbitrary strings
 * from the store cannot reach setProperty because unknown keys fall back to '1'.
 */
;(async () => {
  try {
    const prefs = await window.appPrefsSync?.getInitialPrefs()
    if (prefs) {
      document.documentElement.style.setProperty(
        '--font-scale',
        FONT_SCALE_MAP[prefs.fontSize] ?? '1',
      )
      if (prefs.highContrast) {
        document.documentElement.classList.add('high-contrast')
      }
    }
  } catch {
    /* non-fatal: CSS defaults apply (--font-scale: 1 via var() fallback, no high-contrast) */
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  )
})()
