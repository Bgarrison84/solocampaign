/**
 * GitHub Releases update checker service (Phase 9 — DIST-05).
 *
 * Provides a pure, testable checkForUpdate(currentVersion) function that polls the
 * GitHub Releases API and compares the latest release semver against the running version.
 *
 * Design decisions (from CONTEXT.md):
 *   D-04: GitHub API poll on startup — no electron-updater. Error/timeout is silent.
 *   D-05: Returns UpdateInfo.releaseUrl (html_url from API) for the renderer to open
 *         via shell.openExternal. The html_url is sourced from the GitHub API over HTTPS
 *         and is validated by the preload shellBridge before shell.openExternal (T-09-03).
 *
 * Security:
 *   T-09-03 (Tampering): HTTPS-only URL constant; html_url returned but NOT acted on here —
 *     Plan 02 preload validates it before shell.openExternal. No cert pinning (low-value public data).
 *   T-09-05 (DoS): isNaN guard on parsed semver parts returns safe fallback { available: false }
 *     instead of crashing when tag_name contains non-numeric parts.
 *   T-09-06 (DoS): AbortController 5s timeout; non-ok responses return fallback; check is
 *     fire-and-forget (never blocks startup, D-04).
 *
 * NOTE: No electron-log import — errors are silent per D-04. Logging would be misleading
 * (rate-limit 403 on a dev machine is normal, not an error worth logging).
 */

/** GitHub Releases API endpoint for this repo (slug from package.json repository.url). */
const GITHUB_RELEASES_API_URL =
  'https://api.github.com/repos/briston/solocampaign/releases/latest'

/**
 * Shape returned by checkForUpdate and by the appPrefs.checkForUpdate tRPC query.
 * Consumed by Plan 02 (renderer UpdateBanner component).
 */
export interface UpdateInfo {
  available: boolean
  version: string | null // remote semver with leading 'v' stripped, e.g. "0.2.0"
  releaseUrl: string | null // GitHub release html_url
}

/** Safe fallback returned on any error or non-update condition. */
const NO_UPDATE: UpdateInfo = { available: false, version: null, releaseUrl: null }

/**
 * Check GitHub Releases for a newer version than currentVersion.
 *
 * @param currentVersion - The running app version (e.g. "0.1.0") from app.getVersion().
 * @returns UpdateInfo — resolves to { available: true, version, releaseUrl } if a stable
 *   release with a higher semver is found, or { available: false, version: null, releaseUrl: null }
 *   for equal/older versions, pre-release tags, HTTP errors, network errors, and malformed tags.
 *   Never throws.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(GITHUB_RELEASES_API_URL, {
      headers: { 'User-Agent': 'SoloCampaign-App' },
      signal: controller.signal,
    })

    if (!res.ok) return NO_UPDATE

    const data = (await res.json()) as {
      tag_name: string
      html_url: string
      prerelease: boolean
    }

    // Skip pre-releases (prerelease: true) — only notify on stable releases (T-09-05)
    if (data.prerelease) return NO_UPDATE

    // Strip leading 'v' from tag_name (e.g. "v0.2.0" → "0.2.0")
    const remoteVersion = data.tag_name.replace(/^v/, '')

    // Parse into major.minor.patch integer triplets
    const [ma, mi, pa] = remoteVersion.split('.').map(Number)
    const [ca, ci, cp] = currentVersion.split('.').map(Number)

    // T-09-05: NaN guard — malformed tag_name returns safe fallback instead of crashing
    if (isNaN(ma) || isNaN(mi) || isNaN(pa)) return NO_UPDATE

    // Inline 3-part semver comparison: newer if major > current,
    // or same major and minor > current, or same major+minor and patch > current
    const isNewer =
      ma > ca || (ma === ca && mi > ci) || (ma === ca && mi === ci && pa > cp)

    return isNewer
      ? { available: true, version: remoteVersion, releaseUrl: data.html_url }
      : NO_UPDATE
  } catch {
    // T-09-06: Silent on any exception (network error, AbortError, JSON parse error)
    return NO_UPDATE
  } finally {
    clearTimeout(timeout)
  }
}
