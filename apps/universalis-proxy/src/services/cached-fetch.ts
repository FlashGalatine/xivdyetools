/**
 * Cached Fetch - Main orchestration for the caching system
 *
 * This module orchestrates the cache lookup flow:
 * 1. Check Cache API (edge-local, fast)
 * 2. Coalesce and fetch from upstream
 * 3. Store results back to cache
 *
 * Implements stale-while-revalidate pattern for better performance.
 */

import { CacheService } from './cache-service';
import { RequestCoalescer } from './request-coalescer';
import type { CacheConfig, CacheResult, CacheSource } from '../types/cache';

/**
 * Options for cached fetch
 */
export interface CachedFetchOptions {
  /** Unique cache key for this request */
  cacheKey: string;
  /** Cache configuration for this endpoint type */
  config: CacheConfig;
  /** Full URL to the upstream API */
  upstreamUrl: string;
  /** Worker execution context */
  ctx: ExecutionContext;
  /** Base URL for Cache API synthetic URLs */
  baseUrl: string;
}

/**
 * User-Agent header for upstream requests
 */
const USER_AGENT = 'XIVDyeTools/1.0 (https://xivdyetools.app)';

/**
 * PROXY-HIGH-002: Maximum allowed response size from upstream (5MB)
 * Prevents OOM from unexpectedly large responses
 */
const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Main cached fetch function - orchestrates cache lookup
 *
 * @returns CacheResult with data, source, and staleness info
 * @throws Error if upstream fetch fails and no cached data available
 */
export async function cachedFetch<T = unknown>(
  options: CachedFetchOptions
): Promise<CacheResult<T>> {
  const { cacheKey, config, upstreamUrl, ctx, baseUrl } = options;

  const cacheService = new CacheService(ctx, baseUrl);
  const coalescer = new RequestCoalescer(ctx);

  // Check Cache API
  const cacheResult = await cacheService.get(cacheKey);
  if (cacheResult) {
    const data = (await cacheResult.response.json()) as T;

    if (cacheResult.isStale) {
      // Trigger background revalidation, but return stale data immediately
      ctx.waitUntil(
        revalidateInBackground(cacheKey, upstreamUrl, cacheService, config, coalescer)
      );
    }

    return {
      data,
      source: 'cache-api',
      isStale: cacheResult.isStale,
    };
  }

  // Fetch from upstream with request coalescing
  const data = await coalescer.coalesce<T>(cacheKey, async () => {
    const response = await fetchFromUpstream(upstreamUrl);

    if (!response.ok) {
      throw new UpstreamError(response.status, response.statusText);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return response.json() as Promise<T>;
  });

  // Store to cache (async, non-blocking)
  cacheService.storeAsync(cacheKey, data, config);

  return {
    data,
    source: 'upstream',
    isStale: false,
  };
}

/**
 * Fetch from upstream Universalis API with size validation
 * PROXY-HIGH-002: Validates response size before allowing JSON parsing
 *
 * @throws ResponseTooLargeError if Content-Length exceeds MAX_RESPONSE_SIZE_BYTES
 */
async function fetchFromUpstream(url: string): Promise<Response> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  // PROXY-HIGH-002: Check Content-Length to prevent OOM from huge responses
  const contentLength = response.headers.get('Content-Length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_RESPONSE_SIZE_BYTES) {
      throw new ResponseTooLargeError(size);
    }
  }

  return response;
}

/**
 * Revalidate cached data in the background
 * This is called when serving stale data to refresh the cache
 */
async function revalidateInBackground(
  cacheKey: string,
  upstreamUrl: string,
  cacheService: CacheService,
  config: CacheConfig,
  coalescer: RequestCoalescer
): Promise<void> {
  const revalidateKey = `revalidate:${cacheKey}`;

  try {
    // Use coalescing to prevent multiple simultaneous revalidations
    const data = await coalescer.coalesce(revalidateKey, async () => {
      const response = await fetchFromUpstream(upstreamUrl);

      if (!response.ok) {
        throw new Error(`Revalidation failed: ${response.status}`);
      }

      return response.json();
    });

    // Update cache with fresh data
    cacheService.storeAsync(cacheKey, data, config);
  } catch {
    // Revalidation failed silently - stale data will continue to be served
    // until it expires beyond the SWR window
  }
}

/**
 * Custom error for upstream API failures
 */
export class UpstreamError extends Error {
  status: number;
  statusText: string;

  constructor(status: number, statusText: string) {
    super(`Upstream API error: ${status} ${statusText}`);
    this.name = 'UpstreamError';
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * PROXY-HIGH-002: Error for responses exceeding size limit
 */
export class ResponseTooLargeError extends Error {
  sizeBytes: number;
  maxBytes: number;

  constructor(sizeBytes: number) {
    super(`Response too large: ${sizeBytes} bytes exceeds limit of ${MAX_RESPONSE_SIZE_BYTES} bytes`);
    this.name = 'ResponseTooLargeError';
    this.sizeBytes = sizeBytes;
    this.maxBytes = MAX_RESPONSE_SIZE_BYTES;
  }
}

/**
 * Build response headers for cache debugging
 */
export function buildCacheHeaders(
  source: CacheSource,
  isStale: boolean,
  config: CacheConfig
): Record<string, string> {
  return {
    'X-Cache': source === 'upstream' ? 'MISS' : 'HIT',
    'X-Cache-Source': source,
    'X-Cache-Stale': isStale ? 'true' : 'false',
    'Cache-Control': `public, max-age=${config.cacheTtl}`,
  };
}
