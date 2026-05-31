import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { generateText } from 'ai'
import path from 'node:path'
import { dialog } from 'electron'
import { t } from '../_base'
import { campaignsRepo } from '../../db/campaignsRepo'
import { campaignNameSchema, campaignIdSchema, aiConfigSchema } from '../schemas'
import { importImage, getImageDataUrl } from '../../imageService'
import { secretStorage } from '../../secrets'
import { buildModel } from '../../ai/llmProvider'
import { extractTextFromFile, readTextFile } from '../../services/pdfExtractor'
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

      const prompt =
        `You are world-building a D&D 5e campaign setting. Create a detailed world brief for the campaign named "${campaign.name}". ` +
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
