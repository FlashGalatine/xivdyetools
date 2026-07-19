/**
 * Unit tests for fileService — the HTTP client for the local Express backend.
 *
 * The module caches a session token at module scope, so each test re-imports a
 * fresh copy via vi.resetModules() to avoid cross-test token leakage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type FileService = typeof import('./fileService')

async function freshService(): Promise<FileService> {
  vi.resetModules()
  return import('./fileService')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Route-based fetch mock: maps URL substrings to responder functions. */
function stubFetchRoutes(
  routes: Array<[match: string, respond: (init: RequestInit) => Response]>
): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
    for (const [match, respond] of routes) {
      if (url.includes(match)) return Promise.resolve(respond(init))
    }
    return Promise.resolve(jsonResponse({ error: 'unmatched route: ' + url }, 404))
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('checkServerHealth', () => {
  it('returns true and establishes a session when server is healthy', async () => {
    const svc = await freshService()
    const mock = stubFetchRoutes([
      ['/health', () => jsonResponse({ status: 'ok' })],
      ['/auth/session', () => jsonResponse({ token: 'tok-1' })],
    ])

    await expect(svc.checkServerHealth()).resolves.toBe(true)
    const urls = mock.mock.calls.map((c) => c[0] as string)
    expect(urls.some((u) => u.includes('/auth/session'))).toBe(true)
  })

  it('returns false when the server is unreachable', async () => {
    const svc = await freshService()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('ECONNREFUSED')))

    await expect(svc.checkServerHealth()).resolves.toBe(false)
  })

  it('returns false when health status is not ok', async () => {
    const svc = await freshService()
    stubFetchRoutes([['/health', () => jsonResponse({ status: 'degraded' })]])

    await expect(svc.checkServerHealth()).resolves.toBe(false)
  })
})

describe('read endpoints', () => {
  it('readColorsJson returns the dye array', async () => {
    const svc = await freshService()
    stubFetchRoutes([['/colors', () => jsonResponse([{ itemID: 5738 }])]])

    await expect(svc.readColorsJson()).resolves.toEqual([{ itemID: 5738 }])
  })

  it('readColorsJson throws on non-OK response', async () => {
    const svc = await freshService()
    stubFetchRoutes([['/colors', () => jsonResponse({}, 500)]])

    await expect(svc.readColorsJson()).rejects.toThrow('Failed to read colors file')
  })

  it('readLocaleJson throws with the locale in the message', async () => {
    const svc = await freshService()
    stubFetchRoutes([['/locale/ko', () => jsonResponse({}, 500)]])

    await expect(svc.readLocaleJson('ko')).rejects.toThrow('Failed to read locale file: ko')
  })

  it('checkDuplicateItemId returns the exists flag', async () => {
    const svc = await freshService()
    stubFetchRoutes([['/validate/5738', () => jsonResponse({ exists: true })]])

    await expect(svc.checkDuplicateItemId(5738)).resolves.toBe(true)
  })

  it('getLocaleLabels returns the label map', async () => {
    const svc = await freshService()
    stubFetchRoutes([['/locales/labels', () => jsonResponse({ ja: 'カララント' })]])

    await expect(svc.getLocaleLabels()).resolves.toEqual({ ja: 'カララント' })
  })
})

describe('mutations and token retry', () => {
  it('writeColorsJson attaches a session token header', async () => {
    const svc = await freshService()
    let seenToken: string | undefined
    stubFetchRoutes([
      ['/auth/session', () => jsonResponse({ token: 'tok-A' })],
      [
        '/colors',
        (init) => {
          seenToken = (init.headers as Record<string, string>)['X-Session-Token']
          return jsonResponse({ success: true })
        },
      ],
    ])

    await expect(svc.writeColorsJson([])).resolves.toEqual({ success: true })
    expect(seenToken).toBe('tok-A')
  })

  it('refreshes the token and retries exactly once on 401 (MAINT-BUG-005)', async () => {
    const svc = await freshService()
    let sessionCalls = 0
    let writeCalls = 0
    stubFetchRoutes([
      [
        '/auth/session',
        () => jsonResponse({ token: `tok-${++sessionCalls}` }),
      ],
      [
        '/locale/en',
        (init) => {
          writeCalls++
          const token = (init.headers as Record<string, string>)['X-Session-Token']
          return token === 'tok-2'
            ? jsonResponse({ success: true })
            : jsonResponse({ error: 'unauthorized' }, 401)
        },
      ],
    ])

    const result = await svc.writeLocaleJson('en', {
      dyeNames: {},
      meta: { dyeCount: 0, generated: '' },
    } as never)

    expect(result).toEqual({ success: true })
    expect(writeCalls).toBe(2) // original + one retry
    expect(sessionCalls).toBe(2) // initial mint + forced refresh
  })
})

describe('addDyeToDatabase', () => {
  const dye = { itemID: 5738 } as never
  const localeNames = { en: 'Soot Black', ja: '', de: '', fr: '', ko: '', zh: '' }

  it('writes colors then all six locales on the happy path', async () => {
    const svc = await freshService()
    const localeWrites: string[] = []
    stubFetchRoutes([
      ['/auth/session', () => jsonResponse({ token: 'tok' })],
      [
        '/locale/',
        (init) => {
          if (init.method === 'POST') {
            localeWrites.push('write')
            return jsonResponse({ success: true })
          }
          return jsonResponse({ dyeNames: {}, meta: { dyeCount: 0, generated: '' } })
        },
      ],
      [
        '/colors',
        (init) =>
          init.method === 'POST' ? jsonResponse({ success: true }) : jsonResponse([]),
      ],
    ])

    const result = await svc.addDyeToDatabase(dye, localeNames)

    expect(result).toEqual({ success: true, errors: [] })
    expect(localeWrites).toHaveLength(6)
  })

  it('stops early when the colors write fails', async () => {
    const svc = await freshService()
    stubFetchRoutes([
      ['/auth/session', () => jsonResponse({ token: 'tok' })],
      [
        '/colors',
        (init) =>
          init.method === 'POST'
            ? jsonResponse({ success: false, error: 'disk full' })
            : jsonResponse([]),
      ],
    ])

    const result = await svc.addDyeToDatabase(dye, localeNames)

    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['disk full'])
  })

  it('collects per-locale errors without aborting the loop', async () => {
    const svc = await freshService()
    stubFetchRoutes([
      ['/auth/session', () => jsonResponse({ token: 'tok' })],
      ['/locale/ja', () => jsonResponse({}, 500)],
      [
        '/locale/',
        (init) =>
          init.method === 'POST'
            ? jsonResponse({ success: true })
            : jsonResponse({ dyeNames: {}, meta: { dyeCount: 0, generated: '' } }),
      ],
      [
        '/colors',
        (init) =>
          init.method === 'POST' ? jsonResponse({ success: true }) : jsonResponse([]),
      ],
    ])

    const result = await svc.addDyeToDatabase(dye, localeNames)

    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['Failed to update ja locale: Failed to read locale file: ja'])
  })
})
