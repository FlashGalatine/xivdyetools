/**
 * @xivdyetools/core - Preset Service
 *
 * Manages preset color palettes for FFXIV glamours.
 * Provides themed color combinations for jobs, seasons, events, and aesthetics.
 *
 * @module services/PresetService
 * @example
 * ```typescript
 * import { PresetService, presetData, DyeService, dyeDatabase } from '@xivdyetools/core';
 *
 * const presetService = new PresetService(presetData);
 * const dyeService = new DyeService(dyeDatabase);
 *
 * // Get all job presets
 * const jobPresets = presetService.getPresetsByCategory('jobs');
 *
 * // Get a preset with resolved dye objects
 * const rdmPreset = presetService.getPresetWithDyes('job-rdm', dyeService);
 * ```
 */

import type {
  PresetData,
  PresetPalette,
  PresetCategory,
  CategoryMeta,
  ResolvedPreset,
  Dye,
} from '../types/index.js';

/**
 * Interface for DyeService to resolve dye IDs to Dye objects
 * Using interface to avoid circular dependency
 */
interface IDyeService {
  getDyeById(id: number): Dye | null;
}

/**
 * Service for managing preset color palettes
 *
 * @example
 * ```typescript
 * const presetService = new PresetService(presetData);
 *
 * // List categories
 * const categories = presetService.getCategories();
 *
 * // Get presets by category
 * const jobPresets = presetService.getPresetsByCategory('jobs');
 *
 * // Search presets
 * const results = presetService.searchPresets('red');
 * ```
 */
export class PresetService {
  private data: PresetData;
  private presetById: Map<string, PresetPalette>;

  /**
   * Initialize the preset service with preset data
   * @param presetData - Preset data object (import from presets.json)
   */
  constructor(presetData: PresetData) {
    this.data = presetData;
    // Build lookup map for O(1) access by ID
    this.presetById = new Map(this.data.palettes.map((p) => [p.id, p]));
  }

  // ============================================================================
  // Category Operations
  // ============================================================================

  /**
   * Get all preset categories with metadata
   * @returns Array of category metadata with IDs
   *
   * @example
   * ```typescript
   * const categories = presetService.getCategories();
   * // [{ id: 'jobs', name: 'FFXIV Jobs', description: '...', icon: '⚔️' }, ...]
   * ```
   */
  getCategories(): (CategoryMeta & { id: string })[] {
    return Object.entries(this.data.categories).map(([id, meta]) => ({
      id,
      ...meta,
    }));
  }

  /**
   * Get metadata for a specific category
   * @param category - Category identifier
   * @returns Category metadata or undefined if not found
   */
  getCategoryMeta(category: PresetCategory): CategoryMeta | undefined {
    return this.data.categories[category];
  }

  // ============================================================================
  // Preset Retrieval
  // ============================================================================

  /**
   * Get all presets
   * @returns Array of all preset palettes
   */
  getAllPresets(): PresetPalette[] {
    return [...this.data.palettes];
  }

  /**
   * Get all presets in a specific category
   * @param category - Category to filter by
   * @returns Array of presets in that category
   *
   * @example
   * ```typescript
   * const jobPresets = presetService.getPresetsByCategory('jobs');
   * // Returns all job-themed presets (RDM, BLM, WHM, etc.)
   * ```
   */
  getPresetsByCategory(category: PresetCategory): PresetPalette[] {
    return this.data.palettes.filter((p) => p.category === category);
  }

  /**
   * Get a specific preset by ID
   * @param id - Preset identifier (e.g., "job-rdm")
   * @returns Preset or undefined if not found
   *
   * @example
   * ```typescript
   * const rdm = presetService.getPreset('job-rdm');
   * if (rdm) {
   *   console.log(rdm.name); // "Red Mage"
   *   console.log(rdm.dyes); // [5738, 13115, 13117, 5729]
   * }
   * ```
   */
  getPreset(id: string): PresetPalette | undefined {
    return this.presetById.get(id);
  }

  /**
   * Get preset count by category
   * @returns Map of category to preset count
   */
  getPresetCountByCategory(): Map<PresetCategory, number> {
    const counts = new Map<PresetCategory, number>();
    for (const preset of this.data.palettes) {
      counts.set(preset.category, (counts.get(preset.category) ?? 0) + 1);
    }
    return counts;
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search presets by name or tags
   * @param query - Search query (case-insensitive)
   * @returns Array of matching presets
   *
   * @example
   * ```typescript
   * // Search by name
   * const results = presetService.searchPresets('red');
   * // Returns: Red Mage, Blood Red themed presets, etc.
   *
   * // Search by tag
   * const tankResults = presetService.searchPresets('tank');
   * // Returns: Paladin, Warrior, Dark Knight, Gunbreaker
   * ```
   */
  searchPresets(query: string): PresetPalette[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      return [];
    }

    return this.data.palettes.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Search presets by tag (exact match)
   * @param tag - Tag to search for (case-insensitive)
   * @returns Array of presets with that tag
   */
  getPresetsByTag(tag: string): PresetPalette[] {
    const lowerTag = tag.toLowerCase().trim();
    return this.data.palettes.filter((p) => p.tags.some((t) => t.toLowerCase() === lowerTag));
  }

  // ============================================================================
  // Random Selection
  // ============================================================================

  /**
   * Get a random preset, optionally filtered by category
   * @param category - Optional category to filter by
   * @returns Random preset, or undefined if no presets exist
   *
   * @example
   * ```typescript
   * // Random from all presets
   * const random = presetService.getRandomPreset();
   *
   * // Random job preset
   * const randomJob = presetService.getRandomPreset('jobs');
   * ```
   */
  getRandomPreset(category?: PresetCategory): PresetPalette | undefined {
    const pool = category ? this.getPresetsByCategory(category) : this.data.palettes;

    if (pool.length === 0) {
      return undefined;
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ============================================================================
  // Dye Resolution (requires DyeService)
  // ============================================================================

  /**
   * Get preset with resolved Dye objects
   * Requires a DyeService instance to resolve dye IDs to full Dye objects
   *
   * @param id - Preset identifier
   * @param dyeService - DyeService instance for resolving dye IDs
   * @returns Resolved preset with full Dye objects, or undefined if preset not found
   *
   * @example
   * ```typescript
   * const dyeService = new DyeService(dyeDatabase);
   * const resolved = presetService.getPresetWithDyes('job-rdm', dyeService);
   *
   * if (resolved) {
   *   resolved.resolvedDyes.forEach(dye => {
   *     if (dye) {
   *       console.log(`${dye.name}: ${dye.hex}`);
   *     }
   *   });
   * }
   * ```
   */
  getPresetWithDyes(id: string, dyeService: IDyeService): ResolvedPreset | undefined {
    const preset = this.getPreset(id);
    if (!preset) {
      return undefined;
    }

    return {
      ...preset,
      resolvedDyes: preset.dyes.map((dyeId) => dyeService.getDyeById(dyeId)),
    };
  }

  /**
   * Resolve multiple presets with their Dye objects
   * @param presets - Array of presets to resolve
   * @param dyeService - DyeService instance for resolving dye IDs
   * @returns Array of resolved presets
   */
  resolvePresets(presets: PresetPalette[], dyeService: IDyeService): ResolvedPreset[] {
    return presets.map((preset) => ({
      ...preset,
      resolvedDyes: preset.dyes.map((dyeId) => dyeService.getDyeById(dyeId)),
    }));
  }

  // ============================================================================
  // Metadata
  // ============================================================================

  /**
   * Get data version
   * @returns Version string from preset data
   */
  getVersion(): string {
    return this.data.version;
  }

  /**
   * Get last update timestamp
   * @returns ISO date string of last update
   */
  getLastUpdated(): string {
    return this.data.lastUpdated;
  }

  /**
   * Get total number of presets
   * @returns Total preset count
   */
  getPresetCount(): number {
    return this.data.palettes.length;
  }
}
