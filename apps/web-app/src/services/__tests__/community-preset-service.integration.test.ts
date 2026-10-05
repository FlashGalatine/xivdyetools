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
        expect(result.errorCode).toBe('notLoggedIn');
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
        expect(result.errorCode).toBe('alreadyVoted');
      });
    });

    describe('removeVote', () => {
      it('should require authentication', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(false);

        const result = await service.removeVote('preset-1');

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('notLoggedIn');
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

      // BUG-108 (2026-10-04 deep-dive): a failed check used to answer
      // `vote_count: 0`, and preset-detail applies any vote_count that is not
      // undefined — so a 429/500 on /check turned a 12-vote badge into "Vote · 0".
      // A failure has no count to report, so it reports none.
      it('reports no vote_count when the check fails (BUG-108)', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(true);
        server.use(
          http.get(`${API_URL}/api/v1/votes/:presetId/check`, () =>
            HttpResponse.json({ message: 'Too many requests' }, { status: 429 })
          )
        );

        const result = await service.hasVoted('preset-1');

        expect(result.has_voted).toBe(false);
        expect(result.vote_count).toBeUndefined();
      });

      it('reports no vote_count when the check cannot reach the API (BUG-108)', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(true);
        server.use(http.get(`${API_URL}/api/v1/votes/:presetId/check`, () => HttpResponse.error()));

        const result = await service.hasVoted('preset-1');

        expect(result.vote_count).toBeUndefined();
      });

      it('reports no vote_count when signed out (BUG-108)', async () => {
        vi.mocked(authService.isAuthenticated).mockReturnValue(false);

        const result = await service.hasVoted('preset-1');

        expect(result.vote_count).toBeUndefined();
      });
    });
  });

  // BUG-031 (2026-10-04 deep-dive): a vote changes the count every cached list
  // carries, but only the `preset:<id>` / `vote:<id>` keys were dropped — the
  // next load with the same query got the pre-vote list back for 5 minutes.
  describe('vote invalidates the cached preset lists (BUG-031)', () => {
    beforeEach(async () => {
      await service.initialize();
      vi.mocked(authService.isAuthenticated).mockReturnValue(true);
      vi.mocked(authService.getAuthHeaders).mockReturnValue({
        Authorization: 'Bearer test-token',
      });
    });

    function serveRenamedList(): void {
      server.use(
        http.get(`${API_URL}/api/v1/presets`, () =>
          HttpResponse.json({
            presets: [{ ...mockPresets[0], name: 'After The Vote' }],
            total: 1,
            page: 1,
            limit: 20,
            has_more: false,
          })
        )
      );
    }

    it('refetches the list after a vote is added', async () => {
      await service.getPresets({ sort: 'popular' });
      serveRenamedList();

      await service.voteForPreset('preset-1');

      const after = await service.getPresets({ sort: 'popular' });
      expect(after.presets[0].name).toBe('After The Vote');
    });

    it('refetches the list after a vote is removed', async () => {
      await service.getPresets({ sort: 'popular' });
      serveRenamedList();

      await service.removeVote('preset-1');

      const after = await service.getPresets({ sort: 'popular' });
      expect(after.presets[0].name).toBe('After The Vote');
    });

    it('keeps the cached list when the vote fails', async () => {
      const before = await service.getPresets({ sort: 'popular' });
      serveRenamedList();
      server.use(
        http.post(`${API_URL}/api/v1/votes/:presetId`, () =>
          HttpResponse.json({ message: 'Internal error' }, { status: 500 })
        )
      );

      await service.voteForPreset('preset-1');

      const after = await service.getPresets({ sort: 'popular' });
      expect(after.presets).toEqual(before.presets);
    });
  });

  // BUG-031 review follow-up: a list request already in flight when the cache
  // is invalidated used to write its pre-change answer back into the cache,
  // where the next load with the same query found it for up to 5 minutes.
  describe('a list request in flight across an invalidation (BUG-031)', () => {
    function listOf(name: string) {
      return {
        presets: [{ ...mockPresets[0], name }],
        total: 1,
        page: 1,
        limit: 20,
        has_more: false,
      };
    }

    /** Serve one list behind a gate; `arrived` settles once the request is in. */
    function holdList(name: string): { arrived: Promise<void>; release: () => void } {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let reached!: () => void;
      const arrived = new Promise<void>((resolve) => (reached = resolve));
      server.use(
        http.get(`${API_URL}/api/v1/presets`, async () => {
          reached();
          await gate;
          return HttpResponse.json(listOf(name));
        })
      );
      return { arrived, release };
    }

    function serveList(name: string): void {
      server.use(http.get(`${API_URL}/api/v1/presets`, () => HttpResponse.json(listOf(name))));
    }

    it.each([
      ['invalidatePresets()', (s: CommunityPresetService) => s.invalidatePresets('preset-1')],
      ['clearCache()', (s: CommunityPresetService) => s.clearCache()],
    ])('does not cache an answer that straddles %s', async (_label, invalidate) => {
      const held = holdList('Before The Change');
      const inFlight = service.getPresets({ sort: 'popular' });
      await held.arrived;

      invalidate(service);
      held.release();
      await inFlight;

      serveList('After The Change');
      const next = await service.getPresets({ sort: 'popular' });
      expect(next.presets[0].name).toBe('After The Change');
    });

    it('still caches an answer no invalidation overlapped', async () => {
      const held = holdList('Cached');
      const inFlight = service.getPresets({ sort: 'popular' });
      await held.arrived;
      held.release();
      await inFlight;

      serveList('Not Fetched');
      const next = await service.getPresets({ sort: 'popular' });
      expect(next.presets[0].name).toBe('Cached');
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

  // ============================================
  // API origin + path encoding (2026-08-21 security audit)
  // ============================================

  describe('API origin and path encoding', () => {
    const jsonResponse = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    afterEach(() => {
      delete (window as unknown as { PRESET_API_URL?: string }).PRESET_API_URL;
    });

    // FINDING-032 / WEB-4: a `window.PRESET_API_URL` global could be defined by
    // DOM clobbering (`<a id="PRESET_API_URL" href="https://evil.workers.dev/">`)
    // and would redirect bearer-token requests. The origin is build-time only.
    it('ignores a window.PRESET_API_URL global and keeps the build-time API origin', async () => {
      (window as unknown as { PRESET_API_URL?: string }).PRESET_API_URL =
        'https://evil.workers.dev';
      // @ts-expect-error - accessing private static for testing
      CommunityPresetService.instance = null;
      const clobbered = CommunityPresetService.getInstance();

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse({ id: 'preset-1' }));

      await clobbered.getPreset('preset-1');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0][0])).toBe(`${API_URL}/api/v1/presets/preset-1`);
      fetchSpy.mockRestore();
    });

    // FINDING-020 / WEB-11: ids come from the API and the URL path today, but a
    // path segment is a path segment — encode it.
    it('percent-encodes the preset id in the preset path', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));

      await service.getPreset('a/b?c=d#e');

      expect(String(fetchSpy.mock.calls[0][0])).toBe(`${API_URL}/api/v1/presets/a%2Fb%3Fc%3Dd%23e`);
      fetchSpy.mockRestore();
    });

    it('percent-encodes the preset id in the vote paths', async () => {
      vi.mocked(authService.isAuthenticated).mockReturnValue(true);
      vi.mocked(authService.getAuthHeaders).mockReturnValue({
        Authorization: 'Bearer test-token',
      });
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () =>
          jsonResponse({ success: true, new_vote_count: 1, has_voted: true, vote_count: 1 })
        );

      await service.voteForPreset('a/b');
      await service.removeVote('a/b');
      await service.hasVoted('a/b');

      expect(fetchSpy.mock.calls.map((call) => String(call[0]))).toEqual([
        `${API_URL}/api/v1/votes/a%2Fb`,
        `${API_URL}/api/v1/votes/a%2Fb`,
        `${API_URL}/api/v1/votes/a%2Fb/check`,
      ]);
      fetchSpy.mockRestore();
    });
  });

  // BUG-062: `getPreset()` promised `null` for a missing preset but recovered
  // "not found" by testing whether the error MESSAGE contained '404'. It never
  // did: presets-api answers a missing preset with
  // `{ success: false, error: 'NOT_FOUND', message: 'Preset not found' }`
  // (handlers/presets.ts:1058), so `errorData.message` wins and the
  // `API request failed: 404` fallback only fires for a bodyless error. Every
  // caller of getPreset() got a throw where it expected a null.
  describe('missing preset (BUG-062)', () => {
    it('returns null for the 404 body presets-api actually sends', async () => {
      server.use(
        http.get(`${API_URL}/api/v1/presets/:id`, () =>
          HttpResponse.json(
            { success: false, error: 'NOT_FOUND', message: 'Preset not found' },
            { status: 404 }
          )
        )
      );

      await expect(service.getPreset('no-such-preset')).resolves.toBeNull();
    });

    it('still returns null when the 404 carries no body at all', async () => {
      server.use(
        http.get(`${API_URL}/api/v1/presets/:id`, () => new HttpResponse(null, { status: 404 }))
      );

      await expect(service.getPreset('no-such-preset')).resolves.toBeNull();
    });

    it('still throws for a non-404 error, rather than swallowing it as null', async () => {
      server.use(
        http.get(`${API_URL}/api/v1/presets/:id`, () =>
          HttpResponse.json(
            { success: false, error: 'INTERNAL_ERROR', message: 'Database unavailable' },
            { status: 500 }
          )
        )
      );

      await expect(service.getPreset('some-preset')).rejects.toThrow('Database unavailable');
    });

    it('does not mistake a 404-like message on a successful status for not-found', async () => {
      // The old substring check would have matched a preset legitimately named
      // "Error 404 Tribute" if it ever surfaced in an error message.
      server.use(
        http.get(`${API_URL}/api/v1/presets/:id`, () =>
          HttpResponse.json(
            { success: false, error: 'FORBIDDEN', message: 'Preset 404 Tribute is private' },
            { status: 403 }
          )
        )
      );

      await expect(service.getPreset('p1')).rejects.toThrow(/404 Tribute/);
    });
  });
});
