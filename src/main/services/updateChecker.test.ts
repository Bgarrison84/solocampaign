import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for updateChecker service (Phase 9 — DIST-05).
 *
 * Pins the UpdateInfo contract for checkForUpdate(currentVersion):
 *   - newer remote version → { available: true, version, releaseUrl }
 *   - equal version → { available: false, version: null, releaseUrl: null }
 *   - older remote version → { available: false, ... }
 *   - network error (fetch rejects) → { available: false, ... } (no throw)
 *   - non-ok HTTP response (e.g. 403 rate limit) → { available: false, ... }
 *   - pre-release tag (prerelease: true) → { available: false, ... }
 *
 * Uses vi.stubGlobal('fetch', ...) to mock the global fetch — no electron mock
 * needed because the service is pure Node (takes currentVersion as a parameter).
 */

type MockFetchResponse = {
  ok: boolean
  json: () => Promise<unknown>
}

function makeFetchMock(response: MockFetchResponse): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch
}

function makeJsonResponse(data: unknown): MockFetchResponse {
  return {
    ok: true,
    json: async () => data,
  }
}

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns { available: true } when remote tag is newer than currentVersion', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock(
        makeJsonResponse({
          tag_name: 'v0.2.0',
          html_url: 'https://github.com/briston/solocampaign/releases/tag/v0.2.0',
          prerelease: false,
        }),
      ),
    )

    const { checkForUpdate } = await import('./updateChecker')
    const result = await checkForUpdate('0.1.0')

    expect(result).toEqual({
      available: true,
      version: '0.2.0',
      releaseUrl: 'https://github.com/briston/solocampaign/releases/tag/v0.2.0',
    })
  })

  it('returns { available: false } when remote tag equals currentVersion', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock(
        makeJsonResponse({
          tag_name: 'v0.1.0',
          html_url: 'https://github.com/briston/solocampaign/releases/tag/v0.1.0',
          prerelease: false,
        }),
      ),
    )

    const { checkForUpdate } = await import('./updateChecker')
    const result = await checkForUpdate('0.1.0')

    expect(result).toEqual({
      available: false,
      version: null,
      releaseUrl: null,
    })
  })

  it('returns { available: false } when remote tag is older than currentVersion', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock(
        makeJsonResponse({
          tag_name: 'v0.0.9',
          html_url: 'https://github.com/briston/solocampaign/releases/tag/v0.0.9',
          prerelease: false,
        }),
      ),
    )

    const { checkForUpdate } = await import('./updateChecker')
    const result = await checkForUpdate('0.1.0')

    expect(result).toEqual({
      available: false,
      version: null,
      releaseUrl: null,
    })
  })

  it('returns { available: false } when fetch rejects (network error) and does NOT throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure')) as unknown as typeof fetch,
    )

    const { checkForUpdate } = await import('./updateChecker')

    // Must not throw
    const result = await checkForUpdate('0.1.0')

    expect(result).toEqual({
      available: false,
      version: null,
      releaseUrl: null,
    })
  })

  it('returns { available: false } when res.ok is false (e.g. 403 rate limit)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'API rate limit exceeded' }),
      }) as unknown as typeof fetch,
    )

    const { checkForUpdate } = await import('./updateChecker')
    const result = await checkForUpdate('0.1.0')

    expect(result).toEqual({
      available: false,
      version: null,
      releaseUrl: null,
    })
  })

  it('returns { available: false } when remote release is a pre-release (prerelease: true)', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock(
        makeJsonResponse({
          tag_name: 'v0.2.0-beta.1',
          html_url: 'https://github.com/briston/solocampaign/releases/tag/v0.2.0-beta.1',
          prerelease: true,
        }),
      ),
    )

    const { checkForUpdate } = await import('./updateChecker')
    const result = await checkForUpdate('0.1.0')

    expect(result).toEqual({
      available: false,
      version: null,
      releaseUrl: null,
    })
  })
})
