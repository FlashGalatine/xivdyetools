/**
 * Dye Search
 * Per R-4: Focused class for dye search and matching operations
 * Handles finding dyes by name, category, color distance, etc.
 */

import type { Dye, MatchingMethod, OklchWeights } from '../../types/index.js';
import { ColorConverter } from '../color/ColorConverter.js';
import type { Point3D } from '../../utils/kd-tree.js';
import type { DyeDatabase } from './DyeDatabase.js';

/**
 * Options for finding closest dye matches.
 */
export interface FindClosestOptions {
  /** Dye IDs to exclude from results */
  excludeIds?: number[];
  /** Color matching algorithm (default: 'oklab') */
  matchingMethod?: MatchingMethod;
  /** Custom weights for oklch-weighted method */
  weights?: OklchWeights;
}

/**
 * Options for finding dyes within a distance threshold.
 */
export interface FindWithinDistanceOptions {
  /** Maximum distance threshold */
  maxDistance: number;
  /** Maximum number of results to return */
  limit?: number;
  /** Color matching algorithm (default: 'rgb' for backwards compatibility) */
  matchingMethod?: MatchingMethod;
  /** Custom weights for oklch-weighted method */
  weights?: OklchWeights;
}

/**
 * Dye search and matching utilities
 * Per R-4: Single Responsibility - search operations only
 */
export class DyeSearch {
  private readonly logger;

  constructor(private database: DyeDatabase) {
    this.logger = database.getLogger();
  }

  /**
   * Calculate color distance using the specified matching method.
   * Per COLOR-MATCH-001: Supports multiple perceptual algorithms.
   *
   * @param hex1 - First color in hex format
   * @param hex2 - Second color in hex format
   * @param method - Matching algorithm to use
   * @param weights - Custom weights for oklch-weighted method
   * @returns Distance value (lower = more similar)
   */
  private calculateDistance(
    hex1: string,
    hex2: string,
    method: MatchingMethod,
    weights?: OklchWeights
  ): number {
    switch (method) {
      case 'rgb':
        return ColorConverter.getColorDistance(hex1, hex2);
      case 'cie76':
        return ColorConverter.getDeltaE(hex1, hex2, 'cie76');
      case 'ciede2000':
        return ColorConverter.getDeltaE(hex1, hex2, 'cie2000');
      case 'oklab':
        return ColorConverter.getDeltaE_Oklab(hex1, hex2);
      case 'hyab':
        return ColorConverter.getDeltaE_HyAB(hex1, hex2);
      case 'oklch-weighted':
        return ColorConverter.getDeltaE_OklchWeighted(hex1, hex2, weights);
      default:
        // Default to OKLAB for unknown methods
        return ColorConverter.getDeltaE_Oklab(hex1, hex2);
    }
  }

  /**
   * Search dyes by name (case-insensitive, partial match)
   * Per MEM-001: Uses pre-computed nameLower to avoid repeated toLowerCase() calls
   */
  searchByName(query: string): Dye[] {
    this.database.ensureLoaded();
    const lowerQuery = query.toLowerCase().trim();

    if (lowerQuery.length === 0) {
      return [];
    }

    const dyes = this.database.getDyesInternal();
    // MEM-001: Use pre-computed nameLower instead of dye.name.toLowerCase()
    return dyes.filter((dye) => dye.nameLower.includes(lowerQuery));
  }

  /**
   * Search dyes by category
   * Per MEM-001: Uses pre-computed categoryLower to avoid repeated toLowerCase() calls
   */
  searchByCategory(category: string): Dye[] {
    this.database.ensureLoaded();
    const lowerCategory = category.toLowerCase();

    const dyes = this.database.getDyesInternal();
    // MEM-001: Use pre-computed categoryLower instead of dye.category.toLowerCase()
    return dyes.filter((dye) => dye.categoryLower === lowerCategory);
  }

  /**
   * Filter dyes with optional exclusion list
   */
  filterDyes(
    filter: {
      category?: string;
      excludeIds?: number[];
      minPrice?: number;
      maxPrice?: number;
    } = {}
  ): Dye[] {
    this.database.ensureLoaded();
    let results = [...this.database.getDyesInternal()];

    if (filter.category) {
      results = results.filter((dye) => dye.category === filter.category);
    }

    if (filter.excludeIds && filter.excludeIds.length > 0) {
      const excludeSet = new Set(filter.excludeIds);
      results = results.filter((dye) => !excludeSet.has(dye.id));
    }

    if (filter.minPrice !== undefined) {
      // Defensively handle undefined/null cost values
      results = results.filter((dye) => (dye.cost ?? 0) >= filter.minPrice!);
    }

    if (filter.maxPrice !== undefined) {
      // Defensively handle undefined/null cost values
      results = results.filter((dye) => (dye.cost ?? 0) <= filter.maxPrice!);
    }

    return results;
  }

  /**
   * Find closest dye to a given hex color using configurable matching.
   *
   * Per P-7: Uses k-d tree for O(log n) initial candidates, then re-ranks
   * using the specified perceptual distance algorithm.
   *
   * Per COLOR-MATCH-001: Supports multiple matching algorithms:
   * - 'rgb': RGB Euclidean (fastest, least accurate)
   * - 'cie76': CIE76 LAB Euclidean (fast, fair accuracy)
   * - 'ciede2000': CIEDE2000 (industry standard, accurate)
   * - 'oklab': OKLAB Euclidean (recommended, good balance)
   * - 'hyab': HyAB hybrid (best for large color differences)
   * - 'oklch-weighted': OKLCH with custom L/C/H weights
   *
   * @param hex - Target color in hex format
   * @param excludeIdsOrOptions - Either an array of IDs to exclude (legacy) or options object
   * @returns Closest matching dye, or null if none found
   */
  findClosestDye(hex: string, excludeIdsOrOptions: number[] | FindClosestOptions = []): Dye | null {
    this.database.ensureLoaded();

    // Support both legacy signature and new options object
    const options: FindClosestOptions = Array.isArray(excludeIdsOrOptions)
      ? { excludeIds: excludeIdsOrOptions }
      : excludeIdsOrOptions;

    const { excludeIds = [], matchingMethod = 'oklab', weights } = options;

    try {
      const targetRgb = ColorConverter.hexToRgb(hex);
      const targetPoint: Point3D = {
        x: targetRgb.r,
        y: targetRgb.g,
        z: targetRgb.b,
      };

      const excludeSet = new Set(excludeIds);

      // Per P-7: Use k-d tree if available
      const kdTree = this.database.getKdTree();
      if (kdTree && !kdTree.isEmpty()) {
        // For RGB matching, k-d tree result is already optimal
        if (matchingMethod === 'rgb') {
          // CORE-BUG-005: Also exclude Facewear dyes
          const nearest = kdTree.nearestNeighbor(targetPoint, (data) => {
            const dye = data as Dye;
            return excludeSet.has(dye.id) || dye.category === 'Facewear';
          });

          if (nearest && nearest.data) {
            return nearest.data as Dye;
          }
        } else {
          // For perceptual methods: get candidates from k-d tree, then re-rank
          // Use RGB distance threshold to find candidates (generous to catch perceptual matches)
          // 100 RGB units covers most cases where perceptual distance might differ from RGB
          const rgbCandidateThreshold = 100;
          const candidateResults = kdTree.pointsWithinDistance(
            targetPoint,
            rgbCandidateThreshold,
            (data) => {
              const dye = data as Dye;
              return excludeSet.has(dye.id) || dye.category === 'Facewear';
            }
          );

          // If we got candidates, re-rank using perceptual distance
          if (candidateResults.length > 0) {
            let bestDye: Dye | null = null;
            let bestDistance = Infinity;

            for (const result of candidateResults) {
              if (!result.point.data) continue;
              const dye = result.point.data as Dye;

              try {
                const distance = this.calculateDistance(hex, dye.hex, matchingMethod, weights);
                if (distance < bestDistance) {
                  bestDistance = distance;
                  bestDye = dye;
                }
              } catch {
                // CORE-REF-001: Silently skip individual dyes with invalid color data
                // This is intentional - logging per-dye errors would be too noisy for large datasets
                // The dye data is pre-validated at load time, so this rarely occurs
                continue;
              }
            }

            if (bestDye) {
              return bestDye;
            }
          }

          // If no candidates within threshold, fall back to nearest neighbor
          // and use that as our only candidate
          const nearest = kdTree.nearestNeighbor(targetPoint, (data) => {
            const dye = data as Dye;
            return excludeSet.has(dye.id) || dye.category === 'Facewear';
          });

          if (nearest && nearest.data) {
            return nearest.data as Dye;
          }
        }
      }

      // Fallback to linear search (shouldn't happen if k-d tree is built)
      let closest: Dye | null = null;
      let minDistance = Infinity;
      const dyes = this.database.getDyesInternal();

      for (const dye of dyes) {
        if (excludeSet.has(dye.id) || dye.category === 'Facewear') {
          continue;
        }

        try {
          const distance = this.calculateDistance(hex, dye.hex, matchingMethod, weights);
          if (distance < minDistance) {
            minDistance = distance;
            closest = dye;
          }
        } catch {
          // CORE-REF-001: Silently skip individual dyes with invalid color data
          // See comment above for rationale
          continue;
        }
      }

      return closest;
    } catch (error) {
      // CORE-REF-001 FIX: Log complete search failures (e.g., invalid input hex)
      // These are unexpected and indicate caller provided bad input
      this.logger.warn(
        `[DyeSearch.findClosestDye] Search failed for hex "${hex}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Find dyes within a color distance threshold using configurable matching.
   *
   * Per P-7: Uses k-d tree for O(log n) candidate finding, then re-ranks
   * using the specified perceptual distance algorithm.
   *
   * Per COLOR-MATCH-001: Supports multiple matching algorithms.
   *
   * @param hex - Target color in hex format
   * @param maxDistanceOrOptions - Either maxDistance number (legacy) or options object
   * @param limit - Maximum results (legacy parameter, use options.limit instead)
   * @returns Array of dyes within the distance threshold
   */
  findDyesWithinDistance(
    hex: string,
    maxDistanceOrOptions: number | FindWithinDistanceOptions,
    limit?: number
  ): Dye[] {
    this.database.ensureLoaded();

    // Support both legacy signature and new options object
    const options: FindWithinDistanceOptions =
      typeof maxDistanceOrOptions === 'number'
        ? { maxDistance: maxDistanceOrOptions, limit }
        : maxDistanceOrOptions;

    const { maxDistance, limit: resultLimit, matchingMethod = 'rgb', weights } = options;

    try {
      const targetRgb = ColorConverter.hexToRgb(hex);
      const targetPoint: Point3D = {
        x: targetRgb.r,
        y: targetRgb.g,
        z: targetRgb.b,
      };

      // Per P-7: Use k-d tree for candidate finding
      const kdTree = this.database.getKdTree();
      if (kdTree && !kdTree.isEmpty()) {
        // For RGB matching, k-d tree distance is exact
        if (matchingMethod === 'rgb') {
          const kdResults = kdTree.pointsWithinDistance(targetPoint, maxDistance);
          const dyes = kdResults.map((item) => item.point.data as Dye);

          if (resultLimit && resultLimit > 0) {
            return dyes.slice(0, resultLimit);
          }
          return dyes;
        }

        // For perceptual methods: get candidates from k-d tree using generous RGB threshold,
        // then filter and re-rank using the specified perceptual distance
        // Use a generous RGB threshold to capture candidates that might be perceptually close
        const rgbCandidateThreshold = Math.max(maxDistance * 2, 150);
        const kdResults = kdTree.pointsWithinDistance(targetPoint, rgbCandidateThreshold);

        // Re-calculate distances using perceptual method and filter
        const results: Array<{ dye: Dye; distance: number }> = [];
        for (const item of kdResults) {
          const dye = item.point.data as Dye;
          if (dye.category === 'Facewear') continue;

          try {
            const distance = this.calculateDistance(hex, dye.hex, matchingMethod, weights);
            if (distance <= maxDistance) {
              results.push({ dye, distance });
            }
          } catch {
            // CORE-REF-001: Silently skip individual dyes with invalid color data
            // Logging per-dye errors would be too noisy for large datasets
            continue;
          }
        }

        // Sort by perceptual distance
        results.sort((a, b) => a.distance - b.distance);

        if (resultLimit && resultLimit > 0) {
          return results.slice(0, resultLimit).map((item) => item.dye);
        }
        return results.map((item) => item.dye);
      }

      // Fallback to linear search
      const results: Array<{ dye: Dye; distance: number }> = [];
      const dyes = this.database.getDyesInternal();

      for (const dye of dyes) {
        try {
          if (dye.category === 'Facewear') {
            continue;
          }

          const distance = this.calculateDistance(hex, dye.hex, matchingMethod, weights);
          if (distance <= maxDistance) {
            results.push({ dye, distance });
          }
        } catch {
          // CORE-REF-001: Silently skip individual dyes with invalid color data
          // See comment above for rationale
          continue;
        }
      }

      results.sort((a, b) => a.distance - b.distance);

      if (resultLimit) {
        results.splice(resultLimit);
      }

      return results.map((item) => item.dye);
    } catch (error) {
      // CORE-REF-001 FIX: Log complete search failures (e.g., invalid input hex)
      // These are unexpected and indicate caller provided bad input
      this.logger.warn(
        `[DyeSearch.findDyesWithinDistance] Search failed for hex "${hex}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Get dyes sorted by brightness
   */
  getDyesSortedByBrightness(ascending: boolean = true): Dye[] {
    this.database.ensureLoaded();

    return [...this.database.getDyesInternal()].sort((a, b) => {
      const brightnessA = a.hsv.v;
      const brightnessB = b.hsv.v;

      return ascending ? brightnessA - brightnessB : brightnessB - brightnessA;
    });
  }

  /**
   * Get dyes sorted by saturation
   */
  getDyesSortedBySaturation(ascending: boolean = true): Dye[] {
    this.database.ensureLoaded();

    return [...this.database.getDyesInternal()].sort((a, b) => {
      const satA = a.hsv.s;
      const satB = b.hsv.s;

      return ascending ? satA - satB : satB - satA;
    });
  }

  /**
   * Get dyes sorted by hue
   */
  getDyesSortedByHue(ascending: boolean = true): Dye[] {
    this.database.ensureLoaded();

    return [...this.database.getDyesInternal()].sort((a, b) => {
      const hueA = a.hsv.h;
      const hueB = b.hsv.h;

      return ascending ? hueA - hueB : hueB - hueA;
    });
  }
}
