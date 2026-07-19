/**
 * XIVAPI Service - Fetch item data from XIVAPI
 */

import type { XivapiItemResponse, LocaleCode } from '@/types'
// MAINT-REF-003 FIX: Import from centralized constants
import { XIVAPI_SUPPORTED_LOCALES } from '@/utils/constants'
// BUG-003 FIX: Import fetchWithTimeout to prevent hung requests
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

const XIVAPI_BASE = 'https://v2.xivapi.com/api'
// MAINT-REF-003 FIX: Use centralized constant (cast to mutable array for iteration)
const SUPPORTED_LANGUAGES: LocaleCode[] = [...XIVAPI_SUPPORTED_LOCALES]

export interface FetchedNames {
  names: Partial<Record<LocaleCode, string>>
  autoFilled: LocaleCode[]
  errors: string[]
}

/**
 * Fetch item names from XIVAPI for all supported languages
 */
export async function fetchItemNames(
  itemId: number,
  dyePrefixes: Record<string, string>
): Promise<FetchedNames> {
  const result: FetchedNames = {
    names: {},
    autoFilled: [],
    errors: [],
  }

  // OPT-029: the four locale requests are independent — fan out concurrently
  // so total latency is the max of the four instead of the sum (worst case
  // with XIVAPI down: 10 s instead of 40 s of sequential timeouts).
  const outcomes = await Promise.allSettled(
    SUPPORTED_LANGUAGES.map(async (lang) => {
      // BUG-003 FIX: Use fetchWithTimeout with 10s timeout to prevent hung requests
      const response = await fetchWithTimeout(
        `${XIVAPI_BASE}/sheet/Item?rows=${itemId}&language=${lang}`,
        {},
        10000
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: XivapiItemResponse = await response.json()

      if (!data.rows || data.rows.length === 0) {
        throw new Error('No data found')
      }

      return data.rows[0].fields.Name
    })
  )

  // Aggregate in language order so error messages stay deterministic
  for (let i = 0; i < SUPPORTED_LANGUAGES.length; i++) {
    const lang = SUPPORTED_LANGUAGES[i]
    const outcome = outcomes[i]

    if (outcome.status === 'fulfilled') {
      let name = outcome.value

      // Strip dye prefix if present
      const prefix = dyePrefixes[lang]
      if (prefix && name) {
        name = stripDyePrefix(name, prefix)
      }

      result.names[lang] = name
      result.autoFilled.push(lang)
    } else {
      const reason: unknown = outcome.reason
      const message = reason instanceof Error ? reason.message : 'Unknown error'
      if (message === 'No data found') {
        result.errors.push(`No data found for ${lang}`)
      } else {
        result.errors.push(`Failed to fetch ${lang}: ${message}`)
      }
    }
  }

  return result
}

/**
 * Strip dye prefix from name
 * e.g., "カララント:スートブラック" -> "スートブラック"
 */
export function stripDyePrefix(name: string, prefix: string): string {
  if (!name || !prefix) return name

  // BUG-081: try the bare prefix plus BOTH colon variants. The previous code
  // contained only ASCII ':' in all branches (the "full-width colon" entry
  // was the same ASCII character, visually near-identical in most editors),
  // so a configured prefix without a colon never matched Japanese names like
  // 'カララント：スートブラック' (U+FF1A full-width colon).
  const prefixVariants = [
    prefix,
    prefix + ':', // ASCII colon
    prefix + '：', // full-width colon ：
  ]

  for (const variant of prefixVariants) {
    if (name.startsWith(variant)) {
      return name.slice(variant.length).trim()
    }
  }

  return name
}

/**
 * Check if a language is supported by XIVAPI
 */
export function isXivapiSupported(lang: LocaleCode): boolean {
  return SUPPORTED_LANGUAGES.includes(lang)
}

export { SUPPORTED_LANGUAGES }
