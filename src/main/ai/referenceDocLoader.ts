/**
 * Reference document loader for Phase 3.
 * D-05: Enumerates and reads from Reference Documents/Converted/ for system prompt injection.
 *
 * Path resolution mirrors contentLoader.ts:
 *   packaged → path.join(process.resourcesPath, 'reference-docs')
 *   dev      → <repo-root>/Reference Documents/Converted
 *
 * Security:
 * - T-03-02-01: Resolved paths must startWith the reference-docs root; rejects traversal (../)
 */

import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'

// Size threshold for "large file" warning in UI (AI-SPEC §4 Context Window Strategy)
export const LARGE_FILE_THRESHOLD = 200_000 // bytes

export interface ReferenceDocInfo {
  /** Relative path under the reference-docs root, e.g. "solo-adventurerx27s-guide/solo-adventurerx27s-guide.md" */
  relativePath: string
  /** Cleaned, human-readable title */
  title: string
  /** File size in bytes */
  sizeBytes: number
  /** True if sizeBytes > LARGE_FILE_THRESHOLD */
  isLarge: boolean
}

export interface ReferenceDocContent {
  title: string
  content: string
}

/**
 * Resolve the reference-docs root directory.
 *   packaged: process.resourcesPath/reference-docs
 *   dev: <repo-root>/Reference Documents/Converted
 *
 * The dev path resolves from __dirname up to the repo root.
 * In the test environment __dirname is something like: src/main/ai
 * Repo root is three directories up from there.
 */
export function getReferenceDocsRoot(): string {
  // In packaged build, electron sets process.resourcesPath
  if (typeof process !== 'undefined' && 'resourcesPath' in process && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath) {
    const rp = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!
    return path.join(rp, 'reference-docs')
  }
  // Dev: resolve from __dirname (src/main/ai) up to repo root
  // src/main/ai → src/main → src → <repo-root>
  const repoRoot = path.resolve(__dirname, '../../..')
  return path.join(repoRoot, 'Reference Documents', 'Converted')
}

/**
 * Clean a document folder/file name into a human-readable title.
 *
 * Rules (from UI-SPEC "Reference document list" section):
 * 1. Strip "_OceanofPDF.com_" prefix (and leading underscore)
 * 2. Replace underscores with spaces (before author-suffix check)
 * 3. Strip author suffix after the last " - " (if present)
 * 4. Decode URL-encoded hex entities (e.g. x27 → ')
 * 5. Replace hyphens with spaces (for slug-style names)
 * 6. Title-case each word (only capitalize, don't lowercase existing caps)
 *
 * Examples from UI-SPEC:
 *   "_OceanofPDF.com_The_Ultimate_RPG_Game_Masters_Guide_-_James_DAmato" → "The Ultimate RPG Game Masters Guide"
 *   "D&D Players Handbook 2024 - Wizards of the Coast" → "D&D Players Handbook 2024"
 *   "solo-adventurerx27s-guide" → "Solo Adventurer's Guide"
 */
export function cleanTitle(rawName: string): string {
  let name = rawName

  // Remove file extension if present (e.g. ".md")
  name = name.replace(/\.md$/i, '')

  // 1. Strip leading underscore + OceanofPDF prefix
  name = name.replace(/^_?OceanofPDF\.com_/, '')
  name = name.replace(/^_?OceanofPDF_/, '')
  // Strip any remaining leading underscore
  name = name.replace(/^_/, '')

  // 2. Replace underscores with spaces FIRST (so author-suffix check works)
  name = name.replace(/_/g, ' ')

  // 3. Strip author suffix after the last " - " (handles "D&D Players Handbook 2024 - Wizards of the Coast")
  const lastDashIdx = name.lastIndexOf(' - ')
  if (lastDashIdx > 0) {
    name = name.slice(0, lastDashIdx).trim()
  }

  // 4. Decode URL-encoded hex entities like x27 (') and x26 (&)
  //    Pattern: "x" followed by two hex digits
  name = name.replace(/x([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )

  // 5. Replace hyphens with spaces (for slug-style names like "solo-adventurerx27s-guide")
  name = name.replace(/-/g, ' ')

  // 6. Collapse multiple spaces
  name = name.replace(/\s+/g, ' ').trim()

  // 7. Title-case: capitalize first letter of each word (don't lowercase existing caps)
  name = name
    .split(' ')
    .map((word) => {
      if (word.length === 0) return word
      // Only uppercase the first letter; preserve existing caps (e.g. "RPG" stays "RPG")
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')

  return name
}

/**
 * List all available reference documents.
 * Returns one entry per folder under the Converted/ root that contains a same-named .md file.
 * Empty array if the root does not exist (packaged build without bundled docs).
 */
export function listReferenceDocs(): ReferenceDocInfo[] {
  const root = getReferenceDocsRoot()

  if (!fs.existsSync(root)) {
    log.warn('[referenceDocLoader] Reference docs root not found:', root)
    return []
  }

  const results: ReferenceDocInfo[] = []

  let entries: string[]
  try {
    entries = fs.readdirSync(root)
  } catch (err) {
    log.error('[referenceDocLoader] Failed to read reference docs root:', err)
    return []
  }

  for (const entry of entries) {
    const folderPath = path.join(root, entry)
    let stat: fs.Stats
    try {
      stat = fs.statSync(folderPath)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue

    // Look for a primary markdown file named after the folder
    const primaryMd = path.join(folderPath, `${entry}.md`)
    if (!fs.existsSync(primaryMd)) continue

    let fileStat: fs.Stats
    try {
      fileStat = fs.statSync(primaryMd)
    } catch {
      continue
    }

    const relativePath = `${entry}/${entry}.md`
    const sizeBytes = fileStat.size
    const title = cleanTitle(entry)

    results.push({
      relativePath,
      title,
      sizeBytes,
      isLarge: sizeBytes > LARGE_FILE_THRESHOLD,
    })
  }

  return results.sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Read one or more reference documents and return their title + content.
 *
 * Security T-03-02-01: Rejects any relativePath that resolves outside the root.
 * This prevents path traversal via crafted reference_docs JSON in the DB.
 *
 * @param relativePaths - Relative paths as stored in campaigns.reference_docs JSON column
 * @returns Array of { title, content } in the same order as relativePaths; skips unreadable files
 */
export function readReferenceDocs(relativePaths: string[]): ReferenceDocContent[] {
  const root = path.resolve(getReferenceDocsRoot())
  const results: ReferenceDocContent[] = []

  for (const relPath of relativePaths) {
    const resolved = path.resolve(root, relPath)

    // T-03-02-01: Path traversal guard — resolved path must be inside the root
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      log.warn('[referenceDocLoader] Blocked path traversal attempt:', relPath)
      continue
    }

    let content: string
    try {
      content = fs.readFileSync(resolved, 'utf-8')
    } catch (err) {
      log.warn('[referenceDocLoader] Failed to read reference doc:', relPath, err)
      continue
    }

    // Extract title from the relative path (folder name portion)
    const folderName = relPath.split('/')[0] ?? relPath
    const title = cleanTitle(folderName)

    results.push({ title, content })
  }

  return results
}
