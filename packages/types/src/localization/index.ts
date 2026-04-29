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
  | 'dye'
  | 'dark'
  | 'metallic'
  | 'pastel'
  | 'cosmic'
  | 'cosmicExploration'
  | 'cosmicFortunes';

/**
 * Harmony type keys for localization
 */
export type HarmonyTypeKey =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'splitComplementary'
  | 'tetradic'
  | 'square'
  | 'monochromatic'
  | 'compound'
  | 'shades';

/**
 * Tool keys for og-worker / web-app display name localization
 */
export type ToolKey =
  | 'harmony'
  | 'gradient'
  | 'mixer'
  | 'swatch'
  | 'comparison'
  | 'accessibility';

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
 * FFXIV Job keys for localization
 */
export type JobKey =
  | 'paladin'
  | 'warrior'
  | 'darkKnight'
  | 'gunbreaker'
  | 'whiteMage'
  | 'scholar'
  | 'astrologian'
  | 'sage'
  | 'monk'
  | 'dragoon'
  | 'ninja'
  | 'samurai'
  | 'reaper'
  | 'viper'
  | 'bard'
  | 'machinist'
  | 'dancer'
  | 'blackMage'
  | 'summoner'
  | 'redMage'
  | 'pictomancer'
  | 'blueMage';

/**
 * FFXIV Grand Company keys for localization
 */
export type GrandCompanyKey = 'maelstrom' | 'twinAdder' | 'immortalFlames';

/**
 * FFXIV Playable Race keys for localization
 */
export type RaceKey =
  | 'hyur'
  | 'elezen'
  | 'lalafell'
  | 'miqote'
  | 'roegadyn'
  | 'auRa'
  | 'hrothgar'
  | 'viera';

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
  | 'helion'
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

  /** IDs of metallic dyes */
  metallicDyeIds: number[];

  /** Harmony type translations */
  harmonyTypes: Record<HarmonyTypeKey, string>;

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

  /** Job name translations */
  jobNames: Record<JobKey, string>;

  /** Grand Company name translations */
  grandCompanyNames: Record<GrandCompanyKey, string>;

  /** Playable race name translations */
  races: Record<RaceKey, string>;

  /** Clan (subrace) name translations */
  clans: Record<ClanKey, string>;
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
