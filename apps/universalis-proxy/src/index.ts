/**
 * XIV Dye Tools - Universalis API Proxy
 *
 * A Cloudflare Worker that proxies requests to the Universalis API with:
 * - Proper CORS headers on ALL responses (including errors)
 * - Cache API caching for optimal performance
 * - Request coalescing to prevent duplicate upstream requests
 * - Stale-while-revalidate for fast responses during cache refresh
 *
 * @module xivdyetools-universalis-proxy
 */

import { Hono } from 'hono';
import type { Env } from './types/cache';
import { CACHE_CONFIGS } from './config/cache';
import { isValidDatacenterOrWorld } from './config/datacenters';
import { cachedFetch, buildCacheHeaders, UpstreamError } from './services/cached-fetch';
import { checkRateLimit, getRateLimitHeaders, type RateLimitConfig } from './services/rate-limiter';

/**
 * Retry-After header value when rate limited (seconds)
 */
const RATE_LIMIT_RETRY_AFTER = 60;

const app = new Hono<{ Bindings: Env }>();

// =============================================================================
// CORS Middleware - Applied to ALL responses including errors
// PROXY-CRITICAL-002: Set headers directly for clarity and reliability
// =============================================================================

app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  const origin = c.req.header('Origin') || '';

  // Check if origin is allowed
  const isAllowed =
    c.env.ENVIRONMENT === 'development'
      ? // In development, allow localhost on any port
        origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
      : allowedOrigins.includes(origin);

  // Determine the origin to use in CORS headers
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];

  // Handle preflight OPTIONS requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
      },
    });
  }

  // Continue to next middleware/handler
  await next();

  // Set CORS headers on all responses
  c.header('Access-Control-Allow-Origin', corsOrigin);
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return;
});

// =============================================================================
// Health Check
// =============================================================================

app.get('/', (c) => {
  return c.json({
    name: 'xivdyetools-universalis-proxy',
    status: 'ok',
    environment: c.env.ENVIRONMENT,
    version: '1.1.0',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// =============================================================================
// Universalis API Proxy Routes
// =============================================================================

/**
 * Normalize item IDs for consistent cache keys
 * Sorts IDs numerically to ensure same items in different order hit same cache
 */
function normalizeItemIds(itemIds: string): string {
  return itemIds
    .split(',')
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b)
    .join(',');
}

/**
 * Proxy aggregated price data endpoint
 * GET /api/v2/aggregated/:datacenter/:itemIds
 *
 * Features:
 * - IP-based rate limiting
 * - Cache API caching
 * - Request coalescing for duplicate requests
 * - Stale-while-revalidate for fast responses
 * - Normalized cache keys for better hit rates
 */
app.get('/api/v2/aggregated/:datacenter/:itemIds', async (c) => {
  const { datacenter, itemIds } = c.req.param();

  // SECURITY: Rate limit by IP address to prevent abuse
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const rateLimitConfig: RateLimitConfig = {
    maxRequests: parseInt(c.env.RATE_LIMIT_REQUESTS, 10) || 60,
    windowSeconds: parseInt(c.env.RATE_LIMIT_WINDOW_SECONDS, 10) || 60,
  };
  const rateLimitResult = await checkRateLimit(clientIP, rateLimitConfig);

  if (!rateLimitResult.allowed) {
    const headers = getRateLimitHeaders(rateLimitResult, rateLimitConfig.maxRequests);
    return c.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.resetInSeconds,
      },
      429,
      {
        ...headers,
        'Retry-After': String(rateLimitResult.resetInSeconds),
      }
    );
  }

  // SECURITY: Validate datacenter against whitelist of known FFXIV datacenters/worlds
  // This prevents cache pollution and reduces attack surface
  if (!isValidDatacenterOrWorld(datacenter)) {
    return c.json({ error: 'Invalid datacenter or world name' }, 400);
  }

  // Validate itemIds (comma-separated numbers only)
  if (!/^[\d,]+$/.test(itemIds)) {
    return c.json({ error: 'Invalid itemIds parameter' }, 400);
  }

  // PROXY-CRITICAL-003: Validate item ID count and range to prevent DoS
  const ids = itemIds.split(',').map(Number);

  // Reject empty or excessive item counts (Universalis recommends max 100)
  if (ids.length === 0 || ids.length > 100) {
    return c.json({
      error: 'Item count must be between 1 and 100',
      provided: ids.length,
    }, 400);
  }

  // Validate each item ID is a valid positive integer within reasonable range
  // FFXIV item IDs are typically under 100,000 but we allow up to 1,000,000 for future-proofing
  const invalidIds = ids.filter(id => !Number.isInteger(id) || id < 1 || id > 1000000);
  if (invalidIds.length > 0) {
    return c.json({
      error: 'Invalid item IDs detected',
      invalidIds: invalidIds.slice(0, 10), // Only show first 10 to avoid large responses
    }, 400);
  }

  // Normalize cache key for better cache hit rates
  // - Lowercase datacenter for consistency
  // - Sort item IDs so [1,2,3] and [3,1,2] hit same cache
  const normalizedIds = normalizeItemIds(itemIds);
  const cacheKey = `aggregated:${datacenter.toLowerCase()}:${normalizedIds}`;
  const config = CACHE_CONFIGS.aggregated;

  try {
    const result = await cachedFetch({
      cacheKey,
      config,
      upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/aggregated/${datacenter}/${itemIds}`,
      ctx: c.executionCtx,
      baseUrl: new URL(c.req.url).origin,
    });

    return c.json(result.data, 200, buildCacheHeaders(result.source, result.isStale, config));
  } catch (error) {
    // Handle upstream errors specifically
    if (error instanceof UpstreamError) {
      // Handle rate limiting from upstream
      if (error.status === 429) {
        return c.json(
          {
            error: 'Rate limited by upstream API',
            retryAfter: RATE_LIMIT_RETRY_AFTER,
            message: 'Please try again later',
          },
          429,
          {
            'Retry-After': String(RATE_LIMIT_RETRY_AFTER),
          }
        );
      }

      return c.json(
        {
          error: `Upstream API error: ${error.status}`,
          message: error.statusText,
        },
        error.status as 400 | 404 | 500 | 502 | 503
      );
    }

    console.error('Error proxying to Universalis:', error);
    return c.json(
      {
        error: 'Failed to fetch from upstream API',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      502
    );
  }
});

/**
 * Proxy data centers list
 * GET /api/v2/data-centers
 *
 * Features:
 * - 24-hour cache TTL (data rarely changes)
 * - 6-hour stale-while-revalidate window
 */
app.get('/api/v2/data-centers', async (c) => {
  const cacheKey = 'data-centers:all';
  const config = CACHE_CONFIGS.dataCenters;

  try {
    const result = await cachedFetch({
      cacheKey,
      config,
      upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/data-centers`,
      ctx: c.executionCtx,
      baseUrl: new URL(c.req.url).origin,
    });

    return c.json(result.data, 200, buildCacheHeaders(result.source, result.isStale, config));
  } catch (error) {
    if (error instanceof UpstreamError) {
      return c.json(
        { error: `Upstream API error: ${error.status}` },
        error.status as 400 | 404 | 500 | 502 | 503
      );
    }

    console.error('Error fetching data centers:', error);
    return c.json({ error: 'Failed to fetch data centers' }, 502);
  }
});

/**
 * Proxy worlds list
 * GET /api/v2/worlds
 *
 * Features:
 * - 24-hour cache TTL (data rarely changes)
 * - 6-hour stale-while-revalidate window
 */
app.get('/api/v2/worlds', async (c) => {
  const cacheKey = 'worlds:all';
  const config = CACHE_CONFIGS.worlds;

  try {
    const result = await cachedFetch({
      cacheKey,
      config,
      upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/worlds`,
      ctx: c.executionCtx,
      baseUrl: new URL(c.req.url).origin,
    });

    return c.json(result.data, 200, buildCacheHeaders(result.source, result.isStale, config));
  } catch (error) {
    if (error instanceof UpstreamError) {
      return c.json(
        { error: `Upstream API error: ${error.status}` },
        error.status as 400 | 404 | 500 | 502 | 503
      );
    }

    console.error('Error fetching worlds:', error);
    return c.json({ error: 'Failed to fetch worlds' }, 502);
  }
});

// =============================================================================
// 404 Handler
// =============================================================================

app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      availableEndpoints: [
        '/api/v2/aggregated/:datacenter/:itemIds',
        '/api/v2/data-centers',
        '/api/v2/worlds',
      ],
    },
    404
  );
});

// =============================================================================
// Global Error Handler
// =============================================================================

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : 'An unexpected error occurred',
    },
    500
  );
});

export default app;
