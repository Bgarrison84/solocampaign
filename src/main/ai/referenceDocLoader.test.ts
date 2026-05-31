/**
 * Tests for referenceDocLoader.
 * FOUND-03: Title cleaning, path construction, path traversal guard.
 * Phase 7 (RULES-03/RULES-04): UUID resolution + homebrew inclusion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import * as fs from 'node:fs'

// Mock fs and electron-log so tests work without the real filesystem
vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('node:fs')

// Mock campaign repos for Phase 7 UUID + homebrew tests
vi.mock('../db/campaignReferenceDocsRepo', () => ({
  campaignReferenceDocsRepo: {
    list: vi.fn(),
  },
}))

vi.mock('../db/campaignsRepo', () => ({
  campaignsRepo: {
    get: vi.fn(),
  },
}))

import {
  cleanTitle,
  listReferenceDocs,
  readReferenceDocs,
  readReferenceDocsForCampaign,
  getReferenceDocsRoot,
  LARGE_FILE_THRESHOLD,
} from './referenceDocLoader'
import { campaignReferenceDocsRepo } from '../db/campaignReferenceDocsRepo'
import { campaignsRepo } from '../db/campaignsRepo'

describe('referenceDocLoader', () => {
  describe('cleanTitle', () => {
    it('strips OceanofPDF prefix and author suffix', () => {
      const result = cleanTitle('_OceanofPDF.com_The_Ultimate_RPG_Game_Masters_Guide_-_James_DAmato')
      expect(result).toBe('The Ultimate RPG Game Masters Guide')
    })

    it('strips author suffix after last " - "', () => {
      const result = cleanTitle('D&D Players Handbook 2024 - Wizards of the Coast')
      expect(result).toBe('D&D Players Handbook 2024')
    })

    it('decodes URL entities and title-cases slug-style names', () => {
      const result = cleanTitle('solo-adventurerx27s-guide')
      // x27 → apostrophe
      expect(result).toBe("Solo Adventurer's Guide")
    })

    it('handles a plain folder name with no special characters', () => {
      const result = cleanTitle('Dragons of Stormwreck Isle - Wizards of the coast')
      expect(result).toBe('Dragons Of Stormwreck Isle')
    })

    it('strips .md file extension if present', () => {
      const result = cleanTitle('My Document.md')
      expect(result).toBe('My Document')
    })
  })

  describe('listReferenceDocs', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('returns an empty array when root does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      const result = listReferenceDocs()
      expect(result).toEqual([])
    })

    it('returns one entry per folder with a matching .md file', () => {
      const root = getReferenceDocsRoot()
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const ps = String(p)
        if (ps === root) return true
        if (ps.includes('My Guide')) return true
        return false
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readdirSync).mockReturnValue(['My Guide'] as any)
      vi.mocked(fs.statSync).mockImplementation((p) => {
        const ps = String(p)
        if (ps === path.join(root, 'My Guide')) {
          return { isDirectory: () => true } as fs.Stats
        }
        // The .md file stat
        return { isDirectory: () => false, size: 1024 } as fs.Stats
      })

      const result = listReferenceDocs()
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('My Guide')
      expect(result[0].relativePath).toBe('My Guide/My Guide.md')
      expect(result[0].sizeBytes).toBe(1024)
      expect(result[0].isLarge).toBe(false)
    })

    it('marks entries as isLarge when size exceeds threshold', () => {
      const root = getReferenceDocsRoot()
      vi.mocked(fs.existsSync).mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readdirSync).mockReturnValue(['BigDoc'] as any)
      vi.mocked(fs.statSync).mockImplementation((p) => {
        const ps = String(p)
        if (ps === path.join(root, 'BigDoc')) {
          return { isDirectory: () => true } as fs.Stats
        }
        return { isDirectory: () => false, size: LARGE_FILE_THRESHOLD + 1 } as fs.Stats
      })

      const result = listReferenceDocs()
      expect(result[0].isLarge).toBe(true)
    })
  })

  describe('readReferenceDocs', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('reads file content and returns title + content for valid paths', () => {
      const root = path.resolve(getReferenceDocsRoot())
      vi.mocked(fs.readFileSync).mockReturnValue('# My Guide content')

      const result = readReferenceDocs(['My Guide/My Guide.md'])
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('My Guide')
      expect(result[0].content).toBe('# My Guide content')
    })

    it('skips paths that resolve outside the reference-docs root (path traversal guard)', () => {
      // A relative path using ../ to escape the root
      const result = readReferenceDocs(['../../../etc/passwd'])
      expect(result).toHaveLength(0)
      // readFileSync should not have been called for the traversal attempt
      expect(vi.mocked(fs.readFileSync)).not.toHaveBeenCalled()
    })

    it('skips unreadable files and continues', () => {
      vi.mocked(fs.readFileSync)
        .mockImplementationOnce(() => { throw new Error('ENOENT') })
        .mockReturnValueOnce('valid content')

      const result = readReferenceDocs([
        'Missing/Missing.md',
        'Present/Present.md',
      ])

      // Only the second file should be in results (first throws)
      // But the second could also fail the traversal check if path is outside root...
      // Both are inside root so second should work
      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('valid content')
    })
  })

  describe('readReferenceDocsForCampaign (Phase 7)', () => {
    const CAMPAIGN_ID = 'test-campaign-id'
    const UUID_DOC = '550e8400-e29b-41d4-a716-446655440000'

    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('resolves UUID identifiers to campaign_reference_docs content', () => {
      // No bundled files needed — just UUID resolution
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('should not be called for UUIDs') })
      vi.mocked(campaignReferenceDocsRepo.list).mockReturnValue([
        {
          id: UUID_DOC,
          campaignId: CAMPAIGN_ID,
          filename: 'My Rules.pdf',
          content: 'Imported PDF content',
          createdAt: new Date(),
        },
      ])
      vi.mocked(campaignsRepo.get).mockReturnValue({
        id: CAMPAIGN_ID,
        name: 'Test Campaign',
        homebrewContent: null,
        createdAt: new Date(),
        coverImagePath: null,
        providerType: null,
        endpointUrl: null,
        modelName: null,
        referenceDocs: '[]',
        dmPersonality: null,
        strictness: 'balanced',
        fallbackEndpointUrl: null,
        fallbackModelName: null,
        rollingSummary: null,
        permadeathMode: false,
        worldTimeOfDay: null,
        worldDayNumber: null,
        worldSeason: null,
        worldLocationPath: null,
        partySize: 1,
        worldSetupMode: null,
        worldBrief: null,
        worldDocument: null,
        encumbranceEnabled: false,
      })

      const result = readReferenceDocsForCampaign(CAMPAIGN_ID, [UUID_DOC])

      // UUID resolved to imported doc (no bundled docs; no homebrew)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('My Rules')
      expect(result[0].content).toBe('Imported PDF content')
    })

    it('skips UUID identifiers not found in campaign_reference_docs', () => {
      const MISSING_UUID = '00000000-0000-0000-0000-000000000000'
      vi.mocked(campaignReferenceDocsRepo.list).mockReturnValue([])
      vi.mocked(campaignsRepo.get).mockReturnValue({
        id: CAMPAIGN_ID,
        name: 'Test',
        homebrewContent: null,
        createdAt: new Date(),
        coverImagePath: null,
        providerType: null,
        endpointUrl: null,
        modelName: null,
        referenceDocs: '[]',
        dmPersonality: null,
        strictness: 'balanced',
        fallbackEndpointUrl: null,
        fallbackModelName: null,
        rollingSummary: null,
        permadeathMode: false,
        worldTimeOfDay: null,
        worldDayNumber: null,
        worldSeason: null,
        worldLocationPath: null,
        partySize: 1,
        worldSetupMode: null,
        worldBrief: null,
        worldDocument: null,
        encumbranceEnabled: false,
      })

      const result = readReferenceDocsForCampaign(CAMPAIGN_ID, [MISSING_UUID])
      expect(result).toHaveLength(0)
    })

    it('appends homebrew_content as a reference-doc entry when non-empty', () => {
      vi.mocked(campaignReferenceDocsRepo.list).mockReturnValue([])
      vi.mocked(campaignsRepo.get).mockReturnValue({
        id: CAMPAIGN_ID,
        name: 'Test',
        homebrewContent: 'Custom race: Shiftling. ...',
        createdAt: new Date(),
        coverImagePath: null,
        providerType: null,
        endpointUrl: null,
        modelName: null,
        referenceDocs: '[]',
        dmPersonality: null,
        strictness: 'balanced',
        fallbackEndpointUrl: null,
        fallbackModelName: null,
        rollingSummary: null,
        permadeathMode: false,
        worldTimeOfDay: null,
        worldDayNumber: null,
        worldSeason: null,
        worldLocationPath: null,
        partySize: 1,
        worldSetupMode: null,
        worldBrief: null,
        worldDocument: null,
        encumbranceEnabled: false,
      })

      const result = readReferenceDocsForCampaign(CAMPAIGN_ID, [])
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Homebrew Rules')
      expect(result[0].content).toContain('Custom race: Shiftling')
    })

    it('does not append homebrew when homebrewContent is empty', () => {
      vi.mocked(campaignReferenceDocsRepo.list).mockReturnValue([])
      vi.mocked(campaignsRepo.get).mockReturnValue({
        id: CAMPAIGN_ID,
        name: 'Test',
        homebrewContent: '',
        createdAt: new Date(),
        coverImagePath: null,
        providerType: null,
        endpointUrl: null,
        modelName: null,
        referenceDocs: '[]',
        dmPersonality: null,
        strictness: 'balanced',
        fallbackEndpointUrl: null,
        fallbackModelName: null,
        rollingSummary: null,
        permadeathMode: false,
        worldTimeOfDay: null,
        worldDayNumber: null,
        worldSeason: null,
        worldLocationPath: null,
        partySize: 1,
        worldSetupMode: null,
        worldBrief: null,
        worldDocument: null,
        encumbranceEnabled: false,
      })

      const result = readReferenceDocsForCampaign(CAMPAIGN_ID, [])
      expect(result).toHaveLength(0)
    })

    it('handles mixed bundled relative paths + UUID identifiers', () => {
      const root = path.resolve(getReferenceDocsRoot())
      // Mock fs for bundled doc
      vi.mocked(fs.readFileSync).mockReturnValue('bundled content')
      vi.mocked(campaignReferenceDocsRepo.list).mockReturnValue([
        {
          id: UUID_DOC,
          campaignId: CAMPAIGN_ID,
          filename: 'imported.txt',
          content: 'imported content',
          createdAt: new Date(),
        },
      ])
      vi.mocked(campaignsRepo.get).mockReturnValue({
        id: CAMPAIGN_ID,
        name: 'Test',
        homebrewContent: null,
        createdAt: new Date(),
        coverImagePath: null,
        providerType: null,
        endpointUrl: null,
        modelName: null,
        referenceDocs: '[]',
        dmPersonality: null,
        strictness: 'balanced',
        fallbackEndpointUrl: null,
        fallbackModelName: null,
        rollingSummary: null,
        permadeathMode: false,
        worldTimeOfDay: null,
        worldDayNumber: null,
        worldSeason: null,
        worldLocationPath: null,
        partySize: 1,
        worldSetupMode: null,
        worldBrief: null,
        worldDocument: null,
        encumbranceEnabled: false,
      })
      // Silence root check warnings
      void root

      const result = readReferenceDocsForCampaign(CAMPAIGN_ID, [
        'My Guide/My Guide.md',
        UUID_DOC,
      ])

      // bundled + imported (no homebrew)
      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('bundled content')
      expect(result[1].content).toBe('imported content')
    })
  })
})
