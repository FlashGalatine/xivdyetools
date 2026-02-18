/**
 * Constants for the Dye Maintainer app
 */

export const CATEGORIES = [
  'Neutral',
  'Reds',
  'Browns',
  'Yellows',
  'Greens',
  'Blues',
  'Purples',
  'Special',
  'Facewear',
] as const

export type Category = (typeof CATEGORIES)[number]

export const ACQUISITIONS = [
  'Dye Vendor',
  'Ixali Vendor',
  'Crafting',
  'Achievement',
  'Retainer Venture',
  'Cosmic Exploration',
  'Cosmic Fortunes',
  'Event',
  'Mogstation',
  'Unknown',
] as const

export type Acquisition = (typeof ACQUISITIONS)[number]

export const CURRENCIES = ['Gil', 'Cosmocredits'] as const

export type Currency = (typeof CURRENCIES)[number]

export const LOCALES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
] as const

/**
 * All supported locale codes (derived from LOCALES)
 * MAINT-REF-003 FIX: Single source of truth for locale validation
 */
export const LOCALE_CODES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const

/**
 * Type for locale codes (can be used for validation and type safety)
 */
export type LocaleCode = (typeof LOCALE_CODES)[number]

/**
 * Locales supported by XIVAPI (subset of all locales)
 */
export const XIVAPI_SUPPORTED_LOCALES = ['en', 'ja', 'de', 'fr'] as const

/**
 * Default form values
 */
export const DEFAULT_FORM_STATE = {
  itemID: null,
  category: 'Neutral',
  name: '',
  hex: '#',
  acquisition: 'Dye Vendor',
  price: null,
  currency: 'Gil',
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,
  locales: {
    en: '',
    ja: '',
    de: '',
    fr: '',
    ko: '',
    zh: '',
  },
} as const

/**
 * Acquisitions that typically have a price
 */
export const PRICED_ACQUISITIONS = [
  'Dye Vendor',
  'Ixali Vendor',
  'Mogstation',
]

/**
 * Acquisitions that use Cosmocredits
 */
export const COSMOCREDIT_ACQUISITIONS = [
  'Cosmic Exploration',
  'Cosmic Fortunes',
]
