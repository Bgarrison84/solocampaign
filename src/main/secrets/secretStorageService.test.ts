import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Mock electron BEFORE importing the service
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

// We need testDir available before the mock runs; use a module-level variable
// that vitest's vi.mock hoisting can close over.
let testDir = ''

describe('SecretStorageService', () => {
  let SecretStorageService: typeof import('./secretStorageService').SecretStorageService
  let service: InstanceType<typeof import('./secretStorageService').SecretStorageService>

  beforeEach(async () => {
    // Create a fresh temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-test-'))

    // Reset all mocks
    vi.resetModules()

    // Re-import after resetting modules so app.getPath returns fresh testDir
    const electronMock = await vi.importMock('electron') as any
    electronMock.app.getPath.mockReturnValue(testDir)
    electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
    electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue('gnome-libsecret')
    electronMock.safeStorage.encryptString.mockImplementation((s: string) => Buffer.from('ENC:' + s))
    electronMock.safeStorage.decryptString.mockImplementation((b: Buffer) => b.toString().replace(/^ENC:/, ''))

    const mod = await import('./secretStorageService')
    SecretStorageService = mod.SecretStorageService
    service = new SecretStorageService()
    await service.init()
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    vi.resetModules()
  })

  describe('init', () => {
    it('creates the secrets directory', async () => {
      const { existsSync } = await import('fs')
      const secretsDir = join(testDir, 'secrets')
      expect(existsSync(secretsDir)).toBe(true)
    })
  })

  describe('encrypt and decrypt round-trip', () => {
    it('round-trips a plain value', async () => {
      await service.encrypt('gemini', 'sk-my-api-key-123')
      const result = await service.decrypt('gemini')
      expect(result).toBe('sk-my-api-key-123')
    })

    it('round-trips a value with special characters', async () => {
      await service.encrypt('my-key', 'value with spaces & symbols <>&!')
      const result = await service.decrypt('my-key')
      expect(result).toBe('value with spaces & symbols <>&!')
    })
  })

  describe('exists', () => {
    it('returns false for a key that has not been set', async () => {
      const result = await service.exists('nonexistent')
      expect(result).toBe(false)
    })

    it('returns true after encrypt', async () => {
      await service.encrypt('test-key', 'test-value')
      const result = await service.exists('test-key')
      expect(result).toBe(true)
    })

    it('returns false after remove', async () => {
      await service.encrypt('test-key', 'test-value')
      await service.remove('test-key')
      const result = await service.exists('test-key')
      expect(result).toBe(false)
    })
  })

  describe('remove', () => {
    it('is a no-op when key does not exist (no throw)', async () => {
      await expect(service.remove('does-not-exist')).resolves.toBeUndefined()
    })

    it('removes an existing key', async () => {
      await service.encrypt('delete-me', 'value')
      await service.remove('delete-me')
      expect(await service.exists('delete-me')).toBe(false)
    })
  })

  describe('decrypt', () => {
    it('returns null for a key that has not been set', async () => {
      const result = await service.decrypt('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('key normalization', () => {
    it('normalizes slashes and special characters to underscores', async () => {
      // A key with path traversal chars should be normalized, not escape the dir
      await service.encrypt('../../../etc/passwd', 'evil-value')
      // The normalized key is "____etc_passwd" (all non-[a-zA-Z0-9_.-] → _)
      const result = await service.decrypt('../../../etc/passwd')
      expect(result).toBe('evil-value')
    })

    it('normalizes unicode and spaces', async () => {
      await service.encrypt('key with spaces & unicode™', 'some-value')
      const result = await service.decrypt('key with spaces & unicode™')
      expect(result).toBe('some-value')
    })
  })

  describe('base64 fallback (headless Linux / basic_text backend)', () => {
    it('falls back to B64: prefix when isEncryptionAvailable returns false', async () => {
      const electronMock = await vi.importMock('electron') as any
      electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(false)
      electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue('basic_text')

      vi.resetModules()
      const mod = await import('./secretStorageService')
      const fallbackService = new mod.SecretStorageService()
      await fallbackService.init()

      await fallbackService.encrypt('fallback-key', 'my-secret')
      const result = await fallbackService.decrypt('fallback-key')
      expect(result).toBe('my-secret')
    })

    it('falls back to B64: prefix when backend is basic_text even if isEncryptionAvailable is true', async () => {
      const electronMock = await vi.importMock('electron') as any
      electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
      electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue('basic_text')

      vi.resetModules()
      const mod = await import('./secretStorageService')
      const fallbackService = new mod.SecretStorageService()
      await fallbackService.init()

      await fallbackService.encrypt('headless-key', 'headless-value')
      const result = await fallbackService.decrypt('headless-key')
      expect(result).toBe('headless-value')
    })

    it('writes a B64: prefix in the file for fallback encryption', async () => {
      const { readFile } = await import('fs/promises')
      const electronMock = await vi.importMock('electron') as any
      electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(false)
      electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue('basic_text')

      vi.resetModules()
      const mod = await import('./secretStorageService')
      const fallbackService = new mod.SecretStorageService()
      await fallbackService.init()

      await fallbackService.encrypt('b64-file-check', 'check-value')
      // Find the .enc file
      const { join: pathJoin } = await import('path')
      const filePath = pathJoin(testDir, 'secrets', 'b64-file-check.enc')
      const buf = await readFile(filePath)
      expect(buf.subarray(0, 4).toString()).toBe('B64:')
    })
  })

  describe('isSecure', () => {
    it('returns true when safeStorage is available and backend is not basic_text', async () => {
      expect(service.isSecure()).toBe(true)
    })

    it('returns false when safeStorage is not available', async () => {
      const electronMock = await vi.importMock('electron') as any
      electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(false)
      vi.resetModules()
      const mod = await import('./secretStorageService')
      const s = new mod.SecretStorageService()
      expect(s.isSecure()).toBe(false)
    })

    it('returns false when backend is basic_text (even if isEncryptionAvailable is true)', async () => {
      const electronMock = await vi.importMock('electron') as any
      electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
      electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue('basic_text')
      vi.resetModules()
      const mod = await import('./secretStorageService')
      const s = new mod.SecretStorageService()
      expect(s.isSecure()).toBe(false)
    })
  })
})
