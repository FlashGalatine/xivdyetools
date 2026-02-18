/**
 * Color Utility Functions
 *
 * DISCORD-REF-001 FIX: Centralized hex color validation and normalization
 * to eliminate duplication across 5+ command handlers.
 *
 * Previously duplicated in:
 * - match.ts (isValidHex, normalizeHex, resolveColorInput)
 * - harmony.ts (isValidHex, normalizeHex, resolveColorInput)
 * - mixer.ts (isValidHex, normalizeHex, resolveColorInput)
 * - accessibility.ts (isValidHex, normalizeHex, resolveDyeInput)
 * - comparison.ts (isValidHex, normalizeHex, resolveColorInput)
 */

import { DyeService, dyeDatabase, type Dye } from '@xivdyetools/core';
import { resolveCssColorName } from './css-colors.js';

// Initialize DyeService singleton for color resolution
const dyeService = new DyeService(dyeDatabase);

/**
 * Validates if a string is a valid hex color
 *
 * @param input - The string to validate
 * @param options - Validation options
 * @param options.allowShorthand - If true, accepts 3-digit shorthand (#FFF). Default: true
 * @returns true if valid hex color
 *
 * @example
 * isValidHex('#FF0000') // true
 * isValidHex('FF0000')  // true (# optional)
 * isValidHex('#F00')    // true (3-digit shorthand)
 * isValidHex('#F00', { allowShorthand: false }) // false
 */
export function isValidHex(input: string, options?: { allowShorthand?: boolean }): boolean {
  const allowShorthand = options?.allowShorthand ?? true;

  // Always accept 6-digit hex (with or without #)
  if (/^#?[0-9A-Fa-f]{6}$/.test(input)) {
    return true;
  }

  // Optionally accept 3-digit shorthand (with or without #)
  if (allowShorthand && /^#?[0-9A-Fa-f]{3}$/.test(input)) {
    return true;
  }

  return false;
}

/**
 * Normalizes a hex color to standard format
 *
 * - Ensures # prefix
 * - Expands 3-digit shorthand to 6-digit (#F00 → #FF0000)
 * - Converts to uppercase for consistency
 *
 * @param hex - The hex color to normalize (assumes already validated)
 * @returns Normalized hex color (#RRGGBB format)
 *
 * @example
 * normalizeHex('FF0000')  // '#FF0000'
 * normalizeHex('#ff0000') // '#FF0000'
 * normalizeHex('F00')     // '#FF0000' (expanded)
 * normalizeHex('#f00')    // '#FF0000' (expanded)
 */
export function normalizeHex(hex: string): string {
  // Remove # if present
  let clean = hex.replace('#', '');

  // Expand 3-digit shorthand to 6-digit
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }

  return `#${clean.toUpperCase()}`;
}

/**
 * Result of resolving a color input
 */
export interface ResolvedColor {
  /** Normalized hex color (#RRGGBB) */
  hex: string;
  /** Dye name if resolved from a dye */
  name?: string;
  /** Internal dye ID if resolved from a dye */
  id?: number;
  /** FFXIV item ID if resolved from a dye */
  itemID?: number | null;
  /** The full Dye object if resolved from a dye */
  dye?: Dye;
}

/**
 * Options for resolving color input
 */
export interface ResolveColorOptions {
  /** If true, excludes Facewear dyes from name search. Default: true */
  excludeFacewear?: boolean;
  /** If true, finds closest dye when given a hex color. Default: false */
  findClosestForHex?: boolean;
}

/**
 * Resolves a color input (hex code or dye name) to a color value
 *
 * Accepts:
 * - Hex codes: #FF0000, FF0000, #F00, F00
 * - Dye names: "Snow White", "soot black" (case-insensitive partial match)
 * - CSS named colors: "BlueViolet", "coral", "burlywood" (148 standard colors)
 *
 * Resolution order: hex → dye name → CSS color name
 *
 * @param input - Hex code or dye name to resolve
 * @param options - Resolution options
 * @returns Resolved color info, or null if not found
 *
 * @example
 * // Hex code input
 * resolveColorInput('#FF0000')
 * // { hex: '#FF0000' }
 *
 * // Dye name input
 * resolveColorInput('Snow White')
 * // { hex: '#FFFFFF', name: 'Snow White Dye', id: 1, itemID: 5729, dye: {...} }
 *
 * // With closest dye for hex
 * resolveColorInput('#FF0000', { findClosestForHex: true })
 * // { hex: '#FF0000', name: 'Dalamud Red Dye', id: 8, itemID: 5736, dye: {...} }
 */
export function resolveColorInput(
  input: string,
  options?: ResolveColorOptions
): ResolvedColor | null {
  const excludeFacewear = options?.excludeFacewear ?? true;
  const findClosestForHex = options?.findClosestForHex ?? false;

  // Check if it's a hex color
  if (isValidHex(input)) {
    const hex = normalizeHex(input);

    if (findClosestForHex) {
      // Find the closest dye to this hex color
      const closest = dyeService.findClosestDye(hex);
      if (closest) {
        return {
          hex,
          name: closest.name,
          id: closest.id,
          itemID: closest.itemID,
          dye: closest,
        };
      }
    }

    // Just return the hex without dye info
    return { hex };
  }

  // Try to find a dye by name
  const dyes = dyeService.searchByName(input);

  if (dyes.length > 0) {
    // Filter based on options
    const candidates = excludeFacewear
      ? dyes.filter((d) => d.category !== 'Facewear')
      : dyes;

    // Take the first match (closest name match from searchByName)
    // Note: Don't fall back to dyes[0] when excludeFacewear is true,
    // as that would defeat the purpose of the Facewear filter
    const dye = candidates[0];

    if (dye) {
      return {
        hex: dye.hex,
        name: dye.name,
        id: dye.id,
        itemID: dye.itemID,
        dye,
      };
    }
  }

  // Try CSS named colors as fallback (e.g., "BlueViolet" → #8A2BE2)
  const cssHex = resolveCssColorName(input);
  if (cssHex) {
    if (findClosestForHex) {
      const closest = dyeService.findClosestDye(cssHex);
      if (closest) {
        return {
          hex: cssHex,
          name: closest.name,
          id: closest.id,
          itemID: closest.itemID,
          dye: closest,
        };
      }
    }
    return { hex: cssHex };
  }

  return null;
}

/**
 * Resolves a dye input (name or hex color) to a Dye object.
 *
 * Unlike resolveColorInput (which returns a ResolvedColor with optional dye),
 * this always returns the full Dye object or null. Used by favorites and
 * collection handlers that need a concrete Dye.
 *
 * REFACTOR-001: Consolidated from duplicate implementations in favorites.ts
 * and collection.ts. Also fixes the Facewear fallback bug where
 * `nonFacewear[0] || dyes[0]` would return a Facewear dye if ALL search
 * results were Facewear — now correctly returns null in that case.
 *
 * @param input - Dye name or hex color code
 * @returns Matching Dye object, or null if not found
 */
export function resolveDyeInput(input: string): Dye | null {
  // Try finding by name first
  const dyes = dyeService.searchByName(input);
  if (dyes.length > 0) {
    // Filter out Facewear dyes (synthetic IDs, not tradeable)
    const nonFacewear = dyes.filter((d) => d.category !== 'Facewear');
    // Return first non-Facewear match, or null if all are Facewear
    return nonFacewear[0] ?? null;
  }

  // Try as hex color — find closest dye
  if (isValidHex(input, { allowShorthand: false })) {
    const hex = normalizeHex(input);
    return dyeService.findClosestDye(hex);
  }

  return null;
}

/**
 * Re-export DyeService for commands that need direct access
 * (avoids duplicate imports and ensures singleton usage)
 */
export { dyeService };
