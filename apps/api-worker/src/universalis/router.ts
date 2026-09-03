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
 * FINDING-025 / API-7: thrown from cachedFetch's `onMiss` hook when the
 * per-IP budget is exhausted — only cache misses are charged, so a fully
 * cached answer (and a service-binding caller's repeats) stays free.
 */
class ProxyRateLimitedError extends Error {
  constructor(
    public readonly result: Awaited<ReturnType<typeof checkRateLimit>>,
    public readonly config: RateLimitConfig,
  ) {
    super('Rate limit exceeded');
    this.name = 'ProxyRateLimitedError';
  }
}

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
 * The status this worker answers with for a given upstream status.
 *
 * api-worker-04: the three error paths cast `error.status` straight into the
 * response. `cachedFetch` uses `redirect: 'manual'`, so a 3xx from Universalis
 * arrives as a non-ok response and became `UpstreamError(302, …)` — and
 * `c.json(body, 302)` is a **redirect with a JSON body and no `Location`**.
 * It also slipped the `no-store` guard in `index.ts`, which only fires at
 * `>= 400`, so a 301 was heuristically cacheable. Not reachable today, but it
 * becomes reachable the day Universalis adds a host or path redirect — the
 * same failure family as the 2026-08-28 `redirect: 'error'` outage.
 *
 * Only statuses this API means to speak pass through; anything else is a 502,
 * which is what "the upstream did something we do not handle" actually is.
 */
const PASSTHROUGH_UPSTREAM_STATUSES = new Set([400, 404, 429, 500, 503]);

function clampUpstreamStatus(status: number): 400 | 404 | 429 | 500 | 502 | 503 {
  return PASSTHROUGH_UPSTREAM_STATUSES.has(status)
    ? (status as 400 | 404 | 429 | 500 | 503)
    : 502;
}

/**
 * How much bigger the service-binding budget is than one public IP's.
 *
 * BUG-048: `getClientIp` returns the literal `'unknown'` when there is no
 * `CF-Connecting-IP`, and discord-worker's sub-request carries none — so the
 * ENTIRE bot fleet shared one public-sized bucket. Production sets
 * `RATE_LIMIT_REQUESTS = 30`, so once ~30 *distinct* datacenter/item
 * combinations missed the cache inside one 60-second window in one isolate,
 * the 31st `/budget` in ANY guild got a 429 — cross-tenant throttling on a key
 * nobody owns. The "charge on miss only" mitigation (FINDING-025 / API-7)
 * protects repeats of the SAME key, which is not the pattern `/budget`
 * produces: every new dye/world pair is a fresh miss.
 *
 * The bucket is separated rather than removed. discord-worker limits `/budget`
 * per user already, so this is a ceiling on the aggregate rather than the
 * primary control — but a ceiling that a bot bug cannot turn into an unbounded
 * fan-out at Universalis is worth keeping.
 */
const SERVICE_BINDING_BUDGET_MULTIPLIER = 20;

/**
 * The rate-limit identity and budget for this request.
 *
 * A request with no `CF-Connecting-IP` is one of our own workers over a
 * Service Binding — the header is set by Cloudflare for every external
 * request, which is the same assumption `getClientIp` already documents.
 */
function resolveRateLimitScope(
  request: Request,
  config: RateLimitConfig
): { key: string; config: RateLimitConfig } {
  const clientIP = getClientIp(request);
  if (clientIP !== 'unknown') {
    return { key: clientIP, config };
  }
  return {
    key: 'svc:universalis',
    config: {
      ...config,
      maxRequests: config.maxRequests * SERVICE_BINDING_BUDGET_MULTIPLIER,
    },
  };
}

/**
 * GET <mount>/aggregated/:datacenter/:itemIds — aggregated price data.
 * Rate-limited per IP, validated, cached (300s + 120s SWR), coalesced.
 */
universalisRouter.get('/aggregated/:datacenter/:itemIds', async (c) => {
  const { datacenter, itemIds } = c.req.param();

  // SECURITY (BUG-066/SEC-002): shared getClientIp prefers unspoofable CF-Connecting-IP
  // BUG-048: service-binding traffic gets its own key and its own budget —
  // it used to fall into the shared `'unknown'` bucket with every other
  // IP-less caller, so the whole bot fleet competed for one public-sized
  // allowance and `/budget` commands 429'd each other across guilds.
  const { key: rateLimitKey, config: rateLimitConfig } = resolveRateLimitScope(c.req.raw, {
    maxRequests: parseInt(c.env.RATE_LIMIT_REQUESTS, 10) || 60,
    windowSeconds: parseInt(c.env.RATE_LIMIT_WINDOW_SECONDS, 10) || 60,
  });
  // FINDING-025 / API-7: charged from cachedFetch's onMiss hook below — after
  // the Cache API lookup — so cache hits never consume the budget.
  const chargeLimiter = async (): Promise<void> => {
    const result = await checkRateLimit(rateLimitKey, rateLimitConfig);
    if (!result.allowed) throw new ProxyRateLimitedError(result, rateLimitConfig);
  };

  // SECURITY: datacenter whitelist, with BUG-029 live-list fallback so worlds
  // added after the static list was written are accepted without a code change.
  if (!isValidDatacenterOrWorld(datacenter)) {
    let knownUpstream = false;
    try {
      const validationCtx = c.executionCtx as ExecutionContext;
      const [dcResult, worldResult] = await Promise.all([
        cachedFetch({
          cacheKey: 'data-centers:all',
          config: CACHE_CONFIGS.dataCenters,
          upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/data-centers`,
          ctx: validationCtx,
        }),
        cachedFetch({
          cacheKey: 'worlds:all',
          config: CACHE_CONFIGS.worlds,
          upstreamUrl: `${c.env.UNIVERSALIS_API_BASE}/worlds`,
          ctx: validationCtx,
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
      onMiss: chargeLimiter,
    });

    return c.json(result.data, 200, buildCacheHeaders(result.source, result.isStale, config));
  } catch (error) {
    if (error instanceof ProxyRateLimitedError) {
      const headers = getRateLimitHeaders(error.result, error.config.maxRequests);
      return c.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: error.result.resetInSeconds,
        },
        429,
        {
          ...headers,
          'Retry-After': String(error.result.resetInSeconds),
        }
      );
    }

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

      // FINDING-025 / API-8: the upstream statusText is logged, not echoed
      getLogger(c)?.warn('Upstream API error', {
        operation: 'universalis.aggregated',
        datacenter,
        upstreamStatus: error.status,
        upstreamStatusText: error.statusText,
      });
      return c.json(
        {
          error: `Upstream API error: ${error.status}`,
          message: 'The upstream API returned an error',
        },
        clampUpstreamStatus(error.status)
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

    // FINDING-025 / API-8: raw Error.message (fetch / JSON internals) is
    // logged with the request ID, never returned
    getLogger(c)?.error('Error proxying to Universalis', error, {
      operation: 'universalis.aggregated',
      datacenter,
    });
    return c.json(
      {
        error: 'Failed to fetch from upstream API',
        message: 'The upstream request failed; retry later',
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
    });

    return c.json(result.data, 200, buildCacheHeaders(result.source, result.isStale, config));
  } catch (error) {
    if (error instanceof UpstreamError) {
      return c.json(
        { error: `Upstream API error: ${error.status}` },
        clampUpstreamStatus(error.status)
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
    });

    return c.json(result.data, 200, buildCacheHeaders(result.source, result.isStale, config));
  } catch (error) {
    if (error instanceof UpstreamError) {
      return c.json(
        { error: `Upstream API error: ${error.status}` },
        clampUpstreamStatus(error.status)
      );
    }

    getLogger(c)?.error('Error fetching worlds', error, {
      operation: 'universalis.worlds',
    });
    return c.json({ error: 'Failed to fetch worlds' }, 502);
  }
});
