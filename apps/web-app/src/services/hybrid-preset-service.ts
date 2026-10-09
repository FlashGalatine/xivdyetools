/**
 * Hybrid Preset Service
 * Provides a unified interface for both local (curated) and community presets
 * Falls back to local presets when API is unavailable
 */
/* istanbul ignore file */
import { PresetService, presetData } from '@xivdyetools/core';
import type {
  PresetPalette,
  PresetCategory,
  PresetData,
  PresetSortOption,
} from '@xivdyetools/types';
import { dyeService as sharedDyeService } from './dye-service-wrapper';
import {
  CommunityPresetService,
  communityPresetService,
  type CommunityPreset,
  type PresetFilters,
} from './community-preset-service';
import { logger } from '@shared/logger';
import { sanitizeExampleLink, sanitizePreviewImageUrl } from '@shared/example-link';

// ============================================
// Types
// ============================================

/**
 * Unified preset type that works for both local and community presets
 */
export interface UnifiedPreset {
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  /** Up to two extra categories; the rail matches on either slot */
  secondaryCategories: PresetCategory[];
  dyes: number[];
  tags: string[];
  /** Author name for community presets, undefined for curated */
  author?: string;
  /** Vote count for community presets, 0 for curated */
  voteCount: number;
  /** Whether this is a curated preset */
  isCurated: boolean;
  /** Whether this preset is from the API (can be voted on) */
  isFromAPI: boolean;
  /** Original API preset ID (for voting) */
  apiPresetId?: string;
  /** Creation date for community presets */
  createdAt?: string;
  /** 8A: allowlisted example-link page URL, when the author gave one */
  exampleLink?: string | null;
  /** Approved preview image URL; absent until a moderator approves it. */
  previewImageUrl?: string | null;
}

/**
 * Unified category with metadata
 */
export interface UnifiedCategory {
  id: PresetCategory;
  name: string;
  description: string;
  icon: string;
  presetCount: number;
  isCurated: boolean;
}

// PresetSortOption is the shared `@xivdyetools/types` contract, re-exported
// here so existing `@services/hybrid-preset-service` imports keep working.
export type { PresetSortOption };

/**
 * Options for fetching presets
 */
export interface GetPresetsOptions {
  category?: PresetCategory;
  search?: string;
  sort?: PresetSortOption;
  includeAPI?: boolean;
  limit?: number;
}

/**
 * What one `getPresets()` call fetched.
 *
 * BUG-029 (2026-10-04 deep-dive): the bare list could not tell preset-tool
 * whether the community leg answered. A failed leg was logged and swallowed,
 * so a transient 5xx came back as the curated list alone, and tombstone
 * reconciliation read that as "every saved community preset was deleted".
 */
export interface PresetPoolResult {
  /** Curated + community presets, sorted, cut to `limit`. */
  presets: UnifiedPreset[];
  /**
   * The community leg was asked and answered. False when the API was
   * unavailable at init, `includeAPI` was off, or the request failed: in each
   * case `presets` says nothing about which community presets exist.
   */
  apiOk: boolean;
  /**
   * The id of every community row the API returned, taken BEFORE the merged
   * sort and `limit` cut. Up to 15 curated + `limit` API rows are cut to
   * `limit`, and a row cut for space has not been deleted.
   */
  apiIds: string[];
}

// ============================================
// Sorting
// ============================================

/**
 * Order presets by one of the gallery's three sorts. Never mutates `presets`.
 * Exported so preset-tool can sort its local shelves (Saved, Mine) the same
 * way this service sorts the fetched pool (2026-10-04 deep-dive OPT-008).
 */
export function sortPresets(presets: UnifiedPreset[], sort: PresetSortOption): UnifiedPreset[] {
  switch (sort) {
    case 'popular':
      return [...presets].sort((a, b) => b.voteCount - a.voteCount);
    case 'recent':
      return [...presets].sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    case 'name':
    default:
      return [...presets].sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ============================================
// Service Implementation
// ============================================

/**
 * Hybrid Preset Service
 * Singleton that provides unified access to both local and community presets
 */
class HybridPresetService {
  private static instance: HybridPresetService | null = null;

  private readonly localPresetService: PresetService;
  private readonly communityService: CommunityPresetService;
  // Use shared singleton dyeService to avoid duplicate instantiation
  private readonly dyeService = sharedDyeService;
  private initialized = false;
  private apiAvailable = false;

  private constructor() {
    this.localPresetService = new PresetService(presetData as PresetData);
    this.communityService = communityPresetService;
    // dyeService is initialized from shared singleton above
  }

  /**
   * Get singleton instance
   */
  static getInstance(): HybridPresetService {
    if (!HybridPresetService.instance) {
      HybridPresetService.instance = new HybridPresetService();
    }
    return HybridPresetService.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try to initialize community service
    this.apiAvailable = await this.communityService.initialize();
    this.initialized = true;

    logger.info(
      `HybridPresetService: Initialized (API ${this.apiAvailable ? 'available' : 'unavailable'})`
    );
  }

  /**
   * Check if API is available
   */
  isAPIAvailable(): boolean {
    return this.apiAvailable;
  }

  // ============================================
  // Conversion Helpers
  // ============================================

  /**
   * Convert local preset to unified format
   */
  private localToUnified(preset: PresetPalette): UnifiedPreset {
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      category: preset.category,
      secondaryCategories: [],
      dyes: preset.dyes,
      tags: preset.tags,
      author: preset.author,
      voteCount: 0,
      isCurated: true,
      isFromAPI: false,
    };
  }

  /**
   * Convert community preset to unified format
   */
  private communityToUnified(preset: CommunityPreset): UnifiedPreset {
    return {
      id: `community-${preset.id}`,
      name: preset.name,
      description: preset.description,
      category: preset.category_id,
      secondaryCategories: preset.secondary_categories ?? [],
      dyes: preset.dyes,
      tags: preset.tags,
      author: preset.author_name || undefined,
      voteCount: preset.vote_count,
      isCurated: preset.is_curated,
      isFromAPI: true,
      apiPresetId: preset.id,
      createdAt: preset.created_at,
      // WEB-14: API → UI boundary. The server enforces the host allowlist;
      // the read path re-checks so a server-side regression cannot put an
      // arbitrary href/src into a trusted card.
      exampleLink: sanitizeExampleLink(preset.example_link),
      previewImageUrl: sanitizePreviewImageUrl(preset.preview_image_url),
    };
  }

  // ============================================
  // Category Methods
  // ============================================

  /**
   * Get all categories with preset counts
   */
  async getCategories(): Promise<UnifiedCategory[]> {
    const localCategories = this.localPresetService.getCategories();

    // Start with local categories
    const categoryMap = new Map<PresetCategory, UnifiedCategory>();

    for (const cat of localCategories) {
      const localPresets = this.localPresetService.getPresetsByCategory(cat.id as PresetCategory);
      categoryMap.set(cat.id as PresetCategory, {
        id: cat.id as PresetCategory,
        name: cat.name,
        description: cat.description,
        icon: cat.icon || '📁',
        presetCount: localPresets.length,
        isCurated: true,
      });
    }

    // Try to get community counts if API is available
    if (this.apiAvailable) {
      try {
        const apiCategories = await this.communityService.getCategories();
        for (const apiCat of apiCategories) {
          const existing = categoryMap.get(apiCat.id as PresetCategory);
          if (existing) {
            // Add community count to existing category
            existing.presetCount += apiCat.preset_count;
          }
          // 5.0: the 'community' category value is dropped everywhere —
          // community-ness is a source, not a category (rows carry their
          // real category; the D1 migration removes the category row).
        }
      } catch (error) {
        logger.warn('HybridPresetService: Failed to fetch API categories', error);
      }
    }

    return Array.from(categoryMap.values());
  }

  // ============================================
  // Preset Methods
  // ============================================

  /**
   * Get presets with optional filtering
   * Combines local and community presets
   */
  async getPresets(options: GetPresetsOptions = {}): Promise<PresetPoolResult> {
    const { category, search, sort = 'name', includeAPI = true, limit } = options;

    let apiOk = false;
    let apiIds: string[] = [];

    // Get local presets
    let localPresets: PresetPalette[];
    if (category) {
      localPresets = this.localPresetService.getPresetsByCategory(category);
    } else if (search) {
      // Pass the dye service so a palette matches on its dye names too
      localPresets = this.localPresetService.searchPresets(search, this.dyeService);
    } else {
      localPresets = this.localPresetService.getAllPresets();
    }

    let presets = localPresets.map((p) => this.localToUnified(p));

    // Add community presets if API is available
    if (this.apiAvailable && includeAPI) {
      try {
        const filters: PresetFilters = {
          status: 'approved',
          search,
          sort,
          limit: limit || 20,
        };
        if (category) {
          filters.category = category;
        }

        const response = await this.communityService.getPresets(filters);
        const communityPresets = response.presets.map((p) => this.communityToUnified(p));
        apiOk = true;
        apiIds = communityPresets.map((p) => p.id);

        // Merge and deduplicate (prefer community version if same name)
        const existingIds = new Set(presets.map((p) => p.id));
        for (const communityPreset of communityPresets) {
          if (!existingIds.has(communityPreset.id)) {
            presets.push(communityPreset);
          }
        }
      } catch (error) {
        logger.warn('HybridPresetService: Failed to fetch API presets', error);
      }
    }

    // Apply sorting
    presets = sortPresets(presets, sort);

    // Apply limit
    if (limit && presets.length > limit) {
      presets = presets.slice(0, limit);
    }

    return { presets, apiOk, apiIds };
  }

  /**
   * Get a single preset by ID
   */
  async getPreset(id: string): Promise<UnifiedPreset | null> {
    // Check if it's a community preset
    if (id.startsWith('community-')) {
      const apiId = id.replace('community-', '');
      if (this.apiAvailable) {
        try {
          const preset = await this.communityService.getPreset(apiId);
          return preset ? this.communityToUnified(preset) : null;
        } catch {
          return null;
        }
      }
      return null;
    }

    // Try local preset first
    const localPreset = this.localPresetService.getPreset(id);
    if (localPreset) {
      return this.localToUnified(localPreset);
    }

    // Try API if available
    if (this.apiAvailable) {
      try {
        const apiPreset = await this.communityService.getPreset(id);
        return apiPreset ? this.communityToUnified(apiPreset) : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Clear API cache
   */
  clearCache(): void {
    this.communityService.clearCache();
  }
}

// Export singleton instance
export const hybridPresetService = HybridPresetService.getInstance();
