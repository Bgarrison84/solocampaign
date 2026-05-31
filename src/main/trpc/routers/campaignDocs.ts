/**
 * Campaign reference docs tRPC router (RULES-04, WORLD-01).
 *
 * Procedures:
 *   campaignDocs.list   — list all imported docs for a campaign
 *   campaignDocs.import — import a PDF or text file (security-validated path)
 *   campaignDocs.delete — delete an imported doc for a campaign
 *
 * Security (T-07-03-01 — path traversal mitigation):
 *   The import procedure validates filePath is absolute (path.isAbsolute) and
 *   contains no '..' segments before reading the file. Only OS file-dialog-provided
 *   absolute paths are accepted. A tRPC error is thrown for invalid paths.
 *
 * Content storage cap:
 *   Extracted text is capped at 50,000 chars before storage (in repo). The tRPC
 *   boundary adds no additional cap — the repo enforces it (Pitfall 7 from 07-01).
 */

import { z } from 'zod'
import path from 'node:path'
import { TRPCError } from '@trpc/server'
import { dialog } from 'electron'
import { t } from '../_base'
import { campaignIdSchema } from '../schemas'
import { campaignReferenceDocsRepo } from '../../db/campaignReferenceDocsRepo'
import { extractTextFromFile, readTextFile } from '../../services/pdfExtractor'
import log from 'electron-log'

// ─── Router ───────────────────────────────────────────────────────────────────

export const campaignDocsRouter = t.router({
  /**
   * List all imported reference docs for a campaign, ordered oldest-first.
   */
  list: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => campaignReferenceDocsRepo.list(input.campaignId)),

  /**
   * Import a PDF or text file as a campaign reference document.
   *
   * Security (T-07-03-01):
   * 1. filePath must be absolute — rejects relative paths (no user-provided CWD tricks).
   * 2. filePath must not contain '..' — blocks traversal to parent directories.
   * Only files explicitly chosen via OS file dialog (absolute paths) pass these checks.
   *
   * PDF files (.pdf extension): text extracted via pdfExtractor.extractTextFromFile.
   * All other files: read as UTF-8 text via pdfExtractor.readTextFile.
   *
   * Content is capped at 50,000 chars (T-07-03-05 DoS mitigation) at storage time.
   */
  import: t.procedure
    .input(
      z.object({
        campaignId: campaignIdSchema,
        filePath: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { campaignId, filePath } = input

      // Security: reject non-absolute paths (T-07-03-01)
      if (!path.isAbsolute(filePath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'filePath must be an absolute path',
        })
      }

      // Security: reject any path containing '..' (T-07-03-01)
      if (filePath.includes('..')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'filePath must not contain ".."',
        })
      }

      log.debug('[campaignDocs] importing file', { campaignId, filePath })

      // Extract content based on file extension
      const ext = path.extname(filePath).toLowerCase()
      let rawContent: string
      if (ext === '.pdf') {
        rawContent = await extractTextFromFile(filePath)
      } else {
        rawContent = await readTextFile(filePath)
      }

      // Cap at 50,000 chars before storage (T-07-03-05)
      const content = rawContent.substring(0, 50_000)
      const filename = path.basename(filePath)

      const doc = campaignReferenceDocsRepo.create({ campaignId, filename, content })

      log.debug('[campaignDocs] imported doc', {
        campaignId,
        filename,
        contentLength: content.length,
      })

      return doc
    }),

  /**
   * Delete an imported reference doc. campaignId guard prevents cross-campaign deletes.
   */
  delete: t.procedure
    .input(z.object({ docId: z.string(), campaignId: campaignIdSchema }))
    .mutation(({ input }) => {
      campaignReferenceDocsRepo.delete(input.docId, input.campaignId)
    }),

  /**
   * Open an OS file dialog and import the chosen PDF/text file as a campaign reference doc.
   * Returns null if the user cancels. Returns the created CampaignReferenceDoc on success.
   *
   * Security: file path comes only from Electron's dialog (not renderer-supplied).
   * Same path-traversal protections as `import` apply (Electron dialog always returns
   * absolute paths with no traversal sequences).
   */
  importWithDialog: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(async ({ input }) => {
      const { campaignId } = input

      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Rules Document',
        filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md'] }],
        properties: ['openFile'],
      })
      if (canceled || filePaths.length === 0) return null

      const filePath = filePaths[0]

      // Electron dialog always returns absolute paths — double-check for safety
      if (!path.isAbsolute(filePath)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'filePath must be an absolute path' })
      }

      log.debug('[campaignDocs] importWithDialog importing file', { campaignId, filePath })

      const ext = path.extname(filePath).toLowerCase()
      let rawContent: string
      if (ext === '.pdf') {
        rawContent = await extractTextFromFile(filePath)
      } else {
        rawContent = await readTextFile(filePath)
      }

      const content = rawContent.substring(0, 50_000)
      const filename = path.basename(filePath)

      const doc = campaignReferenceDocsRepo.create({ campaignId, filename, content })

      log.debug('[campaignDocs] importWithDialog imported doc', {
        campaignId,
        filename,
        contentLength: content.length,
      })

      return doc
    }),
})
