/**
 * @xivdyetools/core - Palette Extraction Service
 *
 * Extracts dominant colors from pixel data using K-means clustering.
 * Matches extracted colors to closest FFXIV dyes.
 *
 * @module services/PaletteService
 * @example
 * ```typescript
 * import { PaletteService, DyeService, dyeDatabase } from '@xivdyetools/core';
 *
 * const paletteService = new PaletteService();
 * const dyeService = new DyeService(dyeDatabase);
 *
 * // Extract 4 dominant colors from pixel data
 * const palette = paletteService.extractPalette(pixels, 4);
 *
 * // Extract and match to dyes in one step
 * const matches = paletteService.extractAndMatchPalette(pixels, 4, dyeService);
 * ```
 */

import type { RGB, Dye } from '@xivdyetools/types';
import type { MatchingMethod } from '../types/index.js';
import { DEFAULT_MATCHING_METHOD } from '../types/index.js';
import type { Logger } from '@xivdyetools/logger/library';
import { NoOpLogger } from '@xivdyetools/logger/library';
import { ColorService } from './ColorService.js';
import type { DyeService } from './DyeService.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for palette extraction
 */
export interface PaletteExtractionOptions {
  /**
   * MAXIMUM number of colors to extract (clamped to 1-10, default: 4). A
   * fraction is floored — 2.5 means at most 2. A value that is not a finite
   * number — NaN, ±Infinity, an explicit `undefined` — uses the default; either
   * correction (clamp or default) is logged as a warning. The result holds at
   * most this many entries, each with `pixelCount > 0`, and fewer when the
   * image holds fewer distinct colors or a cluster ends up empty — it is never
   * padded (BUG-036).
   */
  colorCount?: number;
  /**
   * Maximum K-means iterations (clamped to 1-100, default: 25). A value that
   * is not a finite number uses the default; either correction is logged as a
   * warning.
   */
  maxIterations?: number;
  /** Convergence threshold in RGB distance (default: 1.0) */
  convergenceThreshold?: number;
  /**
   * Maximum pixels to sample (minimum 2, default: 10000; a fraction is floored). A value that is not
   * a finite number uses the default; either correction is logged as a
   * warning.
   */
  maxSamples?: number;
  /**
   * Matching method used to pick each extracted colour's nearest dye
   * (`extractAndMatchPalette` only). Omitted → `DyeService.findClosestDye`'s
   * own default (`DEFAULT_MATCHING_METHOD`, ΔE2000).
   */
  matchingMethod?: MatchingMethod;
}

/**
 * An extracted color with its dominance (cluster size)
 */
export interface ExtractedColor {
  /** The extracted RGB color (cluster centroid) */
  color: RGB;
  /** Percentage of pixels in this cluster (0-100) */
  dominance: number;
  /** Number of pixels in this cluster */
  pixelCount: number;
}

/**
 * A matched palette entry with extracted and matched dye
 */
export interface PaletteMatch {
  /** The extracted RGB color */
  extracted: RGB;
  /** The closest matching FFXIV dye */
  matchedDye: Dye;
  /**
   * Distance between the extracted colour and the matched dye, measured with
   * the SAME `matchingMethod` that selected it (BUG-008) — so its scale is that
   * method's, and it is directly comparable with what the caller asked for.
   * Lower is better.
   */
  distance: number;
  /** Percentage of pixels in this cluster (0-100) */
  dominance: number;
}

/**
 * Configuration options for PaletteService
 */
export interface PaletteServiceOptions {
  /** Logger for service operations (defaults to NoOpLogger) */
  logger?: Logger;
}

// ============================================================================
// K-Means Clustering Implementation
// ============================================================================

/**
 * Calculate Euclidean distance between two RGB colors
 */
function rgbDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Calculate the mean of an array of RGB colors
 */
function rgbMean(colors: RGB[]): RGB {
  if (colors.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const c of colors) {
    sumR += c.r;
    sumG += c.g;
    sumB += c.b;
  }

  return {
    r: Math.round(sumR / colors.length),
    g: Math.round(sumG / colors.length),
    b: Math.round(sumB / colors.length),
  };
}

/**
 * K-means++ initialization for better starting centroids
 * Selects initial centroids that are well-distributed
 * CORE-PERF-003: Optimized from O(n*k²) to O(n*k) by caching minimum distances
 */
function kMeansPlusPlusInit(pixels: RGB[], k: number): RGB[] {
  if (pixels.length === 0 || k <= 0) {
    return [];
  }

  const centroids: RGB[] = [];

  // First centroid: random pixel
  const firstIndex = Math.floor(Math.random() * pixels.length);
  centroids.push({ ...pixels[firstIndex] });

  // CORE-PERF-003: Cache minimum distances to avoid O(k) inner loop
  // Initialize with distance to first centroid
  const minDistances: number[] = new Array<number>(pixels.length);
  for (let j = 0; j < pixels.length; j++) {
    minDistances[j] = rgbDistance(pixels[j], centroids[0]);
  }

  // Remaining centroids: weighted probability by distance squared
  for (let i = 1; i < k; i++) {
    // Calculate total distance (squared) for probability distribution
    let totalDistanceSquared = 0;
    for (let j = 0; j < pixels.length; j++) {
      totalDistanceSquared += minDistances[j] * minDistances[j];
    }

    // Select next centroid with probability proportional to distance squared
    let selectedIndex = 0;
    if (totalDistanceSquared === 0) {
      // All remaining pixels are duplicates of centroids
      selectedIndex = Math.floor(Math.random() * pixels.length);
    } else {
      let threshold = Math.random() * totalDistanceSquared;

      for (let j = 0; j < pixels.length; j++) {
        threshold -= minDistances[j] * minDistances[j];
        if (threshold <= 0) {
          selectedIndex = j;
          break;
        }
      }
    }

    centroids.push({ ...pixels[selectedIndex] });

    // CORE-PERF-003: Only compute distance to the NEW centroid and update minimums
    // This reduces complexity from O(n*k) per iteration to O(n) per iteration
    const newCentroid = centroids[centroids.length - 1];
    for (let j = 0; j < pixels.length; j++) {
      const distToNew = rgbDistance(pixels[j], newCentroid);
      if (distToNew < minDistances[j]) {
        minDistances[j] = distToNew;
      }
    }
  }

  return centroids;
}

/**
 * Assign each pixel to its nearest centroid
 * Returns array of cluster indices and the clusters themselves
 */
function assignToClusters(
  pixels: RGB[],
  centroids: RGB[],
): { assignments: number[]; clusters: RGB[][] } {
  const assignments: number[] = new Array<number>(pixels.length);
  const clusters: RGB[][] = centroids.map(() => []);

  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    let minDist = Infinity;
    let nearestCluster = 0;

    for (let j = 0; j < centroids.length; j++) {
      const dist = rgbDistance(pixel, centroids[j]);
      if (dist < minDist) {
        minDist = dist;
        nearestCluster = j;
      }
    }

    assignments[i] = nearestCluster;
    clusters[nearestCluster].push(pixel);
  }

  return { assignments, clusters };
}

/**
 * Update centroids to be the mean of their clusters
 * Returns new centroids and the maximum movement distance
 */
function updateCentroids(
  centroids: RGB[],
  clusters: RGB[][],
): { newCentroids: RGB[]; maxMovement: number } {
  const newCentroids: RGB[] = [];
  let maxMovement = 0;

  for (let i = 0; i < centroids.length; i++) {
    const cluster = clusters[i];

    if (cluster.length === 0) {
      // Empty cluster: keep old centroid
      newCentroids.push({ ...centroids[i] });
    } else {
      const newCentroid = rgbMean(cluster);
      const movement = rgbDistance(centroids[i], newCentroid);
      if (movement > maxMovement) {
        maxMovement = movement;
      }
      newCentroids.push(newCentroid);
    }
  }

  return { newCentroids, maxMovement };
}

/**
 * Count the distinct colours in `pixels`, stopping as soon as `limit` is
 * reached (the caller only needs `min(k, distinct)`). Two pixels are the same
 * colour exactly when their `rgbDistance` is 0, so the key is the exact
 * channel triple — no packing that could merge non-integer channels.
 *
 * A limit that is not a finite number never stops the count (`size >= NaN` is
 * never true), which would hand k-means one centroid per distinct colour — up
 * to the whole sample. `extractPalette` normalises colorCount to a whole
 * number in 1-10 before it gets here (a fractional limit would stop one colour
 * late: `size >= 2.5` first holds at 3), so this is defence in depth: such a
 * limit counts as 1, the single cluster a NaN k produced before the cap
 * existed. It must not be 0 — with
 * pixels but no centroids, assignToClusters indexes a cluster that is not there.
 */
function countDistinctColors(pixels: RGB[], limit: number): number {
  if (!Number.isFinite(limit)) return Math.min(1, pixels.length);
  const seen = new Set<string>();
  for (const p of pixels) {
    if (seen.size >= limit) break;
    seen.add(`${p.r},${p.g},${p.b}`);
  }
  return seen.size;
}

/**
 * Run K-means clustering on pixel data
 */
function kMeansClustering(
  pixels: RGB[],
  k: number,
  maxIterations: number,
  convergenceThreshold: number,
): { centroids: RGB[]; clusterSizes: number[] } {
  if (pixels.length === 0) {
    return { centroids: [], clusterSizes: [] };
  }

  // BUG-036 (2026-10-04 deep dive): limit k to the number of DISTINCT colours,
  // not the number of pixels. Once every distinct colour is a centroid,
  // k-means++ has nothing left to pick but a duplicate, and the strict `<` in
  // assignToClusters gives every clone 0 pixels — a flat two-colour icon asked
  // for five colours came back with three fabricated empty clusters.
  const effectiveK = countDistinctColors(pixels, k);

  // Initialize centroids using K-means++
  let centroids = kMeansPlusPlusInit(pixels, effectiveK);

  // Iterate until convergence or max iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to clusters
    const { clusters } = assignToClusters(pixels, centroids);

    // Update centroids
    const { newCentroids, maxMovement } = updateCentroids(centroids, clusters);
    centroids = newCentroids;

    // Check for convergence
    if (maxMovement < convergenceThreshold) {
      break;
    }
  }

  // Final assignment to get cluster sizes
  const { clusters } = assignToClusters(pixels, centroids);
  const clusterSizes = clusters.map((c) => c.length);

  return { centroids, clusterSizes };
}

// ============================================================================
// PaletteService Class
// ============================================================================

/**
 * Service for extracting color palettes from images
 *
 * Uses K-means clustering to find dominant colors, then matches
 * them to the closest FFXIV dyes.
 */
export class PaletteService {
  private logger: Logger;

  /** Default extraction options (k-means only — the matching method has no forced default here; the dye search's own default applies) */
  private static readonly DEFAULT_OPTIONS: Required<
    Omit<PaletteExtractionOptions, 'matchingMethod'>
  > = {
    colorCount: 4,
    maxIterations: 25,
    convergenceThreshold: 1.0,
    maxSamples: 10000,
  };

  /**
   * Create a new PaletteService
   * @param options - Optional configuration including logger
   */
  constructor(options: PaletteServiceOptions = {}) {
    this.logger = options.logger ?? NoOpLogger;
  }

  /**
   * Sample pixels from an array if it exceeds maxSamples
   * Uses uniform sampling to maintain color distribution
   * CORE-PERF-004: Fixed potential out-of-bounds access on last iteration
   * PERF-002: Fixed sampling bias - now includes first AND last pixel
   */
  private samplePixels(pixels: RGB[], maxSamples: number): RGB[] {
    if (pixels.length <= maxSamples) {
      return pixels;
    }

    const samples: RGB[] = [];

    // PERF-002: Use linear interpolation formula to ensure both first and last pixels are included
    // For maxSamples=10 and length=100: indices are 0, 11, 22, 33, 44, 55, 66, 77, 88, 99
    // This ensures colors at image edges (like bottom-right corners) are included
    for (let i = 0; i < maxSamples; i++) {
      const index = Math.round((i * (pixels.length - 1)) / (maxSamples - 1));
      samples.push(pixels[index]);
    }

    return samples;
  }

  /**
   * Extract dominant colors from pixel data
   *
   * @param pixels - Array of RGB pixel values
   * @param options - Extraction options (colorCount, maxIterations, etc.)
   * @returns Array of extracted colors sorted by dominance (most dominant first).
   *   At most `colorCount` entries, each with `pixelCount > 0`; fewer when the
   *   image holds fewer distinct colors or a cluster ends up empty (BUG-036 —
   *   it used to pad the array with 0-pixel duplicate clusters).
   *
   * @example
   * ```typescript
   * const pixels = [{ r: 255, g: 0, b: 0 }, { r: 254, g: 1, b: 1 }, ...];
   * const palette = paletteService.extractPalette(pixels, { colorCount: 4 });
   * // Returns: [{ color: { r: 255, g: 0, b: 0 }, dominance: 45, pixelCount: 4500 }, ...]
   * ```
   */
  extractPalette(pixels: RGB[], options: PaletteExtractionOptions = {}): ExtractedColor[] {
    const opts = { ...PaletteService.DEFAULT_OPTIONS, ...options };

    // A colorCount that is not a finite number means the default. An explicit
    // `{ colorCount: undefined }` survives the spread above (the repo does not
    // enable exactOptionalPropertyTypes), and neither it nor NaN trips either
    // side of the range check below, so the clamp returned NaN — which the
    // BUG-036 distinct-colour cap never stops at, making k every distinct
    // colour in the sample. ±Infinity has a nearer end to clamp to, but is no
    // more a count a caller can mean, so it takes the default too.
    let requestedCount = opts.colorCount;
    if (!Number.isFinite(requestedCount)) {
      this.logger.warn(
        `PaletteService.extractPalette: colorCount ${String(requestedCount)} is not a finite number; using the default ${PaletteService.DEFAULT_OPTIONS.colorCount}`,
      );
      requestedCount = PaletteService.DEFAULT_OPTIONS.colorCount;
    }

    // colorCount is a maximum, so a fraction is floored: 2.5 means "at most 2",
    // as CharacterColorService floors its match count (BUG-131). Unfloored,
    // the distinct-colour cap counts until `seen.size >= 2.5` — that is, to 3 —
    // and seeds one centroid more than the caller allowed.
    const wholeCount = Math.floor(requestedCount);

    // Validate colorCount - INPUT-003: Log warning when clamping occurs
    if (wholeCount < 1 || wholeCount > 10) {
      this.logger.warn(
        `PaletteService.extractPalette: colorCount ${requestedCount} clamped to [1, 10] range`,
      );
    }
    const colorCount = Math.max(1, Math.min(10, wholeCount));

    // A maxIterations that is not a finite number means the default, as for
    // colorCount above: NaN or an explicit `undefined` trips neither side of
    // the clamp below, which then returned NaN, and `iter < NaN` skipped every
    // Lloyd iteration — the palette was just the k-means++ seeds.
    let requestedIterations = opts.maxIterations;
    if (!Number.isFinite(requestedIterations)) {
      this.logger.warn(
        `PaletteService.extractPalette: maxIterations ${String(requestedIterations)} is not a finite number; using the default ${PaletteService.DEFAULT_OPTIONS.maxIterations}`,
      );
      requestedIterations = PaletteService.DEFAULT_OPTIONS.maxIterations;
    }

    // SECURITY: Clamp maxIterations to prevent DoS via algorithmic complexity
    // INPUT-003: Log warning when clamping occurs
    if (requestedIterations < 1 || requestedIterations > 100) {
      this.logger.warn(
        `PaletteService.extractPalette: maxIterations ${requestedIterations} clamped to [1, 100] range`,
      );
    }
    const maxIterations = Math.max(1, Math.min(100, requestedIterations));

    if (pixels.length === 0) {
      this.logger.warn('PaletteService.extractPalette: Empty pixel array');
      return [];
    }

    // A maxSamples that is not a finite number means the default. NaN or an
    // explicit `undefined` slips past the `< 2` guard below, Math.max(2, NaN)
    // is NaN, and samplePixels then neither returns the input
    // (`length <= NaN`) nor runs its loop (`i < NaN`) — every pixel was
    // dropped and the call returned [] without a word.
    let requestedSamples = opts.maxSamples;
    if (!Number.isFinite(requestedSamples)) {
      this.logger.warn(
        `PaletteService.extractPalette: maxSamples ${String(requestedSamples)} is not a finite number; using the default ${PaletteService.DEFAULT_OPTIONS.maxSamples}`,
      );
      requestedSamples = PaletteService.DEFAULT_OPTIONS.maxSamples;
    }
    // A sample count is whole: samplePixels runs its loop ceil(n) times but
    // spaces the picks by n - 1, so a fraction walked past the array's end
    // (2.5 on 100 pixels read index 132 and threw).
    requestedSamples = Math.floor(requestedSamples);

    // BUG-044 (2026-07-18 audit): clamp maxSamples like the sibling options —
    // maxSamples 1 hit a 0/0 = NaN in the sampling interpolation (TypeError
    // deep in k-means); ≤ 0 silently produced an empty sample set
    if (requestedSamples < 2) {
      this.logger.warn(
        `PaletteService.extractPalette: maxSamples ${requestedSamples} clamped to minimum 2`,
      );
    }
    const maxSamples = Math.max(2, requestedSamples);

    this.logger.info(`Extracting ${colorCount} colors from ${pixels.length} pixels`);

    // Sample pixels if too many
    const sampledPixels = this.samplePixels(pixels, maxSamples);

    // Run K-means clustering
    const { centroids, clusterSizes } = kMeansClustering(
      sampledPixels,
      colorCount,
      maxIterations,
      opts.convergenceThreshold,
    );

    // Calculate total pixels for dominance percentage
    const totalPixels = clusterSizes.reduce((sum, size) => sum + size, 0);

    // Build result array. BUG-036: drop any cluster that ended with no pixels —
    // capping k at the distinct-colour count stops k-means++ seeding clones,
    // but Lloyd's iterations can still strand a centroid (updateCentroids keeps
    // an empty one where it was), and an empty cluster is not a colour the
    // image holds. totalPixels is unchanged, since an empty cluster adds 0.
    const result: ExtractedColor[] = centroids
      .map((color, i) => ({
        color,
        dominance: totalPixels > 0 ? Math.round((clusterSizes[i] / totalPixels) * 100) : 0,
        pixelCount: clusterSizes[i],
      }))
      .filter((extracted) => extracted.pixelCount > 0);

    // Sort by dominance (most dominant first)
    result.sort((a, b) => b.dominance - a.dominance);

    this.logger.info(`Extracted colors: ${result.map((r) => `${r.dominance}%`).join(', ')}`);

    return result;
  }

  /**
   * Extract colors from pixel data and match each to the closest FFXIV dye
   *
   * @param pixels - Array of RGB pixel values
   * @param dyeService - DyeService instance for matching
   * @param options - Extraction options
   * @returns Array of palette matches sorted by dominance — one per color
   *   `extractPalette` returns, so at most `colorCount` entries; fewer when the
   *   image holds fewer distinct colors or a cluster ends up empty
   *
   * @example
   * ```typescript
   * const matches = paletteService.extractAndMatchPalette(pixels, dyeService, { colorCount: 4 });
   * // Returns: [{ extracted: {...}, matchedDye: {...}, distance: 12.3, dominance: 45 }, ...]
   * ```
   */
  extractAndMatchPalette(
    pixels: RGB[],
    dyeService: DyeService,
    options: PaletteExtractionOptions = {},
  ): PaletteMatch[] {
    // Extract palette
    const extracted = this.extractPalette(pixels, options);

    // Match each extracted color to closest dye
    const matches: PaletteMatch[] = [];

    for (const ex of extracted) {
      // Convert RGB to hex for DyeService
      const hex = ColorService.rgbToHex(ex.color.r, ex.color.g, ex.color.b);
      const matchedDye = dyeService.findClosestDye(
        hex,
        options.matchingMethod ? { matchingMethod: options.matchingMethod } : undefined,
      );

      if (matchedDye) {
        // BUG-008: report the distance on the SAME metric that chose the match.
        // This used to be an unconditional `rgbDistance` — Euclidean RGB on a
        // 0-441.67 scale — while the winner was picked with `matchingMethod`,
        // so the number a caller received was on a different scale from the
        // metric that produced it, with nothing in the value to say which.
        const distance = ColorService.getDistanceForMethod(
          hex,
          matchedDye.hex,
          options.matchingMethod ?? DEFAULT_MATCHING_METHOD,
        );

        matches.push({
          extracted: ex.color,
          matchedDye,
          distance,
          dominance: ex.dominance,
        });
      }
    }

    return matches;
  }

  /**
   * Filter out near-transparent pixels from RGBA data
   * Useful for images with transparent backgrounds
   *
   * @param data - Flat array of RGBA values
   * @param alphaThreshold - Minimum alpha to include (0-255, default: 128)
   * @returns Array of RGB objects for non-transparent pixels
   */
  static pixelDataToRGBFiltered(
    data: Uint8ClampedArray | number[],
    alphaThreshold: number = 128,
  ): RGB[] {
    const pixels: RGB[] = [];

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha >= alphaThreshold) {
        pixels.push({
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
        });
      }
    }

    return pixels;
  }
}
