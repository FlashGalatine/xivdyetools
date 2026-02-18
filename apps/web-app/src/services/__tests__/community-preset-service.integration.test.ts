/**
 * Integration Tests for CommunityPresetService
 *
 * These tests use MSW to mock API responses and test the full
 * service behavior including network requests, caching, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../__tests__/mocks/server';
import { mockPresets, mockCategories } from '../../__tests__/mocks/handlers';

// Mock authService before importing the service
vi.mock('../auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(() => false),
    getAuthHeaders: vi.fn(() => ({})),
  },
}));

// Import after mocking
import { CommunityPresetService } from '../community-preset-service';
import { authService } from '../auth-service';

const API_URL = 'https://api.xivdyetools.app';

describe('CommunityPresetService Integration Tests', () => {
  let service: CommunityPresetService;

  beforeEach(() => {
    // Create a fresh instance for each test by resetting the singleton
    // @ts-expect-error - accessing private static for testing
    CommunityPresetService.instance = null;
    service = CommunityPresetService.getInstance();
  });

  afterEach(() => {
    service.clearCache();
  });

  // ============================================
  // Initialization Tests
  // ============================================

  describe('initialize', () => {
    it('should successfully initialize when API is available', async () => {
      const available = await service.initialize();

      expect(available).toBe(true);
      expect(service.isAvailable()).toBe(true);
    });

    it('should handle API unavailability gracefully', async () => {
      // Override handler to simulate network error
      server.use(
        http.get(`${API_URL}/health`, () => {
          return HttpResponse.error();
        })
      );

      const available = await service.initialize();

      expect(available).toBe(false);
      expect(service.isAvailable()).toBe(false);
    });

    it('should cache initialization state', async () => {
      await service.initialize();

      // Second call should return cached state
      const available = await service.initialize();

      expect(available).toBe(true);
    });

    it('should handle non-OK health response', async () => {
      server.use(
        http.get(`${API_URL}/health`, () => {
          return HttpResponse.json({ error: 'Maintenance' }, { status: 503 });
        })
      );

      const available = await service.initialize();

      expect(available).toBe(false);
    });
  });

  // ============================================
  // Preset Fetching Tests
  // ============================================

  describe('getPresets', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fetch presets successfully', async () => {
      const response = await service.getPresets();

      expect(response.presets).toHaveLength(mockPresets.length);
      expect(response.presets[0]).toHaveProperty('name', mockPresets[0].name);
    });

    it('should filter presets by category', async () => {
      const response = await service.getPresets({ category: 'jobs' });

      expect(response.presets.every((p) => p.category_id === 'jobs')).toBe(true);
    });

    it('should filter presets by search term', async () => {
      const response = await service.getPresets({ search: 'warrior' });

      expect(response.presets.length).toBeGreaterThan(0);
      expect(
        response.presets.every(
          (p) =>
            p.name.toLowerCase().includes('warrior') ||
            p.description.toLowerCase().includes('warrior') ||
            p.tags.some((t) => t.toLowerCase().includes('warrior'))
        )
      ).toBe(true);
    });

    it('should cache preset responses', async () => {
      // First call
      const response1 = await service.getPresets();

      // Mock a different response for second call
      server.use(
        http.get(`${API_URL}/api/v1/presets`, () => {
          return HttpResponse.json({
            presets: [],
            total: 0,
            page: 1,
            limit: 20,
            has_more: false,
          });
        })
      );

      // Second call should return cached data
      const response2 = await service.getPresets();

      expect(response2.presets).toEqual(response1.presets);
    });

    it('should handle server errors gracefully', async () => {
      server.use(
        http.get(`${API_URL}/api/v1/presets`, () => {
          return HttpResponse.json({ message: 'Internal error' }, { status: 500 });
        })
      );

      await expect(service.getPresets()).rejects.toThrow('Internal error');
    });
  });

  // ============================================
  // Featured Presets Tests
  // ============================================

  describe('getFeaturedPresets', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fetch featured presets', async () => {
      const presets = await service.getFeaturedPresets();

      expect(presets).toBeInstanceOf(Array);
      expect(presets.length).toBeGreaterThan(0);
    });

    it('should return presets sorted by vote count', async () => {
      const presets = await service.getFeaturedPresets();

      // Verify sorted by vote_count descending
      for (let i = 1; i < presets.length; i++) {
        expect(presets[i - 1].vote_count).toBeGreaterThanOrEqual(presets[i].vote_count);
      }
    });
  });

  // ============================================
  // Single Preset Tests
  // ============================================

  describe('getPreset', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fetch a single preset by ID', async () => {
      const preset = await service.getPreset('preset-1');

      expect(preset).not.toBeNull();
      expect(preset?.name).toBe(mockPresets[0].name);
    });

    it('should return null for non-existent preset', async () => {
      const preset = await service.getPreset('non-existent-id');

      expect(preset).toBeNull();
    });

    it('should cache single preset responses', async () => {
      // First call
      await service.getPreset('preset-1');

      // Override with error (cached should still work)
      server.use(
        http.get(`${API_URL}/api/v1/presets/:id`, () => {
          return HttpResponse.json({ message: 'Not found' }, { status: 404 });
        })
      );

      // Should return cached data
      const preset = await service.getPreset('preset-1');
      expect(preset).not.toBeNull();
    });
  });

  // ============================================
  // Categories Tests
  // ============================================

  describe('getCategories', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fetch categories with counts', async () => {
      const categories = await service.getCategories();

      expect(categories).toBeInstanceOf(Array);
      expect(categories.length).toBe(mockCategories.length);
      expect(categories[0]).toHaveProperty('preset_count');
    });
  });

  // ============================================
  // Voting Tests
  // ============================================

  describe('voting', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('voteForPreset', () => {
      it('should require authentication', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(false);

        const result = await service.voteForPreset('preset-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('logged in');
      });

      it('should successfully vote when authenticated', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(true);
        vi.mocked(authService.getAuthHeaders).mockReturnValue({
          Authorization: 'Bearer test-token',
        });

        const result = await service.voteForPreset('preset-1');

        expect(result.success).toBe(true);
        expect(result.new_vote_count).toBeGreaterThan(0);
      });

      it('should handle already voted scenario', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(true);
        vi.mocked(authService.getAuthHeaders).mockReturnValue({
          Authorization: 'Bearer test-token',
        });

        server.use(
          http.post(`${API_URL}/api/v1/votes/:presetId`, () => {
            return HttpResponse.json({ new_vote_count: 42, already_voted: true }, { status: 409 });
          })
        );

        const result = await service.voteForPreset('preset-1');

        expect(result.success).toBe(false);
        expect(result.already_voted).toBe(true);
      });
    });

    describe('removeVote', () => {
      it('should require authentication', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(false);

        const result = await service.removeVote('preset-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('logged in');
      });

      it('should successfully remove vote when authenticated', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(true);
        vi.mocked(authService.getAuthHeaders).mockReturnValue({
          Authorization: 'Bearer test-token',
        });

        const result = await service.removeVote('preset-1');

        expect(result.success).toBe(true);
      });
    });

    describe('hasVoted', () => {
      it('should return false when not authenticated', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(false);

        const result = await service.hasVoted('preset-1');

        expect(result.has_voted).toBe(false);
      });

      it('should check vote status when authenticated', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(true);
        vi.mocked(authService.getAuthHeaders).mockReturnValue({
          Authorization: 'Bearer test-token',
        });

        const result = await service.hasVoted('preset-1');

        expect(result).toHaveProperty('has_voted');
        expect(result).toHaveProperty('vote_count');
      });
    });
  });

  // ============================================
  // Cache Management Tests
  // ============================================

  describe('cache management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should clear all cache', async () => {
      // Populate cache
      await service.getPresets();
      await service.getCategories();

      // Clear cache
      service.clearCache();

      // Override handlers to return different data
      server.use(
        http.get(`${API_URL}/api/v1/presets`, () => {
          return HttpResponse.json({
            presets: [{ ...mockPresets[0], name: 'Modified Name' }],
            total: 1,
            page: 1,
            limit: 20,
            has_more: false,
          });
        })
      );

      // Should fetch fresh data
      const response = await service.getPresets();
      expect(response.presets[0].name).toBe('Modified Name');
    });

    it('should invalidate preset-related cache', async () => {
      // Populate cache
      await service.getFeaturedPresets();

      // Invalidate
      service.invalidatePresets();

      // Override handler
      server.use(
        http.get(`${API_URL}/api/v1/presets/featured`, () => {
          return HttpResponse.json({ presets: [] });
        })
      );

      // Should fetch fresh data
      const presets = await service.getFeaturedPresets();
      expect(presets).toEqual([]);
    });
  });

  // ============================================
  // Timeout Tests
  // ============================================

  describe('timeout handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle request timeout', async () => {
      server.use(
        http.get(`${API_URL}/api/v1/presets`, async () => {
          // Delay longer than timeout
          await new Promise((resolve) => setTimeout(resolve, 15000));
          return HttpResponse.json({ presets: [] });
        })
      );

      // This should timeout and throw
      await expect(service.getPresets()).rejects.toThrow('timeout');
    }, 20000);
  });
});
