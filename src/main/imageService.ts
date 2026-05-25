/**
 * imageService.ts
 *
 * Handles image import (dialog → jimp resize → fs write) and base64 data URL
 * serving for portrait and cover images.
 *
 * Security notes (T-02-09 to T-02-12):
 * - Source path comes ONLY from dialog.showOpenDialog (OS-validated by user).
 * - Renderer NEVER supplies a file path — it only triggers via tRPC mutation.
 * - Destination is derived from app.getPath('userData') + hardcoded subpath.
 * - Images are returned to renderer as base64 data: URLs — never as file:// paths.
 * - WEBP uses dynamic import(@jimp/wasm-webp) per Pitfall 3 (ESM-only package).
 */

import { app, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Jimp } from 'jimp'
import log from 'electron-log'

const MAX_DIMENSION = 1024
const ACCEPTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

/**
 * Lazily create a Jimp instance with WEBP support for .webp files.
 * For all other formats, use the standard Jimp class directly.
 * Dynamic import is required because @jimp/wasm-webp is ESM-only (Pitfall 3).
 */
async function readImage(sourcePath: string) {
  const ext = path.extname(sourcePath).slice(1).toLowerCase()
  if (ext === 'webp') {
    const { createJimp } = await import('@jimp/core')
    const { defaultFormats, defaultPlugins } = await import('jimp')
    // @jimp/wasm-webp is ESM-only with a default export — use dynamic import()
    const webpModule = await import('@jimp/wasm-webp')
    const webp = webpModule.default
    const JimpWithWebp = createJimp({ formats: [...defaultFormats, webp], plugins: defaultPlugins })
    return JimpWithWebp.read(sourcePath)
  }
  return Jimp.read(sourcePath)
}

/**
 * Open a native OS file dialog, resize the selected image to max 1024px on
 * longest axis, copy it to {userData}/images/{campaignId}/, and return the
 * relative path (forward-slash, cross-platform consistent for DB storage).
 *
 * Returns null if the dialog is cancelled.
 * Throws on read/write errors (tRPC layer surfaces to UI).
 */
export async function importImage(
  campaignId: string,
  kind: 'portrait' | 'cover',
): Promise<string | null> {
  const title =
    kind === 'portrait' ? 'Select Character Portrait' : 'Select Campaign Cover Image'

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title,
    filters: [{ name: 'Images', extensions: ACCEPTED_EXTENSIONS }],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return null

  const sourcePath = filePaths[0]
  const ext = path.extname(sourcePath).slice(1).toLowerCase()

  try {
    const image = await readImage(sourcePath)
    const { width, height } = image.bitmap

    // Resize only if larger than MAX_DIMENSION on longest axis (D-26)
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width >= height) {
        image.resize({ w: MAX_DIMENSION })
      } else {
        image.resize({ h: MAX_DIMENSION })
      }
    }

    const destDir = path.join(app.getPath('userData'), 'images', campaignId)
    await fs.mkdir(destDir, { recursive: true })

    const fileName = `${Date.now()}_${path.basename(sourcePath)}`
    const destPath = path.join(destDir, fileName)

    // jimp v1: write() infers format from file extension.
    // Cast to any because readImage() returns a union of Jimp/JimpWithWebp types
    // whose write() signatures are incompatible at the TypeScript level, even though
    // the runtime behavior is identical.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (image as any).write(destPath)

    // Return relative path with forward slashes for cross-platform DB storage (D-24)
    const relativePath = `images/${campaignId}/${fileName}`
    log.info(`[imageService] Imported ${kind} for campaign ${campaignId}: ${relativePath}`)
    return relativePath
  } catch (err) {
    log.error('[imageService] Failed to import image', err)
    throw err
  }
}

/**
 * Read an image from userData by relative path and return it as a base64 data URL.
 *
 * Returns null if:
 * - input is null, undefined, or empty string
 * - the file no longer exists (deleted externally from userData)
 *
 * The renderer uses the data URL directly in <img src="..." /> — no file:// paths,
 * no CSP issues (T-02-12).
 */
export async function getImageDataUrl(
  relativePath: string | null | undefined,
): Promise<string | null> {
  if (!relativePath) return null

  const absolutePath = path.join(app.getPath('userData'), relativePath)
  try {
    const buffer = await fs.readFile(absolutePath)
    const ext = path.extname(relativePath).slice(1).toLowerCase()
    // Normalize jpg → jpeg for the MIME type
    const mime = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mime};base64,${buffer.toString('base64')}`
  } catch (err: unknown) {
    const nodeErr = err as { code?: string }
    if (nodeErr?.code === 'ENOENT') {
      // File was deleted from userData externally — treat as "no image"
      return null
    }
    throw err
  }
}
