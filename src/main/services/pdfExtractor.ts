/**
 * PDF and text file extraction service (Phase 7 — WORLD-01, RULES-04).
 * Wraps unpdf for ASAR-safe PDF text extraction in the Electron main process.
 *
 * unpdf uses a serverless/inlined PDF.js worker build — no external worker file
 * required, making it safe to run inside an ASAR archive without special configuration.
 *
 * T-07-01-02: file path validation (path traversal) is the responsibility of the
 * calling tRPC router (campaignDocs). This service trusts that the provided filePath
 * is a validated, absolute path supplied by the main process.
 */

import { readFile } from 'node:fs/promises'
import log from 'electron-log/main'

/**
 * Extract plain text from a PDF file.
 * Uses unpdf (serverless build) which inlines the PDF.js worker — ASAR-safe.
 *
 * @param filePath Absolute path to the PDF file to extract text from.
 * @returns Extracted text with pages merged into a single string.
 * @throws On file read failure or PDF parse error.
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  try {
    const buffer = await readFile(filePath)
    // Dynamic import to avoid issues with ESM/CJS interop in test environments.
    const { getDocumentProxy, extractText } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  } catch (err) {
    log.error('[pdfExtractor] extractTextFromFile failed:', err)
    throw err
  }
}

/**
 * Read a plain text or markdown file.
 *
 * @param filePath Absolute path to the text file.
 * @returns File contents as a UTF-8 string.
 * @throws On file read failure.
 */
export async function readTextFile(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content
  } catch (err) {
    log.error('[pdfExtractor] readTextFile failed:', err)
    throw err
  }
}
