/**
 * Input validation and ID resolution utilities.
 *
 * The dye ID resolution is the most critical piece: FFXIV dyes have three
 * identifier types with disjoint numeric ranges, so we auto-detect the type.
 */

import type { Dye } from '@xivdyetools/types';
import type { MatchingMethod } from '@xivdyetools/core';
import {
  EXPENSIVE_DYE_IDS,
  VENDOR_ACQUISITIONS,
  CRAFT_ACQUISITIONS,
  ALLIED_SOCIETY_ACQUISITIONS,
} from '@xivdyetools/core';
import { ApiError, ErrorCode } from './api-error.js';
import { dyeService } from './services.js';

// ============================================================================
// Constants
// ============================================================================

export const VALID_LOCALES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;
export type ValidLocale = (typeof VALID_LOCALES)[number];

export const VALID_MATCHING_METHODS: MatchingMethod[] = [
  'rgb', 'cie76', 'ciede2000', 'oklab', 'hyab', 'oklch-weighted',
];

export const VALID_SORT_FIELDS = ['name', 'brightness', 'saturation', 'hue', 'cost'] as const;
export type ValidSortField = (typeof VALID_SORT_FIELDS)[number];

export const VALID_ORDERS = ['asc', 'desc'] as const;

export const VALID_CONSOLIDATION_TYPES = ['A', 'B', 'C'] as const;

// ============================================================================
// Dye ID Resolution
// ============================================================================

export type IdResolution =
  | { type: 'facewear'; id: number }
  | { type: 'stain'; stainId: number }
  | { type: 'item'; itemId: number }
  | { type: 'invalid'; id: number };

/**
 * Auto-detect dye identifier type by numeric range.
 * Ranges are fully disjoint — no overlap between facewear, stainID, and itemID.
 */
export function resolveIdType(id: number): IdResolution {
  if (id < 0) return { type: 'facewear', id };
  if (id >= 1 && id <= 125) return { type: 'stain', stainId: id };
  if (id >= 5729) return { type: 'item', itemId: id };
  return { type: 'invalid', id };
}

/**
 * Look up a dye using a resolved ID. Dispatches to the appropriate
 * DyeService method based on the ID type.
 */
export function lookupDyeByResolvedId(resolution: IdResolution): Dye | null {
  switch (resolution.type) {
    case 'facewear':
      return dyeService.getDyeById(resolution.id);
    case 'item':
      return dyeService.getDyeById(resolution.itemId);
    case 'stain':
      return dyeService.getByStainId(resolution.stainId);
    case 'invalid':
      return null;
  }
}

/**
 * Resolve a list of mixed IDs (itemID/stainID/facewear) to internal dye.id values.
 * Used for excludeIds where filterDyes() expects internal IDs.
 * Invalid or unknown IDs are silently skipped.
 */
export function resolveExcludeIds(idsString: string): number[] {
  const rawIds = parseCommaSeparatedIds(idsString, 'excludeIds', 50);
  const resolvedIds: number[] = [];

  for (const rawId of rawIds) {
    const dye = lookupDyeByResolvedId(resolveIdType(rawId));
    if (dye) {
      resolvedIds.push(dye.id);
    }
  }

  return resolvedIds;
}

// ============================================================================
// Parameter Parsing
// ============================================================================

const HEX_PATTERN = /^#?[0-9A-Fa-f]{6}$/;

/** Validate and normalize hex color. Auto-prepends # and uppercases. */
export function parseHex(value: string | undefined, paramName = 'hex'): string {
  if (!value) {
    throw new ApiError(ErrorCode.MISSING_PARAMETER, `Missing required parameter: ${paramName}`, 400, {
      parameter: paramName,
      required: true,
    });
  }

  if (!HEX_PATTERN.test(value)) {
    throw new ApiError(ErrorCode.INVALID_HEX, 'Invalid hex color format. Expected #RRGGBB or RRGGBB.', 400, {
      parameter: paramName,
      received: value,
      expected: 'Hex color string matching /^#?[0-9A-Fa-f]{6}$/',
    });
  }

  const normalized = value.startsWith('#') ? value.toUpperCase() : `#${value.toUpperCase()}`;
  return normalized;
}

/** Parse an integer query param with optional min/max/default. */
export function parseIntParam(
  value: string | undefined,
  name: string,
  options: { min?: number; max?: number; defaultValue?: number } = {},
): number {
  if (value === undefined || value === '') {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw new ApiError(ErrorCode.MISSING_PARAMETER, `Missing required parameter: ${name}`, 400, {
      parameter: name,
      required: true,
    });
  }

  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Parameter "${name}" must be an integer.`, 400, {
      parameter: name,
      received: value,
      expected: 'integer',
    });
  }

  if (options.min !== undefined && num < options.min) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Parameter "${name}" must be >= ${options.min}.`, 400, {
      parameter: name,
      received: num,
      expected: `>= ${options.min}`,
    });
  }

  if (options.max !== undefined && num > options.max) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Parameter "${name}" must be <= ${options.max}.`, 400, {
      parameter: name,
      received: num,
      expected: `<= ${options.max}`,
    });
  }

  return num;
}

/** Parse a float query param with optional min/max/default. */
export function parseFloatParam(
  value: string | undefined,
  name: string,
  options: { min?: number; max?: number; defaultValue?: number } = {},
): number {
  if (value === undefined || value === '') {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw new ApiError(ErrorCode.MISSING_PARAMETER, `Missing required parameter: ${name}`, 400, {
      parameter: name,
      required: true,
    });
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Parameter "${name}" must be a number.`, 400, {
      parameter: name,
      received: value,
      expected: 'number',
    });
  }

  if (options.min !== undefined && num < options.min) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Parameter "${name}" must be >= ${options.min}.`, 400, {
      parameter: name,
      received: num,
      expected: `>= ${options.min}`,
    });
  }

  if (options.max !== undefined && num > options.max) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Parameter "${name}" must be <= ${options.max}.`, 400, {
      parameter: name,
      received: num,
      expected: `<= ${options.max}`,
    });
  }

  return num;
}

/** Parse an enum query param. Returns the value if valid, or throws. */
export function parseEnumParam<T extends string>(
  value: string | undefined,
  name: string,
  validValues: readonly T[],
  defaultValue?: T,
): T {
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new ApiError(ErrorCode.MISSING_PARAMETER, `Missing required parameter: ${name}`, 400, {
      parameter: name,
      required: true,
    });
  }

  if (!validValues.includes(value as T)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Invalid value for "${name}". Must be one of: ${validValues.join(', ')}`, 400, {
      parameter: name,
      received: value,
      expected: validValues,
    });
  }

  return value as T;
}

/** Parse a boolean query param. Accepts true/false/1/0. */
export function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

/** Parse a comma-separated list of integers. */
export function parseCommaSeparatedIds(
  value: string | undefined,
  name: string,
  maxItems: number,
): number[] {
  if (!value) {
    throw new ApiError(ErrorCode.MISSING_PARAMETER, `Missing required parameter: ${name}`, 400, {
      parameter: name,
      required: true,
    });
  }

  const parts = value.split(',').map((s) => s.trim()).filter(Boolean);

  if (parts.length > maxItems) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Parameter "${name}" exceeds maximum of ${maxItems} items.`, 400, {
      parameter: name,
      received: parts.length,
      expected: `<= ${maxItems} items`,
    });
  }

  const ids: number[] = [];
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num)) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, `Invalid ID "${part}" in "${name}". All values must be integers.`, 400, {
        parameter: name,
        received: part,
        expected: 'integer',
      });
    }
    ids.push(num);
  }

  return ids;
}

/** Parse the locale param, defaulting to 'en'. */
export function parseLocale(value: string | undefined): ValidLocale {
  if (!value || value === '') return 'en';
  if (!VALID_LOCALES.includes(value as ValidLocale)) {
    throw new ApiError(ErrorCode.INVALID_LOCALE, `Unsupported locale "${value}". Supported: ${VALID_LOCALES.join(', ')}`, 400, {
      parameter: 'locale',
      received: value,
      expected: VALID_LOCALES,
    });
  }
  return value as ValidLocale;
}

/** Parse the matching method param, defaulting to 'oklab'. */
export function parseMatchingMethod(value: string | undefined): MatchingMethod {
  if (!value || value === '') return 'oklab';
  if (!VALID_MATCHING_METHODS.includes(value as MatchingMethod)) {
    throw new ApiError(ErrorCode.INVALID_MATCHING_METHOD, `Invalid matching method "${value}". Must be one of: ${VALID_MATCHING_METHODS.join(', ')}`, 400, {
      parameter: 'method',
      received: value,
      expected: VALID_MATCHING_METHODS,
    });
  }
  return value as MatchingMethod;
}

// ============================================================================
// Dye Query Filters
// ============================================================================

export interface DyeQueryFilters {
  metallic?: boolean;
  pastel?: boolean;
  dark?: boolean;
  cosmic?: boolean;
  ishgardian?: boolean;
  vendor?: boolean;
  craft?: boolean;
  alliedSociety?: boolean;
  expensive?: boolean;
}

/** Parse all dye boolean filter query params from a request. */
export function parseDyeFilters(query: (name: string) => string | undefined): DyeQueryFilters {
  return {
    metallic: parseBooleanParam(query('metallic')),
    pastel: parseBooleanParam(query('pastel')),
    dark: parseBooleanParam(query('dark')),
    cosmic: parseBooleanParam(query('cosmic')),
    ishgardian: parseBooleanParam(query('ishgardian')),
    vendor: parseBooleanParam(query('vendor')),
    craft: parseBooleanParam(query('craft')),
    alliedSociety: parseBooleanParam(query('alliedSociety')),
    expensive: parseBooleanParam(query('expensive')),
  };
}

/** Check if any dye filter is active. */
export function hasActiveDyeFilters(f: DyeQueryFilters): boolean {
  return Object.values(f).some((v) => v !== undefined);
}

/** Test if a single dye matches all active filters. */
function dyeMatchesFilters(dye: Dye, f: DyeQueryFilters): boolean {
  if (f.metallic !== undefined && dye.isMetallic !== f.metallic) return false;
  if (f.pastel !== undefined && dye.isPastel !== f.pastel) return false;
  if (f.dark !== undefined && dye.isDark !== f.dark) return false;
  if (f.cosmic !== undefined && dye.isCosmic !== f.cosmic) return false;
  if (f.ishgardian !== undefined && dye.isIshgardian !== f.ishgardian) return false;
  if (f.vendor !== undefined) {
    const isVendor = VENDOR_ACQUISITIONS.includes(dye.acquisition);
    if (isVendor !== f.vendor) return false;
  }
  if (f.craft !== undefined) {
    const isCraft = CRAFT_ACQUISITIONS.includes(dye.acquisition);
    if (isCraft !== f.craft) return false;
  }
  if (f.alliedSociety !== undefined) {
    const isAllied = ALLIED_SOCIETY_ACQUISITIONS.includes(dye.acquisition);
    if (isAllied !== f.alliedSociety) return false;
  }
  if (f.expensive !== undefined) {
    const isExpensive = EXPENSIVE_DYE_IDS.includes(dye.itemID);
    if (isExpensive !== f.expensive) return false;
  }
  return true;
}

/** Filter a dye array by query filters (in-memory). */
export function applyDyeFilters(dyes: Dye[], filters: DyeQueryFilters): Dye[] {
  if (!hasActiveDyeFilters(filters)) return dyes;
  return dyes.filter((d) => dyeMatchesFilters(d, filters));
}

/**
 * Build a list of internal dye IDs that should be excluded based on query filters.
 * Used for match routes where excludeIds must be passed to core search functions.
 */
export function buildFilterExcludeIds(filters: DyeQueryFilters): number[] {
  if (!hasActiveDyeFilters(filters)) return [];
  const allDyes = dyeService.getAllDyes();
  return allDyes.filter((d) => !dyeMatchesFilters(d, filters)).map((d) => d.id);
}
