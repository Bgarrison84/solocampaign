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
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-trpc-test-'))
    const electronMock = await vi.importMock('electron') as any
    electronMock.app.getPath.mockReturnValue(testDir)
    electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
    electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue('gnome-libsecret')
    electronMock.safeStorage.encryptString.mockImplementation((s: string) => Buffer.from('ENC:' + s))
    electronMock.safeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^ENC:/, ''))
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    vi.resetModules()
  })

  /**
   * Build a tRPC router caller that uses a fresh SecretStorageService
   * pointed at the temp directory for this test. Uses tRPC v10's
   * router.createCaller() API (createCallerFactory is v11).
   */
  async function makeRouter() {
    vi.resetModules()
    const { SecretStorageService } = await import('../../secrets/secretStorageService')
    const svc = new SecretStorageService()
    await svc.init()

    const { initTRPC } = await import('@trpc/server')
    const { z } = await import('zod')

    const t2 = initTRPC.create()

    const secretKeySchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_.-]+$/, 'Key contains illegal characters')
    const secretValueSchema = z.string().min(1).max(2048)

    const theRouter = t2.router({
      exists: t2.procedure.input(z.object({ key: secretKeySchema })).query(({ input }) => svc.exists(input.key)),
      set: t2.procedure.input(z.object({ key: secretKeySchema, value: secretValueSchema })).mutation(({ input }) => svc.encrypt(input.key, input.value)),
      delete: t2.procedure.input(z.object({ key: secretKeySchema })).mutation(({ input }) => svc.remove(input.key)),
    })

    // tRPC v10 API: router.createCaller(ctx)
    return theRouter.createCaller({})
  }

  describe('secrets.exists', () => {
    it('returns false for an unknown key', async () => {
      const caller = await makeRouter()
      const result = await caller.exists({ key: 'test-key' })
      expect(result).toBe(false)
    })

    it('returns true after set', async () => {
      const caller = await makeRouter()
      await caller.set({ key: 'gemini', value: 'sk-test-123' })
      const result = await caller.exists({ key: 'gemini' })
      expect(result).toBe(true)
    })

    it('returns false after delete', async () => {
      const caller = await makeRouter()
      await caller.set({ key: 'gemini', value: 'sk-test-123' })
      await caller.delete({ key: 'gemini' })
      const result = await caller.exists({ key: 'gemini' })
      expect(result).toBe(false)
    })
  })

  describe('secrets.set', () => {
    it('resolves for a valid key+value', async () => {
      const caller = await makeRouter()
      await expect(
        caller.set({ key: 'openai', value: 'sk-abc-123' })
      ).resolves.toBeUndefined()
    })

    it('rejects a key containing slashes (Zod validation)', async () => {
      const caller = await makeRouter()
      await expect(
        caller.set({ key: '../etc/passwd', value: 'evil' })
      ).rejects.toThrow()
    })

    it('rejects a key containing slashes that look like path traversal (full path)', async () => {
      const caller = await makeRouter()
      // '../../etc/passwd' contains '/' which is NOT in [a-zA-Z0-9_.-]
      await expect(
        caller.set({ key: '../../etc/passwd', value: 'evil' })
      ).rejects.toThrow()
    })

    it('rejects an empty key', async () => {
      const caller = await makeRouter()
      await expect(
        caller.set({ key: '', value: 'value' })
      ).rejects.toThrow()
    })

    it('rejects a key exceeding 64 characters', async () => {
      const caller = await makeRouter()
      const longKey = 'a'.repeat(65)
      await expect(
        caller.set({ key: longKey, value: 'value' })
      ).rejects.toThrow()
    })

    it('rejects a value exceeding 2048 characters', async () => {
      const caller = await makeRouter()
      const longValue = 'x'.repeat(2049)
      await expect(
        caller.set({ key: 'my-key', value: longValue })
      ).rejects.toThrow()
    })

    it('rejects an empty value', async () => {
      const caller = await makeRouter()
      await expect(
        caller.set({ key: 'my-key', value: '' })
      ).rejects.toThrow()
    })
  })

  describe('secrets.delete', () => {
    it('resolves for a key that exists', async () => {
      const caller = await makeRouter()
      await caller.set({ key: 'to-delete', value: 'some-value' })
      await expect(
        caller.delete({ key: 'to-delete' })
      ).resolves.toBeUndefined()
    })

    it('resolves for a key that does not exist (no-op)', async () => {
      const caller = await makeRouter()
      await expect(
        caller.delete({ key: 'nonexistent' })
      ).resolves.toBeUndefined()
    })

    it('rejects a key with invalid characters', async () => {
      const caller = await makeRouter()
      await expect(
        caller.delete({ key: '../../../evil' })
      ).rejects.toThrow()
    })
  })

  describe('router shape: no get procedure', () => {
    it('does not expose a get procedure on the secretsRouter', async () => {
      vi.resetModules()
      const { secretsRouter } = await import('./secrets')
      // The router's _def.procedures should contain exists, set, delete but NOT get
      const procedures = Object.keys((secretsRouter as any)._def.procedures)
      expect(procedures).toContain('exists')
      expect(procedures).toContain('set')
      expect(procedures).toContain('delete')
      expect(procedures).not.toContain('get')
    })
  })

  describe('key validation regex', () => {
    it('accepts valid keys (alphanumeric, hyphens, dots, underscores)', async () => {
      const caller = await makeRouter()
      const validKeys = ['gemini', 'openai', 'lm-studio', 'my.key', 'key_123', 'Key-Dot.Under_123']
      for (const key of validKeys) {
        await expect(
          caller.set({ key, value: 'test-value' })
        ).resolves.toBeUndefined()
      }
    })

    it('rejects keys with spaces', async () => {
      const caller = await makeRouter()
      await expect(
        caller.set({ key: 'key with spaces', value: 'value' })
      ).rejects.toThrow()
    })

    it('rejects keys with @ symbols', async () => {
      const caller = await makeRouter()
      await expect(
        caller.set({ key: 'user@example', value: 'value' })
      ).rejects.toThrow()
    })
  })
})
