import { safeStorage, app } from 'electron'
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import log from 'electron-log'

// Module-scope flag so the fallback warning is logged only once per process
let _fallbackWarningLogged = false

export class SecretStorageService {
  private get dir(): string {
    return path.join(app.getPath('userData'), 'secrets')
  }

  /**
   * Creates the secrets directory if it does not exist.
   * Must be called once at app startup before any encrypt/decrypt calls.
   */
  async init(): Promise<void> {
    if (!existsSync(this.dir)) {
      await mkdir(this.dir, { recursive: true })
    }
  }

  /**
   * Returns true only when BOTH conditions hold:
   *   1. safeStorage.isEncryptionAvailable() is true
   *   2. getSelectedStorageBackend() is NOT 'basic_text'
   *
   * Pitfall #10: isEncryptionAvailable() returns true on headless Linux even
   * when the backend is the trivial basic_text fallback (hard-coded password).
   * We must check both.
   */
  isSecure(): boolean {
    return (
      safeStorage.isEncryptionAvailable() &&
      safeStorage.getSelectedStorageBackend() !== 'basic_text'
    )
  }

  /**
   * Encrypts a value and writes it to disk.
   * - Secure path: uses safeStorage.encryptString (DPAPI / Keychain / kwallet)
   * - Fallback path: writes a B64:-prefixed base64 payload and logs a warning
   *
   * SECURITY: The value parameter is NEVER logged.
   */
  async encrypt(key: string, value: string): Promise<void> {
    if (this.isSecure()) {
      const buf = safeStorage.encryptString(value)
      await writeFile(this.filepath(key), buf)
    } else {
      // Headless Linux fallback (basic_text backend or encryption unavailable)
      // D-15: base64-encode with a B64: magic prefix so decrypt can discriminate.
      if (!_fallbackWarningLogged) {
        log.warn(
          '[SecretStorage] safeStorage backend is basic_text — values are not securely encrypted.'
        )
        _fallbackWarningLogged = true
      }
      const b64Payload = Buffer.from(value).toString('base64')
      const buf = Buffer.concat([Buffer.from('B64:'), Buffer.from(b64Payload)])
      await writeFile(this.filepath(key), buf)
    }
  }

  /**
   * Decrypts a previously encrypted value.
   * Returns null if no file exists for the key.
   * Handles both safeStorage-encrypted and B64:-prefixed fallback payloads.
   *
   * SECURITY: The decrypted value is NEVER logged.
   */
  async decrypt(key: string): Promise<string | null> {
    const fp = this.filepath(key)
    if (!existsSync(fp)) return null

    const buf = await readFile(fp)
    if (buf.subarray(0, 4).toString() === 'B64:') {
      // Fallback path: strip the B64: prefix and base64-decode
      return Buffer.from(buf.subarray(4).toString('ascii'), 'base64').toString()
    }
    // Secure path: delegate to safeStorage
    return safeStorage.decryptString(buf)
  }

  /**
   * Returns true if a secret file exists for the given key.
   */
  async exists(key: string): Promise<boolean> {
    return existsSync(this.filepath(key))
  }

  /**
   * Removes the secret file for the given key.
   * Calling remove on a non-existent key is a no-op (no throw).
   */
  async remove(key: string): Promise<void> {
    const fp = this.filepath(key)
    if (existsSync(fp)) {
      await unlink(fp)
    }
  }

  /**
   * Normalizes a key to safe filesystem characters.
   * Replaces any character outside [a-zA-Z0-9_.-] with '_'.
   * This prevents path traversal (/ \ .. null bytes) before concatenation.
   *
   * Security: Normalization happens here — the Zod schema in the tRPC router
   * provides a second layer of defense at the IPC boundary.
   */
  private filepath(key: string): string {
    const normalized = key.replace(/[^a-zA-Z0-9_.-]/g, '_')
    return path.join(this.dir, `${normalized}.enc`)
  }
}
