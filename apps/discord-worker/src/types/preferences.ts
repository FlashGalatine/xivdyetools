/**
 * Unified User Preferences Types (V4)
 *
 * Defines the schema for the unified preferences system introduced in v4.0.0.
 * All user preferences are stored in a single KV key: `prefs:v1:{userId}`
 *
 * @module types/preferences
 */

import type { LocaleCode } from '../services/i18n.js';
import type { DyeTypeFilters, Race, SubRace } from '@xivdyetools/types';
import { RACE_SUBRACES } from '@xivdyetools/types';
export type { BlendingMode } from '@xivdyetools/core/blending';
export { BLENDING_MODES, isValidBlendingMode } from '@xivdyetools/core/blending';
import type { BlendingMode } from '@xivdyetools/core/blending';

// 5.0: the matching vocabulary is defined once in core — one list
// suite-wide, dE2000 default. Stored v4 values (hyab, oklch-weighted)
// normalise on read via normalizeMatchingMethod.
export type { MatchingMethod } from '@xivdyetools/core';
import type { MatchingMethod } from '@xivdyetools/core';
import {
  isMatchingMethod,
  MATCHING_METHODS as CORE_MATCHING_METHODS,
  MATCHING_METHOD_TAGS,
} from '@xivdyetools/core';

/**
 * Character gender for swatch matching
 */
export type Gender = 'male' | 'female';

/**
 * All preference keys that can be set
 */
export type PreferenceKey =
  | 'language'
  | 'blending'
  | 'matching'
  | 'count'
  | 'clan'
  | 'gender'
  | 'world'
  | 'market'
  | 'showHex'
  | 'showRgb'
  | 'showHsv'
  | 'showLab'
  | 'showDeltaE'
  | 'showAcquisition'
  | 'theme';

/** 5.0 card themes — light cards via /preferences, no first-run prompt. */
export type CardTheme = 'dark' | 'light';

/**
 * User preferences object stored in KV
 *
 * All fields are optional - if not set, system defaults are used.
 * Resolution order: Command parameter → User preference → System default
 */
export interface UserPreferences {
  /** UI language preference */
  language?: LocaleCode;

  /** Default color blending mode for /mixer and /gradient */
  blending?: BlendingMode;

  /** Default color matching method for finding closest dyes */
  matching?: MatchingMethod;

  /** Default number of results to show (1-10) */
  count?: number;

  /** Default clan for /swatch skin and hair lookups */
  clan?: string;

  /** Default gender for /swatch skin and hair lookups */
  gender?: Gender;

  /** Preferred FFXIV world for market data */
  world?: string;

  /** Whether to show Market Board pricing on Result Cards by default */
  market?: boolean;

  /** Show hex color codes on result cards (default: true) */
  showHex?: boolean;

  /** Show RGB values on result cards (default: true) */
  showRgb?: boolean;

  /** Show HSV values on result cards (default: true) */
  showHsv?: boolean;

  /** Show LAB values on result cards (default: true) */
  showLab?: boolean;

  /** Show Delta-E color distance on result cards (default: true) */
  showDeltaE?: boolean;

  /** Show dye acquisition source on result cards (default: true) */
  showAcquisition?: boolean;

  /** Card theme for every generated PNG (default: dark) */
  theme?: CardTheme;

  /** Dye type filters for excluding categories from results */
  dyeFilters?: DyeTypeFilters;

  /** ISO timestamp of last update */
  updatedAt?: string;

  /** Schema version for future migrations */
  _version?: number;
}

/**
 * System default values for each preference
 */
export const PREFERENCE_DEFAULTS: Required<
  Omit<UserPreferences, 'clan' | 'gender' | 'world' | 'updatedAt' | '_version'>
> = {
  language: 'en',
  // Same default as the web app's Mixer (first row of the 5C model order):
  // one product, one answer for "what does blue + yellow make".
  blending: 'ryb',
  matching: 'ciede2000',
  // 1 keeps /extractor color's output unchanged for users who never set this
  // preference (matches the command's own pre-preferences default).
  count: 1,
  market: false,
  showHex: true,
  showRgb: true,
  showHsv: true,
  showLab: true,
  showDeltaE: true,
  showAcquisition: true,
  theme: 'dark',
  dyeFilters: {},
};

/**
 * The 5.0 matching vocabulary with display names (suite tags) for
 * autocomplete and /preferences. Localised descriptions land with the
 * MATCHING_METHODS locale keys in the graphics port; the tags themselves
 * are identifiers and never localise.
 *
 * `name` is READ FROM core's `MATCHING_METHOD_TAGS`, never restated here.
 * It used to be a hand-written copy, and core 5.1.0 caught it out: when
 * `getDeltaE_Oklab` became ΔEOK2 the canonical tag moved and this copy would
 * silently have kept printing `ΔEOK`, so `/preferences` and `/budget` would
 * have disagreed with the cards — which read the map — about what the same
 * number is called. The DEAD-037 test below proves value-order parity with
 * core; deriving the tag closes the other half.
 *
 * The descriptions stay local: they are prose, not identifiers, and core has
 * no equivalent.
 */
const METHOD_DESCRIPTIONS: Record<MatchingMethod, string> = {
  ciede2000: 'Industry-standard perceptual formula (default)',
  oklab: 'OKLAB perceptual distance, a/b scaled x2 (CSS Color 4 §20.4)',
  cie76: 'CIELAB Euclidean distance',
  redmean: 'Weighted RGB approximation',
  rgb: 'Euclidean RGB distance',
  distinguish: 'RGB DIST rescaled to 0-100',
};

export const MATCHING_METHODS: Array<{ value: MatchingMethod; name: string; description: string }> =
  CORE_MATCHING_METHODS.map((value) => ({
    value,
    name: MATCHING_METHOD_TAGS[value],
    description: METHOD_DESCRIPTIONS[value],
  }));

/**
 * Display order + label for each race in the `/preferences` clan table.
 *
 * The race/clan *set* is sourced from the shared `RACE_SUBRACES` game-data
 * table in `@xivdyetools/types` (DEAD-024 adoption) — this array is purely
 * this app's presentation layer (display order and the two labels that
 * differ from their canonical `Race` key by spacing: `"Miqo'te"` and
 * `'Au Ra'`), preserved verbatim from the pre-adoption hand-rolled table so
 * `/preferences clan` output doesn't change.
 */
const RACE_DISPLAY_ORDER: ReadonlyArray<readonly [Race, string]> = [
  ['Hyur', 'Hyur'],
  ["Miqo'te", "Miqo'te"],
  ['Lalafell', 'Lalafell'],
  ['Roegadyn', 'Roegadyn'],
  ['Elezen', 'Elezen'],
  ['AuRa', 'Au Ra'],
  ['Viera', 'Viera'],
  ['Hrothgar', 'Hrothgar'],
];

/**
 * Display label for each subrace — differs from the canonical `SubRace`
 * key by spacing/casing (e.g. `SeekerOfTheSun` → `'Seeker of the Sun'`).
 * Preserved verbatim from the pre-adoption hand-rolled table.
 */
const SUBRACE_DISPLAY_NAMES: Record<SubRace, string> = {
  Midlander: 'Midlander',
  Highlander: 'Highlander',
  Wildwood: 'Wildwood',
  Duskwight: 'Duskwight',
  Plainsfolk: 'Plainsfolk',
  Dunesfolk: 'Dunesfolk',
  SeekerOfTheSun: 'Seeker of the Sun',
  KeeperOfTheMoon: 'Keeper of the Moon',
  SeaWolf: 'Sea Wolf',
  Hellsguard: 'Hellsguard',
  Raen: 'Raen',
  Xaela: 'Xaela',
  Helions: 'Helions',
  TheLost: 'The Lost',
  Rava: 'Rava',
  Veena: 'Veena',
};

/**
 * FFXIV clans (sub-races) grouped by race — derived from the shared
 * `RACE_SUBRACES` table so the race/clan set has one source (DEAD-024).
 */
export const CLANS_BY_RACE: Record<string, string[]> = Object.fromEntries(
  RACE_DISPLAY_ORDER.map(([race, displayName]) => [
    displayName,
    RACE_SUBRACES[race].map((subrace) => SUBRACE_DISPLAY_NAMES[subrace]),
  ]),
);

/**
 * Flat list of all valid clan names (lowercase for comparison)
 */
export const VALID_CLANS: string[] = Object.values(CLANS_BY_RACE).flat();

/**
 * Validate if a string is a valid matching method (5.0 vocabulary).
 */
export function isValidMatchingMethod(method: string): method is MatchingMethod {
  return isMatchingMethod(method);
}

/**
 * Validate if a string is a valid clan name (case-insensitive)
 */
export function isValidClan(clan: string): boolean {
  return VALID_CLANS.some((c) => c.toLowerCase() === clan.toLowerCase());
}

/**
 * Validate if a string is a valid gender
 */
export function isValidGender(gender: string): gender is Gender {
  return gender === 'male' || gender === 'female';
}

/**
 * Validate if a number is a valid result count
 */
export function isValidCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= 10;
}

/**
 * Get the normalized clan name (proper case)
 */
export function normalizeClan(clan: string): string | null {
  const match = VALID_CLANS.find((c) => c.toLowerCase() === clan.toLowerCase());
  return match ?? null;
}
