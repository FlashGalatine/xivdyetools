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
  CharacterColorService,
  type Dye,
  type SubRace,
  type Gender,
} from '@xivdyetools/core';

// Shared service instances
export const dyeService = new DyeService(dyeDatabase);
export const characterColorService = new CharacterColorService();

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

  // Search all shared categories first (sync)
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
    const colors = characterColorService.getSharedColors(category);
    const found = colors.find((c) => c.hex.toUpperCase() === normalizedHex);

    if (found) {
      // Character color sheets use 8 columns
      const col = (found.index % 8) + 1;
      const row = Math.floor(found.index / 8) + 1;

      return {
        categoryName: SHARED_CATEGORY_NAMES[category] || category,
        index: found.index,
        row,
        col,
      };
    }
  }

  // Search race-specific categories (hair and skin colors) - async
  for (const subrace of ALL_SUBRACES) {
    for (const gender of GENDERS) {
      // Search hair colors
      const hairColors = await characterColorService.getHairColors(subrace, gender);
      const foundHair = hairColors.find((c) => c.hex.toUpperCase() === normalizedHex);
      if (foundHair) {
        const col = (foundHair.index % 8) + 1;
        const row = Math.floor(foundHair.index / 8) + 1;
        return {
          categoryName: `Hair Colors`,
          index: foundHair.index,
          row,
          col,
        };
      }

      // Search skin colors
      const skinColors = await characterColorService.getSkinColors(subrace, gender);
      const foundSkin = skinColors.find((c) => c.hex.toUpperCase() === normalizedHex);
      if (foundSkin) {
        const col = (foundSkin.index % 8) + 1;
        const row = Math.floor(foundSkin.index / 8) + 1;
        return {
          categoryName: `Skin Colors`,
          index: foundSkin.index,
          row,
          col,
        };
      }
    }
  }

  return null;
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
  } = {}
): DyeMatch[] {
  const { limit = 5, excludeIds = [] } = options;
  const excludeSet = new Set(excludeIds);

  // Get all dyes and filter
  const allDyes = dyeService.getAllDyes();
  const candidates = allDyes.filter((dye) => !excludeSet.has(dye.id));

  // Calculate distances using OKLAB (perceptually uniform)
  const withDistances = candidates.map((dye) => ({
    dye,
    distance: ColorConverter.getDeltaE_Oklab(hex, dye.hex),
  }));

  // Sort by distance and return top matches
  return withDistances.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/**
 * Get a single dye by its itemID
 */
export function getDyeByItemId(itemId: number): Dye | undefined {
  const allDyes = dyeService.getAllDyes();
  return allDyes.find((d) => d.itemID === itemId);
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
