/**
 * Wave 0 test stubs for referenceDocLoader (plan 03-02).
 * These tests verify the intended behavior contract but are skipped until
 * the implementation lands in plan 03-02.
 *
 * Tests cover: FOUND-03 (title cleaning, path construction for reference doc injection)
 */

import { describe, it, expect } from 'vitest'

describe('referenceDocLoader', () => {
  it.skip('listAvailableDocs returns documents from Reference Documents/Converted/ — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (FOUND-03: reference doc list)
    // const { referenceDocLoader } = await import('./referenceDocLoader')
    // const docs = referenceDocLoader.listAvailableDocs()
    // expect(Array.isArray(docs)).toBe(true)
    expect(true).toBe(true)
  })

  it.skip('cleans OceanofPDF prefix from document titles — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (D-05: title cleaning)
    // cleanTitle('OceanofPDF_SRD_v5.1.md') → 'SRD v5.1'
    expect(true).toBe(true)
  })

  it.skip('constructs absolute path to doc file from relative path — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })

  it.skip('loadDoc reads the markdown content of a doc file — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })

  it.skip('loadDoc returns null for a missing file (defensive) — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02
    expect(true).toBe(true)
  })

  it.skip('loadMultiple concatenates docs with labelled sections — MISSING: implemented in plan 03-02', async () => {
    // MISSING — implemented in plan 03-02 (D-05: docs injected as labelled sections)
    expect(true).toBe(true)
  })
})
