import { z } from 'zod'
import { t } from '../_base'
import { secretStorage } from '../../secrets'

/**
 * Key validation schema.
 * - Minimum 1 character, maximum 64 characters
 * - Only allows [a-zA-Z0-9_.-] — no slashes, spaces, unicode, or other chars
 *
 * This is defense-in-depth: SecretStorageService.filepath() also normalizes,
 * but rejecting at the IPC boundary (Zod) catches path traversal attempts
 * before they reach the filesystem layer.
 *
 * T-KEY-03: Zod regex prevents path traversal via malicious key names.
 * T-KEY-04: max(64) and value max(2048) prevent disk exhaustion.
 */
const secretKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Key contains illegal characters')

/**
 * Value validation schema.
 * - Minimum 1 character (no empty secrets)
 * - Maximum 2048 characters (API keys and tokens fit well under 2KB)
 *
 * SECURITY: The value parameter is NEVER logged anywhere in this file.
 * T-KEY-05: No log call in this file references the value argument.
 */
const secretValueSchema = z.string().min(1).max(2048)

/**
 * tRPC router for the secrets IPC surface.
 *
 * CRITICAL SECURITY CONTRACT (FOUND-04 / T-KEY-01):
 * There is NO `get` procedure. Returning plaintext secrets to the renderer
 * over IPC would defeat the purpose of safeStorage encryption. Phase 3 will
 * design a per-request scoped use pattern (e.g., chat.send accepts an opaque
 * secret key, the main process decrypts in-place, makes the LLM call, and
 * never returns the plaintext to the renderer).
 *
 * Exposed procedures:
 *   - exists: query — returns true/false without revealing the secret value
 *   - set: mutation — encrypts and stores the secret
 *   - delete: mutation — removes the stored secret file
 */
export const secretsRouter = t.router({
  exists: t.procedure
    .input(z.object({ key: secretKeySchema }))
    .query(({ input }) => secretStorage.exists(input.key)),

  set: t.procedure
    .input(z.object({ key: secretKeySchema, value: secretValueSchema }))
    .mutation(({ input }) => secretStorage.encrypt(input.key, input.value)),

  delete: t.procedure
    .input(z.object({ key: secretKeySchema }))
    .mutation(({ input }) => secretStorage.remove(input.key)),

  // IMPORTANT: There is intentionally no `get` procedure here.
  // See FOUND-04, T-KEY-01, and the plan's IPC security contract.
})
