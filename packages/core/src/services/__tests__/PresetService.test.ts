/**
 * PresetService tests
 *
 * Tests for the PresetService which manages preset color palettes.
 * Covers all methods including category operations, search, random selection,
 * and dye resolution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresetService } from '../PresetService.js';
import type { PresetData, PresetPalette, Dye } from '../../types/index.js';

// Mock preset data for testing
const mockPresetData: PresetData = {
  version: '1.0.0',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  categories: {
    jobs: {
      name: 'FFXIV Jobs',
      description: 'Color schemes inspired by job identities',
      icon: '⚔️',
    },
    'grand-companies': {
      name: 'Grand Companies',
      description: 'Official Grand Company colors',
      icon: '🏛️',
    },
    seasons: {
      name: 'Seasons',
      description: 'Seasonal color palettes',
      icon: '🍂',
    },
    events: {
      name: 'FFXIV Events',
      description: 'Colors for in-game seasonal events',
      icon: '🎉',
    },
    aesthetics: {
      name: 'Aesthetics',
      description: 'General aesthetic themes',
      icon: '🎨',
    },
    community: {
      name: 'Community',
      description: 'Community-submitted palettes',
      icon: '👥',
    },
  },
  palettes: [
    {
      id: 'job-rdm',
      name: 'Red Mage',
      category: 'jobs',
      description: 'The crimson elegance of the Red Mage',
      dyes: [5738, 13115, 13117, 5729],
      tags: ['red mage', 'rdm', 'caster', 'melee', 'crimson'],
    },
    {
      id: 'job-blm',
      name: 'Black Mage',
      category: 'jobs',
      description: 'Dark arcane power',
      dyes: [5813, 13115, 13117],
      tags: ['black mage', 'blm', 'caster', 'magic', 'dark'],
    },
    {
      id: 'job-whm',
      name: 'White Mage',
      category: 'jobs',
      description: 'Pure healing light',
      dyes: [5729, 5785, 5746],
      tags: ['white mage', 'whm', 'healer', 'pure', 'nature'],
    },
    {
      id: 'job-pld',
      name: 'Paladin',
      category: 'jobs',
      description: 'Noble defender of the realm',
      dyes: [5801, 13116, 5729],
      tags: ['paladin', 'pld', 'tank', 'holy', 'knight'],
    },
    {
      id: 'gc-maelstrom',
      name: 'The Maelstrom',
      category: 'grand-companies',
      description: 'Storm-born naval power',
      dyes: [5738, 5813, 5729],
      tags: ['maelstrom', 'limsa', 'red', 'navy'],
    },
    {
      id: 'gc-adders',
      name: 'Twin Adder',
      category: 'grand-companies',
      description: 'Forest guardians of Gridania',
      dyes: [5785, 5746, 5729],
      tags: ['twin adder', 'gridania', 'yellow', 'forest'],
    },
    {
      id: 'season-autumn',
      name: 'Autumn Harvest',
      category: 'seasons',
      description: 'Warm fall colors',
      dyes: [5740, 5785, 5746],
      tags: ['autumn', 'fall', 'harvest', 'warm', 'orange'],
    },
    {
      id: 'event-starlight',
      name: 'Starlight Celebration',
      category: 'events',
      description: 'Holiday cheer',
      dyes: [5738, 5729, 5785],
      tags: ['starlight', 'christmas', 'holiday', 'festive'],
    },
    {
      id: 'aesthetic-cottagecore',
      name: 'Cottagecore',
      category: 'aesthetics',
      description: 'Pastoral and cozy',
      dyes: [5746, 5785, 5729],
      tags: ['cottagecore', 'cozy', 'pastoral', 'nature'],
    },
    {
      id: 'community-darkelegance',
      name: 'Dark Elegance',
      category: 'community',
      description: 'Community favorite dark theme',
      dyes: [5813, 13115, 5730],
      tags: ['dark', 'elegant', 'gothic'],
      author: 'TestUser',
    },
  ],
};

// Mock DyeService interface
const createMockDyeService = () => ({
  getDyeById: vi.fn((id: number): Dye | null => {
    const mockDyes: Record<number, Dye> = {
      5729: {
        itemID: 5729,
        id: 1,
        name: 'Snow White',
        hex: '#ECECEC',
        rgb: { r: 236, g: 236, b: 236 },
        hsv: { h: 0, s: 0, v: 92 },
        category: 'Whites',
        acquisition: 'Dye Vendor',
        cost: 334,
        isMetallic: false,
        isPastel: false,
        isDark: false,
        isCosmic: false,
      },
      5738: {
        itemID: 5738,
        id: 10,
        name: 'Wine Red',
        hex: '#8B4051',
        rgb: { r: 139, g: 64, b: 81 },
        hsv: { h: 346, s: 54, v: 55 },
        category: 'Reds',
        acquisition: 'Dye Vendor',
        cost: 334,
        isMetallic: false,
        isPastel: false,
        isDark: false,
        isCosmic: false,
      },
      13115: {
        itemID: 13115,
        id: 101,
        name: 'Metallic Red',
        hex: '#B34D4D',
        rgb: { r: 179, g: 77, b: 77 },
        hsv: { h: 0, s: 57, v: 70 },
        category: 'Metallics',
        acquisition: 'Beast Tribes',
        cost: 0,
        isMetallic: true,
        isPastel: false,
        isDark: false,
        isCosmic: false,
      },
      13117: {
        itemID: 13117,
        id: 103,
        name: 'Metallic Gold',
        hex: '#B39C4D',
        rgb: { r: 179, g: 156, b: 77 },
        hsv: { h: 47, s: 57, v: 70 },
        category: 'Metallics',
        acquisition: 'Beast Tribes',
        cost: 0,
        isMetallic: true,
        isPastel: false,
        isDark: false,
        isCosmic: false,
      },
    };
    return mockDyes[id] || null;
  }),
});

describe('PresetService', () => {
  let presetService: PresetService;

  beforeEach(() => {
    presetService = new PresetService(mockPresetData);
  });

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor', () => {
    it('should initialize with preset data', () => {
      expect(presetService.getPresetCount()).toBe(10);
    });

    it('should build internal lookup map for O(1) access', () => {
      // Verify quick lookup works
      const preset = presetService.getPreset('job-rdm');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('Red Mage');
    });

    it('should handle empty palettes array', () => {
      const emptyData: PresetData = {
        ...mockPresetData,
        palettes: [],
      };
      const emptyService = new PresetService(emptyData);
      expect(emptyService.getPresetCount()).toBe(0);
    });
  });

  // ============================================================================
  // Category Operations
  // ============================================================================

  describe('getCategories', () => {
    it('should return all categories with metadata', () => {
      const categories = presetService.getCategories();
      expect(categories).toHaveLength(6);
    });

    it('should include category ID in returned objects', () => {
      const categories = presetService.getCategories();
      const jobsCategory = categories.find((c) => c.id === 'jobs');
      expect(jobsCategory).toBeDefined();
      expect(jobsCategory?.name).toBe('FFXIV Jobs');
    });

    it('should include all category metadata fields', () => {
      const categories = presetService.getCategories();
      const jobsCategory = categories.find((c) => c.id === 'jobs');

      expect(jobsCategory).toMatchObject({
        id: 'jobs',
        name: 'FFXIV Jobs',
        description: 'Color schemes inspired by job identities',
        icon: '⚔️',
      });
    });

    it('should return categories in consistent order', () => {
      const categories1 = presetService.getCategories();
      const categories2 = presetService.getCategories();

      expect(categories1.map((c) => c.id)).toEqual(categories2.map((c) => c.id));
    });
  });

  describe('getCategoryMeta', () => {
    it('should return metadata for valid category', () => {
      const meta = presetService.getCategoryMeta('jobs');
      expect(meta).toBeDefined();
      expect(meta?.name).toBe('FFXIV Jobs');
      expect(meta?.description).toBe('Color schemes inspired by job identities');
    });

    it('should return undefined for invalid category', () => {
      const meta = presetService.getCategoryMeta('invalid' as any);
      expect(meta).toBeUndefined();
    });

    it('should return metadata for all valid categories', () => {
      const validCategories = [
        'jobs',
        'grand-companies',
        'seasons',
        'events',
        'aesthetics',
        'community',
      ] as const;

      validCategories.forEach((category) => {
        const meta = presetService.getCategoryMeta(category);
        expect(meta).toBeDefined();
        expect(meta?.name).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Preset Retrieval
  // ============================================================================

  describe('getAllPresets', () => {
    it('should return all presets', () => {
      const presets = presetService.getAllPresets();
      expect(presets).toHaveLength(10);
    });

    it('should return a copy of presets (not the original array)', () => {
      const presets1 = presetService.getAllPresets();
      const presets2 = presetService.getAllPresets();

      expect(presets1).not.toBe(presets2);
      expect(presets1).toEqual(presets2);
    });

    it('should include all preset properties', () => {
      const presets = presetService.getAllPresets();
      const rdm = presets.find((p) => p.id === 'job-rdm');

      expect(rdm).toMatchObject({
        id: 'job-rdm',
        name: 'Red Mage',
        category: 'jobs',
        description: 'The crimson elegance of the Red Mage',
        dyes: [5738, 13115, 13117, 5729],
        tags: ['red mage', 'rdm', 'caster', 'melee', 'crimson'],
      });
    });
  });

  describe('getPresetsByCategory', () => {
    it('should return all presets in a category', () => {
      const jobPresets = presetService.getPresetsByCategory('jobs');
      expect(jobPresets).toHaveLength(4);
    });

    it('should only include presets from specified category', () => {
      const jobPresets = presetService.getPresetsByCategory('jobs');
      jobPresets.forEach((preset) => {
        expect(preset.category).toBe('jobs');
      });
    });

    it('should return empty array for category with no presets', () => {
      const emptyData: PresetData = {
        ...mockPresetData,
        palettes: mockPresetData.palettes.filter((p) => p.category !== 'community'),
      };
      const service = new PresetService(emptyData);
      const communityPresets = service.getPresetsByCategory('community');
      expect(communityPresets).toHaveLength(0);
    });

    it('should handle grand-companies category', () => {
      const gcPresets = presetService.getPresetsByCategory('grand-companies');
      expect(gcPresets).toHaveLength(2);
      expect(gcPresets.map((p) => p.id)).toContain('gc-maelstrom');
      expect(gcPresets.map((p) => p.id)).toContain('gc-adders');
    });
  });

  describe('getPreset', () => {
    it('should return preset by ID', () => {
      const preset = presetService.getPreset('job-rdm');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('Red Mage');
    });

    it('should return undefined for non-existent ID', () => {
      const preset = presetService.getPreset('non-existent-id');
      expect(preset).toBeUndefined();
    });

    it('should return preset with all fields', () => {
      const preset = presetService.getPreset('community-darkelegance');
      expect(preset).toBeDefined();
      expect(preset?.author).toBe('TestUser');
    });

    it('should be case-sensitive', () => {
      const lower = presetService.getPreset('job-rdm');
      const upper = presetService.getPreset('JOB-RDM');

      expect(lower).toBeDefined();
      expect(upper).toBeUndefined();
    });
  });

  describe('getPresetCountByCategory', () => {
    it('should return counts for all categories', () => {
      const counts = presetService.getPresetCountByCategory();

      expect(counts.get('jobs')).toBe(4);
      expect(counts.get('grand-companies')).toBe(2);
      expect(counts.get('seasons')).toBe(1);
      expect(counts.get('events')).toBe(1);
      expect(counts.get('aesthetics')).toBe(1);
      expect(counts.get('community')).toBe(1);
    });

    it('should return a Map object', () => {
      const counts = presetService.getPresetCountByCategory();
      expect(counts).toBeInstanceOf(Map);
    });

    it('should handle empty data', () => {
      const emptyData: PresetData = {
        ...mockPresetData,
        palettes: [],
      };
      const emptyService = new PresetService(emptyData);
      const counts = emptyService.getPresetCountByCategory();

      expect(counts.size).toBe(0);
    });
  });

  // ============================================================================
  // Search Operations
  // ============================================================================

  describe('searchPresets', () => {
    it('should search by name (case-insensitive)', () => {
      const results = presetService.searchPresets('red');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((p) => p.name === 'Red Mage')).toBe(true);
    });

    it('should search by description', () => {
      const results = presetService.searchPresets('crimson');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('job-rdm');
    });

    it('should search by tags', () => {
      const results = presetService.searchPresets('tank');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((p) => p.id === 'job-pld')).toBe(true);
    });

    it('should return empty array for empty query', () => {
      const results = presetService.searchPresets('');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for whitespace-only query', () => {
      const results = presetService.searchPresets('   ');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for no matches', () => {
      const results = presetService.searchPresets('xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should find multiple matches', () => {
      const results = presetService.searchPresets('mage');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((p) => p.name === 'Red Mage')).toBe(true);
      expect(results.some((p) => p.name === 'Black Mage')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lowerResults = presetService.searchPresets('paladin');
      const upperResults = presetService.searchPresets('PALADIN');
      const mixedResults = presetService.searchPresets('PaLaDiN');

      expect(lowerResults).toHaveLength(upperResults.length);
      expect(lowerResults).toHaveLength(mixedResults.length);
    });

    it('should match partial strings', () => {
      const results = presetService.searchPresets('white');
      expect(results.some((p) => p.name === 'White Mage')).toBe(true);
    });
  });

  describe('getPresetsByTag', () => {
    it('should find presets by exact tag match', () => {
      const results = presetService.getPresetsByTag('tank');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should be case-insensitive', () => {
      const lowerResults = presetService.getPresetsByTag('tank');
      const upperResults = presetService.getPresetsByTag('TANK');

      expect(lowerResults.length).toBe(upperResults.length);
    });

    it('should return empty array for non-existent tag', () => {
      const results = presetService.getPresetsByTag('nonexistenttag');
      expect(results).toHaveLength(0);
    });

    it('should handle whitespace in query', () => {
      const results = presetService.getPresetsByTag('  tank  ');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should find presets with multi-word tags', () => {
      const results = presetService.getPresetsByTag('red mage');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('job-rdm');
    });

    it('should return empty for partial tag matches', () => {
      // 'tan' should not match 'tank' in exact tag search
      const results = presetService.getPresetsByTag('tan');
      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // Random Selection
  // ============================================================================

  describe('getRandomPreset', () => {
    it('should return a random preset', () => {
      const preset = presetService.getRandomPreset();
      expect(preset).toBeDefined();
      expect(preset?.id).toBeDefined();
    });

    it('should return preset from specified category', () => {
      const preset = presetService.getRandomPreset('jobs');
      expect(preset).toBeDefined();
      expect(preset?.category).toBe('jobs');
    });

    it('should return undefined for empty pool', () => {
      const emptyData: PresetData = {
        ...mockPresetData,
        palettes: [],
      };
      const emptyService = new PresetService(emptyData);
      const preset = emptyService.getRandomPreset();
      expect(preset).toBeUndefined();
    });

    it('should return undefined for category with no presets', () => {
      const noSeasonData: PresetData = {
        ...mockPresetData,
        palettes: mockPresetData.palettes.filter((p) => p.category !== 'seasons'),
      };
      const service = new PresetService(noSeasonData);
      const preset = service.getRandomPreset('seasons');
      expect(preset).toBeUndefined();
    });

    it('should return presets from full pool when no category specified', () => {
      // Run multiple times to verify randomness across all categories
      const presets = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const preset = presetService.getRandomPreset();
        if (preset) {
          presets.add(preset.category);
        }
      }
      // Should hit multiple categories
      expect(presets.size).toBeGreaterThan(1);
    });
  });

  // ============================================================================
  // Dye Resolution
  // ============================================================================

  describe('getPresetWithDyes', () => {
    it('should resolve preset with dye objects', () => {
      const mockDyeService = createMockDyeService();
      const resolved = presetService.getPresetWithDyes('job-rdm', mockDyeService);

      expect(resolved).toBeDefined();
      expect(resolved?.resolvedDyes).toHaveLength(4);
    });

    it('should return undefined for non-existent preset', () => {
      const mockDyeService = createMockDyeService();
      const resolved = presetService.getPresetWithDyes('non-existent', mockDyeService);

      expect(resolved).toBeUndefined();
    });

    it('should include null for unresolved dye IDs', () => {
      const mockDyeService = createMockDyeService();
      const resolved = presetService.getPresetWithDyes('job-rdm', mockDyeService);

      // Our mock only has some dyes, so some should resolve, some may be null
      expect(resolved?.resolvedDyes).toBeDefined();
      // At least some should resolve
      expect(resolved?.resolvedDyes.some((d) => d !== null)).toBe(true);
    });

    it('should call getDyeById for each dye in preset', () => {
      const mockDyeService = createMockDyeService();
      presetService.getPresetWithDyes('job-rdm', mockDyeService);

      // job-rdm has 4 dyes
      expect(mockDyeService.getDyeById).toHaveBeenCalledTimes(4);
    });

    it('should preserve all original preset properties', () => {
      const mockDyeService = createMockDyeService();
      const resolved = presetService.getPresetWithDyes('job-rdm', mockDyeService);

      expect(resolved?.id).toBe('job-rdm');
      expect(resolved?.name).toBe('Red Mage');
      expect(resolved?.category).toBe('jobs');
      expect(resolved?.description).toBe('The crimson elegance of the Red Mage');
      expect(resolved?.tags).toEqual(['red mage', 'rdm', 'caster', 'melee', 'crimson']);
    });
  });

  describe('resolvePresets', () => {
    it('should resolve multiple presets', () => {
      const mockDyeService = createMockDyeService();
      const presets = [presetService.getPreset('job-rdm')!, presetService.getPreset('job-blm')!];
      const resolved = presetService.resolvePresets(presets, mockDyeService);

      expect(resolved).toHaveLength(2);
      expect(resolved[0].resolvedDyes).toBeDefined();
      expect(resolved[1].resolvedDyes).toBeDefined();
    });

    it('should return empty array for empty input', () => {
      const mockDyeService = createMockDyeService();
      const resolved = presetService.resolvePresets([], mockDyeService);

      expect(resolved).toHaveLength(0);
    });

    it('should preserve order of presets', () => {
      const mockDyeService = createMockDyeService();
      const presets = [presetService.getPreset('job-blm')!, presetService.getPreset('job-rdm')!];
      const resolved = presetService.resolvePresets(presets, mockDyeService);

      expect(resolved[0].id).toBe('job-blm');
      expect(resolved[1].id).toBe('job-rdm');
    });

    it('should handle presets with different dye counts', () => {
      const mockDyeService = createMockDyeService();
      // job-rdm has 4 dyes, job-blm has 3 dyes
      const presets = [presetService.getPreset('job-rdm')!, presetService.getPreset('job-blm')!];
      const resolved = presetService.resolvePresets(presets, mockDyeService);

      expect(resolved[0].resolvedDyes).toHaveLength(4);
      expect(resolved[1].resolvedDyes).toHaveLength(3);
    });
  });

  // ============================================================================
  // Metadata
  // ============================================================================

  describe('getVersion', () => {
    it('should return version string', () => {
      const version = presetService.getVersion();
      expect(version).toBe('1.0.0');
    });

    it('should return exact version from data', () => {
      const customData: PresetData = {
        ...mockPresetData,
        version: '2.5.0',
      };
      const service = new PresetService(customData);
      expect(service.getVersion()).toBe('2.5.0');
    });
  });

  describe('getLastUpdated', () => {
    it('should return last updated timestamp', () => {
      const lastUpdated = presetService.getLastUpdated();
      expect(lastUpdated).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should return exact timestamp from data', () => {
      const customData: PresetData = {
        ...mockPresetData,
        lastUpdated: '2025-06-15T12:00:00.000Z',
      };
      const service = new PresetService(customData);
      expect(service.getLastUpdated()).toBe('2025-06-15T12:00:00.000Z');
    });
  });

  describe('getPresetCount', () => {
    it('should return total number of presets', () => {
      expect(presetService.getPresetCount()).toBe(10);
    });

    it('should return 0 for empty data', () => {
      const emptyData: PresetData = {
        ...mockPresetData,
        palettes: [],
      };
      const emptyService = new PresetService(emptyData);
      expect(emptyService.getPresetCount()).toBe(0);
    });

    it('should match length of getAllPresets', () => {
      const count = presetService.getPresetCount();
      const allPresets = presetService.getAllPresets();
      expect(count).toBe(allPresets.length);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle preset with minimal data', () => {
      const minimalData: PresetData = {
        version: '1.0.0',
        lastUpdated: '2025-01-01',
        categories: {
          jobs: { name: 'Jobs', description: 'Test' },
          'grand-companies': { name: 'GC', description: 'Test' },
          seasons: { name: 'Seasons', description: 'Test' },
          events: { name: 'Events', description: 'Test' },
          aesthetics: { name: 'Aesthetics', description: 'Test' },
          community: { name: 'Community', description: 'Test' },
        },
        palettes: [
          {
            id: 'test',
            name: 'Test',
            category: 'jobs',
            description: 'Test preset',
            dyes: [5729],
            tags: [],
          },
        ],
      };
      const service = new PresetService(minimalData);
      expect(service.getPresetCount()).toBe(1);
      expect(service.getPreset('test')).toBeDefined();
    });

    it('should handle preset with empty tags array', () => {
      const preset = presetService.searchPresets('test');
      // Should not throw with empty tags
      expect(Array.isArray(preset)).toBe(true);
    });

    it('should handle special characters in search', () => {
      const results = presetService.searchPresets('!@#$%');
      expect(results).toHaveLength(0);
    });

    it('should handle unicode characters in search', () => {
      const results = presetService.searchPresets('日本語');
      expect(results).toHaveLength(0);
    });
  });
});
