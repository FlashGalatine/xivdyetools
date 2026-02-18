/**
 * Unified User Preferences Types (V4)
 *
 * Defines the schema for the unified preferences system introduced in v4.0.0.
 * All user preferences are stored in a single KV key: `prefs:v1:{userId}`
 *
 * @module types/preferences
 */

import type { LocaleCode } from '../services/i18n.js';

/**
 * Color blending modes for /mixer and /gradient commands
 *
 * @see https://xivdyetools.com/docs/blending-modes
 */
export type BlendingMode = 'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral';

/**
 * Color matching methods for finding closest dyes
 *
 * @see https://xivdyetools.com/docs/matching-methods
 */
export type MatchingMethod = 'rgb' | 'cie76' | 'ciede2000' | 'oklab' | 'hyab' | 'oklch-weighted';

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
  | 'market';

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
  matching: 'oklab',
  count: 5,
  market: false,
};

/**
 * Valid blending modes with descriptions (for autocomplete)
 */
export const BLENDING_MODES: Array<{ value: BlendingMode; name: string; description: string }> = [
  { value: 'rgb', name: 'RGB', description: 'Additive channel averaging (default)' },
  { value: 'lab', name: 'LAB', description: 'Perceptually uniform CIELAB blending' },
  { value: 'oklab', name: 'OKLAB', description: 'Modern perceptual (fixes LAB blue→purple)' },
  { value: 'ryb', name: 'RYB', description: "Traditional artist's color wheel" },
  { value: 'hsl', name: 'HSL', description: 'Hue-Saturation-Lightness interpolation' },
  { value: 'spectral', name: 'Spectral', description: 'Kubelka-Munk physics simulation' },
];

/**
 * Valid matching methods with descriptions (for autocomplete)
 */
export const MATCHING_METHODS: Array<{ value: MatchingMethod; name: string; description: string }> = [
  { value: 'rgb', name: 'RGB', description: 'Euclidean RGB distance' },
  { value: 'cie76', name: 'CIE76', description: 'CIELAB Euclidean distance' },
  { value: 'ciede2000', name: 'CIEDE2000', description: 'Industry standard perceptual formula' },
  { value: 'oklab', name: 'OKLAB', description: 'Modern perceptual distance (default)' },
  { value: 'hyab', name: 'HyAB', description: 'Hybrid distance for large differences' },
  { value: 'oklch-weighted', name: 'OKLCH Weighted', description: 'Weighted L/C/H priorities' },
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
 * Validate if a string is a valid blending mode
 */
export function isValidBlendingMode(mode: string): mode is BlendingMode {
  return BLENDING_MODES.some((m) => m.value === mode);
}

/**
 * Validate if a string is a valid matching method
 */
export function isValidMatchingMethod(method: string): method is MatchingMethod {
  return MATCHING_METHODS.some((m) => m.value === method);
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

/**
 * Get the race for a given clan
 */
export function getRaceForClan(clan: string): string | null {
  for (const [race, clans] of Object.entries(CLANS_BY_RACE)) {
    if (clans.some((c) => c.toLowerCase() === clan.toLowerCase())) {
      return race;
    }
  }
  return null;
}
