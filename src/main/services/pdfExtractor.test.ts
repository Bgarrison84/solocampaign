/**
 * Tests for pdfExtractor service (Phase 7 — WORLD-01, RULES-04).
 * Validates that unpdf can extract text from a real PDF in the main process.
 * This is the Wave 0 PDF risk-gate test.
 *
 * If this test fails (unpdf not loading in-process), it signals the PDF risk gate
 * has tripped: WORLD-01 and RULES-04 must fall back to text-only import.
 */

import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'path'

// Mock electron — pdfExtractor uses electron-log which requires electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test'),
    isPackaged: false,
  },
}))

const TEST_PDF_PATH = resolve(__dirname, './fixtures/test.pdf')

describe('pdfExtractor', () => {
  it('extractTextFromFile returns a non-empty string for the test PDF fixture', async () => {
    const { extractTextFromFile } = await import('./pdfExtractor')
    const text = await extractTextFromFile(TEST_PDF_PATH)

    // Must return a non-empty string — proves unpdf can extract text in-process
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('extractTextFromFile result contains text token from the fixture PDF', async () => {
    const { extractTextFromFile } = await import('./pdfExtractor')
    const text = await extractTextFromFile(TEST_PDF_PATH)

    // The test PDF contains "Hello World" in its content stream
    // unpdf may return it with spaces normalized — check for core token
    expect(text.toLowerCase()).toContain('hello')
  })

  it('readTextFile reads a text file correctly', async () => {
    const { readTextFile } = await import('./pdfExtractor')

    // Read the test PDF as a text file (will be binary but non-empty)
    const content = await readTextFile(TEST_PDF_PATH)
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  it('readTextFile throws on non-existent file', async () => {
    const { readTextFile } = await import('./pdfExtractor')

    await expect(readTextFile('/non/existent/file.txt')).rejects.toThrow()
  })

  it('extractTextFromFile throws on non-existent file', async () => {
    const { extractTextFromFile } = await import('./pdfExtractor')

    await expect(extractTextFromFile('/non/existent/file.pdf')).rejects.toThrow()
  })
})
