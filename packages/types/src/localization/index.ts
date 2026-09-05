/**
 * @xivdyetools/types - Localization Module
 *
 * Localization and translation types.
 *
 * @module localization
 */

import type { VisionType } from '../color/colorblind.js';

/**
 * Supported locale codes
 */
export type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

/**
 * Translation keys for UI labels
 */
export type TranslationKey =
  'dye' | 'dark' | 'metallic' | 'pastel' | 'cosmic' | 'cosmicExploration' | 'cosmicFortunes';

/**
 * Harmony type keys for localization
 */
export type HarmonyTypeKey =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'splitComplementary'
  | 'tetradic'
  | 'invertedTetradic'
  | 'square'
  | 'monochromatic'
  | 'compound'
  | 'shades';

/**
 * Ids of the Harmony Explorer's selectable colour wheels. The runtime list,
 * display order and default live in `@xivdyetools/core` (`COLOR_WHEEL_IDS`);
 * the union is here so `LocaleData.colorWheels` can be typed without a
 * types → core dependency. Ids are the wire format (share URLs, the Discord
 * option, the OG query) and never change.
 */
export type ColorWheelId = 'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness';

/**
 * Tool keys for og-worker / web-app display name localization.
 *
 * @deprecated I18N-003 — this covers only the six pre-5.0 tools (the product
 * ships nine) and nothing in the monorepo reads it: web-app names tools from
 * its own `tools.*.title` keys and og-worker from `OG_DECK`. Kept because it is
 * published API; do not build on it. Removal is a core major.
 */
export type ToolKey = 'harmony' | 'gradient' | 'mixer' | 'swatch' | 'comparison' | 'accessibility';

/**
 * Color-sheet category keys (FFXIV character-creator color groups exposed by
 * the Swatch Matcher tool)
 */
export type SheetKey =
  | 'eyeColors'
  | 'highlightColors'
  | 'lipColorsDark'
  | 'lipColorsLight'
  | 'tattooColors'
  | 'facePaintColorsDark'
  | 'facePaintColorsLight'
  | 'hairColors'
  | 'skinColors';

/**
 * FFXIV Playable Race keys for localization
 */
export type RaceKey =
  'hyur' | 'elezen' | 'lalafell' | 'miqote' | 'roegadyn' | 'auRa' | 'hrothgar' | 'viera';

/**
 * FFXIV Clan (Subrace) keys for localization
 * Uses camelCase keys that map to SubRace type values
 */
export type ClanKey =
  | 'midlander'
  | 'highlander'
  | 'wildwood'
  | 'duskwight'
  | 'plainsfolk'
  | 'dunesfolk'
  | 'seekerOfTheSun'
  | 'keeperOfTheMoon'
  | 'seaWolf'
  | 'hellsguard'
  | 'raen'
  | 'xaela'
  | 'helions'
  | 'theLost'
  | 'rava'
  | 'veena';

/**
 * Locale data structure matching generated JSON files
 */
export interface LocaleData {
  /** Locale code */
  locale: LocaleCode;

  /** Metadata about the locale file */
  meta: {
    /** Schema version */
    version: string;
    /** Generation timestamp */
    generated: string;
    /** Number of dyes included */
    dyeCount: number;
  };

  /** UI label translations */
  labels: Record<TranslationKey, string>;

  /** Dye name translations (keyed by dye ID) */
  dyeNames: Record<string, string>;

  /** Category name translations */
  categories: Record<string, string>;

  /** Acquisition method translations */
  acquisitions: Record<string, string>;

  /** Currency display label translations */
  currencies?: Record<string, string>;

  /** Harmony type translations */
  harmonyTypes: Record<HarmonyTypeKey, string>;

  /** Colour-wheel display names for the Harmony Explorer's wheel selector */
  colorWheels?: Partial<Record<ColorWheelId, string>>;

  /** Vision type translations (verbose, for educational UI like the
   *  Accessibility Checker, e.g. "Deuteranopia (Red-Green Colorblindness)") */
  visionTypes: Record<VisionType, string>;

  /** Short vision-name translations (compact, for OG embed titles where the
   *  parenthetical explanation in `visionTypes` is too long) */
  visions?: Record<VisionType, string>;

  /** Tool display-name translations (for og-worker link previews and any
   *  surface that lists available tools by name) */
  tools?: Record<ToolKey, string>;

  /** Color-sheet category translations (Swatch Matcher / og-worker surfaces) */
  sheets?: Record<SheetKey, string>;

  /** Playable race name translations */
  races: Record<RaceKey, string>;

  /** Clan (subrace) name translations */
  clans: Record<ClanKey, string>;

  /**
   * Facewear tint name translations, keyed by the `FacewearColor.id` slug.
   *
   * The 11 Facewear colours are not dyes (schema v2 moved them out of
   * `dyes.json`), so they are keyed by slug rather than itemID and come from
   * `facewear-names.csv` rather than `dyenames.csv`. Optional so a locale file
   * generated before I18N-008 still type-checks.
   */
  facewearColors?: Record<string, string>;
}

/**
 * Locale preference for resolving user's preferred language
 *
 * Resolution order: explicit > guild > system > fallback
 */
export interface LocalePreference {
  /** Explicit user selection (highest priority) */
  explicit?: LocaleCode;

  /** Guild/server preference (Discord only) */
  guild?: string;

  /** User's system language */
  system?: string;

  /** Fallback locale (always 'en') */
  fallback: LocaleCode;
}
