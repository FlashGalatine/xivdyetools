/**
 * Dye Helper Functions for OG Image Generation
 *
 * Provides utilities for finding dye matches with distance values,
 * which the core library's findClosestDye doesn't directly expose.
 */

import {
  DyeService,
  dyeDatabase,
  ColorConverter,
  ColorService,
  CharacterColorService,
} from '@xivdyetools/core';
import type { Dye, SubRace, Gender } from '@xivdyetools/types';
import type { MatchingAlgorithm } from '../../types';

// Shared service instances (REFACTOR-024: THE instances -- og-data-generator
// imports dyeService from here instead of constructing its own duplicate)
export const dyeService = new DyeService(dyeDatabase);
export const characterColorService = new CharacterColorService();

/**
 * OPT-023: O(1) itemID lookup -- getAllDyes() returns a fresh array copy per
 * call and the comparison route did up to 16 copy+linear-scans per request.
 */
const dyeByItemId = new Map<number, Dye>(
  dyeService.getAllDyes().map((d) => [d.itemID, d])
);

/**
 * BUG-031: compute a color distance with the REQUESTED algorithm, so the
 * "Algorithm: X" footer on OG cards describes what was actually used.
 */
export function deltaForAlgorithm(
  hex1: string,
  hex2: string,
  algorithm: MatchingAlgorithm
): number {
  switch (algorithm) {
    case 'ciede2000':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie2000');
    case 'euclidean':
      return ColorService.getColorDistance(hex1, hex2);
    case 'oklab':
    default:
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
  }
}

/**
 * Result of looking up a character color by hex
 */
export interface CharacterColorLookup {
  /** Display name of the category (e.g., "Eye Colors") */
  categoryName: string;
  /** The index within the category (0-based) */
  index: number;
  /** Row in the character creator grid (1-based) */
  row: number;
  /** Column in the character creator grid (1-based) */
  col: number;
}

/**
 * Category display names mapping
 */
const SHARED_CATEGORY_NAMES: Record<string, string> = {
  eyeColors: 'Eye Colors',
  highlightColors: 'Highlights',
  lipColorsDark: 'Lip Colors (Dark)',
  lipColorsLight: 'Lip Colors (Light)',
  tattooColors: 'Tattoo/Limbal',
  facePaintColorsDark: 'Face Paint (Dark)',
  facePaintColorsLight: 'Face Paint (Light)',
};

/**
 * All subraces for searching race-specific colors
 */
const ALL_SUBRACES: SubRace[] = [
  'Midlander', 'Highlander', // Hyur
  'Wildwood', 'Duskwight', // Elezen
  'Plainsfolk', 'Dunesfolk', // Lalafell
  'SeekerOfTheSun', 'KeeperOfTheMoon', // Miqo'te
  'SeaWolf', 'Hellsguard', // Roegadyn
  'Raen', 'Xaela', // Au Ra
  'Rava', 'Veena', // Viera
  'Helion', 'TheLost', // Hrothgar
];

const GENDERS: Gender[] = ['Male', 'Female'];

/**
 * Find a character color by its hex value.
 * Searches all shared AND race-specific color categories for a match.
 *
 * @param hex - The hex color to look up (with or without #)
 * @returns The category and position info, or null if not found
 */
export async function findCharacterColorByHex(hex: string): Promise<CharacterColorLookup | null> {
  // Normalize hex to uppercase with #
  const normalizedHex = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
  return (await getHexIndex()).get(normalizedHex) ?? null;
}

/**
 * OPT-005: lazily built reverse index (hex -> lookup), replacing a per-request
 * scan of 7 shared categories + 64 sequential awaited race/gender sheets
 * (~12k string comparisons on every swatch OG without ?sheet=, paid in FULL
 * on the common miss case). Insertion order mirrors the old scan precedence
 * (shared categories, then hair before skin per subrace/gender) and entries
 * are only set when absent, so first-match semantics are preserved.
 */
let hexIndexPromise: Promise<Map<string, CharacterColorLookup>> | null = null;

function getHexIndex(): Promise<Map<string, CharacterColorLookup>> {
  hexIndexPromise ??= buildHexIndex();
  return hexIndexPromise;
}

async function buildHexIndex(): Promise<Map<string, CharacterColorLookup>> {
  const idx = new Map<string, CharacterColorLookup>();
  const put = (hexValue: string, categoryName: string, index: number): void => {
    const key = hexValue.toUpperCase();
    if (!idx.has(key)) {
      // Character color sheets use 8 columns
      idx.set(key, {
        categoryName,
        index,
        row: Math.floor(index / 8) + 1,
        col: (index % 8) + 1,
      });
    }
  };

  const sharedCategories = [
    'eyeColors',
    'highlightColors',
    'lipColorsDark',
    'lipColorsLight',
    'tattooColors',
    'facePaintColorsDark',
    'facePaintColorsLight',
  ] as const;

  for (const category of sharedCategories) {
    for (const c of characterColorService.getSharedColors(category)) {
      put(c.hex, SHARED_CATEGORY_NAMES[category] || category, c.index);
    }
  }

  for (const subrace of ALL_SUBRACES) {
    for (const gender of GENDERS) {
      for (const c of await characterColorService.getHairColors(subrace, gender)) {
        put(c.hex, 'Hair Colors', c.index);
      }
      for (const c of await characterColorService.getSkinColors(subrace, gender)) {
        put(c.hex, 'Skin Colors', c.index);
      }
    }
  }

  return idx;
}

/**
 * Result of a dye match with its distance
 */
export interface DyeMatch {
  dye: Dye;
  distance: number;
}

/**
 * Find multiple closest dyes to a given hex color, with their distances.
 *
 * This fills a gap in the core library where findClosestDye only returns
 * a single dye without the distance value.
 *
 * @param hex - Target color in hex format
 * @param options - Search options
 * @returns Array of dye matches sorted by distance (closest first)
 */
export function findClosestDyesWithDistance(
  hex: string,
  options: {
    limit?: number;
    excludeIds?: number[];
    /** BUG-031: distance metric to match with (default OKLAB) */
    algorithm?: MatchingAlgorithm;
  } = {}
): DyeMatch[] {
  const { limit = 5, excludeIds = [], algorithm = 'oklab' } = options;
  const excludeSet = new Set(excludeIds);

  // Get all dyes and filter
  const allDyes = dyeService.getAllDyes();
  const candidates = allDyes.filter((dye) => !excludeSet.has(dye.id));

  // BUG-031: rank with the requested algorithm, not hardcoded OKLAB
  const withDistances = candidates.map((dye) => ({
    dye,
    distance: deltaForAlgorithm(hex, dye.hex, algorithm),
  }));

  // Sort by distance and return top matches
  return withDistances.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/**
 * Get a single dye by its itemID
 */
export function getDyeByItemId(itemId: number): Dye | undefined {
  // OPT-023: precomputed map instead of a fresh array copy + linear scan
  return dyeByItemId.get(itemId);
}

/**
 * Extended character color lookup result with full context
 */
export interface CharacterColorContext extends CharacterColorLookup {
  /** Full display name including race/gender if applicable */
  fullName: string;
  /** Whether this is a race-specific color sheet */
  isRaceSpecific: boolean;
  /** The subrace if race-specific */
  subrace?: string;
  /** The gender if race-specific */
  gender?: 'Male' | 'Female';
}

/**
 * Get character color info from explicit sheet/race/gender parameters.
 * This is more accurate than searching by hex since it uses the exact context.
 *
 * @param hex - The hex color (with or without #)
 * @param sheet - The color sheet category
 * @param subrace - Subrace for race-specific sheets
 * @param gender - Gender for race-specific sheets
 * @returns Character color context or null if not found
 */
export async function getCharacterColorFromSheet(
  hex: string,
  sheet: string,
  subrace?: string,
  gender?: Gender
): Promise<CharacterColorContext | null> {
  const normalizedHex = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;

  // Race-specific sheets require subrace and gender
  const isRaceSpecific = sheet === 'hairColors' || sheet === 'skinColors';

  if (isRaceSpecific) {
    if (!subrace || !gender) {
      // Fall back to hex search if race/gender not provided
      const fallback = await findCharacterColorByHex(normalizedHex);
      if (fallback) {
        return {
          ...fallback,
          fullName: fallback.categoryName,
          isRaceSpecific: true,
          subrace: undefined,
          gender: undefined,
        };
      }
      return null;
    }

    // Get colors from the specific race/gender combination
    const colors =
      sheet === 'hairColors'
        ? await characterColorService.getHairColors(subrace as SubRace, gender)
        : await characterColorService.getSkinColors(subrace as SubRace, gender);

    const found = colors.find((c) => c.hex.toUpperCase() === normalizedHex);
    if (found) {
      const col = (found.index % 8) + 1;
      const row = Math.floor(found.index / 8) + 1;

      // Format display name like "Female Wildwood Hair Colors"
      const sheetDisplayName = sheet === 'hairColors' ? 'Hair Colors' : 'Skin Colors';
      const fullName = `${gender} ${formatSubraceName(subrace)} ${sheetDisplayName}`;

      return {
        categoryName: sheetDisplayName,
        fullName,
        index: found.index,
        row,
        col,
        isRaceSpecific: true,
        subrace,
        gender,
      };
    }
    return null;
  }

  // Shared color sheets (sync)
  const sharedCategory = sheet as
    | 'eyeColors'
    | 'highlightColors'
    | 'lipColorsDark'
    | 'lipColorsLight'
    | 'tattooColors'
    | 'facePaintColorsDark'
    | 'facePaintColorsLight';

  const colors = characterColorService.getSharedColors(sharedCategory);
  const found = colors.find((c) => c.hex.toUpperCase() === normalizedHex);

  if (found) {
    const col = (found.index % 8) + 1;
    const row = Math.floor(found.index / 8) + 1;
    const categoryName = SHARED_CATEGORY_NAMES[sheet] || sheet;

    return {
      categoryName,
      fullName: categoryName,
      index: found.index,
      row,
      col,
      isRaceSpecific: false,
    };
  }

  return null;
}

/**
 * Format subrace name for display (add spaces to camelCase)
 */
function formatSubraceName(subrace: string): string {
  // Handle special cases
  const specialCases: Record<string, string> = {
    SeekerOfTheSun: "Seeker of the Sun",
    KeeperOfTheMoon: "Keeper of the Moon",
    SeaWolf: "Sea Wolf",
    TheLost: "The Lost",
  };

  if (specialCases[subrace]) {
    return specialCases[subrace];
  }

  // Simple names like "Midlander", "Wildwood" stay as-is
  return subrace;
}
