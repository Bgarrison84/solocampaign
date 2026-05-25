import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, access } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Must be set before electron mock closes over it
let testDir = ''

// Minimal valid 1x1 PNG bytes (binary) for use in tests
// This is a real PNG so jimp can read it
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// Mock electron before any imports that reference it
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}))

// Mock electron-log to suppress output during tests
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock jimp to avoid WASM / heavy image decoding in unit tests.
// The mock returns a fake image object that supports the API surface used in imageService.
// NOTE: vi.fn() here creates a persistent mock — mockResolvedValue is set in beforeEach
// after vi.resetModules() to ensure the mock state is fresh per test.
vi.mock('jimp', () => {
  return {
    Jimp: {
      read: vi.fn(),
    },
  }
})

describe('imageService', () => {
  let electronMock: { app: { getPath: ReturnType<typeof vi.fn> }; dialog: { showOpenDialog: ReturnType<typeof vi.fn> } }

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'solocampaign-image-test-'))
    vi.resetModules()

    electronMock = await vi.importMock('electron') as typeof electronMock
    electronMock.app.getPath.mockReturnValue(testDir)

    // Reset and configure the jimp mock for each test
    const jimpMock = await vi.importMock('jimp') as { Jimp: { read: ReturnType<typeof vi.fn> } }
    const fakeImage = {
      bitmap: { width: 800, height: 600 },
      resize: vi.fn().mockReturnThis(),
      write: vi.fn().mockImplementation(async (destPath: string) => {
        const { writeFile: wf } = await import('fs/promises')
        await wf(destPath, Buffer.from(TINY_PNG_BASE64, 'base64'))
      }),
    }
    jimpMock.Jimp.read.mockResolvedValue(fakeImage)
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  // ─── importImage ─────────────────────────────────────────────────────────────

  it('returns null when dialog is cancelled', async () => {
    const { dialog } = await vi.importMock('electron') as typeof electronMock & { dialog: { showOpenDialog: ReturnType<typeof vi.fn> } }
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })

    const { importImage } = await import('./imageService')
    const result = await importImage('camp-123', 'portrait')
    expect(result).toBeNull()
  })

  it('returns relative path when import succeeds', async () => {
    // Write a tiny PNG fixture in testDir to use as the "source" file
    const srcPath = join(testDir, 'portrait.png')
    await writeFile(srcPath, Buffer.from(TINY_PNG_BASE64, 'base64'))

    const { dialog } = await vi.importMock('electron') as typeof electronMock & { dialog: { showOpenDialog: ReturnType<typeof vi.fn> } }
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [srcPath] })

    const { importImage } = await import('./imageService')
    const result = await importImage('camp-123', 'portrait')

    expect(result).not.toBeNull()
    expect(result).toMatch(/^images\/camp-123\/\d+_portrait\.png$/)
  })

  it('writes the resized file to userData/images/{campaignId}/', async () => {
    const srcPath = join(testDir, 'my-avatar.png')
    await writeFile(srcPath, Buffer.from(TINY_PNG_BASE64, 'base64'))

    const { dialog } = await vi.importMock('electron') as typeof electronMock & { dialog: { showOpenDialog: ReturnType<typeof vi.fn> } }
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [srcPath] })

    const { importImage } = await import('./imageService')
    const relativePath = await importImage('camp-456', 'cover')

    expect(relativePath).not.toBeNull()
    // Verify the file actually exists on disk
    const absolutePath = join(testDir, relativePath!)
    await expect(access(absolutePath)).resolves.toBeUndefined()
  })

  it('logs and rethrows when jimp read fails', async () => {
    const srcPath = join(testDir, 'bad.png')
    await writeFile(srcPath, Buffer.from('not-a-png'))

    const { dialog } = await vi.importMock('electron') as typeof electronMock & { dialog: { showOpenDialog: ReturnType<typeof vi.fn> } }
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [srcPath] })

    // Override the Jimp mock to throw for this test
    const jimpMock = await vi.importMock('jimp') as { Jimp: { read: ReturnType<typeof vi.fn> } }
    const readError = new Error('corrupt image')
    jimpMock.Jimp.read.mockRejectedValueOnce(readError)

    const logMock = await vi.importMock('electron-log') as { default: { error: ReturnType<typeof vi.fn> } }

    const { importImage } = await import('./imageService')
    await expect(importImage('camp-789', 'portrait')).rejects.toThrow('corrupt image')
    expect(logMock.default.error).toHaveBeenCalledWith(
      expect.stringContaining('[imageService]'),
      readError,
    )
  })

  // ─── getImageDataUrl ──────────────────────────────────────────────────────────

  it('getImageDataUrl returns null when file does not exist', async () => {
    const { getImageDataUrl } = await import('./imageService')
    const result = await getImageDataUrl('images/camp-123/nonexistent.png')
    expect(result).toBeNull()
  })

  it('getImageDataUrl returns data:image/png;base64,... for a valid PNG file', async () => {
    // Write a tiny PNG to the test userData dir under the expected relative path
    const { mkdir, writeFile: wf } = await import('fs/promises')
    const relPath = 'images/camp-123/portrait.png'
    const absoluteDir = join(testDir, 'images', 'camp-123')
    await mkdir(absoluteDir, { recursive: true })
    await wf(join(testDir, relPath), Buffer.from(TINY_PNG_BASE64, 'base64'))

    const { getImageDataUrl } = await import('./imageService')
    const result = await getImageDataUrl(relPath)

    expect(result).not.toBeNull()
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('getImageDataUrl returns null for null/undefined input', async () => {
    const { getImageDataUrl } = await import('./imageService')
    expect(await getImageDataUrl(null)).toBeNull()
    expect(await getImageDataUrl(undefined)).toBeNull()
    expect(await getImageDataUrl('')).toBeNull()
  })
})
