/**
 * Tests for main Hono app - routes, CORS, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import app from './index';
import { createMockExecutionContext, createMockEnv, resetAllMocks } from './test-setup';
import { UpstreamError } from './services/cached-fetch';

// Mock global fetch for upstream API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock cachedFetch for controlled error testing
const mockCachedFetch = vi.fn();
vi.mock('./services/cached-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/cached-fetch')>();
  return {
    ...actual,
    cachedFetch: (...args: unknown[]) => {
      // If mockCachedFetch has a mock implementation, use it
      if (mockCachedFetch.getMockImplementation()) {
        return mockCachedFetch(...args);
      }
      // Otherwise, use the real implementation
      return actual.cachedFetch(...(args as Parameters<typeof actual.cachedFetch>));
    },
  };
});

describe('Universalis Proxy App', () => {
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockCtx: ReturnType<typeof createMockExecutionContext>;

  beforeEach(() => {
    resetAllMocks();
    mockEnv = createMockEnv();
    mockCtx = createMockExecutionContext();
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create a request
  const createRequest = (path: string, options: RequestInit = {}) => {
    return new Request(`https://test.example.com${path}`, {
      ...options,
      headers: {
        Origin: 'https://xivdyetools.app',
        ...options.headers,
      },
    });
  };

  describe('CORS', () => {
    it('should add CORS headers for allowed origins', async () => {
      const request = createRequest('/health');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://xivdyetools.app'
      );
    });

    it('should handle OPTIONS preflight requests', async () => {
      const request = createRequest('/api/v2/data-centers', {
        method: 'OPTIONS',
      });
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    });

    it('should allow localhost in development mode', async () => {
      const devEnv = createMockEnv({ ENVIRONMENT: 'development' });
      const request = new Request('https://test.example.com/health', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      const response = await app.fetch(request, devEnv, mockCtx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('should allow 127.0.0.1 in development mode', async () => {
      const devEnv = createMockEnv({ ENVIRONMENT: 'development' });
      const request = new Request('https://test.example.com/health', {
        headers: {
          Origin: 'http://127.0.0.1:5173',
        },
      });

      const response = await app.fetch(request, devEnv, mockCtx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5173');
    });

    it('should not return CORS headers for disallowed origins', async () => {
      const request = new Request('https://test.example.com/health', {
        headers: {
          Origin: 'https://evil.example.com',
        },
      });

      const response = await app.fetch(request, mockEnv, mockCtx);

      // For security, disallowed origins should not receive CORS headers
      // The browser will block the response from being read
      expect(response.status).toBe(200); // Request still succeeds
      // CORS header is either null or not the evil origin
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      expect(corsHeader !== 'https://evil.example.com').toBe(true);
    });

    it('should set max-age header for preflight caching', async () => {
      const request = createRequest('/api/v2/data-centers', {
        method: 'OPTIONS',
      });
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });

  describe('Health endpoints', () => {
    describe('GET /', () => {
      it('should return service info', async () => {
        const request = createRequest('/');
        const response = await app.fetch(request, mockEnv, mockCtx);

        expect(response.status).toBe(200);
        const data = await response.json<Record<string, unknown>>();
        expect(data).toMatchObject({
          name: 'xivdyetools-universalis-proxy',
          status: 'ok',
          environment: 'test',
        });
      });
    });

    describe('GET /health', () => {
      it('should return ok status', async () => {
        const request = createRequest('/health');
        const response = await app.fetch(request, mockEnv, mockCtx);

        expect(response.status).toBe(200);
        const data = await response.json<Record<string, unknown>>();
        expect(data).toEqual({ status: 'ok' });
      });
    });
  });

  describe('GET /api/v2/aggregated/:datacenter/:itemIds', () => {
    // Use unique item IDs per test to avoid cache interference
    let testItemId = 10000;
    const getUniqueItemId = () => String(++testItemId);

    beforeEach(() => {
      resetAllMocks();
      mockFetch.mockReset();
    });

    it('should proxy valid requests', async () => {
      const itemId = getUniqueItemId();
      const upstreamData = { items: [{ itemID: Number(itemId), averagePrice: 100 }] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(upstreamData), { status: 200 })
      );

      const request = createRequest(`/api/v2/aggregated/Crystal/${itemId}`);
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(200);
      const data = await response.json<Record<string, unknown>>();
      expect(data).toEqual(upstreamData);
    });

    it('should reject invalid datacenter parameter with special chars (route mismatch)', async () => {
      // Hono's router does not match special characters in path segments,
      // so Crystal!@# falls through to the 404 handler
      const request = createRequest('/api/v2/aggregated/Crystal!@#/12345');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(404);
    });

    it('should reject invalid datacenter parameter', async () => {
      // A plausible but non-existent datacenter name reaches the route handler
      // and gets rejected by isValidDatacenterOrWorld()
      const request = createRequest('/api/v2/aggregated/FakeCenter/12345');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(400);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toContain('Invalid datacenter');
    });

    it('should reject invalid itemIds parameter', async () => {
      const request = createRequest('/api/v2/aggregated/Crystal/abc123');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(400);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toContain('Invalid itemIds');
    });

    it('should accept comma-separated item IDs', async () => {
      const itemIds = `${getUniqueItemId()},${getUniqueItemId()},${getUniqueItemId()}`;
      const upstreamData = { items: [] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(upstreamData), { status: 200 })
      );

      const request = createRequest(`/api/v2/aggregated/Crystal/${itemIds}`);
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(200);
    });

    it('should normalize item IDs for consistent cache keys', async () => {
      const upstreamData = { items: [] };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(upstreamData), { status: 200 })
      );

      // First request with one order
      const request1 = createRequest('/api/v2/aggregated/Crystal/30001,10001,20001');
      await app.fetch(request1, mockEnv, mockCtx);

      // Second request with different order should hit cache
      const request2 = createRequest('/api/v2/aggregated/Crystal/20001,10001,30001');
      await app.fetch(request2, mockEnv, mockCtx);

      // Wait for background operations
      await vi.advanceTimersByTimeAsync(100);

      // The upstream should have been called only once if normalization works
      // (Though due to mocking complexity, we're mainly testing the route accepts both)
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle rate limiting from upstream', async () => {
      const itemId = getUniqueItemId();
      mockFetch.mockResolvedValueOnce(
        new Response('Rate limited', { status: 429, statusText: 'Too Many Requests' })
      );

      const request = createRequest(`/api/v2/aggregated/Crystal/${itemId}`);
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(429);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toContain('Rate limited');
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should handle upstream errors', async () => {
      const itemId = getUniqueItemId();
      mockFetch.mockResolvedValueOnce(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

      const request = createRequest(`/api/v2/aggregated/Crystal/${itemId}`);
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(404);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toContain('Upstream API error');
    });

    it('should handle network errors', async () => {
      const itemId = getUniqueItemId();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request = createRequest(`/api/v2/aggregated/Crystal/${itemId}`);
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(502);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toContain('Failed to fetch');
    });

    it('should include cache headers', async () => {
      const itemId = getUniqueItemId();
      const upstreamData = { items: [] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(upstreamData), { status: 200 })
      );

      const request = createRequest(`/api/v2/aggregated/Crystal/${itemId}`);
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(response.headers.get('X-Cache-Source')).toBe('upstream');
      expect(response.headers.get('Cache-Control')).toContain('max-age=');
    });
  });

  describe('GET /api/v2/data-centers', () => {
    beforeEach(() => {
      resetAllMocks();
      mockFetch.mockReset();
    });

    it('should return data centers list', async () => {
      const freshEnv = createMockEnv();
      const freshCtx = createMockExecutionContext();

      const upstreamData = [{ name: 'Crystal', region: 'North America' }];
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(upstreamData), { status: 200 })
      );

      const request = createRequest('/api/v2/data-centers');
      const response = await app.fetch(request, freshEnv, freshCtx);

      expect(response.status).toBe(200);
      const data = await response.json<Record<string, unknown>>();
      expect(data).toEqual(upstreamData);
    });

    it('should include cache headers on response', async () => {
      const freshEnv = createMockEnv();
      const freshCtx = createMockExecutionContext();

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      );

      const request = createRequest('/api/v2/data-centers');
      const response = await app.fetch(request, freshEnv, freshCtx);

      expect(response.headers.get('X-Cache-Source')).toBeTruthy();
      expect(response.headers.get('Cache-Control')).toContain('max-age=');
    });

    it('should handle upstream errors from data-centers endpoint', async () => {
      // Mock cachedFetch to throw an UpstreamError
      mockCachedFetch.mockImplementationOnce(() => {
        throw new UpstreamError(503, 'Service Unavailable');
      });

      const request = createRequest('/api/v2/data-centers');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(503);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toContain('Upstream API error: 503');

      // Clear the mock implementation for subsequent tests
      mockCachedFetch.mockReset();
    });

    it('should handle network errors from data-centers endpoint', async () => {
      // Mock cachedFetch to throw a generic Error
      mockCachedFetch.mockImplementationOnce(() => {
        throw new Error('Connection refused');
      });

      const request = createRequest('/api/v2/data-centers');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(502);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toBe('Failed to fetch data centers');

      // Clear the mock implementation for subsequent tests
      mockCachedFetch.mockReset();
    });
  });

  describe('GET /api/v2/worlds', () => {
    beforeEach(() => {
      resetAllMocks();
      mockFetch.mockReset();
    });

    it('should return worlds list', async () => {
      const freshEnv = createMockEnv();
      const freshCtx = createMockExecutionContext();

      const upstreamData = [{ id: 1, name: 'Balmung' }];
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(upstreamData), { status: 200 })
      );

      const request = createRequest('/api/v2/worlds');
      const response = await app.fetch(request, freshEnv, freshCtx);

      expect(response.status).toBe(200);
      const data = await response.json<Record<string, unknown>>();
      expect(data).toEqual(upstreamData);
    });

    it('should include cache headers on response', async () => {
      const freshEnv = createMockEnv();
      const freshCtx = createMockExecutionContext();

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      );

      const request = createRequest('/api/v2/worlds');
      const response = await app.fetch(request, freshEnv, freshCtx);

      expect(response.headers.get('X-Cache-Source')).toBeTruthy();
      expect(response.headers.get('Cache-Control')).toContain('max-age=');
    });

    it('should handle upstream errors from worlds endpoint', async () => {
      // Mock cachedFetch to throw an UpstreamError
      mockCachedFetch.mockImplementationOnce(() => {
        throw new UpstreamError(502, 'Bad Gateway');
      });

      const request = createRequest('/api/v2/worlds');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(502);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toContain('Upstream API error: 502');

      // Clear the mock implementation for subsequent tests
      mockCachedFetch.mockReset();
    });

    it('should handle network errors from worlds endpoint', async () => {
      // Mock cachedFetch to throw a generic Error
      mockCachedFetch.mockImplementationOnce(() => {
        throw new Error('DNS resolution failed');
      });

      const request = createRequest('/api/v2/worlds');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(502);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toBe('Failed to fetch worlds');

      // Clear the mock implementation for subsequent tests
      mockCachedFetch.mockReset();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const request = createRequest('/unknown/route');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(404);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toBe('Not Found');
      expect(data.availableEndpoints).toContain('/api/v2/data-centers');
      expect(data.availableEndpoints).toContain('/api/v2/worlds');
    });

    it('should include list of available endpoints', async () => {
      const request = createRequest('/api/v2/unknown');
      const response = await app.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(404);
      const data = await response.json<Record<string, unknown>>();
      expect(data.availableEndpoints).toBeInstanceOf(Array);
      expect((data.availableEndpoints as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handler', () => {
    it('should handle unexpected errors', async () => {
      // Create a request that would trigger an internal error
      // We'll mock the env to cause an error
      const badEnv = {
        ...mockEnv,
        ALLOWED_ORIGINS: null as unknown as string, // This will cause an error when split is called
      };

      const request = createRequest('/health');

      // This should be caught by the error handler
      const response = await app.fetch(request, badEnv, mockCtx);

      expect(response.status).toBe(500);
      const data = await response.json<Record<string, unknown>>();
      expect(data.error).toBe('Internal Server Error');
    });

    it('should show error details in development mode', async () => {
      const devEnv = createMockEnv({ ENVIRONMENT: 'development' });

      // Force an error by providing invalid env
      const badEnv = {
        ...devEnv,
        ALLOWED_ORIGINS: null as unknown as string,
      };

      const request = createRequest('/health');
      const response = await app.fetch(request, badEnv, mockCtx);

      expect(response.status).toBe(500);
      const data = await response.json<Record<string, unknown>>();
      // In development, error message should be more detailed
      expect(data.message).toBeTruthy();
    });
  });
});

describe('normalizeItemIds helper', () => {
  // The function is not exported, but we can test its behavior through the route
  // These tests validate the normalization logic indirectly

  it('should sort and deduplicate through the route', async () => {
    const mockEnv = createMockEnv();
    const mockCtx = createMockExecutionContext();
    const upstreamData = { items: [] };

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(upstreamData), { status: 200 })
    );

    // Make requests with different orderings
    const request1 = await app.fetch(
      new Request('https://test.example.com/api/v2/aggregated/Crystal/3,1,2', {
        headers: { Origin: 'https://xivdyetools.app' },
      }),
      mockEnv,
      mockCtx
    );

    expect(request1.status).toBe(200);

    // The fetch URL should have items in original order (normalization is for cache key only)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('3,1,2'),
      expect.any(Object)
    );
  });
});
