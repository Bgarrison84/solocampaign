/**
 * ai tRPC router — query-only.
 * The send path is the custom IPC channel (ai:send-message), NOT tRPC,
 * because tRPC v10 cannot stream over contextBridge.
 *
 * Queries:
 *   - listReferenceDocs: enumerate available reference documents from disk
 *   - getMessages: retrieve last 200 messages for a campaign (full history, D-16)
 *   - cancelStream: in-memory cancellation signal for the active AI stream
 *
 * Security:
 *   - No decrypt/get of API keys in this router (D-23) — keys live in SecretStorageService
 *   - No plaintext API key crosses any tRPC boundary
 */

import { z } from 'zod'
import { t } from '../_base'
import { campaignIdSchema } from '../schemas'
import { listReferenceDocs } from '../../ai/referenceDocLoader'
import { messagesRepo } from '../../db/messagesRepo'
import { sessionFallbackMap, sessionAbortMap } from '../../ai/aiSessionState'

export const aiRouter = t.router({
  /**
   * List available reference documents from Reference Documents/Converted/.
   * Returns title + relativePath + isLarge per doc (not sizeBytes, not content).
   * Called when the user opens the AI config wizard or settings modal.
   */
  listReferenceDocs: t.procedure.query(() => {
    const docs = listReferenceDocs()
    // Return only the fields the renderer needs — omit sizeBytes (internal detail)
    return docs.map(({ relativePath, title, isLarge }) => ({
      relativePath,
      title,
      isLarge,
    }))
  }),

  /**
   * Get last 200 messages for a campaign in chronological order.
   * D-16: One continuous chat per campaign — full history loads on campaign open.
   * Phase 4 will add session boundaries.
   */
  getMessages: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .query(({ input }) => {
      return messagesRepo.getLastN(input.campaignId, 200)
    }),

  /**
   * Cancel the active stream for a campaign.
   * Aborts the running streamText call via AbortController and clears fallback state (D-19).
   */
  cancelStream: t.procedure
    .input(z.object({ campaignId: campaignIdSchema }))
    .mutation(({ input }) => {
      sessionAbortMap.abortStream(input.campaignId)
      sessionFallbackMap.clearFallback(input.campaignId)
      return { cancelled: true }
    }),
})
