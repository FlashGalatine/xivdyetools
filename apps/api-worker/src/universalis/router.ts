/**
 * Universalis market-board proxy routes.
 *
 * Absorbed from the standalone `apps/universalis-proxy` worker (Monorepo 2.0
 * Tier 2 — see DEPRECATIONS.md). The worker existed to stamp CORS headers on
 * every Universalis response (including errors) and to cache/coalesce upstream
 * requests; api-worker's global `cors({ origin: '*' })` middleware now covers
 * the CORS half, and the cache/coalesce machinery moved here verbatim.
 *
 * Mounted twice in `src/index.ts`:
 * - `/universalis/*` — canonical path on data.xivdyetools.app
 * - `/api/v2/*`      — compatibility mount: preserves the exact path shape used
 *   by already-deployed web-app bundles (via the proxy.xivdyetools.app custom
 *   domain, which moves to this worker) and by discord-worker's
 *   UNIVERSALIS_PROXY service binding (`/api/v2/aggregated/...`).
 *
 * Responses are deliberately NOT wrapped in the api-worker `{success,data,meta}`
 * envelope — consumers (core `APIService`, discord-worker's budget pipeline)
 * parse raw Universalis body shapes.
 *
 * NOT mounted under `/v1/*`: that would add the KV rate limiter and the locale
 * middleware to every market request; this router keeps the proxy's own
 * per-isolate memory rate limiter on the aggregated route.
 */

import { Hono } from 'hono';
import { getLogger } from '@xivdyetools/worker-kit';
import { getClientIp } from '@xivdyetools/worker-kit/rate-limiter';
import type { Env } from '../types.js';
import { CACHE_CONFIGS } from './config/cache';
import { isValidDatacenterOrWorld, isNameInUpstreamLists } from './config/datacenters';
import {
  cachedFetch,
  buildCacheHeaders,
  UpstreamError,
  ResponseTooLargeError,
} from './services/cached-fetch';
import { checkRateLimit, getRateLimitHeaders, type RateLimitConfig } from './services/rate-limiter';

/** Retry-After header value when rate limited (seconds) */
const RATE_LIMIT_RETRY_AFTER = 60;

/**
 * Normalize item IDs for consistent cache keys.
 * OPT-022: dedupe + numeric sort so "5729,5729" / "3,1,2" share cache entries.
 */
function normalizeItemIds(itemIds: string): string {
  return [
    ...new Set(
      itemIds
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0)
    ),
  ]
    .sort((a, b) => a - b)
    .join(',');
}

export const universalisRouter = new Hono<{ Bindings: Env }>();

/**
 * GET <mount>/aggregated/:datacenter/:itemIds — aggregated price data.
 * Rate-limited per IP, validated, cached (300s + 120s SWR), coalesced.
 */
universalisRouter.get('/aggregated/:datacenter/:itemIds', async (c) => {
  const { datacenter, itemIds } = c.req.param();

  // SECURITY (BUG-066/SEC-002): shared getClientIp prefers unspoofable CF-Connecting-IP
  const clientIP = getClientIp(c.req.raw);
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

  // SECURITY: datacenter whitelist, with BUG-029 live-list fallback so worlds
  // added after the static list was written are accepted without a code change.
  if (!isValidDatacenterOrWorld(datacenter)) {
    let knownUpstream = false;
    try {
      const validationBaseUrl = new URL(c.req.url).origin;
      const validationCtx = c.executionCtx as ExecutionContext;
      const [dcResult, worldResult] = await Promise.all([
        cachedFetch({
          cacheKey: 'data-centers:all',
          config: CACHE_CONFIGS.dataCenters,
          upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/data-centers`,
          ctx: validationCtx,
          baseUrl: validationBaseUrl,
        }),
        cachedFetch({
          cacheKey: 'worlds:all',
          config: CACHE_CONFIGS.worlds,
          upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/worlds`,
          ctx: validationCtx,
          baseUrl: validationBaseUrl,
        }),
      ]);
      knownUpstream = isNameInUpstreamLists(datacenter, dcResult.data, worldResult.data);
    } catch {
      // Upstream lists unavailable — fall back to the static whitelist verdict
    }
    if (!knownUpstream) {
      return c.json({ error: 'Invalid datacenter or world name' }, 400);
    }
  }

  // Validate itemIds (comma-separated numbers only)
  if (!/^[\d,]+$/.test(itemIds)) {
    return c.json({ error: 'Invalid itemIds parameter' }, 400);
  }

  // PROXY-CRITICAL-003: count + range validation to prevent DoS
  const ids = itemIds.split(',').map(Number);

  if (ids.length === 0 || ids.length > 100) {
    return c.json(
      {
        error: 'Item count must be between 1 and 100',
        provided: ids.length,
      },
      400
    );
  }

  const invalidIds = ids.filter((id) => !Number.isInteger(id) || id < 1 || id > 1000000);
  if (invalidIds.length > 0) {
    return c.json(
      {
        error: 'Invalid item IDs detected',
        invalidIds: invalidIds.slice(0, 10),
      },
      400
    );
  }

  const normalizedIds = normalizeItemIds(itemIds);
  const cacheKey = `aggregated:${datacenter.toLowerCase()}:${normalizedIds}`;
  const config = CACHE_CONFIGS.aggregated;

  try {
    const result = await cachedFetch({
      cacheKey,
      config,
      // OPT-002: bound response size via listings/entries; OPT-022: canonical upstream URL
      upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/aggregated/${datacenter.toLowerCase()}/${normalizedIds}?listings=5&entries=5`,
      // Hono's ExecutionContext type lacks the `tracing` field from newer
      // workers-types; the runtime value is the full Workers ExecutionContext.
      ctx: c.executionCtx as ExecutionContext,
      baseUrl: new URL(c.req.url).origin,
    });

    return c.json(result.data, 200, buildCacheHeaders(result.source, result.isStale, config));
  } catch (error) {
    if (error instanceof UpstreamError) {
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

    // BUG-065: dedicated message for oversized upstream bodies
    if (error instanceof ResponseTooLargeError) {
      getLogger(c)?.error('Upstream response exceeded size limit', error, {
        operation: 'universalis.aggregated',
        datacenter,
      });
      return c.json(
        {
          error: 'Upstream response too large',
          message: 'The upstream API returned a response exceeding the size limit',
        },
        502
      );
    }

    getLogger(c)?.error('Error proxying to Universalis', error, {
      operation: 'universalis.aggregated',
      datacenter,
    });
    return c.json(
      {
        error: 'Failed to fetch from upstream API',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      502
    );
  }
});

/** GET <mount>/data-centers — 24h cache + 6h SWR. */
universalisRouter.get('/data-centers', async (c) => {
  const cacheKey = 'data-centers:all';
  const config = CACHE_CONFIGS.dataCenters;

  try {
    const result = await cachedFetch({
      cacheKey,
      config,
      upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/data-centers`,
      ctx: c.executionCtx as ExecutionContext,
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

    getLogger(c)?.error('Error fetching data centers', error, {
      operation: 'universalis.dataCenters',
    });
    return c.json({ error: 'Failed to fetch data centers' }, 502);
  }
});

/** GET <mount>/worlds — 24h cache + 6h SWR. */
universalisRouter.get('/worlds', async (c) => {
  const cacheKey = 'worlds:all';
  const config = CACHE_CONFIGS.worlds;

  try {
    const result = await cachedFetch({
      cacheKey,
      config,
      upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/worlds`,
      ctx: c.executionCtx as ExecutionContext,
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

    getLogger(c)?.error('Error fetching worlds', error, {
      operation: 'universalis.worlds',
    });
    return c.json({ error: 'Failed to fetch worlds' }, 502);
  }
});
