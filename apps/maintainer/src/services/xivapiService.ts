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

  for (const lang of SUPPORTED_LANGUAGES) {
    try {
      // BUG-003 FIX: Use fetchWithTimeout with 10s timeout to prevent hung requests
      const response = await fetchWithTimeout(
        `${XIVAPI_BASE}/sheet/Item?rows=${itemId}&language=${lang}`,
        {},
        10000
      )

      if (!response.ok) {
        result.errors.push(`Failed to fetch ${lang}: HTTP ${response.status}`)
        continue
      }

      const data: XivapiItemResponse = await response.json()

      if (data.rows && data.rows.length > 0) {
        let name = data.rows[0].fields.Name

        // Strip dye prefix if present
        const prefix = dyePrefixes[lang]
        if (prefix && name) {
          name = stripDyePrefix(name, prefix)
        }

        result.names[lang] = name
        result.autoFilled.push(lang)
      } else {
        result.errors.push(`No data found for ${lang}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Failed to fetch ${lang}: ${message}`)
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

  // Handle colon variations (full-width and half-width)
  const prefixWithColon = prefix.endsWith(':') || prefix.endsWith(':')
    ? prefix
    : prefix

  // Check if name starts with prefix
  if (name.startsWith(prefixWithColon)) {
    return name.slice(prefixWithColon.length).trim()
  }

  // Also try with adding colon
  const prefixVariants = [
    prefix,
    `${prefix}:`,
    `${prefix}:`, // full-width colon
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
