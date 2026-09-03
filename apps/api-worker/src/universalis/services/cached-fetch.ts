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
import type { CacheConfig, CacheResult, CacheSource } from '../types';

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
  /**
   * FINDING-025 / API-7: runs only when the Cache API missed, before the
   * upstream fetch — the place to charge a per-client budget so fully cached
   * answers stay free. Throw to abort; the error propagates to the caller.
   */
  onMiss?: () => Promise<void>;
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
 * FINDING-025 / API-9: a hung Universalis response used to pin the request
 * (and every coalesced waiter) until the coalescer's 60 s sweep.
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Main cached fetch function - orchestrates cache lookup
 *
 * @returns CacheResult with data, source, and staleness info
 * @throws Error if upstream fetch fails and no cached data available
 */
export async function cachedFetch<T = unknown>(
  options: CachedFetchOptions
): Promise<CacheResult<T>> {
  const { cacheKey, config, upstreamUrl, ctx, onMiss } = options;

  const cacheService = new CacheService(ctx);
  const coalescer = new RequestCoalescer(ctx);

  // Check Cache API
  const cacheResult = await cacheService.get(cacheKey);
  if (cacheResult) {
    const data = (await cacheResult.response.json()) as T;

    // api-worker-12: the two raw `console.log(JSON.stringify(...))` calls that
    // used to sit here and at the miss below were the only logging in this
    // worker to bypass @xivdyetools/logger — no adapter, no level control, no
    // redaction — and they fired twice per market request. The same signal is
    // already on every response as the `X-Cache` header, which is where a
    // caller reads it from, so they are gone rather than rewritten: two log
    // lines per market call is exactly the volume the standing "never enable
    // Workers Logs without re-checking FINDING-010/011" constraint is about.

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

  // api-worker-12: see the note on the hit path above — `X-Cache: MISS` on the
  // response is the signal, and it costs no log line.

  // FINDING-025 / API-7: the caller's miss budget (per-IP limiter) is charged
  // here — after the cache lookup, so hits are free — and may abort the fetch.
  if (onMiss) {
    await onMiss();
  }

  // Fetch from upstream with request coalescing
  const data = await coalescer.coalesce<T>(cacheKey, async () => {
    const response = await fetchFromUpstream(upstreamUrl);

    if (!response.ok) {
      throw new UpstreamError(response.status, response.statusText);
    }

    const parsed = JSON.parse(await readBounded(response)) as T;
    // OPT-021: store INSIDE the coalesced function so only the winning fetch
    // writes — previously every waiter in a burst re-serialized and re-put
    // the identical entry (N puts + N waitUntil slots per burst).
    cacheService.storeAsync(cacheKey, parsed, config);
    return parsed;
  });

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
    // FINDING-025 / API-9: never follow a redirect to a third host and cache
    // whatever it serves; never wait on a hung upstream indefinitely.
    // `manual`, NOT `error`: the Workers runtime implements only `follow` and
    // `manual` and throws `TypeError: Invalid redirect value` on `error` —
    // every upstream fetch failed that way in production (502) from the
    // 2026-08-28 deploy until 2026-08-29. A 3xx now comes back as a response,
    // which the `!response.ok` check below refuses without following it.
    redirect: 'manual',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  // PROXY-HIGH-002: Check Content-Length to prevent OOM from huge responses
  // (cheap fast-fail; the authoritative guard is readBounded, since chunked
  // responses carry no Content-Length — BUG-065)
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
 * BUG-065: read the response body with a hard byte budget. Content-Length can
 * be absent (Transfer-Encoding: chunked), so counting streamed bytes is the
 * only reliable enforcement of MAX_RESPONSE_SIZE_BYTES.
 */
async function readBounded(response: Response): Promise<string> {
  if (!response.body) {
    return '';
  }
  // workers-types leaves ReadableStream chunks untyped; body bytes are Uint8Array
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_SIZE_BYTES) {
      await reader.cancel();
      throw new ResponseTooLargeError(bytes);
    }
    text += decoder.decode(value, { stream: true });
  }
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
    await coalescer.coalesce(revalidateKey, async () => {
      const response = await fetchFromUpstream(upstreamUrl);

      if (!response.ok) {
        throw new Error(`Revalidation failed: ${response.status}`);
      }

      const parsed: unknown = JSON.parse(await readBounded(response));
      // OPT-021: store once per fetch, not once per coalesced waiter
      cacheService.storeAsync(cacheKey, parsed, config);
      return parsed;
    });
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
    'X-Cache': source === 'upstream' ? 'MISS' : isStale ? 'HIT-STALE' : 'HIT',
    'X-Cache-Source': source,
    'X-Cache-Stale': isStale ? 'true' : 'false',
    // BUG-028: a stale SWR response is already up to cacheTtl+swrWindow old —
    // re-serving it with a full max-age let downstream caches treat it as
    // fresh for ANOTHER full TTL. Stale responses now demand revalidation
    // (the edge refreshes in the background, so the next request is fresh);
    // fresh responses advertise the SWR window so downstream caches can
    // implement stale-while-revalidate natively.
    'Cache-Control': isStale
      ? 'public, max-age=0, must-revalidate'
      : `public, max-age=${config.cacheTtl}, stale-while-revalidate=${config.swrWindow}`,
  };
}
