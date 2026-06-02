/**
 * PDF generation service for character sheet export (DIST-02).
 *
 * Uses dynamic import() for @react-pdf/renderer (ESM-only v4 — Landmine 1/Pitfall 2).
 * Mirrors the unpdf dynamic import pattern from pdfExtractor.ts.
 *
 * T-08-15: File path is obtained from OS showSaveDialog (trusted) — never from renderer.
 * T-08-14: characterId UUID validation is handled in the tRPC procedure layer.
 *
 * Open Question 1 / Landmine 8 note: React 19 reconciler compatibility with
 * @react-pdf/renderer v4 can only be verified in a packaged electron-vite build.
 * Dev mode (Vite HMR) and Vitest run in different Node.js contexts than the
 * packaged app. See packaged-build smoke test comment in pdfService.test.ts.
 *
 * Assumption A2 note: yoga-layout's __dirname resolution must be verified in the
 * packaged ASAR — if it fails, the workaround is to exclude @react-pdf/renderer
 * from ASAR via electron-builder.asar.unpack.
 */

import log from 'electron-log/main'
import type { CharacterPdfData } from './CharacterSheetPdf'

// Re-export the type so callers import from one place
export type { CharacterPdfData } from './CharacterSheetPdf'

/**
 * Generate a character sheet PDF as a Node.js Buffer.
 *
 * CRITICAL: @react-pdf/renderer v4 is ESM-only. MUST use dynamic import().
 * A top-level `import ... from '@react-pdf/renderer'` will fail at runtime
 * in the electron-vite CJS main-process bundle.
 *
 * @param data CharacterPdfData payload (constructed in tRPC exportPdf procedure)
 * @returns Promise<Buffer> — the rendered PDF bytes
 * @throws On render failure (logged with electron-log before rethrow)
 */
export async function generateCharacterPdf(data: CharacterPdfData): Promise<Buffer> {
  try {
    // All three dynamic imports required — the component pulls react-pdf transitively
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const React = await import('react')
    const { CharacterSheetPdf } = await import('./CharacterSheetPdf')

    const element = React.createElement(CharacterSheetPdf, { data })
    const buffer = await renderToBuffer(element)
    return buffer
  } catch (err) {
    log.error('[pdfService] generateCharacterPdf failed:', err)
    throw err
  }
}
