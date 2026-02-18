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

import type { RGB, Dye, Logger } from '../types/index.js';
import { NoOpLogger } from '../types/index.js';
import { ColorService } from './ColorService.js';
import type { DyeService } from './DyeService.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for palette extraction
 */
export interface PaletteExtractionOptions {
  /** Number of colors to extract (3-5, default: 4) */
  colorCount?: number;
  /** Maximum K-means iterations (default: 25) */
  maxIterations?: number;
  /** Convergence threshold in RGB distance (default: 1.0) */
  convergenceThreshold?: number;
  /** Maximum pixels to sample (default: 10000) */
  maxSamples?: number;
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
  /** Color distance between extracted and matched (lower is better) */
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
  const minDistances: number[] = new Array(pixels.length);
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
  centroids: RGB[]
): { assignments: number[]; clusters: RGB[][] } {
  const assignments: number[] = new Array(pixels.length);
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
  clusters: RGB[][]
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
 * Run K-means clustering on pixel data
 */
function kMeansClustering(
  pixels: RGB[],
  k: number,
  maxIterations: number,
  convergenceThreshold: number
): { centroids: RGB[]; clusterSizes: number[] } {
  if (pixels.length === 0) {
    return { centroids: [], clusterSizes: [] };
  }

  // Limit k to number of unique pixels
  const effectiveK = Math.min(k, pixels.length);

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

  /** Default extraction options */
  private static readonly DEFAULT_OPTIONS: Required<PaletteExtractionOptions> = {
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
   * @returns Array of extracted colors sorted by dominance (most dominant first)
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

    // Validate colorCount - INPUT-003: Log warning when clamping occurs
    if (opts.colorCount < 1 || opts.colorCount > 10) {
      this.logger.warn(
        `PaletteService.extractPalette: colorCount ${opts.colorCount} clamped to [1, 10] range`
      );
    }
    const colorCount = Math.max(1, Math.min(10, opts.colorCount));

    // SECURITY: Clamp maxIterations to prevent DoS via algorithmic complexity
    // INPUT-003: Log warning when clamping occurs
    if (opts.maxIterations < 1 || opts.maxIterations > 100) {
      this.logger.warn(
        `PaletteService.extractPalette: maxIterations ${opts.maxIterations} clamped to [1, 100] range`
      );
    }
    const maxIterations = Math.max(1, Math.min(100, opts.maxIterations));

    if (pixels.length === 0) {
      this.logger.warn('PaletteService.extractPalette: Empty pixel array');
      return [];
    }

    this.logger.info(`Extracting ${colorCount} colors from ${pixels.length} pixels`);

    // Sample pixels if too many
    const sampledPixels = this.samplePixels(pixels, opts.maxSamples);

    // Run K-means clustering
    const { centroids, clusterSizes } = kMeansClustering(
      sampledPixels,
      colorCount,
      maxIterations,
      opts.convergenceThreshold
    );

    // Calculate total pixels for dominance percentage
    const totalPixels = clusterSizes.reduce((sum, size) => sum + size, 0);

    // Build result array
    const result: ExtractedColor[] = centroids.map((color, i) => ({
      color,
      dominance: totalPixels > 0 ? Math.round((clusterSizes[i] / totalPixels) * 100) : 0,
      pixelCount: clusterSizes[i],
    }));

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
   * @returns Array of palette matches sorted by dominance
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
    options: PaletteExtractionOptions = {}
  ): PaletteMatch[] {
    // Extract palette
    const extracted = this.extractPalette(pixels, options);

    // Match each extracted color to closest dye
    const matches: PaletteMatch[] = [];

    for (const ex of extracted) {
      // Convert RGB to hex for DyeService
      const hex = ColorService.rgbToHex(ex.color.r, ex.color.g, ex.color.b);
      const matchedDye = dyeService.findClosestDye(hex);

      if (matchedDye) {
        // Calculate distance between extracted and matched colors
        const distance = rgbDistance(ex.color, matchedDye.rgb);

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
   * Convert flat pixel array (Uint8ClampedArray from canvas) to RGB array
   * Skips alpha channel
   *
   * @param data - Flat array of RGBA values [r, g, b, a, r, g, b, a, ...]
   * @returns Array of RGB objects
   */
  static pixelDataToRGB(data: Uint8ClampedArray | number[]): RGB[] {
    const pixels: RGB[] = [];

    for (let i = 0; i < data.length; i += 4) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        // Skip alpha at data[i + 3]
      });
    }

    return pixels;
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
    alphaThreshold: number = 128
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
