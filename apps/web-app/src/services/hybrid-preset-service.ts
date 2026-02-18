/**
 * Hybrid Preset Service
 * Provides a unified interface for both local (curated) and community presets
 * Falls back to local presets when API is unavailable
 */
/* istanbul ignore file */
import {
  PresetService,
  presetData,
  type PresetPalette,
  type PresetCategory,
  type PresetData,
  type CategoryMeta,
  type Dye,
} from '@xivdyetools/core';
import { dyeService as sharedDyeService } from './dye-service-wrapper';
import {
  CommunityPresetService,
  communityPresetService,
  type CommunityPreset,
  type PresetFilters,
} from './community-preset-service';
import { logger } from '@shared/logger';

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

/**
 * Sort options for presets
 */
export type PresetSortOption = 'popular' | 'recent' | 'name';

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

// ============================================
// Service Implementation
// ============================================

/**
 * Hybrid Preset Service
 * Singleton that provides unified access to both local and community presets
 */
export class HybridPresetService {
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
      dyes: preset.dyes,
      tags: preset.tags,
      author: preset.author_name || undefined,
      voteCount: preset.vote_count,
      isCurated: preset.is_curated,
      isFromAPI: true,
      apiPresetId: preset.id,
      createdAt: preset.created_at,
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
          } else if (apiCat.id === 'community') {
            // Add community category
            categoryMap.set('community', {
              id: 'community',
              name: apiCat.name,
              description: apiCat.description,
              icon: apiCat.icon || '🌐',
              presetCount: apiCat.preset_count,
              isCurated: false,
            });
          }
        }
      } catch (error) {
        logger.warn('HybridPresetService: Failed to fetch API categories', error);
      }
    }

    // Add community category if not present but API is available
    if (this.apiAvailable && !categoryMap.has('community')) {
      categoryMap.set('community', {
        id: 'community',
        name: 'Community',
        description: 'User-submitted color palettes',
        icon: '🌐',
        presetCount: 0,
        isCurated: false,
      });
    }

    return Array.from(categoryMap.values());
  }

  /**
   * Get category metadata
   */
  getCategoryMeta(category: PresetCategory): CategoryMeta | null {
    return this.localPresetService.getCategoryMeta(category) ?? null;
  }

  // ============================================
  // Preset Methods
  // ============================================

  /**
   * Get presets with optional filtering
   * Combines local and community presets
   */
  async getPresets(options: GetPresetsOptions = {}): Promise<UnifiedPreset[]> {
    const { category, search, sort = 'name', includeAPI = true, limit } = options;

    let presets: UnifiedPreset[] = [];

    // Handle community category specially
    if (category === 'community') {
      if (this.apiAvailable && includeAPI) {
        try {
          const response = await this.communityService.getPresets({
            status: 'approved',
            is_curated: false,
            search,
            sort,
            limit: limit || 50,
          });
          presets = response.presets.map((p) => this.communityToUnified(p));
        } catch (error) {
          logger.warn('HybridPresetService: Failed to fetch community presets', error);
        }
      }
      return presets;
    }

    // Get local presets
    let localPresets: PresetPalette[];
    if (category) {
      localPresets = this.localPresetService.getPresetsByCategory(category);
    } else if (search) {
      localPresets = this.localPresetService.searchPresets(search);
    } else {
      localPresets = this.localPresetService.getAllPresets();
    }

    presets = localPresets.map((p) => this.localToUnified(p));

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
    presets = this.sortPresets(presets, sort);

    // Apply limit
    if (limit && presets.length > limit) {
      presets = presets.slice(0, limit);
    }

    return presets;
  }

  /**
   * Get featured presets (top voted community presets)
   */
  async getFeaturedPresets(limit: number = 10): Promise<UnifiedPreset[]> {
    if (!this.apiAvailable) {
      // Fall back to random curated presets
      const allPresets = this.localPresetService.getAllPresets();
      const shuffled = [...allPresets].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, limit).map((p) => this.localToUnified(p));
    }

    try {
      const featured = await this.communityService.getFeaturedPresets();
      return featured.slice(0, limit).map((p) => this.communityToUnified(p));
    } catch (error) {
      logger.warn('HybridPresetService: Failed to fetch featured presets', error);
      // Fall back to curated
      const allPresets = this.localPresetService.getAllPresets();
      return allPresets.slice(0, limit).map((p) => this.localToUnified(p));
    }
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

  /**
   * Get random preset
   */
  async getRandomPreset(category?: PresetCategory): Promise<UnifiedPreset | null> {
    const presets = await this.getPresets({ category, includeAPI: true });
    if (presets.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * presets.length);
    return presets[randomIndex];
  }

  /**
   * Search presets
   */
  async searchPresets(query: string): Promise<UnifiedPreset[]> {
    return this.getPresets({ search: query });
  }

  // ============================================
  // Dye Resolution
  // ============================================

  /**
   * Resolve dye IDs to Dye objects
   */
  resolveDyes(dyeIds: number[]): (Dye | null)[] {
    return dyeIds.map((id) => this.dyeService.getDyeById(id));
  }

  /**
   * Get preset with resolved dyes
   */
  async getPresetWithDyes(
    id: string
  ): Promise<{ preset: UnifiedPreset; dyes: (Dye | null)[] } | null> {
    const preset = await this.getPreset(id);
    if (!preset) return null;

    const dyes = this.resolveDyes(preset.dyes);
    return { preset, dyes };
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Sort presets
   */
  private sortPresets(presets: UnifiedPreset[], sort: PresetSortOption): UnifiedPreset[] {
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

  /**
   * Clear API cache
   */
  clearCache(): void {
    this.communityService.clearCache();
  }
}

// Export singleton instance
export const hybridPresetService = HybridPresetService.getInstance();
