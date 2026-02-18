/**
 * @xivdyetools/types - Character Module
 *
 * FFXIV character customization color type definitions.
 * Used for matching character hair, eye, skin, and other colors to dyes.
 *
 * @module character
 */

import type { RGB, HSV } from '../color/rgb.js';
import type { Dye } from '../dye/dye.js';

/**
 * A single character customization color entry
 *
 * Represents one color option available in the character creator,
 * such as a specific hair color or eye color.
 */
export interface CharacterColor {
  /** Index in the color palette (0-191 for most categories, 0-95 for lips) */
  index: number;

  /** Hex color value (#RRGGBB format) */
  hex: string;

  /** RGB color representation */
  rgb: RGB;

  /** HSV color representation (optional for compatibility) */
  hsv?: HSV;
}

/**
 * Result from matching a character color to dyes
 */
export interface CharacterColorMatch {
  /** The character color that was matched */
  characterColor: CharacterColor;

  /** The matching dye */
  dye: Dye;

  /** Color distance (lower = closer match) */
  distance: number;
}

/**
 * Category of shared (race-agnostic) character colors
 */
export type SharedColorCategory =
  | 'eyeColors'
  | 'highlightColors'
  | 'lipColorsDark'
  | 'lipColorsLight'
  | 'tattooColors'
  | 'facePaintColorsDark'
  | 'facePaintColorsLight';

/**
 * Category of race-specific character colors
 */
export type RaceSpecificColorCategory = 'hairColors' | 'skinColors';

/**
 * All character color categories
 */
export type CharacterColorCategory =
  | SharedColorCategory
  | RaceSpecificColorCategory;

/**
 * FFXIV playable subraces
 *
 * Each race has two subraces (clans) with potentially different
 * hair and skin color palettes.
 */
export type SubRace =
  // Hyur
  | 'Midlander'
  | 'Highlander'
  // Elezen
  | 'Wildwood'
  | 'Duskwight'
  // Lalafell
  | 'Plainsfolk'
  | 'Dunesfolk'
  // Miqo'te
  | 'SeekerOfTheSun'
  | 'KeeperOfTheMoon'
  // Roegadyn
  | 'SeaWolf'
  | 'Hellsguard'
  // Au Ra
  | 'Raen'
  | 'Xaela'
  // Hrothgar
  | 'Helion'
  | 'TheLost'
  // Viera
  | 'Rava'
  | 'Veena';

/**
 * Character gender options
 */
export type Gender = 'Male' | 'Female';

/**
 * FFXIV playable races (parent of subraces)
 */
export type Race =
  | 'Hyur'
  | 'Elezen'
  | 'Lalafell'
  | "Miqo'te"
  | 'Roegadyn'
  | 'AuRa'
  | 'Hrothgar'
  | 'Viera';

/**
 * Mapping of races to their subraces
 */
export const RACE_SUBRACES: Record<Race, [SubRace, SubRace]> = {
  Hyur: ['Midlander', 'Highlander'],
  Elezen: ['Wildwood', 'Duskwight'],
  Lalafell: ['Plainsfolk', 'Dunesfolk'],
  "Miqo'te": ['SeekerOfTheSun', 'KeeperOfTheMoon'],
  Roegadyn: ['SeaWolf', 'Hellsguard'],
  AuRa: ['Raen', 'Xaela'],
  Hrothgar: ['Helion', 'TheLost'],
  Viera: ['Rava', 'Veena'],
};

/**
 * Mapping of subraces to their parent race
 */
export const SUBRACE_TO_RACE: Record<SubRace, Race> = {
  Midlander: 'Hyur',
  Highlander: 'Hyur',
  Wildwood: 'Elezen',
  Duskwight: 'Elezen',
  Plainsfolk: 'Lalafell',
  Dunesfolk: 'Lalafell',
  SeekerOfTheSun: "Miqo'te",
  KeeperOfTheMoon: "Miqo'te",
  SeaWolf: 'Roegadyn',
  Hellsguard: 'Roegadyn',
  Raen: 'AuRa',
  Xaela: 'AuRa',
  Helion: 'Hrothgar',
  TheLost: 'Hrothgar',
  Rava: 'Viera',
  Veena: 'Viera',
};

/**
 * Grid dimensions for different color categories
 */
export const COLOR_GRID_DIMENSIONS: Record<
  CharacterColorCategory,
  { columns: 8; rows: 12 | 24 }
> = {
  eyeColors: { columns: 8, rows: 24 },
  highlightColors: { columns: 8, rows: 24 },
  lipColorsDark: { columns: 8, rows: 12 },
  lipColorsLight: { columns: 8, rows: 12 },
  tattooColors: { columns: 8, rows: 24 },
  facePaintColorsDark: { columns: 8, rows: 24 },
  facePaintColorsLight: { columns: 8, rows: 24 },
  hairColors: { columns: 8, rows: 24 },
  skinColors: { columns: 8, rows: 24 },
};
