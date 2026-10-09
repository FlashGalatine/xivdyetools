/**
 * Color Input Resolution
 *
 * Centralized hex color validation and normalization.
 * Resolves user input (hex codes, dye names, CSS color names) to
 * normalized hex values and optionally the closest matching FFXIV dye.
 *
 * @module input-resolution
 */

import type { Dye } from '@xivdyetools/types';
import { DyeService, dyeDatabase, foldForSearch } from '@xivdyetools/core';
import { resolveCssColorName } from './css-colors.js';
import { getLocalizedDyeName, type LocaleCode } from './localization.js';

// Initialize DyeService singleton for color resolution
const dyeService = new DyeService(dyeDatabase);

/**
 * Search dyes by name in English AND the given locale (2026-08-20 i18n audit,
 * F-02). `DyeService.searchByName` only knows the English `nameLower`, so a
 * Japanese user typing スノウ got nothing. This matches the English name OR the
 * locale's name (both case-insensitive substring), English hits first in
 * `searchByName` order, then localized-only hits in database order.
 *
 * Relies on the per-locale cache populated by `initializeLocale(locale)`; if
 * the locale has not been loaded yet this degrades to the English search
 * (`getLocalizedDyeName` returns the fallback), never throws.
 */
/**
 * A bare number names a dye by id: 1–254 is a stainID (the value every dye
 * autocomplete sends since 2026-08-29), ≥ 5729 a legacy item id (what 4.x
 * clients and old habits still type). The two ranges are disjoint — the Stain
 * sheet is a byte, item ids start at 5729 — so the number itself picks the
 * lookup; the gap, zero and negatives resolve nothing.
 *
 * How an all-digit input is read (BUG-034, 2026-10-04 audit):
 *
 * | digits | read as                                                     |
 * |--------|-------------------------------------------------------------|
 * | 1–5    | an id — `'101'` is Pure White (stainID), `'13114'` too      |
 * | 6      | a hex colour, never an id — `'000000'`, `'013114'`          |
 * | 7+     | nothing                                                     |
 *
 * Every real id fits in five digits (the highest legacy item id is 48227, the
 * consolidated market items 52254–52256), so six digits can only be a hex
 * colour or a zero-padded id — and `'013114'` silently drawing Pure White
 * instead of #013114 was the worse of those two readings. A 3-digit hex
 * shorthand is the one remaining ambiguity and it stays the id's: a shorthand
 * must carry '#' or a hex letter (`'#101'` is a colour). Anything with letters
 * falls through to the name search.
 */
export function parseDyeIdInput(input: string): Dye | null {
  const m = /^\s*(\d{1,5})\s*$/.exec(input);
  if (!m) return null;
  const n = Number(m[1]);
  if (n >= 1 && n <= 254) return dyeService.getByStainId(n);
  if (n >= 5729) return dyeService.getDyeById(n);
  return null;
}

/** True when the input is a bare number — an id lookup, never a name search. */
function isBareNumber(input: string): boolean {
  return /^\s*\d+\s*$/.test(input);
}

/**
 * True for exactly six bare digits — a full hex colour that happens to contain
 * no letters. BUG-034: it must reach the hex branch ahead of the id lookup
 * (see {@link parseDyeIdInput} for the precedence).
 *
 * Expects TRIMMED input: each resolver below trims once at its top, so padding
 * never changes how digits are read (`' 013114'` is the colour #013114, the
 * same as `'013114'`). Before that, this anchored test met the id rules'
 * whitespace-tolerant ones and a padded six-digit input was neither.
 */
function isAllDigitHex(input: string): boolean {
  return /^\d{6}$/.test(input);
}

export function searchDyesByName(query: string, locale: LocaleCode = 'en'): Dye[] {
  const text = query.trim();
  if (isBareNumber(text)) {
    const byId = parseDyeIdInput(text);
    return byId ? [byId] : [];
  }
  const english = dyeService.searchByName(text);
  if (locale === 'en') return english;
  // I18N-005 (2026-09-19 audit): fold both sides so an accented, ß-bearing or
  // half-width query matches a localized name that carries the same
  // diacritic/width difference (e.g. 'schneeweiss' → 'Schneeweißer').
  const q = foldForSearch(text);
  if (q.length === 0) return english;
  const seen = new Set(english.map((d) => d.id));
  const localized = dyeService
    .getAllDyes()
    .filter(
      (d) => !seen.has(d.id) && foldForSearch(getLocalizedDyeName(d.itemID, d.name, locale)).includes(q),
    );
  return [...english, ...localized];
}

/**
 * Exact-match (case-insensitive) lookup by English or localized name.
 * Returns null when nothing matches exactly — callers that want fuzzy
 * behaviour should use `searchDyesByName`.
 */
export function findDyeByName(name: string, locale: LocaleCode = 'en'): Dye | null {
  const text = name.trim();
  if (isBareNumber(text)) return parseDyeIdInput(text);
  const n = text.toLowerCase();
  if (n.length === 0) return null;
  return (
    dyeService
      .getAllDyes()
      .find(
        (d) =>
          d.name.toLowerCase() === n ||
          (locale !== 'en' && getLocalizedDyeName(d.itemID, d.name, locale).toLowerCase() === n),
      ) ?? null
  );
}

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
  /** Game stain ID if resolved from a dye (5.0 canonical key) */
  stainID?: number | null;
  /** The full Dye object if resolved from a dye */
  dye?: Dye;
}

/**
 * Options for resolving color input.
 * @internal
 */
export interface ResolveColorOptions {
  /** If true, excludes Facewear dyes from name search. Default: true */
  excludeFacewear?: boolean;
  /** If true, finds closest dye when given a hex color. Default: false */
  findClosestForHex?: boolean;
  /**
   * Locale whose dye names should also match the input (F-02). Defaults to
   * English-only matching. Requires `initializeLocale(locale)` to have run.
   */
  locale?: LocaleCode;
}

/**
 * Resolves a color input (hex code or dye name) to a color value
 *
 * Accepts:
 * - Hex codes: #FF0000, FF0000, 000000, #F00, F00
 * - Dye ids: a bare 1–5 digit stainID or legacy item id ("101", "13114")
 * - Dye names: "Snow White", "soot black" (case-insensitive partial match)
 * - CSS named colors: "BlueViolet", "coral", "burlywood" (148 standard colors)
 *
 * Resolution order: six-digit hex → bare 1–5 digit id → hex → dye name →
 * CSS color name. Six bare digits are always a colour (BUG-034); a bare 3-digit
 * number is an id, so a shorthand without '#' must carry a hex letter — see
 * {@link parseDyeIdInput}. Surrounding whitespace is ignored throughout:
 * `' 013114'` and `' #FF0000 '` are colours.
 *
 * @param input - Hex code, dye id or dye name to resolve
 * @param options - Resolution options
 * @returns Resolved color info, or null if not found
 */
export function resolveColorInput(
  input: string,
  options?: ResolveColorOptions
): ResolvedColor | null {
  const excludeFacewear = options?.excludeFacewear ?? true;
  const findClosestForHex = options?.findClosestForHex ?? false;
  const locale = options?.locale ?? 'en';
  // Trimmed once, so every branch below reads the same string (BUG-034).
  const text = input.trim();

  // A bare number is an id (stainID / legacy item id) — checked ahead of hex
  // so `'101'` is Pure White rather than the shorthand for #110011. Six digits
  // skip it: '000000' and '013114' are colours, not ids (BUG-034).
  if (isBareNumber(text) && !isAllDigitHex(text)) {
    const dye = parseDyeIdInput(text);
    if (!dye || (excludeFacewear && dye.category === 'Facewear')) return null;
    return { hex: dye.hex, name: dye.name, id: dye.id, itemID: dye.itemID, stainID: dye.stainID, dye };
  }

  // Check if it's a hex color
  if (isValidHex(text)) {
    const hex = normalizeHex(text);

    if (findClosestForHex) {
      // Find the closest dye to this hex color
      const closest = dyeService.findClosestDye(hex);
      if (closest) {
        return {
          hex,
          name: closest.name,
          id: closest.id,
          itemID: closest.itemID,
          stainID: closest.stainID,
          dye: closest,
        };
      }
    }

    // Just return the hex without dye info
    return { hex };
  }

  // Try to find a dye by name (English + locale)
  const dyes = searchDyesByName(text, locale);

  if (dyes.length > 0) {
    // Filter based on options
    const candidates = excludeFacewear
      ? dyes.filter((d) => d.category !== 'Facewear')
      : dyes;

    // Take the first match (closest name match from searchByName)
    const dye = candidates[0];

    if (dye) {
      return {
        hex: dye.hex,
        name: dye.name,
        id: dye.id,
        itemID: dye.itemID,
      stainID: dye.stainID,
        dye,
      };
    }
  }

  // Try CSS named colors as fallback (e.g., "BlueViolet" → #8A2BE2)
  const cssHex = resolveCssColorName(text);
  if (cssHex) {
    if (findClosestForHex) {
      const closest = dyeService.findClosestDye(cssHex);
      if (closest) {
        return {
          hex: cssHex,
          name: closest.name,
          id: closest.id,
          itemID: closest.itemID,
          stainID: closest.stainID,
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
 * this always returns the full Dye object or null.
 *
 * Surrounding whitespace is ignored, as in resolveColorInput (BUG-034).
 *
 * @param input - Dye name or hex color code
 * @param locale - Locale whose dye names should also match (default: English only)
 * @returns Matching Dye object, or null if not found
 */
export function resolveDyeInput(input: string, locale: LocaleCode = 'en'): Dye | null {
  const text = input.trim();
  // Try finding by name first (English + locale)
  const dyes = searchDyesByName(text, locale);
  if (dyes.length > 0) {
    // Filter out Facewear dyes (synthetic IDs, not tradeable)
    const nonFacewear = dyes.filter((d) => d.category !== 'Facewear');
    // Return first non-Facewear match, or null if all are Facewear
    return nonFacewear[0] ?? null;
  }

  // Try as hex color — find closest dye
  if (isValidHex(text, { allowShorthand: false })) {
    const hex = normalizeHex(text);
    return dyeService.findClosestDye(hex);
  }

  return null;
}

/**
 * Re-export DyeService singleton for commands that need direct access
 */
export { dyeService };
