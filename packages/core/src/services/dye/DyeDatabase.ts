/**
 * Dye Database
 * Per R-4: Focused class for dye database management
 * Handles loading, indexing, and data access
 */

import type { Dye, LAB } from '@xivdyetools/types';
import { ErrorCode, AppError } from '@xivdyetools/types';
import type { Logger } from '@xivdyetools/logger/library';
import { NoOpLogger } from '@xivdyetools/logger/library';
import { KDTree, type Point3D } from '../../utils/kd-tree.js';
import { ColorConverter } from '../color/ColorConverter.js';
import {
  ACQUISITION_META,
  METALLIC_STAIN_IDS,
  type DyeAcquisition,
} from '../../config/dye-vocabulary.js';

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
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
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
  /**
   * REFACTOR-013 (2026-07-18 audit): shared log-identifier derivation —
   * previously copy-pasted (with drift) six times inside isValidDye.
   */
  private dyeIdForLog(dye: Record<string, unknown>): string {
    if (typeof dye.id === 'number') return String(dye.id);
    if (typeof dye.itemID === 'number') return String(dye.itemID);
    return typeof dye.name === 'string' ? dye.name : 'unknown';
  }

  private isValidDye(dye: Record<string, unknown>): boolean {
    // Schema v2: stainID is the canonical identifier (Stain-sheet row, byte
    // range). Legacy fixture shapes may instead carry id/itemID — accepted
    // for backward compatibility with runtime-shaped test data.
    const hasStainId =
      typeof dye.stainID === 'number' && dye.stainID >= 1 && dye.stainID <= 254;
    const hasLegacyId = typeof dye.id === 'number' || typeof dye.itemID === 'number';

    if (!hasStainId && !hasLegacyId) {
      this.logger.warn('Dye missing required stainID (or legacy id/itemID) field');
      return false;
    }

    // Required: name must be a non-empty string
    if (typeof dye.name !== 'string' || dye.name.length === 0) {
      const idForLog = this.dyeIdForLog(dye);
      this.logger.warn(`Dye ${idForLog} has invalid name`);
      return false;
    }

    // Schema v2: hex is REQUIRED — it is the single color source of truth
    // from which rgb/hsv/lab are derived during normalization.
    if (typeof dye.hex !== 'string' || !/^#[A-Fa-f0-9]{6}$/.test(dye.hex)) {
      const idForLog = this.dyeIdForLog(dye);
      const hexForLog = typeof dye.hex === 'string' ? dye.hex : JSON.stringify(dye.hex);
      this.logger.warn(`Dye ${idForLog} has missing or invalid hex: ${hexForLog}`);
      return false;
    }

    // Validate category if present
    if (dye.category !== undefined && dye.category !== null && typeof dye.category !== 'string') {
      const idForLog = this.dyeIdForLog(dye);
      this.logger.warn(`Dye ${idForLog} has invalid category type`);
      return false;
    }

    // Validate consolidationType domain if present
    if (
      dye.consolidationType !== undefined &&
      dye.consolidationType !== null &&
      dye.consolidationType !== 'A' &&
      dye.consolidationType !== 'B' &&
      dye.consolidationType !== 'C'
    ) {
      const idForLog = this.dyeIdForLog(dye);
      this.logger.warn(`Dye ${idForLog} has invalid consolidationType`);
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
      const loadedDyes = Array.isArray(dyeData) ? dyeData : Object.values(dyeData);

      if (!Array.isArray(loadedDyes) || loadedDyes.length === 0) {
        throw new Error('Invalid dye database format: empty or not an array');
      }

      // Normalize dyes (schema v2): derive rgb/hsv/cost/currency/flags from
      // the 7-field file shape, with prototype pollution protection. Legacy
      // runtime-shaped input (full 16-field Dye objects, used by test
      // fixtures) passes through with its explicit values respected.
      // Per Issue #14: Filter out invalid dyes during loading
      this.dyes = loadedDyes
        .map((dye: unknown) => {
          // Per Security: Create a safe clone to prevent prototype pollution
          const normalizedDye = this.safeClone(dye as Record<string, unknown>);

          // Schema v2: legacyItemID carries the market-era item ID. The
          // runtime `itemID`/`id` contract (number, equal) is preserved for
          // downstream compatibility; a future dye with legacyItemID null
          // falls back to its stainID.
          if (normalizedDye.itemID === undefined && normalizedDye.legacyItemID !== undefined) {
            normalizedDye.itemID = normalizedDye.legacyItemID;
          }
          if (
            (normalizedDye.itemID === null || normalizedDye.itemID === undefined) &&
            typeof normalizedDye.stainID === 'number'
          ) {
            normalizedDye.itemID = normalizedDye.stainID;
          }
          if (normalizedDye.itemID && !normalizedDye.id) {
            normalizedDye.id = normalizedDye.itemID;
          }

          // Schema v2: rgb/hsv are DERIVED from hex — the stored copies were
          // a drift hazard (the Brass hsv bug; research/monorepo-2.0/01 §2).
          // 2-dp hue precision matters: 4 dyes sit within 0.2° of a 10° hue
          // bucket edge.
          if (typeof normalizedDye.hex === 'string' && /^#[A-Fa-f0-9]{6}$/.test(normalizedDye.hex)) {
            const rgb = ColorConverter.hexToRgb(normalizedDye.hex);
            normalizedDye.rgb = rgb;
            normalizedDye.hsv = ColorConverter.rgbToHsv(rgb.r, rgb.g, rgb.b);
          }

          // Schema v2: cost/currency derive from the acquisition table when
          // the entry doesn't carry them (legacy `price` still honored).
          const meta =
            typeof normalizedDye.acquisition === 'string'
              ? ACQUISITION_META[normalizedDye.acquisition as DyeAcquisition]
              : undefined;
          if (normalizedDye.price !== undefined && normalizedDye.cost === undefined) {
            normalizedDye.cost = normalizedDye.price ?? 0;
          }
          if (normalizedDye.cost === null || normalizedDye.cost === undefined) {
            normalizedDye.cost = meta?.price ?? 0;
          }
          if (normalizedDye.currency === undefined) {
            normalizedDye.currency = meta?.currency ?? null;
          }

          if (normalizedDye.consolidationType === undefined) {
            normalizedDye.consolidationType = null;
          }

          // Schema v2 derived flags (explicit fixture values win):
          // - metallic = the Stain sheet's gloss set (16 — decided 2026-07-30;
          //   NOT the name prefix, which misses Gunmetal Black + Pearl White)
          // - cosmic ≡ consolidationType 'C', ishgardian ≡ 'B' (fixes the old
          //   isCosmic pollution where all 9 Firmament dyes were included)
          if (normalizedDye.isMetallic === undefined) {
            normalizedDye.isMetallic =
              typeof normalizedDye.stainID === 'number' &&
              METALLIC_STAIN_IDS.has(normalizedDye.stainID);
          }
          if (normalizedDye.isPastel === undefined) {
            normalizedDye.isPastel = String(normalizedDye.name).startsWith('Pastel');
          }
          if (normalizedDye.isDark === undefined) {
            normalizedDye.isDark = String(normalizedDye.name).startsWith('Dark');
          }
          if (normalizedDye.isCosmic === undefined) {
            normalizedDye.isCosmic = normalizedDye.consolidationType === 'C';
          }
          if (normalizedDye.isIshgardian === undefined) {
            normalizedDye.isIshgardian = normalizedDye.consolidationType === 'B';
          }
          if (normalizedDye.stainID === undefined) {
            normalizedDye.stainID = null;
          }

          // Per MEM-001: Pre-compute lowercase name and category for search optimization
          normalizedDye.nameLower = String(normalizedDye.name).toLowerCase();
          normalizedDye.categoryLower = (typeof normalizedDye.category === 'string' ? normalizedDye.category : '').toLowerCase();

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
        // REFACTOR-012 (2026-07-18 audit): the Facewear synthetic-ID hash is a
        // plain char-code sum (collision-prone for future names); a silent
        // map overwrite would make one dye unreachable by ID. Fail loudly.
        if (this.dyesByIdMap.has(dye.id)) {
          this.logger.error(
            `Duplicate dye ID detected during initialization: ${dye.id} (${dye.name}) collides with ${this.dyesByIdMap.get(dye.id)?.name}`
          );
        }
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
        let bucket = this.dyesByHueBucket.get(hueBucket);
        if (!bucket) {
          bucket = [];
          this.dyesByHueBucket.set(hueBucket, bucket);
        }
        bucket.push(dye);

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
   * Get multiple dyes by stainIDs
   *
   * Batch equivalent of `getByStainId()`. Returns only the dyes that match;
   * unknown stainIDs are silently skipped (consistent with `getDyesByIds()`).
   *
   * @param stainIds - Array of stain table IDs
   * @returns Array of matching dyes (order matches input, gaps removed)
   *
   * @since 2.2.0
   */
  getDyesByStainIds(stainIds: number[]): Dye[] {
    this.ensureLoaded();
    return stainIds
      .map((id) => this.dyesByStainIdMap.get(id))
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
  getDyesInternal(): readonly DyeInternal[] {
    this.ensureLoaded();
    return this.dyes;
  }
}
