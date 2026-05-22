import { SecretStorageService } from './secretStorageService'

/**
 * Module-level singleton for the secret storage service.
 * The main process awaits `secretStorage.init()` once at startup
 * (inside app.whenReady, after the DB is opened, before the BrowserWindow is created).
 */
export const secretStorage = new SecretStorageService()
