/**
 * Reference document loader for Phase 3 + Phase 7 (RULES-03, RULES-04).
 * D-05: Enumerates and reads from Reference Documents/Converted/ for system prompt injection.
 *
 * Path resolution mirrors contentLoader.ts:
 *   packaged → path.join(process.resourcesPath, 'reference-docs')
 *   dev      → <repo-root>/Reference Documents/Converted
 *
 * Security:
 * - T-03-02-01: Resolved paths must startWith the reference-docs root; rejects traversal (../)
 * - T-07-10-02: Content injected into AI context is capped + stripped of newline injections
 * - T-07-10-03: Homebrew text injected as literal reference text (not instructions)
 *
 * Phase 7 extension (D-37 / Open Question 3 — mixed-array strategy):
 * - readReferenceDocsForCampaign accepts a campaignId + mixed identifier array
 *   (bundled relative paths OR campaign_reference_docs.id UUIDs)
 * - UUID identifiers → loaded from campaign_reference_docs table
 * - Homebrew content → appended as a reference-doc entry when non-empty
 */

import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'
import { campaignReferenceDocsRepo } from '../db/campaignReferenceDocsRepo'
import { campaignsRepo } from '../db/campaignsRepo'

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

/**
 * UUID detection: a 36-character string in UUID v4 format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
 * Used to discriminate imported-doc identifiers from bundled relative paths.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Phase 7 extended reference-doc loader (D-37 / RULES-03 / RULES-04).
 *
 * Resolves a mixed array of enabled identifiers (bundled relative paths OR
 * campaign_reference_docs.id UUIDs) and appends the campaign's homebrew_content
 * (when non-empty) as a final reference-doc entry.
 *
 * Injection priority (lower priority than World Overview per D-37):
 * 1. Bundled files (existing disk-read path)
 * 2. Imported campaign docs (UUID → campaign_reference_docs.content)
 * 3. Homebrew content (appended last)
 *
 * Security (T-07-10-02 / T-07-10-03):
 * - Content is stripped of newline injections via stripNewlinesForContext
 * - No per-entry content cap here — content was already capped at 50,000 chars at
 *   storage time in campaignReferenceDocsRepo (Pitfall 7).
 * - Homebrew is injected as literal text (not instructions) — same treatment as
 *   bundled reference docs.
 *
 * @param campaignId - used to query campaign_reference_docs + homebrew_content
 * @param identifiers - the campaigns.reference_docs JSON array (mixed paths + UUIDs)
 */
export function readReferenceDocsForCampaign(
  campaignId: string,
  identifiers: string[],
): ReferenceDocContent[] {
  const results: ReferenceDocContent[] = []

  // Partition identifiers into UUIDs and relative paths
  const uuids: string[] = []
  const relPaths: string[] = []

  for (const id of identifiers) {
    if (UUID_REGEX.test(id)) {
      uuids.push(id)
    } else {
      relPaths.push(id)
    }
  }

  // 1. Bundled relative-path docs (existing path-traversal-guarded logic)
  const bundledDocs = readReferenceDocs(relPaths)
  results.push(...bundledDocs)

  // 2. Imported campaign docs (UUID → campaign_reference_docs row)
  if (uuids.length > 0) {
    try {
      const allImported = campaignReferenceDocsRepo.list(campaignId)
      const importedById = new Map(allImported.map((d) => [d.id, d]))
      for (const uuid of uuids) {
        const doc = importedById.get(uuid)
        if (!doc) {
          log.warn('[referenceDocLoader] UUID not found in campaign_reference_docs:', uuid)
          continue
        }
        // Title: derived from filename (strip extension for cleaner display)
        const titleRaw = doc.filename.replace(/\.[^/.]+$/, '')
        results.push({ title: cleanTitle(titleRaw), content: doc.content })
      }
    } catch (err) {
      log.error('[referenceDocLoader] Failed to load campaign reference docs:', err)
    }
  }

  // 3. Homebrew content (appended last — T-07-10-03: literal reference text)
  try {
    const campaign = campaignsRepo.get(campaignId)
    if (campaign?.homebrewContent?.trim()) {
      results.push({
        title: 'Homebrew Rules',
        content: campaign.homebrewContent.substring(0, 50_000),
      })
    }
  } catch (err) {
    log.error('[referenceDocLoader] Failed to load homebrew content:', err)
  }

  return results
}
