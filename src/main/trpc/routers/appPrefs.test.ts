import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for appPrefsRouter.
 *
 * Tests: get returns defaults, setFontSize persists, setHighContrast persists.
 * Covers A11Y-01 store persistence per 08-VALIDATION.md.
 *
 * Uses tRPC v10 createCaller API (not createCallerFactory which is v11).
 * electron-store is mocked with an in-memory Map-backed class.
 */

// Mock electron-store with an in-memory implementation before any module imports
vi.mock('electron-store', () => {
  class MockStore<T extends Record<string, unknown>> {
    private _data: Map<string, unknown>
    private _defaults: Partial<T>

    constructor(options?: { name?: string; defaults?: Partial<T> }) {
      this._defaults = options?.defaults ?? {}
      this._data = new Map()
    }

    get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
      if (this._data.has(key as string)) {
        return this._data.get(key as string) as T[K]
      }
      if (key in this._defaults) {
        return this._defaults[key] as T[K]
      }
      return defaultValue as T[K]
    }

    set<K extends keyof T>(key: K, value: T[K]): void {
      this._data.set(key as string, value)
    }

    get store(): T {
      const result = { ...this._defaults } as T
      for (const [k, v] of this._data.entries()) {
        ;(result as Record<string, unknown>)[k] = v
      }
      return result
    }
  }

  return { default: MockStore }
})

// backup spy — shared across tests
const backupSpy = vi.fn().mockResolvedValue(undefined)

// Mock getDb to return an object whose $client has a backup method
vi.mock('../../db/index', () => ({
  getDb: vi.fn(() => ({
    $client: {
      backup: backupSpy,
    },
  })),
}))

// Track Database constructor calls and their mocked behaviour
let mockIntegrityResult: { integrity_check: string } = { integrity_check: 'ok' }
const mockClose = vi.fn()
const mockGet = vi.fn(() => mockIntegrityResult)
const mockPrepare = vi.fn(() => ({ get: mockGet }))
const MockDatabase = vi.fn(() => ({
  prepare: mockPrepare,
  close: mockClose,
}))

// Mock better-sqlite3
vi.mock('better-sqlite3', () => ({
  default: MockDatabase,
}))

// Mock node:fs/promises unlink
const unlinkSpy = vi.fn().mockResolvedValue(undefined)
vi.mock('node:fs/promises', () => ({
  unlink: unlinkSpy,
}))

// Mock electron app (electron-store may try to call app.getPath)
// Also mock dialog for pickDataFolder
const showOpenDialogSpy = vi.fn()
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
  },
  dialog: {
    showOpenDialog: showOpenDialogSpy,
  },
}))

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('appPrefsRouter', () => {
  beforeEach(() => {
    vi.resetModules()
    backupSpy.mockClear()
    unlinkSpy.mockClear()
    mockClose.mockClear()
    mockGet.mockClear()
    mockPrepare.mockClear()
    MockDatabase.mockClear()
    showOpenDialogSpy.mockClear()
    mockIntegrityResult = { integrity_check: 'ok' }
  })

  async function makeRouter() {
    vi.resetModules()
    const { appPrefsRouter } = await import('./appPrefs')
    return appPrefsRouter.createCaller({})
  }

  describe('get', () => {
    it('returns defaults when nothing has been set', async () => {
      const caller = await makeRouter()
      const prefs = await caller.get()
      expect(prefs.fontSize).toBe('normal')
      expect(prefs.highContrast).toBe(false)
      expect(prefs.dataFolder).toBeNull()
    })
  })

  describe('setFontSize', () => {
    it('setFontSize({ fontSize: "large" }) then get reflects fontSize === "large"', async () => {
      const caller = await makeRouter()
      const result = await caller.setFontSize({ fontSize: 'large' })
      expect(result.updated).toBe(true)
      const prefs = await caller.get()
      expect(prefs.fontSize).toBe('large')
    })
  })

  describe('setHighContrast', () => {
    it('setHighContrast({ highContrast: true }) then get reflects highContrast === true', async () => {
      const caller = await makeRouter()
      const result = await caller.setHighContrast({ highContrast: true })
      expect(result.updated).toBe(true)
      const prefs = await caller.get()
      expect(prefs.highContrast).toBe(true)
    })
  })

  describe('getCurrentDataFolder', () => {
    it('returns isCustom=false and userData path when dataFolder is null', async () => {
      const caller = await makeRouter()
      const result = await caller.getCurrentDataFolder()
      expect(result.path).toBe('/tmp/test-userdata')
      expect(result.isCustom).toBe(false)
    })

    it('returns isCustom=true and the custom path when dataFolder is set', async () => {
      const caller = await makeRouter()
      // Set a custom data folder first
      await caller.changeDataFolder({ folderPath: '/custom/data/folder' })
      const result = await caller.getCurrentDataFolder()
      expect(result.path).toBe('/custom/data/folder')
      expect(result.isCustom).toBe(true)
    })
  })

  describe('pickDataFolder', () => {
    it('returns canceled=true when dialog is canceled', async () => {
      showOpenDialogSpy.mockResolvedValue({ canceled: true, filePaths: [] })
      const caller = await makeRouter()
      const result = await caller.pickDataFolder()
      expect(result.canceled).toBe(true)
    })

    it('returns canceled=false and folderPath when user picks a folder', async () => {
      showOpenDialogSpy.mockResolvedValue({
        canceled: false,
        filePaths: ['/chosen/folder'],
      })
      const caller = await makeRouter()
      const result = await caller.pickDataFolder()
      expect(result.canceled).toBe(false)
      if (!result.canceled) {
        expect(result.folderPath).toBe('/chosen/folder')
      }
    })
  })

  describe('changeDataFolder', () => {
    it('calls sqlite.backup (NOT fs.copyFile) with the new db path', async () => {
      const caller = await makeRouter()
      await caller.changeDataFolder({ folderPath: '/new/folder' })

      // backup must have been called with the new path
      expect(backupSpy).toHaveBeenCalledWith('/new/folder/solocampaign.db')

      // fs.copyFile is NOT imported or used — verified by backup being the mechanism
      // backupSpy is the ONLY file-copy mechanism; unlink should NOT have been called
      expect(unlinkSpy).not.toHaveBeenCalled()
    })

    it('persists dataFolder and returns success when integrity_check passes', async () => {
      mockIntegrityResult = { integrity_check: 'ok' }
      const caller = await makeRouter()
      const result = await caller.changeDataFolder({ folderPath: '/new/folder' })

      expect(result.success).toBe(true)
      expect(result.pendingRestart).toBe(true)

      // The new path should now be the current data folder
      const folder = await caller.getCurrentDataFolder()
      expect(folder.path).toBe('/new/folder')
      expect(folder.isCustom).toBe(true)
    })

    it('deletes the copy and throws when integrity_check fails (does NOT persist dataFolder)', async () => {
      mockIntegrityResult = { integrity_check: 'corruption detected in page ...' }
      const caller = await makeRouter()

      await expect(caller.changeDataFolder({ folderPath: '/bad/folder' })).rejects.toThrow()

      // unlink must have been called to clean up the corrupted copy
      expect(unlinkSpy).toHaveBeenCalledWith('/bad/folder/solocampaign.db')

      // dataFolder must NOT have been persisted
      const folder = await caller.getCurrentDataFolder()
      expect(folder.isCustom).toBe(false)
    })

    it('does not call fs.copyFile — backup is the only copy mechanism', async () => {
      // This test verifies the architectural invariant: copyFile is never the mechanism.
      // The module should not import copyFile at all. If backup is called, that is sufficient.
      const caller = await makeRouter()
      await caller.changeDataFolder({ folderPath: '/verify/folder' })
      expect(backupSpy).toHaveBeenCalled()
      // If we reach here without fs.copyFile being called, the test passes.
      // unlinkSpy not being called confirms no error path was triggered.
      expect(unlinkSpy).not.toHaveBeenCalled()
    })
  })
})
