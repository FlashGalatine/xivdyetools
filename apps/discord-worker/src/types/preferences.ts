/**
 * Unified User Preferences Types (V4)
 *
 * Defines the schema for the unified preferences system introduced in v4.0.0.
 * All user preferences are stored in a single KV key: `prefs:v1:{userId}`
 *
 * @module types/preferences
 */

import type { LocaleCode } from '../services/i18n.js';
import type { DyeTypeFilters } from '@xivdyetools/types';
export type { BlendingMode } from '@xivdyetools/core/blending';
export { BLENDING_MODES, isValidBlendingMode } from '@xivdyetools/core/blending';
import type { BlendingMode } from '@xivdyetools/core/blending';

// 5.0: the matching vocabulary is defined once in core — one list
// suite-wide, dE2000 default. Stored v4 values (hyab, oklch-weighted)
// normalise on read via normalizeMatchingMethod.
export type { MatchingMethod } from '@xivdyetools/core';
import type { MatchingMethod } from '@xivdyetools/core';
import { isMatchingMethod } from '@xivdyetools/core';

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
export const PREFERENCE_DEFAULTS: Required<Omit<UserPreferences, 'clan' | 'gender' | 'world' | 'updatedAt' | '_version'>> = {
  language: 'en',
  blending: 'rgb',
  matching: 'ciede2000',
  count: 5,
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
 */
export const MATCHING_METHODS: Array<{ value: MatchingMethod; name: string; description: string }> = [
  { value: 'ciede2000', name: 'ΔE2000', description: 'Industry-standard perceptual formula (default)' },
  { value: 'oklab', name: 'ΔEOK', description: 'OKLAB perceptual distance' },
  { value: 'cie76', name: 'ΔE76', description: 'CIELAB Euclidean distance' },
  { value: 'redmean', name: 'REDMEAN', description: 'Weighted RGB approximation' },
  { value: 'rgb', name: 'RGB DIST', description: 'Euclidean RGB distance' },
  { value: 'distinguish', name: 'DISTINGUISH %', description: 'RGB DIST rescaled to 0-100' },
];

/**
 * FFXIV clans (sub-races) grouped by race
 */
export const CLANS_BY_RACE: Record<string, string[]> = {
  'Hyur': ['Midlander', 'Highlander'],
  "Miqo'te": ['Seeker of the Sun', 'Keeper of the Moon'],
  'Lalafell': ['Plainsfolk', 'Dunesfolk'],
  'Roegadyn': ['Sea Wolf', 'Hellsguard'],
  'Elezen': ['Wildwood', 'Duskwight'],
  'Au Ra': ['Raen', 'Xaela'],
  'Viera': ['Rava', 'Veena'],
  'Hrothgar': ['Helions', 'The Lost'],
};

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

