/**
 * Dye Database
 * Per R-4: Focused class for dye database management
 * Handles loading, indexing, and data access
 */

import type { Dye, LAB } from '../../types/index.js';
import { ErrorCode, AppError } from '../../types/index.js';
import type { Logger } from '../../types/index.js';
import { NoOpLogger } from '../../types/index.js';
import { KDTree, type Point3D } from '../../utils/kd-tree.js';
import { ColorConverter } from '../color/ColorConverter.js';

/**
 * Internal dye type with pre-computed fields for search optimization
 * Per MEM-001: Avoids repeated toLowerCase() calls during searches
 * Per DeltaE: Pre-computes LAB values for perceptual color matching
 * @internal
 */
export interface DyeInternal extends Dye {
  /** Pre-computed lowercase name for search optimization */
  nameLower: string;
  /** Pre-computed lowercase category for search optimization */
  categoryLower: string;
  /** Pre-computed LAB color values for DeltaE calculations */
  lab: LAB;
}

/**
 * Configuration for DyeDatabase
 */
export interface DyeDatabaseConfig {
  /**
   * Logger for database operations (default: NoOpLogger)
   */
  logger?: Logger;
}

/**
 * Dye database manager
 * Per R-4: Single Responsibility - database management only
 */
export class DyeDatabase {
  // Per MEM-001: Store DyeInternal with pre-computed lowercase fields
  private dyes: DyeInternal[] = [];
  private dyesByIdMap: Map<number, DyeInternal> = new Map();
  // Per Phase-1: StainID map for plugin interoperability (Glamourer, Mare, etc.)
  private dyesByStainIdMap: Map<number, DyeInternal> = new Map();
  // Per P-2: Hue-indexed map for fast harmony lookups (70-90% speedup)
  // Maps hue bucket (0-35 for 10° buckets) to array of dyes in that range
  private dyesByHueBucket: Map<number, DyeInternal[]> = new Map();
  // Per P-7: k-d tree for fast nearest neighbor search in RGB space
  private kdTree: KDTree | null = null;
  private isLoaded: boolean = false;
  private lastLoaded: number = 0;
  private readonly logger: Logger;

  // Per P-2: Hue bucket size (10 degrees per bucket for 36 buckets total)
  private static readonly HUE_BUCKET_SIZE = 10;
  private static readonly HUE_BUCKET_COUNT = 36; // 360 / 10

  /**
   * Dangerous prototype pollution keys to filter out
   * Per Security: Prevents prototype pollution attacks from untrusted data
   */
  private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  /**
   * Constructor with optional configuration
   * @param config Configuration options including logger
   */
  constructor(config: DyeDatabaseConfig = {}) {
    this.logger = config.logger ?? NoOpLogger;
  }

  /**
   * Create a safe copy of an object, filtering out prototype pollution keys
   * Per Security: Deep clones object while preventing prototype pollution
   */
  private safeClone(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(obj)) {
      if (DyeDatabase.DANGEROUS_KEYS.has(key)) {
        continue; // Skip dangerous keys
      }
      const value = obj[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.safeClone(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Validate dye data structure
   * Per Issue #14: Runtime validation prevents malformed data from causing runtime errors
   * @param dye - Object to validate as a Dye
   * @returns true if valid, false otherwise
   */
  private isValidDye(dye: Record<string, unknown>): boolean {
    // Required: id or itemID (can be null for Facewear dyes, which will get generated id)
    const hasValidId = typeof dye.id === 'number' || typeof dye.itemID === 'number';
    const hasFacewearNullId = dye.itemID === null && dye.category === 'Facewear';

    if (!hasValidId && !hasFacewearNullId) {
      this.logger.warn('Dye missing required id or itemID field');
      return false;
    }

    // Required: name must be a non-empty string
    if (typeof dye.name !== 'string' || dye.name.length === 0) {
      const idForLog =
        typeof dye.id === 'number'
          ? String(dye.id)
          : typeof dye.itemID === 'number'
            ? String(dye.itemID)
            : 'unknown';
      this.logger.warn(`Dye ${idForLog} has invalid name`);
      return false;
    }

    // Validate hex format if present
    if (dye.hex !== undefined && dye.hex !== null) {
      if (typeof dye.hex !== 'string' || !/^#[A-Fa-f0-9]{6}$/.test(dye.hex)) {
        const idForLog =
          typeof dye.id === 'number'
            ? String(dye.id)
            : typeof dye.itemID === 'number'
              ? String(dye.itemID)
              : String(dye.name ?? 'unknown');
        const hexForLog = typeof dye.hex === 'string' ? dye.hex : String(dye.hex);
        this.logger.warn(`Dye ${idForLog} has invalid hex format: ${hexForLog}`);
        return false;
      }
    }

    // Validate RGB if present
    if (dye.rgb !== undefined && dye.rgb !== null) {
      const rgb = dye.rgb as Record<string, unknown>;
      if (
        typeof rgb.r !== 'number' ||
        rgb.r < 0 ||
        rgb.r > 255 ||
        typeof rgb.g !== 'number' ||
        rgb.g < 0 ||
        rgb.g > 255 ||
        typeof rgb.b !== 'number' ||
        rgb.b < 0 ||
        rgb.b > 255
      ) {
        const idForLog =
          typeof dye.id === 'number'
            ? String(dye.id)
            : typeof dye.itemID === 'number'
              ? String(dye.itemID)
              : String(dye.name ?? 'unknown');
        this.logger.warn(`Dye ${idForLog} has invalid RGB values`);
        return false;
      }
    }

    // CORE-BUG-004 FIX: HSV is required per Dye interface (used for hue bucket indexing)
    // Must validate HSV is present and has valid values
    if (dye.hsv === undefined || dye.hsv === null) {
      const idForLog =
        typeof dye.id === 'number'
          ? String(dye.id)
          : typeof dye.itemID === 'number'
            ? String(dye.itemID)
            : String(dye.name ?? 'unknown');
      this.logger.warn(`Dye ${idForLog} missing required HSV values`);
      return false;
    }

    const hsv = dye.hsv as Record<string, unknown>;
    if (
      typeof hsv.h !== 'number' ||
      hsv.h < 0 ||
      hsv.h > 360 ||
      typeof hsv.s !== 'number' ||
      hsv.s < 0 ||
      hsv.s > 100 ||
      typeof hsv.v !== 'number' ||
      hsv.v < 0 ||
      hsv.v > 100
    ) {
      const idForLog =
        typeof dye.id === 'number'
          ? String(dye.id)
          : typeof dye.itemID === 'number'
            ? String(dye.itemID)
            : String(dye.name ?? 'unknown');
      this.logger.warn(`Dye ${idForLog} has invalid HSV values`);
      return false;
    }

    // Validate category if present
    if (dye.category !== undefined && dye.category !== null && typeof dye.category !== 'string') {
      const idForLog =
        typeof dye.id === 'number'
          ? String(dye.id)
          : typeof dye.itemID === 'number'
            ? String(dye.itemID)
            : String(dye.name ?? 'unknown');
      this.logger.warn(`Dye ${idForLog} has invalid category type`);
      return false;
    }

    return true;
  }

  /**
   * Initialize dye database from data
   * Per Security: Includes prototype pollution protection for untrusted data sources
   */
  initialize(dyeData: unknown): void {
    try {
      // Validate input type
      if (dyeData === null || dyeData === undefined) {
        throw new Error('Invalid dye database format: null or undefined');
      }
      if (
        typeof dyeData === 'string' ||
        typeof dyeData === 'number' ||
        typeof dyeData === 'boolean'
      ) {
        throw new Error('Invalid dye database format: expected array or object');
      }

      // Support both array and object formats
      const loadedDyes = Array.isArray(dyeData) ? dyeData : Object.values(dyeData as object);

      if (!Array.isArray(loadedDyes) || loadedDyes.length === 0) {
        throw new Error('Invalid dye database format: empty or not an array');
      }

      // Normalize dyes: map itemID to id, price to cost, with prototype pollution protection
      // Per Issue #14: Filter out invalid dyes during loading
      this.dyes = loadedDyes
        .map((dye: unknown) => {
          // Per Security: Create a safe clone to prevent prototype pollution
          const normalizedDye = this.safeClone(dye as Record<string, unknown>);

          // If the dye has itemID but no id, use itemID as the id
          if (normalizedDye.itemID && !normalizedDye.id) {
            normalizedDye.id = normalizedDye.itemID;
          }

          // Generate synthetic ID for Facewear dyes with null itemID
          // Uses negative numbers to avoid collision with real itemIDs
          if (normalizedDye.itemID === null && normalizedDye.category === 'Facewear') {
            // Use hash of name as synthetic ID (negative to distinguish from real IDs)
            const nameHash = String(normalizedDye.name)
              .split('')
              .reduce((acc, char) => acc + char.charCodeAt(0), 0);
            normalizedDye.id = -(1000 + nameHash);
            normalizedDye.itemID = normalizedDye.id;
          }

          // Per Bug Fix: Map 'price' field to 'cost' for Dye interface compatibility
          // JSON data uses 'price' but Dye interface expects 'cost'
          if (normalizedDye.price !== undefined && normalizedDye.cost === undefined) {
            normalizedDye.cost = normalizedDye.price ?? 0;
          }
          // Ensure cost is always a number (handle null values in JSON)
          if (normalizedDye.cost === null || normalizedDye.cost === undefined) {
            normalizedDye.cost = 0;
          }

          // Per MEM-001: Pre-compute lowercase name and category for search optimization
          normalizedDye.nameLower = String(normalizedDye.name).toLowerCase();
          normalizedDye.categoryLower = String(normalizedDye.category ?? '').toLowerCase();

          return normalizedDye;
        })
        .filter((dye) => this.isValidDye(dye))
        .map((dye) => {
          // Per DeltaE: Pre-compute LAB values for perceptual color matching
          // This runs AFTER validation to ensure valid RGB values
          const rgb = dye.rgb as { r: number; g: number; b: number } | undefined;
          if (
            rgb &&
            typeof rgb.r === 'number' &&
            typeof rgb.g === 'number' &&
            typeof rgb.b === 'number'
          ) {
            dye.lab = ColorConverter.rgbToLab(rgb.r, rgb.g, rgb.b);
          } else {
            // Fallback: compute from hex if RGB not available
            const hex = dye.hex as string | undefined;
            if (hex) {
              dye.lab = ColorConverter.hexToLab(hex);
            } else {
              // Default to neutral gray if no color info available
              dye.lab = { L: 50, a: 0, b: 0 };
            }
          }
          return dye as unknown as DyeInternal;
        });

      // Build ID map for fast lookups
      this.dyesByIdMap.clear();
      // Per Phase-1: Build stainID map for plugin interop
      this.dyesByStainIdMap.clear();
      // Per P-2: Build hue-indexed map for harmony lookups
      this.dyesByHueBucket.clear();

      // Per P-7: Build k-d tree for RGB color space
      const kdTreePoints: Point3D[] = [];

      for (const dye of this.dyes) {
        // Map by id (which equals itemID after normalization)
        this.dyesByIdMap.set(dye.id, dye);
        // Per Issue #5: Only map itemID separately if it differs from id
        // This avoids storing the same dye twice with the same key
        if (dye.itemID && dye.itemID !== dye.id) {
          this.dyesByIdMap.set(dye.itemID, dye);
        }

        // Per Phase-1: Map by stainID for plugin interop (Glamourer, Mare, etc.)
        // stainID is null for Facewear dyes
        if (typeof dye.stainID === 'number') {
          this.dyesByStainIdMap.set(dye.stainID, dye);
        }

        // Per P-2: Index by hue bucket (10° buckets)
        const hueBucket = this.getHueBucket(dye.hsv.h);
        if (!this.dyesByHueBucket.has(hueBucket)) {
          this.dyesByHueBucket.set(hueBucket, []);
        }
        this.dyesByHueBucket.get(hueBucket)!.push(dye);

        // Per P-7: Add to k-d tree (exclude Facewear dyes from tree)
        if (dye.category !== 'Facewear') {
          kdTreePoints.push({
            x: dye.rgb.r,
            y: dye.rgb.g,
            z: dye.rgb.b,
            data: dye,
          });
        }
      }

      // Per P-7: Build k-d tree
      this.kdTree = new KDTree(kdTreePoints);

      this.isLoaded = true;
      this.lastLoaded = Date.now();

      this.logger.info(`Dye database loaded: ${this.dyes.length} dyes`);
    } catch (error) {
      this.isLoaded = false;
      throw new AppError(
        ErrorCode.DATABASE_LOAD_FAILED,
        `Failed to load dye database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'critical'
      );
    }
  }

  /**
   * Ensure database is loaded, throw error if not
   */
  ensureLoaded(): void {
    if (!this.isLoaded) {
      throw new AppError(ErrorCode.DATABASE_LOAD_FAILED, 'Dye database is not loaded', 'critical');
    }
  }

  /**
   * Get all dyes (defensive copy)
   */
  getAllDyes(): Dye[] {
    this.ensureLoaded();
    return [...this.dyes];
  }

  /**
   * Get dye by ID
   */
  getDyeById(id: number): Dye | null {
    this.ensureLoaded();
    return this.dyesByIdMap.get(id) || null;
  }

  /**
   * Get dye by stainID (game's internal stain table ID)
   *
   * Use this method when interfacing with plugins like Glamourer or Mare Synchronos
   * that expose stainID rather than itemID.
   *
   * **Note:** For stable references, prefer `getDyeById()` with itemID.
   *
   * @param stainId - The game's stain table ID (1-125)
   * @returns The matching dye or null if not found
   *
   * @example
   * ```typescript
   * // Glamourer uses stainID internally
   * const dye = database.getByStainId(1); // Snow White
   * console.log(dye?.name); // "Snow White"
   * console.log(dye?.itemID); // 5729
   * ```
   *
   * @since 2.1.0
   */
  getByStainId(stainId: number): Dye | null {
    this.ensureLoaded();
    return this.dyesByStainIdMap.get(stainId) || null;
  }

  /**
   * Get multiple dyes by IDs
   */
  getDyesByIds(ids: number[]): Dye[] {
    this.ensureLoaded();
    // DyeInternal extends Dye, so this is type-safe as Dye[]
    return ids
      .map((id) => this.dyesByIdMap.get(id))
      .filter((dye): dye is DyeInternal => dye !== undefined);
  }

  /**
   * Check if database is loaded
   */
  isLoadedStatus(): boolean {
    return this.isLoaded;
  }

  /**
   * Get timestamp of last load
   */
  getLastLoadedTime(): number {
    return this.lastLoaded;
  }

  /**
   * Get total dye count
   */
  getDyeCount(): number {
    this.ensureLoaded();
    return this.dyes.length;
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    this.ensureLoaded();
    const categories = new Set<string>();

    for (const dye of this.dyes) {
      categories.add(dye.category);
    }

    return Array.from(categories).sort();
  }

  /**
   * Get k-d tree (for search operations)
   */
  getKdTree(): KDTree | null {
    return this.kdTree;
  }

  /**
   * Get logger instance (for delegating logging to dependent services)
   * @internal
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get hue bucket index for a given hue (0-35 for 10° buckets)
   * Per P-2: Maps hue to bucket for indexed lookups
   */
  getHueBucket(hue: number): number {
    // Normalize hue to 0-360 range
    const normalizedHue = ((hue % 360) + 360) % 360;
    return Math.floor(normalizedHue / DyeDatabase.HUE_BUCKET_SIZE);
  }

  /**
   * Get hue buckets to search for a target hue with tolerance
   * Per P-2: Returns bucket indices that could contain matching dyes
   */
  getHueBucketsToSearch(targetHue: number, tolerance: number): number[] {
    const targetBucket = this.getHueBucket(targetHue);
    const bucketsToSearch = new Set<number>();

    // Add target bucket
    bucketsToSearch.add(targetBucket);

    // Add adjacent buckets based on tolerance
    // Each bucket is 10°, so tolerance/10 buckets on each side
    const bucketRange = Math.ceil(tolerance / DyeDatabase.HUE_BUCKET_SIZE);
    for (let i = -bucketRange; i <= bucketRange; i++) {
      const bucket =
        (targetBucket + i + DyeDatabase.HUE_BUCKET_COUNT) % DyeDatabase.HUE_BUCKET_COUNT;
      bucketsToSearch.add(bucket);
    }

    return Array.from(bucketsToSearch);
  }

  /**
   * Get dyes by hue bucket
   */
  getDyesByHueBucket(bucket: number): Dye[] {
    this.ensureLoaded();
    return this.dyesByHueBucket.get(bucket) || [];
  }

  /**
   * Get all dyes (internal access, no defensive copy)
   *
   * **Internal Use Only** - Returns a direct reference to the internal dyes array.
   * Modifications to the returned array will affect the database state.
   *
   * For public API access, use {@link getAllDyes} which returns a defensive copy.
   *
   * Per MEM-001: Returns DyeInternal with pre-computed lowercase fields for search optimization.
   *
   * @internal
   * @returns Direct reference to internal dyes array with pre-computed nameLower/categoryLower - DO NOT MODIFY
   *
   * @example
   * ```typescript
   * // Internal usage in DyeSearch (optimized for read-only iteration)
   * const dyes = this.database.getDyesInternal();
   * for (const dye of dyes) {
   *     // Use dye.nameLower instead of dye.name.toLowerCase()
   * }
   * ```
   */
  getDyesInternal(): DyeInternal[] {
    this.ensureLoaded();
    return this.dyes;
  }
}
