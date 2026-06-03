import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { generateText } from 'ai'
import path from 'node:path'
import { writeFile, readFile, stat } from 'node:fs/promises'
import { dialog } from 'electron'
import { t } from '../_base'
import { campaignsRepo } from '../../db/campaignsRepo'
import { campaignNameSchema, campaignIdSchema, aiConfigSchema } from '../schemas'
import { importImage, getImageDataUrl } from '../../imageService'
import { secretStorage } from '../../secrets'
import { buildModel } from '../../ai/llmProvider'
import { extractTextFromFile, readTextFile } from '../../services/pdfExtractor'
import { exportCampaign, importCampaignOrTemplate, exportStarterTemplate } from '../../db/exportImport'
import log from 'electron-log'

export const campaignsRouter = t.router({
  list: t.procedure.query(() => {
    return campaignsRepo.list()
  }),

  create: t.procedure
    .input(
      z.object({
        name: campaignNameSchema,
        partySize: z.number().int().min(1).max(4).optional(),
        encumbranceEnabled: z.boolean().optional(),
        worldSetupMode: z.enum(['ai', 'brief', 'import']).optional(),
        worldBrief: z.string().max(8000).optional(),
        worldDocument: z.string().max(50_000).optional(),
      }),
    )
    .mutation(({ input }) => {
      return campaignsRepo.create({
        name: input.name,
        partySize: input.partySize ?? 1,
        encumbranceEnabled: input.encumbranceEnabled ?? false,
        worldSetupMode: input.worldSetupMode ?? null,
        worldBrief: input.worldBrief ?? null,
        worldDocument: input.worldDocument ?? null,
      })
    }),

  get: t.procedure
    .input(z.object({ id: campaignIdSchema }))
    .query(({ input }) => {
      return campaignsRepo.get(input.id)
    }),

  delete: t.procedure
    .input(z.object({ id: campaignIdSchema }))
    .mutation(({ input }) => {
      campaignsRepo.delete(input.id)
    }),

  /**
   * Import a cover image for a campaign.
   * Opens a native OS file dialog, resizes to max 1024px, stores relative path in DB.
   * Returns null if the user cancels the dialog (no image selected).
   * Cover-image persistence lives in campaignsRepo (campaign domain — W4 fix).
   */
  importCoverImage: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(async ({ input }) => {
      const relativePath = await importImage(input.campaignId, 'cover')
      if (relativePath === null) return null
      campaignsRepo.updateCoverImagePath(input.campaignId, relativePath)
      return relativePath
    }),

  /**
   * Get campaign cover image as a base64 data URL.
   * Returns null if no cover image is set or if the file no longer exists.
   */
  getCoverDataUrl: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(async ({ input }) => {
      const campaign = campaignsRepo.get(input.campaignId)
      if (!campaign || !campaign.coverImagePath) return null
      return await getImageDataUrl(campaign.coverImagePath)
    }),

  /**
   * Persist the permadeath mode toggle for a campaign (PROG-04).
   *
   * Security (T-05-07-01): campaignId validated as UUID; permadeathMode as boolean.
   * Writes only the permadeath_mode column — no other state is affected.
   */
  setPermadeath: t.procedure
    .input(z.object({ campaignId: campaignIdSchema, permadeathMode: z.boolean() }))
    .mutation(({ input }) => {
      campaignsRepo.setPermadeath(input.campaignId, input.permadeathMode)
      return { updated: true }
    }),

  /**
   * Persist AI provider config for a campaign.
   *
   * Security contract (D-07, D-08, D-23):
   * - The 8 non-secret columns are persisted to SQLite via campaignsRepo.updateAiConfig.
   * - apiKey: if non-empty string → encrypt('ai-key-{campaignId}');
   *           if empty string → remove('ai-key-{campaignId}') (clears previously stored key);
   *           if undefined → leave stored key untouched.
   * - Same logic for fallbackApiKey → key 'ai-fallback-{campaignId}'.
   * - NEVER persist a key to SQLite. NEVER return a key.
   * - Key naming: 'ai-key-{campaignId}' and 'ai-fallback-{campaignId}'.
   *   Campaign UUIDs use hyphens, which are in [a-zA-Z0-9_.-] — valid for secretKeySchema.
   *   Total lengths: 7+36=43 chars (primary), 11+36=47 chars (fallback) — under 64-char max.
   */
  updateAiConfig: t.procedure
    .input(aiConfigSchema)
    .mutation(async ({ input }) => {
      const { campaignId, apiKey, fallbackApiKey, ...configFields } = input

      // Persist the 8 non-secret columns (referenceDocs serialized to JSON by campaignsRepo)
      campaignsRepo.updateAiConfig(campaignId, {
        providerType: configFields.providerType,
        endpointUrl: configFields.endpointUrl ?? null,
        modelName: configFields.modelName,
        referenceDocs: configFields.referenceDocs,
        dmPersonality: configFields.dmPersonality ?? null,
        strictness: configFields.strictness,
        fallbackEndpointUrl: configFields.fallbackEndpointUrl ?? null,
        fallbackModelName: configFields.fallbackModelName ?? null,
      })

      // Handle primary API key — key = 'ai-key-{campaignId}' (D-08)
      if (apiKey !== undefined) {
        if (apiKey.length > 0) {
          await secretStorage.encrypt('ai-key-' + campaignId, apiKey)
        } else {
          await secretStorage.remove('ai-key-' + campaignId)
        }
      }
      // If apiKey is undefined, leave the stored key untouched

      // Handle fallback API key — key = 'ai-fallback-{campaignId}' (D-08)
      if (fallbackApiKey !== undefined) {
        if (fallbackApiKey.length > 0) {
          await secretStorage.encrypt('ai-fallback-' + campaignId, fallbackApiKey)
        } else {
          await secretStorage.remove('ai-fallback-' + campaignId)
        }
      }
      // If fallbackApiKey is undefined, leave the stored key untouched

      // Return the updated campaign row (contains no key columns — D-23)
      return campaignsRepo.get(campaignId)
    }),

  /**
   * Open the OS file picker and extract text from a PDF/txt/md document.
   * Used by the "Import a Document" world-setup mode in the campaign creation wizard.
   *
   * Security (T-07-07-01):
   * - File path comes ONLY from dialog.showOpenDialog (OS-validated by user — no renderer path injection).
   * - Extracted text is returned to renderer for wizard-state preview; written to DB only at create time.
   * - Content truncated to 50,000 chars (mirrors campaignDocs.import cap).
   *
   * Returns null if the user cancels the dialog.
   */
  importWorldDoc: t.procedure.mutation(async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select World Document',
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'md'] },
      ],
      properties: ['openFile'],
    })

    if (canceled || filePaths.length === 0) return null

    const filePath = filePaths[0]

    // Security: absolute path guaranteed by dialog; double-check no traversal
    if (!path.isAbsolute(filePath) || filePath.includes('..')) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file path' })
    }

    log.debug('[campaigns] importWorldDoc', { filePath })

    const ext = path.extname(filePath).toLowerCase()
    let rawContent: string
    if (ext === '.pdf') {
      rawContent = await extractTextFromFile(filePath)
    } else {
      rawContent = await readTextFile(filePath)
    }

    const content = rawContent.substring(0, 50_000)
    const filename = path.basename(filePath)

    return { filename, content }
  }),

  /**
   * Persist free-form homebrew content for a campaign (RULES-03).
   * Content is capped at 50,000 chars (enforced in campaignsRepo).
   */
  updateHomebrew: t.procedure
    .input(z.object({ campaignId: campaignIdSchema, homebrewContent: z.string() }))
    .mutation(({ input }) => {
      campaignsRepo.updateHomebrew(input.campaignId, input.homebrewContent)
      return { updated: true }
    }),

  /**
   * Export a campaign as a JSON file via OS save dialog (DIST-01).
   *
   * Security (T-08-09):
   * - campaignId validated as UUID by campaignIdSchema
   * - File path comes ONLY from dialog.showSaveDialog (OS-validated — no path traversal)
   */
  export: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(async ({ input }) => {
      const payload = exportCampaign(input.campaignId)

      const campaignName = (payload.data.campaign.name as string) ?? 'campaign'
      const safeName = campaignName.toLowerCase().replace(/\s+/g, '-')

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${safeName}-export.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (canceled || !filePath) {
        return { canceled: true }
      }

      // Path is from OS dialog — safe absolute path, no traversal risk
      log.debug('[campaigns] export writing to:', filePath)
      await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')

      return { canceled: false }
    }),

  /**
   * Export a campaign as a starter template JSON file via OS save dialog (DIST-03).
   * Includes ONLY the D-15 world config fields — no characters/sessions/save state (T-08-12).
   *
   * Security (T-08-13):
   * - campaignId validated as UUID by campaignIdSchema
   * - File path comes ONLY from dialog.showSaveDialog (OS-validated — no path traversal)
   */
  exportTemplate: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(async ({ input }) => {
      const payload = exportStarterTemplate(input.campaignId)

      const safeName = payload.name.toLowerCase().replace(/\s+/g, '-')

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${safeName}-template.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (canceled || !filePath) {
        return { canceled: true }
      }

      log.debug('[campaigns] exportTemplate writing to:', filePath)
      await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')

      return { canceled: false }
    }),

  /**
   * Import a campaign or starter template from a JSON file via OS open dialog (DIST-01, DIST-03).
   *
   * Security (T-08-06, T-08-08, T-08-09):
   * - File path from dialog.showOpenDialog only (no renderer-supplied paths)
   * - Rejects files > 50MB before readFile
   * - JSON.parse guarded in try/catch; TRPCErrors from dispatcher propagate
   * - All UUIDs regenerated on import (T-08-10)
   */
  importJson: t.procedure.mutation(async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (canceled || !filePaths[0]) {
      return { canceled: true }
    }

    const filePath = filePaths[0]

    // Reject oversized files before reading (T-08-08, DoS protection)
    const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
    const fileStats = await stat(filePath)
    if (fileStats.size > MAX_BYTES) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This file is too large to import. Campaign exports should be under 50 MB.',
      })
    }

    const raw = await readFile(filePath, 'utf-8')

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This file is not a valid SoloCampaign export. Make sure you selected the correct .json file.',
      })
    }

    log.debug('[campaigns] importJson dispatching parsed file from:', filePath)

    // Let TRPCErrors from importCampaignOrTemplate propagate (version/type/import-failed)
    const result = importCampaignOrTemplate(parsed)

    return { canceled: false, ...result }
  }),

  /**
   * Open an OS file dialog for .txt / .md files and return the text content.
   * Used by the Homebrew tab "Import file…" button to append file text to the textarea.
   * Returns null if the user cancels. Throws on file read errors.
   *
   * Security: file path comes only from Electron's dialog (not renderer-supplied).
   * Content is capped at 50,000 chars to prevent DoS (T-07-10-02).
   */
  importHomebrewTextWithDialog: t.procedure
    .mutation(async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Homebrew Text',
        filters: [{ name: 'Text Files', extensions: ['txt', 'md'] }],
        properties: ['openFile'],
      })
      if (canceled || filePaths.length === 0) return null

      const content = await readTextFile(filePaths[0])
      return content.substring(0, 50_000)
    }),

  /**
   * Generate a world brief for a campaign via AI (WORLD-01).
   *
   * Produces a 500-800 word world brief describing: setting name, tone, factions,
   * main conflict, key locations, and a Session 1 hook. Uses generateText (non-streaming)
   * to mirror the recap generator pattern (Phase 4). Saves the result via
   * campaignsRepo.updateWorldBrief so contextBuilder can inject it into future sessions.
   *
   * Security: campaignId validated as UUID; apiKey fetched from safeStorage (not DB).
   */
  generateWorldBrief: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(async ({ input }) => {
      const { campaignId } = input

      const campaign = campaignsRepo.get(campaignId)
      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' })
      }

      if (!campaign.providerType || !campaign.modelName) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'AI provider is not configured for this campaign',
        })
      }

      const apiKey = await secretStorage.decrypt('ai-key-' + campaignId)

      const model = buildModel({
        type: campaign.providerType as 'openai-compatible' | 'gemini',
        endpointUrl: campaign.endpointUrl ?? undefined,
        modelName: campaign.modelName,
        apiKey: apiKey ?? undefined,
      })

      // WR-01: sanitize name before embedding in prompt (strip chars that break delimiters)
      const safeName = campaign.name.replace(/["\\\n]/g, ' ')
      const prompt =
        `You are world-building a D&D 5e campaign setting. Create a detailed world brief for the campaign named: """${safeName}""". ` +
        'Include: the setting name and geographic overview, the overall tone and themes, 2-3 major factions or power groups, ' +
        'the main conflict or central threat, 3-5 key locations, and a compelling Session 1 hook. ' +
        'Write in 500-800 words in third-person present tense. Be specific and evocative. ' +
        'This brief will be used by an AI Dungeon Master to guide the entire campaign.'

      log.debug('[campaigns] generateWorldBrief starting', { campaignId, modelName: campaign.modelName })

      try {
        const result = await generateText({
          model,
          prompt,
          temperature: 0.8,
        })

        const brief = result.text
        campaignsRepo.updateWorldBrief(campaignId, brief)

        log.debug('[campaigns] generateWorldBrief complete', {
          campaignId,
          briefLength: brief.length,
        })

        return { brief }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log.error('[campaigns] generateWorldBrief failed:', message)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `World brief generation failed: ${message}`,
        })
      }
    }),
})
