/**
 * Dye Helper Functions for OG Image Generation
 *
 * Provides utilities for finding dye matches with distance values,
 * which the core library's findClosestDye doesn't directly expose.
 */

import { DEFAULT_MATCHING_METHOD, normalizeMatchingMethod } from '@xivdyetools/core';
import { DyeService, dyeDatabase, ColorService } from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import type { MatchingAlgorithm } from '../../types';

// Shared service instance (REFACTOR-024: THE instance -- og-data-generator
// imports from here instead of constructing its own duplicate)
export const dyeService = new DyeService(dyeDatabase);

/**
 * OPT-023: O(1) stainID lookup -- getAllDyes() returns a fresh array copy per
 * call and the comparison route did up to 16 copy+linear-scans per request.
 */
// 5.0 share-URL grammar: dye params carry stainIDs (1-254). Legacy itemIDs
// (>= 5729) are a disjoint range and deliberately miss — the caller renders
// its default/fallback rather than guessing a dye.
const dyeByStainId = new Map<number, Dye>(
  dyeService
    .getAllDyes()
    .filter((d) => d.stainID !== null)
    .map((d) => [d.stainID as number, d]),
);

/**
 * OPT-006 (deep dive 2026-09-02): the ONE dye list for this isolate.
 *
 * `getAllDyes()` returns a fresh 125-element copy per call (the OPT-023 note
 * above), and harmony / gradient / extractor each called it *inside* their
 * per-offset / per-step / per-entry loop — up to five copies per render, on a
 * path that also runs a resvg raster. The dye database is immutable at
 * runtime, so one frozen list serves every reader.
 *
 * Frozen because a shared array is only safe to hand out if nobody can sort
 * or splice it; every consumer here reads, maps, or filters into a new array.
 */
export const ALL_DYES: readonly Dye[] = Object.freeze(dyeService.getAllDyes());

/**
 * BUG-031: compute a color distance with the REQUESTED algorithm, so the
 * "Algorithm: X" footer on OG cards describes what was actually used.
 */
export function deltaForAlgorithm(
  hex1: string,
  hex2: string,
  algorithm: MatchingAlgorithm,
): number {
  // 5.0: one dispatch suite-wide; legacy spellings normalise first
  return ColorService.getDistanceForMethod(hex1, hex2, normalizeMatchingMethod(algorithm));
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
  } = {},
): DyeMatch[] {
  const { limit = 5, excludeIds = [], algorithm = DEFAULT_MATCHING_METHOD } = options;
  const excludeSet = new Set(excludeIds);

  // Get all dyes and filter
  const candidates = ALL_DYES.filter((dye) => !excludeSet.has(dye.id));

  // BUG-031: rank with the requested algorithm, not hardcoded OKLAB
  const withDistances = candidates.map((dye) => ({
    dye,
    distance: deltaForAlgorithm(hex, dye.hex, algorithm),
  }));

  // Sort by distance and return top matches
  return withDistances.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/**
 * Get a single dye by its stainID (5.0 — the canonical dye key). The name
 * predates the stainID port and is kept for call-site stability.
 */
export function getDyeByItemId(id: number): Dye | undefined {
  return dyeByStainId.get(id);
}
