import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Must be set before electron mock closes over it
let testDir = ''

// Mock electron before any imports
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    getSelectedStorageBackend: vi.fn(() => 'gnome-libsecret'),
    encryptString: vi.fn((s: string) => Buffer.from('ENC:' + s)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace(/^ENC:/, '')),
  },
}))

describe('secretsRouter', () => {
  let caller: Awaited<ReturnType<typeof buildCaller>>

  async function buildCaller() {
    const { t } = await import('../_base')
    const { secretsRouter } = await import('./secrets')
    const { secretStorage } = await import('../../secrets')
    await secretStorage.init()

    // Build a standalone caller for testing (no HTTP/IPC required)
    const router = t.router({ secrets: secretsRouter })
    const { createCallerFactory } = await import('@trpc/server')
    const createCaller = createCallerFactory(router)
    return createCaller({})
  }

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-trpc-test-'))
    const electronMock = await vi.importMock('electron') as any
    electronMock.app.getPath.mockReturnValue(testDir)
    electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
    electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue('gnome-libsecret')
    electronMock.safeStorage.encryptString.mockImplementation((s: string) => Buffer.from('ENC:' + s))
    electronMock.safeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^ENC:/, ''))

    vi.resetModules()
    caller = await buildCaller()
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    vi.resetModules()
  })

  describe('secrets.exists', () => {
    it('returns false for an unknown key', async () => {
      const result = await caller.secrets.exists({ key: 'test-key' })
      expect(result).toBe(false)
    })

    it('returns true after secrets.set', async () => {
      await caller.secrets.set({ key: 'gemini', value: 'sk-test-123' })
      const result = await caller.secrets.exists({ key: 'gemini' })
      expect(result).toBe(true)
    })

    it('returns false after secrets.delete', async () => {
      await caller.secrets.set({ key: 'gemini', value: 'sk-test-123' })
      await caller.secrets.delete({ key: 'gemini' })
      const result = await caller.secrets.exists({ key: 'gemini' })
      expect(result).toBe(false)
    })
  })

  describe('secrets.set', () => {
    it('resolves for a valid key+value', async () => {
      await expect(
        caller.secrets.set({ key: 'openai', value: 'sk-abc-123' })
      ).resolves.toBeUndefined()
    })

    it('rejects a key containing slashes (Zod validation)', async () => {
      await expect(
        caller.secrets.set({ key: '../etc/passwd', value: 'evil' })
      ).rejects.toThrow()
    })

    it('rejects a key containing double-dots (Zod validation)', async () => {
      await expect(
        caller.secrets.set({ key: '..dangerous', value: 'evil' })
      ).rejects.toThrow()
    })

    it('rejects an empty key', async () => {
      await expect(
        caller.secrets.set({ key: '', value: 'value' })
      ).rejects.toThrow()
    })

    it('rejects a key exceeding 64 characters', async () => {
      const longKey = 'a'.repeat(65)
      await expect(
        caller.secrets.set({ key: longKey, value: 'value' })
      ).rejects.toThrow()
    })

    it('rejects a value exceeding 2048 characters', async () => {
      const longValue = 'x'.repeat(2049)
      await expect(
        caller.secrets.set({ key: 'my-key', value: longValue })
      ).rejects.toThrow()
    })

    it('rejects an empty value', async () => {
      await expect(
        caller.secrets.set({ key: 'my-key', value: '' })
      ).rejects.toThrow()
    })
  })

  describe('secrets.delete', () => {
    it('resolves for a key that exists', async () => {
      await caller.secrets.set({ key: 'to-delete', value: 'some-value' })
      await expect(
        caller.secrets.delete({ key: 'to-delete' })
      ).resolves.toBeUndefined()
    })

    it('resolves for a key that does not exist (no-op)', async () => {
      await expect(
        caller.secrets.delete({ key: 'nonexistent' })
      ).resolves.toBeUndefined()
    })

    it('rejects a key with invalid characters', async () => {
      await expect(
        caller.secrets.delete({ key: '../../../evil' })
      ).rejects.toThrow()
    })
  })

  describe('router shape: no get procedure', () => {
    it('does not expose a get procedure on the router', async () => {
      // TypeScript-level: trpc.secrets.get should not exist
      // Runtime-level: check the router definition
      const { secretsRouter } = await import('./secrets')
      vi.resetModules()
      const reloaded = await import('./secrets')
      // The router's _def.procedures should contain exists, set, delete but NOT get
      const procedures = Object.keys((reloaded.secretsRouter as any)._def.procedures)
      expect(procedures).toContain('exists')
      expect(procedures).toContain('set')
      expect(procedures).toContain('delete')
      expect(procedures).not.toContain('get')
    })
  })

  describe('key validation regex', () => {
    it('accepts valid keys (alphanumeric, hyphens, dots, underscores)', async () => {
      const validKeys = ['gemini', 'openai', 'lm-studio', 'my.key', 'key_123', 'Key-Dot.Under_123']
      for (const key of validKeys) {
        await expect(
          caller.secrets.set({ key, value: 'test-value' })
        ).resolves.toBeUndefined()
      }
    })

    it('rejects keys with spaces', async () => {
      await expect(
        caller.secrets.set({ key: 'key with spaces', value: 'value' })
      ).rejects.toThrow()
    })

    it('rejects keys with @ symbols', async () => {
      await expect(
        caller.secrets.set({ key: 'user@example', value: 'value' })
      ).rejects.toThrow()
    })
  })
})
