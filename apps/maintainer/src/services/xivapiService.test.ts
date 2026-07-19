/**
 * Unit tests for xivapiService — XIVAPI item-name fetching with concurrent
 * per-locale requests, dye-prefix stripping (incl. full-width colon), and
 * deterministic error aggregation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fetchItemNames,
  stripDyePrefix,
  isXivapiSupported,
  SUPPORTED_LANGUAGES,
} from './xivapiService'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('stripDyePrefix', () => {
  it('strips a bare prefix', () => {
    expect(stripDyePrefix('Dye Soot Black', 'Dye ')).toBe('Soot Black')
  })

  it('strips prefix with ASCII colon', () => {
    expect(stripDyePrefix('Dye: Soot Black', 'Dye')).toBe('Soot Black')
  })

  it('strips prefix with full-width colon (BUG-081)', () => {
    expect(stripDyePrefix('カララント：スートブラック', 'カララント')).toBe('スートブラック')
  })

  it('returns name unchanged when prefix does not match', () => {
    expect(stripDyePrefix('Soot Black', 'カララント')).toBe('Soot Black')
  })

  it('returns name unchanged for empty name or prefix', () => {
    expect(stripDyePrefix('', 'Dye')).toBe('')
    expect(stripDyePrefix('Soot Black', '')).toBe('Soot Black')
  })
})

describe('isXivapiSupported', () => {
  it('en/ja/de/fr are supported', () => {
    for (const lang of ['en', 'ja', 'de', 'fr'] as const) {
      expect(isXivapiSupported(lang)).toBe(true)
    }
  })

  it('ko/zh are not supported', () => {
    expect(isXivapiSupported('ko')).toBe(false)
    expect(isXivapiSupported('zh')).toBe(false)
  })
})

describe('fetchItemNames', () => {
  it('fetches names for all four supported languages and strips prefixes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const lang = new URL(url).searchParams.get('language')
        const names: Record<string, string> = {
          en: 'Soot Black Dye',
          ja: 'カララント：スートブラック',
          de: 'Rußschwarz',
          fr: 'Noir de suie',
        }
        return Promise.resolve(
          jsonResponse({ rows: [{ fields: { Name: names[lang!] } }] })
        )
      })
    )

    const result = await fetchItemNames(5738, { ja: 'カララント' })

    expect(result.errors).toEqual([])
    expect(result.autoFilled).toEqual([...SUPPORTED_LANGUAGES])
    expect(result.names.ja).toBe('スートブラック')
    expect(result.names.en).toBe('Soot Black Dye')
  })

  it('reports HTTP failures per language without failing the others', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const lang = new URL(url).searchParams.get('language')
        if (lang === 'de') {
          return Promise.resolve(jsonResponse({}, 500))
        }
        return Promise.resolve(jsonResponse({ rows: [{ fields: { Name: `name-${lang}` } }] }))
      })
    )

    const result = await fetchItemNames(5738, {})

    expect(result.autoFilled).toEqual(['en', 'ja', 'fr'])
    expect(result.errors).toEqual(['Failed to fetch de: HTTP 500'])
  })

  it('reports "No data found" for empty row sets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ rows: [] })))
    )

    const result = await fetchItemNames(99999999, {})

    expect(result.autoFilled).toEqual([])
    expect(result.errors).toEqual([
      'No data found for en',
      'No data found for ja',
      'No data found for de',
      'No data found for fr',
    ])
  })
})
