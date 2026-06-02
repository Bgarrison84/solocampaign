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

    get<K extends keyof T>(key: K): T[K] {
      return (this._data.has(key as string)
        ? this._data.get(key as string)
        : this._defaults[key]) as T[K]
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

// Mock electron app (electron-store may try to call app.getPath)
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test'),
  },
}))

describe('appPrefsRouter', () => {
  beforeEach(() => {
    vi.resetModules()
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
})
